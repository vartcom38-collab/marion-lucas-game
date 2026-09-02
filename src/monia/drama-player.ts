import type { DramaStudioComposition, DramaStudioClip } from './drama-studio';

function sleep(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function speak(text: string) {
  if (!text.trim() || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.trim());
  u.lang = 'fr-FR';
  u.rate = 0.96;
  u.pitch = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find(v => v.lang.toLowerCase().startsWith('fr') && v.localService)
    || voices.find(v => v.lang.toLowerCase().startsWith('fr'));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

function motionTransform(clip: DramaStudioClip, progress: number) {
  const base = clip.scale;
  let scale = base;
  let x = clip.panX;
  let y = clip.panY;
  if (clip.motion === 'push') scale = base * (1 + progress * 0.06);
  if (clip.motion === 'pull') scale = base * (1.06 - progress * 0.06);
  if (clip.motion === 'drift') x += Math.sin(progress * Math.PI) * 1.5;
  return `translate(${x}%,${y}%) scale(${scale})`;
}

export class MonIADramaPlayer {
  private cancelled = false;
  private raf = 0;

  stop() {
    this.cancelled = true;
    cancelAnimationFrame(this.raf);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  async play(composition: DramaStudioComposition, mount: HTMLElement) {
    this.stop();
    this.cancelled = false;
    mount.innerHTML = '';

    const stage = document.createElement('div');
    stage.className = 'moniaDramaStage';
    Object.assign(stage.style, {
      position: 'relative', overflow: 'hidden', background: '#000', borderRadius: '16px',
      width: '100%', aspectRatio: composition.format === '9:16' ? '9 / 16' : '16 / 9',
      maxHeight: '560px', margin: '0 auto',
    });
    mount.appendChild(stage);

    for (const clip of composition.clips) {
      if (this.cancelled) break;
      stage.innerHTML = '';
      if (!clip.media) {
        const missing = document.createElement('div');
        missing.textContent = 'Plan visuel à enrichir';
        Object.assign(missing.style, {display:'grid',placeItems:'center',height:'100%',opacity:'.55'});
        stage.appendChild(missing);
        await sleep(clip.duration * 1000);
        continue;
      }

      const media = clip.media.kind === 'video' ? document.createElement('video') : document.createElement('img');
      media.src = clip.media.src;
      if (media instanceof HTMLVideoElement) {
        media.muted = true;
        media.playsInline = true;
        media.preload = 'auto';
      }
      Object.assign(media.style, {
        width: '100%', height: '100%', objectFit: clip.fit, position: 'absolute', inset: '0',
        transformOrigin: 'center center', willChange: 'transform',
      });
      stage.appendChild(media);

      const start = performance.now();
      const durationMs = clip.duration * 1000;
      const animate = (now: number) => {
        if (this.cancelled) return;
        const p = Math.max(0, Math.min(1, (now - start) / durationMs));
        media.style.transform = motionTransform(clip, p);
        if (p < 1) this.raf = requestAnimationFrame(animate);
      };
      this.raf = requestAnimationFrame(animate);

      if (media instanceof HTMLVideoElement) {
        try { await media.play(); } catch { /* visual still works if autoplay is restricted */ }
      }
      if (clip.dialogue) speak(clip.dialogue);
      await sleep(durationMs);
      if (media instanceof HTMLVideoElement) media.pause();
    }
  }
}

export const moniaDramaPlayer = new MonIADramaPlayer();
