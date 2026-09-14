from __future__ import annotations

import argparse
from dataclasses import replace
from pathlib import Path

import scripts.monia_video_engine as engine

CALL_GRAMMAR = (
    "Source grammar: REAL SMARTPHONE FRONT-CAMERA VIDEO CALL, not a cinematic portrait, not a studio shot and not a webcam recording. "
    "Match the visual language of a person holding a phone close during a private video call: Lucas fills most of the frame from upper chest to hair, "
    "his face is close to the lens, with mild front-camera wide-angle perspective and believable arm-length distance. "
    "The phone is roughly at eye level but never perfectly stabilized; allow tiny hand/body sway, minute framing drift, subtle autofocus/exposure breathing, "
    "small consumer-phone compression and ordinary available room light. The crop may be slightly imperfect at the shoulders or hair for realism. "
    "Lucas is not posing. He is actively looking at Marion on the screen and intermittently toward the tiny front-camera lens, creating the familiar screen-versus-lens eye-line mismatch of a real video call. "
    "Background remains a real lived-in room with believable depth, softly out of focus and secondary to the face. "
    "No cinematic dolly, no fashion pose, no symmetrical hero portrait, no shallow-depth glamour shot, no tripod-static framing, no baked-in call UI, no captions. "
)

STATE_PROMPTS = {
    "listening": (
        "State: LISTENING. Lucas is silently listening to Marion during the live call. "
        "His mouth remains naturally closed. He breathes, blinks irregularly, makes tiny attentive eye shifts, a slight head-angle change and one restrained micro nod. "
        "His attention feels directed to a person on the phone screen, never to a photographer. No speaking and no repeated mechanical gesture."
    ),
    "speaking": (
        "State: SPEAKING. Lucas is CLEARLY AND CONTINUOUSLY TALKING in a normal conversational reply for most of the clip. "
        "The first second must already show unmistakable speech. Use repeated varied open-mouth phoneme shapes, visible lower-jaw travel, lip rounding and spreading, "
        "brief tooth visibility where natural, subtle cheek movement, small tongue/lip transitions, breaths and tiny head/eyebrow beats that accompany normal speech. "
        "His lips must visibly change shape many times across the clip; the jaw must open enough that muted playback immediately reads as someone speaking rather than posing. "
        "Include only very short natural pauses, never a long closed-mouth hold. Maintain conversational eye contact with the screen/lens while talking. "
        "Keep the performance intimate and ordinary, not theatrical. Do not mime one exact written sentence and do not attempt audio lip synchronization; runtime audio remains separate and playback is never warped."
    ),
    "reaction": (
        "State: REACTION. Lucas has just heard something from Marion on the live call and reacts privately: "
        "a quick eye change, small eyebrow response, a restrained closed-mouth half-smile or amused breath, then a natural return toward neutral. "
        "He remains close to the front camera and aware of the phone screen. No speaking, no theatrical expression, no looping gesture."
    ),
    "thinking": (
        "State: THINKING. Lucas pauses during the live call before replying. "
        "His gaze slips briefly away from the screen, he breathes, blinks, subtly shifts his grip/posture so the framing moves by a few pixels, then looks back toward Marion on-screen. "
        "Mouth stays closed. It must feel like a spontaneous pause inside an ongoing handheld phone call, not a posed portrait."
    ),
}


def profile_for(state: str) -> engine.CharacterProfile:
    base = engine.LUCAS_VISIO_TEST1
    prompt = (
        base.prompt
        + " "
        + CALL_GRAMMAR
        + STATE_PROMPTS[state]
        + " Preserve the exact locked Lucas identity above every other visual objective. "
        + "Keep skin texture, facial proportions, hair, eyes and overall Lucas identity stable from first frame to last."
    )
    negative = (
        base.negative
        + ", identity substitution, lip-sync imitation, playback warping, random seeking, frozen mouth while speaking, "
        + "silent speaking pose, tiny mouth movement, almost-closed mouth during speech, studio portrait, cinematic portrait, glamour portrait, beauty lighting, "
        + "dolly shot, perfectly centered locked framing, tripod-static portrait, webcam composition, distant medium shot, repeated gesture, exaggerated acting, "
        + "baked-in phone interface, captions, subtitles"
    )
    return replace(
        base,
        key=f"lucas-visio-{state}",
        prompt=prompt,
        negative=negative,
        duration=5 if state == "speaking" else 4,
        output_name=f"visio-lucas-{state}-candidate.mp4",
    )


def generate(state: str) -> tuple[Path, str]:
    profile = profile_for(state)
    source = engine.WORK_DIR / f"{profile.key}-canon.png"
    target = engine.WORK_DIR / profile.output_name
    engine._download_canon(profile, source)
    target.unlink(missing_ok=True)
    errors: list[str] = []
    try:
        provider = engine._run_ltx(profile, source, target)
    except Exception as exc:
        errors.append(f"primary: {exc}")
        target.unlink(missing_ok=True)
        try:
            provider = engine._run_wan(profile, source, target)
        except Exception as wexc:
            errors.append(str(wexc))
            raise RuntimeError("No MonIA video compute available: " + " | ".join(errors)) from wexc
    if not engine.worker.looks_like_video(target):
        raise RuntimeError("Generated candidate is not a valid video")
    return target, provider


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate one candidate for the locked Lucas visio state pack")
    parser.add_argument("--state", choices=sorted(STATE_PROMPTS), required=True)
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()
    path, provider = generate(args.state)
    print(f"MONIA_VISIO state={args.state} compute={provider} output={path} bytes={path.stat().st_size}")
    if args.publish_candidate:
        url = engine.publish_candidate(path)
        print(f"MONIA_VISIO_CANDIDATE state={args.state} url={url}")


if __name__ == "__main__":
    main()
