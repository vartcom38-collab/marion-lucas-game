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
    "Brand-new photorealistic live video-call feed of Lucas, seen DIRECTLY THROUGH THE FRONT-FACING CAMERA OF HIS OWN SMARTPHONE. "
    "Preserve the locked Lucas identity: early twenties, thick dark wavy hair with loose strands, strong brows, olive/tanned skin, "
    "green-hazel to gray-green eyes with a warmer amber center, short beard, youthful masculine face. "
    "Current canon allows visible tasteful dark neck/chest tattoos when naturally exposed. "
    "This must be entirely newly generated and must NOT replay, trace, crop or reenact any user-supplied video. "
    "CRITICAL VISIO RULE: the camera viewpoint IS Lucas's smartphone front camera. We see only what Marion would receive on her screen. "
    "NO PHONE IS VISIBLE. No mirror, no second camera, no third-person angle, no shot of Lucas holding a device. "
    "Natural arm-length selfie perspective, slightly wide smartphone front-camera geometry. Show full head, neck, shoulders and upper torso from mid-chest upward. "
    "Framing is casually human and slightly imperfect, with tiny irregular front-camera drift caused by the unseen hand outside frame. "
    "Lucas looks mainly at Marion's image on screen with occasional brief direct looks into the lens, creating natural screen-versus-lens eye shifts. "
    "Subtle breathing, normal irregular blinks, tiny head movement and minute upper-body shifts. Never frozen. "
    "No cinematic grammar: no zoom, push-in, dolly, pan, rack focus, cut, montage, artificial reframing or portrait posing. "
    "NEW MOMENT: late afternoon after training on a quiet covered terrace/courtyard, soft natural daylight, muted stone and greenery in the distant background. "
    "NEW LOOK: fitted charcoal training top, slightly tousled post-training hair, relaxed off-duty appearance. "
    "Natural skin texture, believable smartphone exposure, slight front-camera softness, realistic compression feel, no glamour filter, no cinematic color grade. "
    "Keep identity, wardrobe, setting, lighting and front-camera geometry coherent across all three state clips. "
    "No other person, no subtitles, no UI, no text, no watermark. "
)

NEGATIVE = (
    "visible phone, smartphone in frame, hand holding phone visible, mirror selfie, reflected phone, second camera, third-person shot, "
    "camera filming Lucas holding a phone, over-the-shoulder shot, side view using phone, tripod, static studio camera, webcam framing, "
    "portrait photoshoot, presenter shot, cinematic portrait, user-supplied source video replay, copied motion, copied background, different man, "
    "identity drift, generic male model, altered jaw, altered nose, altered lips, altered eye color, uniformly brown eyes, bright neon green eyes, blue eyes, "
    "beauty filter, plastic skin, invented facial scar, second person, extra person, extreme close-up, face crop, full-body shot, "
    "dramatic camera motion, zoom, push-in, pan, dolly, cut, montage, reframing, frozen face, repeated mechanical gesture, "
    "cartoon, illustration, subtitles, captions, title, watermark, app UI, morphing, jitter"
)

STATE_SPECS = {
    "listening": {
        "duration": 5,
        "output": "visio-lucas-surprise-v4-frontcam-listening-candidate.mp4",
        "prompt": SCENE_CORE + (
            "STATE LISTENING. Marion is speaking. Lucas remains silent and attentive in the live front-camera feed. "
            "He breathes naturally, blinks irregularly, makes one tiny unseen-hand framing correction, briefly checks Marion's image on screen, "
            "then returns his eyes toward the lens and gives a very small acknowledging head movement. Mouth mostly closed."
        ),
    },
    "speaking": {
        "duration": 9,
        "output": "visio-lucas-surprise-v4-frontcam-speaking-v4voice-candidate.mp4",
        "silent": "visio-lucas-surprise-v4-frontcam-speaking-silent-candidate.mp4",
        "prompt": SCENE_CORE + (
            "STATE SPEAKING. Lucas speaks directly to Marion in a relaxed, spontaneous live call. "
            "He appears to say in natural connected French: 'Salut ma chérie… je pensais à toi, alors je t'appelle deux minutes. Tu fais quoi ?' "
            "Keep natural breathing, tiny front-camera drift, normal blinks, slight head motion and a restrained affectionate half-smile. "
            "No whisper, no dreamy slow delivery, no commercial acting."
        ),
    },
    "reaction": {
        "duration": 4,
        "output": "visio-lucas-surprise-v4-frontcam-reaction-candidate.mp4",
        "prompt": SCENE_CORE + (
            "STATE REACTION. Lucas has just finished speaking and listens to Marion. "
            "He gives a tiny amused breath, slight eyebrow movement and faint half-smile, then settles back to attentive neutral. "
            "One very subtle front-camera drift keeps the live-call feeling believable. No speaking."
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
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(video), "-i", str(audio),
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-shortest", "-movflags", "+faststart", str(output),
    ], check=True)


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
        key=f"lucas-visio-surprise-v4-frontcam-{state}",
        canon_url=f"{engine.SITE}/resources/monia/canon/lucas/reference.jpg",
        prompt=spec["prompt"],
        negative=NEGATIVE,
        width=576,
        height=1024,
        aspect_ratio="9:16 (Portrait)",
        duration=int(spec["duration"]),
        output_name=str(silent_name),
    )
    source = engine.WORK_DIR / "lucas-visio-surprise-v4-canon.png"
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
    parser = argparse.ArgumentParser(description="Generate true front-camera MonIA Lucas visio V4 state candidates")
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
            print(f"MONIA_VISIO_SURPRISE_V4 state={state} compute={provider} output={path} bytes={path.stat().st_size}")
            if args.publish_candidate:
                url = engine.publish_candidate(path)
                print(f"MONIA_VISIO_SURPRISE_V4_CANDIDATE state={state} url={url}")
        except Exception as exc:
            failures.append(f"{state}: {exc}")
            print(f"MONIA_VISIO_SURPRISE_V4_FAILED state={state} error={exc}")
            if args.state != "all":
                raise
    if failures:
        raise RuntimeError("Some MonIA visio V4 states failed: " + " | ".join(failures))


if __name__ == "__main__":
    main()
