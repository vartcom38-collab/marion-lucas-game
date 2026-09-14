from __future__ import annotations

import argparse
from dataclasses import replace
from pathlib import Path

import scripts.monia_video_engine as engine

CALL_GRAMMAR = (
    "Source grammar: REAL SMARTPHONE FRONT-CAMERA VIDEO CALL, not a cinematic portrait and not a studio shot. "
    "Lucas is holding or propping a phone at ordinary conversational distance. Framing is slightly imperfect and human: "
    "head and shoulders visible, Lucas a little off-center at moments, mild wide-angle front-camera perspective, believable room depth. "
    "Add tiny natural phone micro-shake or body sway, minute framing drift, subtle autofocus/exposure breathing and light consumer-phone compression. "
    "Lighting must feel like ordinary available light, never beauty lighting. Background is credible and quietly alive but not distracting. "
    "Lucas sometimes looks at Marion on the screen and sometimes briefly toward the lens, as people do on a real video call. "
    "No cinematic dolly, no fashion pose, no frozen portrait, no dramatic camera move, no baked-in call UI, no captions. "
)

STATE_PROMPTS = {
    "listening": (
        "State: LISTENING. Lucas is silently listening to Marion during the live call. "
        "His mouth remains naturally closed. He breathes, blinks irregularly, makes tiny attentive eye shifts and one restrained micro nod. "
        "He is watching a person on a screen rather than posing for a portrait. No speaking and no repeated mechanical gesture."
    ),
    "speaking": (
        "State: SPEAKING. Lucas is unmistakably TALKING in a normal conversational reply throughout most of the clip. "
        "Show clearly visible, varied and natural lip articulation, jaw opening and closing, subtle cheek movement and changing mouth shapes, "
        "with short conversational pauses, breaths and tiny eyebrow/head gestures. His mouth must NOT stay nearly closed or look like silent posing. "
        "The movement should read immediately as a real person speaking even with the clip muted. Keep it natural rather than theatrical. "
        "Do not mime one exact written sentence and do not attempt audio lip synchronization; runtime audio remains separate and playback is never warped."
    ),
    "reaction": (
        "State: REACTION. Lucas has just heard something from Marion on the live call and reacts privately: "
        "a quick eye change, small eyebrow response, a restrained closed-mouth half-smile or amused breath, then a natural return to neutral. "
        "He remains aware of the phone screen. No speaking, no theatrical expression, no looping gesture."
    ),
    "thinking": (
        "State: THINKING. Lucas pauses during the live call before replying. "
        "His gaze slips briefly away from the screen, he breathes, blinks, subtly adjusts the phone or his posture, then looks back toward Marion on-screen. "
        "Mouth stays closed. It must feel like a spontaneous pause inside an ongoing phone call, not a posed portrait."
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
        + "silent speaking pose, studio portrait, cinematic portrait, beauty lighting, dolly shot, perfectly centered locked framing, "
        + "tripod-static portrait, repeated gesture, exaggerated acting, baked-in phone interface, captions, subtitles"
    )
    return replace(
        base,
        key=f"lucas-visio-{state}",
        prompt=prompt,
        negative=negative,
        duration=4,
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
