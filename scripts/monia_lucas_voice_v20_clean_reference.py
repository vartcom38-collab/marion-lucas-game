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
TEXT = "Ah ouais, ça me fait plaisir que tu m'appelles juste pour ça."

# V20 intentionally starts fresh from broad user-approved qualities found in the
# Lucas reference videos: clear close-mic presence, warmth without muffling,
# youthful natural texture, connected French phrasing, tiny irregular pauses,
# and a relaxed private-call delivery. It does NOT clone any real person's voice.
# It also does NOT use V16/V17/V18/V19 as a timbre target.

COMMON = (
    "Native French young adult male voice for a private phone call. Speak in one connected, fluid thought, "
    "with natural French linking, tiny irregular human micro-pauses only when needed, relaxed breathing, "
    "and a soft natural ending. The voice must be clean and immediately intelligible, close to the microphone, "
    "warm but not dark, youthful, spontaneous and human. Keep consonants clear without presenter diction. "
    "Avoid robotic cadence, syllable-by-syllable timing, long pauses, synthetic sheen, muffled tone, boomy bass, "
    "whispering, theatrical acting, radio-announcer delivery, perfume-ad sensuality or over-polished studio sound. "
)

VARIANTS = {
    "a": COMMON + (
        "Use a clear warm timbre with a light natural chest resonance, open midrange, crisp but soft articulation, "
        "very little rasp, and relaxed conversational energy. Prioritize clarity and effortless flow."
    ),
    "b": COMMON + (
        "Use a clear warm timbre with a subtle dry/husky texture in the midrange, slightly more character than A, "
        "but keep the top end clean and present. No haze, no breathy veil, no forced depth."
    ),
    "c": COMMON + (
        "Use a clear lively timbre with a little more natural brightness and youthful presence, still warm and intimate, "
        "with slightly more expressive micro-variation in pitch and rhythm while remaining calm and believable."
    ),
}


def resolve_audio(result) -> Path:
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


def clean_finish(source: Path, target: Path) -> None:
    target.unlink(missing_ok=True)
    # Deliberately avoid the darker V16/V19 EQ curve. Keep only cleanup and
    # transparent level control so the generated timbre remains clear and present.
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(source), "-ac", "1", "-ar", "24000",
        "-af", "highpass=f=55,acompressor=threshold=-22dB:ratio=1.10:attack=20:release=150,loudnorm=I=-18:TP=-2:LRA=10",
        str(target),
    ], check=True, timeout=90)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError(f"V20 candidate too small: {target}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate three clean fresh synthetic Lucas-style French voice candidates")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SPACE, token=token, verbose=False, download_files=True)

    for key, description in VARIANTS.items():
        result = client.predict(TEXT, LANGUAGE, description, api_name="/generate_voice_design")
        generated = resolve_audio(result)
        raw = engine.WORK_DIR / f"lucas-v20-{key}-raw.wav"
        target = engine.WORK_DIR / f"lucas-voice-v20-{key}-clean-natural-fr-candidate.wav"
        shutil.copyfile(generated, raw)
        clean_finish(raw, target)
        raw.unlink(missing_ok=True)
        print(f"MONIA_LUCAS_V20 variant={key} output={target} bytes={target.stat().st_size}")
        if args.publish_candidate:
            url = engine.publish_candidate(target)
            print(f"MONIA_LUCAS_V20_CANDIDATE variant={key} url={url}")


if __name__ == "__main__":
    main()
