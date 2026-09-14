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

# V10 keeps V9-A as the creative base and refines it using only broad,
# non-identifying performance traits observed in the user's uploaded drama
# excerpts: dark low-mid resonance, restrained melody, minimal breathiness,
# relaxed articulation, slight dry grain, deliberate pacing and quiet authority.
VARIANTS = {
    "a": (
        "A native French adult male voice with dark low-mid resonance, naturally masculine and compact rather than exaggeratedly deep. "
        "The timbre is dense, slightly dry and lightly rough at the edges, with very little breathiness. "
        "He speaks slowly but never lazily, with deliberate micro-pauses, relaxed articulation and connected contemporary French. "
        "The seductive quality comes from composure and restraint: he sounds calm, self-contained, faintly insolent and completely at ease. "
        "Keep the pitch range narrow and controlled, with tiny natural movements only. Let some word endings feel slightly unfinished or casually released instead of perfectly polished. "
        "Use soft, unhurried phrase attacks, subtle chest resonance and a low-key intimate presence. "
        "No smiling presenter tone, no velvety perfume-ad acting, no forced bass, no whispering, no theatrical growl, no bright question melody, no robotic cadence and no foreign accent."
    ),
    "b": (
        "A native French adult male voice, dark, close and grounded, centered in the low-mid register with firm chest resonance and a faint dry rasp. "
        "The delivery is extremely controlled and economical: few melodic gestures, no unnecessary emphasis, no eagerness. "
        "Articulation is slightly relaxed and natural, with softened consonants, linked words, tiny swallowed transitions and calm intentional silences. "
        "He should sound like someone who does not need to perform confidence because it is already there. The attraction comes from stillness, gravity and understated tension. "
        "Keep the voice almost matter-of-fact while preserving intimate warmth underneath. Sentence endings should be composed, occasionally a little clipped or casually dropped, never theatrically descending. "
        "No radio warmth, no overt lover voice, no breathy seduction, no exaggerated gravel, no polished TTS diction, no sing-song intonation and no foreign accent."
    ),
    "c": (
        "A native French adult male voice with quiet magnetic authority, a dark compact timbre, low-mid chest placement and a slight textured grain. "
        "He speaks with restrained energy, minimal breath, very steady pacing and controlled pauses that create tension without acting seductive. "
        "The articulation is a touch lazy in a natural way: smooth links, softened releases, occasional imperfect phrase endings, and no over-pronounced consonants. "
        "Keep him emotionally contained but attentive, with a subtle undertone of challenge and intimacy. Use only small pitch inflections and keep questions low-key and almost level. "
        "The overall effect should be masculine, self-possessed and difficult to ignore, not polished, sweet or theatrical. "
        "No forced deep voice, no whisper, no growl performance, no presenter polish, no bright smiling tone, no robotic timing and no foreign accent."
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
    target = engine.WORK_DIR / f"lucas-voice-v10-drama-tuned-fr-{key}-candidate.wav"
    shutil.copyfile(source, target)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Candidate {key} is too small")
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate drama-tuned native French Lucas voice candidates")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SPACE, token=token, verbose=False, download_files=True)

    for key, description in VARIANTS.items():
        target = generate_variant(client, key, description)
        print(f"MONIA_LUCAS_DRAMA_TUNED_FR variant={key} output={target} bytes={target.stat().st_size}")
        if args.publish_candidate:
            url = engine.publish_candidate(target)
            print(f"MONIA_LUCAS_DRAMA_TUNED_FR_CANDIDATE variant={key} url={url}")


if __name__ == "__main__":
    main()
