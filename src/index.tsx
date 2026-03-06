import { serve } from "bun";
import index from "./index.html";
import { handleEvaluate } from "./api/evaluate";
import { auth } from "./lib/auth";
import { pool } from "./lib/db";
import { handleDialogues, handleDialogueById } from "./api/dialogues";

const MODAL_ENDPOINT_URL = process.env.MODAL_ENDPOINT_URL;

// --- Progressive audio chunk storage ---
interface ChunkSession {
  chunks: Map<number, Uint8Array>;
  mimeType: string;
  createdAt: number;
}

const chunkSessions = new Map<string, ChunkSession>();

// --- In-memory job store (local dev only — Vercel uses Supabase) ---
interface Job {
  id: string;
  type: string;
  status: "pending" | "processing" | "completed" | "failed";
  result?: any;
  error?: string;
  created_at: string;
  updated_at: string;
}
const jobs = new Map<string, Job>();

function createJob(type: string): Job {
  const job: Job = {
    id: crypto.randomUUID(),
    type,
    status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  return job;
}

// Purge sessions older than 10 minutes every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, session] of chunkSessions) {
    if (session.createdAt < cutoff) {
      chunkSessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

const server = serve({
  routes: {
    // Better Auth catch-all — must be before "/*"
    "/api/auth/*": (req) => auth.handler(req),

    // Dialogue endpoints
    "/api/dialogues": (req) => handleDialogues(req),
    "/api/dialogues/:id": (req) => handleDialogueById(req, req.params.id),

    // Job polling endpoint (local dev)
    "/api/jobs/:id": {
      GET(req) {
        const job = jobs.get(req.params.id);
        if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
        return Response.json(job);
      },
    },

    // Static assets
    "/assets/*": async (req) => {
      const url = new URL(req.url);
      const file = Bun.file(`./assets${url.pathname.slice("/assets".length)}`);
      if (await file.exists()) return new Response(file);
      return new Response("Not found", { status: 404 });
    },

    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/hello": {
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async req => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },

    "/api/evaluate": {
      async POST(req) {
        // Create a job, process in background, return jobId
        const job = createJob("evaluate");
        const jobId = job.id;

        // Clone the request body before returning
        const body = await req.json();

        (async () => {
          try {
            job.status = "processing";
            job.updated_at = new Date().toISOString();

            // Re-create a request with the cloned body for handleEvaluate
            const innerReq = new Request(req.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });

            const res = await handleEvaluate(innerReq);
            const result = await res.json();

            if (res.status >= 400) {
              job.status = "failed";
              job.error = result.error || `Evaluate returned ${res.status}`;
            } else {
              job.status = "completed";
              job.result = result;
            }
            job.updated_at = new Date().toISOString();
          } catch (err) {
            job.status = "failed";
            job.error = err instanceof Error ? err.message : "Unknown error";
            job.updated_at = new Date().toISOString();
          }
        })();

        return Response.json({ jobId }, { status: 202 });
      },
    },

    "/api/user-count": {
      async GET() {
        try {
          const result = await pool.query('SELECT COUNT(*) FROM "user"');
          return Response.json({ count: parseInt(result.rows[0].count, 10) });
        } catch (err) {
          console.error("User count query error:", err);
          return Response.json({ count: 0 });
        }
      },
    },

    "/api/prewarm": {
      async POST() {
        if (!MODAL_ENDPOINT_URL) {
          return Response.json({ ok: false, reason: "no endpoint configured" });
        }
        try {
          const res = await fetch(MODAL_ENDPOINT_URL, {
            method: "POST",
            headers: { "X-Prewarm": "1" },
            body: new FormData(),
            signal: AbortSignal.timeout(8000),
          });
          return Response.json({ ok: true, status: res.status });
        } catch {
          return Response.json({ ok: false, reason: "prewarm fetch failed" });
        }
      },
    },

    "/api/transcribe": {
      async POST(req) {
        if (!MODAL_ENDPOINT_URL) {
          return Response.json(
            { error: "MODAL_ENDPOINT_URL is not configured on the server." },
            { status: 500 },
          );
        }

        try {
          const formData = await req.formData();
          const audioFile = formData.get("file");
          if (!audioFile || !(audioFile instanceof File)) {
            return Response.json(
              { error: "No audio file provided. Send a 'file' field in FormData." },
              { status: 400 },
            );
          }

          // Create job and return immediately
          const job = createJob("transcribe");
          const jobId = job.id;

          // Process in background (Bun has no timeout issues)
          (async () => {
            try {
              job.status = "processing";
              job.updated_at = new Date().toISOString();

              // Save a local copy for testing/debugging (dev only)
              if (process.env.NODE_ENV !== "production") {
                try {
                  const ext = audioFile.name?.split(".").pop() || "webm";
                  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                  const localPath = `./recordings/recording-${timestamp}.${ext}`;
                  await Bun.write(localPath, audioFile);
                  console.log(`Saved audio copy: ${localPath} (${audioFile.size} bytes)`);
                } catch (e) {
                  console.warn("Failed to save local audio copy:", e);
                }
              }

              const modalForm = new FormData();
              modalForm.append("file", audioFile, audioFile.name || "recording.webm");

              const modalRes = await fetch(MODAL_ENDPOINT_URL!, {
                method: "POST",
                body: modalForm,
              });

              const body = await modalRes.json();

              if (!modalRes.ok) {
                job.status = "failed";
                job.error = body.error || `Modal returned ${modalRes.status}`;
              } else {
                job.status = "completed";
                job.result = body;
              }
              job.updated_at = new Date().toISOString();
            } catch (err) {
              job.status = "failed";
              job.error = err instanceof Error ? err.message : "Unknown error";
              job.updated_at = new Date().toISOString();
            }
          })();

          return Response.json({ jobId }, { status: 202 });
        } catch (err) {
          console.error("Transcribe proxy error:", err);
          return Response.json(
            { error: "Failed to start transcription job." },
            { status: 500 },
          );
        }
      },
    },

    // Progressive audio chunk upload
    "/api/audio-chunks/:sessionId": {
      async POST(req) {
        const { sessionId } = req.params;
        const chunkIndex = parseInt(req.headers.get("X-Chunk-Index") || "0", 10);
        const mimeType = req.headers.get("Content-Type") || "audio/webm";

        const body = await req.arrayBuffer();
        if (!body.byteLength) {
          return Response.json({ error: "Empty chunk body" }, { status: 400 });
        }

        let session = chunkSessions.get(sessionId);
        if (!session) {
          session = { chunks: new Map(), mimeType, createdAt: Date.now() };
          chunkSessions.set(sessionId, session);
        }
        session.chunks.set(chunkIndex, new Uint8Array(body));

        console.log(`Chunk ${chunkIndex} for session ${sessionId}: ${body.byteLength} bytes (total chunks: ${session.chunks.size})`);

        return Response.json({ ok: true, chunkIndex, sessionChunks: session.chunks.size });
      },
    },

    // Finalize: assemble chunks and forward to Modal
    "/api/audio-chunks/:sessionId/finalize": {
      async POST(req) {
        if (!MODAL_ENDPOINT_URL) {
          return Response.json(
            { error: "MODAL_ENDPOINT_URL is not configured on the server." },
            { status: 500 },
          );
        }

        const { sessionId } = req.params;
        const session = chunkSessions.get(sessionId);

        if (!session || session.chunks.size === 0) {
          return Response.json(
            { error: `No chunks found for session ${sessionId}` },
            { status: 404 },
          );
        }

        // Read optional mimeType override from request body
        let mimeType = session.mimeType;
        try {
          const body = await req.json();
          if (body.mimeType) mimeType = body.mimeType;
        } catch {
          // No JSON body — that's fine
        }

        // Assemble chunks in index order
        const sortedIndices = [...session.chunks.keys()].sort((a, b) => a - b);
        const totalSize = sortedIndices.reduce((sum, i) => sum + session.chunks.get(i)!.byteLength, 0);
        const assembled = new Uint8Array(totalSize);
        let offset = 0;
        for (const i of sortedIndices) {
          const chunk = session.chunks.get(i)!;
          assembled.set(chunk, offset);
          offset += chunk.byteLength;
        }

        console.log(`Finalize session ${sessionId}: ${sortedIndices.length} chunks, ${totalSize} bytes`);

        // Clean up session
        chunkSessions.delete(sessionId);

        // Save local copy in dev
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        if (process.env.NODE_ENV !== "production") {
          try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const localPath = `./recordings/recording-${timestamp}.${ext}`;
            await Bun.write(localPath, assembled);
            console.log(`Saved assembled audio: ${localPath}`);
          } catch (e) {
            console.warn("Failed to save local audio copy:", e);
          }
        }

        // Forward to Modal
        try {
          const file = new File([assembled], `recording.${ext}`, { type: mimeType });
          const modalForm = new FormData();
          modalForm.append("file", file, file.name);

          const modalRes = await fetch(MODAL_ENDPOINT_URL, {
            method: "POST",
            body: modalForm,
          });

          const responseBody = await modalRes.json();
          return Response.json(responseBody, { status: modalRes.status });
        } catch (err) {
          console.error("Finalize proxy error:", err);
          return Response.json(
            { error: "Failed to reach transcription service." },
            { status: 502 },
          );
        }
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`Server running at ${server.url}`);
