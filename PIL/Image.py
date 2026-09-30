from pathlib import Path

class _ImageProbe:
    def __init__(self, path):
        self.path = Path(path)
    def __enter__(self):
        return self
    def __exit__(self, exc_type, exc, tb):
        return False
    def verify(self):
        raw = self.path.read_bytes()
        if len(raw) < 1000:
            raise OSError("image too small")
        if raw.startswith(b"\xff\xd8") and raw.endswith(b"\xff\xd9"):
            return None
        if raw.startswith(b"\x89PNG\r\n\x1a\n"):
            return None
        if raw[:4] in (b"RIFF",) and b"WEBP" in raw[:16]:
            return None
        raise OSError("unsupported or invalid image")

def open(path):
    return _ImageProbe(path)
