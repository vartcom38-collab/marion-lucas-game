from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path

from gradio_client import Client

import scripts.monia_video_engine as engine

QWEN_SPACE = "Qwen/Qwen3-TTS"
OUTPUT_NAME = "lucas-voice-anchor-v3-measured-video-style-fr-candidate.wav"
TEXT = (
    "Salut, ça va toi ? Je viens de me poser deux minutes. "
    "Journée un peu longue, mais tranquille. Ça me fait plaisir de t'entendre."
)

# Built from acoustic analysis of the user-provided reference video.
# The real-person recording is NOT used as a cloning target. We only transfer broad,
# non-identifying performance traits into a new synthetic French character voice.
# Measured reference traits: very low male fundamental around ~84 Hz median on voiced frames,
# strong upper-mid presence, close/direct delivery, connected speech, low darkness despite low pitch.
DESCRIPTION = (
    "Native French young adult male voice, low natural fundamental around the low-80-Hz region, "
    "but do NOT make the voice dark, boomy, old, heavy or artificially deep. The key contrast is: "
    "low pitch with clear upper-mid presence and a close, direct, crisp microphone sound. "
    "Dense chest resonance, compact vocal tract impression, slightly rough natural texture, "
    "small amount of huskiness, but clean intelligibility and no muffled veil. "
    "Private conversational delivery, relaxed and spontaneous, with a little masculine edge and life. "
    "French speech must flow continuously across word boundaries with natural linking, no clause resets, "
    "no presenter cadence, no slow dramatic pauses, no over-articulation. Use short irregular breaths, "
    "subtle pitch movement, soft natural endings and quick connected phrasing. Consonants stay relaxed but "
    "present; vowels stay open and natural rather than rounded or theatrical. Avoid nasal brightness, radio-announcer "
    "polish, whispering, vocal-fry exaggeration, metronomic rhythm, robotic syllable separation, or sentimental acting. "
    "The result should feel like a real young man speaking close to a phone microphone: low, clear, textured, alive, "
    "and effortless."
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
    parser = argparse.ArgumentParser(description="Generate one measured synthetic Lucas V3 anchor candidate")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(QWEN_SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(TEXT, "French", DESCRIPTION, api_name="/generate_voice_design")
    source = resolve_audio(result)

    output = engine.WORK_DIR / OUTPUT_NAME
    shutil.copyfile(source, output)
    if not output.exists() or output.stat().st_size < 4096:
        raise RuntimeError("Lucas anchor V3 candidate is too small")

    print(f"MONIA_LUCAS_ANCHOR_V3 output={output} bytes={output.stat().st_size} text={TEXT!r}")
    if args.publish_candidate:
        url = engine.publish_candidate(output)
        print(f"MONIA_LUCAS_ANCHOR_V3_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
