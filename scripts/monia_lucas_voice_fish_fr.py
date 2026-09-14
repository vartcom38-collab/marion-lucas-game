from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from pathlib import Path

import requests
from faster_whisper import WhisperModel
from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

REFERENCE_VIDEO_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "visio-lucas-speaking-candidate.mp4?run=34821590907"
)
FISH_SPACE = "artificialguybr/fish-s2-pro-zero"
FISH_API = "/tts_inference"
TEXT = "Salut, ça va toi ? Qu'est-ce que tu racontes ?"
OUTPUT_NAME = "lucas-voice-v5-fish-fr-candidate.wav"


def download_reference(video_path: Path) -> None:
    r = requests.get(
        REFERENCE_VIDEO_URL,
        timeout=60,
        headers={"Cache-Control": "no-cache", "Accept": "video/*,*/*"},
    )
    r.raise_for_status()
    if len(r.content) < 4096:
        raise RuntimeError("Lucas English reference video is too small")
    video_path.write_bytes(r.content)


def extract_reference_audio(video_path: Path, wav_path: Path) -> None:
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(video_path), "-vn", "-ac", "1", "-ar", "24000",
            "-af", "highpass=f=55,lowpass=f=11500",
            str(wav_path),
        ],
        check=True,
        timeout=90,
    )
    if not wav_path.exists() or wav_path.stat().st_size < 4096:
        raise RuntimeError("Could not extract usable Lucas English reference audio")


def transcribe_reference(wav_path: Path) -> str:
    model = WhisperModel("tiny.en", device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        str(wav_path),
        language="en",
        beam_size=5,
        vad_filter=True,
        condition_on_previous_text=False,
    )
    text = " ".join(seg.text.strip() for seg in segments if seg.text.strip()).strip()
    if len(text) < 3:
        raise RuntimeError("Could not transcribe Lucas English reference audio")
    print(f"MONIA_LUCAS_REF_TRANSCRIPT language={info.language} text={text!r}")
    return text


def result_path(result) -> Path:
    if isinstance(result, str):
        p = Path(result)
        if p.exists():
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


def generate_french(reference_wav: Path, ref_text: str, target: Path) -> str:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(FISH_SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(
        TEXT,
        handle_file(reference_wav),
        ref_text,
        1024,
        200,
        0.72,
        1.12,
        0.62,
        api_name=FISH_API,
    )

    try:
        source = result_path(result)
        shutil.copyfile(source, target)
    except RuntimeError:
        if isinstance(result, (list, tuple)) and len(result) == 2 and isinstance(result[0], int):
            import wave
            import numpy as np
            sr, audio = result
            arr = np.asarray(audio)
            if arr.dtype != np.int16:
                if np.issubdtype(arr.dtype, np.floating):
                    arr = (arr.clip(-1, 1) * 32767).astype(np.int16)
                else:
                    arr = arr.astype(np.int16)
            with wave.open(str(target), "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(sr)
                wf.writeframes(arr.tobytes())
        else:
            raise

    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Fish S2 Pro French Lucas candidate is too small")
    return "Fish Audio S2 Pro direct cross-lingual zero-shot voice cloning from Lucas English reference"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate candidate-only Lucas French voice directly from his English voice reference"
    )
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    work = engine.WORK_DIR
    reference_video = work / "lucas-v3-english-reference.mp4"
    reference_wav = work / "lucas-v3-english-reference.wav"
    target = work / OUTPUT_NAME

    download_reference(reference_video)
    extract_reference_audio(reference_video, reference_wav)
    ref_text = transcribe_reference(reference_wav)
    target.unlink(missing_ok=True)
    provider = generate_french(reference_wav, ref_text, target)

    print(
        f"MONIA_LUCAS_FISH_FR compute={provider} output={target} bytes={target.stat().st_size}"
    )
    if args.publish_candidate:
        url = engine.publish_candidate(target)
        print(f"MONIA_LUCAS_FISH_FR_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
