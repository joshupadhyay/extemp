"""
Test client for the Extemp Whisper transcription endpoint.

Usage:
    python pipeline/test_transcribe.py <audio_file> [endpoint_url]

    audio_file:    Path to a local audio file (WebM, MP4, WAV, etc.)
    endpoint_url:  Full URL of the Modal endpoint (optional — falls back
                   to the MODAL_ENDPOINT_URL env var)

Example:
    python pipeline/test_transcribe.py sample.webm
    python pipeline/test_transcribe.py sample.webm https://your--extemp-whisper-whisper-transcribe.modal.run
"""

import os
import sys
import time
import mimetypes

import requests


def main():
    if len(sys.argv) < 2:
        print(__doc__.strip())
        sys.exit(1)

    audio_path = sys.argv[1]
    endpoint_url = (
        sys.argv[2] if len(sys.argv) > 2 else os.environ.get("MODAL_ENDPOINT_URL")
    )

    if not endpoint_url:
        print(
            "Error: No endpoint URL provided.\n"
            "Pass it as the second argument or set the MODAL_ENDPOINT_URL env var."
        )
        sys.exit(1)

    if not os.path.isfile(audio_path):
        print(f"Error: File not found: {audio_path}")
        sys.exit(1)

    mime_type = mimetypes.guess_type(audio_path)[0] or "application/octet-stream"
    file_size_mb = os.path.getsize(audio_path) / (1024 * 1024)

    print(f"File:     {audio_path} ({file_size_mb:.2f} MB, {mime_type})")
    print(f"Endpoint: {endpoint_url}")
    print("Uploading...\n")

    start = time.perf_counter()

    with open(audio_path, "rb") as f:
        resp = requests.post(
            endpoint_url,
            files={"file": (os.path.basename(audio_path), f, mime_type)},
            timeout=120,
        )

    elapsed = round(time.perf_counter() - start, 2)

    if resp.status_code != 200:
        print(f"Request failed ({resp.status_code}):")
        print(resp.text)
        sys.exit(1)

    data = resp.json()
    transcript = data.get("transcript", "")
    server_duration = data.get("duration", "?")

    print(f"Transcript ({len(transcript.split())} words):")
    print("-" * 60)
    print(transcript)
    print("-" * 60)
    print(f"\nServer processing: {server_duration}s")
    print(f"Round-trip time:   {elapsed}s")


if __name__ == "__main__":
    main()
