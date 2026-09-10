import io
import os
import tempfile
from pathlib import Path

import torch
import torchaudio as ta
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

app = FastAPI(title='MonIA Voice Service', version='1.0.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in os.getenv('MONIA_ALLOWED_ORIGINS', '*').split(',')],
    allow_credentials=False,
    allow_methods=['GET', 'POST', 'OPTIONS'],
    allow_headers=['*'],
)

DEVICE = 'cuda' if torch.cuda.is_available() else ('mps' if getattr(torch.backends, 'mps', None) and torch.backends.mps.is_available() else 'cpu')
MODEL = None


def model():
    global MODEL
    if MODEL is None:
        MODEL = ChatterboxMultilingualTTS.from_pretrained(device=DEVICE, t3_model='v3')
    return MODEL


@app.get('/health')
def health():
    return {'ok': True, 'engine': 'chatterbox-multilingual-v3', 'device': DEVICE, 'quota': 'self-hosted'}


@app.post('/v1/voice/lucas')
async def lucas_voice(
    text: str = Form(...),
    language: str = Form('fr'),
    exaggeration: float = Form(0.48),
    cfg_weight: float = Form(0.42),
    temperature: float = Form(0.78),
    reference: UploadFile = File(...),
):
    clean = ' '.join(text.split()).strip()[:700]
    if not clean:
        raise HTTPException(400, 'empty text')
    suffix = Path(reference.filename or 'reference.wav').suffix or '.wav'
    data = await reference.read()
    if len(data) < 256:
        raise HTTPException(400, 'invalid reference audio')

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        ref_path = tmp.name
    try:
        m = model()
        kwargs = {
            'language_id': language,
            'audio_prompt_path': ref_path,
            'exaggeration': max(0.0, min(1.5, exaggeration)),
            'cfg_weight': max(0.0, min(1.0, cfg_weight)),
        }
        # temperature support differs between model releases; keep compatibility.
        try:
            wav = m.generate(clean, temperature=max(0.05, min(1.5, temperature)), **kwargs)
        except TypeError:
            wav = m.generate(clean, **kwargs)
        out = io.BytesIO()
        ta.save(out, wav.detach().cpu(), m.sr, format='wav')
        out.seek(0)
        return StreamingResponse(out, media_type='audio/wav', headers={'Cache-Control': 'no-store'})
    except Exception as exc:
        raise HTTPException(500, f'generation failed: {type(exc).__name__}') from exc
    finally:
        try:
            os.unlink(ref_path)
        except OSError:
            pass
