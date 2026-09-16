from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path

from gradio_client import Client

import scripts.monia_video_engine as engine

QWEN_SPACE = "Qwen/Qwen3-TTS"
OUTPUT_NAME = "lucas-voice-anchor-v1-candidate.wav"
TEXT = (
    "Salut, ça va toi ? Je viens de me poser deux minutes. "
    "Journée un peu longue, mais tranquille. Ça me fait plaisir de t'entendre."
)

# This is a NEW synthetic character voice. Uploaded Lucas clips are used only for broad
# performance qualities: conversational rhythm, presence, breath, energy, relaxed delivery.
# Never use them as biometric cloning targets.
DESCRIPTION = (
    "Native French young adult male, around early twenties. Clear, present and close-mic voice, "
    "warm without sounding muffled, dark or artificially deep. Slight natural texture and a touch "
    "of huskiness, but the voice must stay clean, intelligible and alive. Conversational private-phone "
    "energy, relaxed confidence, affectionate but ordinary, never theatrical, seductive, commercial "
    "or narrator-like. Speak in one naturally connected French flow with real linking between words. "
    "Use tiny irregular human micro-pauses, light breaths, subtle pitch movement and imperfect timing. "
    "Consonants should be clear but relaxed; vowels natural and not over-rounded. No robotic syllable "
    "separation, no clause-by-clause resets, no metronomic rhythm, no vocal fry exaggeration, no whisper, "
    "no nasal cartoon tone, no studio-announcer polish. Keep endings soft and natural, with enough upper-mid "
    "presence to sound crisp and close rather than veiled."
)


def resolve_audio(result) -> Path:
    items = result if isinstance(result, (list, tuple)) else [result]
    for item in reversed(items):
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
    raise RuntimeError(f"No usable audio returned: {type(result).__name__}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate one fixed synthetic Lucas voice anchor candidate")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(QWEN_SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(TEXT, "French", DESCRIPTION, api_name="/generate_voice_design")
    source = resolve_audio(result)

    output = engine.WORK_DIR / OUTPUT_NAME
    shutil.copyfile(source, output)
    if not output.exists() or output.stat().st_size < 4096:
        raise RuntimeError("Lucas anchor candidate is too small")

    print(f"MONIA_LUCAS_ANCHOR_V1 output={output} bytes={output.stat().st_size} text={TEXT!r}")
    if args.publish_candidate:
        url = engine.publish_candidate(output)
        print(f"MONIA_LUCAS_ANCHOR_V1_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
