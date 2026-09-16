from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from pathlib import Path

from gradio_client import Client

import scripts.monia_video_engine as engine

SPACE = "Qwen/Qwen3-TTS"
TEXT = "Je viens juste de me poser deux minutes, et toi tu fais quoi ?"
LANGUAGE = "French"
OUTPUT_NAME = "lucas-voice-v12-soft-natural-fr-candidate.wav"

# Candidate-only diagnostic. Lucas's uploaded clips remain the primary reference
# for conversational movement. The approved soft rendering defines the target
# color only through broad non-identifying qualities; no exact real-person clone.
DESCRIPTION = (
    "A distinct synthetic native French young adult male voice, naturally low but never forced downward. "
    "The voice is warm, rounded, close and intimate, with soft chest resonance and gentle low-mid body. "
    "It should feel naturally attractive and relaxed, subtly enveloping but not performed as seductive. "
    "Avoid dryness: consonants are soft, releases are loose, phrase attacks are easy and slightly imperfect. "
    "Speak like a real private conversation at home or on the phone, in one continuous thought. "
    "Link the words naturally and keep the sentence flowing without reset points or presenter diction. "
    "Use only tiny irregular human pitch movements, with restrained melody and a soft low ending. "
    "The question at the end must remain calm and low rather than rising brightly. "
    "Keep a little natural texture and warmth in the voice instead of polished studio smoothness. "
    "No robot cadence, no word-by-word timing, no syllabic rhythm, no hard consonants, no dry midrange, "
    "no announcer voice, no radio polish, no forced bass, no whisper, no growl, no dramatic seduction, "
    "no theatrical pause and no irritated or tense contour."
)


def _resolve_audio(result) -> Path:
    items = result if isinstance(result, (list, tuple)) else [result]
    for item in items:
        if isinstance(item, str):
            p = Path(item)
            if p.exists() and p.stat().st_size > 4096:
                return p
        if isinstance(item, dict):
            raw = item.get("path") or item.get("name")
            if raw:
                p = Path(str(raw))
                if p.exists() and p.stat().st_size > 4096:
                    return p
    raise RuntimeError(f"Qwen returned no usable downloaded audio file: {type(result).__name__}")


def soften_color(source: Path, target: Path) -> None:
    # Tone-color refinement only. Preserve timing and pitch exactly.
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(source), "-vn", "-ac", "1", "-ar", "24000",
        "-af",
        "highpass=f=55,"
        "equalizer=f=175:t=q:w=0.9:g=1.4,"
        "equalizer=f=340:t=q:w=1.0:g=0.7,"
        "equalizer=f=3000:t=q:w=1.0:g=-1.2,"
        "equalizer=f=5000:t=q:w=1.1:g=-0.8,"
        "acompressor=threshold=-21dB:ratio=1.22:attack=28:release=190:makeup=1.0,"
        "loudnorm=I=-18:TP=-2:LRA=10",
        str(target),
    ], check=True, timeout=90)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Lucas V12 color refinement failed")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate one candidate-only soft-natural French Lucas voice test")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(TEXT, LANGUAGE, DESCRIPTION, api_name="/generate_voice_design")
    source = _resolve_audio(result)

    raw = engine.WORK_DIR / "lucas-voice-v12-soft-natural-fr-raw.wav"
    target = engine.WORK_DIR / OUTPUT_NAME
    raw.unlink(missing_ok=True)
    target.unlink(missing_ok=True)
    shutil.copyfile(source, raw)
    soften_color(raw, target)

    print(f"MONIA_LUCAS_V12_SOFT_NATURAL_FR output={target} bytes={target.stat().st_size}")
    print("MONIA_LUCAS_V12_SOFT_NATURAL_FR candidate_only=true timing_changed=false pitch_changed=false live_manifest_changed=false")
    if args.publish_candidate:
        url = engine.publish_candidate(target)
        print(f"MONIA_LUCAS_V12_SOFT_NATURAL_FR_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
