# Voice Clarity Analysis Research

**Date:** 2026-03-02
**Context:** Extemp already transcribes audio via faster-whisper (large-v3-turbo) on Modal (T4 GPU). This document explores how to add voice clarity and delivery analysis beyond transcript text.

---

## 1. Executive Summary

- **faster-whisper already returns per-word confidence probabilities and per-segment `avg_logprob`** when `word_timestamps=True`. Low word probabilities correlate with unclear/mumbled speech. This is the single highest-value, zero-cost addition.
- **Speech rate (WPM) and pause detection can be computed directly from word timestamps** with no extra libraries. Combined with Silero VAD (already bundled in faster-whisper), this gives us rushing/hesitation/dead-air metrics for free.
- **RMS energy analysis via `librosa`** (lightweight, CPU-only, ~30MB) can detect trailing off, volume drops, and mumbling within segments. Adds <100ms to processing time.
- **Pitch variation via `librosa.pyin`** detects monotone delivery vs. expressive speaking. Same library, same overhead.
- **Heavier models (NISQA, SpeechBrain, fine-tuned Whisper confidence)** offer more sophisticated quality scores but add significant cold-start cost and complexity. Not recommended for V1.

---

## 2. Quick Wins -- Data faster-whisper Already Provides

### 2.1 Word-Level Confidence Scores

When `word_timestamps=True`, each `Word` object includes a `probability` field (0.0-1.0). This is derived from cross-attention alignment using Dynamic Time Warping, not raw token logprobs, but research shows it correlates with speech clarity.

