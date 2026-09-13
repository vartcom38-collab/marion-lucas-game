import './iphone-interactions.css';

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
function labelOf(button:HTMLButtonElement){return`${button.getAttribute('aria-label')||''} ${button.title||''} ${button.textContent||''}`.toLowerCase().replace(/\s+/g,' ').trim()}
function conversationContact(phone:HTMLElement){return(phone.querySelector<HTMLElement>('.iphoneContactMeta strong')?.textContent||phone.querySelector<HTMLElement>('.nativeThreadHead strong')?.textContent||'').trim()}
function relationshipAvailability(contact:string){
  const save=readSave();
  if(contact!=='Lucas')return{canCall:true,replyDelay:'normal',reason:'available'};
  return window.__marionRelationshipPhone?.availability?.(save as never)||{canCall:true,replyDelay:'normal',reason:'available'};
}
function relationshipAllows(phone:HTMLElement,kind:'call'|'video'){
  if(kind==='video')return true;
  const contact=conversationContact(phone);if(!contact)return true;
  const runtime=window.__marionRelationshipPhone;
  return runtime?.contactAllowed?runtime.contactAllowed(readSave() as never,contact,'call'):true;
}

function realButtons(phone:HTMLElement){return[...phone.querySelectorAll<HTMLButtonElement>('button')].filter(b=>!b.closest('.iphoneConversationHeader')&&!b.closest('.iphoneAudioCall'))}
function findRealAction(phone:HTMLElement,kind:'back'|'video'){
  const buttons=realButtons(phone);
  const patterns=kind==='back'?[/retour/,/messages/,/conversation/,/‹/,/←/]:[/visio/,/vidéo/,/video/,/facetime/,/appel vidéo/,/appel video/];
  return buttons.find(button=>patterns.some(pattern=>pattern.test(labelOf(button))))||null;
}

function recordCall(contact:string,outcome:'connected'|'missed'){
  const save=readSave();const state=save.flags||(save.flags={});
  const prefix=contact==='Lucas'?'lucas':'contact';
  state[`${prefix}OutgoingCallDay`]=Number(save.day||1);
  state[`${prefix}OutgoingCallTime`]=String(save.time||'');
  state[`${prefix}OutgoingCallOutcome`]=outcome;
  writeSave(save);
}
function closeAudioCall(phone:HTMLElement){phone.querySelector('.iphoneAudioCall')?.remove();phone.classList.remove('iphoneAudioCallOpen')}
function startAudioCall(phone:HTMLElement){
  const contact=conversationContact(phone);if(!contact)return;
  const availability=relationshipAvailability(contact);
  if(contact==='Lucas'&&availability.canCall===false)return;
  closeAudioCall(phone);
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

function wireProxy(phone:HTMLElement,selector:string,kind:'back'|'call'|'video'){
  const proxy=phone.querySelector<HTMLButtonElement>(selector);if(!proxy)return;
  if(kind==='call'){
    const allowed=relationshipAllows(phone,'call');
    proxy.classList.toggle('iphoneProxyUnavailable',!allowed);
    proxy.dataset.iphoneProxyReady=allowed?'1':'0';
    proxy.setAttribute('aria-label',allowed?'Appeler':'Indisponible pour le moment');
    return;
  }
  const target=findRealAction(phone,kind);
  proxy.classList.toggle('iphoneProxyUnavailable',!target);
  proxy.dataset.iphoneProxyReady=target?'1':'0';
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
  const kind=button.classList.contains('iphoneBack')?'back':button.classList.contains('iphoneCall')?'call':button.classList.contains('iphoneVideo')?'video':null;
  if(!kind)return false;
  if(kind==='call'){
    if(!relationshipAllows(phone,'call'))return true;
    startAudioCall(phone);return true;
  }
  const target=findRealAction(phone,kind);if(!target)return true;target.click();return true;
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