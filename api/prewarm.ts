const MODAL_ENDPOINT_URL = process.env.MODAL_ENDPOINT_URL;

export async function POST(): Promise<Response> {
  if (!MODAL_ENDPOINT_URL) {
    return Response.json({ ok: false, reason: "no endpoint configured" }, { status: 200 });
  }

  try {
    // Send a tiny request to wake the Modal container.
    // Modal will spin up the container but Whisper won't run on an empty file —
    // the important thing is the container is warm for the real request.
    const res = await fetch(MODAL_ENDPOINT_URL, {
      method: "POST",
      headers: { "X-Prewarm": "1" },
      body: new FormData(), // empty form — Modal endpoint should return fast on missing file
      signal: AbortSignal.timeout(8000), // Vercel hobby timeout is 10s
    });

    return Response.json({ ok: true, status: res.status });
  } catch {
    // Prewarm is best-effort — don't fail the user flow
    return Response.json({ ok: false, reason: "prewarm fetch failed" }, { status: 200 });
  }
}
