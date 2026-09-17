import { readInteractiveScene, type MonIAInteractiveScene } from './interactive-scene';

const ID='moniaInteractiveChoiceOverlay';

function remove(){document.getElementById(ID)?.remove()}

function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char))}

function render(scene:MonIAInteractiveScene){
  remove();
  if(scene.state!=='awaiting-choice')return;
  const overlay=document.createElement('div');
  overlay.id=ID;
  overlay.style.cssText='position:fixed;inset:0;z-index:99997;pointer-events:none;display:flex;align-items:flex-end;justify-content:center;padding:0 22px 34px;font-family:system-ui,sans-serif';
  const choices=scene.choices.map((choice,index)=>`<button data-choice="${escapeHtml(choice.id)}" style="pointer-events:auto;border:1px solid rgba(255,255,255,.22);background:rgba(18,15,13,.72);backdrop-filter:blur(16px);color:white;border-radius:18px;padding:13px 16px;text-align:left;font-size:14px;line-height:1.3;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.22)"><span style="opacity:.6;margin-right:8px">${index+1}</span>${escapeHtml(choice.label)}</button>`).join('');
  overlay.innerHTML=`<div style="width:min(820px,100%);display:grid;gap:10px"><div style="display:grid;gap:8px">${choices}</div><form id="moniaInteractiveFreeForm" style="pointer-events:auto;display:flex;gap:8px;background:rgba(18,15,13,.68);backdrop-filter:blur(16px);padding:8px;border-radius:18px;border:1px solid rgba(255,255,255,.16)"><input id="moniaInteractiveFreeInput" autocomplete="off" placeholder="Dire ou faire autre chose…" style="flex:1;min-width:0;border:0;outline:0;background:transparent;color:white;padding:9px 10px;font-size:14px"><button type="submit" style="border:0;border-radius:12px;padding:9px 14px;background:rgba(255,255,255,.92);color:#17120f;font-weight:650;cursor:pointer">Continuer</button></form></div>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(button=>button.addEventListener('click',()=>{
    const choiceId=button.dataset.choice;if(!choiceId)return;
    window.dispatchEvent(new CustomEvent('monia-interactive-player-input',{detail:{sceneId:scene.id,choiceId}}));
    remove();
  }));
  overlay.querySelector<HTMLFormElement>('#moniaInteractiveFreeForm')?.addEventListener('submit',event=>{
    event.preventDefault();
    const input=overlay.querySelector<HTMLInputElement>('#moniaInteractiveFreeInput');
    const freeText=input?.value.trim()||'';if(!freeText)return;
    window.dispatchEvent(new CustomEvent('monia-interactive-player-input',{detail:{sceneId:scene.id,freeText}}));
    remove();
  });
}

window.addEventListener('monia-interactive-scene',event=>render((event as CustomEvent<MonIAInteractiveScene>).detail));
window.addEventListener('beforeunload',remove);

const current=readInteractiveScene();if(current)render(current);
console.info('[MonIA] Desktop/tablet interactive choice overlay active · scene remains visible · free response enabled');
