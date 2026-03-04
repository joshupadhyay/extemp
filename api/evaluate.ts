import type { Feedback, FeedbackData } from "./_lib/types";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

const PRIMARY_MODEL = "google/gemini-2.5-flash-lite";
const FALLBACK_MODEL = "deepseek/deepseek-chat-v3-0324";

const SYSTEM_PROMPT = `You are a conversational speech coach reviewing an impromptu speech transcript. Build confidence while giving specific, actionable feedback.

Coaching philosophy:
- Teach frameworks by showing, not telling. If someone rambles, show them how a framework would have organized that exact response — rewrite their opening using it.
- Call out hedging language ("I think maybe...", "I guess", "sort of") and trailing conclusions with concrete rewrite suggestions.
- Reinforce what worked. Confidence comes from knowing what you did right, not just what to fix.
- Do NOT count or mention filler words (um, uh, like, you know, etc.) — filler analysis is handled separately by the transcription system. Focus on hedging patterns and structure.

Frameworks to detect:
- PREP: Point → Reason → Example → Point (opinion questions)
- STAR: Situation → Task → Action → Result (behavioral/interview)
- Problem-Solution: State problem → Propose solution → Benefits (policy/persuasive)
- Past-Present-Future: Historical → Current → Projection (trend analysis)
- What-So What-Now What: Describe → Why it matters → Call to action (current events)
- Compare-Contrast: Side A → Side B → Synthesis ("which is better" questions)
- ADD: Answer → Detail → Describe benefits (Q&A, quick responses)

Respond with valid JSON matching this exact schema. No markdown, no code fences, just raw JSON.

{
  "overall_score": <integer 1-10>,
  "coach_summary": "<3-5 sentences: what framework was detected or would have helped, what sounded confident, what undermined confidence. If hedging language is present, call it out with a rewrite.>",
  "scores": {
    "structure": <integer 1-10: clear intro, organized body, definitive conclusion>,
    "clarity": <integer 1-10: clear thesis, logical progression>,
    "specificity": <integer 1-10: concrete examples vs abstract assertions>,
    "persuasiveness": <integer 1-10: logic, evidence, rhetorical effectiveness>,
    "language": <integer 1-10: word choice, naturalness, confidence of delivery>
  },
  "framework_detected": "<framework name from the list above, or null if none detected — use JSON null, not the string \\"null\\">",
  "framework_suggested": "<best framework for this prompt, or null if they already used one well — use JSON null, not the string \\"null\\">",
  "time_usage": "<one of: \\"underfilled\\", \\"good\\", \\"overfilled\\">",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvement": "<single most impactful thing to improve — specific and actionable>"
}

Scoring guide: 1-3 = needs significant work, 4-6 = typical casual speaker, 7-8 = good, 9-10 = exceptional (rare). Be encouraging but honest.`;

interface EvaluateRequest {
  transcript: string;
  prompt: string;
  prep_time: number;
  speaking_time: number;
}

async function callOpenRouter(
  model: string,
  transcript: string,
  prompt: string,
  prepTime: number,
  speakingTime: number,
): Promise<Feedback> {
  const userMessage = `Speaking prompt: "${prompt}"
Prep time: ${prepTime} seconds
Speaking time allowed: ${speakingTime} seconds

Transcript:
${transcript}`;

  const res = await fetch(OPENROUTER_BASE_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://extemp.app",
      "X-Title": "Extemp Speech Coach",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`OpenRouter ${model} returned ${res.status}: ${errorBody}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`OpenRouter ${model} returned empty content`);
  }

  const cleaned = content.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  const feedback: Feedback = JSON.parse(cleaned);

  return feedback;
}

export async function POST(req: Request): Promise<Response> {
  if (!OPENROUTER_API_KEY) {
    return Response.json(
      { error: "OPENROUTER_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: EvaluateRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { transcript, prompt, prep_time, speaking_time } = body;

  if (!transcript || typeof transcript !== "string") {
    return Response.json(
      { error: "Missing or invalid 'transcript' field." },
      { status: 400 },
    );
  }
  if (!prompt || typeof prompt !== "string") {
    return Response.json(
      { error: "Missing or invalid 'prompt' field." },
      { status: 400 },
    );
  }
  if (typeof prep_time !== "number" || typeof speaking_time !== "number") {
    return Response.json(
      { error: "Missing or invalid 'prep_time' or 'speaking_time' fields." },
      { status: 400 },
    );
  }

  try {
    let feedback: Feedback;
    try {
      feedback = await callOpenRouter(PRIMARY_MODEL, transcript, prompt, prep_time, speaking_time);
    } catch (primaryError) {
      console.error(`Primary model (${PRIMARY_MODEL}) failed:`, primaryError);
      console.log(`Falling back to ${FALLBACK_MODEL}...`);
      feedback = await callOpenRouter(FALLBACK_MODEL, transcript, prompt, prep_time, speaking_time);
    }

    const result: FeedbackData = {
      transcript,
      feedback,
    };

    return Response.json(result);
  } catch (err) {
    console.error("Evaluate error:", err);
    return Response.json(
      { error: "Failed to generate feedback. Both models failed." },
      { status: 502 },
    );
  }
}
