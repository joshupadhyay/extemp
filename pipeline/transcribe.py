"""
Extemp Whisper Transcription Service

Modal endpoint that accepts audio files (WebM/Opus or MP4) and returns
transcripts with word-level timestamps using openai-whisper on a T4 GPU.
Audio is stored in a Modal Volume for future playback.

Deploy:  modal deploy pipeline/transcribe.py
Serve:   modal serve pipeline/transcribe.py
"""

from __future__ import annotations

import time
import uuid

import modal

try:
    from fastapi import UploadFile
    from fastapi.responses import JSONResponse, Response
except ModuleNotFoundError:
    pass

# ---------------------------------------------------------------------------
# Modal resources
# ---------------------------------------------------------------------------

model_volume = modal.Volume.from_name("whisper-models", create_if_missing=True)
audio_volume = modal.Volume.from_name("extemp-audio", create_if_missing=True)

# Following Modal's own blog pattern: debian_slim + openai-whisper + librosa
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg")
    .pip_install(
        "openai-whisper",
        "librosa",
        "fastapi[standard]",
        "python-multipart",
    )
)

app = modal.App("extemp-whisper", image=image)

MODEL_SIZE = "turbo"  # openai-whisper's turbo model (large-v3-turbo equivalent)
MODEL_DIR = "/models"
AUDIO_DIR = "/audio"
MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB
ALLOWED_EXTENSIONS = {".webm", ".mp4", ".wav", ".m4a", ".ogg", ".mp3"}

# ---------------------------------------------------------------------------
# Transcription endpoint
# ---------------------------------------------------------------------------


@app.cls(
    gpu="T4",
    scaledown_window=300,
    volumes={MODEL_DIR: model_volume, AUDIO_DIR: audio_volume},
)
class Whisper:
    """Serves openai-whisper turbo on a T4 GPU."""

    @modal.enter()
    def load_model(self):
        import os
        import whisper

        self.model = whisper.load_model(MODEL_SIZE, download_root=MODEL_DIR)

        # Commit volume if this was a fresh download
        if not os.path.isfile(os.path.join(MODEL_DIR, f"{MODEL_SIZE}.pt")):
            model_volume.commit()

    @modal.fastapi_endpoint(method="POST")
    async def transcribe(self, file: UploadFile):
        import io
        import os
        import tempfile
        from pathlib import Path

        import librosa
        import numpy as np
        import whisper

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

        # Store audio in volume for future playback
        audio_id = str(uuid.uuid4())
        audio_ext = suffix or ".webm"
        audio_path = os.path.join(AUDIO_DIR, f"{audio_id}{audio_ext}")
        with open(audio_path, "wb") as f:
            f.write(contents)
        audio_volume.commit()

        try:
            # Write to temp file for librosa/whisper to read
            tmp = tempfile.NamedTemporaryFile(suffix=audio_ext, delete=False)
            tmp.write(contents)
            tmp.close()

            # Load and resample audio to 16kHz (Whisper's required sample rate)
            audio, sr = librosa.load(tmp.name, sr=16000)

            # Transcribe with word-level timestamps
            result = self.model.transcribe(
                audio,
                language="en",
                word_timestamps=True,
            )

            # Extract transcript
            transcript = result["text"].strip()

            # Collect segments and word-level timestamps
            words_list: list[dict] = []
            segments_list: list[dict] = []

            for i, seg in enumerate(result.get("segments", [])):
                segments_list.append({
                    "id": i,
                    "start": round(seg["start"], 3),
                    "end": round(seg["end"], 3),
                    "text": seg["text"].strip(),
                })
                for w in seg.get("words", []):
                    words_list.append({
                        "word": w["word"].strip(),
                        "start": round(w["start"], 3),
                        "end": round(w["end"], 3),
                        "probability": round(w.get("probability", 0), 4),
                    })

        except Exception as e:
            return JSONResponse(
                status_code=422,
                content={"error": f"Could not process audio file: {e}"},
            )
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass

        duration = round(time.perf_counter() - start, 2)

        # Calculate speech rate (words per minute)
        speech_duration = words_list[-1]["end"] if words_list else 0
        word_count = len(words_list)
        speech_rate_wpm = round((word_count / speech_duration) * 60, 1) if speech_duration > 0 else 0

        return JSONResponse(
            content={
                "transcript": transcript,
                "duration": duration,
                "audio_id": audio_id,
                "words": words_list,
                "segments": segments_list,
                "speech_rate_wpm": speech_rate_wpm,
            },
        )

    @modal.fastapi_endpoint(method="GET")
    async def get_audio(self, audio_id: str):
        import os
        import glob as globmod

        # Find the audio file by ID (extension may vary)
        pattern = os.path.join(AUDIO_DIR, f"{audio_id}.*")
        matches = globmod.glob(pattern)
        if not matches:
            return JSONResponse(status_code=404, content={"error": "Audio not found."})

        audio_path = matches[0]
        ext = os.path.splitext(audio_path)[1]
        mime_map = {
            ".webm": "audio/webm",
            ".mp4": "audio/mp4",
            ".wav": "audio/wav",
            ".m4a": "audio/mp4",
            ".ogg": "audio/ogg",
            ".mp3": "audio/mpeg",
        }
        content_type = mime_map.get(ext, "application/octet-stream")

        with open(audio_path, "rb") as f:
            data = f.read()

        return Response(content=data, media_type=content_type)
