from __future__ import annotations

import ftplib
import os
import subprocess
from pathlib import Path

import requests

SOURCE_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/visio-lucas-v7-v10a-timing-candidate.mp4?run=34859820027"
OUTPUT_NAME = "lucas-v7-v10a-speaking-approved.mp4"
REMOTE_DIR = "/sites/marion-lucas.marionbolomey.fr/resources/monia/approved/visio"


def download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=120, headers={"Cache-Control":"no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError("Downloaded visio candidate is too small")


def duration(path: Path) -> float:
    raw = subprocess.check_output([
        "ffprobe","-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1",str(path)
    ], text=True).strip()
    return float(raw)


def remove_trailing_filler(source: Path, target: Path) -> None:
    dur = duration(source)
    audio_end = max(0.5, dur - 0.55)
    subprocess.run([
        "ffmpeg","-hide_banner","-loglevel","error","-y",
        "-i",str(source),
        "-filter_complex",f"[0:a]atrim=0:{audio_end:.3f},asetpts=PTS-STARTPTS,apad=pad_dur=1[a]",
        "-map","0:v:0","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k","-t",f"{dur:.3f}",str(target)
    ], check=True, timeout=120)
    if target.stat().st_size < 4096:
        raise RuntimeError("Approved visio output is too small")


def ensure_remote_dir(ftp: ftplib.FTP, path: str) -> None:
    current = ""
    for part in path.strip("/").split("/"):
        current += "/" + part
        try:
            ftp.mkd(current)
        except ftplib.error_perm as exc:
            if not str(exc).startswith("550"):
                raise


def secret(name: str) -> str:
    return os.environ[name].strip().replace("\r", "").replace("\n", "")


def upload(local: Path) -> str:
    host = secret("INFOMANIAK_FTP_HOST")
    user = secret("INFOMANIAK_FTP_USER")
    password = secret("INFOMANIAK_FTP_PASSWORD")
    ftp = ftplib.FTP(host, timeout=60)
    ftp.login(user, password)
    ensure_remote_dir(ftp, REMOTE_DIR)
    remote = f"{REMOTE_DIR}/{OUTPUT_NAME}"
    with local.open("rb") as fh:
        ftp.storbinary(f"STOR {remote}", fh)
    ftp.quit()
    return f"https://marion-lucas.marionbolomey.fr/resources/monia/approved/visio/{OUTPUT_NAME}"


def main() -> None:
    work = Path(".monia-work")
    work.mkdir(exist_ok=True)
    source = work / "validated-v7-v10a.mp4"
    output = work / OUTPUT_NAME
    download(SOURCE_URL, source)
    remove_trailing_filler(source, output)
    url = upload(output)
    print(f"MONIA_VISIO_APPROVED url={url} bytes={output.stat().st_size}")


if __name__ == "__main__":
    main()
