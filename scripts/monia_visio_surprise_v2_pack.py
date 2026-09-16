from __future__ import annotations

import argparse
import subprocess
import time
from pathlib import Path

import requests

import scripts.monia_video_engine as engine

VOICE_URL = (
    "https://marion-lucas.marionbolomey.fr/resources/monia/generated/"
    "lucas-voice-v4-surprise-call-fr-candidate.wav"
)
VOICE_NAME = "lucas-voice-v4-surprise-call-fr-candidate.wav"

SCENE_CORE = (
    "Brand-new photorealistic Lucas smartphone video call for Marion & Lucas. "
    "Preserve the locked Lucas identity: early twenties, thick dark wavy hair with loose strands, strong brows, "
    "olive/tanned skin, green-hazel to gray-green eyes with a warmer amber center, short beard, youthful masculine face. "
    "Current canon allows Lucas's visible dark neck/chest tattoos when naturally exposed. "
    "This must be an entirely new generated visio moment and NOT a replay, crop, trace or reenactment of any user-supplied video. "
    "CRITICAL CAMERA RULE: Lucas is physically HOLDING his smartphone in one hand during the call, selfie/front-camera perspective. "
    "The image must feel exactly like the view Marion would receive during a real live video call. "
    "Show Lucas's full head, neck, shoulders and upper torso, roughly mid-chest upward, at natural arm-length selfie distance. "
    "The camera is not mounted, not on a tripod, not resting on a table and not perfectly centered. "
    "Use tiny irregular handheld drift from his wrist and arm, subtle breathing movement and occasional minute framing variation, never dramatic shake. "
    "Lucas looks mainly at the phone screen/camera like a real person on a visio call, with tiny natural eye shifts to the screen. "
    "No cinematic grammar: no zoom, push-in, dolly, pan, cut, montage, artificial reframing or beauty-shot posing. "
    "New setting: early night at home near a softly lit hallway/bedroom doorway, warm practical light behind him, darker room beyond. "
    "New look: fitted dark olive T-shirt, casually tousled hair, relaxed off-duty appearance. "
    "Natural skin texture, believable phone-camera exposure, slight real-world depth of field, no glamour filter. "
    "Keep wardrobe, lighting, background, handheld framing style and identity coherent across all three state clips. "
    "No other person, no subtitles, no UI, no text, no watermark. "
)

NEGATIVE = (
    "phone on stand, tripod, static studio camera, table-mounted camera, webcam framing, portrait photoshoot, presenter shot, "
    "user-supplied source video replay, copied motion, copied background, different man, identity drift, generic male model, "
    "altered jaw, altered nose, altered lips, altered eye color, uniformly brown eyes, bright neon green eyes, blue eyes, "
    "beauty filter, plastic skin, invented facial scar, second person, extra person, extreme close-up, face crop, "
    "dramatic camera motion, zoom, push-in, pan, cut, montage, reframing, frozen face, repeated mechanical gesture, "
    "cartoon, illustration, subtitles, captions, title, watermark, app UI, morphing, jitter"
)

STATE_SPECS = {
    "listening": {
        "duration": 5,
        "output": "visio-lucas-surprise-v3-handheld-listening-candidate.mp4",
        "prompt": SCENE_CORE + (
            "STATE LISTENING. Lucas is quiet while Marion speaks. He holds the phone naturally at arm's length, "
            "breathes, blinks irregularly, makes one tiny wrist adjustment that shifts framing only slightly, "
            "briefly glances at the screen and back to the camera, and gives a very small acknowledging head movement. "
            "Mouth mostly closed. Alive and attentive, never frozen."
        ),
    },
    "speaking": {
        "duration": 9,
        "output": "visio-lucas-surprise-v3-handheld-speaking-v4voice-candidate.mp4",
        "silent": "visio-lucas-surprise-v3-handheld-speaking-silent-candidate.mp4",
        "prompt": SCENE_CORE + (
            "STATE SPEAKING. Lucas talks directly to Marion while still holding the phone himself. "
            "Natural connected French phone-call rhythm, relaxed and spontaneous. He appears to say: "
            "'Salut ma chérie… je pensais à toi, alors je t'appelle deux minutes. Tu fais quoi ?' "
            "Keep natural upper-body breathing, one small hand-held framing correction, tiny head motion, normal blinks and a restrained affectionate half-smile. "
            "No slow dreamy delivery, no whisper and no commercial acting."
        ),
    },
    "reaction": {
        "duration": 4,
        "output": "visio-lucas-surprise-v3-handheld-reaction-candidate.mp4",
        "prompt": SCENE_CORE + (
            "STATE REACTION. Lucas has just stopped speaking and keeps holding the phone. He listens to Marion, "
            "lets out a tiny amused breath, gives a slight eyebrow movement and faint half-smile, then settles back to attentive neutral. "
            "One subtle wrist drift makes the handheld nature believable. No speaking."
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


def _run_compute(profile: engine.CharacterProfile, source: Path, target: Path) -> str:
    errors: list[str] = []
    for attempt in range(1, 4):
        target.unlink(missing_ok=True)
        try:
            return engine._run_ltx(profile, source, target)
        except Exception as exc:
            errors.append(f"LTX attempt {attempt}: {exc}")
            if attempt < 3:
                time.sleep(18 * attempt)
    target.unlink(missing_ok=True)
    try:
        return engine._run_wan(profile, source, target)
    except Exception as exc:
        errors.append(f"WAN fallback: {exc}")
        raise RuntimeError("No MonIA video compute available: " + " | ".join(errors)) from exc


def _generate_state(state: str) -> tuple[Path, str]:
    spec = STATE_SPECS[state]
    silent_name = spec.get("silent", spec["output"])
    profile = engine.CharacterProfile(
        key=f"lucas-visio-surprise-v3-handheld-{state}",
        canon_url=f"{engine.SITE}/resources/monia/canon/lucas/reference.jpg",
        prompt=spec["prompt"],
        negative=NEGATIVE,
        width=576,
        height=1024,
        aspect_ratio="9:16 (Portrait)",
        duration=int(spec["duration"]),
        output_name=str(silent_name),
    )
    source = engine.WORK_DIR / "lucas-visio-surprise-v3-canon.png"
    silent = engine.WORK_DIR / str(silent_name)
    engine._download_canon(profile, source)
    provider = _run_compute(profile, source, silent)

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
    parser = argparse.ArgumentParser(description="Generate handheld MonIA Lucas visio V3 state candidates")
    parser.add_argument("--publish-candidate", action="store_true")
    parser.add_argument("--state", choices=list(STATE_SPECS) + ["all"], default="all")
    args = parser.parse_args()

    states = list(STATE_SPECS) if args.state == "all" else [args.state]
    failures: list[str] = []
    for state in states:
        try:
            path, provider = _generate_state(state)
            if not path.exists() or path.stat().st_size < 10000:
                raise RuntimeError(f"Invalid generated state: {state}")
            print(f"MONIA_VISIO_SURPRISE_V3 state={state} compute={provider} output={path} bytes={path.stat().st_size}")
            if args.publish_candidate:
                url = engine.publish_candidate(path)
                print(f"MONIA_VISIO_SURPRISE_V3_CANDIDATE state={state} url={url}")
        except Exception as exc:
            failures.append(f"{state}: {exc}")
            print(f"MONIA_VISIO_SURPRISE_V3_FAILED state={state} error={exc}")
            if args.state != "all":
                raise
    if failures:
        raise RuntimeError("Some MonIA visio V3 states failed: " + " | ".join(failures))


if __name__ == "__main__":
    main()
