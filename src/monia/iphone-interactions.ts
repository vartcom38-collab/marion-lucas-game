import './iphone-interactions.css';
import {approvedLucasVisioFor,hasApprovedLucasVisio} from './approved-visio-runtime';

const SAVE_KEY='marion-lucas-save-v4';

type PhoneMessage={from?:string;read?:boolean};
type SaveShape={phoneUnread?:number;messages?:PhoneMessage[];day?:number;time?:string;flags?:Record<string,boolean|number|string>;updatedAt?:number};

function readMessageUnread(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw)return 0;
    const save=JSON.parse(raw) as SaveShape;
    return (Array.isArray(save.messages)?save.messages:[]).filter(message=>message.from!=='Toi'&&!message.read).length;
  }catch{return 0}
}
function readSave(){try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'{}') as SaveShape}catch{return{}}}
function writeSave(save:SaveShape){save.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(save));window.dispatchEvent(new CustomEvent('marion:statechange'))}
function conversationContact(phone:HTMLElement){return(phone.querySelector<HTMLElement>('.iphoneContactMeta strong')?.textContent||phone.querySelector<HTMLElement>('.nativeThreadHead strong')?.textContent||'').trim()}
function relationshipAvailability(contact:string){
  const save=readSave();
  if(contact!=='Lucas')return{canCall:true,replyDelay:'normal',reason:'available'};
  return window.__marionRelationshipPhone?.availability?.(save as never)||{canCall:true,replyDelay:'normal',reason:'available'};
}
function relationshipAllows(phone:HTMLElement,kind:'call'|'video'){
  const contact=conversationContact(phone);if(!contact)return false;
  if(contact!=='Lucas')return kind==='call';
  const availability=relationshipAvailability(contact);
  if(kind==='video')return availability.reason!=='with-marion'&&availability.canCall!==false;
  const runtime=window.__marionRelationshipPhone;
  return runtime?.contactAllowed?runtime.contactAllowed(readSave() as never,contact,'call'):availability.canCall!==false;
}

function realButtons(phone:HTMLElement){return[...phone.querySelectorAll<HTMLButtonElement>('button')].filter(b=>!b.closest('.iphoneConversationHeader')&&!b.closest('.iphoneAudioCall')&&!b.closest('.iphoneVideoCall'))}
function findBackAction(phone:HTMLElement){
  const patterns=[/retour/,/messages/,/conversation/,/‹/,/←/];
  return realButtons(phone).find(button=>patterns.some(pattern=>pattern.test(`${button.getAttribute('aria-label')||''} ${button.title||''} ${button.textContent||''}`.toLowerCase())))||null;
}

function recordCall(contact:string,outcome:'connected'|'missed',channel:'audio'|'video'='audio'){
  const save=readSave();const state=save.flags||(save.flags={});
  const prefix=contact==='Lucas'?'lucas':'contact';
  state[`${prefix}Outgoing${channel==='video'?'Visio':'Call'}Day`]=Number(save.day||1);
  state[`${prefix}Outgoing${channel==='video'?'Visio':'Call'}Time`]=String(save.time||'');
  state[`${prefix}Outgoing${channel==='video'?'Visio':'Call'}Outcome`]=outcome;
  writeSave(save);
}
function closeAudioCall(phone:HTMLElement){phone.querySelector('.iphoneAudioCall')?.remove();phone.classList.remove('iphoneAudioCallOpen')}
function closeVideoCall(phone:HTMLElement){phone.querySelector('.iphoneVideoCall')?.remove();phone.classList.remove('iphoneVideoCallOpen')}
function startAudioCall(phone:HTMLElement){
  const contact=conversationContact(phone);if(!contact)return;
  const availability=relationshipAvailability(contact);
  if(contact==='Lucas'&&availability.canCall===false)return;
  closeAudioCall(phone);closeVideoCall(phone);
  const panel=document.createElement('section');panel.className='iphoneAudioCall';
  panel.innerHTML=`<small>APPEL AUDIO</small><i>${contact.charAt(0).toUpperCase()}</i><strong>${contact}</strong><span>appel en cours…</span><button type="button" class="iphoneHangup" aria-label="Raccrocher">☎</button>`;
  phone.appendChild(panel);phone.classList.add('iphoneAudioCallOpen');
  const status=panel.querySelector<HTMLElement>('span');
  const delayed=contact==='Lucas'&&availability.replyDelay==='delayed';
  window.setTimeout(()=>{
    if(!panel.isConnected)return;
    if(delayed){
      if(status)status.textContent='pas de réponse · il est pris pour le moment';
      panel.classList.add('isMissed');recordCall(contact,'missed');
    }else{
      if(status)status.textContent='connecté';
      panel.classList.add('isConnected');recordCall(contact,'connected');
    }
  },1100);
}
function videoUnavailable(phone:HTMLElement,contact:string,message:string){
  closeAudioCall(phone);closeVideoCall(phone);
  const panel=document.createElement('section');panel.className='iphoneVideoCall isUnavailable';
  panel.innerHTML=`<div class="iphoneVideoUnavailable"><i>${contact.charAt(0).toUpperCase()||'L'}</i><strong>${contact||'Visio'}</strong><span>${message}</span></div><button type="button" class="iphoneVideoClose" aria-label="Fermer la visio">×</button>`;
  phone.appendChild(panel);phone.classList.add('iphoneVideoCallOpen');
}
function startVideoCall(phone:HTMLElement){
  const contact=conversationContact(phone);
  if(contact!=='Lucas'){videoUnavailable(phone,contact||'Visio','La visio n’est pas disponible pour ce contact.');return}
  const availability=relationshipAvailability(contact);
  if(availability.reason==='with-marion'){videoUnavailable(phone,contact,'Lucas est déjà avec toi.');return}
  if(availability.canCall===false){videoUnavailable(phone,contact,'Lucas n’est pas joignable en vidéo pour le moment.');return}
  if(!hasApprovedLucasVisio()){
    videoUnavailable(phone,contact,'Connexion vidéo indisponible · aucun clip Lucas validé pour le moment.');
    return;
  }
  const clip=approvedLucasVisioFor('listen');
  if(!clip){videoUnavailable(phone,contact,'Connexion vidéo indisponible.');return}
  closeAudioCall(phone);closeVideoCall(phone);
  const panel=document.createElement('section');panel.className='iphoneVideoCall isConnected';
  const video=document.createElement('video');video.className='iphoneApprovedVisioVideo';video.src=clip.src;video.autoplay=true;video.playsInline=true;video.loop=clip.loop;video.muted=clip.muted;video.setAttribute('aria-label',`Visio avec ${contact}`);
  const chrome=document.createElement('div');chrome.className='iphoneVideoChrome';chrome.innerHTML=`<small>VISIO · MÉDIA VALIDÉ</small><strong>${contact}</strong><span>connecté</span><button type="button" class="iphoneVideoClose" aria-label="Raccrocher la visio">×</button>`;
  panel.append(video,chrome);phone.appendChild(panel);phone.classList.add('iphoneVideoCallOpen');
  recordCall(contact,'connected','video');
  void video.play().catch(()=>{});
}

