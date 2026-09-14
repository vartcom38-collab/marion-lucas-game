from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from pathlib import Path

import requests
from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

REFERENCE_VIDEO_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "visio-lucas-speaking-candidate.mp4?run=34821590907"
)
CHATTERBOX_SPACE = "ResembleAI/Chatterbox-Multilingual-TTS"
CHATTERBOX_API = "/generate_tts_audio"
SEED_VC_SPACE = "Plachta/Seed-VC"
TEXT = "Salut, ça va toi ? Qu'est-ce que tu racontes ?"
OUTPUT_NAME = "lucas-voice-v4-french-fluid-candidate.wav"


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


def ffmpeg_wav(source: Path, target: Path, sample_rate: int = 24000, normalize: bool = False) -> None:
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(source), "-vn", "-ac", "1", "-ar", str(sample_rate),
    ]
    if normalize:
        command += ["-af", "highpass=f=55,loudnorm=I=-18:TP=-2:LRA=9"]
    else:
        command += ["-af", "highpass=f=55"]
    command.append(str(target))
    subprocess.run(command, check=True, timeout=90)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError(f"Could not create usable wav: {target}")


def extract_reference_audio(video_path: Path, wav_path: Path) -> None:
    # Keep Lucas V3 timbre as intact as possible; no aggressive dynamics processing.
    ffmpeg_wav(video_path, wav_path, sample_rate=24000, normalize=False)


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
    raise RuntimeError(f"No usable audio file returned: {type(result).__name__}")


def generate_conversational_french_source(target: Path) -> str:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(CHATTERBOX_SPACE, token=token, verbose=False)
    # No reference audio here on purpose: we want clean native French phrasing first.
    result = client.predict(
        TEXT,
        "fr",
        None,
        0.42,
        0.72,
        2719,
        0.35,
        api_name=CHATTERBOX_API,
    )
    source = result_path(result)
    shutil.copyfile(source, target)
    if target.stat().st_size < 4096:
        raise RuntimeError("Conversational French donor is too small")
    return "Chatterbox native French conversational donor"


def resolve_seed_vc_audio(result) -> Path:
    candidates = []
    if isinstance(result, (list, tuple)):
        candidates.extend(reversed(result))
    else:
        candidates.append(result)
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


def convert_timbre(native_source: Path, lucas_reference: Path, target: Path) -> str:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SEED_VC_SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(
        source_audio_path=handle_file(native_source),
        target_audio_path=handle_file(lucas_reference),
        diffusion_steps=28,
        length_adjust=1.0,
        intelligebility_cfg_rate=0.0,
        similarity_cfg_rate=0.66,
        top_p=0.92,
        temperature=0.8,
        repetition_penalty=1.0,
        convert_style=False,
        anonymization_only=False,
        api_name="/predict",
    )
    source = resolve_seed_vc_audio(result)
    shutil.copyfile(source, target)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Seed-VC Lucas fluid French candidate is too small")
    return "conversational native French donor + Seed-VC timbre-only conversion to Lucas V3"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate candidate-only Lucas French voice with fluid conversational French phrasing and V3 timbre"
    )
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    work = engine.WORK_DIR
    reference_video = work / "lucas-v3-fluid-fr-reference.mp4"
    reference_wav = work / "lucas-v3-fluid-fr-reference.wav"
    donor_raw = work / "lucas-fluid-fr-donor-raw.wav"
    donor_wav = work / "lucas-fluid-fr-donor.wav"
    target = work / OUTPUT_NAME

    download_reference(reference_video)
    extract_reference_audio(reference_video, reference_wav)
    donor_provider = generate_conversational_french_source(donor_raw)
    ffmpeg_wav(donor_raw, donor_wav, sample_rate=24000, normalize=False)
    target.unlink(missing_ok=True)
    provider = convert_timbre(donor_wav, reference_wav, target)

    print(
        f"MONIA_LUCAS_FLUID_FR donor={donor_provider} compute={provider} "
        f"output={target} bytes={target.stat().st_size}"
    )
    if args.publish_candidate:
        url = engine.publish_candidate(target)
        print(f"MONIA_LUCAS_FLUID_FR_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
