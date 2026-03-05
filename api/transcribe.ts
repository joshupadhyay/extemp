import { waitUntil } from "@vercel/functions";
import { pool } from "./_lib/db.js";

const MODAL_ENDPOINT_URL = process.env.MODAL_ENDPOINT_URL;

async function processTranscription(jobId: string, audioBlob: Blob, fileName: string) {
  try {
    await pool.query(
      "UPDATE job SET status = 'processing', updated_at = now() WHERE id = $1",
      [jobId],
    );

    const modalForm = new FormData();
    modalForm.append("file", audioBlob, fileName);

    const modalRes = await fetch(MODAL_ENDPOINT_URL!, {
      method: "POST",
      body: modalForm,
    });

    const body = await modalRes.json();

    if (!modalRes.ok) {
      await pool.query(
        "UPDATE job SET status = 'failed', error = $2, updated_at = now() WHERE id = $1",
        [jobId, body.error || `Modal returned ${modalRes.status}`],
      );
      return;
    }

    await pool.query(
      "UPDATE job SET status = 'completed', result = $2, updated_at = now() WHERE id = $1",
      [jobId, JSON.stringify(body)],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await pool.query(
      "UPDATE job SET status = 'failed', error = $2, updated_at = now() WHERE id = $1",
      [jobId, message],
    ).catch(() => {}); // Don't throw in cleanup
  }
}

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
