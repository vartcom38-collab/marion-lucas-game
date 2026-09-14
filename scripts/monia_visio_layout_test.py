from __future__ import annotations

import argparse
from dataclasses import replace
from pathlib import Path

from PIL import Image

import scripts.monia_video_engine as engine

REFERENCE_IMAGE = Path("resources/monia/canon/lucas/visio-layout-reference.jpg")
OUTPUT_NAME = "visio-lucas-speaking-fr-layout-v6-candidate.mp4"

PROMPT = (
    "Animate the supplied reference as a REAL smartphone front-camera video call with Lucas. "
    "The supplied frame is the composition authority: preserve the same upper-torso framing, visible shoulder and forearm, "
    "phone held naturally at arm's length, intimate front-camera distance and warm lived-in room depth. "
    "Do NOT turn this into a head-only portrait or beauty close-up. Keep Lucas recognizably the same man with natural skin texture, dark wavy hair, brown-hazel eyes, short stubble and olive skin. "
    "Keep the V5 visual feeling: relaxed dark shirt, tiny handheld micro-shake, minute framing drift, natural breathing, irregular blinks, subtle autofocus/exposure breathing and small gaze shifts between Marion on screen and the lens. "
    "His emotional intention is warm, private and gently amused, like he is genuinely happy to see Marion. His gaze is soft and attentive, with a restrained half-smile, tiny eyebrow reactions and brief eye-brightening before he speaks. "
    "State: SPEAKING IN VERY NATURAL CASUAL FRENCH. Lucas casually says: 'Hey... ça va, toi ? T'as l'air un peu crevée.' "
    "This must feel like spontaneous private conversation, NOT a written sentence being read. He starts softly, lets 'hey' fall out naturally, leaves a tiny imperfect pause, slightly swallows some syllables in connected speech, breathes between thought groups, and lets the final words trail naturally rather than landing like an announcer. "
    "Use everyday French rhythm: contractions, linked words, unequal word lengths, slight reductions, soft consonants, tiny hesitation, small breath noises and natural sentence melody. "
    "Absolutely avoid careful textbook diction, perfectly separated words, evenly timed syllables, synthetic TTS rhythm, presenter voice or radio delivery. "
    "His speech must also read visually when muted: natural jaw motion, varied lip shapes, occasional teeth visibility, cheek movement, tiny head and eyebrow reactions aligned with emphasis. "
    "No theatrical acting, no cinematic dolly, no frozen pose, no head-only crop. "
    "Treat any phone UI already present in the source as static framing reference only; do not invent extra text, captions, subtitles or interface elements."
)

NEGATIVE = (
    "head-only portrait, extreme close-up, studio portrait, beauty lighting, blank stare, presenter gaze, frozen mouth, weak lip movement, "
    "robotic speech, text-to-speech cadence, careful textbook French, over-articulated consonants, separated words, evenly timed syllables, announcer voice, radio voice, "
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
        key="lucas-visio-speaking-fr-layout-v6",
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
    parser = argparse.ArgumentParser(description="Generate MonIA Lucas natural casual French visio candidate V6")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()
    path, provider = generate()
    print(f"MONIA_VISIO_LAYOUT_V6 compute={provider} output={path} bytes={path.stat().st_size}")
    if args.publish_candidate:
        url = engine.publish_candidate(path)
        print(f"MONIA_VISIO_LAYOUT_V6_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
