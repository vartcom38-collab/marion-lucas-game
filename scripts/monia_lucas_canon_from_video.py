from __future__ import annotations

import argparse
import ftplib
import os
import subprocess
from pathlib import Path

import requests
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


def ensure_remote_dir(ftp, path: str) -> None:
    ftp.cwd('/')
    for part in [p for p in path.split('/') if p]:
        try:
            ftp.cwd(part)
        except ftplib.error_perm:
            ftp.mkd(part)
            ftp.cwd(part)


def looks_like_mp4(path: Path) -> bool:
    if not path.exists() or path.stat().st_size < 1024 * 1024:
        return False
    try:
        head = path.read_bytes()[:32]
    except OSError:
        return False
    return b'ftyp' in head


def download_drive_source(file_id: str, target: Path) -> None:
    session = requests.Session()
    urls = [
        f'https://drive.usercontent.google.com/download?id={file_id}&export=download&confirm=t',
        f'https://drive.google.com/uc?export=download&id={file_id}&confirm=t',
    ]
    errors: list[str] = []
    for url in urls:
        target.unlink(missing_ok=True)
        try:
            with session.get(url, stream=True, timeout=180, allow_redirects=True) as response:
                response.raise_for_status()
                content_type = response.headers.get('Content-Type', '')
                if content_type.startswith('text/html'):
                    errors.append(f'HTML response from {url}')
                    continue
                with target.open('wb') as fh:
                    for chunk in response.iter_content(1024 * 1024):
                        if chunk:
                            fh.write(chunk)
            if looks_like_mp4(target):
                print(f'Downloaded Lucas source from Drive: {target.stat().st_size} bytes')
                return
            errors.append(f'Invalid MP4 from {url}: {target.stat().st_size if target.exists() else 0} bytes')
        except Exception as exc:
            errors.append(f'{type(exc).__name__}: {exc}')
    target.unlink(missing_ok=True)
    raise RuntimeError('Unable to download shared Lucas source from Drive: ' + ' | '.join(errors[-4:]))


def upload_private_source(ftp, root: str, source: Path) -> str:
    remote_path = private_source_path(root)
    ensure_remote_dir(ftp, str(Path(remote_path).parent).replace('\\', '/'))
    with source.open('rb') as fh:
        ftp.storbinary('STOR source.mp4', fh, blocksize=1024 * 1024)
    print(f'Uploaded Lucas source to private Infomaniak storage: {remote_path}')
    return remote_path


def fetch_source(target: Path) -> tuple[object, str]:
    ftp = worker.ftp_connect()
    root = worker.remote_root(ftp)
    path = private_source_path(root)
    try:
        with target.open('wb') as fh:
            ftp.retrbinary(f'RETR {path}', fh.write, blocksize=1024 * 1024)
        if looks_like_mp4(target):
            print(f'Loaded private Lucas source from Infomaniak: {target.stat().st_size} bytes')
            return ftp, root
        target.unlink(missing_ok=True)
    except ftplib.all_errors:
        target.unlink(missing_ok=True)

    drive_file_id = os.environ.get('LUCAS_DRIVE_FILE_ID', '').strip()
    if not drive_file_id:
        try:
            ftp.quit()
        except Exception:
            pass
        raise FileNotFoundError(f'Private Lucas source video not found at {path} and LUCAS_DRIVE_FILE_ID is empty')

    download_drive_source(drive_file_id, target)
    upload_private_source(ftp, root, target)
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


def upload_refs(ftp, root: str, refs: dict[str, Path]) -> None:
    remote = canon_dir(root)
    ensure_remote_dir(ftp, remote)
    for name, path in refs.items():
        filename = f'reference-{name}.jpg'
        with path.open('rb') as fh:
            ftp.storbinary(f'STOR {filename}', fh, blocksize=1024 * 1024)
        print(f'Uploaded {filename}: {path.stat().st_size} bytes')
    # Primary frame becomes the canonical start image used by current image-to-video providers.
    with refs['primary'].open('rb') as fh:
        ftp.storbinary('STOR reference.jpg', fh, blocksize=1024 * 1024)
    print('Promoted reference-primary.jpg -> reference.jpg')


def main() -> None:
    parser = argparse.ArgumentParser(description='Build Lucas canon directly from his private source video')
    parser.add_argument('--keep-source', action='store_true')
    args = parser.parse_args()

    source = WORK / 'source.mp4'
    ftp, root = fetch_source(source)
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
