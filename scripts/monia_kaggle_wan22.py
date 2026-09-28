from __future__ import annotations

import argparse
import json
import os
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
import subprocess
from pathlib import Path

import torch
from PIL import Image, ImageChops, ImageStat, ImageFile
from diffusers import WanImageToVideoPipeline, AutoencoderKLWan
from diffusers.utils import export_to_video

ImageFile.LOAD_TRUNCATED_IMAGES = True

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

CANON_ONLY = True

REFERENCES = {
    "dominic-seated-thought": "private-reference-canon/dominic/dominic-seated-master.jpg",
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
    for label, sec in [("first", min(0.12, duration * 0.08)), ("middle", duration / 2), ("last", max(0.0, duration - max(0.20, 2.0 / FPS)))]:
        png = out_dir / f"identity-{label}.png"
        extract_frame(video, sec, png)
        if not png.exists():
            # Some short MP4s cannot seek to the exact tail timestamp.
            fallback_sec = max(0.0, min(sec, duration * 0.90))
            extract_frame(video, fallback_sec, png)
        if not png.exists():
            raise RuntimeError(f"QA_FRAME_EXTRACTION_FAILED {label}: t={sec:.3f}s duration={duration:.3f}s")
        frame = Image.open(png).convert("RGB").resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
        crop = identity_crop(frame).resize((192, 192), Image.Resampling.LANCZOS)
        diff = ImageChops.difference(ref_crop, crop)
        mean_abs = sum(ImageStat.Stat(diff).mean) / 3.0
        hdist = (ref_hash ^ dhash(crop)).bit_count()
        # dHash is intentionally only a structural alarm: tiny lighting/crop
        # changes can flip many bits even when the face remains visually close.
        # Reject on a clearly bad pixel-level difference, or when BOTH metrics
        # indicate substantial drift.
        passed = (mean_abs <= 62.0) and not (mean_abs > 28.0 and hdist > 36)
        checks.append({
            "label": label,
            "time": sec,
            "meanAbsDiff": mean_abs,
            "dHashDistance": hdist,
            "pass": passed,
        })
        if not passed:
            raise RuntimeError(
                f"STRICT_IDENTITY_REJECT {label}: mean_abs={mean_abs:.2f}, dhash={hdist}/64"
            )

    return {"structuralSimilarityPass": True, "identityVerified": False, "humanApprovalRequired": True, "samples": checks}


def load_pipeline():
    dtype = torch.float16
    vae = AutoencoderKLWan.from_pretrained(
        MODEL_ID,
        subfolder="vae",
        torch_dtype=torch.float16,
        low_cpu_mem_usage=True,
    )
    pipe = WanImageToVideoPipeline.from_pretrained(
        MODEL_ID,
        vae=vae,
        torch_dtype=dtype,
        low_cpu_mem_usage=True,
    )

    # Kaggle T4 = ~15 GB VRAM. Sequential offload is slower than model
    # offload but releases submodules much more aggressively and prevents
    # the VAE + transformer from co-residing on GPU 0.
    if hasattr(pipe, "enable_sequential_cpu_offload"):
        pipe.enable_sequential_cpu_offload(gpu_id=0)
    elif hasattr(pipe, "enable_model_cpu_offload"):
        pipe.enable_model_cpu_offload(gpu_id=0)

    if hasattr(pipe, "enable_vae_tiling"):
        pipe.enable_vae_tiling()
    if hasattr(pipe, "enable_vae_slicing"):
        pipe.enable_vae_slicing()

    torch.cuda.empty_cache()
    return pipe


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--shot", choices=list(PROMPTS), default="dominic-seated-thought")
    parser.add_argument("--output-dir", default="/kaggle/working/monia-dominic")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--qa-only", action="store_true", help="Validate an existing generated video without regenerating it")
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
    if CANON_ONLY and "private-reference-bootstrap" in str(ref_path):
        raise RuntimeError(
            f"BOOTSTRAP_REFERENCE_BLOCKED: {ref_path}. "
            "Dominic generation must use canonical visual references only."
        )
    print("REFERENCE:", ref_path, flush=True)

    image = prepare_image(ref_path)
    prepared_ref = out_dir / f"{args.shot}-reference.png"
    image.save(prepared_ref)

    video = out_dir / f"{args.shot}.mp4"

    if args.qa_only:
        if not video.exists():
            raise FileNotFoundError(f"QA-only requested but video is missing: {video}")
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

    pipe = load_pipeline()
    generator = torch.Generator(device="cpu").manual_seed(args.seed)

    torch.cuda.empty_cache()
    free_bytes, total_bytes = torch.cuda.mem_get_info(0)
    print(f"CUDA free before generation: {free_bytes / 1024**3:.2f} / {total_bytes / 1024**3:.2f} GiB", flush=True)

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

    export_to_video(output, str(video), fps=FPS)

    qa = strict_identity_gate(video, image, out_dir)
    manifest = {
        "ok": True,
        "provider": "Kaggle free GPU / Wan2.2-TI2V-5B",
        "model": MODEL_ID,
        "shot": args.shot,
        "reference": str(ref_path),
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
