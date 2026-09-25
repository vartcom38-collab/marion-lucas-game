from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path

import torch
from PIL import Image, ImageChops, ImageStat
from diffusers import DiffusionPipeline
from diffusers.utils import export_to_video

MODEL_ID = "Wan-AI/Wan2.2-TI2V-5B-Diffusers"
WIDTH = 512
HEIGHT = 896
FRAMES = 25
STEPS = 20
GUIDANCE = 3.0
FPS = 16

PROMPTS = {
    "dominic-seated-thought": (
        "Photorealistic live-action cinematic medium shot of Dominic, exact same man as the reference image. "
        "Preserve his facial identity, hair, beard, tattoos, clothing, composition and background. "
        "Dominic is seated, nearly still, natural breathing, one blink, then a tiny upward eye movement. "
        "No smile, no camera movement, no zoom, no reframing, no morphing, no identity drift, no text."
    ),
    "dominic-window": (
        "Photorealistic live-action cinematic waist-up shot of Dominic, exact same man as the reference image. "
        "Preserve his facial identity, hair, beard, tattoos, clothing, composition and background. "
        "He stands near the window, natural breathing, one blink, then a tiny head turn under 10 degrees. "
        "No smile, no camera movement, no zoom, no reframing, no morphing, no identity drift, no text."
    ),
    "dominic-offscreen-reaction": (
        "Photorealistic live-action cinematic medium-close shot of Dominic, exact same man as the reference image. "
        "Preserve his facial identity, hair, beard, tattoos, clothing, composition and background. "
        "A tiny eye shift, subtle brow tension, one blink, and a very small head turn under 8 degrees. "
        "No smile, no camera movement, no zoom, no reframing, no morphing, no identity drift, no text."
    ),
}

REFERENCES = {
    "dominic-seated-thought": "private-reference-bootstrap/dominic/dominic-seated-ref.jpg",
    "dominic-window": "private-reference-bootstrap/dominic/dominic-window-ref.jpg",
    "dominic-offscreen-reaction": "private-reference-bootstrap/dominic/dominic-reaction-ref.jpg",
}


def prepare_image(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGB")
    target_ratio = WIDTH / HEIGHT
    source_ratio = img.width / img.height
    if source_ratio > target_ratio:
        new_w = round(img.height * target_ratio)
        left = max(0, (img.width - new_w) // 2)
        img = img.crop((left, 0, left + new_w, img.height))
    elif source_ratio < target_ratio:
        new_h = round(img.width / target_ratio)
        top = max(0, (img.height - new_h) // 2)
        img = img.crop((0, top, img.width, top + new_h))
    return img.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)


def dhash(img: Image.Image) -> int:
    small = img.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    px = list(small.getdata())
    value = 0
    bit = 0
    for y in range(8):
        row = y * 9
        for x in range(8):
            if px[row + x] > px[row + x + 1]:
                value |= 1 << bit
            bit += 1
    return value


def identity_crop(img: Image.Image) -> Image.Image:
    w, h = img.size
    return img.crop((round(w * 0.18), round(h * 0.04), round(w * 0.82), round(h * 0.62)))


def extract_frame(video: Path, sec: float, target: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{sec:.3f}", "-i", str(video), "-frames:v", "1", str(target)],
        check=True,
    )


def strict_identity_gate(video: Path, reference: Image.Image, out_dir: Path) -> dict:
    ref_crop = identity_crop(reference).resize((192, 192), Image.Resampling.LANCZOS)
    ref_hash = dhash(ref_crop)

    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(video)],
        check=True, capture_output=True, text=True
    )
    duration = float(json.loads(probe.stdout)["format"]["duration"])
    checks = []
    for label, sec in [("first", min(0.12, duration * 0.08)), ("middle", duration / 2), ("last", max(0.0, duration - 0.05))]:
        png = out_dir / f"identity-{label}.png"
        extract_frame(video, sec, png)
        frame = Image.open(png).convert("RGB").resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
        crop = identity_crop(frame).resize((192, 192), Image.Resampling.LANCZOS)
        diff = ImageChops.difference(ref_crop, crop)
        mean_abs = sum(ImageStat.Stat(diff).mean) / 3.0
        hdist = (ref_hash ^ dhash(crop)).bit_count()
        passed = mean_abs <= 62.0 and hdist <= 30
        checks.append({"label": label, "time": sec, "meanAbsDiff": mean_abs, "dHashDistance": hdist, "pass": passed})
        if not passed:
            raise RuntimeError(f"STRICT_IDENTITY_REJECT {label}: mean_abs={mean_abs:.2f}, dhash={hdist}/64")

    return {"strictIdentityPass": True, "samples": checks}


def load_pipeline():
    dtype = torch.float16
    pipe = DiffusionPipeline.from_pretrained(
        MODEL_ID,
        torch_dtype=dtype,
        low_cpu_mem_usage=True,
    )

    # Kaggle T4 = 16 GB VRAM. Keep only active modules on GPU.
    if hasattr(pipe, "enable_model_cpu_offload"):
        pipe.enable_model_cpu_offload(gpu_id=0)
    if hasattr(pipe, "enable_vae_tiling"):
        pipe.enable_vae_tiling()
    if hasattr(pipe, "enable_vae_slicing"):
        pipe.enable_vae_slicing()

    return pipe


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--shot", choices=list(PROMPTS), default="dominic-seated-thought")
    parser.add_argument("--output-dir", default="/kaggle/working/monia-dominic")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    if not torch.cuda.is_available():
        raise SystemExit("CUDA GPU unavailable: enable Kaggle GPU accelerator first")

    print("GPU:", torch.cuda.get_device_name(0), flush=True)
    print("MODEL:", MODEL_ID, flush=True)
    print(f"CONTRACT: {WIDTH}x{HEIGHT} frames={FRAMES} steps={STEPS} guidance={GUIDANCE}", flush=True)

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    ref_path = Path(REFERENCES[args.shot])
    if not ref_path.exists():
        raise FileNotFoundError(ref_path)

    image = prepare_image(ref_path)
    prepared_ref = out_dir / f"{args.shot}-reference.png"
    image.save(prepared_ref)

    pipe = load_pipeline()
    generator = torch.Generator(device="cpu").manual_seed(args.seed)

    output = pipe(
        image=image,
        prompt=PROMPTS[args.shot],
        negative_prompt=(
            "different person, identity drift, face change, eye change, jaw change, beard change, "
            "tattoo change, clothing change, camera movement, zoom, reframing, deformed face, "
            "distorted anatomy, text, subtitles, watermark"
        ),
        height=HEIGHT,
        width=WIDTH,
        num_frames=FRAMES,
        num_inference_steps=STEPS,
        guidance_scale=GUIDANCE,
        generator=generator,
    ).frames[0]

    video = out_dir / f"{args.shot}.mp4"
    export_to_video(output, str(video), fps=FPS)

    qa = strict_identity_gate(video, image, out_dir)
    manifest = {
        "ok": True,
        "provider": "Kaggle free GPU / Wan2.2-TI2V-5B",
        "model": MODEL_ID,
        "shot": args.shot,
        "video": str(video),
        "wanContract": {
            "width": WIDTH,
            "height": HEIGHT,
            "frames": FRAMES,
            "steps": STEPS,
            "guidance": GUIDANCE,
            "mode": "wan-only",
        },
        "qa": qa,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
