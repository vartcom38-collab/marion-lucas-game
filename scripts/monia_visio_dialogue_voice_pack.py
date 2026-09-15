from __future__ import annotations

import os
import shutil
from pathlib import Path

import requests
from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

FISH_SPACE = "artificialguybr/fish-s2-pro-zero"
FISH_API = "/tts_inference"
V10A_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "lucas-voice-v10-drama-tuned-fr-a-candidate.wav"
)
V10A_REFERENCE_TEXT = "Salut, ça va toi ? Qu'est-ce que tu racontes ?"
PUBLIC_BASE = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"

# V10-A is the selected Lucas identity. New dialogue is cloned DIRECTLY from
# this exact reference. No synthetic donor voice and no Seed-VC timbre repaint.
LINES = {
    "opening": "Salut, ça va toi ? Qu'est-ce que tu racontes ?",
    "calm": "Ça va, journée un peu longue mais tranquille. Et toi, t'as fait quoi ?",
    "warm": "Ah ouais, ça me fait plaisir que tu m'appelles juste pour ça.",
    "busy": "Je viens de me poser deux minutes, j'allais justement souffler un peu.",
    "tease": "Je fais pas le malin... enfin, pas tant que ça.",
    "miss": "Toi aussi, un peu.",
    "end": "D'accord, on se reparle après."
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
    raise RuntimeError(f"Fish S2 Pro returned no usable audio file: {type(result).__name__}")


def generate_direct_clone(client: Client, text: str, reference: Path, target: Path) -> None:
    # Keep the clone anchored to V10-A, but do not over-constrain sampling.
    # Slightly higher top-p/temperature restores conversational micro-variation
    # and breath while repetition control stays moderate to avoid synthetic loops.
    result = client.predict(
        text,
        handle_file(reference),
        V10A_REFERENCE_TEXT,
        1024,
        200,
        0.72,
        1.10,
        0.66,
        api_name=FISH_API,
    )
    source = result_path(result)
    shutil.copyfile(source, target)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Direct V10-A clone output is too small")


def public_candidate_exists(key: str) -> bool:
    url = PUBLIC_BASE + f"lucas-visio-dialogue-v2-{key}-candidate.wav"
    try:
        r = requests.get(url, timeout=30, headers={"Range": "bytes=0-63", "Cache-Control": "no-cache"})
        return r.status_code in (200, 206) and len(r.content) >= 44 and r.content[:4] == b"RIFF"
    except requests.RequestException:
        return False


def main() -> None:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    v10a = engine.WORK_DIR / "lucas-v10a-exact-reference.wav"
    download(V10A_URL, v10a)

    # Opening stays byte-for-byte identical to the selected reference.
    opening_target = engine.WORK_DIR / "lucas-visio-dialogue-v2-opening-candidate.wav"
    shutil.copyfile(v10a, opening_target)
    print("VISIO_DIALOGUE_VOICE v2 key=opening source=exact_v10a")
    print("VISIO_DIALOGUE_VOICE url=" + engine.publish_candidate(opening_target))

    fish = Client(FISH_SPACE, token=token, verbose=False, download_files=True)
    failures: list[str] = []
    for key, text in LINES.items():
        if key == "opening":
            continue
        target = engine.WORK_DIR / f"lucas-visio-dialogue-v2-{key}-candidate.wav"
        try:
            generate_direct_clone(fish, text, v10a, target)
            url = engine.publish_candidate(target)
            print(f"VISIO_DIALOGUE_VOICE v2 key={key} source=direct_v10a_fish_clone_natural url={url}")
        except Exception as exc:
            # Never replace a known-good Lucas voice with a failed/partial render.
            # If Fish/ZeroGPU is temporarily unavailable, keep the last public
            # direct-clone candidate live and let CI finish successfully.
            if public_candidate_exists(key):
                print(f"VISIO_DIALOGUE_VOICE v2 key={key} source=preserved_last_good reason={type(exc).__name__}: {exc}")
                continue
            failures.append(f"{key}: {type(exc).__name__}: {exc}")

    if failures:
        raise RuntimeError("No safe fallback for: " + " | ".join(failures))


if __name__ == "__main__":
    main()
