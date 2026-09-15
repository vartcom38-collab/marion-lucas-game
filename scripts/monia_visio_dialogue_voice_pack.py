from __future__ import annotations

import os
import shutil
import wave
from pathlib import Path

import numpy as np
import requests
from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

QWEN_SPACE = "Qwen/Qwen3-TTS"
QWEN_CLONE_API = "/generate_voice_clone"
CHATTERBOX_SPACE = "ResembleAI/Chatterbox-Multilingual-TTS"
CHATTERBOX_API = "/generate_tts_audio"
V10A_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "lucas-voice-v10-drama-tuned-fr-a-candidate.wav"
)
V10A_REFERENCE_TEXT = "Salut, ça va toi ? Qu'est-ce que tu racontes ?"
PUBLIC_BASE = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"

# Existing V2/V3 packs stay untouched. V5 is a structurally different test:
# Qwen3-TTS Base voice cloning from the exact selected V10-A reference.
LINES = {
    "calm": "Ça va... journée un peu longue, mais tranquille. Et toi, t'as fait quoi ?",
    "warm": "Ah ouais... ça me fait plaisir que tu m'appelles juste pour ça.",
    "busy": "Je viens de me poser deux minutes. J'allais justement souffler un peu.",
    "tease": "Je fais pas le malin... enfin, pas tant que ça.",
    "miss": "Toi aussi... un peu.",
    "end": "D'accord. On se reparle après."
}


def download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=120, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Downloaded file too small: {url}")


def _write_audio_tuple(result, target: Path) -> bool:
    # Gradio Audio(type='numpy') usually comes back as (sample_rate, ndarray).
    if not (isinstance(result, (list, tuple)) and len(result) >= 1):
        return False
    candidate = result[0] if len(result) == 2 and isinstance(result[1], str) else result
    if not (isinstance(candidate, (list, tuple)) and len(candidate) == 2):
        return False
    sr, audio = candidate
    if not isinstance(sr, (int, np.integer)):
        return False
    arr = np.asarray(audio)
    if arr.ndim > 1:
        arr = arr.mean(axis=-1)
    if np.issubdtype(arr.dtype, np.floating):
        arr = np.clip(arr, -1.0, 1.0)
        arr = (arr * 32767.0).astype(np.int16)
    elif arr.dtype != np.int16:
        arr = arr.astype(np.int16)
    with wave.open(str(target), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(int(sr))
        wf.writeframes(arr.tobytes())
    return target.exists() and target.stat().st_size > 4096


def result_path(result) -> Path:
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
    raise RuntimeError(f"Voice provider returned no usable audio file: {type(result).__name__}")


def clone_qwen(client: Client, text: str, reference: Path, target: Path) -> None:
    result = client.predict(
        handle_file(reference),
        V10A_REFERENCE_TEXT,
        text,
        "French",
        False,
        "1.7B",
        api_name=QWEN_CLONE_API,
    )
    target.unlink(missing_ok=True)
    if _write_audio_tuple(result, target):
        return
    source = result_path(result)
    shutil.copyfile(source, target)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Qwen Base V10-A clone output is too small")


def clone_chatterbox(client: Client, text: str, reference: Path, target: Path) -> None:
    # Safety fallback only. It is not preferred because the user rejected the
    # V4 Chatterbox pack as robotic/saccadic.
    result = client.predict(
        text,
        "fr",
        handle_file(reference),
        0.31,
        0.71,
        6221,
        0.28,
        api_name=CHATTERBOX_API,
    )
    source = result_path(result)
    shutil.copyfile(source, target)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Fallback Chatterbox output is too small")


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

    # Opening stays native in the validated MP4; no separate synthesized audio.
    print("VISIO_DIALOGUE_VOICE opening=native_validated_mp4")

    qwen = Client(QWEN_SPACE, token=token, verbose=False, download_files=True)
    failures: list[str] = []
    for key, text in LINES.items():
        target = engine.WORK_DIR / f"lucas-visio-dialogue-v5-{key}-candidate.wav"
        try:
            clone_qwen(qwen, text, v10a, target)
            url = engine.publish_candidate(target)
            print(f"VISIO_DIALOGUE_VOICE v5 key={key} source=qwen_base_1_7b_v10a_clone url={url}")
        except Exception as exc:
            if public_candidate_exists("v5", key):
                print(f"VISIO_DIALOGUE_VOICE v5 key={key} source=preserved_last_good reason={type(exc).__name__}: {exc}")
            else:
                failures.append(f"{key}: {type(exc).__name__}: {exc}")

    # Candidate-only: no live manifest mutation and no auto-promotion.
    if failures:
        raise RuntimeError("V5 Qwen clone candidate generation incomplete: " + " | ".join(failures))


if __name__ == "__main__":
    main()
