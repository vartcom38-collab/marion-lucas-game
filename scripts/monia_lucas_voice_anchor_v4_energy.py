from __future__ import annotations

import argparse
import os
import shutil
import wave
from pathlib import Path

import numpy as np
import requests
from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

QWEN_SPACE = "Qwen/Qwen3-TTS"
ANCHOR_OUTPUT_NAME = "lucas-voice-anchor-v4-energy-fr-candidate.wav"
ANCHOR_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "lucas-voice-anchor-v4-energy-fr-candidate.wav"
)
ANCHOR_TEXT = (
    "Salut, ça va toi ? Je viens de me poser deux minutes. "
    "Journée un peu longue, mais tranquille. Ça me fait plaisir de t'entendre."
)
SURPRISE_TEXT = "Salut ma chérie… je pensais à toi, alors je t'appelle deux minutes. Tu fais quoi ?"
SURPRISE_OUTPUT_NAME = "lucas-voice-v4-surprise-call-fr-candidate.wav"

DESCRIPTION = (
    "Native French young adult male voice. Keep a naturally low male register, compact and dense, "
    "with strong upper-mid presence so it stays crisp and close instead of dark or muffled. Slight rough "
    "texture, small natural huskiness, but clean intelligibility. Delivery should be natural, connected and alive. "
    "For a private video call, sound relaxed and affectionate without becoming sleepy, slow, dreamy or theatrical. "
    "Use firm but easy phrase attacks, short natural breaths, fluid French linking, subtle variation in pitch and intensity, "
    "and an ordinary spontaneous phone-call rhythm. No narrator cadence, no radio polish, no over-articulation, no whisper, "
    "no robotic syllable separation. Overall: low, clear, compact, masculine, warm, responsive and human."
)


def resolve_audio(result) -> Path:
    items = result if isinstance(result, (list, tuple)) else [result]
    for item in reversed(items):
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


def write_audio_tuple(result, target: Path) -> bool:
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


def download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=90, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Downloaded reference too small: {url}")


def generate_anchor(client: Client) -> Path:
    result = client.predict(ANCHOR_TEXT, "French", DESCRIPTION, api_name="/generate_voice_design")
    source = resolve_audio(result)
    output = engine.WORK_DIR / ANCHOR_OUTPUT_NAME
    shutil.copyfile(source, output)
    return output


def generate_surprise_call(client: Client) -> Path:
    reference = engine.WORK_DIR / "lucas-v4-fixed-synthetic-reference.wav"
    download(ANCHOR_URL, reference)
    result = client.predict(
        handle_file(reference),
        ANCHOR_TEXT,
        SURPRISE_TEXT,
        "French",
        False,
        "1.7B",
        api_name="/generate_voice_clone",
    )
    output = engine.WORK_DIR / SURPRISE_OUTPUT_NAME
    output.unlink(missing_ok=True)
    if not write_audio_tuple(result, output):
        source = resolve_audio(result)
        shutil.copyfile(source, output)
    if not output.exists() or output.stat().st_size < 4096:
        raise RuntimeError("Lucas V4 surprise-call voice candidate is too small")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Lucas fixed synthetic V4 voice assets")
    parser.add_argument("--publish-candidate", action="store_true")
    parser.add_argument("--surprise-call", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(QWEN_SPACE, token=token, verbose=False, download_files=True)
    if args.surprise_call:
        output = generate_surprise_call(client)
        label = "MONIA_LUCAS_V4_SURPRISE_CALL"
        text = SURPRISE_TEXT
    else:
        output = generate_anchor(client)
        label = "MONIA_LUCAS_ANCHOR_V4"
        text = ANCHOR_TEXT

    print(f"{label} output={output} bytes={output.stat().st_size} text={text!r}")
    if args.publish_candidate:
        url = engine.publish_candidate(output)
        print(f"{label}_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
