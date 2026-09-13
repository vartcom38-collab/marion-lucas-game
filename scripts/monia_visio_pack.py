from __future__ import annotations

import argparse
from dataclasses import replace
from pathlib import Path

import scripts.monia_video_engine as engine

STATE_PROMPTS = {
    "listening": (
        "State: LISTENING. Lucas is silently listening to Marion during a real phone video call. "
        "Keep his mouth closed and relaxed. Use subtle breathing, one irregular blink, a tiny attentive eye movement "
        "and a restrained micro nod. No speaking and no repeated mechanical gesture."
    ),
    "speaking": (
        "State: SPEAKING. Lucas is answering naturally during a real phone video call. "
        "Use subtle unscripted conversational mouth movement, tiny pauses, natural breathing and restrained head motion. "
        "Do not mime a specific sentence and do not exaggerate articulation. This clip is only a generic approved visual "
        "speaking state; audio synchronization is never faked by playback-rate changes or seeking."
    ),
    "reaction": (
        "State: REACTION. Lucas has just heard something from Marion and gives a small believable private reaction: "
        "a brief eye change, tiny eyebrow movement and restrained closed-mouth half-smile that fades naturally. "
        "No speaking, no theatrical expression, no looping gesture."
    ),
    "thinking": (
        "State: THINKING. Lucas pauses for a moment during the video call before replying. "
        "His gaze shifts slightly away from the screen, he breathes, blinks once, then brings his attention back. "
        "Mouth stays closed. Natural introspective micro-expression only, no dramatic acting."
    ),
}


def profile_for(state: str) -> engine.CharacterProfile:
    base = engine.LUCAS_VISIO_TEST1
    prompt = (
        base.prompt
        + " "
        + STATE_PROMPTS[state]
        + " Preserve the exact locked Lucas identity above every other visual objective. "
        + "Keep a natural front-camera portrait with enough shoulder and background context for a believable live call."
    )
    negative = (
        base.negative
        + ", identity substitution, lip-sync imitation, playback warping, random seeking, exaggerated speech, repeated gesture"
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
