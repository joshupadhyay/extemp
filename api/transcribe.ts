const MODAL_ENDPOINT_URL = process.env.MODAL_ENDPOINT_URL;

export async function POST(req: Request): Promise<Response> {
  if (!MODAL_ENDPOINT_URL) {
    return Response.json(
      { error: "MODAL_ENDPOINT_URL is not configured on the server." },
      { status: 500 },
    );
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

    // Build new FormData for the Modal endpoint
    const modalForm = new FormData();
    modalForm.append("file", audioFile, (audioFile as any).name || "recording.webm");

    const modalRes = await fetch(MODAL_ENDPOINT_URL, {
      method: "POST",
      body: modalForm,
    });

    const body = await modalRes.json();

    return Response.json(body, { status: modalRes.status });
  } catch (err) {
    console.error("Transcribe proxy error:", err);
    return Response.json(
      { error: "Failed to reach transcription service." },
      { status: 502 },
    );
  }
}
