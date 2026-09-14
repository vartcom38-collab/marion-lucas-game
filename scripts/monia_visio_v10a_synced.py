from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from pathlib import Path

import requests
from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

VIDEO_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/visio-lucas-speaking-fr-layout-v7-candidate.mp4?run=34826963016"
VOICE_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/lucas-voice-v10-drama-tuned-fr-a-candidate.wav"
OUTPUT_NAME = "visio-lucas-v10a-musetalk-candidate.mp4"
MUSE_SPACE = "henrybit/musetalk-1-5"

# This test deliberately abandons Wav2Lip. The previous result visibly pasted a
# synthetic mouth region over Lucas and also returned a smaller-looking frame.
# MuseTalk 1.5 edits the face region and composites it back into the original
# full video frame, so the V7 framing/body/eyes remain the visual foundation.
# MonIA remains the policy/orchestration layer and publication stays candidate-only.


def download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=120, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Downloaded file too small: {url}")


def _resolve_video(result) -> Path:
    items = result if isinstance(result, (list, tuple)) else [result]
    for item in items:
        if isinstance(item, str):
            p = Path(item)
            if p.exists() and p.stat().st_size > 4096:
                return p
        if isinstance(item, dict):
            raw = item.get("path") or item.get("name") or item.get("video")
            if raw:
                p = Path(str(raw))
                if p.exists() and p.stat().st_size > 4096:
                    return p
        if isinstance(item, (list, tuple)):
            for sub in item:
                if isinstance(sub, str):
                    p = Path(sub)
                    if p.exists() and p.stat().st_size > 4096:
                        return p
                if isinstance(sub, dict):
                    raw = sub.get("path") or sub.get("name") or sub.get("video")
                    if raw:
                        p = Path(str(raw))
                        if p.exists() and p.stat().st_size > 4096:
                            return p
    raise RuntimeError(f"MuseTalk returned no usable video: {type(result).__name__}")


def normalize_source(video: Path, target: Path) -> None:
    """Keep the original 9:16 frame and convert only timing/codec for MuseTalk."""
    target.unlink(missing_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(video),
            "-vf", "fps=25",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
            "-pix_fmt", "yuv420p", "-an", str(target),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if not engine.worker.looks_like_video(target):
        raise RuntimeError("25fps source preparation failed")


def run_musetalk(video: Path, voice: Path, output: Path) -> str:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    client = Client(MUSE_SPACE, token=token, verbose=True, download_files=True)

    # API order from the Space: audio, video, bbox_shift, extra_margin,
    # parsing_mode, left_cheek_width, right_cheek_width. We deliberately use
    # jaw parsing and conservative cheek widths so the edited region blends
    # inside Lucas' lower face rather than looking like pasted lips.
    variants = (
        (0, 8, "jaw", 65, 65),
        (-2, 6, "jaw", 60, 60),
        (2, 8, "jaw", 70, 70),
    )
    api_names = ("/inference", "/generate", "/predict", None)
    errors: list[str] = []

    for bbox_shift, extra_margin, parsing_mode, left_cheek, right_cheek in variants:
        for api_name in api_names:
            try:
                args = (
                    handle_file(str(voice)),
                    handle_file(str(video)),
                    bbox_shift,
                    extra_margin,
                    parsing_mode,
                    left_cheek,
                    right_cheek,
                )
                result = client.predict(*args, api_name=api_name) if api_name else client.predict(*args)
                source = _resolve_video(result)
                shutil.copyfile(source, output)
                if engine.worker.looks_like_video(output):
                    return f"{MUSE_SPACE}:{bbox_shift}/{extra_margin}/{left_cheek}"
            except Exception as exc:
                errors.append(f"api={api_name} params={bbox_shift}/{extra_margin}/{left_cheek}: {exc}")
                output.unlink(missing_ok=True)

    raise RuntimeError("MuseTalk sync failed: " + " | ".join(errors[-6:]))


def build_synced() -> tuple[Path, str]:
    raw_video = engine.WORK_DIR / "visio-v7-visual-source.mp4"
    video = engine.WORK_DIR / "visio-v7-visual-source-25fps.mp4"
    voice = engine.WORK_DIR / "lucas-v10a-voice-source.wav"
    output = engine.WORK_DIR / OUTPUT_NAME

    download(VIDEO_URL, raw_video)
    download(VOICE_URL, voice)
    normalize_source(raw_video, video)
    output.unlink(missing_ok=True)

    provider = run_musetalk(video, voice, output)
    if not engine.worker.looks_like_video(output):
        raise RuntimeError("MuseTalk visio output is not a valid video")
    return output, provider


def main() -> None:
    parser = argparse.ArgumentParser(description="Build MonIA Lucas V10-A visio with full-frame MuseTalk audio-driven sync")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()
    output, provider = build_synced()
    print(f"MONIA_VISIO_V10A_MUSETALK compute={provider} output={output} bytes={output.stat().st_size}")
    if args.publish_candidate:
        url = engine.publish_candidate(output)
        print(f"MONIA_VISIO_V10A_MUSETALK_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
