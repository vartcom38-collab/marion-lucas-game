import './menu-reality';
import './phoneNative.css';
import './phoneLiveEvents.css';

const SAVE_KEY='marion-lucas-save-v4';
type Message={from:string;text:string;day:number;read:boolean};
type SaveLike={day?:number;time?:string;place?:string;metLucas?:boolean;messages?:Message[];mails?:Array<{from:string;subject:string}>;memories?:string[];phoneUnread?:number;flags?:Record<string,boolean|number|string>;updatedAt?:number};
let syncTimer=0,pendingTimer=0;

function read():SaveLike{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'{}') as SaveLike}catch{return {}}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function f(s:SaveLike){if(!s.flags)s.flags={};return s.flags}
function safe(v:string){return v.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c))}
function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'·'}
function unreadCount(s:SaveLike){return Math.max(Number(s.phoneUnread||0),(s.messages||[]).filter(m=>m.from!=='Toi'&&!m.read).length)}
function latestUnread(s:SaveLike){return (s.messages||[]).find(m=>m.from!=='Toi'&&!m.read)||null}
function latestIncoming(s:SaveLike){return (s.messages||[]).find(m=>m.from&&m.from!=='Toi')||null}
function appIcon(label:string){const t=label.toLowerCase();if(t.includes('message'))return'●';if(t.includes('appel'))return'☎';if(t.includes('mail'))return'✉';if(t.includes('agenda'))return'31';if(t.includes('presse'))return'P';if(t.includes('insta'))return'◎';if(t.includes('galerie'))return'▧';if(t.includes('contact'))return'♙';return'•'}

function ensureChrome(phone:HTMLElement,s:SaveLike){
  phone.classList.add('nativePhoneShell');
  let bar=phone.querySelector<HTMLElement>('.nativeStatusBar');
  if(!bar){bar=document.createElement('div');bar.className='nativeStatusBar';bar.innerHTML='<strong></strong><div class="nativeIsland"></div><span class="nativeSignal">▮▮▮ ᯤ ▰</span>';phone.prepend(bar)}
  const time=bar.querySelector<HTMLElement>('strong');if(time)time.textContent=s.time||'09:00';
  if(!phone.querySelector('.nativeHomeIndicator')){const home=document.createElement('div');home.className='nativeHomeIndicator';phone.appendChild(home)}
}

function cleanButtonIcon(button:HTMLButtonElement,label:string,index:number,unread:number){
  const badge=label.toLowerCase().includes('message')&&unread>0?`<em class="nativeUnreadBadge">${unread}</em>`:'';
  button.className=`nativeApp nativeApp-${index%8}${button.dataset.nativeContacts==='1'?' nativeContacts':''}`;
  button.dataset.nativeApp='1';
  button.innerHTML=`<i class="realAppIcon">${appIcon(label)}</i><span>${safe(label)}</span>${badge}`;
}
function decorateApps(phone:HTMLElement,s:SaveLike){
  const grid=phone.querySelector<HTMLElement>('.appGrid');if(!grid)return;
  phone.classList.add('nativePhoneHome');phone.querySelector('.nativePhoneWidget')?.remove();
  const unread=unreadCount(s);
  const buttons=[...grid.querySelectorAll<HTMLButtonElement>(':scope > button')];
  buttons.forEach((b,i)=>{const label=(b.querySelector('span')?.textContent||b.dataset.phoneapp||'App').trim();cleanButtonIcon(b,label,i,unread)});
  const duplicates=[...grid.querySelectorAll<HTMLButtonElement>('[data-native-contacts]')];duplicates.slice(1).forEach(b=>b.remove());
  if(!grid.querySelector('[data-native-contacts]')){const contacts=document.createElement('button');contacts.type='button';contacts.dataset.nativeContacts='1';grid.appendChild(contacts);cleanButtonIcon(contacts,'Contacts',grid.children.length-1,unread)}
}

function marineInviteActive(s:SaveLike){if(Number(s.day||1)!==1||s.metLucas||f(s).dayOneMarineReply)return false;return (s.messages||[]).some(m=>m.from==='Marine'&&/(ar[eè]nes|caf[eé]|allez viens|on prend un caf|viens|rejoins)/i.test(m.text||''))}
const replyMap={
  now:{mine:'J’arrive',answer:'Parfait ☕ Je t’attends vers les arènes.',thread:'marine_join_now',guide:'goMarine'},
  prepare:{mine:'Je me prépare et je te rejoins',answer:'Ça marche, prends ton temps. Dis-moi quand tu sors.',thread:'marine_after_prepare',guide:'prepareThenMarine'},
  later:{mine:'Je te redis dans un moment',answer:'Ça marche 😌 Je bouge un peu, redis-moi.',thread:'marine_later',guide:'freeMorning'}
} as const;
type ReplyKind=keyof typeof replyMap;

