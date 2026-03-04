import { pool } from "../lib/db";
import { getAuthUser } from "../lib/auth";

/**
 * POST /api/dialogues — Save a completed dialogue
 * GET /api/dialogues — List user's dialogues
 */
export async function handleDialogues(req: Request): Promise<Response> {
  if (req.method === "POST") return handleCreateDialogue(req);
  if (req.method === "GET") return handleListDialogues(req);
  return new Response("Method not allowed", { status: 405 });
}

/**
 * GET /api/dialogues/:id — Get single dialogue detail
 */
export async function handleDialogueById(req: Request, id: string): Promise<Response> {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const user = await getAuthUser(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const result = await pool.query(
    `SELECT
       d.id AS dialogue_id,
       d.prep_time,
       d.speaking_time,
       d.actual_duration,
       d.started_at,
       d.finished_at,
       p.text AS prompt_text,
       c.slug AS prompt_category,
       t.text AS transcript_text,
       t.highlighted_text,
       t.duration AS transcript_duration,
       t.speech_rate_wpm,
       t.words,
       t.segments,
       t.filler_words,
       t.clarity_metrics,
       f.overall_score,
       f.coach_summary,
       f.score_structure,
       f.score_clarity,
       f.score_specificity,
       f.score_persuasiveness,
       f.score_language,
       f.framework_detected,
       f.framework_suggested,
       f.time_usage,
       f.strengths,
       f.improvement
     FROM dialogue d
     JOIN dialogue_chain dc ON d.chain_id = dc.id
     JOIN prompt p ON d.prompt_id = p.id
     JOIN category c ON p.category_id = c.id
     LEFT JOIN transcript t ON t.dialogue_id = d.id
     LEFT JOIN feedback f ON f.dialogue_id = d.id
     WHERE d.id = $1 AND dc.user_id = $2`,
    [id, user.id],
  );

  if (result.rows.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const row = result.rows[0];

  // Transform to FeedbackData shape for ResultsPanel
  const detail = {
    dialogue_id: row.dialogue_id,
    prompt_text: row.prompt_text,
    prompt_category: row.prompt_category,
    prep_time: row.prep_time,
    speaking_time: row.speaking_time,
    actual_duration: row.actual_duration,
    started_at: row.started_at,
    finished_at: row.finished_at,
    transcript: row.transcript_text ?? "",
    feedback: {
      overall_score: row.overall_score,
      coach_summary: row.coach_summary,
      scores: {
        structure: row.score_structure,
        clarity: row.score_clarity,
        specificity: row.score_specificity,
        persuasiveness: row.score_persuasiveness,
        language: row.score_language,
      },
      framework_detected: row.framework_detected,
      framework_suggested: row.framework_suggested,
      time_usage: row.time_usage,
      strengths: row.strengths ?? [],
      improvement: row.improvement ?? "",
    },
    transcription: row.transcript_text
      ? {
          transcript: row.transcript_text,
          duration: row.transcript_duration ?? 0,
          audio_id: "",
          words: row.words ?? [],
          segments: row.segments ?? [],
          speech_rate_wpm: row.speech_rate_wpm ?? 0,
          filler_words: row.filler_words ?? { count: 0, details: {}, positions: [] },
          highlighted_transcript: row.highlighted_text ?? "",
          clarity_metrics: row.clarity_metrics ?? undefined,
        }
      : undefined,
  };

  return Response.json(detail);
}

async function handleCreateDialogue(req: Request): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    prompt_text,
    prompt_category,
    prep_time,
    speaking_time,
    actual_duration,
    transcript,
    feedback,
    settings,
  } = body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Find or create category
    const catResult = await client.query(
      "SELECT id FROM category WHERE slug = $1",
      [prompt_category],
    );
    if (catResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return Response.json({ error: `Unknown category: ${prompt_category}` }, { status: 400 });
    }
    const categoryId = catResult.rows[0].id;

    // Find or create prompt (match on text + category)
    let promptResult = await client.query(
      "SELECT id FROM prompt WHERE text = $1 AND category_id = $2 LIMIT 1",
      [prompt_text, categoryId],
    );
    let promptId: string;
    if (promptResult.rows.length > 0) {
      promptId = promptResult.rows[0].id;
    } else {
      const insertPrompt = await client.query(
        "INSERT INTO prompt (text, category_id) VALUES ($1, $2) RETURNING id",
        [prompt_text, categoryId],
      );
      promptId = insertPrompt.rows[0].id;
    }

    // Create dialogue_chain
    const chainResult = await client.query(
      `INSERT INTO dialogue_chain (user_id, settings_snapshot, finished_at)
       VALUES ($1, $2, now())
       RETURNING id`,
      [user.id, JSON.stringify(settings ?? { prepTime: prep_time, speakingTime: speaking_time })],
    );
    const chainId = chainResult.rows[0].id;

    // Create dialogue
    const dialogueResult = await client.query(
      `INSERT INTO dialogue (chain_id, prompt_id, sequence, prep_time, speaking_time, actual_duration, finished_at)
       VALUES ($1, $2, 1, $3, $4, $5, now())
       RETURNING id`,
      [chainId, promptId, prep_time, speaking_time, actual_duration],
    );
    const dialogueId = dialogueResult.rows[0].id;

    // Create transcript (if provided)
    if (transcript) {
      await client.query(
        `INSERT INTO transcript (dialogue_id, text, highlighted_text, duration, speech_rate_wpm, words, segments, filler_words, clarity_metrics)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          dialogueId,
          transcript.transcript ?? "",
          transcript.highlighted_transcript ?? null,
          transcript.duration ?? null,
          transcript.speech_rate_wpm ?? null,
          JSON.stringify(transcript.words ?? []),
          JSON.stringify(transcript.segments ?? []),
          JSON.stringify(transcript.filler_words ?? null),
          JSON.stringify(transcript.clarity_metrics ?? null),
        ],
      );
    }

    // Create feedback (if provided)
    if (feedback) {
      await client.query(
        `INSERT INTO feedback (
           dialogue_id, overall_score, coach_summary,
           score_structure, score_clarity, score_specificity, score_persuasiveness, score_language,
           framework_detected, framework_suggested, time_usage, strengths, improvement
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          dialogueId,
          feedback.overall_score,
          feedback.coach_summary ?? "",
          feedback.scores?.structure ?? null,
          feedback.scores?.clarity ?? null,
          feedback.scores?.specificity ?? null,
          feedback.scores?.persuasiveness ?? null,
          feedback.scores?.language ?? null,
          feedback.framework_detected ?? null,
          feedback.framework_suggested ?? null,
          feedback.time_usage ?? null,
          JSON.stringify(feedback.strengths ?? []),
          feedback.improvement ?? null,
        ],
      );
    }

    await client.query("COMMIT");

    return Response.json({ dialogue_id: dialogueId }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create dialogue error:", err);
    return Response.json({ error: "Failed to save dialogue" }, { status: 500 });
  } finally {
    client.release();
  }
}

