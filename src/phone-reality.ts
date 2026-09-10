import './phoneReality.css';

const SAVE_KEY='marion-lucas-save-v4';
type SaveLike={time?:string;day?:number;phoneUnread?:number};

function readSave():SaveLike{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'{}') as SaveLike}catch{return {}}}

function iconFor(label:string){
  const t=label.toLowerCase();
  if(/message|sms|messag/.test(t))return '💬';
  if(/appel|téléphone|telephone|call/.test(t))return '☎';
  if(/visio|vidéo|video/.test(t))return '◉';
  if(/agenda|calend/.test(t))return '▦';
  if(/photo|galerie/.test(t))return '▧';
  if(/contact/.test(t))return '♙';
  if(/mail/.test(t))return '✉';
  if(/journal|note/.test(t))return '≡';
  return '•';
}

function decorateApps(phone:HTMLElement){
  phone.querySelectorAll<HTMLButtonElement>('.appGrid button').forEach(btn=>{
    if(btn.dataset.realApp==='1')return;
    btn.dataset.realApp='1';
    const label=(btn.textContent||btn.getAttribute('aria-label')||'').trim();
    btn.dataset.appLabel=label;
    if(!btn.querySelector('.realAppIcon')){
      const icon=document.createElement('i');icon.className='realAppIcon';icon.textContent=iconFor(label);
      btn.prepend(icon);
    }
  });
}

function makeStatus(phone:HTMLElement){
  if(phone.querySelector('.realPhoneStatus'))return;
  const status=document.createElement('div');status.className='realPhoneStatus';status.setAttribute('aria-hidden','true');
  status.innerHTML='<b class="realPhoneTime">09:41</b><span class="realPhoneIsland"></span><span class="realPhoneSignals"><i></i><i></i><i></i><em>●</em></span>';
  phone.prepend(status);
}

function makeHandle(phone:HTMLElement){
  if(phone.querySelector('.realPhoneHandle'))return;
  const h=document.createElement('div');h.className='realPhoneHandle';h.setAttribute('aria-hidden','true');phone.appendChild(h);
}

function update(phone:HTMLElement){
  const s=readSave();
  const clock=phone.querySelector<HTMLElement>('.realPhoneTime');
  if(clock)clock.textContent=s.time||new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  phone.dataset.unread=String(s.phoneUnread||0);
}

function mount(){
  const phone=document.querySelector<HTMLElement>('.phoneDevice');
  if(!phone)return;
  phone.classList.add('realPhone');
  makeStatus(phone);makeHandle(phone);decorateApps(phone);update(phone);
}

let raf=0;
function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;mount()})}

new MutationObserver(schedule).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',e=>{const t=e.target as HTMLElement|null;if(t?.closest('#premiumPhone,[data-overlay="phone"],[data-open="phone"],.phoneDevice'))window.setTimeout(schedule,60)},{passive:true});
window.addEventListener('storage',schedule);
schedule();

console.info('[Phone] realistic smartphone presentation active');
