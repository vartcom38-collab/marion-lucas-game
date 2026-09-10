import './menu-reality';
import './phoneNative.css';

const SAVE_KEY='marion-lucas-save-v4';
type Message={from:string;text:string;day:number;read:boolean};
type SaveLike={day?:number;time?:string;metLucas?:boolean;messages?:Message[];mails?:Array<{from:string;subject:string}>;memories?:string[];phoneUnread?:number};

function read():SaveLike{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'{}') as SaveLike}catch{return {}}}
function safe(v:string){return v.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c))}
function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'·'}
function appIcon(label:string){const t=label.toLowerCase();if(t.includes('message'))return'💬';if(t.includes('appel'))return'☎';if(t.includes('mail'))return'✉';if(t.includes('agenda'))return'31';if(t.includes('presse'))return'P';if(t.includes('insta'))return'◎';if(t.includes('galerie'))return'▧';if(t.includes('contact'))return'♙';return'•'}
function unreadCount(s:SaveLike){const direct=(s.messages||[]).filter(m=>m.from!=='Toi'&&!m.read).length;return Math.max(Number(s.phoneUnread||0),direct)}

function ensureChrome(phone:HTMLElement,s:SaveLike){
  if(!phone.querySelector('.nativeStatusBar')){
    const bar=document.createElement('div');bar.className='nativeStatusBar';bar.innerHTML='<strong></strong><div class="nativeIsland"></div><span class="nativeSignal">▮▮▮ ᯤ ▰</span>';phone.prepend(bar)
  }
  const time=phone.querySelector<HTMLElement>('.nativeStatusBar strong');if(time)time.textContent=s.time||'09:00';
  if(!phone.querySelector('.nativeHomeIndicator')){const home=document.createElement('div');home.className='nativeHomeIndicator';phone.appendChild(home)}
}

function decorateHome(phone:HTMLElement,s:SaveLike){
  const grid=phone.querySelector<HTMLElement>('.appGrid');if(!grid)return;
  phone.classList.add('nativePhoneHome');phone.querySelector('.nativePhoneWidget')?.remove();
  const unread=unreadCount(s);
  grid.querySelectorAll<HTMLButtonElement>('button').forEach((b,i)=>{
    const span=b.querySelector('span');const label=(span?.textContent||b.textContent||'').trim();
    if(b.dataset.nativeApp!=='1'){b.dataset.nativeApp='1';b.classList.add('nativeApp',`nativeApp-${i%8}`);const existing=b.querySelector('.realAppIcon');if(existing)existing.textContent=appIcon(label);else{const icon=document.createElement('i');icon.className='realAppIcon';icon.textContent=appIcon(label);b.prepend(icon)}}
    b.querySelector('.nativeUnreadBadge')?.remove();
    if(label.toLowerCase().includes('message')&&unread>0){const badge=document.createElement('em');badge.className='nativeUnreadBadge';badge.textContent=String(unread);b.appendChild(badge)}
  });
  if(!grid.querySelector('[data-native-contacts]')){const contacts=document.createElement('button');contacts.type='button';contacts.dataset.nativeContacts='1';contacts.className='nativeApp nativeContacts';contacts.innerHTML='<i class="realAppIcon">♙</i><span>Contacts</span>';grid.appendChild(contacts)}
}

function renderContacts(phone:HTMLElement,s:SaveLike){const c=phone.querySelector<HTMLElement>('#phoneContent');if(!c)return;const names=new Set<string>();if(s.metLucas)names.add('Lucas');(s.messages||[]).forEach(m=>{if(m.from&&m.from!=='Toi')names.add(m.from)});(s.mails||[]).forEach(m=>{if(m.from)names.add(m.from)});const list=[...names];c.innerHTML=`<div class="nativeContactsPage"><header><span>CONTACTS</span><strong>Mes contacts</strong><small>${list.length} contact${list.length>1?'s':''}</small></header><div class="nativeContactList">${list.length?list.slice(0,12).map((n,i)=>`<article><i class="contactAvatar avatar-${i%5}">${safe(initials(n))}</i><div><strong>${safe(n)}</strong><small>${n==='Lucas'?'Appels · Messages · Visio':'Messages · Appels'}</small></div></article>`).join(''):'<p>Ton répertoire se remplira avec les personnes qui entrent dans ta vie.</p>'}</div></div>`}

function activeContact(s:SaveLike,c:HTMLElement){const visible=[...c.querySelectorAll<HTMLElement>('.msg b')].map(x=>x.textContent?.trim()||'').find(x=>x&&x!=='Toi');if(visible)return visible;const recent=[...(s.messages||[])].reverse().find(m=>m.from&&m.from!=='Toi');return recent?.from||'Messages'}
function animateNewMessages(c:HTMLElement){for(const msg of c.querySelectorAll<HTMLElement>('.msg')){if(msg.dataset.liveSeen==='1')continue;msg.dataset.liveSeen='1';msg.classList.add('nativeMessageArrive');window.setTimeout(()=>msg.classList.remove('nativeMessageArrive'),520)}}
function enhanceTyping(c:HTMLElement,name:string){const pending=c.querySelector<HTMLElement>('.smsPending');if(!pending)return;pending.classList.add('nativeTyping');pending.setAttribute('aria-label',`${name} est en train d’écrire`);if(!pending.querySelector('.nativeTypingLabel')){const label=document.createElement('span');label.className='nativeTypingLabel';label.textContent=`${name} écrit…`;pending.appendChild(label)}}
function decorateContent(phone:HTMLElement,s:SaveLike){const c=phone.querySelector<HTMLElement>('#phoneContent');if(!c)return;if(c.querySelector('.smsThread')){c.classList.add('nativeMessages');const name=activeContact(s,c);let h=c.querySelector<HTMLElement>('.nativeThreadHead');if(!h){h=document.createElement('div');h.className='nativeThreadHead';c.prepend(h)}h.innerHTML=`<button type="button" aria-label="Retour">‹</button><i>${safe(initials(name))}</i><div><strong>${safe(name)}</strong><small class="nativePresence">${c.querySelector('.smsPending')?'écrit…':'Messages'}</small></div><button type="button" aria-label="Appeler">☎</button>`;animateNewMessages(c);enhanceTyping(c,name);const thread=c.querySelector<HTMLElement>('.smsThread');if(thread)window.requestAnimationFrame(()=>thread.scrollTo({top:thread.scrollHeight,behavior:'smooth'}))}if(c.querySelector('.memoryGallery'))c.classList.add('nativeGallery');if(c.querySelector('.pressItem'))c.classList.add('nativeNews');if(c.querySelector('.socialActions'))c.classList.add('nativeSocial');if(c.querySelector('.mailItem'))c.classList.add('nativeMail')}

function mount(){const phone=document.querySelector<HTMLElement>('.phoneDevice');if(!phone)return;const s=read();ensureChrome(phone,s);decorateHome(phone,s);decorateContent(phone,s)}
let timer=0;function soon(){if(timer)window.clearTimeout(timer);timer=window.setTimeout(()=>{timer=0;mount()},45)}
document.addEventListener('click',e=>{const t=e.target as HTMLElement|null;if(!t)return;if(t.closest('[data-native-contacts]')){const phone=t.closest('.phoneDevice') as HTMLElement|null;if(phone)renderContacts(phone,read());return}if(t.closest('#premiumPhone,#phone,#phoneExact,.phoneDevice,[data-phoneapp]'))soon()},{passive:true});window.addEventListener('storage',soon);new MutationObserver(soon).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true,characterData:true});soon();console.info('[Phone] live smartphone presentation active');
