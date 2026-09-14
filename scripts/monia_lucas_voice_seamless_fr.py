from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from pathlib import Path

import numpy as np
import requests
import soundfile as sf
import torch
from gradio_client import Client, handle_file
from transformers import AutoProcessor, SeamlessM4TForSpeechToSpeech

import scripts.monia_video_engine as engine

REFERENCE_VIDEO_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "visio-lucas-speaking-candidate.mp4?run=34821590907"
)
SEAMLESS_MODEL = "facebook/hf-seamless-m4t-medium"
SEED_VC_SPACE = "Plachta/Seed-VC"
OUTPUT_NAME = "lucas-voice-v6-seamless-fr-candidate.wav"


def download_reference(video_path: Path) -> None:
    r = requests.get(
        REFERENCE_VIDEO_URL,
        timeout=60,
        headers={"Cache-Control": "no-cache", "Accept": "video/*,*/*"},
    )
    r.raise_for_status()
    if len(r.content) < 4096:
        raise RuntimeError("Lucas V3 reference video is too small")
    video_path.write_bytes(r.content)


def ffmpeg_wav(source: Path, target: Path, sample_rate: int = 16000) -> None:
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(source), "-vn", "-ac", "1", "-ar", str(sample_rate),
            "-af", "highpass=f=55",
            str(target),
        ],
        check=True,
        timeout=90,
    )
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError(f"Could not create usable wav: {target}")


def seamless_translate(reference_wav: Path, target: Path) -> str:
    processor = AutoProcessor.from_pretrained(SEAMLESS_MODEL)
    model = SeamlessM4TForSpeechToSpeech.from_pretrained(SEAMLESS_MODEL)
    model.eval()

    audio, sr = sf.read(reference_wav, dtype="float32")
    if audio.ndim > 1:
        audio = np.mean(audio, axis=1)
    if sr != 16000:
        raise RuntimeError(f"Unexpected sample rate {sr}; expected 16000")

    inputs = processor(audios=audio, sampling_rate=16000, return_tensors="pt")
    with torch.inference_mode():
        waveform = model.generate(
            **inputs,
            tgt_lang="fra",
            speech_do_sample=True,
            speech_temperature=0.65,
        )[0].cpu().numpy().squeeze()

    sf.write(target, waveform, 16000)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Seamless French speech output is too small")
    return "SeamlessM4T direct speech-to-speech EN->FR"


def resolve_seed_vc_audio(result) -> Path:
    candidates = list(reversed(result)) if isinstance(result, (list, tuple)) else [result]
    for item in candidates:
        if isinstance(item, str):
            p = Path(item)
            if p.exists():
                return p
        elif isinstance(item, dict):
            raw = item.get("path") or item.get("name")
            if raw:
                p = Path(str(raw))
                if p.exists():
                    return p
    raise RuntimeError(f"Seed-VC returned no usable audio file: {type(result).__name__}")


def convert_timbre(french_source: Path, lucas_reference: Path, target: Path) -> str:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SEED_VC_SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(
        source_audio_path=handle_file(french_source),
        target_audio_path=handle_file(lucas_reference),
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
    source = resolve_seed_vc_audio(result)
    shutil.copyfile(source, target)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Lucas Seamless French candidate is too small")
    return "Seed-VC timbre-only conversion to Lucas V3"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate candidate-only Lucas French voice using direct speech-to-speech translation and V3 timbre"
    )
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    work = engine.WORK_DIR
    reference_video = work / "lucas-v3-seamless-reference.mp4"
    reference_wav = work / "lucas-v3-seamless-reference.wav"
    french_raw = work / "lucas-seamless-french-raw.wav"
    target = work / OUTPUT_NAME

    download_reference(reference_video)
    ffmpeg_wav(reference_video, reference_wav, sample_rate=16000)
    source_provider = seamless_translate(reference_wav, french_raw)
    target.unlink(missing_ok=True)
    timbre_provider = convert_timbre(french_raw, reference_wav, target)

    print(
        f"MONIA_LUCAS_SEAMLESS_FR source={source_provider} timbre={timbre_provider} "
        f"output={target} bytes={target.stat().st_size}"
    )
    if args.publish_candidate:
        url = engine.publish_candidate(target)
        print(f"MONIA_LUCAS_SEAMLESS_FR_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
