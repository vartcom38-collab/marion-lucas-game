from __future__ import annotations

import argparse
from dataclasses import replace
from pathlib import Path

from PIL import Image

import scripts.monia_video_engine as engine

REFERENCE_IMAGE = Path("resources/monia/canon/lucas/visio-layout-reference.jpg")
OUTPUT_NAME = "visio-lucas-speaking-fr-layout-v8-native-candidate.mp4"

PROMPT = (
    "Animate the supplied reference as a REAL smartphone front-camera video call with Lucas. "
    "The supplied frame is the composition authority: preserve the same upper-torso framing, visible shoulder and forearm, "
    "phone held naturally at arm's length, intimate front-camera distance and warm lived-in room depth. "
    "Do NOT turn this into a head-only portrait or beauty close-up. Keep Lucas recognizably the same man with natural skin texture, dark wavy hair, short stubble and olive skin. "
    "EYE COLOR IS CANONICAL AND MUST NOT DRIFT: Lucas has deep cool green-hazel eyes, an outer gray-green/olive iris, a subtle warm amber-brown ring close to the pupil, and a darker limbal rim. "
    "The overall impression must be green-gray/olive hazel rather than brown. Never make the irises uniformly brown, bright blue, turquoise, emerald green or unnaturally luminous. Preserve realistic low-light variation. "
    "Keep the validated V7 visual feeling: relaxed dark shirt, tiny handheld micro-shake, minute framing drift, natural breathing, irregular blinks, subtle autofocus/exposure breathing and small gaze shifts between Marion on screen and the lens. "
    "His emotional intention is warm, private and gently amused, genuinely happy to see Marion. His gaze is soft and attentive, with a restrained half-smile, tiny eyebrow reactions and brief eye-brightening before he speaks. "
    "IMPORTANT: GENERATE HIS VOICE AND HIS FACIAL SPEECH PERFORMANCE TOGETHER IN THIS SAME TAKE. Do not treat the mouth as a silent animation to be dubbed later. The original generated take itself is the final speech performance. "
    "Lucas says in natural everyday French: 'Ah ouais, ça me fait plaisir que tu m'appelles juste pour ça.' "
    "VOICE IDENTITY: young adult French man, around twenty-two, naturally low-mid male register, warm slightly husky texture, close and intimate phone-call sound, relaxed chest resonance, subtle smile audible in the tone, never deep trailer voice, never nasal, never bright or adolescent, never polished radio voice. "
    "DELIVERY: one continuous spontaneous thought. He begins with a soft, quick 'Ah ouais', flows directly into the rest of the sentence, links the words naturally, slightly compresses unstressed syllables, uses one normal breath only if needed, and finishes softly without a staged final cadence. "
    "The timing must be fluid and conversational: no word-by-word delivery, no evenly spaced syllables, no artificial micro-pauses, no chopped phrasing, no punctuation-driven stops. The sentence should feel like it came out naturally in one breath during a real private call. "
    "French pronunciation must be native and contemporary, with connected speech, soft consonants, ordinary contractions and a relaxed southern-European warmth without caricature or marked regional accent. "
    "His mouth, jaw, cheeks, tiny head movements and eyebrows must follow the same continuous vocal performance naturally. Natural occasional teeth visibility is fine. Do not exaggerate lip shapes. "
    "No theatrical acting, no cinematic dolly, no frozen pose, no head-only crop. "
    "Treat any phone UI already present in the source as static framing reference only; do not invent extra text, captions, subtitles or interface elements."
)

NEGATIVE = (
    "head-only portrait, extreme close-up, studio portrait, beauty lighting, blank stare, presenter gaze, frozen mouth, weak lip movement, "
    "uniform brown eyes, dark brown irises, bright blue eyes, turquoise eyes, emerald green eyes, neon eyes, glowing irises, eye color drift, "
    "robotic speech, text-to-speech cadence, careful textbook French, over-articulated consonants, separated words, evenly timed syllables, chopped phrasing, repeated micro-pauses, punctuation pauses, announcer voice, radio voice, trailer voice, very deep voice, nasal voice, adolescent voice, high-pitched male voice, foreign accent, dubbed feeling, asynchronous mouth, "
    "exaggerated acting, identity drift, different man, face morphing, text mutation, caption mutation, new subtitles, new UI, extra people, extra hands, cinematic camera move, dolly shot, zoom-in"
)


def prepare_reference(target: Path, width: int, height: int) -> None:
    image = Image.open(REFERENCE_IMAGE).convert("RGB")
    ratio = width / height
    source_ratio = image.width / image.height
    if source_ratio > ratio:
        crop_w = round(image.height * ratio)
        left = max(0, (image.width - crop_w) // 2)
        image = image.crop((left, 0, left + crop_w, image.height))
    elif source_ratio < ratio:
        crop_h = round(image.width / ratio)
        top = max(0, (image.height - crop_h) // 2)
        image = image.crop((0, top, image.width, top + crop_h))
    image.resize((width, height), Image.Resampling.LANCZOS).save(target, "PNG", optimize=True)


def generate() -> tuple[Path, str]:
    base = engine.LUCAS_VISIO_TEST1
    profile = replace(
        base,
        key="lucas-visio-speaking-fr-layout-v8-native",
        prompt=PROMPT,
        negative=NEGATIVE,
        width=576,
        height=1024,
        aspect_ratio="9:16 (Portrait)",
        duration=5,
        output_name=OUTPUT_NAME,
    )
    source = engine.WORK_DIR / "lucas-visio-layout-reference.png"
    target = engine.WORK_DIR / OUTPUT_NAME
    prepare_reference(source, profile.width, profile.height)
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
    parser = argparse.ArgumentParser(description="Generate MonIA Lucas V8 native integrated visio candidate without external lip-sync")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()
    path, provider = generate()
    print(f"MONIA_VISIO_LAYOUT_V8_NATIVE compute={provider} output={path} bytes={path.stat().st_size}")
    if args.publish_candidate:
        url = engine.publish_candidate(path)
        print(f"MONIA_VISIO_LAYOUT_V8_NATIVE_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
