import './iphone-notifications.css';
import './iphone-lockscreen';
import './life-narrative-ui';

const SAVE_KEY='marion-lucas-save-v4';

type Msg={from?:string;text?:string;read?:boolean;day?:number;thread?:string};
type SaveShape={messages?:Msg[];time?:string};

function readSave():SaveShape{
  try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'{}') as SaveShape}catch{return{}}
}

function unreadMessages(){
  const save=readSave();
  return [...(save.messages||[])].filter(m=>m&&m.from!=='Toi'&&m.read===false&&Boolean(m.text));
}

function latestUnread(){return unreadMessages()[0]||null}

function findMessagesButton(phone:HTMLElement){
  return phone.querySelector<HTMLButtonElement>('.iphoneAppMessages')||
    [...phone.querySelectorAll<HTMLButtonElement>('button')].find(b=>(b.textContent||'').toLowerCase().includes('message'))||null;
}

function ensureBanner(phone:HTMLElement){
  if(phone.classList.contains('iphoneConversation')){
    phone.querySelector('.iphoneNotificationBanner')?.remove();
    return;
  }
  const unread=unreadMessages();
  const msg=unread[0]||null;
  const existing=phone.querySelector<HTMLElement>('.iphoneNotificationBanner');
  if(!msg||unread.length<=0){existing?.remove();return}
  const sender=(msg.thread||msg.from||'Messages').trim()||'Messages';
  const text=(msg.text||'').trim();
  const banner=existing||document.createElement('button');
  banner.className='iphoneNotificationBanner';
  banner.setAttribute('type','button');
  banner.setAttribute('aria-label',`Ouvrir le message de ${sender}`);
  banner.innerHTML=`<span class="iphoneNotifIcon">💬</span><span class="iphoneNotifText"><strong>${sender}</strong><small>${unread.length>1?`${unread.length} non lus`:'maintenant'}</small><em>${text}</em></span>`;
  if(!existing)phone.prepend(banner);
}

function enhance(phone:HTMLElement){ensureBanner(phone)}

document.addEventListener('click',event=>{
  const banner=(event.target as HTMLElement|null)?.closest<HTMLButtonElement>('.iphoneNotificationBanner');
  if(!banner)return;
  const phone=banner.closest<HTMLElement>('.phoneDevice.iphoneReal');
  if(!phone)return;
  const messages=findMessagesButton(phone);
  if(messages){
    event.preventDefault();
    event.stopPropagation();
    messages.click();
    window.setTimeout(()=>window.dispatchEvent(new CustomEvent('monia:open-latest-thread')),80);
  }
},true);

const observer=new MutationObserver(()=>document.querySelectorAll<HTMLElement>('.phoneDevice.iphoneReal').forEach(enhance));
observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
window.addEventListener('storage',()=>document.querySelectorAll<HTMLElement>('.phoneDevice.iphoneReal').forEach(enhance));
window.setInterval(()=>document.querySelectorAll<HTMLElement>('.phoneDevice.iphoneReal').forEach(enhance),1000);
document.querySelectorAll<HTMLElement>('.phoneDevice.iphoneReal').forEach(enhance);
