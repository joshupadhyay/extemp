"""
Extemp Whisper Transcription Service

Modal endpoint that accepts audio files (WebM/Opus or MP4) and returns
transcripts using faster-whisper with the large-v3-turbo model on a T4 GPU.

Deploy:  modal deploy pipeline/transcribe.py
Serve:   modal serve pipeline/transcribe.py
"""

from __future__ import annotations

import io
import time

import modal

try:
    from fastapi import UploadFile
    from fastapi.responses import JSONResponse
except ModuleNotFoundError:
    pass

# ---------------------------------------------------------------------------
# Modal resources
# ---------------------------------------------------------------------------

model_volume = modal.Volume.from_name("whisper-models", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install("faster-whisper", "fastapi[standard]", "python-multipart")
)

app = modal.App("extemp-whisper", image=image)

MODEL_SIZE = "large-v3-turbo"
MODEL_DIR = "/models"
MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB
ALLOWED_EXTENSIONS = {".webm", ".mp4", ".wav", ".m4a", ".ogg", ".mp3"}

# ---------------------------------------------------------------------------
# Transcription endpoint
# ---------------------------------------------------------------------------


@app.cls(
    gpu="T4",
    scaledown_window=300,
    volumes={MODEL_DIR: model_volume},
)
class Whisper:
    """Serves faster-whisper large-v3-turbo on a T4 GPU."""

    @modal.enter()
    def load_model(self):
        import os
        from faster_whisper import WhisperModel

        already_cached = os.path.isdir(os.path.join(MODEL_DIR, MODEL_SIZE))

        self.model = WhisperModel(
            MODEL_SIZE,
            device="cuda",
            compute_type="float16",
            download_root=MODEL_DIR,
        )

        if not already_cached:
            model_volume.commit()

    @modal.fastapi_endpoint(method="POST")
    async def transcribe(self, file: UploadFile):
        from pathlib import Path

        # Validate file extension
        suffix = Path(file.filename).suffix.lower() if file.filename else ""
        if suffix and suffix not in ALLOWED_EXTENSIONS:
            return JSONResponse(
                status_code=400,
                content={"error": f"Unsupported file type: {suffix}. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"},
            )

        start = time.perf_counter()

        # Read upload into memory and enforce size limit
        contents = await file.read()
        if len(contents) > MAX_UPLOAD_BYTES:
            return JSONResponse(
                status_code=400,
                content={"error": f"File too large ({len(contents)} bytes). Max: {MAX_UPLOAD_BYTES} bytes."},
            )

        try:
            segments, _info = self.model.transcribe(
                io.BytesIO(contents),
                beam_size=3,
                language="en",
                vad_filter=True,
            )
            transcript = " ".join(seg.text.strip() for seg in segments)
        except Exception:
            return JSONResponse(
                status_code=422,
                content={"error": "Could not decode audio file."},
            )

        duration = round(time.perf_counter() - start, 2)

        return JSONResponse(
            content={"transcript": transcript, "duration": duration},
        )
