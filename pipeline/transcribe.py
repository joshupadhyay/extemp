"""
Extemp Whisper Transcription Service

Modal endpoint that accepts audio files (WebM/Opus or MP4) and returns
transcripts using faster-whisper with the large-v3-turbo model on a T4 GPU.

Deploy:  modal deploy pipeline/transcribe.py
Serve:   modal serve pipeline/transcribe.py
"""

from __future__ import annotations

import tempfile
import time
from pathlib import Path

import modal

# fastapi is only installed inside the Modal container image.
# The `from __future__ import annotations` above makes the type hint a
# lazy string, so the import below can safely fail on the local machine
# where `modal deploy` is invoked.  Inside the container the import
# succeeds and FastAPI resolves the annotation normally.
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
        from faster_whisper import WhisperModel

        self.model = WhisperModel(
            MODEL_SIZE,
            device="cuda",
            compute_type="float16",
            download_root=MODEL_DIR,
        )
        # Commit any newly-downloaded weights so future containers see them.
        model_volume.commit()

    @modal.fastapi_endpoint(method="POST")
    async def transcribe(self, file: UploadFile):
        start = time.perf_counter()

        # Write the uploaded audio to a temp file so faster-whisper can read it.
        suffix = Path(file.filename).suffix if file.filename else ".webm"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        segments, _info = self.model.transcribe(
            tmp_path,
            beam_size=1,
            language="en",
            vad_filter=True,
        )
        transcript = " ".join(seg.text.strip() for seg in segments)
        duration = round(time.perf_counter() - start, 2)

        Path(tmp_path).unlink(missing_ok=True)

        return JSONResponse(
            content={"transcript": transcript, "duration": duration},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            },
        )
