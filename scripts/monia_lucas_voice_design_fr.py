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
TEXT = "Oui, je suis là."

# V14 is a TIMBRE-ONLY listening test.
# It is intentionally short so the user can judge vocal colour without confusing
# that decision with long-form French prosody. These are distinct synthetic voices
# built only from broad approved Lucas qualities; they are not real-person clones.
VARIANTS = {
    "a-round": (
        "A distinct synthetic native French young adult male voice. Naturally low but not forced deep. "
        "Very warm and rounded in the low-mid range, close and intimate, soft chest resonance, relaxed mouth shape, "
        "gentle consonants, almost no brightness, no dryness. Human and understated, like speaking quietly at home. "
        "No radio announcer, no perfume-ad seduction, no whisper, no growl, no smiley presenter tone, no robotic polish."
    ),
    "b-close": (
        "A distinct synthetic native French young adult male voice. Low, warm and very close, with a compact intimate timbre, "
        "soft slightly husky texture, smooth low-mid resonance, relaxed consonants and natural imperfect edges. "
        "The voice should feel present and personal rather than polished. Calm, affectionate, effortless. "
        "No forced bass, no radio voice, no theatrical sensuality, no whisper, no metallic brightness, no synthetic sheen."
    ),
    "c-textured": (
        "A distinct synthetic native French young adult male voice. Naturally low, warm and calm with a subtle textured grain, "
        "rounded chest resonance, softened attacks, slightly matte top end and relaxed articulation. "
        "Keep a small amount of human roughness so it does not sound studio-perfect, but never dry or raspy. "
        "Intimate everyday presence, not performed. No presenter tone, no trailer bass, no whisper, no growl, no robotic smoothness."
    ),
}


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
    # Very light spectral cleanup only. No tempo or pitch change.
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(source), "-ac", "1", "-ar", "24000",
        "-af",
        "highpass=f=55,equalizer=f=190:t=q:w=1:g=0.8,equalizer=f=350:t=q:w=1:g=0.4,equalizer=f=3200:t=q:w=1:g=-0.7,equalizer=f=5200:t=q:w=1:g=-0.4,acompressor=threshold=-21dB:ratio=1.15:attack=18:release=140,loudnorm=I=-18:TP=-2:LRA=9",
        str(target),
    ], check=True, timeout=90)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError(f"Micro-candidate too small: {target}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate three short Lucas timbre-only micro-candidates")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SPACE, token=token, verbose=False, download_files=True)

    for key, description in VARIANTS.items():
        result = client.predict(TEXT, LANGUAGE, description, api_name="/generate_voice_design")
        generated = _resolve_audio(result)
        raw = engine.WORK_DIR / f"lucas-v14-{key}-raw.wav"
        target = engine.WORK_DIR / f"lucas-voice-v14-{key}-timbre-candidate.wav"
        shutil.copyfile(generated, raw)
        target.unlink(missing_ok=True)
        finish_tone(raw, target)
        raw.unlink(missing_ok=True)

        print(f"MONIA_LUCAS_V14_TIMBRE variant={key} output={target} bytes={target.stat().st_size}")
        print("MONIA_LUCAS_V14_TIMBRE scope=timbre-only flow_not_under_test=true live_manifest_changed=false")
        if args.publish_candidate:
            url = engine.publish_candidate(target)
            print(f"MONIA_LUCAS_V14_TIMBRE_CANDIDATE variant={key} url={url}")


if __name__ == "__main__":
    main()
