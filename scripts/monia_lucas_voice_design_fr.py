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
TEXT = "Je viens de me poser deux minutes et toi tu fais quoi ?"
OUTPUT_NAME = "lucas-voice-v16-b-smoother-flow-fr-candidate.wav"

# V16 preserves the V15/V14-B synthetic timbre direction and changes only flow.
# The punctuation is deliberately reduced so the whole line is produced as one
# connected conversational thought group, especially across "deux minutes et toi".
# No voice conversion, no speed/pitch manipulation, no word/syllable stitching.
DESCRIPTION = (
    "Use exactly the same synthetic vocal direction as the approved V15 checkpoint: "
    "a native French young adult male voice that is naturally low, warm, very close and intimate, "
    "with a compact timbre, soft slightly husky texture, smooth low-mid resonance, relaxed consonants, "
    "natural imperfect edges, very little brightness, calm affectionate effortless energy. "
    "Do not reinterpret the voice or make it deeper, brighter, cleaner, more polished or more theatrical. "
    "For this pass, improve only continuity: say the entire sentence as one connected conversational thought, "
    "with natural French linking and no clause reset after 'deux minutes'. Flow directly through 'et toi tu fais quoi' "
    "with only a tiny natural breath if absolutely needed, never dead air. Keep a human irregular micro-rhythm rather than a metronomic cadence. "
    "Use restrained pitch movement, soft attacks and a relaxed low ending. "
    "No radio voice, no presenter diction, no perfume-ad sensuality, no forced bass, no whisper, no metallic brightness, "
    "no synthetic sheen, no syllabic cadence, no word-by-word rhythm, no choppy pauses, no robotic timing."
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
    # Keep the exact V15 tone-shaping chain. Flow is the only variable under test.
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(source), "-ac", "1", "-ar", "24000",
        "-af",
        "highpass=f=55,equalizer=f=190:t=q:w=1:g=0.8,equalizer=f=350:t=q:w=1:g=0.4,equalizer=f=3200:t=q:w=1:g=-0.7,equalizer=f=5200:t=q:w=1:g=-0.4,acompressor=threshold=-21dB:ratio=1.15:attack=18:release=140,loudnorm=I=-18:TP=-2:LRA=9",
        str(target),
    ], check=True, timeout=90)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError(f"V16 candidate too small: {target}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate one Lucas V16 V15-tone + smoother-flow French candidate")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(TEXT, LANGUAGE, DESCRIPTION, api_name="/generate_voice_design")
    generated = _resolve_audio(result)

    raw = engine.WORK_DIR / "lucas-v16-b-smoother-flow-fr-raw.wav"
    target = engine.WORK_DIR / OUTPUT_NAME
    shutil.copyfile(generated, raw)
    target.unlink(missing_ok=True)
    finish_tone(raw, target)
    raw.unlink(missing_ok=True)

    print(f"MONIA_LUCAS_V16_SMOOTHER_FLOW_FR output={target} bytes={target.stat().st_size}")
    print("MONIA_LUCAS_V16_SMOOTHER_FLOW_FR timbre_direction=V15_locked flow_change=linking_only direct_generation=true live_manifest_changed=false")
    if args.publish_candidate:
        url = engine.publish_candidate(target)
        print(f"MONIA_LUCAS_V16_SMOOTHER_FLOW_FR_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
