from __future__ import annotations

import argparse
import math
import shutil
import subprocess
from pathlib import Path

import requests

import scripts.monia_video_engine as engine

VOICE_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "lucas-voice-anchor-v4-energy-fr-candidate.wav"
)
OUTPUT_NAME = "visio-lucas-surprise-v1-v4voice-candidate.mp4"
SILENT_NAME = "visio-lucas-surprise-v1-silent-candidate.mp4"
VOICE_NAME = "lucas-voice-anchor-v4-energy-fr-candidate.wav"

LINE = (
    "Salut, ça va toi ? Je viens de me poser deux minutes. "
    "Journée un peu longue, mais tranquille. Ça me fait plaisir de t'entendre."
)

PROMPT_BASE = (
    "Create a brand-new photorealistic live-action smartphone video-call shot of Lucas for Marion & Lucas. "
    "The supplied Lucas reference is the identity authority for facial geometry: preserve his recognizable face, "
    "thick dark wavy hair with a few strands falling naturally toward the forehead, strong brows, olive/tanned skin, "
    "green-hazel to gray-green eyes with a warmer amber center, short beard and youthful masculine presence. "
    "Use the current Lucas canon: visible tasteful dark neck/chest tattoos may be present; do not erase them. "
    "Vertical 9:16 phone-call framing, chest-up, Lucas alone at home at night in a new warm modern apartment setting, "
    "soft practical lamp light, subtle city lights in the far background, casually open white shirt, realistic skin texture. "
    "This must look like a real live video call, not a movie scene: camera stays fixed with only tiny natural phone micro-motion, "
    "no zoom, no push-in, no crop changes, no cuts, no reframing. Lucas begins with a brief attentive look slightly off-screen, "
    "then looks back into the phone and speaks naturally with lively direct conversational energy. Natural breathing, irregular blink, "
    "tiny shoulder/head adjustment, restrained spontaneous half-smile near the end. His delivery is quick and connected rather than sleepy, "
    "soft, slow, theatrical, seductive or commercial. He appears to say this exact French sentence in one connected thought: "
    f"'{LINE}' "
    "Mouth motion should be natural French conversational speech, with connected phrasing and short irregular pauses. "
    "After finishing, he stays on camera for a brief natural reaction. No other person, no subtitles, no UI, no text, no watermark."
)

NEGATIVE = (
    "different man, identity drift, generic model, altered jaw, altered nose, altered mouth, altered eyes, uniformly brown eyes, "
    "bright artificial green eyes, blue eyes, beauty filter, plastic skin, clean-shaven face, erased tattoos, invented facial scar, "
    "second person, extra person, extra hands, extreme close-up, cropped face, dramatic camera move, zoom, push-in, pan, cut, montage, "
    "reframing, slow dreamy acting, sleepy delivery, whispering, exaggerated sensual acting, presenter voice, frozen face, looped gesture, "
    "cartoon, illustration, subtitles, captions, title, watermark, app UI, morphing, jitter"
)


def _download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=60, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Downloaded media too small: {target}")


def _duration(path: Path) -> float:
    proc = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(proc.stdout.strip())


def _mux(video: Path, audio: Path, output: Path) -> None:
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(video), "-i", str(audio),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-shortest", "-movflags", "+faststart", str(output),
        ],
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate MonIA surprise Lucas visio candidate with approved V4 test voice")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    voice = engine.WORK_DIR / VOICE_NAME
    _download(VOICE_URL, voice)
    audio_duration = _duration(voice)

    # Keep native speed. We generate a visual close to the real audio duration instead of time-warping either stream.
    visual_seconds = max(4, min(12, int(math.ceil(audio_duration + 0.35))))
    profile = engine.CharacterProfile(
        key="lucas-visio-surprise-v1",
        canon_url=f"{engine.SITE}/resources/monia/canon/lucas/reference.jpg",
        prompt=PROMPT_BASE,
        negative=NEGATIVE,
        width=576,
        height=1024,
        aspect_ratio="9:16 (Portrait)",
        duration=visual_seconds,
        output_name=SILENT_NAME,
    )

    source = engine.WORK_DIR / "lucas-visio-surprise-v1-canon.png"
    silent = engine.WORK_DIR / SILENT_NAME
    output = engine.WORK_DIR / OUTPUT_NAME
    engine._download_canon(profile, source)
    silent.unlink(missing_ok=True)
    output.unlink(missing_ok=True)

    errors: list[str] = []
    try:
        provider = engine._run_ltx(profile, source, silent)
    except Exception as exc:
        errors.append(f"primary: {exc}")
        silent.unlink(missing_ok=True)
        try:
            provider = engine._run_wan(profile, source, silent)
        except Exception as wexc:
            errors.append(str(wexc))
            raise RuntimeError("No MonIA video compute available: " + " | ".join(errors)) from wexc

    _mux(silent, voice, output)
    if not output.exists() or output.stat().st_size < 10000:
        raise RuntimeError("Final surprise visio candidate is invalid")

    print(
        f"MONIA_VISIO_SURPRISE_V1 compute={provider} audio_duration={audio_duration:.3f} "
        f"visual_seconds={visual_seconds} output={output} bytes={output.stat().st_size}"
    )
    if args.publish_candidate:
        url = engine.publish_candidate(output)
        print(f"MONIA_VISIO_SURPRISE_V1_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
