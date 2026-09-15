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
VOICE_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/lucas-visio-dialogue-v2-warm-candidate.wav"
OUTPUT_NAME = "visio-lucas-warm-directclone-musetalk-candidate.mp4"
MUSE_SPACE = "henrybit/musetalk-1-5"

# The voice is now the best direct-clone Lucas dialogue candidate already used
# by visio-test. We do not alter/re-time/re-synthesize that audio here.
# MuseTalk 1.5 is used only to drive lower-face motion from the locked audio,
# then composite it back into the approved V7 full-frame visual foundation.
# This remains candidate-only until visually approved.


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
    """Keep the approved 9:16 framing; normalize only codec/fps for MuseTalk."""
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

    # Start conservative: keep edits centered on jaw/lower face, not the whole
    # face. This minimizes identity drift and avoids the old pasted-mouth look.
    variants = (
        (0, 6, "jaw", 58, 58),
        (-2, 5, "jaw", 55, 55),
        (1, 7, "jaw", 62, 62),
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


def mux_locked_audio(video: Path, voice: Path, target: Path) -> None:
    """Force final output to carry the exact approved candidate audio bytes/timing."""
    target.unlink(missing_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(video), "-i", str(voice),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(target),
        ],
        check=True,
        timeout=120,
    )
    if not engine.worker.looks_like_video(target):
        raise RuntimeError("Final exact-audio mux failed")


def build_synced() -> tuple[Path, str]:
    raw_video = engine.WORK_DIR / "visio-v7-warm-visual-source.mp4"
    video = engine.WORK_DIR / "visio-v7-warm-visual-source-25fps.mp4"
    voice = engine.WORK_DIR / "lucas-warm-directclone-voice.wav"
    musetalk_raw = engine.WORK_DIR / "visio-lucas-warm-musetalk-raw.mp4"
    output = engine.WORK_DIR / OUTPUT_NAME

    download(VIDEO_URL, raw_video)
    download(VOICE_URL, voice)
    normalize_source(raw_video, video)
    musetalk_raw.unlink(missing_ok=True)
    output.unlink(missing_ok=True)

    provider = run_musetalk(video, voice, musetalk_raw)
    mux_locked_audio(musetalk_raw, voice, output)
    return output, provider


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Lucas warm visio synced to locked direct-clone audio with MuseTalk")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()
    output, provider = build_synced()
    print(f"MONIA_VISIO_WARM_MUSETALK compute={provider} output={output} bytes={output.stat().st_size}")
    if args.publish_candidate:
        url = engine.publish_candidate(output)
        print(f"MONIA_VISIO_WARM_MUSETALK_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
