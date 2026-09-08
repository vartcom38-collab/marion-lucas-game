import './phonePleasant.css';

type SaveLike={day:number;phoneUnread:number;messages?:Array<{from:string;text:string;day:number;read:boolean}>;flags:Record<string,boolean|number|string>;updatedAt:number};
const SAVE_KEY='marion-lucas-save-v4';

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function unreadMarine(s:SaveLike){return Boolean(s.messages?.some(m=>m.from==='Marine'&&!m.read))}
function messageButton(phone:HTMLElement){return [...phone.querySelectorAll<HTMLButtonElement>('.appGrid button,button')].find(b=>/message|messagerie|sms/i.test((b.textContent||'').trim()))||null}
function threadToBottom(root:ParentNode=document){const thread=root.querySelector<HTMLElement>('.smsThread');if(thread)requestAnimationFrame(()=>thread.scrollTo({top:thread.scrollHeight,behavior:'smooth'}))}

function mountFirstPhoneCue(){
  const phone=document.querySelector<HTMLElement>('.phoneDevice');
  const s=read();
  if(!phone||!s)return;
  phone.classList.add('phonePleasant');
  threadToBottom(phone);
  if(s.flags.firstPhoneOpened)return;
  s.flags.firstPhoneOpened=true;
  write(s);
  if(s.day!==1||!unreadMarine(s))return;
  const btn=messageButton(phone);if(!btn)return;
  const cue=document.createElement('button');cue.type='button';cue.className='firstPhoneCue';cue.innerHTML='<span>Marine</span><strong>Tu as un message</strong><small>Voir la conversation</small>';
  phone.appendChild(cue);
  cue.onclick=()=>{cue.classList.add('leaving');window.setTimeout(()=>cue.remove(),180);btn.click();window.setTimeout(()=>threadToBottom(phone),120)};
  window.setTimeout(()=>{if(cue.isConnected)cue.classList.add('settled')},2600);
}

function handleClick(e:MouseEvent){
  const target=e.target as HTMLElement|null;if(!target)return;
  if(target.closest('#premiumPhone,[data-overlay="phone"],[data-open="phone"]'))window.setTimeout(mountFirstPhoneCue,120);
  if(target.closest('.phoneDevice .appGrid button'))window.setTimeout(()=>threadToBottom(document),120);
  if(target.closest('.smsComposer button'))window.setTimeout(()=>threadToBottom(document),180);
}

document.addEventListener('click',handleClick,{passive:true});
window.addEventListener('storage',()=>window.setTimeout(mountFirstPhoneCue,80));
console.info('[Phone] pleasant first-open flow and gentle message guidance active');
