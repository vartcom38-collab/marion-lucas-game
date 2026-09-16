from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from pathlib import Path

from gradio_client import Client

import scripts.monia_video_engine as engine

SPACE = "Qwen/Qwen3-TTS"
LANGUAGE = "French"
TEXT = "Je viens de me poser deux minutes, et toi, tu fais quoi ?"
OUTPUT_NAME = "lucas-voice-v15-b-fluid-fr-candidate.wav"

# V15 recombines two user-preferred checkpoints without voice conversion:
# - V14-B broad synthetic timbre qualities: close, warm, compact, intimate,
#   slightly husky, low-mid body, relaxed consonants, natural imperfect edges.
# - V12 delivery concept: connected conversational French with almost no dead air.
# This remains a distinct synthetic Lucas voice. No real-person voice cloning,
# no timing warp, no pitch forcing, no word/syllable stitching.
DESCRIPTION = (
    "A distinct synthetic native French young adult male voice with the same broad qualities as the preferred B calibration: "
    "low, warm and very close, compact intimate timbre, soft slightly husky texture, smooth low-mid resonance, relaxed consonants, "
    "natural imperfect edges and very little brightness. Present and personal rather than polished; calm, affectionate and effortless. "
    "Now speak the full sentence as one continuous private conversation, not as separate clauses. Keep the words linked naturally, "
    "with almost no dead air and no reset after 'minutes'. The comma is only a tiny breath-sized transition, then continue immediately into 'et toi'. "
    "Use restrained natural pitch movement, soft attacks and a relaxed low ending. Preserve human micro-variation without becoming theatrical. "
    "No radio voice, no presenter diction, no perfume-ad seduction, no forced bass, no whisper, no metallic brightness, no synthetic sheen, "
    "no syllabic cadence, no word-by-word rhythm, no choppy pauses, no robotic timing."
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
    raise RuntimeError(f"Qwen returned no usable audio: {type(result).__name__}")


def finish_tone(source: Path, target: Path) -> None:
    # Keep the B-like soft/close color with only light spectral cleanup.
    # No tempo change and no pitch manipulation.
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(source), "-ac", "1", "-ar", "24000",
        "-af",
        "highpass=f=55,equalizer=f=190:t=q:w=1:g=0.8,equalizer=f=350:t=q:w=1:g=0.4,equalizer=f=3200:t=q:w=1:g=-0.7,equalizer=f=5200:t=q:w=1:g=-0.4,acompressor=threshold=-21dB:ratio=1.15:attack=18:release=140,loudnorm=I=-18:TP=-2:LRA=9",
        str(target),
    ], check=True, timeout=90)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError(f"V15 candidate too small: {target}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate one Lucas V15 B-timbre + fluid French candidate")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(TEXT, LANGUAGE, DESCRIPTION, api_name="/generate_voice_design")
    generated = _resolve_audio(result)

    raw = engine.WORK_DIR / "lucas-v15-b-fluid-fr-raw.wav"
    target = engine.WORK_DIR / OUTPUT_NAME
    shutil.copyfile(generated, raw)
    target.unlink(missing_ok=True)
    finish_tone(raw, target)
    raw.unlink(missing_ok=True)

    print(f"MONIA_LUCAS_V15_B_FLUID_FR output={target} bytes={target.stat().st_size}")
    print("MONIA_LUCAS_V15_B_FLUID_FR timbre_direction=V14-B flow_direction=V12 direct_generation=true live_manifest_changed=false")
    if args.publish_candidate:
        url = engine.publish_candidate(target)
        print(f"MONIA_LUCAS_V15_B_FLUID_FR_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
