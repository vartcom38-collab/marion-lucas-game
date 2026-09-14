from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path

from gradio_client import Client

import scripts.monia_video_engine as engine

SPACE = "Qwen/Qwen3-TTS"
TEXT = "Salut... ça va, toi ? Qu'est-ce que tu racontes ?"
LANGUAGE = "French"

# V9 refines V8-A from the user's uploaded drama excerpts. The target is not
# an exact clone of any performer: we use only broad acoustic/performance traits
# observed in the reference — lower natural placement, restrained melody,
# deliberate pauses, chest resonance, slight roughness and quiet authority.
VARIANTS = {
    "a": (
        "A native French adult male voice with a naturally low baritone placement, dark warm chest resonance and a subtle rough edge. "
        "He is extremely calm and grounded, speaking a little slower than average with deliberate micro-pauses and almost no nervous melodic movement. "
        "The seductive effect comes from restraint and quiet authority: he sounds self-contained, masculine and magnetic, never eager and never performative. "
        "Keep attacks soft but not breathy, consonants relaxed, words strongly connected and the tone dense rather than bright. "
        "Use a narrow, controlled intonation range with small human variations; do not sing the question and do not drop every ending dramatically. "
        "No smiling radio voice, no perfume-ad seduction, no forced bass, no whispering, no theatrical growl, no TTS cadence and no foreign accent."
    ),
    "b": (
        "A native French adult male voice, low, warm, slightly rough and physically present, with strong chest resonance and a dry velvet texture. "
        "He speaks with slow confidence and measured silences, like a man who never rushes to fill space. "
        "Keep the voice emotionally contained but subtly charged, with a faint intimate warmth underneath a cool, controlled surface. "
        "The rhythm should feel effortless and masculine, with connected contemporary French, soft consonants and very little pitch flutter. "
        "Avoid playful brightness, obvious smiling, exaggerated sensual breathing, presenter diction, forced gravel, heavy downward endings, robotic timing or a foreign accent."
    ),
    "c": (
        "A native French adult male voice with quiet dangerous charisma: naturally low, chesty, warm and lightly husky, never artificially deep. "
        "He speaks close and calmly, with intentional pauses, restrained breath and a compact melodic range. "
        "His delivery should feel controlled, slightly aloof and deeply attentive at the same time, creating tension without trying to sound seductive. "
        "Use a dark rounded timbre, gentle phrase onsets, linked syllables and tiny irregularities that make the voice human. "
        "Keep sentence endings composed rather than theatrical, and keep questions level and intimate instead of rising brightly. "
        "No lover caricature, no radio host, no breathy whisper, no forced growl, no synthetic cadence and no foreign accent."
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
        if isinstance(item, (list, tuple)) and len(item) == 2:
            continue
    raise RuntimeError(f"Qwen returned no usable downloaded audio file: {type(result).__name__}")


def generate_variant(client: Client, key: str, description: str) -> Path:
    result = client.predict(
        TEXT,
        LANGUAGE,
        description,
        api_name="/generate_voice_design",
    )
    source = _resolve_audio(result)
    target = engine.WORK_DIR / f"lucas-voice-v9-reference-tuned-fr-{key}-candidate.wav"
    shutil.copyfile(source, target)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Candidate {key} is too small")
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate reference-tuned native French Lucas voice candidates")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SPACE, token=token, verbose=False, download_files=True)

    for key, description in VARIANTS.items():
        target = generate_variant(client, key, description)
        print(f"MONIA_LUCAS_REFERENCE_TUNED_FR variant={key} output={target} bytes={target.stat().st_size}")
        if args.publish_candidate:
            url = engine.publish_candidate(target)
            print(f"MONIA_LUCAS_REFERENCE_TUNED_FR_CANDIDATE variant={key} url={url}")


if __name__ == "__main__":
    main()
