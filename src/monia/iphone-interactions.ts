import './iphone-interactions.css';

const SAVE_KEY='marion-lucas-save-v4';

type PhoneMessage={from?:string;read?:boolean};
type SaveShape={phoneUnread?:number;messages?:PhoneMessage[]};

function readMessageUnread(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw)return 0;
    const save=JSON.parse(raw) as SaveShape;
    return (Array.isArray(save.messages)?save.messages:[]).filter(message=>message.from!=='Toi'&&!message.read).length;
  }catch{return 0}
}

function readSave(){try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'{}') as Record<string,unknown>}catch{return{}}}
function labelOf(button:HTMLButtonElement){
  return `${button.getAttribute('aria-label')||''} ${button.title||''} ${button.textContent||''}`.toLowerCase().replace(/\s+/g,' ').trim();
}
function conversationContact(phone:HTMLElement){
  return (phone.querySelector<HTMLElement>('.iphoneContactMeta strong')?.textContent||phone.querySelector<HTMLElement>('.nativeThreadHead strong')?.textContent||'').trim();
}
function relationshipAllows(phone:HTMLElement,kind:'call'|'video'){
  if(kind==='video')return true;
  const contact=conversationContact(phone);if(!contact)return true;
  const runtime=window.__marionRelationshipPhone;
  return runtime?.contactAllowed?runtime.contactAllowed(readSave() as never,contact,'call'):true;
}

function realButtons(phone:HTMLElement){
  return [...phone.querySelectorAll<HTMLButtonElement>('button')].filter(b=>!b.closest('.iphoneConversationHeader'));
}

function findRealAction(phone:HTMLElement,kind:'back'|'call'|'video'){
  const buttons=realButtons(phone);
  const patterns=kind==='back'
    ? [/retour/,/messages/,/conversation/,/‹/,/←/]
    : kind==='call'
      ? [/appeler/,/appel audio/,/^appel$/,/téléphone/,/telephone/]
      : [/visio/,/vidéo/,/video/,/facetime/,/appel vidéo/,/appel video/];
  return buttons.find(button=>patterns.some(pattern=>pattern.test(labelOf(button))))||null;
}

function wireProxy(phone:HTMLElement,selector:string,kind:'back'|'call'|'video'){
  const proxy=phone.querySelector<HTMLButtonElement>(selector);
  if(!proxy)return;
  const relationshipBlocked=(kind==='call'||kind==='video')&&!relationshipAllows(phone,kind);
  const target=relationshipBlocked?null:findRealAction(phone,kind);
  proxy.classList.toggle('iphoneProxyUnavailable',!target);
  proxy.dataset.iphoneProxyReady=target?'1':'0';
  if(relationshipBlocked)proxy.setAttribute('aria-label','Indisponible pour le moment');
}

function unreadBadge(phone:HTMLElement){
  const app=phone.querySelector<HTMLElement>('.iphoneAppMessages');
  if(!app)return;
  const count=readMessageUnread();
  let badge=app.querySelector<HTMLElement>('.iphoneUnreadBadge');
  if(count<=0){badge?.remove();return}
  if(!badge){
    badge=document.createElement('span');
    badge.className='iphoneUnreadBadge';
    app.append(badge);
  }
  badge.setAttribute('aria-label',`${count} message${count>1?'s':''} non lu${count>1?'s':''}`);
  badge.textContent=count>99?'99+':String(count);
}

function scrollConversation(phone:HTMLElement){
  const thread=phone.querySelector<HTMLElement>('.smsThread');
  if(!thread)return;
  const key='iphoneLastChildCount';
  const count=thread.children.length;
  const previous=Number(thread.dataset[key]||-1);
  if(previous!==count){
    thread.dataset[key]=String(count);
    requestAnimationFrame(()=>{thread.scrollTop=thread.scrollHeight});
  }
}

function enhance(phone:HTMLElement){
  unreadBadge(phone);
  wireProxy(phone,'.iphoneBack','back');
  wireProxy(phone,'.iphoneCall','call');
  wireProxy(phone,'.iphoneVideo','video');
  scrollConversation(phone);
}

function activateProxy(button:HTMLButtonElement,phone:HTMLElement){
  const kind=button.classList.contains('iphoneBack')?'back':button.classList.contains('iphoneCall')?'call':button.classList.contains('iphoneVideo')?'video':null;
  if(!kind)return false;
  if((kind==='call'||kind==='video')&&!relationshipAllows(phone,kind))return true;
  const target=findRealAction(phone,kind);
  if(!target)return true;
  target.click();
  return true;
}

document.addEventListener('click',event=>{
  const button=(event.target as HTMLElement|null)?.closest<HTMLButtonElement>('.phoneDevice.iphoneReal button');
  if(!button)return;
  const phone=button.closest<HTMLElement>('.phoneDevice.iphoneReal');
  if(!phone)return;
  try{navigator.vibrate?.(8)}catch{/* optional */}
  button.classList.add('iphonePressed');
  window.setTimeout(()=>button.classList.remove('iphonePressed'),85);
  if(activateProxy(button,phone)){
    event.preventDefault();
    event.stopPropagation();
  }
},true);

const observer=new MutationObserver(()=>document.querySelectorAll<HTMLElement>('.phoneDevice.iphoneReal').forEach(enhance));
observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
window.addEventListener('storage',()=>document.querySelectorAll<HTMLElement>('.phoneDevice.iphoneReal').forEach(enhance));
window.setInterval(()=>document.querySelectorAll<HTMLElement>('.phoneDevice.iphoneReal').forEach(enhance),1200);
document.querySelectorAll<HTMLElement>('.phoneDevice.iphoneReal').forEach(enhance);