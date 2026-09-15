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

LINES = {
    "opening": "Salut, ça va toi ? Qu'est-ce que tu racontes ?",
    "calm": "Ça va, journée un peu longue mais tranquille. Et toi, t'as fait quoi ?",
    "warm": "Ah ouais, ça me fait plaisir que tu m'appelles juste pour ça.",
    "busy": "Je viens de me poser deux minutes, j'allais justement souffler un peu.",
    "tease": "Je fais pas le malin... enfin, pas tant que ça.",
    "miss": "Toi aussi, un peu.",
    "end": "D'accord, on se reparle après."
}

# Focused V3 experiment: same selected Lucas V10-A reference, but a looser,
# more conversational performance. This never overwrites the V2 pack.
V3_WARM_TEXT = "Ah ouais... ça me fait plaisir que tu m'appelles juste pour ça."


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


def clone_chatterbox(client: Client, text: str, reference: Path, target: Path) -> None:
    # Existing MonIA route already used elsewhere in the project. We feed the
    # exact selected V10-A sample as the reference and loosen only performance.
    result = client.predict(
        text,
        "fr",
        handle_file(reference),
        0.42,
        0.78,
        4817,
        0.20,
        api_name=CHATTERBOX_API,
    )
    source = result_path(result)
    shutil.copyfile(source, target)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("V10-A Chatterbox expressive clone output is too small")


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
            clone_fish(fish, text, v10a, target, top_p=0.72, repetition_penalty=1.10, temperature=0.66)
            url = engine.publish_candidate(target)
            print(f"VISIO_DIALOGUE_VOICE v2 key={key} source=direct_v10a_fish_clone_natural url={url}")
        except Exception as exc:
            if public_candidate_exists("v2", key):
                print(f"VISIO_DIALOGUE_VOICE v2 key={key} source=preserved_last_good reason={type(exc).__name__}: {exc}")
                continue
            failures.append(f"{key}: {type(exc).__name__}: {exc}")

    # V3 warm candidate: try Fish first, then fall back to the existing MonIA
    # Chatterbox route using the exact same V10-A reference. Candidate-only.
    v3_target = engine.WORK_DIR / "lucas-visio-dialogue-v3-warm-candidate.wav"
    try:
        clone_fish(fish, V3_WARM_TEXT, v10a, v3_target, top_p=0.78, repetition_penalty=1.08, temperature=0.74)
        url = engine.publish_candidate(v3_target)
        print(f"VISIO_DIALOGUE_VOICE v3 key=warm source=direct_v10a_fish_expressive url={url}")
    except Exception as fish_exc:
        try:
            chatterbox = Client(CHATTERBOX_SPACE, token=token, verbose=False, download_files=True)
            clone_chatterbox(chatterbox, V3_WARM_TEXT, v10a, v3_target)
            url = engine.publish_candidate(v3_target)
            print(
                "VISIO_DIALOGUE_VOICE v3 key=warm source=v10a_chatterbox_expressive "
                f"fish_fallback={type(fish_exc).__name__} url={url}"
            )
        except Exception as chatter_exc:
            if public_candidate_exists("v3", "warm"):
                print(
                    "VISIO_DIALOGUE_VOICE v3 key=warm source=preserved_last_good "
                    f"fish={type(fish_exc).__name__} chatterbox={type(chatter_exc).__name__}"
                )
            else:
                print(
                    "VISIO_DIALOGUE_VOICE v3 key=warm source=not_published "
                    f"fish={type(fish_exc).__name__}: {fish_exc} | "
                    f"chatterbox={type(chatter_exc).__name__}: {chatter_exc}"
                )

    if failures:
        raise RuntimeError("No safe fallback for: " + " | ".join(failures))


if __name__ == "__main__":
    main()
