// Opening videos stay disabled by design: a new game enters gameplay directly.
// main.ts still mounts the legacy cinematic stage, so this bridge immediately
// follows its existing skip path without loading or playing intro media.

function skipOpeningVideo(stage: HTMLElement) {
  if (stage.dataset.sequenceMounted === '1') return;
  const skip = stage.querySelector<HTMLButtonElement>('#skip');
  if (!skip) return;
  stage.dataset.sequenceMounted = '1';

  const legacy = stage.querySelector<HTMLVideoElement>('#cineA');
  if (legacy) {
    legacy.pause();
    legacy.onended = null;
    legacy.ontimeupdate = null;
    legacy.removeAttribute('src');
    legacy.load();
  }

  queueMicrotask(() => skip.click());
}

function scan() {
  const stage = document.querySelector<HTMLElement>('.teaserCine');
  if (stage) skipOpeningVideo(stage);
}

const observer = new MutationObserver(scan);
observer.observe(document.documentElement, { childList: true, subtree: true });
scan();

console.info('[Intro] Opening videos disabled — new games enter gameplay directly');
