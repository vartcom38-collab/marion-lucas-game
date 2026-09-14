const OVERLAY_ID='moniaVisioOverlay';
let timer=0;
let startedAt=0;

function fmt(seconds:number){const m=Math.floor(seconds/60),s=seconds%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function ensureStyle(){if(document.getElementById('moniaRealVisioStyle'))return;const style=document.createElement('style');style.id='moniaRealVisioStyle';style.textContent=`
#moniaVisioOverlay{background:#050505!important}
#moniaVisioOverlay [data-monia-demo-copy]{display:none!important}
#moniaVisioOverlay .moniaRealCallTop{position:absolute;z-index:12;top:max(18px,env(safe-area-inset-top));left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none;text-shadow:0 2px 14px rgba(0,0,0,.8)}
#moniaVisioOverlay .moniaRealCallTop strong{font:600 17px/1.2 system-ui,sans-serif;color:#fff}
#moniaVisioOverlay .moniaRealCallTop span{font:500 12px/1.2 system-ui,sans-serif;color:rgba(255,255,255,.78)}
#moniaVisioOverlay .moniaSelfView{position:absolute;z-index:12;top:max(70px,calc(env(safe-area-inset-top) + 58px));right:16px;width:92px;height:132px;border-radius:18px;overflow:hidden;background:linear-gradient(145deg,#3b3734,#191817);border:1px solid rgba(255,255,255,.22);box-shadow:0 8px 28px rgba(0,0,0,.35);display:grid;place-items:center;color:rgba(255,255,255,.82)}
#moniaVisioOverlay .moniaSelfView::before{content:'M';width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.12);font:600 17px/1 system-ui,sans-serif}
#moniaVisioOverlay .moniaSelfView span{position:absolute;bottom:8px;font:500 10px/1 system-ui,sans-serif;color:rgba(255,255,255,.72)}
#moniaVisioOverlay .moniaRealCallControls{position:absolute;z-index:13;left:50%;bottom:max(24px,calc(env(safe-area-inset-bottom) + 16px));transform:translateX(-50%);display:flex;gap:13px;align-items:center;padding:10px 12px;border-radius:30px;background:rgba(20,20,20,.34);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.1)}
#moniaVisioOverlay .moniaCallBtn{width:50px;height:50px;border:0;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.16);color:white;font:600 18px/1 system-ui,sans-serif;cursor:pointer;box-shadow:none}
#moniaVisioOverlay .moniaCallBtn.is-off{background:rgba(255,255,255,.9);color:#171717}
#moniaVisioOverlay .moniaCallBtn.end{background:#e33a36;color:white;font-size:21px}
#moniaVisioOverlay [data-monia-live-state]{top:max(56px,calc(env(safe-area-inset-top) + 42px))!important;left:50%!important;transform:translateX(-50%);background:rgba(0,0,0,.28)!important;border:0!important;padding:4px 8px!important;font-size:10px!important;opacity:.72}
#moniaVisioOverlay #closeMoniaVisio{display:none!important}
@media(max-width:520px){#moniaVisioOverlay .moniaSelfView{width:82px;height:118px;right:12px}.moniaRealCallControls{gap:10px!important}.moniaCallBtn{width:48px!important;height:48px!important}}
`;document.head.appendChild(style)}

function decorate(overlay:HTMLElement){if(overlay.dataset.realVisioUi==='1')return;overlay.dataset.realVisioUi='1';ensureStyle();startedAt=Date.now();
 const oldEnd=overlay.querySelector<HTMLButtonElement>('#endMoniaVisio');
 const oldReplay=overlay.querySelector<HTMLButtonElement>('#replayMoniaVoice');
 const oldPanel=oldEnd?.parentElement?.parentElement as HTMLElement|null;if(oldPanel){oldPanel.dataset.moniaDemoCopy='1'}
 const existingTop=overlay.querySelector<HTMLElement>('div[style*="top:22px"]');if(existingTop)existingTop.dataset.moniaDemoCopy='1';
 const top=document.createElement('div');top.className='moniaRealCallTop';top.innerHTML='<strong>Lucas</strong><span data-call-duration>00:00</span>';overlay.appendChild(top);
 const self=document.createElement('div');self.className='moniaSelfView';self.setAttribute('aria-label','Retour caméra de Marion non affiché');self.innerHTML='<span>Vous</span>';overlay.appendChild(self);
 const controls=document.createElement('div');controls.className='moniaRealCallControls';controls.innerHTML='<button class="moniaCallBtn" data-call-mic aria-label="Micro">⌁</button><button class="moniaCallBtn" data-call-camera aria-label="Caméra">▣</button><button class="moniaCallBtn" data-call-speaker aria-label="Haut-parleur">◖</button><button class="moniaCallBtn end" data-call-end aria-label="Raccrocher">⌕</button>';overlay.appendChild(controls);
 controls.querySelectorAll<HTMLButtonElement>('[data-call-mic],[data-call-camera],[data-call-speaker]').forEach(btn=>btn.addEventListener('click',()=>btn.classList.toggle('is-off')));
 controls.querySelector<HTMLButtonElement>('[data-call-camera]')?.addEventListener('click',()=>self.classList.toggle('is-off'));
 controls.querySelector<HTMLButtonElement>('[data-call-end]')?.addEventListener('click',()=>oldEnd?.click());
 // Keep Lucas speech automatic, but remove the artificial replay button from the visible call UI.
 if(oldReplay)oldReplay.tabIndex=-1;
 startTimer(overlay);
}
function startTimer(overlay:HTMLElement){window.clearInterval(timer);const tick=()=>{if(!document.body.contains(overlay)){window.clearInterval(timer);timer=0;return}const el=overlay.querySelector<HTMLElement>('[data-call-duration]');if(el)el.textContent=fmt(Math.max(0,Math.floor((Date.now()-startedAt)/1000)))};tick();timer=window.setInterval(tick,1000)}
function scan(){const overlay=document.getElementById(OVERLAY_ID);if(overlay)decorate(overlay)}
new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
window.setTimeout(scan,400);
