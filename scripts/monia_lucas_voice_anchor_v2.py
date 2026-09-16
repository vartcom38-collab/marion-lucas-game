from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path

from gradio_client import Client

import scripts.monia_video_engine as engine

QWEN_SPACE = "Qwen/Qwen3-TTS"
OUTPUT_NAME = "lucas-voice-anchor-v2-video-style-fr-candidate.wav"
TEXT = (
    "Salut, ça va toi ? Je viens de me poser deux minutes. "
    "Journée un peu longue, mais tranquille. Ça me fait plaisir de t'entendre."
)

# New synthetic Lucas character voice.
# The uploaded 2026-09-16 clip is used only as a broad STYLE/PERFORMANCE reference:
# clarity, forward presence, youthful energy, natural grain, connected rhythm, light breath.
# Never use uploaded real-person media as a biometric cloning target.
DESCRIPTION = (
    "Native French young adult male in his early twenties. The voice must be clean, forward, present and close to the microphone, "
    "with a youthful masculine tone and a light natural rasp/texture. Keep the timbre open and clear, not dark, not boomy, not muffled, "
    "not breathy and not artificially deep. It should feel immediate and alive, as if speaking casually into a phone at close range. "
    "Use relaxed confidence and spontaneous conversational energy. Do not sound polished like a narrator or advertisement. "
    "Keep a naturally connected French flow: link words together, avoid restarting at punctuation, and let the sentence move continuously. "
    "Use short irregular breaths and tiny human hesitations only when natural; no long pauses, no robotic spacing, no syllable-by-syllable delivery. "
    "Consonants should be crisp enough to feel sharp and intelligible, especially in the upper mids, but still casual and relaxed. "
    "Vowels should stay natural and compact, never over-rounded or theatrical. Add subtle pitch movement and small dynamic changes so the voice feels human. "
    "The overall impression should be: young, clear, slightly textured, intimate phone-call proximity, spontaneous, natural, fluid, and distinctly non-AI. "
    "Avoid whispering, excessive softness, vocal-fry exaggeration, nasal tone, radio-host tone, dramatic acting, seductive performance, or studio-announcer polish."
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
    parser = argparse.ArgumentParser(description="Generate one fixed Lucas synthetic anchor from the approved vocal style direction")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(QWEN_SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(TEXT, "French", DESCRIPTION, api_name="/generate_voice_design")
    source = resolve_audio(result)

    output = engine.WORK_DIR / OUTPUT_NAME
    shutil.copyfile(source, output)
    if not output.exists() or output.stat().st_size < 4096:
        raise RuntimeError("Lucas anchor V2 candidate is too small")

    print(f"MONIA_LUCAS_ANCHOR_V2 output={output} bytes={output.stat().st_size} text={TEXT!r}")
    if args.publish_candidate:
        url = engine.publish_candidate(output)
        print(f"MONIA_LUCAS_ANCHOR_V2_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
