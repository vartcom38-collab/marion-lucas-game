from __future__ import annotations

import argparse
import ftplib
import io
import subprocess
from pathlib import Path

from PIL import Image

import scripts.monia_intro_worker as worker

WORK = Path('.monia-video/lucas-canon')
WORK.mkdir(parents=True, exist_ok=True)

# Times chosen from the user's canonical Lucas source video.
FRAME_SPECS = (
    ('serious', 22.0, (55, 80, 512, 900)),
    ('primary', 26.0, (55, 80, 512, 900)),
    ('smile', 30.0, (45, 80, 512, 900)),
)


def private_source_path(root: str) -> str:
    prefix = root.rstrip('/') if root != '/' else ''
    return f'{prefix}/private/monia/lucas/source.mp4'


def canon_dir(root: str) -> str:
    prefix = root.rstrip('/') if root != '/' else ''
    return f'{prefix}/resources/monia/canon/lucas'


def download_private_source(target: Path) -> tuple[object, str]:
    ftp = worker.ftp_connect()
    root = worker.remote_root(ftp)
    path = private_source_path(root)
    try:
        with target.open('wb') as fh:
            ftp.retrbinary(f'RETR {path}', fh.write, blocksize=1024 * 1024)
    except ftplib.all_errors as exc:
        try:
            ftp.quit()
        except Exception:
            pass
        target.unlink(missing_ok=True)
        raise FileNotFoundError(f'Private Lucas source video not found at {path}: {exc}') from exc
    return ftp, root


def normalize_crop(image: Image.Image, box: tuple[int, int, int, int], target: Path) -> None:
    image = image.convert('RGB')
    # The canonical screen recording is 512x1108. Scale crop coordinates if needed.
    sx = image.width / 512
    sy = image.height / 1108
    scaled = tuple(round(v * (sx if i % 2 == 0 else sy)) for i, v in enumerate(box))
    crop = image.crop(scaled)
    ratio = 3 / 4
    source_ratio = crop.width / crop.height
    if source_ratio > ratio:
        new_w = round(crop.height * ratio)
        left = max(0, (crop.width - new_w) // 2)
        crop = crop.crop((left, 0, left + new_w, crop.height))
    elif source_ratio < ratio:
        new_h = round(crop.width / ratio)
        top = max(0, (crop.height - new_h) // 2)
        crop = crop.crop((0, top, crop.width, top + new_h))
    crop.resize((768, 1024), Image.Resampling.LANCZOS).save(target, 'JPEG', quality=94, optimize=True, progressive=True)


def extract_frame(video: Path, seconds: float, target: Path, crop: tuple[int, int, int, int]) -> None:
    raw = target.with_suffix('.raw.jpg')
    subprocess.run([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(seconds), '-i', str(video),
        '-frames:v', '1', '-q:v', '2', str(raw)
    ], check=True, timeout=60)
    normalize_crop(Image.open(raw), crop, target)
    raw.unlink(missing_ok=True)


def ensure_remote_dir(ftp, path: str) -> None:
    ftp.cwd('/')
    for part in [p for p in path.split('/') if p]:
        try:
            ftp.cwd(part)
        except ftplib.error_perm:
            ftp.mkd(part)
            ftp.cwd(part)


def upload_refs(ftp, root: str, refs: dict[str, Path]) -> None:
    remote = canon_dir(root)
    ensure_remote_dir(ftp, remote)
    for name, path in refs.items():
        filename = f'reference-{name}.jpg'
        with path.open('rb') as fh:
            ftp.storbinary(f'STOR {filename}', fh, blocksize=1024 * 1024)
        print(f'Uploaded {filename}: {path.stat().st_size} bytes')
    # Primary frame becomes the canonical start image used by the current image-to-video providers.
    with refs['primary'].open('rb') as fh:
        ftp.storbinary('STOR reference.jpg', fh, blocksize=1024 * 1024)
    print('Promoted reference-primary.jpg -> reference.jpg')


def main() -> None:
    parser = argparse.ArgumentParser(description='Build Lucas canon directly from his private source video')
    parser.add_argument('--keep-source', action='store_true')
    args = parser.parse_args()

    source = WORK / 'source.mp4'
    ftp, root = download_private_source(source)
    try:
        refs: dict[str, Path] = {}
        for name, seconds, crop in FRAME_SPECS:
            target = WORK / f'reference-{name}.jpg'
            extract_frame(source, seconds, target, crop)
            refs[name] = target
            print(f'Extracted Lucas {name} at {seconds:.1f}s -> {target}')
        upload_refs(ftp, root, refs)
    finally:
        try:
            ftp.quit()
        except Exception:
            pass
        if not args.keep_source:
            source.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
