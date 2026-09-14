from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from pathlib import Path

import requests
from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

VALIDATED_V7_VIDEO_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "visio-lucas-speaking-fr-layout-v7-candidate.mp4?run=34826963016"
)
VOICE_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/lucas-voice-v10-drama-tuned-fr-a-candidate.wav"
OUTPUT_NAME = "visio-lucas-v7-v10a-timing-candidate.mp4"
SEED_VC_SPACE = "Plachta/Seed-VC"

# Locked combination requested by the user:
# - exact validated V7 visio source (black shirt, upper-body framing, approved eyes/look)
# - preserve V7's own native speech timing, pauses and mouth performance exactly
# - change only the vocal timbre toward the selected V10-A voice
# - no regenerated scene, no Wav2Lip/MuseTalk, no mouth patch, no playback-rate warping
# - the real game visio UI remains runtime-side in src/monia/visio-call-ui.ts


def download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=120, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Downloaded file too small: {url}")


def extract_native_audio(video: Path, target: Path) -> None:
    target.unlink(missing_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(video), "-vn", "-ac", "1", "-ar", "24000",
            "-af", "highpass=f=55", str(target),
        ],
        check=True,
        timeout=90,
    )
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("Validated V7 visio contained no usable native speech audio")


def resolve_seed_vc_audio(result) -> Path:
    candidates = list(reversed(result)) if isinstance(result, (list, tuple)) else [result]
    for item in candidates:
        if isinstance(item, str):
            p = Path(item)
            if p.exists() and p.stat().st_size > 4096:
                return p
        elif isinstance(item, dict):
            raw = item.get("path") or item.get("name")
            if raw:
                p = Path(str(raw))
                if p.exists() and p.stat().st_size > 4096:
                    return p
    raise RuntimeError(f"Seed-VC returned no usable audio file: {type(result).__name__}")


def convert_v7_timing_to_v10a(v7_audio: Path, v10a_reference: Path, target: Path) -> str:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(SEED_VC_SPACE, token=token, verbose=False, download_files=True)
    result = client.predict(
        source_audio_path=handle_file(v7_audio),
        target_audio_path=handle_file(v10a_reference),
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
    converted = resolve_seed_vc_audio(result)
    shutil.copyfile(converted, target)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("V7 timing to V10-A timbre conversion produced no usable audio")
    return "validated V7 native speech timing + Seed-VC V10-A timbre-only conversion"


def mux_timing_locked_voice(video: Path, voice: Path, output: Path) -> None:
    output.unlink(missing_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(video), "-i", str(voice),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-shortest", str(output),
        ],
        check=True,
        timeout=90,
    )
    if not engine.worker.looks_like_video(output):
        raise RuntimeError("Final V7/V10-A visio candidate is not a valid video")


def build() -> tuple[Path, str]:
    source_video = engine.WORK_DIR / "lucas-v7-validated-source.mp4"
    native_audio = engine.WORK_DIR / "lucas-v7-native-timing.wav"
    v10a_reference = engine.WORK_DIR / "lucas-v10a-selected-reference.wav"
    converted_voice = engine.WORK_DIR / "lucas-v7-timing-v10a-timbre.wav"
    output = engine.WORK_DIR / OUTPUT_NAME

    download(VALIDATED_V7_VIDEO_URL, source_video)
    if not engine.worker.looks_like_video(source_video):
        raise RuntimeError("Validated V7 source is not a valid video")
    extract_native_audio(source_video, native_audio)
    download(VOICE_URL, v10a_reference)
    provider = convert_v7_timing_to_v10a(native_audio, v10a_reference, converted_voice)
    mux_timing_locked_voice(source_video, converted_voice, output)
    return output, provider


def main() -> None:
    parser = argparse.ArgumentParser(description="Keep exact validated V7 visio video and convert only its native speech timbre toward V10-A")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()
    output, provider = build()
    print(f"MONIA_VISIO_V7_V10A compute={provider} output={output} bytes={output.stat().st_size}")
    if args.publish_candidate:
        url = engine.publish_candidate(output)
        print(f"MONIA_VISIO_V7_V10A_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
