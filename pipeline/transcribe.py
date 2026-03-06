"""
Extemp Whisper Transcription Service

Modal endpoint that accepts audio files (WebM/Opus or MP4) and returns
transcripts with word-level timestamps using openai-whisper on a T4 GPU.
Audio is stored in a Modal Volume for future playback.

Deploy:  modal deploy pipeline/transcribe.py
Serve:   modal serve pipeline/transcribe.py
"""

from __future__ import annotations

import re
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
# Filler word detection
# ---------------------------------------------------------------------------

# Single-word fillers (matched case-insensitively against individual words)
SINGLE_WORD_FILLERS = {"um", "uh", "like", "so", "basically", "right"}

# Multi-word fillers (matched as consecutive word pairs, case-insensitive)
MULTI_WORD_FILLERS = {"you know", "kind of", "sort of", "i mean"}


def _strip_word(w: str) -> str:
    """Lowercase and strip punctuation from a word for filler matching."""
    return re.sub(r"[^\w']", "", w.lower())


def detect_filler_words(words_list: list[dict]) -> dict:
    """Scan word timestamps for filler words and return counts + positions.

    Returns:
        {
            "count": int,
            "details": {filler: count, ...},
            "positions": [{"word": str, "start": float, "end": float}, ...]
        }
    """
    details: dict[str, int] = {}
    positions: list[dict] = []
    consumed: set[int] = set()  # indices consumed by multi-word fillers

    # Pass 1: detect multi-word fillers (consecutive pairs)
    for i in range(len(words_list) - 1):
        pair = _strip_word(words_list[i]["word"]) + " " + _strip_word(words_list[i + 1]["word"])
        if pair in MULTI_WORD_FILLERS:
            details[pair] = details.get(pair, 0) + 1
            positions.append({
                "word": pair,
                "start": words_list[i]["start"],
                "end": words_list[i + 1]["end"],
                "_indices": [i, i + 1],
            })
            consumed.add(i)
            consumed.add(i + 1)

    # Pass 2: detect single-word fillers (skip words already consumed by multi-word)
    for i, w in enumerate(words_list):
        if i in consumed:
            continue
        cleaned = _strip_word(w["word"])
        if cleaned in SINGLE_WORD_FILLERS:
            details[cleaned] = details.get(cleaned, 0) + 1
            positions.append({
                "word": cleaned,
                "start": w["start"],
                "end": w["end"],
                "_indices": [i],
            })

    # Sort positions by start time
    positions.sort(key=lambda p: p["start"])

    return {
        "count": sum(details.values()),
        "details": details,
        "positions": positions,
    }


