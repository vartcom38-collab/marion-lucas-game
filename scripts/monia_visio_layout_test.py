from __future__ import annotations

import argparse
import base64
from dataclasses import replace
from pathlib import Path

from PIL import Image

import scripts.monia_video_engine as engine

REFERENCE_B64 = Path("resources/monia/canon/lucas/visio-layout-reference.jpg.b64")
OUTPUT_NAME = "visio-lucas-speaking-fr-layout-candidate.mp4"

PROMPT = (
    "Animate the supplied reference as a REAL smartphone front-camera video call with Lucas. "
    "The supplied frame is the composition authority: preserve the same upper-torso framing, the visible shoulder and forearm, "
    "the sense that Lucas is physically holding the phone at arm's length, the intimate phone-camera distance and the warm lived-in room depth. "
    "Do NOT turn this into a head-only portrait or beauty close-up. Keep Lucas recognizably the same man and preserve natural skin texture, dark wavy hair, brown-hazel eyes, short stubble and olive skin. "
    "Lucas is in a relaxed dark shirt and behaves like a real person on a private video call: tiny handheld micro-shake, minute framing drift, natural breathing, irregular blinks, subtle autofocus/exposure breathing, and small gaze shifts between Marion on the screen and the lens. "
    "State: SPEAKING IN FRENCH. For most of the clip Lucas is clearly saying in natural conversational French: 'Ça me fait plaisir de te voir. T'as passé une bonne journée ?' "
    "His speech must be unmistakable even muted: visible jaw opening and closing, changing lip shapes, occasional natural teeth visibility, cheek motion, brief breaths, tiny eyebrow and head movements. "
    "Avoid long closed-mouth pauses. No theatrical acting. No cinematic dolly. No frozen pose. No head-only crop. "
    "Treat any phone UI already present in the source as static framing reference only; do not invent extra text, captions, subtitles or new interface elements."
)

NEGATIVE = (
    "head-only portrait, extreme close-up, studio portrait, beauty lighting, frozen mouth, silent speaking pose, weak lip movement, "
    "mouth nearly closed while speaking, exaggerated acting, identity drift, different man, face morphing, text mutation, caption mutation, "
    "new subtitles, new UI, extra people, extra hands, cinematic camera move, dolly shot, zoom-in"
)


def decode_reference(target: Path, width: int, height: int) -> None:
    raw = base64.b64decode(REFERENCE_B64.read_text(encoding="utf-8").strip())
    original = target.with_suffix(".jpg")
    original.write_bytes(raw)
    image = Image.open(original).convert("RGB")
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
        key="lucas-visio-speaking-fr-layout",
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
    decode_reference(source, profile.width, profile.height)
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
    parser = argparse.ArgumentParser(description="Generate MonIA Lucas layout-based French visio candidate")
    parser.add_argument("--publish-candidate", action="store_true")
    args = parser.parse_args()
    path, provider = generate()
    print(f"MONIA_VISIO_LAYOUT compute={provider} output={path} bytes={path.stat().st_size}")
    if args.publish_candidate:
        url = engine.publish_candidate(path)
        print(f"MONIA_VISIO_LAYOUT_CANDIDATE url={url}")


if __name__ == "__main__":
    main()
