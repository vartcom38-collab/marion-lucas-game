import './iphone-shell.css';

const SAVE_KEY='marion-lucas-save-v4';

function gameTime(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw)return'09:00';
    const save=JSON.parse(raw) as {time?:string};
    return String(save.time||'09:00').slice(0,5);
  }catch{return'09:00'}
}

function ensureChrome(phone:HTMLElement){
  phone.classList.add('iphoneReal');
  if(!phone.querySelector(':scope > .iphoneStatus')){
    const status=document.createElement('div');
    status.className='iphoneStatus';
    status.innerHTML=`<strong>${gameTime()}</strong><span class="iphoneSignal">▮▮▮</span><span class="iphoneWifi">◔</span><span class="iphoneBattery"><i></i></span>`;
    phone.prepend(status);
  } else {
    const time=phone.querySelector<HTMLElement>('.iphoneStatus strong');
    if(time)time.textContent=gameTime();
  }
  if(!phone.querySelector(':scope > .iphoneIsland')){
    const island=document.createElement('div');
    island.className='iphoneIsland';
    island.innerHTML='<i></i>';
    phone.prepend(island);
  }
  if(!phone.querySelector(':scope > .iphoneHomeIndicator')){
    const home=document.createElement('div');
    home.className='iphoneHomeIndicator';
    phone.append(home);
  }
}

function classifyApps(phone:HTMLElement){
  phone.querySelectorAll<HTMLButtonElement>('.appGrid button').forEach(button=>{
    const label=(button.textContent||'').toLowerCase();
    if(label.includes('message'))button.classList.add('iphoneAppMessages');
    else if(label.includes('appel'))button.classList.add('iphoneAppPhone');
    else if(label.includes('mail'))button.classList.add('iphoneAppMail');
    else if(label.includes('agenda'))button.classList.add('iphoneAppCalendar');
    else if(label.includes('photo')||label.includes('galerie'))button.classList.add('iphoneAppPhotos');
    else if(label.includes('contact'))button.classList.add('iphoneAppContacts');
    else if(label.includes('insta'))button.classList.add('iphoneAppSocial');
    else if(label.includes('presse'))button.classList.add('iphoneAppNews');
  });
}

function enhanceConversation(phone:HTMLElement){
  const thread=phone.querySelector<HTMLElement>('.smsThread');
  if(!thread)return;
  phone.classList.add('iphoneConversation');
  const parent=thread.parentElement;
  if(parent&&!parent.querySelector(':scope > .iphoneConversationHeader')){
    const name=phone.textContent?.match(/Marine|Lucas/)?.[0]||'Messages';
    const header=document.createElement('div');
    header.className='iphoneConversationHeader';
    header.innerHTML=`<button type="button" class="iphoneBack" aria-label="Retour">‹</button><div class="iphoneContactAvatar">${name.charAt(0)}</div><div class="iphoneContactMeta"><strong>${name}</strong><span>iMessage</span></div><button type="button" class="iphoneCall" aria-label="Appeler">⌕</button><button type="button" class="iphoneVideo" aria-label="Visio">▭</button>`;
    parent.prepend(header);
  }
  thread.querySelectorAll<HTMLElement>('.msg').forEach(msg=>{
    const text=(msg.textContent||'').trim();
    if(!text)return;
    if(msg.classList.contains('mine'))msg.classList.add('iphoneBubbleMine');
    else msg.classList.add('iphoneBubbleOther');
  });
}

function enhance(phone:HTMLElement){
  ensureChrome(phone);
  classifyApps(phone);
  enhanceConversation(phone);
}

function scan(){document.querySelectorAll<HTMLElement>('.phoneDevice').forEach(enhance)}

const observer=new MutationObserver(()=>scan());
observer.observe(document.documentElement,{childList:true,subtree:true});
window.setInterval(()=>{
  document.querySelectorAll<HTMLElement>('.iphoneStatus strong').forEach(el=>el.textContent=gameTime());
},1000);
scan();
