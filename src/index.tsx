import { serve } from "bun";
import index from "./index.html";
import { handleEvaluate } from "./api/evaluate";

const MODAL_ENDPOINT_URL = process.env.MODAL_ENDPOINT_URL;

const server = serve({
  routes: {
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
        return handleEvaluate(req);
      },
    },

    "/api/save-audio": {
      async POST(req) {
        try {
          const formData = await req.formData();
          const audioFile = formData.get("file");
          if (!audioFile || !(audioFile instanceof File)) {
            return Response.json(
              { error: "No audio file provided." },
              { status: 400 },
            );
          }

          const ext = audioFile.name?.split(".").pop() || "webm";
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const filename = `recording-${timestamp}.${ext}`;
          const path = `./recordings/${filename}`;

          await Bun.write(path, audioFile);

          console.log(`Saved audio: ${path} (${audioFile.size} bytes)`);
          return Response.json({ saved: true, filename, path, size: audioFile.size });
        } catch (err) {
          console.error("Save audio error:", err);
          return Response.json(
            { error: "Failed to save audio file." },
            { status: 500 },
          );
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
          // Forward the FormData directly to Modal
          const formData = await req.formData();
          const audioFile = formData.get("file");
          if (!audioFile || !(audioFile instanceof File)) {
            return Response.json(
              { error: "No audio file provided. Send a 'file' field in FormData." },
              { status: 400 },
            );
          }

          // Save a local copy for testing/debugging
          try {
            const ext = audioFile.name?.split(".").pop() || "webm";
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const localPath = `./recordings/recording-${timestamp}.${ext}`;
            await Bun.write(localPath, audioFile.slice());
            console.log(`Saved audio copy: ${localPath} (${audioFile.size} bytes)`);
          } catch (e) {
            console.warn("Failed to save local audio copy:", e);
          }

          // Build new FormData for the Modal endpoint
          const modalForm = new FormData();
          modalForm.append("file", audioFile, audioFile.name || "recording.webm");

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
