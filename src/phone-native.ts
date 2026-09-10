import './menu-reality';
import './phoneNative.css';

const SAVE_KEY='marion-lucas-save-v4';
type SaveLike={day?:number;time?:string;metLucas?:boolean;messages?:Array<{from:string;text:string;day:number;read:boolean}>;mails?:Array<{from:string;subject:string}>;memories?:string[];phoneUnread?:number};

function read():SaveLike{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'{}') as SaveLike}catch{return {}}}
function safe(v:string){return v.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c))}
function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'·'}

function appIcon(label:string){const t=label.toLowerCase();if(t.includes('message'))return'💬';if(t.includes('appel'))return'☎';if(t.includes('mail'))return'✉';if(t.includes('agenda'))return'31';if(t.includes('presse'))return'P';if(t.includes('insta'))return'◎';if(t.includes('galerie'))return'▧';if(t.includes('contact'))return'♙';return'•'}

function decorateHome(phone:HTMLElement,s:SaveLike){
  const grid=phone.querySelector<HTMLElement>('.appGrid');if(!grid)return;
  phone.classList.add('nativePhoneHome');
  if(!phone.querySelector('.nativePhoneWidget')){
    const widget=document.createElement('div');widget.className='nativePhoneWidget';
    widget.innerHTML=`<div><span>JOUR ${Number(s.day||1)}</span><strong>${safe(s.time||'09:00')}</strong></div><p>Ta journée continue ici.</p>`;
    grid.before(widget);
  }
  grid.querySelectorAll<HTMLButtonElement>('button').forEach((b,i)=>{
    if(b.dataset.nativeApp==='1')return;b.dataset.nativeApp='1';
    const span=b.querySelector('span');const label=(span?.textContent||b.textContent||'').trim();
    b.classList.add('nativeApp',`nativeApp-${i%8}`);
    const existing=b.querySelector('.realAppIcon');if(existing)existing.textContent=appIcon(label);
    else{const icon=document.createElement('i');icon.className='realAppIcon';icon.textContent=appIcon(label);b.prepend(icon)}
  });
  if(!grid.querySelector('[data-native-contacts]')){
    const contacts=document.createElement('button');contacts.type='button';contacts.dataset.nativeContacts='1';contacts.className='nativeApp nativeContacts';contacts.innerHTML='<i class="realAppIcon">♙</i><span>Contacts</span>';grid.appendChild(contacts);
  }
}

function renderContacts(phone:HTMLElement,s:SaveLike){
  const c=phone.querySelector<HTMLElement>('#phoneContent');if(!c)return;
  const names=new Set<string>();if(s.metLucas)names.add('Lucas');(s.messages||[]).forEach(m=>{if(m.from&&m.from!=='Toi')names.add(m.from)});(s.mails||[]).forEach(m=>{if(m.from)names.add(m.from)});
  const list=[...names];
  c.innerHTML=`<div class="nativeContactsPage"><header><span>CONTACTS</span><strong>Mes contacts</strong><small>${list.length} contact${list.length>1?'s':''}</small></header><div class="nativeContactList">${list.length?list.slice(0,12).map((n,i)=>`<article><i class="contactAvatar avatar-${i%5}">${safe(initials(n))}</i><div><strong>${safe(n)}</strong><small>${n==='Lucas'?'Appels · Messages · Visio':'Contact'}</small></div>${n==='Lucas'?'<span class="contactOnline">●</span>':''}</article>`).join(''):'<p>Ton répertoire se remplira avec les personnes qui entrent dans ta vie.</p>'}</div></div>`;
}

function decorateContent(phone:HTMLElement){
  const c=phone.querySelector<HTMLElement>('#phoneContent');if(!c)return;
  if(c.querySelector('.smsThread')){c.classList.add('nativeMessages');if(!c.querySelector('.nativeThreadHead')){const h=document.createElement('div');h.className='nativeThreadHead';h.innerHTML='<button type="button" aria-label="Retour">‹</button><i>L</i><div><strong>Lucas</strong><small>Messages</small></div><button type="button" aria-label="Appeler">☎</button>';c.prepend(h)}}
  if(c.querySelector('.memoryGallery'))c.classList.add('nativeGallery');
  if(c.querySelector('.pressItem'))c.classList.add('nativeNews');
  if(c.querySelector('.socialActions'))c.classList.add('nativeSocial');
  if(c.querySelector('.mailItem'))c.classList.add('nativeMail');
}

function mount(){const phone=document.querySelector<HTMLElement>('.phoneDevice');if(!phone)return;const s=read();decorateHome(phone,s);decorateContent(phone)}
let timer=0;function soon(){if(timer)window.clearTimeout(timer);timer=window.setTimeout(()=>{timer=0;mount()},55)}
document.addEventListener('click',e=>{const t=e.target as HTMLElement|null;if(!t)return;if(t.closest('[data-native-contacts]')){const phone=t.closest('.phoneDevice') as HTMLElement|null;if(phone)renderContacts(phone,read());return}if(t.closest('#premiumPhone,#phone,#phoneExact,.phoneDevice,[data-phoneapp]'))soon()},{passive:true});
window.addEventListener('storage',soon);soon();
console.info('[Phone] native smartphone apps presentation active');
