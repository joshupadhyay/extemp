import { waitUntil } from "@vercel/functions";
import { pool } from "./_lib/db.js";
import { getAuthUser } from "./_lib/auth.js";
import { processGroqResponse } from "./_lib/transcription.js";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

async function processTranscription(jobId: string, audioBlob: Blob, fileName: string) {
  try {
    await pool.query(
      "UPDATE job SET status = 'processing', updated_at = now() WHERE id = $1",
      [jobId],
    );

    const formData = new FormData();
    formData.append("file", audioBlob, fileName);
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "word");
    formData.append("timestamp_granularities[]", "segment");
    formData.append("language", "en");

    const groqRes = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: formData,
    });

    if (!groqRes.ok) {
      const errorBody = await groqRes.text();
      await pool.query(
        "UPDATE job SET status = 'failed', error = $2, updated_at = now() WHERE id = $1",
        [jobId, `Groq returned ${groqRes.status}: ${errorBody}`],
      );
      return;
    }

    const groqResponse = await groqRes.json();
    const result = processGroqResponse(groqResponse);

    await pool.query(
      "UPDATE job SET status = 'completed', result = $2, updated_at = now() WHERE id = $1",
      [jobId, JSON.stringify(result)],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await pool.query(
      "UPDATE job SET status = 'failed', error = $2, updated_at = now() WHERE id = $1",
      [jobId, message],
    ).catch(() => {});
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!GROQ_API_KEY) {
    return Response.json(
      { error: "GROQ_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const entry = formData.get("file");
    if (!entry || !(entry instanceof File)) {
      return Response.json(
        { error: "No audio file provided. Send a 'file' field in FormData." },
        { status: 400 },
      );
    }

    const audioFile = entry as File;

    // Read the file into memory before returning (can't read stream after response)
    const arrayBuffer = await audioFile.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: audioFile.type });
    const fileName = (audioFile as any).name || "recording.webm";

    // Create job record
    const result = await pool.query(
      "INSERT INTO job (type, status, input) VALUES ('transcribe', 'pending', $1) RETURNING id",
      [JSON.stringify({ fileName, size: blob.size })],
    );
    const jobId = result.rows[0].id;

    // Process in background — survives after response is sent
    waitUntil(processTranscription(jobId, blob, fileName));

    return Response.json({ jobId }, { status: 202 });
  } catch (err) {
    console.error("Transcribe error:", err);
    return Response.json(
      { error: "Failed to start transcription job." },
      { status: 500 },
    );
  }
}
