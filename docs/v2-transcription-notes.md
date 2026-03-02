# V2 Transcription: Batch + NeMo Approach

## Reference
- [Fast Cheap Batch Transcription (Modal blog)](https://modal.com/blog/fast-cheap-batch-transcription)

## Key Ideas for V2

### Current (V1): OpenAI Whisper via Modal
- Single audio → single transcription
- `openai-whisper` turbo model on T4 GPU
- ~3-5s for 2-min audio (warm container)
- Word-level timestamps via `word_timestamps=True`

### V2: NVIDIA NeMo Parakeet (from blog)
- **Model**: `nvidia/parakeet-tdt-0.6b-v2` — smaller, faster, better accuracy than Whisper
- **Batched inference**: Process multiple audio segments in parallel on a single GPU
- **Speed**: 450x real-time on A10G GPU (vs ~50x for Whisper)
- **Cost**: ~$0.0001/min of audio (10x cheaper than Whisper)
- **Key technique**: Split long audio into chunks, batch-transcribe, reassemble
- Uses NeMo framework's `TranscribeConfig` for batched inference

### Why V2 Matters for Extemp
- If we add audio replay/storage, batch processing lets us re-transcribe at scale
- Parakeet handles accented English better (good for diverse users)
- Lower cost means we can offer unlimited free practice sessions
- Faster processing = better UX (sub-second transcription for 2-min audio)

### Implementation Notes
- Swap `openai-whisper` for `nemo_toolkit[asr]` in Modal image
- Keep same API contract (transcript + words + segments)
- Consider `canary-1b-flash` for multilingual support
- Blog's batching pattern: split audio → parallel GPU inference → merge results
