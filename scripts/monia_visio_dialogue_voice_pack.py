from __future__ import annotations

import os
import shutil
from pathlib import Path

import requests
from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

QWEN_SPACE = "Qwen/Qwen3-TTS"
SEED_VC_SPACE = "Plachta/Seed-VC"
LANGUAGE = "French"
V10A_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "lucas-voice-v10-drama-tuned-fr-a-candidate.wav"
)

# IMPORTANT: V10-A is the selected Lucas voice reference. We do NOT redesign the
# voice from a text description here. For every new sentence, we create only a
# native-French timing/prosody source, then convert its timbre toward the exact
# V10-A reference with Seed-VC. Style conversion stays off so French prosody is
# driven by the new French source rather than copied from another sentence.
LINES = {
    "opening": "Salut... ça va, toi ? Qu'est-ce que tu racontes ?",
    "calm": "Ça va... journée un peu longue, mais tranquille. Et toi, t'as fait quoi ?",
    "warm": "Ah ouais ? Ça me fait plaisir que tu m'appelles juste pour ça.",
    "busy": "Je viens de me poser deux minutes. J'allais justement souffler un peu.",
    "tease": "Je fais pas le malin. Enfin... pas tant que ça.",
    "miss": "Toi aussi, un peu.",
    "end": "D'accord... on se reparle après."
}

# This voice is only a temporary native-French timing carrier. Its identity is
# intentionally irrelevant because Seed-VC replaces the timbre with V10-A.
SOURCE_DESCRIPTION = (
    "A native French adult male speaking naturally in a private phone call. "
    "Calm contemporary French, relaxed articulation, restrained melody, short natural pauses, "
    "no announcer tone, no theatrical acting, no exaggerated bass, no foreign accent."
)


def download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=120, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Downloaded file too small: {url}")


def resolve_audio(result) -> Path:
    items = list(reversed(result)) if isinstance(result, (list, tuple)) else [result]
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
    raise RuntimeError("No usable audio returned")


def generate_native_source(client: Client, text: str, target: Path) -> None:
    result = client.predict(text, LANGUAGE, SOURCE_DESCRIPTION, api_name="/generate_voice_design")
    source = resolve_audio(result)
    shutil.copyfile(source, target)
    if target.stat().st_size < 4096:
        raise RuntimeError("Native French source is too small")


def convert_to_v10a(client: Client, source: Path, v10a: Path, target: Path) -> None:
    result = client.predict(
        source_audio_path=handle_file(source),
        target_audio_path=handle_file(v10a),
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
    converted = resolve_audio(result)
    shutil.copyfile(converted, target)
    if target.stat().st_size < 4096:
        raise RuntimeError("V10-A conversion is too small")


def main() -> None:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    v10a = engine.WORK_DIR / "lucas-v10a-exact-reference.wav"
    download(V10A_URL, v10a)

    # Opening uses the exact selected V10-A sample, byte-for-byte, because the
    # sentence is the one for which that voice was explicitly selected.
    opening_target = engine.WORK_DIR / "lucas-visio-dialogue-v2-opening-candidate.wav"
    shutil.copyfile(v10a, opening_target)
    print("VISIO_DIALOGUE_VOICE v2 key=opening source=exact_v10a")
    print("VISIO_DIALOGUE_VOICE url=" + engine.publish_candidate(opening_target))

    qwen = Client(QWEN_SPACE, token=token, verbose=False, download_files=True)
    seed = Client(SEED_VC_SPACE, token=token, verbose=False, download_files=True)

    for key, text in LINES.items():
        if key == "opening":
            continue
        native = engine.WORK_DIR / f"lucas-visio-dialogue-v2-{key}-native-source.wav"
        target = engine.WORK_DIR / f"lucas-visio-dialogue-v2-{key}-candidate.wav"
        generate_native_source(qwen, text, native)
        convert_to_v10a(seed, native, v10a, target)
        url = engine.publish_candidate(target)
        print(f"VISIO_DIALOGUE_VOICE v2 key={key} source=native_fr target=exact_v10a url={url}")


if __name__ == "__main__":
    main()
