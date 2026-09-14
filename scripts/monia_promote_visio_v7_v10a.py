from __future__ import annotations

import ftplib
import io
import os
import subprocess
from pathlib import Path

import requests

SOURCE_URL = "https://marion-lucas.marionbolomey.fr/resources/monia/generated/visio-lucas-v7-v10a-timing-candidate.mp4?run=34859820027"
OUTPUT_NAME = "lucas-v7-v10a-speaking-approved.mp4"
SITE = "https://marion-lucas.marionbolomey.fr"


def download(url: str, target: Path) -> None:
    r = requests.get(url, timeout=120, headers={"Cache-Control": "no-cache"})
    r.raise_for_status()
    target.write_bytes(r.content)
    if target.stat().st_size < 4096:
        raise RuntimeError("Downloaded visio candidate is too small")


def duration(path: Path) -> float:
    raw = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)
    ], text=True).strip()
    return float(raw)


def remove_trailing_filler(source: Path, target: Path) -> None:
    dur = duration(source)
    audio_end = max(0.5, dur - 0.55)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(source),
        "-filter_complex", f"[0:a]atrim=0:{audio_end:.3f},asetpts=PTS-STARTPTS,apad=pad_dur=1[a]",
        "-map", "0:v:0", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{dur:.3f}", str(target)
    ], check=True, timeout=120)
    if target.stat().st_size < 4096:
        raise RuntimeError("Approved visio output is too small")


def ftp_connect() -> ftplib.FTP_TLS:
    host = os.environ["INFOMANIAK_FTP_HOST"].strip().replace("ftpes://", "").replace("ftps://", "").replace("ftp://", "").rstrip("/")
    user = os.environ["INFOMANIAK_FTP_USER"].strip().replace("\r", "").replace("\n", "")
    password = os.environ["INFOMANIAK_FTP_PASSWORD"].rstrip("\r\n")
    ftp = ftplib.FTP_TLS(timeout=45)
    ftp.connect(host, 21)
    ftp.login(user, password)
    ftp.prot_p()
    ftp.set_pasv(True)
    return ftp


def read_remote_text(ftp: ftplib.FTP_TLS, path: str) -> str:
    buff = io.BytesIO()
    try:
        ftp.retrbinary(f"RETR {path}", buff.write)
        return buff.getvalue().decode("utf-8", errors="ignore")
    except ftplib.all_errors:
        return ""


def remote_root(ftp: ftplib.FTP_TLS) -> str:
    root_index = read_remote_text(ftp, "/index.html").lower()
    if "marion-nimes.mp4" in root_index or "<title>marion & lucas</title>" in root_index:
        return "/"
    configured = "/sites/marion-lucas.marionbolomey.fr"
    current = ftp.pwd()
    try:
        ftp.cwd(configured)
        ftp.cwd(current)
        return configured
    except ftplib.all_errors:
        try:
            ftp.cwd(current)
        except ftplib.all_errors:
            pass
        return "/"


def ensure_dir(ftp: ftplib.FTP_TLS, path: str) -> None:
    ftp.cwd("/")
    for part in [p for p in path.split("/") if p]:
        try:
            ftp.cwd(part)
        except ftplib.error_perm:
            ftp.mkd(part)
            ftp.cwd(part)


def upload(local: Path) -> str:
    ftp = ftp_connect()
    try:
        root = remote_root(ftp)
        directory = (root.rstrip("/") if root != "/" else "") + "/resources/monia/approved/visio"
        ensure_dir(ftp, directory)
        with local.open("rb") as fh:
            ftp.storbinary(f"STOR {OUTPUT_NAME}", fh, blocksize=1024 * 1024)
    finally:
        try:
            ftp.quit()
        except Exception:
            pass
    return f"{SITE}/resources/monia/approved/visio/{OUTPUT_NAME}"


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
