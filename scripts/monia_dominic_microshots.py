from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageFile, ImageStat

ImageFile.LOAD_TRUNCATED_IMAGES = True

import scripts.monia_intro_worker as worker

OUT = Path(".monia-dominic-microshots")
OUT.mkdir(exist_ok=True)

WAN_C_SPACE = "Kpkp21/wan2-video-generation"
WAN_C_LABEL = "Wan 2.2 ZeroGPU C"

SHOTS: list[dict[str, Any]] = [
    {
        "id": "dominic-seated-thought",
        "label": "Dominic assis",
        "referencePath": "private-reference-bootstrap/dominic/dominic-seated-ref.jpg",
        "prompt": (
            "Photorealistic live-action cinematic medium shot of Dominic, strict identity preservation, exact same man as the canonical reference. "
            "Dominic is seated alone in a refined realistic interior, white open-collar shirt, black trousers, canonical neck and chest tattoos visible. "
            "He looks slightly downward for a moment, breathes naturally, then raises his eyes just a little toward something off-screen. "
            "One natural blink only, nearly still body, restrained tension, neutral mouth, no smile. Preserve the exact source-image composition, pose, clothing, tattoos, background, camera position and crop. Do not reframe or redesign the scene. "
            "Frame from around waist to above head, comfortable headroom, external stable camera, warm natural daylight, premium short-drama realism. "
            "No extreme close-up, no zoom, no morphing, no identity drift, no eye drift, no jaw drift, no beard drift, no tattoo drift, no text, no subtitles, no UI."
        ),
    },
    {
        "id": "dominic-window",
        "label": "Dominic fenêtre",
        "referencePath": "private-reference-bootstrap/dominic/dominic-window-ref.jpg",
        "prompt": (
            "Photorealistic live-action cinematic waist-up shot of Dominic, strict identity preservation, exact same man as the canonical reference. "
            "Dominic stands alone near a large window in a refined realistic interior, white open-collar shirt, black trousers, canonical tattoos visible. "
            "Soft golden side light. He looks out of the window, breathes naturally, blinks once, then makes a very small head turn back toward the room under 10 degrees. "
            "Calm controlled masculine presence, neutral mouth, almost no body movement. Preserve the exact source-image composition, pose, clothing, tattoos, background, camera position and crop. Do not reframe or redesign the scene. "
            "Stable external camera, comfortable headroom, premium short-drama realism. "
            "No extreme close-up, no zoom, no morphing, no identity drift, no eye drift, no jaw drift, no beard drift, no tattoo drift, no text, no subtitles, no UI."
        ),
    },
    {
        "id": "dominic-offscreen-reaction",
        "label": "Dominic réaction",
        "referencePath": "private-reference-bootstrap/dominic/dominic-reaction-ref.jpg",
        "prompt": (
            "Photorealistic live-action cinematic medium-close shot of Dominic, strict identity preservation, exact same man as the canonical reference. "
            "Dominic is alone in a refined warm interior, white open-collar shirt, canonical neck and chest tattoos visible. "
            "At first he looks slightly to one side, then reacts to a quiet off-screen sound with only a tiny eye shift and subtle brow tension, followed by a small head turn under 8 degrees. "
            "One natural blink and subtle breathing only, neutral mouth, no smile, no exaggerated expression. Preserve the exact source-image composition, pose, clothing, tattoos, background, camera position and crop. Do not reframe or redesign the scene. "
            "Frame from upper chest to head with comfortable headroom, external stable camera, warm realistic light, premium short-drama realism. "
            "No extreme close-up, no zoom, no morphing, no identity drift, no eye drift, no jaw drift, no beard drift, no tattoo drift, no text, no subtitles, no UI."
        ),
    },
]


