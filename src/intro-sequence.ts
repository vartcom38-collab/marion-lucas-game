// Opening videos are intentionally disabled: a new game should drop straight into play.
// We keep this tiny bridge because main.ts still mounts the legacy cinematic stage.
// As soon as that stage appears, trigger its existing skip/continue path so save-state
// transitions remain exactly the same without loading or playing any intro media.

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

console.info('[Intro] Opening video disabled — new games enter gameplay directly');
