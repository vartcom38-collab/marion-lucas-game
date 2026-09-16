from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path

from gradio_client import Client

import scripts.monia_video_engine as engine

SPACE = "Qwen/Qwen3-TTS"
TEXT = "Je viens de me poser deux minutes... et toi, tu fais quoi ?"
LANGUAGE = "French"
OUTPUT_NAME = "lucas-voice-v11-soft-flow-fr-candidate.wav"

# Candidate-only diagnostic. Lucas's uploaded clips are the primary reference for
# conversational movement; the approved soft rendering defines the target color.
# Use only broad non-identifying traits. No exact real-person voice cloning.
DESCRIPTION = (
    "A distinct synthetic native French young adult male voice, naturally low, warm, calm and intimate. "
    "The timbre must feel soft and close, with rounded low-mid resonance, gentle attacks, relaxed consonants, "
    "very little brightness and a slight natural texture without dryness. "
    "Deliver the entire sentence as one connected conversational thought, as in a real private phone or home conversation. "
    "Do not restart between words. Keep words linked inside thought groups, with almost no dead air. "
    "Use only one tiny irregular hesitation before 'et toi', then continue immediately. "
    "Keep pitch movement restrained and natural, with small human variations rather than a flat line. "
    "The final question must stay low and soft instead of rising brightly. Let the last word relax naturally. "
    "The overall energy is affectionate, everyday and unperformed: no annoyance, no tension, no presenter tone, "
    "no dramatic seduction, no forced bass, no whisper, no growl, no theatrical pauses, no textbook diction, "
    "no syllabic cadence, no word-by-word rhythm and no robotic timing."
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate one candidate-only soft-flow French Lucas voice test")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(TEXT, LANGUAGE, DESCRIPTION, api_name="/generate_voice_design")
    source = _resolve_audio(result)

    target = engine.WORK_DIR / OUTPUT_NAME
    target.unlink(missing_ok=True)
    shutil.copyfile(source, target)
    if target.stat().st_size < 4096:
        raise RuntimeError("Lucas V11 soft-flow French candidate is too small")

    print(f"MONIA_LUCAS_V11_SOFT_FLOW_FR output={target} bytes={target.stat().st_size}")
    print("MONIA_LUCAS_V11_SOFT_FLOW_FR candidate_only=true live_manifest_changed=false")
    if args.publish_candidate:
        url = engine.publish_candidate(target)
        print(f"MONIA_LUCAS_V11_SOFT_FLOW_FR_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