def fit_wan_portrait(img: Image.Image, target: Path) -> None:
    """Center-crop to Wan C's exact 512x896 canvas before generation."""
    img = img.convert("RGB")
    target_ratio = 512 / 896
    source_ratio = img.width / img.height
    if source_ratio > target_ratio:
        new_w = round(img.height * target_ratio)
        left = max(0, (img.width - new_w) // 2)
        img = img.crop((left, 0, left + new_w, img.height))
    elif source_ratio < target_ratio:
        new_h = round(img.width / target_ratio)
        top = max(0, (img.height - new_h) // 2)
        img = img.crop((0, top, img.width, top + new_h))
    img.resize((512, 896), Image.Resampling.LANCZOS).save(target, "PNG", optimize=True)


def prepare_reference(shot: dict[str, Any]) -> Path:
    target = OUT / f"{shot['id']}-reference.png"
    source = Path(shot["referencePath"])
    if not source.exists():
        raise FileNotFoundError(f"missing validated scene reference: {source}")
    img = Image.open(source)
    img.load()
    fit_wan_portrait(img, target)
    print(
        f"MONIA_VALIDATED_SCENE_REFERENCE {shot['id']} {source} "
        f"source={img.width}x{img.height} prepared=512x896",
        flush=True,
    )
    return target


def _dhash(img: Image.Image) -> int:
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


def _identity_crop(img: Image.Image) -> Image.Image:
    """Dominic occupies the upper-central portrait area in all three locked references."""
    w, h = img.size
    return img.crop((round(w * 0.18), round(h * 0.04), round(w * 0.82), round(h * 0.62)))


def strict_identity_gate(video: Path, reference: Path, shot_id: str, duration: float) -> dict[str, Any]:
    """
    Reject candidates whose upper-central identity region diverges materially
    from the locked source. This is intentionally conservative: these are
    microshots, not free re-generation.
    """
    qa_dir = OUT / "qa" / shot_id
    qa_dir.mkdir(parents=True, exist_ok=True)

    ref = Image.open(reference).convert("RGB").resize((512, 896), Image.Resampling.LANCZOS)
    ref_crop = _identity_crop(ref).resize((192, 192), Image.Resampling.LANCZOS)
    ref_hash = _dhash(ref_crop)

    samples = [
        ("first", min(0.12, max(0.0, duration * 0.08))),
        ("middle", duration / 2),
        ("last", max(0.0, duration - 0.05)),
    ]
    scores: list[dict[str, Any]] = []

    for label, sec in samples:
        png = qa_dir / f"identity-{label}.png"
        worker.subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-ss", f"{sec:.3f}", "-i", str(video), "-frames:v", "1", str(png),
            ],
            check=True,
            timeout=45,
        )
        frame = Image.open(png).convert("RGB").resize((512, 896), Image.Resampling.LANCZOS)
        crop = _identity_crop(frame).resize((192, 192), Image.Resampling.LANCZOS)

        diff = ImageChops.difference(ref_crop, crop)
        mean_abs = sum(ImageStat.Stat(diff).mean) / 3.0
        hash_distance = (ref_hash ^ _dhash(crop)).bit_count()

        # Locked-composition microshots should remain close to their source.
        # Either a very large luminance/color departure or a large structural
        # departure means Dominic/scene has drifted and must not be published.
        if mean_abs > 62.0 or hash_distance > 30:
            raise RuntimeError(
                f"{shot_id}: STRICT_IDENTITY_REJECT {label} "
                f"mean_abs={mean_abs:.2f} dhash={hash_distance}/64"
            )

        scores.append({
            "label": label,
            "time": round(sec, 3),
            "meanAbsDiff": round(mean_abs, 3),
            "dHashDistance": hash_distance,
            "pass": True,
        })

    result = {
        "strictIdentityPass": True,
        "reference": str(reference),
        "thresholds": {"meanAbsDiffMax": 62.0, "dHashDistanceMax": 30},
        "samples": scores,
    }
    (qa_dir / "identity.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"MONIA_STRICT_IDENTITY_PASS {shot_id} {scores}", flush=True)
    return result


def generate_wan_c(source: Path, prompt: str, target: Path) -> tuple[str, list[str]]:
    target.unlink(missing_ok=True)
    attempts: list[str] = []
    try:
        # worker._wan_child generic Wan branch is the locked Wan C contract:
        # width=512, height=896, frames=25, steps=20, guidance=3, seed=-1.
        worker.run_wan_with_timeout(WAN_C_SPACE, WAN_C_LABEL, source, prompt, target)
        print(
            f"MONIA_WAN_C_READY size=512x896 frames=25 steps=20 bytes={target.stat().st_size}",
            flush=True,
        )
        return WAN_C_LABEL, attempts
    except Exception as exc:
        target.unlink(missing_ok=True)
        msg = f"{WAN_C_LABEL}: {exc}"
        attempts.append(msg)
        raise RuntimeError("WAN_ONLY failed: " + " | ".join(attempts)) from exc


def upload_nested(ftp, root: str, local: Path, remote_name: str) -> str:
    directory = (root.rstrip("/") if root != "/" else "") + "/resources/monia/generated/dominic-microshots"
    worker.ensure_dir(ftp, directory)
    with local.open("rb") as fh:
        ftp.storbinary(f"STOR {remote_name}", fh, blocksize=1024 * 1024)
    return f"/resources/monia/generated/dominic-microshots/{remote_name}"


def main() -> int:
    generated = []
    for shot in SHOTS:
        source = prepare_reference(shot)
        target = OUT / f"{shot['id']}.mp4"
        provider, attempts = generate_wan_c(source, shot["prompt"], target)

        technical = worker.validate_video_candidate(target, shot["id"])
        identity = strict_identity_gate(
            target,
            source,
            shot["id"],
            float(technical["duration"]),
        )
        qa = {
            "technical": technical,
            "identity": identity,
            "strictVisualRejection": True,
        }

        generated.append({
            "id": shot["id"],
            "label": shot["label"],
            "file": target,
            "provider": provider,
            "attempts": attempts,
            "qa": qa,
        })

    # Nothing is uploaded until all three candidates have passed both gates.
    ftp = worker.ftp_connect()
    try:
        root = worker.remote_root(ftp)
        manifest_shots = []
        for item in generated:
            url = upload_nested(ftp, root, item["file"], item["file"].name)
            manifest_shots.append({
                "id": item["id"],
                "label": item["label"],
                "videoUrl": url,
                "provider": item["provider"],
                "wanContract": {
                    "mode": "wan-only",
                    "provider": WAN_C_LABEL,
                    "width": 512,
                    "height": 896,
                    "frames": 25,
                    "steps": 20,
                },
                "candidateOnly": True,
                "humanApprovalRequired": True,
                "technicalQa": item["qa"],
            })

        manifest = {
            "version": 2,
            "generatedBy": "MonIA Dominic microshot worker",
            "candidateOnly": True,
            "narrativeAuthority": False,
            "wanOnly": True,
            "strictVisualRejection": True,
            "shots": manifest_shots,
        }
        manifest_path = OUT / "manifest.json"
        manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        upload_nested(ftp, root, manifest_path, "manifest.json")
    finally:
        ftp.quit()

    print(
        json.dumps(
            {"ok": True, "shots": [{"id": x["id"], "provider": x["provider"]} for x in generated]},
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
