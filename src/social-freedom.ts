import './socialFreedom.css';

const SAVE_KEY='marion-lucas-save-v4';
const LUCAS_VISIO_FALLBACK='/resources/monia/generated/intro-lucas-candidate-desktop.mp4';
type SaveLike={day?:number;time?:string;metLucas?:boolean;messages?:Array<{from:string;text:string;day:number;read:boolean}>;flags?:Record<string,boolean|number|string>;updatedAt?:number};

function read():SaveLike{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'{}') as SaveLike}catch{return {}}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('marion:statechange',{detail:{source:'social'}}))}
function flags(s:SaveLike){if(!s.flags)s.flags={};return s.flags}
function phone(){return document.querySelector<HTMLElement>('.phoneDevice')}
function content(){return document.querySelector<HTMLElement>('.phoneDevice #phoneContent')}
function safe(v:string){return v.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c))}
function isSocialApp(el:HTMLElement){const label=(el.querySelector('span')?.textContent||el.textContent||'').toLowerCase();return label.includes('appel')||label.includes('contact')}

function availableContacts(s:SaveLike){const out=[{id:'marine',name:'Marine',subtitle:'Disponible dans tes contacts',video:false}];if(s.metLucas)out.push({id:'lucas',name:'Lucas',subtitle:'Appel ou visio',video:true});return out}

function renderContacts(){const p=phone(),c=content();if(!p||!c)return;const s=read();p.classList.add('isSocialOpen');p.classList.remove('isMessagesOpen');const contacts=availableContacts(s);c.className='socialFreedomPanel';c.innerHTML=`<div class="socialFreedomHead"><button type="button" data-social-back aria-label="Retour">‹</button><div><small>CONTACTS</small><strong>Qui veux-tu appeler ?</strong></div></div><div class="socialContactList">${contacts.map(x=>`<article class="socialContact"><i>${safe(x.name.slice(0,1))}</i><div><strong>${safe(x.name)}</strong><small>${safe(x.subtitle)}</small></div><button type="button" data-social-call="${x.id}">Appeler</button>${x.video?`<button type="button" data-social-video="${x.id}">Visio</button>`:''}</article>`).join('')}</div><p class="socialHint">Ces appels sont des actions libres : ils peuvent faire évoluer le moment sans remplacer ta direction principale.</p>`}
}

function recordSocialAction(kind:string,who:string){const s=read(),f=flags(s);const key=`social_${kind}_${who}_count`;f[key]=Number(f[key]||0)+1;f.lastFreeSocialAction=`${kind}:${who}`;f.lastFreeSocialAt=Date.now();write(s)}

function showCall(who:string){const p=phone(),c=content();if(!p||!c)return;recordSocialAction('call',who);const name=who==='lucas'?'Lucas':'Marine';p.classList.add('isSocialOpen');c.className='socialFreedomPanel socialCallScreen';c.innerHTML=`<div class="socialCallAvatar">${safe(name.slice(0,1))}</div><small>APPEL EN COURS</small><strong>${safe(name)}</strong><span>sonnerie…</span><button type="button" data-social-end>Raccrocher</button>`;window.setTimeout(()=>{const state=c.querySelector('span');if(state)state.textContent='appel connecté'},900)}

function showLucasVisio(){const p=phone(),c=content();if(!p||!c)return;const s=read();if(!s.metLucas)return;recordSocialAction('visio','lucas');p.classList.add('isSocialOpen');c.className='socialFreedomPanel socialVideoScreen';c.innerHTML=`<video class="socialVideo" src="${LUCAS_VISIO_FALLBACK}" autoplay muted loop playsinline></video><div class="socialVideoTop"><small>VISIO</small><strong>Lucas</strong></div><div class="socialVideoControls"><button type="button" data-social-mute>Micro</button><button type="button" data-social-end>Raccrocher</button></div><div class="socialVideoNote">Clip Lucas validé utilisé comme fallback tant que les états visio dédiés ne sont pas approuvés.</div>`}
}

function closeSocial(){const p=phone();p?.classList.remove('isSocialOpen');const c=content();if(c)c.className='';window.dispatchEvent(new CustomEvent('marion:phone-refresh'))}

document.addEventListener('click',e=>{const t=e.target as HTMLElement|null;if(!t)return;const app=t.closest<HTMLElement>('.phoneDevice .nativeApp');if(app&&isSocialApp(app)){e.preventDefault();e.stopPropagation();renderContacts();return}const call=t.closest<HTMLElement>('[data-social-call]');if(call){e.preventDefault();showCall(call.dataset.socialCall||'marine');return}const video=t.closest<HTMLElement>('[data-social-video]');if(video){e.preventDefault();if(video.dataset.socialVideo==='lucas')showLucasVisio();return}if(t.closest('[data-social-back]')){e.preventDefault();closeSocial();return}if(t.closest('[data-social-end]')){e.preventDefault();renderContacts();return}if(t.closest('[data-social-mute]')){const v=document.querySelector<HTMLVideoElement>('.socialVideo');if(v)v.muted=!v.muted;return}},{capture:true});

console.info('[Social] free calls and validated visio actions active');