function messageMarkup(m:Message){return `<article class="msg ${m.from==='Toi'?'mine':''} ${m.read?'':'unread'}"><b>${safe(m.from)}</b><p>${safe(m.text)}</p><span>Jour ${m.day}</span></article>`}
function buildThreadFromSave(c:HTMLElement,s:SaveLike){
  const messages=(s.messages||[]).slice(0,16).reverse();
  c.innerHTML=`<small class="nativeMessagesLabel">MESSAGES</small><div class="smsThread">${messages.length?messages.map(messageMarkup).join(''):'<p class="empty">Aucun message pour le moment.</p>'}</div>`;
}
function markThreadRead(s:SaveLike,name:string){let changed=false;for(const m of s.messages||[]){if(m.from===name&&!m.read){m.read=true;changed=true}}if(changed){s.phoneUnread=(s.messages||[]).filter(m=>m.from!=='Toi'&&!m.read).length;write(s)}}
function activeContact(s:SaveLike,c:HTMLElement){if(marineInviteActive(s))return'Marine';const visible=[...c.querySelectorAll<HTMLElement>('.msg b')].map(x=>x.textContent?.trim()||'').reverse().find(x=>x&&x!=='Toi');return visible||latestIncoming(s)?.from||'Messages'}

function mountQuickReplies(c:HTMLElement,s:SaveLike){
  c.querySelector('.nativeQuickReplies')?.remove();if(!marineInviteActive(s))return;
  const box=document.createElement('div');box.className='nativeQuickReplies';box.innerHTML='<span>RÉPONDRE À MARINE</span><button data-native-reply="now">J’arrive</button><button data-native-reply="prepare">Je me prépare et je te rejoins</button><button data-native-reply="later">Je te redis dans un moment</button>';
  c.appendChild(box)
}
function appendBubble(thread:HTMLElement,from:string,text:string,mine=false){const article=document.createElement('article');article.className=`msg ${mine?'mine ':''}nativeMessageArrive`;article.innerHTML=`<b>${safe(from)}</b><p>${safe(text)}</p><span>Jour 1</span>`;thread.appendChild(article);window.setTimeout(()=>article.classList.remove('nativeMessageArrive'),520);window.requestAnimationFrame(()=>thread.scrollTo({top:thread.scrollHeight,behavior:'smooth'}))}
function armPendingDelivery(){if(pendingTimer)window.clearTimeout(pendingTimer);const s=read(),due=Number(f(s).phoneReplyDueAt||0);if(!due||f(s).phoneReplyDelivered)return;pendingTimer=window.setTimeout(()=>{pendingTimer=0;deliverPendingReply();syncPhone(true)},Math.max(0,due-Date.now()+40))}
function chooseReply(kind:ReplyKind){const s=read(),state=f(s),r=replyMap[kind];if(state.dayOneMarineReply)return;s.messages=s.messages||[];s.messages.unshift({from:'Toi',text:r.mine,day:Number(s.day||1),read:true});state.dayOneMarineReply=kind;state.dayOneThread=r.thread;state.dayOneSuggestedAction=r.guide;state.phoneTypingContact='Marine';state.phoneReplyDueAt=Date.now()+1100;state.phoneReplyText=r.answer;state.phoneReplyDelivered=false;write(s);const c=document.querySelector<HTMLElement>('.phoneDevice #phoneContent'),thread=c?.querySelector<HTMLElement>('.smsThread');c?.querySelector('.nativeQuickReplies')?.remove();if(thread){appendBubble(thread,'Toi',r.mine,true);const typing=document.createElement('div');typing.className='smsPending nativeTyping nativeInjectedTyping';typing.innerHTML='<i></i><span class="nativeTypingLabel">Marine écrit…</span>';thread.appendChild(typing);window.requestAnimationFrame(()=>thread.scrollTo({top:thread.scrollHeight,behavior:'smooth'}))}armPendingDelivery()}
function deliverPendingReply(){const s=read(),state=f(s);if(!state.phoneReplyDueAt||state.phoneReplyDelivered||Date.now()<Number(state.phoneReplyDueAt))return;const text=String(state.phoneReplyText||'');if(text){s.messages=s.messages||[];s.messages.unshift({from:'Marine',text,day:Number(s.day||1),read:!!document.querySelector('.phoneDevice.isMessagesOpen')})}state.phoneReplyDelivered=true;state.phoneTypingContact='';s.phoneUnread=(s.messages||[]).filter(m=>m.from!=='Toi'&&!m.read).length;write(s);const c=document.querySelector<HTMLElement>('.phoneDevice #phoneContent'),thread=c?.querySelector<HTMLElement>('.smsThread');thread?.querySelector('.nativeInjectedTyping')?.remove();if(thread&&text)appendBubble(thread,'Marine',text,false)}

