from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path

import requests
from gradio_client import Client, handle_file

import scripts.monia_video_engine as engine

VIDEO_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/visio-lucas-speaking-fr-layout-v7-candidate.mp4?run=34826963016"
VOICE_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/lucas-voice-v10-drama-tuned-fr-a-candidate.wav"
OUTPUT_NAME = "visio-lucas-v10a-synced-candidate.mp4"

# MonIA remains the orchestration/policy layer. The lipsync provider is only a
# hidden compute adapter used to retime mouth motion to the already selected
# Lucas V10-A voice; it is never allowed to publish directly to live gameplay.
LIPSYNC_SPACES = (
    "manavisrani07/gradio-lipsync-wav2lip",
    "lmh07072000/gradio-lipsync-wav2lip",
)


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
                    raw = sub.get("path") or sub.get("name")
                    if raw:
                        p = Path(str(raw))
                        if p.exists() and p.stat().st_size > 4096:
                            return p
    raise RuntimeError(f"Lipsync provider returned no usable video: {type(result).__name__}")


def run_lipsync(video: Path, voice: Path, output: Path) -> str:
    token = os.environ.get("HF_TOKEN", "").strip() or None
    errors: list[str] = []
    for space in LIPSYNC_SPACES:
        try:
            client = Client(space, token=token, verbose=False, download_files=True)
            # Current Wav2Lip Gradio variants expose a single Generate button.
            # Try the modern nine-argument signature first, then the common
            # eight-argument legacy wiring used by older copies of the Space.
            attempts = [
                (handle_file(str(video)), handle_file(str(voice)), "wav2lip_gan", False, 1, 0, 20, 0, 0),
                (handle_file(str(video)), handle_file(str(voice)), "wav2lip_gan", 0, 20, 0, 0, 1),
            ]
            api_names = ("/generate", "/predict", None)
            last: Exception | None = None
            for args in attempts:
                for api_name in api_names:
                    try:
                        if api_name:
                            result = client.predict(*args, api_name=api_name)
                        else:
                            result = client.predict(*args)
                        source = _resolve_video(result)
                        shutil.copyfile(source, output)
                        if engine.worker.looks_like_video(output):
                            return space
                    except Exception as exc:
                        last = exc
                        output.unlink(missing_ok=True)
            raise RuntimeError(str(last or "no compatible lipsync endpoint"))
        except Exception as exc:
            errors.append(f"{space}: {exc}")
            output.unlink(missing_ok=True)
    raise RuntimeError("No MonIA lipsync compute available: " + " | ".join(errors[-4:]))


def build_synced() -> tuple[Path, str]:
    video = engine.WORK_DIR / "visio-v7-visual-source.mp4"
    voice = engine.WORK_DIR / "lucas-v10a-voice-source.wav"
    output = engine.WORK_DIR / OUTPUT_NAME
    download(VIDEO_URL, video)
    download(VOICE_URL, voice)
    output.unlink(missing_ok=True)
    provider = run_lipsync(video, voice, output)
    if not engine.worker.looks_like_video(output):
        raise RuntimeError("Synced visio output is not a valid video")
    return output, provider


def main() -> None:
    parser = argparse.ArgumentParser(description="Build MonIA Lucas V10-A visio candidate with true audio-driven mouth sync")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()
    output, provider = build_synced()
    print(f"MONIA_VISIO_V10A_SYNCED compute={provider} output={output} bytes={output.stat().st_size}")
    if args.publish_candidate:
        url = engine.publish_candidate(output)
        print(f"MONIA_VISIO_V10A_SYNCED_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
