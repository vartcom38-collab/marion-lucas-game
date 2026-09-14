from __future__ import annotations

import argparse
import asyncio
import os
import shutil
import subprocess
from pathlib import Path

import edge_tts
import requests
from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

REFERENCE_VIDEO_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "visio-lucas-speaking-candidate.mp4?run=34821590907"
)
SEED_VC_SPACE = "Plachta/Seed-VC"
TEXT = "Hey... ça va, toi ? Qu'est-ce que tu racontes ?"
OUTPUT_NAME = "lucas-voice-v3-french-native-candidate.wav"


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


def ffmpeg_wav(source: Path, target: Path, sample_rate: int = 24000) -> None:
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(source), "-vn", "-ac", "1", "-ar", str(sample_rate),
            "-af", "highpass=f=65,lowpass=f=11000,loudnorm=I=-18:TP=-2:LRA=7",
            str(target),
        ],
        check=True,
        timeout=90,
    )
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError(f"Could not create usable wav: {target}")


async def choose_native_french_male_voice() -> str:
    voices = await edge_tts.list_voices()
    preferred = ["fr-FR-HenriNeural", "fr-FR-AlainNeural"]
    by_name = {v.get("ShortName"): v for v in voices}
    for name in preferred:
        if name in by_name:
            return name
    for voice in voices:
        if voice.get("Locale") == "fr-FR" and voice.get("Gender") == "Male":
            return str(voice["ShortName"])
    raise RuntimeError("No native fr-FR male voice found")


async def generate_native_french_source(mp3_path: Path) -> str:
    voice = await choose_native_french_male_voice()
    # Keep pronunciation unmistakably native French, with a slightly relaxed pace.
    communicate = edge_tts.Communicate(TEXT, voice, rate="-8%", pitch="-4Hz", volume="+0%")
    await communicate.save(str(mp3_path))
    if not mp3_path.exists() or mp3_path.stat().st_size < 2048:
        raise RuntimeError("Native French donor audio generation failed")
    return voice


def extract_reference_audio(video_path: Path, wav_path: Path) -> None:
    ffmpeg_wav(video_path, wav_path, sample_rate=24000)


def resolve_audio_file(result) -> Path:
    # Seed-VC returns (stream_audio, full_audio); full_audio is the second item.
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
        diffusion_steps=20,
        length_adjust=1.0,
        intelligebility_cfg_rate=0.0,
        similarity_cfg_rate=0.72,
        top_p=0.9,
        temperature=0.9,
        repetition_penalty=1.0,
        convert_style=False,
        anonymization_only=False,
        api_name="/predict",
    )
    source = resolve_audio_file(result)
    shutil.copyfile(source, target)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Seed-VC Lucas candidate is too small")
    return "native fr-FR donor + Seed-VC timbre-only conversion to Lucas V3"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate candidate-only Lucas French voice preserving native French pronunciation while transferring V3 timbre"
    )
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    work = engine.WORK_DIR
    reference_video = work / "lucas-v3-native-fr-reference.mp4"
    reference_wav = work / "lucas-v3-native-fr-reference.wav"
    donor_mp3 = work / "lucas-native-fr-donor.mp3"
    donor_wav = work / "lucas-native-fr-donor.wav"
    target = work / OUTPUT_NAME

    download_reference(reference_video)
    extract_reference_audio(reference_video, reference_wav)
    voice = asyncio.run(generate_native_french_source(donor_mp3))
    ffmpeg_wav(donor_mp3, donor_wav, sample_rate=24000)
    target.unlink(missing_ok=True)
    provider = convert_timbre(donor_wav, reference_wav, target)

    print(
        f"MONIA_LUCAS_NATIVE_FR donor={voice} compute={provider} "
        f"output={target} bytes={target.stat().st_size}"
    )
    if args.publish_candidate:
        url = engine.publish_candidate(target)
        print(f"MONIA_LUCAS_NATIVE_FR_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