function decorateConversation(phone:HTMLElement,s:SaveLike,force=false){
  const c=phone.querySelector<HTMLElement>('#phoneContent');if(!c)return;
  if(force&&marineInviteActive(s))buildThreadFromSave(c,s);
  let thread=c.querySelector<HTMLElement>('.smsThread');
  if(force&&!thread){buildThreadFromSave(c,s);thread=c.querySelector<HTMLElement>('.smsThread')}
  if(!thread){phone.classList.remove('isMessagesOpen');c.classList.remove('nativeMessages');return}
  phone.classList.add('isMessagesOpen');c.classList.add('nativeMessages');phone.querySelector('.nativeNotificationStack')?.remove();
  const name=activeContact(s,c);markThreadRead(s,name);
  let head=c.querySelector<HTMLElement>('.nativeThreadHead');if(!head){head=document.createElement('div');head.className='nativeThreadHead';c.prepend(head)}
  const typing=String(f(s).phoneTypingContact||'')===name&&!f(s).phoneReplyDelivered;
  head.innerHTML=`<button type="button" class="nativeBack" aria-label="Retour">‹</button><i>${safe(initials(name))}</i><div><strong>${safe(name)}</strong><small class="nativePresence">${typing?'écrit…':'Messages'}</small></div><button type="button" aria-label="Appeler">☎</button>`;
  mountQuickReplies(c,s);armPendingDelivery();window.requestAnimationFrame(()=>thread?.scrollTo({top:thread.scrollHeight}))
}
function ensureNotification(phone:HTMLElement,s:SaveLike){if(phone.classList.contains('isMessagesOpen'))return;const unread=latestUnread(s);let stack=phone.querySelector<HTMLElement>('.nativeNotificationStack');if(!unread){stack?.remove();return}const key=`${unread.from}|${unread.text}|${unread.day}`;if(!stack){stack=document.createElement('div');stack.className='nativeNotificationStack';phone.appendChild(stack)}if(stack.dataset.key!==key){stack.dataset.key=key;stack.innerHTML=`<button type="button" class="nativeNotification"><i class="nativeNotificationIcon">●</i><span class="nativeNotificationText"><strong>${safe(unread.from)}</strong><span>${safe(unread.text)}</span></span><time>maintenant</time></button>`}}
function syncPhone(forceMessages=false){deliverPendingReply();const phone=document.querySelector<HTMLElement>('.phoneDevice');if(!phone)return;const s=read();ensureChrome(phone,s);decorateApps(phone,s);const shouldOpen=forceMessages||marineInviteActive(s)&&unreadCount(s)>0;decorateConversation(phone,s,shouldOpen);ensureNotification(phone,s)}
function schedule(forceMessages=false){if(syncTimer)window.clearTimeout(syncTimer);syncTimer=window.setTimeout(()=>syncPhone(forceMessages),70)}

document.addEventListener('click',e=>{
  const t=e.target as HTMLElement|null;if(!t)return;
  const reply=t.closest<HTMLElement>('[data-native-reply]');if(reply){e.preventDefault();chooseReply((reply.dataset.nativeReply||'later') as ReplyKind);return}
  if(t.closest('[data-phoneapp="messages"],.nativeNotification')){window.setTimeout(()=>schedule(true),80);return}
  if(t.closest('.nativeBack')){const phone=t.closest<HTMLElement>('.phoneDevice');const c=phone?.querySelector<HTMLElement>('#phoneContent');phone?.classList.remove('isMessagesOpen');c?.classList.remove('nativeMessages');if(c)c.innerHTML='';return}
  if(t.closest('#premiumPhone,#phone,#phoneExact')){window.setTimeout(()=>{const s=read();schedule(marineInviteActive(s)&&unreadCount(s)>0)},80);return}
  if(t.closest('.phoneDevice,[data-phoneapp]'))window.setTimeout(()=>schedule(false),80)
},{capture:true});
window.addEventListener('storage',()=>schedule(false));
new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n instanceof HTMLElement&&(n.matches?.('.phoneDevice,#phoneContent,.smsThread')||n.querySelector?.('.phoneDevice,#phoneContent,.smsThread')))))schedule(false)}).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});
schedule(false);
console.info('[Phone] deterministic single-icon shell with reliable Marine thread');