function wireProxy(phone:HTMLElement,selector:string,kind:'back'|'call'|'video'){
  const proxy=phone.querySelector<HTMLButtonElement>(selector);if(!proxy)return;
  if(kind==='back'){
    const target=findBackAction(phone);proxy.classList.toggle('iphoneProxyUnavailable',!target);proxy.dataset.iphoneProxyReady=target?'1':'0';return;
  }
  if(kind==='call'){
    const allowed=relationshipAllows(phone,'call');proxy.classList.toggle('iphoneProxyUnavailable',!allowed);proxy.dataset.iphoneProxyReady=allowed?'1':'0';proxy.setAttribute('aria-label',allowed?'Appeler':'Indisponible pour le moment');return;
  }
  const contact=conversationContact(phone);
  const show=contact==='Lucas';
  proxy.classList.toggle('iphoneProxyUnavailable',!show);proxy.dataset.iphoneProxyReady=show?'1':'0';proxy.setAttribute('aria-label','Visio');
}
function unreadBadge(phone:HTMLElement){
  const app=phone.querySelector<HTMLElement>('.iphoneAppMessages');if(!app)return;
  const count=readMessageUnread();let badge=app.querySelector<HTMLElement>('.iphoneUnreadBadge');
  if(count<=0){badge?.remove();return}
  if(!badge){badge=document.createElement('span');badge.className='iphoneUnreadBadge';app.append(badge)}
  badge.setAttribute('aria-label',`${count} message${count>1?'s':''} non lu${count>1?'s':''}`);badge.textContent=count>99?'99+':String(count);
}
function scrollConversation(phone:HTMLElement){
  const thread=phone.querySelector<HTMLElement>('.smsThread');if(!thread)return;
  const key='iphoneLastChildCount',count=thread.children.length,previous=Number(thread.dataset[key]||-1);
  if(previous!==count){thread.dataset[key]=String(count);requestAnimationFrame(()=>{thread.scrollTop=thread.scrollHeight})}
}
function enhance(phone:HTMLElement){unreadBadge(phone);wireProxy(phone,'.iphoneBack','back');wireProxy(phone,'.iphoneCall','call');wireProxy(phone,'.iphoneVideo','video');scrollConversation(phone)}
function activateProxy(button:HTMLButtonElement,phone:HTMLElement){
  if(button.classList.contains('iphoneHangup')){closeAudioCall(phone);return true}
  if(button.classList.contains('iphoneVideoClose')){closeVideoCall(phone);return true}
  const kind=button.classList.contains('iphoneBack')?'back':button.classList.contains('iphoneCall')?'call':button.classList.contains('iphoneVideo')?'video':null;
  if(!kind)return false;
  if(kind==='call'){
    if(!relationshipAllows(phone,'call'))return true;
    startAudioCall(phone);return true;
  }
  if(kind==='video'){startVideoCall(phone);return true}
  const target=findBackAction(phone);if(!target)return true;target.click();return true;
}

document.addEventListener('click',event=>{
  const button=(event.target as HTMLElement|null)?.closest<HTMLButtonElement>('.phoneDevice.iphoneReal button');if(!button)return;
  const phone=button.closest<HTMLElement>('.phoneDevice.iphoneReal');if(!phone)return;
  try{navigator.vibrate?.(8)}catch{/* optional */}
  button.classList.add('iphonePressed');window.setTimeout(()=>button.classList.remove('iphonePressed'),85);
  if(activateProxy(button,phone)){event.preventDefault();event.stopPropagation()}
},true);

const observer=new MutationObserver(()=>document.querySelectorAll<HTMLElement>('.phoneDevice.iphoneReal').forEach(enhance));
observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
window.addEventListener('storage',()=>document.querySelectorAll<HTMLElement>('.phoneDevice.iphoneReal').forEach(enhance));
window.setInterval(()=>document.querySelectorAll<HTMLElement>('.phoneDevice.iphoneReal').forEach(enhance),1200);
document.querySelectorAll<HTMLElement>('.phoneDevice.iphoneReal').forEach(enhance);