def compute_clarity_metrics(words_list: list[dict], segments_list: list[dict]) -> dict:
    """Derive voice clarity metrics from Whisper's word timestamps and probabilities.

    All metrics are computed from data Whisper already returns — no additional
    API calls or models required.

    Returns:
        {
            "avg_confidence": float,       # mean word probability (0-1)
            "low_confidence_count": int,    # words with probability < 0.5
            "pacing_variability": float,    # std dev of per-segment WPM
            "pause_analysis": {
                "total_pauses": int,        # gaps > 0.3s between consecutive words
                "long_pauses": int,         # gaps > 1.0s
                "avg_pause_duration": float, # mean duration of all pauses (> 0.3s)
                "longest_pause": float,
            },
            "segment_pacing": [             # per-segment breakdown
                {
                    "segment_id": int,
                    "wpm": float,
                    "word_count": int,
                    "duration": float,
                    "pace_label": "fast" | "normal" | "slow",
                },
                ...
            ],
        }
    """
    import math

    # --- Average confidence (word probability) ---
    if words_list:
        probabilities = [w["probability"] for w in words_list]
        avg_confidence = round(sum(probabilities) / len(probabilities), 4)
        low_confidence_count = sum(1 for p in probabilities if p < 0.5)
    else:
        avg_confidence = 0.0
        low_confidence_count = 0

    # --- Pause analysis (gaps between consecutive words) ---
    PAUSE_THRESHOLD = 0.3   # seconds — anything shorter is normal inter-word spacing
    LONG_PAUSE_THRESHOLD = 1.0

    pauses: list[float] = []
    for i in range(1, len(words_list)):
        gap = words_list[i]["start"] - words_list[i - 1]["end"]
        if gap > PAUSE_THRESHOLD:
            pauses.append(round(gap, 3))

    pause_analysis = {
        "total_pauses": len(pauses),
        "long_pauses": sum(1 for p in pauses if p > LONG_PAUSE_THRESHOLD),
        "avg_pause_duration": round(sum(pauses) / len(pauses), 3) if pauses else 0.0,
        "longest_pause": round(max(pauses), 3) if pauses else 0.0,
    }

    # --- Per-segment pacing ---
    segment_pacing: list[dict] = []
    segment_wpms: list[float] = []

    for seg in segments_list:
        seg_duration = seg["end"] - seg["start"]
        if seg_duration <= 0:
            continue
        # Count words in this segment by timestamp overlap
        seg_words = [
            w for w in words_list
            if w["start"] >= seg["start"] and w["end"] <= seg["end"]
        ]
        word_count = len(seg_words)
        wpm = round((word_count / seg_duration) * 60, 1) if seg_duration > 0 else 0.0
        segment_wpms.append(wpm)

        # Label: <100 WPM = slow, >180 WPM = fast, else normal
        if wpm < 100:
            pace_label = "slow"
        elif wpm > 180:
            pace_label = "fast"
        else:
            pace_label = "normal"

        segment_pacing.append({
            "segment_id": seg["id"],
            "wpm": wpm,
            "word_count": word_count,
            "duration": round(seg_duration, 3),
            "pace_label": pace_label,
        })

    # --- Pacing variability (std dev of segment WPMs) ---
    if len(segment_wpms) >= 2:
        mean_wpm = sum(segment_wpms) / len(segment_wpms)
        variance = sum((w - mean_wpm) ** 2 for w in segment_wpms) / len(segment_wpms)
        pacing_variability = round(math.sqrt(variance), 2)
    else:
        pacing_variability = 0.0

    return {
        "avg_confidence": avg_confidence,
        "low_confidence_count": low_confidence_count,
        "pacing_variability": pacing_variability,
        "pause_analysis": pause_analysis,
        "segment_pacing": segment_pacing,
    }


def generate_highlighted_transcript(words_list: list[dict], filler_result: dict) -> str:
    """Build a transcript string with filler words wrapped in <mark> tags.

    Uses the _indices from filler detection (O(m)) instead of scanning all
    words by timestamp.
    """
    # Build index -> tag map from filler positions
    filler_indices: dict[int, str] = {}

    for pos in filler_result["positions"]:
        idxs = pos["_indices"]
        if len(idxs) == 2:
            filler_indices[idxs[0]] = "multi_start"
            filler_indices[idxs[1]] = "multi_end"
        else:
            filler_indices[idxs[0]] = "single"

    parts: list[str] = []
    i = 0
    while i < len(words_list):
        word_text = words_list[i]["word"]
        tag = filler_indices.get(i)

        if tag == "multi_start" and i + 1 < len(words_list):
            next_text = words_list[i + 1]["word"]
            parts.append(f"<mark>{word_text} {next_text}</mark>")
            i += 2
        elif tag == "single":
            parts.append(f"<mark>{word_text}</mark>")
            i += 1
        else:
            parts.append(word_text)
            i += 1

    return " ".join(parts)

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

        # Detect filler words from word-level timestamps (deterministic, no LLM)
        filler_words = detect_filler_words(words_list)
        highlighted_transcript = generate_highlighted_transcript(words_list, filler_words)

        # Compute voice clarity metrics from existing Whisper data
        clarity_metrics = compute_clarity_metrics(words_list, segments_list)

        # Strip internal _indices from positions before returning
        filler_words_clean = {
            **filler_words,
            "positions": [
                {k: v for k, v in p.items() if k != "_indices"}
                for p in filler_words["positions"]
            ],
        }

        audio_volume.commit()

        return JSONResponse(
            content={
                "transcript": transcript,
                "duration": duration,
                "audio_id": audio_id,
                "words": words_list,
                "segments": segments_list,
                "speech_rate_wpm": speech_rate_wpm,
                "filler_words": filler_words_clean,
                "highlighted_transcript": highlighted_transcript,
                "clarity_metrics": clarity_metrics,
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
