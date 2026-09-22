# MonIA Video V2 — isolated Kaggle GPU worker
import base64
import io
import json
import os
from pathlib import Path

import requests

REPO = "vartcom38-collab/marion-lucas-game"
BRANCH = os.environ.get("MONIA_V2_BRANCH", "monia-video-v2")
RAW = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}"
WORK = Path("/kaggle/working/monia-video-v2")
WORK.mkdir(parents=True, exist_ok=True)

def fetch_text(url: str) -> str:
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    return r.text

def fetch_json(url: str):
    return json.loads(fetch_text(url))

def decode_repo_b64(path: str) -> bytes:
    payload = "".join(fetch_text(f"{RAW}/{path}").split())
    payload += "=" * (-len(payload) % 4)
    return base64.b64decode(payload)

def find_job() -> dict:
    candidates = [
        Path("/kaggle/working/job-v2.json"),
        Path("job-v2.json"),
        Path("/kaggle/working/job.json"),
        Path("job.json"),
    ]
    for p in candidates:
        if p.exists():
            return json.loads(p.read_text(encoding="utf-8"))
    return fetch_json(f"{RAW}/.monia-render-queue-v2/lucas-motion-proof-v1.json")

job = find_job()
assert job.get("generator") == "monia-video-v2"
assert job.get("candidateOnly") is True
assert job.get("narrativeAuthority") is False
assert job.get("publishToGame") is False

cfg = fetch_json(f"{RAW}/config/monia-video-v2.json")
refs_cfg = fetch_json(f"{RAW}/config/monia-reference-packs.json")
character = job["character"]
character_cfg = refs_cfg["characters"][character]

# Dependencies are installed inside the Kaggle run so the V2 stays self-contained.
os.system('python -m pip -q install -U "diffusers>=0.35.0" transformers accelerate safetensors imageio[ffmpeg] av huggingface_hub ftfy "pillow==11.3.0"')

import torch
from PIL import Image
from diffusers import LTXImageToVideoPipeline
from diffusers.utils import export_to_video, load_image

if not torch.cuda.is_available():
    raise RuntimeError("MonIA Video V2 requires a Kaggle GPU")

print("GPU:", torch.cuda.get_device_name(0))
print("Job:", job["id"], "Character:", character)

job_dir = WORK / job["id"]
job_dir.mkdir(parents=True, exist_ok=True)

ref_path = job_dir / f"{character}-reference.jpg"
priority = character_cfg.get("priorityImages") or []

if priority:
    raw = decode_repo_b64(priority[0])
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    img.save(ref_path, "JPEG", quality=95)
else:
    fallback = character_cfg.get("fallbackImage")
    if not fallback:
        raise RuntimeError(f"No canonical reference available for {character}")
    r = requests.get(fallback, timeout=120)
    r.raise_for_status()
    img = Image.open(io.BytesIO(r.content)).convert("RGB")
    img.save(ref_path, "JPEG", quality=95)

g = dict(cfg.get("defaults") or {})
g.update(job.get("generation") or {})

pipe = LTXImageToVideoPipeline.from_pretrained(
    cfg["engine"]["model"],
    torch_dtype=torch.float16
)
pipe.enable_model_cpu_offload()

source = load_image(str(ref_path))
generator = torch.Generator(device="cpu").manual_seed(int(g["seed"]))

frames = pipe(
    image=source,
    prompt=job["prompt"],
    negative_prompt=job.get("negativePrompt"),
    width=int(g["width"]),
    height=int(g["height"]),
    num_frames=int(g["frames"]),
    num_inference_steps=int(g["steps"]),
    generator=generator,
).frames[0]

clip_name = "candidate-01.mp4"
clip_path = job_dir / clip_name
export_to_video(frames, str(clip_path), fps=int(g["fps"]))

result = {
    "jobId": job["id"],
    "generator": "monia-video-v2",
    "engine": cfg["engine"]["id"],
    "model": cfg["engine"]["model"],
    "state": "candidate",
    "candidateOnly": True,
    "narrativeAuthority": False,
    "publishToGame": False,
    "character": character,
    "clip": clip_name,
    "settings": g,
}
(job_dir / "result.json").write_text(
    json.dumps(result, ensure_ascii=False, indent=2),
    encoding="utf-8"
)
(job_dir / "job.json").write_text(
    json.dumps(job, ensure_ascii=False, indent=2),
    encoding="utf-8"
)

print("MONIA_V2_OK", clip_path)
