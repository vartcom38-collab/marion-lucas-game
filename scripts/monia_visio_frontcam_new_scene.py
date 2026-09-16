from __future__ import annotations

import argparse
from dataclasses import replace
from pathlib import Path

from PIL import Image

import scripts.monia_video_engine as engine

REFERENCE_IMAGE = Path("resources/monia/canon/lucas/visio-layout-reference.jpg")
OUTPUT_NAME = "visio-lucas-frontcam-ecru-evening-candidate.mp4"

PROMPT = (
    "Create a NEW ultra-realistic smartphone FRONT-CAMERA video call with Lucas, using the supplied validated visio frame ONLY as camera-composition authority. "
    "This must feel exactly like a real private video call seen from Lucas's own phone front camera: intimate arm-length distance, head plus shoulders plus upper torso visible, one forearm naturally near the lower edge, tiny handheld micro-shake, minute imperfect framing drift, realistic front-camera perspective, subtle autofocus and exposure breathing. "
    "Do NOT show the phone itself and do NOT create an external camera angle. The viewer IS the phone front camera. "
    "Keep Lucas recognizably the same man: dark wavy hair with a few loose strands, short beard/stubble, olive/tanned skin, deep cool green-hazel eyes with gray-green/olive outer iris and subtle amber near the pupil, natural skin texture, same face and proportions. "
    "NEW VISIO MOMENT, clearly different from the black-shirt reference: Lucas has just come home near the end of the day. He wears a fitted off-white/ecru crew-neck T-shirt, not a black shirt. His hair is slightly more tousled, as if he has just run a hand through it. If a forearm is naturally visible, his canonical tattoos may appear naturally; do not invent excessive new tattoos. "
    "The room is a different lived-in setting with soft late-afternoon natural window light and a warm neutral wall/background, realistic shallow phone-camera depth, no cinematic lighting, no studio look. "
    "Lucas looks first at Marion on the screen, then briefly into the lens, with a tiny spontaneous smile and the easy familiarity of calling someone he loves for no special reason. Natural breathing, irregular blinks, small eyebrow reactions, tiny head and shoulder shifts. "
    "He casually says in natural contemporary French: 'Salut ma chérie... je pensais à toi, alors je t'appelle deux minutes. Tu fais quoi ?' "
    "The line must sound spontaneous and relaxed, not read: connected speech, unequal word timing, one or two tiny natural hesitations, soft everyday consonants, subtle breath noise, no announcer cadence, no robotic segmentation. "
    "His jaw, lips, cheeks, eyes and tiny head movements must behave like one continuous human performance. "
    "No cinematic zoom, no dolly, no cut, no reframing, no beauty close-up, no presenter pose, no subtitles, no captions, no generated phone UI, no other person in frame."
)

NEGATIVE = (
    "external camera angle, visible phone, phone in hand visible to viewer, tripod shot, cinematic portrait, studio portrait, beauty close-up, head-only crop, "
    "black shirt, formal shirt, suit, duplicate old scene, copied background, copied lighting, "
    "robotic speech, text-to-speech cadence, separated words, evenly timed syllables, announcer voice, radio voice, trailer voice, exaggerated acting, "
    "blank stare, frozen face, weak mouth movement, identity drift, different man, face morphing, brown eyes, blue eyes, turquoise eyes, neon eyes, "
    "extra people, extra hands, captions, subtitles, UI text, watermark, zoom-in, dolly, pan, cut, cinematic camera move"
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
        key="lucas-visio-frontcam-ecru-evening",
        prompt=PROMPT,
        negative=NEGATIVE,
        width=576,
        height=1024,
        aspect_ratio="9:16 (Portrait)",
        duration=7,
        output_name=OUTPUT_NAME,
    )
    source = engine.WORK_DIR / "lucas-visio-frontcam-ecru-reference.png"
    target = engine.WORK_DIR / OUTPUT_NAME
    prepare_reference(source, profile.width, profile.height)
    target.unlink(missing_ok=True)

    provider, errors = engine.race_compute(profile, source, target)
    if errors:
        print("MONIA_VISIO_FRONTCAM_RACE_ERRORS " + " || ".join(errors), flush=True)
    if not engine.worker.looks_like_video(target):
        raise RuntimeError("Generated candidate is not a valid video")
    return target, provider


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a new Lucas front-camera visio using the validated V7 camera mechanics")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()
    path, provider = generate()
    print(f"MONIA_VISIO_FRONTCAM_NEW compute={provider} output={path} bytes={path.stat().st_size}")
    if args.publish_candidate:
        url = engine.publish_candidate(path)
        print(f"MONIA_VISIO_FRONTCAM_NEW_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
