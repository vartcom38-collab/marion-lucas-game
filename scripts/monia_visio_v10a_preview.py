from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import requests

import scripts.monia_video_engine as engine

VIDEO_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/visio-lucas-speaking-fr-layout-v7-candidate.mp4?run=34826963016"
VOICE_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/lucas-voice-v10-drama-tuned-fr-a-candidate.wav"
OUTPUT_NAME = "visio-lucas-v10a-voice-preview-candidate.mp4"


def download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=120, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Downloaded file too small: {url}")


def build_preview() -> Path:
    video = engine.WORK_DIR / "visio-v7-visual-source.mp4"
    voice = engine.WORK_DIR / "lucas-v10a-voice-source.wav"
    output = engine.WORK_DIR / OUTPUT_NAME
    download(VIDEO_URL, video)
    download(VOICE_URL, voice)
    output.unlink(missing_ok=True)

    # Candidate preview only: keep the validated V7 visual timing untouched,
    # remove its generated audio and lay V10-A over it. No playback-rate warp.
    cmd = [
        "ffmpeg", "-y",
        "-i", str(video),
        "-i", str(voice),
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-af", "apad",
        "-shortest",
        "-movflags", "+faststart",
        str(output),
    ]
    subprocess.run(cmd, check=True)
    if not engine.worker.looks_like_video(output):
        raise RuntimeError("Preview output is not a valid video")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Lucas visio candidate preview with V10-A voice")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()
    output = build_preview()
    print(f"MONIA_VISIO_V10A_PREVIEW output={output} bytes={output.stat().st_size}")
    if args.publish_candidate:
        url = engine.publish_candidate(output)
        print(f"MONIA_VISIO_V10A_PREVIEW_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
