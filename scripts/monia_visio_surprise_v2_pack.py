from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import requests

import scripts.monia_video_engine as engine

VOICE_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "lucas-voice-anchor-v4-energy-fr-candidate.wav"
)
VOICE_NAME = "lucas-voice-anchor-v4-energy-fr-candidate.wav"

SCENE_CORE = (
    "Brand-new photorealistic Lucas smartphone video call for Marion & Lucas. "
    "Preserve the locked Lucas identity: early twenties, thick dark wavy hair with a few loose strands, strong brows, "
    "olive/tanned skin, green-hazel to gray-green eyes with a warmer amber center, short beard, youthful masculine face. "
    "Current canon allows Lucas's visible dark neck/chest tattoos when naturally exposed. "
    "This is NOT a replay, trace, crop or reenactment of any user-supplied video and must invent a completely new visio moment. "
    "Vertical 9:16 front-camera framing, Lucas alone, chest-up, complete face visible. "
    "New situation: late evening after returning home, Lucas is in a warm but understated bedroom/dressing-area corner, "
    "not the previous living-room setup. He wears a charcoal fitted crew-neck T-shirt under a light unbuttoned overshirt, "
    "hair slightly messier than before as if he has just changed after a long day. A small bedside lamp and a dark wardrobe are softly out of focus behind him. "
    "The phone is resting naturally at eye level. No cinematic camera grammar: no zoom, push-in, pan, crop change, cut or reframing. "
    "Natural front-camera realism only: breathing, irregular blinks, tiny eye shifts, subtle head and shoulder micro-movements. "
    "Keep lighting, wardrobe, background, framing and identity coherent across all state clips in this pack. "
    "No other person, no subtitles, no UI, no text, no watermark. "
)

NEGATIVE = (
    "user-supplied source video replay, copied motion, copied background, different man, identity drift, generic male model, "
    "altered jaw, altered nose, altered lips, altered eye color, uniformly brown eyes, bright neon green eyes, blue eyes, "
    "beauty filter, plastic skin, erased natural tattoos when visible, invented facial scar, second person, extra person, "
    "extreme close-up, cropped face, dramatic camera motion, zoom, push-in, pan, cut, montage, reframing, presenter performance, "
    "frozen face, repeated mechanical gesture, cartoon, illustration, subtitles, captions, title, watermark, app UI, morphing, jitter"
)

STATE_SPECS = {
    "listening": {
        "duration": 5,
        "output": "visio-lucas-surprise-v2-listening-candidate.mp4",
        "prompt": (
            SCENE_CORE
            + "STATE: LISTENING / WAITING. Lucas is quiet and attentive as if Marion is speaking. "
              "He looks at the screen, briefly glances down for less than a second, returns to camera, blinks naturally, "
              "and makes one tiny acknowledging head movement. Mouth remains mostly closed; no speaking. Calm but alive, never frozen."
        ),
    },
    "speaking": {
        "duration": 9,
        "output": "visio-lucas-surprise-v2-speaking-v4voice-candidate.mp4",
        "silent": "visio-lucas-surprise-v2-speaking-silent-candidate.mp4",
        "prompt": (
            SCENE_CORE
            + "STATE: SPEAKING. Lucas speaks directly to Marion with the lively, connected, energetic conversational rhythm of a real private call. "
              "He should appear to say in natural French: 'Salut, ça va toi ? Je viens de me poser deux minutes. Journée un peu longue, mais tranquille. Ça me fait plaisir de t'entendre.' "
              "Mouth motion is continuous and conversational rather than exaggerated. Include one natural blink, tiny eye movement, one small head shift, and a restrained half-smile near the end. "
              "No slow dreamy delivery, no whispering, no seductive commercial acting."
        ),
    },
    "reaction": {
        "duration": 4,
        "output": "visio-lucas-surprise-v2-reaction-candidate.mp4",
        "prompt": (
            SCENE_CORE
            + "STATE: REACTION AFTER SPEAKING. Lucas stops talking, listens for Marion's response, gives a very slight amused exhale/half-smile, "
              "tiny eyebrow movement, then returns to a neutral attentive look. Mouth closed except for a natural micro-expression. No speaking."
        ),
    },
}


def _download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=60, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError(f"Downloaded media too small: {target}")


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


def _generate_state(state: str) -> tuple[Path, str]:
    spec = STATE_SPECS[state]
    silent_name = spec.get("silent", spec["output"])
    profile = engine.CharacterProfile(
        key=f"lucas-visio-surprise-v2-{state}",
        canon_url=f"{engine.SITE}/resources/monia/canon/lucas/reference.jpg",
        prompt=spec["prompt"],
        negative=NEGATIVE,
        width=576,
        height=1024,
        aspect_ratio="9:16 (Portrait)",
        duration=int(spec["duration"]),
        output_name=str(silent_name),
    )
    source = engine.WORK_DIR / "lucas-visio-surprise-v2-canon.png"
    silent = engine.WORK_DIR / str(silent_name)
    engine._download_canon(profile, source)
    silent.unlink(missing_ok=True)

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

    if state != "speaking":
        return silent, provider

    voice = engine.WORK_DIR / VOICE_NAME
    if not voice.exists():
        _download(VOICE_URL, voice)
    final = engine.WORK_DIR / str(spec["output"])
    final.unlink(missing_ok=True)
    _mux(silent, voice, final)
    return final, provider


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a three-state MonIA Lucas surprise visio pack")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()

    results: list[tuple[str, Path, str]] = []
    for state in ("listening", "speaking", "reaction"):
        path, provider = _generate_state(state)
        if not path.exists() or path.stat().st_size < 10000:
            raise RuntimeError(f"Invalid generated state: {state}")
        results.append((state, path, provider))
        print(f"MONIA_VISIO_SURPRISE_V2 state={state} compute={provider} output={path} bytes={path.stat().st_size}")

    if args.publish_candidate:
        for state, path, _ in results:
            url = engine.publish_candidate(path)
            print(f"MONIA_VISIO_SURPRISE_V2_CANDIDATE state={state} url={url}")


if __name__ == "__main__":
    main()
