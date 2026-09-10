#!/usr/bin/env python3
import argparse
import json
import math
import os
import subprocess
import tempfile
from pathlib import Path


def cosine(a, b):
    if a is None or b is None:
        return None
    dot=sum(float(x)*float(y) for x,y in zip(a,b))
    na=math.sqrt(sum(float(x)*float(x) for x in a))
    nb=math.sqrt(sum(float(y)*float(y) for y in b))
    if not na or not nb:
        return None
    return dot/(na*nb)


def extract_frames(video:Path, out_dir:Path, fps=2):
    pattern=str(out_dir/'frame-%04d.jpg')
    subprocess.run([
        'ffmpeg','-y','-v','error','-i',str(video),'-vf',f'fps={fps}',
        '-q:v','2',pattern
    ],check=True,timeout=120)
    return sorted(out_dir.glob('frame-*.jpg'))


def load_insightface():
    try:
        import cv2  # noqa: F401
        from insightface.app import FaceAnalysis
        return FaceAnalysis
    except Exception:
        return None


def largest_face(app, image_path:Path):
    import cv2
    image=cv2.imread(str(image_path))
    if image is None:
        return None
    faces=app.get(image)
    if not faces:
        return None
    return max(faces,key=lambda f:max(1,(f.bbox[2]-f.bbox[0]))*max(1,(f.bbox[3]-f.bbox[1])))


def inspect(video:Path, reference:Path|None, sample_fps:float):
    FaceAnalysis=load_insightface()
    if FaceAnalysis is None:
        return {
            'available':False,
            'backend':'none',
            'reason':'InsightFace/OpenCV non disponible. Aucun score d’identité n’est inventé; validation humaine requise.',
            'identityScore':None,
            'temporalIdentityScore':None,
            'facePresenceRate':None,
            'autoReject':False,
        }

    try:
        app=FaceAnalysis(name='buffalo_l',providers=['CPUExecutionProvider'])
        app.prepare(ctx_id=-1,det_size=(640,640))
    except Exception as exc:
        return {
            'available':False,'backend':'insightface','reason':f'initialisation impossible: {exc}',
            'identityScore':None,'temporalIdentityScore':None,'facePresenceRate':None,'autoReject':False,
        }

    ref_embedding=None
    if reference and reference.is_file():
        face=largest_face(app,reference)
        if face is not None:
            ref_embedding=face.normed_embedding.tolist()

    with tempfile.TemporaryDirectory(prefix='monia-face-') as tmp:
        frames=extract_frames(video,Path(tmp),sample_fps)
        embeddings=[]
        for frame in frames:
            face=largest_face(app,frame)
            embeddings.append(face.normed_embedding.tolist() if face is not None else None)

    present=[e for e in embeddings if e is not None]
    presence=(len(present)/len(embeddings)) if embeddings else 0.0
    temporal_pairs=[]
    previous=None
    for emb in embeddings:
        if emb is None:
            previous=None
            continue
        if previous is not None:
            sim=cosine(previous,emb)
            if sim is not None:
                temporal_pairs.append(sim)
        previous=emb
    temporal=sum(temporal_pairs)/len(temporal_pairs) if temporal_pairs else None
    identity_scores=[]
    if ref_embedding is not None:
        for emb in present:
            sim=cosine(ref_embedding,emb)
            if sim is not None:
                identity_scores.append(sim)
    identity=sum(identity_scores)/len(identity_scores) if identity_scores else None

    # Conservative auto-reject only. Passing never means auto-approval.
    reasons=[]
    if presence < 0.60:
        reasons.append('face presence below 60% of sampled frames')
    if temporal is not None and temporal < 0.45:
        reasons.append('severe temporal face inconsistency')
    if identity is not None and identity < 0.40:
        reasons.append('severe mismatch against locked Lucas reference')

    return {
        'available':True,
        'backend':'insightface-buffalo_l',
        'sampledFrames':len(embeddings),
        'facesDetected':len(present),
        'facePresenceRate':round(presence,4),
        'identityScore':round(identity,4) if identity is not None else None,
        'temporalIdentityScore':round(temporal,4) if temporal is not None else None,
        'referenceUsed':str(reference) if ref_embedding is not None else None,
        'autoReject':bool(reasons),
        'reasons':reasons,
        'note':'Scores are preflight signals only. They can reject obvious failures but can never approve or publish a clip.',
    }


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('video')
    parser.add_argument('--reference',default=os.environ.get('MONIA_LUCAS_REFERENCE',''))
    parser.add_argument('--sample-fps',type=float,default=2.0)
    args=parser.parse_args()
    video=Path(args.video)
    reference=Path(args.reference) if args.reference else None
    try:
        result=inspect(video,reference,args.sample_fps)
    except Exception as exc:
        result={'available':False,'backend':'error','reason':str(exc),'identityScore':None,'temporalIdentityScore':None,'facePresenceRate':None,'autoReject':False}
    print(json.dumps(result,ensure_ascii=False))


if __name__=='__main__':
    main()
