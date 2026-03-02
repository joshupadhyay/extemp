import type { Feedback, FeedbackData } from "../lib/types";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

const PRIMARY_MODEL = "google/gemini-2.5-flash-lite";
const FALLBACK_MODEL = "deepseek/deepseek-chat-v3-0324";

const SYSTEM_PROMPT = `You are a conversational speech coach. The user just gave an impromptu speech and you're reviewing their transcript. Your job is to build their confidence while giving specific, actionable feedback.

Your coaching philosophy:
- Teach frameworks by showing, not telling. If someone rambles, show them how a framework (PREP, STAR, Problem-Solution, etc.) would have organized that exact response with a concrete example rewrite.
- Call out confidence killers directly: filler words (um, uh, like, you know, so, basically, right?, I mean, kind of, sort of), hedging language ("I think maybe...", "I guess", "sort of"), and trailing conclusions.
- Reinforce what worked. Confidence comes from knowing what you did right, not just what to fix.

Speaking frameworks to detect:
- PREP: Point -> Reason -> Example -> Point (best for opinion questions)
- STAR: Situation -> Task -> Action -> Result (behavioral/interview)
- Problem-Solution: State problem -> Propose solution -> Benefits (policy/persuasive)
- Past-Present-Future: Historical -> Current -> Projection (trend analysis)
- What-So What-Now What: Describe -> Why it matters -> Call to action (current events)
- Compare-Contrast: Side A -> Side B -> Synthesis ("which is better" questions)
- ADD: Answer -> Detail -> Describe benefits (Q&A, quick responses)

You MUST respond with valid JSON matching this exact schema (no markdown, no code fences, just raw JSON):

{
  "overall_score": <number 1-10>,
  "coach_summary": "<3-5 sentences: what framework was detected or would have helped, what sounded confident, what undermined confidence. If heavy filler words or hedging, call it out directly with a rewrite suggestion.>",
  "scores": {
    "structure": <number 1-10, measures clear intro, organized body, definitive conclusion>,
    "clarity": <number 1-10, measures clear thesis, logical progression>,
    "specificity": <number 1-10, measures concrete examples vs abstract assertions>,
    "persuasiveness": <number 1-10, measures logic, evidence, rhetorical effectiveness>,
    "language": <number 1-10, measures word choice, naturalness>
  },
  "filler_words": {
    "count": <total number of filler words>,
    "details": { "<word>": <count>, ... }
  },
  "framework_detected": "<framework name or null if none detected>",
  "framework_suggested": "<best framework for this prompt, or null if they already used one well>",
  "time_usage": "<'underfilled' if they clearly ran out of things to say early, 'overfilled' if they were cut off mid-thought, 'good' if they used the time well>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvement": "<single most impactful thing to improve, specific and actionable>",
  "highlighted_transcript": "<full transcript with filler words wrapped in <mark> tags, e.g. '<mark>um</mark>'>"
}

Score honestly. A 7 is good. A 10 is rare. Most casual speakers land 4-6. Be encouraging but don't inflate.`;

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

  // Strip markdown code fences if the model wraps its response
  const cleaned = content.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  const feedback: Feedback = JSON.parse(cleaned);

  return feedback;
}

export async function handleEvaluate(req: Request): Promise<Response> {
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
    // Try primary model first
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