**Key insight:** A [2025 paper on Whisper for L2 speech scoring](https://link.springer.com/article/10.1007/s10772-024-10141-5) showed that Whisper subtoken probability scores can classify speaker proficiency levels, achieving Spearman's rho = 0.72 with human pronunciation ratings. Low probability = model struggled to recognize the word = likely unclear speech.

**Data structure ([source](https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py)):**

```python
@dataclass
class Word:
    start: float      # timestamp in seconds
    end: float        # timestamp in seconds
    word: str         # the transcribed text
    probability: float # confidence score 0.0-1.0

@dataclass
class Segment:
    id: int
    seek: int
    start: float
    end: float
    text: str
    tokens: List[int]
    avg_logprob: float        # average log probability over decoded tokens
    compression_ratio: float  # gzip compression ratio (detects hallucinations)
    no_speech_prob: float     # probability segment contains no speech
    words: Optional[List[Word]]
    temperature: Optional[float]
```

**What to flag:**
- Words with `probability < 0.5` -- likely mumbled, slurred, or very unclear
- Words with `probability < 0.7` -- somewhat unclear, worth noting
- Segments with `avg_logprob < -1.0` -- Whisper authors' own threshold for low confidence
- Segments with `no_speech_prob > 0.6` -- likely silence or non-speech sounds

### 2.2 Speech Rate from Timestamps

Words per minute is directly computable from word timestamps:

```
WPM = word_count / (duration_in_seconds / 60)
```

**Benchmarks for public speaking:**
- < 110 WPM: too slow, hesitant
- 110-150 WPM: conversational, comfortable
- 150-170 WPM: good presentation pace
- > 180 WPM: rushing, hard to follow

Can also compute **per-segment WPM** to detect pacing changes (starting strong, then rushing to finish).

### 2.3 Pause Detection from Word Timestamps

Gaps between consecutive words reveal pause patterns:

```
pause_duration = word[i+1].start - word[i].end
```

**What to flag:**
- Gaps > 2.0s: long pause / lost train of thought
- Gaps > 1.0s: notable pause (could be intentional or filler-word-adjacent)
- No gaps > 0.3s in a long stretch: speaking too continuously without breathing

### 2.4 VAD-Based Silence Analysis

faster-whisper already includes Silero VAD (used when `vad_filter=True`). The VAD timestamps tell us exactly where speech exists vs. silence. From [faster-whisper's vad.py](https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/vad.py):

- `SileroVADModel` processes audio in 512-sample windows
- Returns speech timestamps as `[{start, end}, ...]`
- We can compute: total silence ratio, longest silence, silence distribution

---

## 3. Audio Analysis -- Lightweight Libraries

### 3.1 RMS Energy (Volume) -- `librosa`

RMS energy measures loudness per frame. Detecting:
- **Trailing off**: energy decreasing toward the end of sentences
- **Mumbling**: sustained low energy during speech segments
- **Volume inconsistency**: high variance in energy across the recording

**Library:** `librosa` -- pure Python + NumPy, no GPU needed, ~30MB installed
**Function:** [`librosa.feature.rms()`](https://librosa.org/doc/main/generated/librosa.feature.rms.html)

```python
librosa.feature.rms(
    y=None,           # audio time series
    S=None,           # spectrogram (alternative input)
    frame_length=2048,
    hop_length=512,
    center=True,
    pad_mode='constant'
)
# Returns: RMS value per frame, shape (1, num_frames)
```

**What to compute:**
- Mean RMS across full recording
- RMS per segment (aligned to Whisper segments via timestamps)
- RMS slope within each segment (negative slope = trailing off)
- Ratio of min-to-max RMS across segments (volume consistency)

### 3.2 Pitch Variation (Monotone Detection) -- `librosa.pyin`

Fundamental frequency (F0) variation indicates vocal expressiveness. Monotone speakers have low F0 standard deviation. Expressive speakers vary pitch deliberately.

**Function:** [`librosa.pyin()`](https://librosa.org/doc/main/generated/librosa.pyin.html)

```python
f0, voiced_flag, voiced_probs = librosa.pyin(
    y,
    sr=sr,
    fmin=librosa.note_to_hz('C2'),   # ~65 Hz (low male voice)
    fmax=librosa.note_to_hz('C7'),   # ~2093 Hz (upper range)
    frame_length=2048                 # ~93ms at 22050 Hz
)
# f0: fundamental frequency per frame (NaN for unvoiced)
# voiced_flag: boolean per frame
# voiced_probs: voicing probability per frame
```

**What to compute:**
- Mean F0 (baseline pitch)
- F0 standard deviation (pitch variation -- low = monotone)
- F0 range (max - min of voiced frames)
- F0 contour slope per segment (detecting "upspeak" -- rising intonation on statements)

**Benchmarks:**
- F0 std dev < 20 Hz: likely monotone delivery
- F0 std dev 20-50 Hz: normal conversational variation
- F0 std dev > 50 Hz: expressive/dynamic delivery

### 3.3 Parselmouth (Praat) -- More Detailed Voice Quality

[Parselmouth](https://github.com/YannickJadoul/Parselmouth) wraps Praat's C/C++ algorithms in Python. It provides phonetics-grade measurements that librosa does not:

- **Jitter**: fluctuation in pitch period length (high jitter = shaky/breathy voice)
- **Shimmer**: fluctuation in amplitude (high shimmer = hoarse/rough voice)
- **Harmonics-to-Noise Ratio (HNR)**: signal clarity (low HNR = breathy/noisy voice)
- **Intensity**: more phonetics-standard loudness measurement than RMS

These are clinically validated voice quality measures used in speech pathology.

**Trade-off:** Adds ~50MB to the container image. CPU-only, fast (~200ms for 2-min audio). But the metrics are harder to translate into actionable coaching feedback for non-specialists.

**Recommendation:** Skip for V1. The metrics are powerful but require calibration to be meaningful in coaching context. Revisit if users ask "why does my voice sound weird?"

### 3.4 openSMILE -- Standardized Feature Sets

[openSMILE](https://audeering.github.io/opensmile-python/) extracts the [eGeMAPSv02](https://audeering.github.io/opensmile-python/) feature set (88 features) -- the academic standard for voice analysis.

```python
import opensmile

smile = opensmile.Smile(
    feature_set=opensmile.FeatureSet.eGeMAPSv02,
    feature_level=opensmile.FeatureLevel.LowLevelDescriptors,
)
features_df = smile.process_file("audio.wav")
```

**Trade-off:** Non-commercial license restriction ("free for private, research, and educational purposes, but not for commercial products"). This may be a blocker depending on Extemp's future. Also returns 88 features, most of which are not useful for speaking coaching.

**Recommendation:** Skip. librosa covers our needs without license issues.

---

## 4. Heavier Approaches

### 4.1 NISQA -- Non-Intrusive Speech Quality Assessment

[NISQA](https://github.com/gabrielmittag/NISQA) is a deep learning model that predicts MOS (Mean Opinion Score) and four quality dimensions: **Noisiness, Coloration, Discontinuity, Loudness**. No reference signal needed.

Available via [PyTorch Metrics](https://lightning.ai/docs/torchmetrics/stable/audio/non_intrusive_speech_quality_assessment.html):

```python
from torchmetrics.functional.audio.nisqa import non_intrusive_speech_quality_assessment

# Returns: [overall_MOS, noisiness, discontinuity, coloration, loudness]
scores = non_intrusive_speech_quality_assessment(audio_tensor, sample_rate=16000)
```

**Pros:** Single function call, returns interpretable scores
**Cons:** Designed for communication quality (codecs, noise, packet loss), not speaking clarity. A perfectly clear mumbler would score well on NISQA. Model weights are CC BY-NC-SA 4.0.

**Recommendation:** Not a good fit. Optimized for channel quality, not delivery quality.

### 4.2 Fine-Tuned Whisper for Confidence (Research)

A [2025 paper (arXiv:2502.13446)](https://arxiv.org/abs/2502.13446) fine-tunes Whisper-tiny to output scalar confidence scores per word, outperforming traditional Confidence Estimation Modules (CEMs). The approach modifies Whisper's decoder to output scalar values instead of next-token probabilities.

**Pros:** State-of-the-art word-level confidence, specifically calibrated
**Cons:** Requires a second model (Whisper-tiny, 39M params), custom training, not off-the-shelf. Would need its own cold-start on Modal.

**Recommendation:** Not for V1. The built-in `word.probability` is good enough. Revisit if clarity scoring needs to be more precise.

### 4.3 SpeechBrain

[SpeechBrain](https://speechbrain.github.io/) is a comprehensive PyTorch toolkit for speech processing. It has pre-trained models for speaker verification, speech enhancement, and separation, but **no dedicated pronunciation scoring module**. You could build one using their toolkit, but it is build-your-own.

**Recommendation:** Overkill for our use case. Skip.

### 4.4 Pronunciation Scoring APIs

- **[SpeechSuper](https://www.speechsuper.com/)**: Commercial API, deep-learning pronunciation assessment for 8 languages. Paid, closed-source.
- **Goodness of Pronunciation (GOP)**: Academic standard using ASR forced alignment + phone-level scoring. Requires a separate phoneme recognizer. Complex to set up.

**Recommendation:** Skip for V1. Our Whisper word probabilities approximate this.

---

## 5. Recommended Implementation

Ordered by effort/impact. Each tier builds on the previous.

### Tier 1: Zero-Cost (just use existing faster-whisper data better)

**Effort:** 2-3 hours | **Impact:** HIGH

Change the Modal endpoint to return richer data from faster-whisper:

1. Enable `word_timestamps=True` in the transcribe call
2. Return per-word `{word, start, end, probability}` arrays
3. Return per-segment `{avg_logprob, no_speech_prob}`
4. Compute and return:
   - **Overall WPM** (total words / total duration)
   - **Per-segment WPM** (detect pacing changes)
   - **Unclear words** (words with probability < 0.5)
   - **Pause list** (gaps > 1.0s between words, with timestamps)
   - **Longest pause** and **pause count**
   - **Silence ratio** (from VAD if already enabled)

### Tier 2: Lightweight Audio Analysis (add librosa)

**Effort:** 3-4 hours | **Impact:** MEDIUM-HIGH

Add `librosa` to the Modal image (~30MB, CPU-only, fast install). Extract:

1. **RMS energy per segment** -- detect trailing off, mumbling
2. **Energy consistency score** -- variance of RMS across segments
3. **F0 (pitch) statistics** -- mean, std dev, range
4. **Monotone score** -- flag if F0 std dev is below threshold
5. **Energy slope per sentence** -- negative slope = trailing off

This adds ~200-500ms to processing time for a 2-min audio file. All CPU work, does not compete with GPU for Whisper.

### Tier 3: Advanced Voice Quality (add parselmouth) [FUTURE]

**Effort:** 4-6 hours | **Impact:** MEDIUM

Add `parselmouth` for jitter, shimmer, HNR. Useful for detecting:
- Shaky/nervous voice (high jitter)
- Breathy/unclear voice (low HNR)
- Voice strain (abnormal shimmer)

**Skip for V1.** These metrics need calibration and the coaching language is harder ("your harmonics-to-noise ratio is low" is not helpful feedback). Revisit when we have data on what users actually struggle with.

---

## 6. Code Sketches

### 6.1 Enhanced faster-whisper Transcription (Tier 1)

```python
from faster_whisper import WhisperModel
from dataclasses import dataclass, asdict
from typing import Optional
import numpy as np


@dataclass
class UnclearWord:
    word: str
    start: float
    end: float
    probability: float


@dataclass
class PauseEvent:
    start: float  # end of previous word
    end: float    # start of next word
    duration: float
    after_word: str
    before_word: str


@dataclass
class VoiceClarityMetrics:
    # Speech rate
    overall_wpm: float
    segment_wpm: list[float]  # per-segment WPM
    pacing_label: str  # "too_slow" | "good" | "too_fast"

    # Clarity
    unclear_words: list[UnclearWord]
    unclear_word_ratio: float  # fraction of words below threshold
    mean_word_confidence: float
    min_segment_avg_logprob: float

    # Pauses
    pauses: list[PauseEvent]  # pauses > 1.0s
    longest_pause: float
    total_pause_time: float
    pause_count: int


def analyze_clarity_from_whisper(
    model: WhisperModel,
    audio_path: str,
    confidence_threshold: float = 0.5,
    pause_threshold: float = 1.0,  # seconds
) -> tuple[str, VoiceClarityMetrics]:
    """
    Transcribe audio and extract voice clarity metrics from faster-whisper output.
    Returns (transcript_text, clarity_metrics).
    """
    segments, info = model.transcribe(
        audio_path,
        word_timestamps=True,
        vad_filter=True,
    )

    # Collect all data (segments is a generator, must consume once)
    all_words: list[dict] = []
    all_segments: list[dict] = []
    full_text_parts: list[str] = []

    for segment in segments:
        seg_data = {
            "start": segment.start,
            "end": segment.end,
            "text": segment.text,
            "avg_logprob": segment.avg_logprob,
            "no_speech_prob": segment.no_speech_prob,
            "words": [],
        }

        if segment.words:
            for w in segment.words:
                word_data = {
                    "word": w.word,
                    "start": w.start,
                    "end": w.end,
                    "probability": w.probability,
                }
                seg_data["words"].append(word_data)
                all_words.append(word_data)

        all_segments.append(seg_data)
        full_text_parts.append(segment.text)

    transcript = " ".join(full_text_parts).strip()

    if not all_words:
        return transcript, VoiceClarityMetrics(
            overall_wpm=0, segment_wpm=[], pacing_label="underfilled",
            unclear_words=[], unclear_word_ratio=0, mean_word_confidence=0,
            min_segment_avg_logprob=0, pauses=[], longest_pause=0,
            total_pause_time=0, pause_count=0,
        )

    # --- Speech Rate ---
    total_duration = all_words[-1]["end"] - all_words[0]["start"]
    total_words = len(all_words)
    overall_wpm = (total_words / total_duration) * 60 if total_duration > 0 else 0

    segment_wpm = []
    for seg in all_segments:
        if seg["words"]:
            seg_dur = seg["words"][-1]["end"] - seg["words"][0]["start"]
            seg_wc = len(seg["words"])
            segment_wpm.append((seg_wc / seg_dur) * 60 if seg_dur > 0 else 0)

    if overall_wpm < 110:
        pacing_label = "too_slow"
    elif overall_wpm > 180:
        pacing_label = "too_fast"
    else:
        pacing_label = "good"

    # --- Unclear Words ---
    unclear = [
        UnclearWord(
            word=w["word"].strip(),
            start=w["start"],
            end=w["end"],
            probability=w["probability"],
        )
        for w in all_words
        if w["probability"] < confidence_threshold
    ]

    probs = [w["probability"] for w in all_words]
    mean_confidence = float(np.mean(probs))
    unclear_ratio = len(unclear) / total_words if total_words > 0 else 0

    seg_logprobs = [s["avg_logprob"] for s in all_segments if s["avg_logprob"] is not None]
    min_logprob = min(seg_logprobs) if seg_logprobs else 0.0

    # --- Pauses ---
    pauses: list[PauseEvent] = []
    for i in range(len(all_words) - 1):
        gap = all_words[i + 1]["start"] - all_words[i]["end"]
        if gap >= pause_threshold:
            pauses.append(PauseEvent(
                start=all_words[i]["end"],
                end=all_words[i + 1]["start"],
                duration=round(gap, 2),
                after_word=all_words[i]["word"].strip(),
                before_word=all_words[i + 1]["word"].strip(),
            ))

    longest_pause = max((p.duration for p in pauses), default=0.0)
    total_pause_time = sum(p.duration for p in pauses)

    return transcript, VoiceClarityMetrics(
        overall_wpm=round(overall_wpm, 1),
        segment_wpm=[round(w, 1) for w in segment_wpm],
        pacing_label=pacing_label,
        unclear_words=unclear,
        unclear_word_ratio=round(unclear_ratio, 3),
        mean_word_confidence=round(mean_confidence, 3),
        min_segment_avg_logprob=round(min_logprob, 3),
        pauses=pauses,
        longest_pause=round(longest_pause, 2),
        total_pause_time=round(total_pause_time, 2),
        pause_count=len(pauses),
    )
```

### 6.2 Audio Energy & Pitch Analysis (Tier 2)

```python
import librosa
import numpy as np
from dataclasses import dataclass


@dataclass
class EnergyMetrics:
    mean_rms: float
    rms_std: float
    energy_consistency: float  # 0-1, higher = more consistent volume
    trailing_off_segments: list[int]  # segment indices where energy drops > 40%


@dataclass
class PitchMetrics:
    mean_f0: float           # Hz, average fundamental frequency
    f0_std: float            # Hz, standard deviation
    f0_range: float          # Hz, max - min
    monotone_score: float    # 0-1, higher = more monotone
    voiced_ratio: float      # fraction of frames that are voiced


@dataclass
class AudioAnalysisResult:
    energy: EnergyMetrics
    pitch: PitchMetrics


def analyze_audio_features(
    audio_path: str,
    segment_timestamps: list[dict],  # [{start, end}, ...] from Whisper
    sr: int = 16000,
) -> AudioAnalysisResult:
    """
    Extract energy and pitch features from raw audio.
    segment_timestamps come from the Whisper transcription.
    """
    y, sr = librosa.load(audio_path, sr=sr)

    # --- RMS Energy ---
    hop_length = 512
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop_length)[0]
    times = librosa.times_like(rms, sr=sr, hop_length=hop_length)

    mean_rms = float(np.mean(rms))
    rms_std = float(np.std(rms))

    # Energy consistency: 1 - coefficient of variation (capped at 0)
    cv = rms_std / mean_rms if mean_rms > 0 else 1.0
    energy_consistency = max(0.0, 1.0 - cv)

    # Check for trailing off within each segment
    trailing_off = []
    for i, seg in enumerate(segment_timestamps):
        seg_start = seg["start"]
        seg_end = seg["end"]

        # Get RMS frames within this segment
        mask = (times >= seg_start) & (times <= seg_end)
        seg_rms = rms[mask]

        if len(seg_rms) >= 4:
            first_half = np.mean(seg_rms[: len(seg_rms) // 2])
            second_half = np.mean(seg_rms[len(seg_rms) // 2 :])

            # If second half energy drops by > 40%, flag as trailing off
            if first_half > 0 and (second_half / first_half) < 0.6:
                trailing_off.append(i)

    energy = EnergyMetrics(
        mean_rms=round(float(mean_rms), 4),
        rms_std=round(float(rms_std), 4),
        energy_consistency=round(energy_consistency, 3),
        trailing_off_segments=trailing_off,
    )

    # --- Pitch (F0) ---
    f0, voiced_flag, voiced_probs = librosa.pyin(
        y,
        sr=sr,
        fmin=librosa.note_to_hz('C2'),   # ~65 Hz
        fmax=librosa.note_to_hz('C7'),   # ~2093 Hz
        frame_length=2048,
    )

    # Filter to voiced frames only
    voiced_f0 = f0[voiced_flag] if voiced_flag is not None else f0[~np.isnan(f0)]

    if len(voiced_f0) > 0:
        mean_f0 = float(np.nanmean(voiced_f0))
        f0_std = float(np.nanstd(voiced_f0))
        f0_range = float(np.nanmax(voiced_f0) - np.nanmin(voiced_f0))
    else:
        mean_f0 = 0.0
        f0_std = 0.0
        f0_range = 0.0

    voiced_ratio = float(np.sum(voiced_flag)) / len(voiced_flag) if len(voiced_flag) > 0 else 0.0

    # Monotone score: based on coefficient of variation of F0
    # Low CV = monotone, high CV = expressive
    # Normalize: CV < 0.05 => monotone_score ~1.0, CV > 0.20 => ~0.0
    f0_cv = f0_std / mean_f0 if mean_f0 > 0 else 0
    monotone_score = max(0.0, min(1.0, 1.0 - (f0_cv - 0.05) / 0.15))

    pitch = PitchMetrics(
        mean_f0=round(mean_f0, 1),
        f0_std=round(f0_std, 1),
        f0_range=round(f0_range, 1),
        monotone_score=round(monotone_score, 3),
        voiced_ratio=round(voiced_ratio, 3),
    )

    return AudioAnalysisResult(energy=energy, pitch=pitch)
```

### 6.3 Integration into Modal Endpoint

```python
import modal

app = modal.App("extemp-transcribe")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "faster-whisper>=1.1.0",
        "librosa>=0.10.0",
        "numpy",
    )
)

model_volume = modal.Volume.from_name("whisper-model-cache", create_if_missing=True)

@app.cls(
    gpu="T4",
    image=image,
    volumes={"/model-cache": model_volume},
    scaledown_window=300,
)
class Transcriber:
    @modal.enter()
    def load_model(self):
        from faster_whisper import WhisperModel

        self.model = WhisperModel(
            "large-v3-turbo",
            device="cuda",
            compute_type="float16",
            download_root="/model-cache",
        )

    @modal.fastapi_endpoint(method="POST")
    async def transcribe(self, request):
        import tempfile
        import json
        from fastapi import UploadFile, File

        # Save uploaded audio to temp file
        audio_data = await request.body()
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_data)
            audio_path = f.name

        # --- Tier 1: Enhanced Whisper transcription ---
        transcript, clarity_metrics = analyze_clarity_from_whisper(
            self.model, audio_path
        )

        # --- Tier 2: Audio analysis ---
        segment_timestamps = []
        segments, _ = self.model.transcribe(audio_path, word_timestamps=True, vad_filter=True)
        # Note: in practice, cache the segments from the first transcription
        # This is just showing the integration pattern
        audio_analysis = analyze_audio_features(
            audio_path,
            segment_timestamps=[
                {"start": s.start, "end": s.end} for s in segments
            ],
        )

        return {
            "transcript": transcript,
            "voice_metrics": {
                # Tier 1
                "wpm": clarity_metrics.overall_wpm,
                "pacing": clarity_metrics.pacing_label,
                "unclear_words": [
                    {"word": w.word, "start": w.start, "probability": w.probability}
                    for w in clarity_metrics.unclear_words
                ],
                "unclear_word_ratio": clarity_metrics.unclear_word_ratio,
                "mean_confidence": clarity_metrics.mean_word_confidence,
                "pauses": [
                    {"start": p.start, "duration": p.duration, "after": p.after_word}
                    for p in clarity_metrics.pauses
                ],
                "longest_pause": clarity_metrics.longest_pause,
                "pause_count": clarity_metrics.pause_count,

                # Tier 2
                "energy_consistency": audio_analysis.energy.energy_consistency,
                "trailing_off_segments": audio_analysis.energy.trailing_off_segments,
                "pitch_mean_hz": audio_analysis.pitch.mean_f0,
                "pitch_variation_hz": audio_analysis.pitch.f0_std,
                "monotone_score": audio_analysis.pitch.monotone_score,
            },
        }
```

### 6.4 Pause Detection from Silero VAD (Alternative/Complement)

If you want pause data independent of Whisper's word timestamps (e.g., detecting silence before the speaker even starts):

```python
from silero_vad import load_silero_vad, read_audio, get_speech_timestamps


def analyze_pauses_with_vad(audio_path: str) -> dict:
    """
    Use Silero VAD to detect speech/silence segments and compute pause metrics.
    Note: Silero VAD is already bundled with faster-whisper, so no extra install.
    """
    model = load_silero_vad()
    wav = read_audio(audio_path)

    speech_timestamps = get_speech_timestamps(
        wav,
        model,
        return_seconds=True,
        min_silence_duration_ms=500,  # only flag pauses > 500ms
    )

    if not speech_timestamps:
        return {"speech_ratio": 0, "pauses": [], "total_audio_duration": 0}

    total_audio_duration = len(wav) / 16000  # assuming 16kHz
    total_speech_time = sum(
        seg["end"] - seg["start"] for seg in speech_timestamps
    )
    speech_ratio = total_speech_time / total_audio_duration

    # Compute gaps between speech segments
    pauses = []
    for i in range(len(speech_timestamps) - 1):
        gap_start = speech_timestamps[i]["end"]
        gap_end = speech_timestamps[i + 1]["start"]
        gap_duration = gap_end - gap_start
        if gap_duration > 0.5:  # only notable pauses
            pauses.append({
                "start": round(gap_start, 2),
                "end": round(gap_end, 2),
                "duration": round(gap_duration, 2),
            })

    return {
        "speech_ratio": round(speech_ratio, 3),
        "total_speech_time": round(total_speech_time, 2),
        "total_silence_time": round(total_audio_duration - total_speech_time, 2),
        "pauses": pauses,
        "pause_count": len(pauses),
        "longest_pause": max((p["duration"] for p in pauses), default=0),
    }
```

### 6.5 Voice Quality with Parselmouth (Tier 3, Future)

```python
import parselmouth
from parselmouth.praat import call


def analyze_voice_quality(audio_path: str) -> dict:
    """
    Extract jitter, shimmer, and HNR using Parselmouth/Praat.
    These are clinically validated voice quality metrics.
    """
    sound = parselmouth.Sound(audio_path)

    # Pitch object for F0 range
    pitch = call(sound, "To Pitch", 0.0, 75, 500)
    mean_f0 = call(pitch, "Get mean", 0, 0, "Hertz")
    stdev_f0 = call(pitch, "Get standard deviation", 0, 0, "Hertz")

    # Harmonicity (HNR) -- signal clarity
    harmonicity = call(sound, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
    hnr = call(harmonicity, "Get mean", 0, 0)

    # Jitter -- pitch period irregularity (nervousness, vocal strain)
    point_process = call(sound, "To PointProcess (periodic, cc)", 75, 500)
    local_jitter = call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)

    # Shimmer -- amplitude irregularity (breathiness, hoarseness)
    local_shimmer = call(
        [sound, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6
    )

    return {
        "mean_f0_hz": round(mean_f0, 1) if mean_f0 else None,
        "f0_std_hz": round(stdev_f0, 1) if stdev_f0 else None,
        "hnr_db": round(hnr, 2) if hnr else None,  # > 20 dB = clean voice
        "jitter_local": round(local_jitter, 5) if local_jitter else None,  # < 0.01 = normal
        "shimmer_local": round(local_shimmer, 4) if local_shimmer else None,  # < 0.04 = normal
        "voice_quality_label": _classify_voice_quality(hnr, local_jitter, local_shimmer),
    }


def _classify_voice_quality(hnr, jitter, shimmer) -> str:
    """Simple heuristic classification of voice quality."""
    if hnr is None or jitter is None or shimmer is None:
        return "unknown"
    if hnr > 20 and jitter < 0.01 and shimmer < 0.04:
        return "clear"
    if hnr < 10 or jitter > 0.02 or shimmer > 0.08:
        return "strained"
    return "normal"
```

---

## 7. Key References

- [faster-whisper transcribe.py (Segment/Word dataclasses)](https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py)
- [faster-whisper issue #1358 -- segment-level log probabilities](https://github.com/SYSTRAN/faster-whisper/issues/1358)
- [Whisper confidence scores discussion (openai/whisper #284)](https://github.com/openai/whisper/discussions/284)
- [Whisper for L2 speech scoring (2024)](https://link.springer.com/article/10.1007/s10772-024-10141-5) -- Spearman rho=0.72 between Whisper probabilities and pronunciation quality
- [Adopting Whisper for Confidence Estimation (arXiv:2502.13446, ICASSP 2025)](https://arxiv.org/abs/2502.13446)
- [librosa.pyin -- pitch tracking](https://librosa.org/doc/main/generated/librosa.pyin.html)
- [librosa.feature.rms -- energy analysis](https://librosa.org/doc/main/generated/librosa.feature.rms.html)
- [Parselmouth (Praat in Python)](https://github.com/YannickJadoul/Parselmouth)
- [PraatScripts -- Jitter/Shimmer/HNR extraction](https://github.com/drfeinberg/PraatScripts/blob/master/Measure%20Pitch,%20HNR,%20Jitter,%20and%20Shimmer.ipynb)
- [Silero VAD](https://github.com/snakers4/silero-vad)
- [faster-whisper VAD integration](https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/vad.py)
- [NISQA speech quality model](https://github.com/gabrielmittag/NISQA)
- [openSMILE Python](https://audeering.github.io/opensmile-python/)
- [SpeechBrain toolkit](https://speechbrain.github.io/)
- [whisper-timestamped (alternative with enhanced confidence)](https://github.com/linto-ai/whisper-timestamped)
