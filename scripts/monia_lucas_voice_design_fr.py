from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path

from gradio_client import Client

import scripts.monia_video_engine as engine

SPACE = "Qwen/Qwen3-TTS"
TEXT = "Salut, ça va toi ? Qu'est-ce que tu racontes ?"
LANGUAGE = "French"

VARIANTS = {
    "a": (
        "A native French adult male voice, warm and velvety, naturally masculine without forcing a deep pitch. "
        "Soft rounded timbre, intimate everyday conversational delivery, subtle smile in the voice, relaxed confidence, "
        "gentle attacks, connected words, fluid French phrasing, small natural irregularities and breath. "
        "Keep the sentence melody level and conversational: do not make the pitch fall heavily at the end of phrases. "
        "No radio voice, no announcer tone, no theatrical acting, no robotic cadence, no over-articulation, no foreign accent."
    ),
    "b": (
        "A native French adult male voice with a smooth, slightly husky warm timbre, soft and sensual but understated. "
        "He sounds close, calm, alive and gently amused, as if speaking privately to someone he likes. "
        "Natural linked syllables, fluid everyday French, relaxed rhythm, soft consonants, a faint smile, subtle breathiness. "
        "Do not lower the voice artificially and do not create a descending sing-song ending. Keep intonation supple and natural. "
        "No TTS rhythm, no clipped syllables, no presenter voice, no foreign accent."
    ),
    "c": (
        "A native French adult male voice, warm, round, suave and emotionally present, with a medium-low natural register "
        "but not a deliberately deep voice. The tone is soft, intimate and reassuring, with expressive eyes-in-the-voice energy, "
        "tiny smiles and natural conversational variation. Speak fluent contemporary French in one flowing thought, with connected words "
        "and imperfect human timing. Avoid downward phrase endings, avoid dramatic emphasis, avoid dryness and staccato delivery. "
        "No announcer, no radio host, no synthetic cadence, no foreign accent."
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
            # Gradio may materialize audio outputs as a temp file elsewhere;
            # the client normally downloads those as file paths, so tuples here
            # are intentionally ignored rather than guessed.
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
    target = engine.WORK_DIR / f"lucas-voice-v7-design-fr-{key}-candidate.wav"
    shutil.copyfile(source, target)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Candidate {key} is too small")
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate native French Lucas voice-design candidates")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SPACE, token=token, verbose=False, download_files=True)

    for key, description in VARIANTS.items():
        target = generate_variant(client, key, description)
        print(f"MONIA_LUCAS_DESIGN_FR variant={key} output={target} bytes={target.stat().st_size}")
        if args.publish_candidate:
            url = engine.publish_candidate(target)
            print(f"MONIA_LUCAS_DESIGN_FR_CANDIDATE variant={key} url={url}")


if __name__ == "__main__":
    main()
