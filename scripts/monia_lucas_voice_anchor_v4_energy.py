from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path

from gradio_client import Client

import scripts.monia_video_engine as engine

QWEN_SPACE = "Qwen/Qwen3-TTS"
OUTPUT_NAME = "lucas-voice-anchor-v4-energy-fr-candidate.wav"
TEXT = (
    "Salut, ça va toi ? Je viens de me poser deux minutes. "
    "Journée un peu longue, mais tranquille. Ça me fait plaisir de t'entendre."
)

# Synthetic Lucas candidate. The uploaded real-person video informs broad acoustic/performance
# characteristics only; it is never used as a biometric cloning target.
# Goal versus V3: preserve low, clear, compact profile but remove softness/slowness.
DESCRIPTION = (
    "Native French young adult male voice. Keep a naturally low male register, compact and dense, "
    "with strong upper-mid presence so it stays crisp and close instead of dark or muffled. Slight rough "
    "texture, small natural huskiness, but clean intelligibility. IMPORTANT: delivery must be alert, quick, "
    "direct and lively. Do not sound sleepy, soft, tender, slow, dreamy, intimate, sentimental or cinematic. "
    "Start phrases immediately with a firm natural attack. Keep the sentence moving with short connected groups, "
    "minimal dead air, fast French linking and energetic consonant onsets. Use ordinary spontaneous phone-call energy, "
    "as if a young man is talking naturally and reacting in real time. Let pitch and intensity move more from phrase to "
    "phrase; avoid flat calm delivery. Endings should stay natural but not fade away weakly. Keep breaths short and unobtrusive. "
    "No narrator cadence, no radio polish, no over-articulation, no long dramatic pauses, no whisper, no vocal-fry exaggeration, "
    "no metronomic rhythm, no robotic syllable separation. Overall: low, clear, compact, masculine, brisk, responsive, alive."
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
    parser = argparse.ArgumentParser(description="Generate one energetic synthetic Lucas V4 anchor candidate")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(QWEN_SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(TEXT, "French", DESCRIPTION, api_name="/generate_voice_design")
    source = resolve_audio(result)

    output = engine.WORK_DIR / OUTPUT_NAME
    shutil.copyfile(source, output)
    if not output.exists() or output.stat().st_size < 4096:
        raise RuntimeError("Lucas anchor V4 candidate is too small")

    print(f"MONIA_LUCAS_ANCHOR_V4 output={output} bytes={output.stat().st_size} text={TEXT!r}")
    if args.publish_candidate:
        url = engine.publish_candidate(output)
        print(f"MONIA_LUCAS_ANCHOR_V4_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