async function handleListDialogues(req: Request): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const [result, countResult] = await Promise.all([
    pool.query(
      `SELECT
         d.id AS dialogue_id,
         d.started_at,
         d.finished_at,
         d.actual_duration,
         p.text AS prompt_text,
         c.slug AS prompt_category,
         f.overall_score,
         f.framework_detected,
         f.coach_summary
       FROM dialogue d
       JOIN dialogue_chain dc ON d.chain_id = dc.id
       JOIN prompt p ON d.prompt_id = p.id
       JOIN category c ON p.category_id = c.id
       LEFT JOIN feedback f ON f.dialogue_id = d.id
       WHERE dc.user_id = $1
       ORDER BY d.started_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*) FROM dialogue d
       JOIN dialogue_chain dc ON d.chain_id = dc.id
       WHERE dc.user_id = $1`,
      [user.id],
    ),
  ]);

  return Response.json({
    dialogues: result.rows.map((row) => ({
      dialogue_id: row.dialogue_id,
      started_at: row.started_at,
      finished_at: row.finished_at,
      actual_duration: row.actual_duration,
      prompt_text: row.prompt_text,
      prompt_category: row.prompt_category,
      overall_score: row.overall_score,
      framework_detected: row.framework_detected,
      coach_summary: row.coach_summary,
    })),
    total: parseInt(countResult.rows[0].count, 10),
  });
}
