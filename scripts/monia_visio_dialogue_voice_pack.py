from __future__ import annotations

import os
import shutil
from pathlib import Path

import requests
from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

FISH_SPACE = "artificialguybr/fish-s2-pro-zero"
FISH_API = "/tts_inference"
CHATTERBOX_SPACE = "ResembleAI/Chatterbox-Multilingual-TTS"
CHATTERBOX_API = "/generate_tts_audio"
V10A_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "lucas-voice-v10-drama-tuned-fr-a-candidate.wav"
)
V10A_REFERENCE_TEXT = "Salut, ça va toi ? Qu'est-ce que tu racontes ?"
PUBLIC_BASE = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"

# Existing V2 pack is preserved as a fallback. V4 is a candidate-only pass aimed
# at conversational naturalness using the exact selected V10-A reference.
LINES = {
    "calm": "Ça va... journée un peu longue, mais tranquille. Et toi, t'as fait quoi ?",
    "warm": "Ah ouais... ça me fait plaisir que tu m'appelles juste pour ça.",
    "busy": "Je viens de me poser deux minutes. J'allais justement souffler un peu.",
    "tease": "Je fais pas le malin... enfin, pas tant que ça.",
    "miss": "Toi aussi... un peu.",
    "end": "D'accord. On se reparle après."
}

# Per-line settings stay deliberately restrained: less exaggeration, moderate
# sampling, and slightly stronger guidance than the V3 experiment. The goal is
# a private phone-call cadence, not a performed TTS read.
V4_SETTINGS = {
    "calm": (0.28, 0.69, 5113, 0.30),
    "warm": (0.31, 0.71, 5227, 0.28),
    "busy": (0.26, 0.68, 5347, 0.31),
    "tease": (0.30, 0.72, 5471, 0.28),
    "miss": (0.27, 0.70, 5581, 0.30),
    "end": (0.24, 0.67, 5693, 0.32),
}


def download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=120, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Downloaded file too small: {url}")


def result_path(result) -> Path:
    if isinstance(result, str):
        p = Path(result)
        if p.exists() and p.stat().st_size > 4096:
            return p
    if isinstance(result, dict):
        raw = result.get("path") or result.get("name")
        if raw and Path(str(raw)).exists():
            return Path(str(raw))
    if isinstance(result, (list, tuple)):
        for item in result:
            if isinstance(item, str) and Path(item).exists():
                return Path(item)
            if isinstance(item, dict):
                raw = item.get("path") or item.get("name")
                if raw and Path(str(raw)).exists():
                    return Path(str(raw))
    raise RuntimeError(f"Voice provider returned no usable audio file: {type(result).__name__}")


def clone_fish(client: Client, text: str, reference: Path, target: Path, *, top_p: float, repetition_penalty: float, temperature: float) -> None:
    result = client.predict(
        text,
        handle_file(reference),
        V10A_REFERENCE_TEXT,
        1024,
        200,
        top_p,
        repetition_penalty,
        temperature,
        api_name=FISH_API,
    )
    source = result_path(result)
    shutil.copyfile(source, target)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Direct V10-A Fish clone output is too small")


def clone_chatterbox(
    client: Client,
    text: str,
    reference: Path,
    target: Path,
    *,
    exaggeration: float,
    temperature: float,
    seed: int,
    cfg: float,
) -> None:
    result = client.predict(
        text,
        "fr",
        handle_file(reference),
        exaggeration,
        temperature,
        seed,
        cfg,
        api_name=CHATTERBOX_API,
    )
    source = result_path(result)
    shutil.copyfile(source, target)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("V10-A Chatterbox clone output is too small")


def public_candidate_exists(version: str, key: str) -> bool:
    url = PUBLIC_BASE + f"lucas-visio-dialogue-{version}-{key}-candidate.wav"
    try:
        r = requests.get(url, timeout=30, headers={"Range": "bytes=0-63", "Cache-Control": "no-cache"})
        return r.status_code in (200, 206) and len(r.content) >= 44 and r.content[:4] == b"RIFF"
    except requests.RequestException:
        return False


def main() -> None:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    v10a = engine.WORK_DIR / "lucas-v10a-exact-reference.wav"
    download(V10A_URL, v10a)

    # Preserve the validated opening reference. The test page now uses the
    # synchronized audio already embedded in the validated V7/V10-A MP4.
    opening_target = engine.WORK_DIR / "lucas-visio-dialogue-v2-opening-candidate.wav"
    shutil.copyfile(v10a, opening_target)
    print("VISIO_DIALOGUE_VOICE v2 key=opening source=exact_v10a_preserved")

    chatterbox = Client(CHATTERBOX_SPACE, token=token, verbose=False, download_files=True)
    v4_failures: list[str] = []
    for key, text in LINES.items():
        target = engine.WORK_DIR / f"lucas-visio-dialogue-v4-{key}-candidate.wav"
        exaggeration, temperature, seed, cfg = V4_SETTINGS[key]
        try:
            clone_chatterbox(
                chatterbox,
                text,
                v10a,
                target,
                exaggeration=exaggeration,
                temperature=temperature,
                seed=seed,
                cfg=cfg,
            )
            url = engine.publish_candidate(target)
            print(
                f"VISIO_DIALOGUE_VOICE v4 key={key} source=v10a_chatterbox_natural "
                f"exaggeration={exaggeration} temp={temperature} cfg={cfg} url={url}"
            )
        except Exception as exc:
            if public_candidate_exists("v4", key):
                print(f"VISIO_DIALOGUE_VOICE v4 key={key} source=preserved_last_good reason={type(exc).__name__}: {exc}")
            else:
                v4_failures.append(f"{key}: {type(exc).__name__}: {exc}")

    # Do not mutate any approved/live manifest. Existing V2/V3 files remain
    # available as fallbacks while V4 is evaluated in the standalone test page.
    if v4_failures:
        raise RuntimeError("V4 candidate generation incomplete: " + " | ".join(v4_failures))


if __name__ == "__main__":
    main()
