# Simplify Review — PR #3: Modal Whisper Transcription Backend

## What was reviewed

Three parallel review agents analyzed `pipeline/transcribe.py` and `pipeline/test_transcribe.py` for code reuse, code quality, and efficiency issues.

## Changes made

### Eliminated temp file with BytesIO (efficiency)
- **File:** `pipeline/transcribe.py`
- The upload was written to a `NamedTemporaryFile(delete=False)` then read back by faster-whisper. Since `WhisperModel.transcribe()` accepts `BinaryIO`, switched to `io.BytesIO(contents)` directly. This removes the disk round-trip and eliminates the entire temp file cleanup concern.

### Added error handling around transcription (quality)
- **File:** `pipeline/transcribe.py`
- If the uploaded file was invalid audio, `model.transcribe()` raised an unhandled exception, returning a raw 500 with a stack trace. Wrapped in `try/except` that returns a 422 with `"Could not decode audio file."`.

### Added file size limit (security)
- **File:** `pipeline/transcribe.py`
- No size restriction existed. An attacker could upload multi-GB files to OOM the container. Added `MAX_UPLOAD_BYTES = 100 MB` check after `await file.read()`, returning 400 if exceeded.

### Added file type validation (security)
- **File:** `pipeline/transcribe.py`
- No extension validation existed. Added `ALLOWED_EXTENSIONS` allowlist (`.webm`, `.mp4`, `.wav`, `.m4a`, `.ogg`, `.mp3`) checked before processing.

### Removed redundant CORS headers (quality)
- **File:** `pipeline/transcribe.py`
- Manual `Access-Control-Allow-Origin: *` headers were set on the JSONResponse. Modal's `@modal.fastapi_endpoint` already handles CORS at the infrastructure level, and these manual headers didn't cover error responses or OPTIONS preflight. Removed them.

### Guarded `volume.commit()` (efficiency)
- **File:** `pipeline/transcribe.py`
- `model_volume.commit()` ran unconditionally on every cold start, even when the model was already cached. Added an `os.path.isdir` check so it only commits after the first download.

## Skipped (acceptable as-is)

- `beam_size=1` — intentional speed trade-off, added inline comment
- `vad_filter=True` — net positive for speech with pauses
- `await file.read()` buffering entire file — acceptable for 2-min audio clips (~1-5 MB)
- Code reuse — first Python in the repo, nothing to reuse
- `test_transcribe.py` — clean, no issues found
