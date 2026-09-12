import './iphone-notifications.css';
import './iphone-lockscreen';
import './life-narrative-ui';

const SAVE_KEY='marion-lucas-save-v4';

type Msg={from?:string;text?:string;read?:boolean;day?:number};
type SaveShape={messages?:Msg[];phoneUnread?:number;time?:string};

function readSave():SaveShape{
  try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'{}') as SaveShape}catch{return{}}
}

function latestUnread(){
  const save=readSave();
  const list=[...(save.messages||[])];
  return list.find(m=>m&&m.read===false&&m.text)||null;
}

function findMessagesButton(phone:HTMLElement){
  return phone.querySelector<HTMLButtonElement>('.iphoneAppMessages')||
    [...phone.querySelectorAll<HTMLButtonElement>('button')].find(b=>(b.textContent||'').toLowerCase().includes('message'))||null;
}

function ensureBanner(phone:HTMLElement){
  if(phone.classList.contains('iphoneConversation')){
    phone.querySelector('.iphoneNotificationBanner')?.remove();
    return;
  }
  const msg=latestUnread();
  const count=Math.max(0,Number(readSave().phoneUnread||0));
  const existing=phone.querySelector<HTMLElement>('.iphoneNotificationBanner');
  if(!msg||count<=0){existing?.remove();return}
  const sender=(msg.from||'Messages').trim()||'Messages';
  const text=(msg.text||'').trim();
  const banner=existing||document.createElement('button');
  banner.className='iphoneNotificationBanner';
  banner.setAttribute('type','button');
  banner.setAttribute('aria-label',`Ouvrir le message de ${sender}`);
  banner.innerHTML=`<span class="iphoneNotifIcon">💬</span><span class="iphoneNotifText"><strong>${sender}</strong><small>maintenant</small><em>${text}</em></span>`;
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
