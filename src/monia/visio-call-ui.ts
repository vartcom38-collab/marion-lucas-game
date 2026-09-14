const OVERLAY_ID='moniaVisioOverlay';

function ensureStyle(){if(document.getElementById('moniaRealVisioStyle'))return;const style=document.createElement('style');style.id='moniaRealVisioStyle';style.textContent=`
#moniaVisioOverlay{background:#050505!important}
#moniaVisioOverlay [data-monia-demo-copy]{display:none!important}
#moniaVisioOverlay #closeMoniaVisio{display:none!important}
#moniaVisioOverlay [data-monia-live-state]{display:none!important}
#moniaVisioOverlay .moniaReferenceStatus{position:absolute;z-index:15;top:max(18px,env(safe-area-inset-top));left:24px;right:24px;display:flex;align-items:center;justify-content:space-between;pointer-events:none;color:white;text-shadow:0 2px 12px rgba(0,0,0,.72);font:700 16px/1 system-ui,sans-serif}
#moniaVisioOverlay .moniaStatusLeft,#moniaVisioOverlay .moniaStatusRight{display:flex;align-items:center;gap:10px}
#moniaVisioOverlay .moniaSignal{letter-spacing:-2px;font-size:17px}
#moniaVisioOverlay .moniaWifi{font-size:18px;transform:translateY(-1px)}
#moniaVisioOverlay .moniaPrivacyDot{width:8px;height:8px;border-radius:50%;background:#35d266;box-shadow:0 0 8px rgba(53,210,102,.35)}
#moniaVisioOverlay .moniaBattery{width:25px;height:12px;border:2px solid rgba(255,255,255,.86);border-radius:4px;position:relative;box-sizing:border-box}
#moniaVisioOverlay .moniaBattery::before{content:'';position:absolute;inset:2px 4px 2px 2px;border-radius:1px;background:rgba(255,255,255,.9)}
#moniaVisioOverlay .moniaBattery::after{content:'';position:absolute;right:-5px;top:2px;width:2px;height:5px;border-radius:0 2px 2px 0;background:rgba(255,255,255,.7)}
#moniaVisioOverlay .moniaReferenceControls{position:absolute;z-index:16;left:50%;bottom:max(28px,calc(env(safe-area-inset-bottom) + 18px));transform:translateX(-50%);display:flex;align-items:center;gap:46px;background:transparent;border:0;padding:0}
#moniaVisioOverlay .moniaReferenceBtn{width:64px;height:64px;border:0;border-radius:50%;display:grid;place-items:center;background:rgba(28,28,30,.78);color:white;font:700 24px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.28);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
#moniaVisioOverlay .moniaReferenceBtn.end{width:72px;height:72px;background:#f23d36;font-size:28px}
#moniaVisioOverlay .moniaReferenceBtn.is-off{background:rgba(245,245,247,.92);color:#161616}
#moniaVisioOverlay video#moniaVisioVideo,#moniaVisioOverlay .iphoneApprovedVisioVideo{object-position:center 42%;transform:scale(1.035);transform-origin:center center}
@media(max-width:520px){#moniaVisioOverlay .moniaReferenceStatus{left:16px;right:16px}.moniaReferenceControls{gap:34px!important}.moniaReferenceBtn{width:58px!important;height:58px!important}.moniaReferenceBtn.end{width:66px!important;height:66px!important}}
`;document.head.appendChild(style)}

function decorate(overlay:HTMLElement){if(overlay.dataset.realVisioUi==='2')return;overlay.dataset.realVisioUi='2';ensureStyle();
 const oldEnd=overlay.querySelector<HTMLButtonElement>('#endMoniaVisio');
 const oldReplay=overlay.querySelector<HTMLButtonElement>('#replayMoniaVoice');
 const oldPanel=oldEnd?.parentElement?.parentElement as HTMLElement|null;if(oldPanel)oldPanel.dataset.moniaDemoCopy='1';
 const existingTop=overlay.querySelector<HTMLElement>('div[style*="top:22px"]');if(existingTop)existingTop.dataset.moniaDemoCopy='1';
 overlay.querySelector('.moniaRealCallTop')?.remove();overlay.querySelector('.moniaSelfView')?.remove();overlay.querySelector('.moniaRealCallControls')?.remove();
 const status=document.createElement('div');status.className='moniaReferenceStatus';status.innerHTML='<div class="moniaStatusLeft"><span class="moniaSignal">▮▮▮▮</span><span class="moniaWifi">⌁</span></div><div class="moniaStatusRight"><i class="moniaPrivacyDot"></i><i class="moniaBattery"></i></div>';overlay.appendChild(status);
 const controls=document.createElement('div');controls.className='moniaReferenceControls';controls.innerHTML='<button class="moniaReferenceBtn" data-call-camera aria-label="Caméra">▣</button><button class="moniaReferenceBtn end" data-call-end aria-label="Raccrocher">⌕</button><button class="moniaReferenceBtn" data-call-mic aria-label="Micro">♩</button>';overlay.appendChild(controls);
 controls.querySelectorAll<HTMLButtonElement>('[data-call-camera],[data-call-mic]').forEach(btn=>btn.addEventListener('click',()=>btn.classList.toggle('is-off')));
 controls.querySelector<HTMLButtonElement>('[data-call-end]')?.addEventListener('click',()=>oldEnd?.click());
 if(oldReplay)oldReplay.tabIndex=-1;
}
function scan(){const overlay=document.getElementById(OVERLAY_ID);if(overlay)decorate(overlay)}
new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
window.setTimeout(scan,400);
