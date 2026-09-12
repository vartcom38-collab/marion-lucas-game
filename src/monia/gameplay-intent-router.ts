const SAVE_KEY='marion-lucas-save-v4';

type Save={screen?:string;overlay?:unknown;metLucas?:boolean;official?:boolean;place?:string;flags?:Record<string,unknown>};
function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function click(sel:string){const el=document.querySelector<HTMLElement>(sel);if(!el)return false;el.click();return true}
function later(fn:()=>void,ms=80){window.setTimeout(fn,ms)}
function openPhone(app?:'messages'|'call'|'agenda'){
  const ok=click('#premiumPhone')||click('#phone')||click('#phoneExact');
  if(ok&&app)later(()=>click(`[data-phoneapp="${app}"]`),100);
  return ok;
}
function openMap(){return click('#premiumMap')||click('#worldQuick')||click('#worldExact')}
function openWardrobe(){return click('#premiumWardrobe')}
function openJournal(){return click('#premiumJournal')||click('#journalQuick')||click('#journalExact')}
function openActions(){return click('#actions')||click('#actionsExact')}
function openAgenda(){const ok=click('#premiumAgenda');if(ok)return true;return openPhone('agenda')}
function openLucasDay(){return click('#corridaDay')||openAgenda()}
function openLatestMessage(){return openPhone('messages')}
function openLucasCall(){return openPhone('call')}

function intimacyOverlay(){
  const s=read();if(!s?.metLucas||!s.official)return false;
  const windowState=window.__moniaIntimacyWindow?.();
  if(windowState&&!windowState.available)return false;
  document.getElementById('moniaIntimacyChoice')?.remove();
  const wrap=document.createElement('div');wrap.id='moniaIntimacyChoice';wrap.className='moniaIntimacyChoice';
  wrap.innerHTML=`<section><button type="button" data-close aria-label="Fermer">×</button><span>UN MOMENT À DEUX</span><h3>Lucas est là. Rien ne t’oblige à aller plus loin.</h3><p>Tu peux accepter ce moment, le garder tendre sans aller plus loin, ou simplement dire pas maintenant.</p><div><button type="button" data-intimacy="accept" class="primary">Rester avec lui</button><button type="button" data-intimacy="not-now">Pas maintenant</button></div></section>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click',e=>{const t=e.target as HTMLElement;if(t.closest('[data-close]')){wrap.remove();return}const b=t.closest<HTMLElement>('[data-intimacy]');if(!b)return;const choice=String(b.dataset.intimacy||'not-now') as 'accept'|'not-now';window.__moniaRecordIntimacy?.(choice);wrap.remove();if(choice==='accept')window.dispatchEvent(new CustomEvent('monia:intimacy-cinematic-request',{detail:{fadeToBlack:true,source:'daily-life'}}));});
  return true;
}

function routeFreeText(text:string,kind:string){
  const t=text.toLowerCase();
  if(kind==='phone'||/appel|appeler|visio|sms|message|téléphone|telephone/.test(t)){
    if(/appel|appeler|visio/.test(t)&&/lucas/.test(t))return openLucasCall();
    return openPhone(/agenda/.test(t)?'agenda':'messages');
  }
  if(kind==='travel'||/plage|aller|partir|ville|restaurant|café|cafe|voyage|promen/.test(t))return openMap();
  if(/robe|tenue|shopping|me changer/.test(t))return openWardrobe();
  if(/journal|souvenir/.test(t))return openJournal();
  if(kind==='relationship'&&/lucas|ensemble|moment à deux|moment a deux/.test(t))return intimacyOverlay()||openLucasCall();
  return openActions();
}

function route(intent:string,detail:any){
  switch(intent){
    case 'open-phone': return openPhone();
    case 'open-map': return openMap();
    case 'open-wardrobe': return openWardrobe();
    case 'open-journal': return openJournal();
    case 'open-phone-lucas': return openLucasCall();
    case 'open-latest-message': return openLatestMessage();
    case 'follow-calendar': return click('#calendarNudge')||openAgenda();
    case 'open-lucas-day': return openLucasDay();
    case 'continue-torero-travel': return openAgenda();
    case 'evening-options': return openActions();
    case 'open-intimacy-choice': return intimacyOverlay();
    case 'free-intent': return routeFreeText(String(detail?.text||''),String(detail?.kind||''));
    default:return false;
  }
}

window.addEventListener('monia:daily-intent',(event:Event)=>{const detail=(event as CustomEvent).detail||{};const intent=String(detail.intent||'');if(intent==='state-changed'||intent==='open-custom-intent')return;route(intent,detail)});
window.addEventListener('monia:daily-intent-free',(event:Event)=>{const detail=(event as CustomEvent).detail||{};routeFreeText(String(detail.text||''),String(detail.kind||''))});
window.addEventListener('free-intent',(event:Event)=>{const detail=(event as CustomEvent).detail||{};routeFreeText(String(detail.text||''),String(detail.kind||''))});

declare global{interface Window{__moniaRouteGameplayIntent?:(intent:string,detail?:Record<string,unknown>)=>boolean;__moniaIntimacyWindow?:()=>{available:boolean}|null;__moniaRecordIntimacy?:(choice:'accept'|'not-now'|'initiate'|'protected'|'unprotected'|'trying')=>boolean}}
window.__moniaRouteGameplayIntent=(intent,detail={})=>route(intent,detail);
