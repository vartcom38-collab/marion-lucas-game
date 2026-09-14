from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path

import requests
from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

QWEN_SPACE = "Qwen/Qwen3-TTS"
SEED_VC_SPACE = "Plachta/Seed-VC"
LANGUAGE = "French"
VOICE_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/lucas-voice-v10-drama-tuned-fr-a-candidate.wav"

VOICE_DESCRIPTION = (
    "A native French adult male voice with dark low-mid resonance, naturally masculine and compact rather than exaggeratedly deep. "
    "Dense, slightly dry timbre with a faint rough grain and very little breathiness. Calm, self-contained, intimate, faintly insolent, "
    "with restrained melody, narrow pitch range, deliberate micro-pauses, relaxed contemporary French articulation and quiet authority. "
    "No presenter tone, no perfume-ad acting, no forced bass, no whispering, no theatrical growl, no bright question melody, no robotic cadence and no foreign accent."
)

LINES = {
    "opening": "Salut... ça va, toi ? Qu'est-ce que tu racontes ?",
    "calm": "Ça va... journée un peu longue, mais tranquille. Et toi, t'as fait quoi ?",
    "warm": "Ah ouais ?... Ça me fait plaisir que tu m'appelles juste pour ça.",
    "busy": "Je viens de me poser deux minutes. J'allais justement souffler un peu.",
    "tease": "Je fais pas le malin. Enfin... pas tant que ça.",
    "miss": "Toi aussi... un peu.",
    "goodbye": "D'accord... on se reparle après."
}


def _download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=120, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Downloaded file too small: {url}")


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
    raise RuntimeError(f"No usable audio returned: {type(result).__name__}")


def _seed_convert(source: Path, target_reference: Path, output: Path, token: str | None) -> None:
    client = Client(SEED_VC_SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(
        source_audio_path=handle_file(source),
        target_audio_path=handle_file(target_reference),
        diffusion_steps=30,
        length_adjust=1.0,
        intelligebility_cfg_rate=0.0,
        similarity_cfg_rate=0.72,
        top_p=0.92,
        temperature=0.72,
        repetition_penalty=1.0,
        convert_style=False,
        anonymization_only=False,
        api_name="/predict",
    )
    converted = _resolve_audio(result)
    shutil.copyfile(converted, output)
    if output.stat().st_size < 4096:
        raise RuntimeError("Seed-VC output too small")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Lucas V10-A voice lines for standalone visio interaction test")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip() or None
    qwen = Client(QWEN_SPACE, token=token, verbose=False, download_files=True)
    reference = engine.WORK_DIR / "lucas-v10a-reference.wav"
    _download(VOICE_URL, reference)

    for key, text in LINES.items():
        base_result = qwen.predict(text, LANGUAGE, VOICE_DESCRIPTION, api_name="/generate_voice_design")
        base = _resolve_audio(base_result)
        out = engine.WORK_DIR / f"visio-test-v10a-{key}-candidate.wav"
        _seed_convert(base, reference, out, token)
        print(f"MONIA_VISIO_TEST_VOICE key={key} output={out} bytes={out.stat().st_size}")
        if args.publish_candidate:
            print(f"MONIA_VISIO_TEST_VOICE_CANDIDATE key={key} url={engine.publish_candidate(out)}")


if __name__ == "__main__":
    main()
