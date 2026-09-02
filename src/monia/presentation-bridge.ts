const LAST_VISIO_KEY = 'monia-last-visio-v1';
const ITEM_PREFIX = 'monia-presentation-item-v1:';
const SCENE_SNAPSHOT_KEY = 'monia-scene-snapshot-v1';

function id(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function read(key: string) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function write(key: string, value: string) {
  try { sessionStorage.setItem(key, value); } catch { /* optional cache */ }
}

function freezeVisioButton(button: HTMLElement) {
  if (button.dataset.moniaPresentationId) return;
  const snapshot = read(LAST_VISIO_KEY);
  if (!snapshot) return;
  const itemId = id('visio');
  write(`${ITEM_PREFIX}${itemId}`, snapshot);
  button.dataset.moniaPresentationId = itemId;
}

function freezeSceneOffer(node: HTMLElement) {
  if (node.dataset.moniaPresentationId) return;
  let snapshot = '';
  try {
    const raw = localStorage.getItem('marion-lucas-save-v4');
    if (raw) {
      const save = JSON.parse(raw) as { flags?: Record<string, string | number | boolean> };
      snapshot = String(save.flags?.moniaLastDirector || '');
    }
  } catch { /* optional cache */ }
  if (!snapshot) return;
  const itemId = id('scene');
  write(`${ITEM_PREFIX}${itemId}`, snapshot);
  write(SCENE_SNAPSHOT_KEY, itemId);
  node.dataset.moniaPresentationId = itemId;
}

function scan(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-monia-visio]').forEach(freezeVisioButton);
  const sceneOffer = root.querySelector<HTMLElement>('#moniaSceneOffer');
  if (sceneOffer) freezeSceneOffer(sceneOffer);
}

// This capture listener runs before the legacy integration listener because this
// module is loaded first. It restores the exact snapshot belonging to the button,
// then lets the existing renderer open it normally.
document.addEventListener('click', event => {
  const target = event.target as HTMLElement | null;
  const visio = target?.closest<HTMLElement>('[data-monia-visio]');
  if (visio?.dataset.moniaPresentationId) {
    const snapshot = read(`${ITEM_PREFIX}${visio.dataset.moniaPresentationId}`);
    if (snapshot) write(LAST_VISIO_KEY, snapshot);
  }

  const playScene = target?.closest<HTMLElement>('#playMoniaScene');
  if (playScene) {
    const offer = playScene.closest<HTMLElement>('#moniaSceneOffer');
    const itemId = offer?.dataset.moniaPresentationId || read(SCENE_SNAPSHOT_KEY);
    if (itemId) {
      const snapshot = read(`${ITEM_PREFIX}${itemId}`);
      if (snapshot) {
        try {
          const raw = localStorage.getItem('marion-lucas-save-v4');
          if (raw) {
            const save = JSON.parse(raw) as { flags?: Record<string, string | number | boolean> };
            const flags = save.flags || (save.flags = {});
            flags.moniaLastDirector = snapshot;
            localStorage.setItem('marion-lucas-save-v4', JSON.stringify(save));
          }
        } catch { /* never block scene playback */ }
      }
    }
  }
}, true);

const observer = new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches('[data-monia-visio]')) freezeVisioButton(node);
      if (node.id === 'moniaSceneOffer') freezeSceneOffer(node);
      scan(node);
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
scan();

console.info('[MonIA] Per-interaction presentation snapshots active');
