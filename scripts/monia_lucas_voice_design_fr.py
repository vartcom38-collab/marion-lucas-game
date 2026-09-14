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

VARIANTS = {
    "a": (
        "A native French adult male voice with strong natural seductive presence: calm, grounded, warm and velvety. "
        "He speaks a little slower than average, never dragging, with complete ease and quiet self-confidence. "
        "Medium-low natural register, rounded chest resonance, soft attacks, connected words and relaxed contemporary French. "
        "There is a subtle smile behind the words and a slight intimate breathiness, as if he is speaking privately to a woman he is very attracted to. "
        "He never sounds eager to please; he sounds composed, magnetic and effortlessly desirable. "
        "Use small pauses that feel intentional rather than hesitant. Keep the melodic line supple and sensual, not flat and not heavily descending. "
        "No radio voice, no perfume-commercial acting, no exaggerated deep voice, no theatrical seduction, no TTS rhythm, no foreign accent."
    ),
    "b": (
        "A native French adult male voice, low-warm and slightly husky, with a very smooth seductive character. "
        "His energy is slow, controlled and self-assured, like a man who knows exactly the effect of his voice and does not need to force it. "
        "Let the words flow together naturally, with soft consonants, restrained breath, a tiny amused smile and occasional micro-pauses. "
        "The voice should feel physically close and intimate without whispering, with a subtle sensual roughness on some phrase endings. "
        "Keep French pronunciation fully native and effortless. Avoid clipped rhythm, upward question-song, heavy phrase drops, over-articulation or presenter diction. "
        "No caricatured lover voice, no announcer, no foreign accent, no synthetic cadence."
    ),
    "c": (
        "A native French adult male voice with quiet masculine charisma, warm, round, intimate and deeply composed. "
        "He speaks as if he is leaning slightly closer during a private video call: relaxed, attentive, gently provocative without trying too hard. "
        "Use a naturally lower placement, soft breath support, a velvety timbre and very fluid connected phrasing. "
        "The rhythm is unhurried and confident, with tiny human hesitations, controlled silences and a smile you can hear. "
        "The seductive quality must come from confidence, warmth and restraint, not from theatrical emphasis. "
        "Keep intonation alive and sensual, with subtle variation instead of monotony or strong downward endings. "
        "No radio host, no commercial seduction, no forced bass, no robotic timing, no foreign accent."
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
    target = engine.WORK_DIR / f"lucas-voice-v8-seductive-fr-{key}-candidate.wav"
    shutil.copyfile(source, target)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Candidate {key} is too small")
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate seductive native French Lucas voice candidates")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SPACE, token=token, verbose=False, download_files=True)

    for key, description in VARIANTS.items():
        target = generate_variant(client, key, description)
        print(f"MONIA_LUCAS_SEDUCTIVE_FR variant={key} output={target} bytes={target.stat().st_size}")
        if args.publish_candidate:
            url = engine.publish_candidate(target)
            print(f"MONIA_LUCAS_SEDUCTIVE_FR_CANDIDATE variant={key} url={url}")


if __name__ == "__main__":
    main()
