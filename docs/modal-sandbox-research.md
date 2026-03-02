# Modal Sandbox Research: Agent-in-Sandbox Pattern for Extemp

**Date:** 2026-03-02
**Status:** Research / Proposal
**Relevant files:** `pipeline/transcribe.py`, `src/api/evaluate.ts`, `src/index.tsx`

---

## Table of Contents

1. [What Are Modal Sandboxes?](#what-are-modal-sandboxes)
2. [Sandbox API Overview](#sandbox-api-overview)
3. [The Agent-in-Sandbox Pattern](#the-agent-in-sandbox-pattern)
4. [Current Extemp Architecture](#current-extemp-architecture)
5. [Proposed Architectures](#proposed-architectures)
6. [Tradeoffs Analysis](#tradeoffs-analysis)
7. [Cost Estimation](#cost-estimation)
8. [Example Code](#example-code)
9. [Recommended Next Steps](#recommended-next-steps)
10. [Sources](#sources)

---

## What Are Modal Sandboxes?

Modal Sandboxes are **secure, ephemeral containers for executing arbitrary code on Modal's infrastructure**. Unlike Modal Functions (which are pre-defined, deployed Python functions with fixed entry points), Sandboxes allow you to:

- Define container images **at runtime** (dynamic dependency installation)
- Execute **arbitrary commands** inside the container via `Sandbox.exec()`
- Pass data in/out via **Volumes**, **stdin/stdout**, or the **Filesystem API**
- Attach **GPUs, secrets, and networking** just like regular Modal Functions
- Set **timeouts** (up to 24 hours) and **idle timeouts** for automatic cleanup

The key differentiator from Modal Functions is **runtime flexibility**. Functions require you to know at deploy-time exactly what code will run. Sandboxes let you decide at runtime. This is why they're the foundation for AI coding agents (Lovable, Cursor-like tools) that generate and execute code dynamically.

**Isolation model:** Sandboxes use **gVisor** (a user-space kernel) for enhanced container isolation, making them safe for running untrusted or LLM-generated code.

## Sandbox API Overview

### Creating a Sandbox

```python
import modal

app = modal.App.lookup("extemp-pipeline", create_if_missing=True)

# Basic sandbox
sandbox = modal.Sandbox.create(app=app)

# Sandbox with GPU, custom image, volumes, and secrets
sandbox = modal.Sandbox.create(
    app=app,
    image=modal.Image.debian_slim(python_version="3.12")
        .apt_install("ffmpeg")
        .pip_install("openai-whisper", "librosa"),
    gpu="T4",
    timeout=600,           # 10 minutes max lifetime
    idle_timeout=120,      # auto-terminate after 2 min idle
    volumes={"/models": model_volume, "/audio": audio_volume},
    secrets=[modal.Secret.from_name("openrouter-key")],
)
```

### Executing Commands

```python
# Run a command and read output
process = sandbox.exec("python", "-c", "print('hello')")
process.wait()
stdout = process.stdout.read()  # blocks until complete
stderr = process.stderr.read()

# Stream output from a long-running process
process = sandbox.exec("python", "transcribe.py")
for line in process.stdout:
    print(line, end="")
```

### File System Access

Three approaches for getting data in/out:

1. **Volumes** (recommended for persistence): Mount shared Volumes that other containers can also access.
2. **Filesystem API** (alpha): Direct `read()`/`write()` calls on the sandbox filesystem during execution.
3. **stdin/stdout**: Pipe data in via `sandbox.stdin.write()` and read results from `process.stdout.read()`.

### Lifecycle Management

```python
# Retrieve an existing sandbox by ID
sandbox = modal.Sandbox.from_id("sb-abc123")

# Named sandboxes (unique per app, only for deployed apps)
sandbox = modal.Sandbox.create(name="extemp-worker", app=app)
later = modal.Sandbox.from_name("extemp-worker", app=app)

# Cleanup
sandbox.terminate()  # force stop
sandbox.detach()     # close client connection, sandbox keeps running
```

## The Agent-in-Sandbox Pattern

The "Agent-in-Sandbox" pattern, popularized by Modal's coding agent examples, follows this architecture:

```
                  +-------------------+
                  |  Orchestrator     |
                  |  (Modal Function  |
                  |   or local)       |
                  +--------+----------+
                           |
                  1. Create Sandbox
                  2. Inject code/data
                  3. Execute
                  4. Read results
                  5. Decide: retry or finish
                           |
                  +--------v----------+
                  |  Modal Sandbox    |
                  |  (GPU, deps,      |
                  |   isolation)       |
                  |                   |
                  |  - Run Whisper    |
                  |  - Run LLM eval  |
                  |  - Return JSON   |
                  +-------------------+
```

**Key characteristics:**

1. **Orchestrator controls the loop.** A Modal Function (or local script) creates a Sandbox, sends it work, reads results, and decides what to do next. The sandbox is the "hands"; the orchestrator is the "brain."

2. **Container reuse via `exec()`.** Each `sandbox.exec()` call runs inside the *same* container without cold-start overhead. You can run Whisper, then immediately run an LLM evaluation, reusing the warm container and its loaded models.

3. **Dynamic environments.** The sandbox image can be built at runtime based on user input, enabling per-request dependency customization.

4. **Fault isolation.** If agent-generated code crashes the sandbox, the orchestrator is unaffected. It can create a new sandbox and retry.

**Modal's reference implementation** (LangGraph-based coding agent):

```python
def create_sandbox(app) -> modal.Sandbox:
    return modal.Sandbox.create(
        image=modal.Image.debian_slim().pip_install("torch", "transformers"),
        timeout=600,
        app=app,
        gpu="T4",
    )

def run(code: str, sb: modal.Sandbox) -> tuple[str, str]:
    exc = sb.exec("python", "-c", code)
    exc.wait()
    return exc.stdout.read(), exc.stderr.read()

# Agent loop: generate -> execute in sandbox -> evaluate -> decide
```

## Current Extemp Architecture

```
Browser (React SPA)
    |
    | POST /api/transcribe (FormData: audio blob)
    v
Bun.serve Proxy (src/index.tsx)
    |
    | Forward FormData to Modal
    v
Modal Function: Whisper on T4 GPU (pipeline/transcribe.py)
    |
    | Returns: transcript, words[], segments[], audio_id, WPM
    v
Bun.serve Proxy
    |
    | POST /api/evaluate (JSON: transcript + prompt + settings)
    v
Bun.serve Handler (src/api/evaluate.ts)
    |
    | Calls OpenRouter API (Gemini 2.5 Flash Lite or DeepSeek V3)
    v
OpenRouter LLM
    |
    | Returns: scores, coaching, filler words, framework analysis
    v
Browser (ResultsPanel)
```

**Two separate hops:**
1. **Transcription:** Browser -> Bun -> Modal (T4 GPU) -> Bun -> Browser
2. **Evaluation:** Browser -> Bun -> OpenRouter -> Bun -> Browser

The Bun server acts as a proxy/orchestrator, holding the OpenRouter API key server-side and forwarding audio to Modal.

## Proposed Architectures

### Option A: Unified Pipeline in a Single Modal Function

Collapse transcription + LLM evaluation into a **single Modal Function** (not a Sandbox). The Function receives audio, runs Whisper, then calls OpenRouter (or a self-hosted LLM) for evaluation, and returns the combined result.

```
Browser
    |
    | POST /api/process (FormData: audio + prompt + settings)
    v
Bun.serve Proxy
    |
    | Forward to Modal
    v
Modal Function (T4 GPU):
    1. Whisper transcription
    2. Call OpenRouter / run local LLM for evaluation
    3. Return combined result
    |
    v
Bun.serve Proxy -> Browser
```

**Pros:**
- Single network round-trip from Bun to Modal (eliminates one hop)
- Simpler client logic -- one API call instead of two
- OpenRouter API key can live as a Modal Secret (no need on Bun server)
- Lower total latency (no round-trip back to Bun between transcribe and evaluate)

**Cons:**
- GPU sits idle during LLM API call (paying for T4 while waiting on OpenRouter)
- Tighter coupling -- Whisper and evaluation are tied to the same deploy cycle
- Harder to swap evaluation providers without redeploying Modal

### Option B: Sandbox-Based Pipeline Orchestrator

Use a **Modal Function as orchestrator** that creates a Sandbox for transcription, reads results, then either calls OpenRouter directly or spins up a second sandbox for LLM inference.

```
Browser
    |
    | POST /api/process
    v
Bun.serve Proxy
    |
    v
Modal Function (orchestrator, CPU-only):
    |
    | 1. Create GPU Sandbox with Whisper image
    | 2. sandbox.exec("python", "transcribe.py", audio_path)
    | 3. Read transcript from stdout/volume
    | 4. Call OpenRouter for evaluation (or create LLM sandbox)
    | 5. Return combined result
    |
    v
Bun.serve Proxy -> Browser
```

**Pros:**
- GPU is only allocated during actual transcription (cost-efficient)
- Orchestrator can retry individual steps on failure
- Could run a self-hosted LLM (e.g., Llama, Mistral) in a separate GPU sandbox
- Maximum flexibility for future pipeline changes

**Cons:**
- Sandbox creation has overhead (~1-2s cold start, sub-second warm)
- More complex code to manage sandbox lifecycle
- Overkill for a fixed, known pipeline (Sandboxes shine for *dynamic* code)

### Option C: Self-Hosted LLM Evaluation on Modal

Replace OpenRouter entirely with a self-hosted LLM running on Modal. This could be a regular Modal Function or a Sandbox, depending on whether the model/prompt needs to be dynamic.

```
Browser
    |
    v
Bun.serve Proxy
    |
    v
Modal App:
    Function 1 (T4): Whisper transcription
    Function 2 (T4 or A10G): vLLM serving Mistral/Llama for evaluation
    |
    v
Bun.serve orchestrates: call Function 1, then Function 2
```

**Pros:**
- No external API dependency (no OpenRouter, no per-token cost)
- Predictable latency (no third-party rate limits)
- Full control over model choice and prompt engineering
- Could batch multiple evaluations

**Cons:**
- Significant operational complexity (model selection, vLLM setup, prompt tuning)
- Higher fixed cost if the LLM container has low utilization
- Current OpenRouter models (Gemini Flash Lite, DeepSeek V3) are very capable and cheap
- GPU cost for LLM inference may exceed OpenRouter API cost at low volume

## Tradeoffs Analysis

| Factor | Current (Split) | Option A (Unified Fn) | Option B (Sandbox) | Option C (Self-hosted LLM) |
|---|---|---|---|---|
| **Latency** | ~8-12s total (two round-trips) | ~6-9s (one round-trip, GPU idle during eval) | ~7-11s (sandbox overhead) | ~6-8s (both on Modal, no external API) |
| **Cost** | T4 for transcribe + OpenRouter per-token | T4 idle during eval (~2-4s waste) | T4 only during transcribe | Two GPU instances, no API cost |
| **Complexity** | Low (current, working) | Low-Medium | Medium-High | High |
| **Flexibility** | High (swap eval provider easily) | Medium | High | Medium (locked to chosen model) |
| **Failure isolation** | Good (independent services) | Poor (one failure kills both) | Excellent (sandbox retry) | Good (independent functions) |
| **Best for** | Current scale | Simplifying the pipeline | Dynamic/agent workloads | High volume, cost optimization |

### When Sandboxes Make Sense for Extemp

Sandboxes are designed for **dynamic, untrusted code execution**. They are the right tool when:

- The code to run is **generated at runtime** (e.g., by an LLM)
- You need **per-request isolation** (e.g., running user-submitted code)
- The execution environment **changes per request** (different dependencies)

For Extemp's current use case (a fixed pipeline of Whisper + LLM evaluation), **Sandboxes add complexity without proportional benefit**. The pipeline is deterministic -- the same code runs every time, just with different audio input.

**However**, Sandboxes become compelling if Extemp evolves toward:

- **Dynamic evaluation pipelines** (user picks their own rubric, coaching style, or LLM)
- **User-uploaded analysis scripts** (custom speech analysis code)
- **Multi-model A/B testing** (spin up different LLMs per request to compare)
- **Reinforcement learning** (running speech practice evaluations in parallel at scale)

## Cost Estimation

Current usage assumptions: ~50 practice sessions/day, ~2 min audio each.

### Current Architecture Cost

| Component | Cost per session | Daily (50 sessions) | Monthly |
|---|---|---|---|
| Modal T4 (Whisper, ~8s active) | $0.0013 | $0.065 | ~$2.00 |
| OpenRouter (Gemini Flash Lite, ~1K tokens) | ~$0.001 | $0.05 | ~$1.50 |
| **Total** | **~$0.002** | **$0.115** | **~$3.50** |

### Option A: Unified Function

| Component | Cost per session | Monthly |
|---|---|---|
| Modal T4 (Whisper 8s + idle 3s during eval) | $0.0018 | ~$2.70 |
| OpenRouter (same) | ~$0.001 | ~$1.50 |
| **Total** | **~$0.003** | **~$4.20** |

Slightly more expensive due to GPU idle time during API call.

### Option C: Self-Hosted LLM

| Component | Cost per session | Monthly |
|---|---|---|
| Modal T4 (Whisper, ~8s) | $0.0013 | ~$2.00 |
| Modal T4 (Mistral 7B, ~5s) | $0.0008 | ~$1.20 |
| **Total** | **~$0.002** | **~$3.20** |

Comparable to current cost. Becomes cheaper at higher volume since there's no per-token API charge.

**Verdict:** At current volumes (~50 sessions/day), the cost difference between architectures is negligible -- under $5/month total. The decision should be based on **simplicity and latency**, not cost.

## Example Code

### Option A: Unified Pipeline Function

```python
# pipeline/process.py
"""
Unified pipeline: Whisper transcription + LLM evaluation in one Modal function.
"""
import modal
import json

model_volume = modal.Volume.from_name("whisper-models", create_if_missing=True)
audio_volume = modal.Volume.from_name("extemp-audio", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg")
    .pip_install("openai-whisper", "librosa", "fastapi[standard]", "python-multipart", "httpx")
)

app = modal.App("extemp-pipeline", image=image)

MODEL_DIR = "/models"
AUDIO_DIR = "/audio"

SYSTEM_PROMPT = """You are a conversational speech coach..."""  # same as evaluate.ts

@app.cls(
    gpu="T4",
    scaledown_window=300,
    volumes={MODEL_DIR: model_volume, AUDIO_DIR: audio_volume},
    secrets=[modal.Secret.from_name("openrouter-key")],
)
class Pipeline:
    @modal.enter()
    def load_model(self):
        import whisper
        self.model = whisper.load_model("turbo", download_root=MODEL_DIR)

    @modal.fastapi_endpoint(method="POST")
    async def process(self, file: UploadFile, prompt: str, prep_time: int, speaking_time: int):
        import os, tempfile, uuid, httpx
        import librosa

        # --- Step 1: Transcribe ---
        contents = await file.read()
        audio_id = str(uuid.uuid4())
        # ... (same transcription logic as current transcribe.py) ...

        tmp = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
        tmp.write(contents)
        tmp.close()

        audio, sr = librosa.load(tmp.name, sr=16000)
        result = self.model.transcribe(audio, language="en", word_timestamps=True)
        transcript = result["text"].strip()

        # --- Step 2: Evaluate via OpenRouter ---
        async with httpx.AsyncClient() as client:
            eval_response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "google/gemini-2.5-flash-lite",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": f'Prompt: "{prompt}"\nTranscript:\n{transcript}'},
                    ],
                    "temperature": 0.7,
                    "response_format": {"type": "json_object"},
                },
                timeout=30.0,
            )
            feedback = eval_response.json()["choices"][0]["message"]["content"]

        # --- Step 3: Return combined result ---
        return {
            "transcript": transcript,
            "audio_id": audio_id,
            "words": words_list,
            "segments": segments_list,
            "speech_rate_wpm": speech_rate_wpm,
            "feedback": json.loads(feedback),
        }
```

### Option B: Sandbox Orchestrator

```python
# pipeline/orchestrator.py
"""
Sandbox-based orchestrator: creates a GPU sandbox for Whisper,
then calls OpenRouter for evaluation.
"""
import modal
import json

app = modal.App("extemp-orchestrator")

whisper_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg")
    .pip_install("openai-whisper", "librosa")
)

model_volume = modal.Volume.from_name("whisper-models", create_if_missing=True)
audio_volume = modal.Volume.from_name("extemp-audio", create_if_missing=True)

@app.function(secrets=[modal.Secret.from_name("openrouter-key")])
def process_speech(audio_bytes: bytes, prompt: str, prep_time: int, speaking_time: int):
    import httpx

    # Step 1: Create a GPU sandbox for Whisper
    sb = modal.Sandbox.create(
        app=app,
        image=whisper_image,
        gpu="T4",
        timeout=120,
        volumes={"/models": model_volume, "/audio": audio_volume},
    )

    # Write audio to sandbox filesystem
    with sb.open("/tmp/input.webm", "wb") as f:
        f.write(audio_bytes)

    # Step 2: Run transcription inside sandbox
    process = sb.exec(
        "python", "-c", """
import json, whisper, librosa
audio, sr = librosa.load("/tmp/input.webm", sr=16000)
model = whisper.load_model("turbo", download_root="/models")
result = model.transcribe(audio, language="en", word_timestamps=True)
print(json.dumps({
    "transcript": result["text"].strip(),
    "segments": [{"text": s["text"]} for s in result.get("segments", [])],
}))
"""
    )
    process.wait()
    transcript_data = json.loads(process.stdout.read())

    # Step 3: Terminate sandbox (release GPU)
    sb.terminate()

    # Step 4: Call OpenRouter for evaluation (no GPU needed)
    # ... (same OpenRouter call as current evaluate.ts) ...

    return {**transcript_data, "feedback": feedback}
```

## Recommended Next Steps

Based on this research, here is the recommended path forward, ordered by impact-to-effort ratio:

### 1. Do Nothing (Recommended for Now)

The current architecture is simple, working, and cheap. At ~50 sessions/day, the split architecture (Modal for Whisper, OpenRouter for evaluation) is the right call. The Bun proxy keeps API keys server-side and the two-hop latency is acceptable.

**Do this if:** You want to focus engineering time on features (Phase 4: persistence, Phase 5: polish) rather than infrastructure.

### 2. Option A: Unified Function (Low Effort, Moderate Win)

If latency becomes a concern (saving ~2-3s by eliminating one network round-trip), consolidate into a single Modal Function. This is a straightforward refactor of `pipeline/transcribe.py` to also call OpenRouter after transcription.

**Estimated effort:** 2-3 hours
**When:** When you notice users complaining about the wait between "Transcribing..." and "Analyzing..." phases.

### 3. Option C: Self-Hosted LLM (Future, High Volume)

If Extemp scales to thousands of sessions/day, self-hosting a small model (Mistral 7B or Llama 3 8B) on Modal becomes cost-effective vs. OpenRouter per-token pricing. Use vLLM on a T4 or A10G.

**Estimated effort:** 1-2 days (model selection, prompt tuning, vLLM setup)
**When:** Monthly OpenRouter bill exceeds ~$50, or you need sub-2s evaluation latency.

### 4. Option B: Sandboxes (Not Recommended for Current Use Case)

Sandboxes add complexity without matching benefit for a fixed pipeline. Consider them only if Extemp evolves toward:
- User-customizable evaluation rubrics
- Dynamic pipeline composition
- Running user-submitted analysis code
- Multi-model A/B testing at scale

**When:** The pipeline needs to be dynamic, not just parameterized.

---

## Sources

- [Modal Sandboxes Documentation](https://modal.com/docs/guide/sandbox)
- [Modal Sandboxes Guide (overview)](https://modal.com/docs/guide/sandboxes)
- [Running Commands in Sandboxes](https://modal.com/docs/guide/sandbox-spawn)
- [Sandbox File Access](https://modal.com/docs/guide/sandbox-files)
- [Modal Coding Agents Solution Page](https://modal.com/solutions/coding-agents)
- [Build a Coding Agent with Modal Sandboxes and LangGraph](https://modal.com/docs/examples/agent)
- [Safe Code Execution Example](https://frontend.modal.com/docs/examples/safe_code_execution)
- [Safe Code Execution Source (GitHub)](https://github.com/modal-labs/modal-examples/blob/main/13_sandboxes/safe_code_execution.py)
- [Coding Agent Source (GitHub)](https://github.com/modal-labs/modal-examples/blob/main/13_sandboxes/codelangchain/agent.py)
- [Top AI Code Sandbox Products (Modal Blog)](https://modal.com/blog/top-code-agent-sandbox-products)
- [Modal GPU Pricing](https://modal.com/pricing)
- [NVIDIA T4 Price on Modal](https://modal.com/blog/nvidia-t4-price-article)
