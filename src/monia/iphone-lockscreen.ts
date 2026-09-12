import './iphone-lockscreen.css';

const SAVE_KEY='marion-lucas-save-v4';
const SESSION_KEY='marion-lucas-iphone-unlocked-v1';

type SaveShape={day?:number;time?:string;phoneUnread?:number;messages?:Array<{from?:string;text?:string;read?:boolean}>};

function readSave():SaveShape{
  try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'{}') as SaveShape}catch{return{}}
}

function pad(n:number){return String(n).padStart(2,'0')}
function lockTime(){
  const save=readSave();
  return String(save.time||'09:00').slice(0,5);
}
function lockDate(){
  const day=Math.max(1,Number(readSave().day||1));
  return `Jour ${day}`;
}
function latestUnread(){
  const save=readSave();
  const msgs=[...(save.messages||[])].reverse();
  return msgs.find(m=>m&&!m.read&&m.text)?.text||'';
}
function unreadCount(){return Math.max(0,Number(readSave().phoneUnread||0))}

function removeLock(lock:HTMLElement){
  lock.classList.add('iphoneLockLeaving');
  try{navigator.vibrate?.(7)}catch{/* optional */}
  window.setTimeout(()=>lock.remove(),240);
  try{sessionStorage.setItem(SESSION_KEY,'1')}catch{/* ignore */}
}

function buildLock(phone:HTMLElement){
  if(phone.querySelector(':scope > .iphoneLockScreen'))return;
  let unlocked=false;
  try{unlocked=sessionStorage.getItem(SESSION_KEY)==='1'}catch{/* ignore */}
  if(unlocked)return;
  const lock=document.createElement('section');
  lock.className='iphoneLockScreen';
  lock.setAttribute('aria-label','Écran verrouillé de l’iPhone de Marion');
  const unread=unreadCount();
  const preview=latestUnread();
  lock.innerHTML=`
    <div class="iphoneLockGlow"></div>
    <div class="iphoneLockDate">${lockDate()}</div>
    <div class="iphoneLockTime">${lockTime()}</div>
    ${unread>0?`<button type="button" class="iphoneLockNotification"><span class="iphoneLockApp">Messages</span><b>${unread} nouveau${unread>1?'x':''} message${unread>1?'s':''}</b>${preview?`<small>${preview.replace(/[<>]/g,'').slice(0,82)}</small>`:''}</button>`:''}
    <div class="iphoneLockBottom"><button type="button" class="iphoneLockFlash" aria-label="Lampe">◐</button><span>Balayer vers le haut pour ouvrir</span><button type="button" class="iphoneLockCamera" aria-label="Appareil photo">◉</button></div>`;
  const unlock=()=>removeLock(lock);
  lock.addEventListener('click',e=>{
    const target=e.target as HTMLElement;
    if(target.closest('.iphoneLockFlash')||target.closest('.iphoneLockCamera'))return;
    unlock();
  });
  let startY:number|null=null;
  lock.addEventListener('pointerdown',e=>{startY=e.clientY},{passive:true});
  lock.addEventListener('pointerup',e=>{if(startY!==null&&startY-e.clientY>34)unlock();startY=null},{passive:true});
  phone.append(lock);
}

function refreshLocks(){
  document.querySelectorAll<HTMLElement>('.phoneDevice.iphoneReal').forEach(phone=>{
    buildLock(phone);
    const lock=phone.querySelector<HTMLElement>('.iphoneLockScreen');
    if(!lock)return;
    const time=lock.querySelector<HTMLElement>('.iphoneLockTime');
    const date=lock.querySelector<HTMLElement>('.iphoneLockDate');
    if(time)time.textContent=lockTime();
    if(date)date.textContent=lockDate();
  });
}

const observer=new MutationObserver(refreshLocks);
observer.observe(document.documentElement,{childList:true,subtree:true});
window.setInterval(refreshLocks,1200);
refreshLocks();
