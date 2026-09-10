import './agendaReality.css';

const SAVE_KEY='marion-lucas-save-v4';
type Item={owner:'Marion'|'Lucas'|'Nous';title:string;day:number;note:string};
type SaveLike={day:number;time:string;calendar?:Item[]};

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function safe(v:string){return v.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c))}
function ownerClass(owner:string){return owner==='Lucas'?'lucas':owner==='Nous'?'nous':'marion'}
function weekday(day:number){return ['LUN','MAR','MER','JEU','VEN','SAM','DIM'][(day-1)%7]}
function dayNumber(day:number){return ((day-1)%30)+1}

function renderAgenda(root:HTMLElement,s:SaveLike){
  if(root.dataset.realAgendaDay===String(s.day))return;
  root.dataset.realAgendaDay=String(s.day);
  const items=(s.calendar||[]).filter(i=>i.day>=s.day-1&&i.day<=s.day+13);
  const days=Array.from({length:7},(_,i)=>s.day+i);
  const today=items.filter(i=>i.day===s.day);
  root.innerHTML=`
    <div class="realAgendaTop">
      <button type="button" class="realAgendaToday" aria-label="Aujourd'hui">Aujourd’hui</button>
      <div><strong>Agenda</strong><span>Ta semaine</span></div>
      <button type="button" class="realAgendaMore" aria-label="Plus d’options">•••</button>
    </div>
    <div class="realAgendaWeek" role="list" aria-label="Semaine en cours">
      ${days.map(d=>`<div role="listitem" class="${d===s.day?'isToday':''}"><span>${weekday(d)}</span><b>${dayNumber(d)}</b><i>${items.some(i=>i.day===d)?'•':''}</i></div>`).join('')}
    </div>
    <section class="realAgendaNow">
      <header><div><span>AUJOURD’HUI</span><strong>Jour ${s.day}</strong></div><time>${safe(s.time)}</time></header>
      ${today.length?today.map(i=>`<article class="realAgendaEvent ${ownerClass(i.owner)}"><i></i><div><small>${safe(i.owner)}</small><strong>${safe(i.title)}</strong><p>${safe(i.note||'Prévu dans ta journée')}</p></div></article>`).join(''):'<div class="realAgendaEmpty"><span>○</span><strong>Rien de fixé</strong><small>Ta journée reste ouverte.</small></div>'}
    </section>
    <section class="realAgendaComing">
      <h3>À venir</h3>
      ${items.filter(i=>i.day>s.day).slice(0,8).map(i=>`<article><time><b>${weekday(i.day)}</b><span>${dayNumber(i.day)}</span></time><i class="${ownerClass(i.owner)}"></i><div><strong>${safe(i.title)}</strong><small>${safe(i.note||i.owner)}</small></div></article>`).join('')||'<p>Aucun rendez-vous prévu pour le moment.</p>'}
    </section>
    <div class="realAgendaLegend"><span><i class="marion"></i>Marion</span><span><i class="lucas"></i>Lucas</span><span><i class="nous"></i>Nous</span></div>`;
}

function mount(){
  const s=read();if(!s)return;
  const agenda=document.querySelector<HTMLElement>('.phoneDevice .agendaCalendar');
  if(agenda){agenda.classList.add('realAgenda');renderAgenda(agenda,s)}
  const call=document.querySelector<HTMLElement>('.phoneDevice .callScreen,.phoneDevice .callLive');
  if(call){
    call.classList.add('realPhoneCall');
    const phone=document.querySelector<HTMLElement>('.phoneDevice');phone?.classList.add('phoneInCall');
  }else document.querySelector<HTMLElement>('.phoneDevice')?.classList.remove('phoneInCall');
}

let timer=0;
function soon(){if(timer)window.clearTimeout(timer);timer=window.setTimeout(()=>{timer=0;mount()},70)}
document.addEventListener('click',e=>{const t=e.target as HTMLElement|null;if(t?.closest('[data-phoneapp],#premiumAgenda,.phoneDevice'))soon()},{passive:true});
window.addEventListener('storage',soon);
window.addEventListener('marion-phone-refresh',soon as EventListener);
soon();

console.info('[Phone] realistic agenda and in-phone call continuity active');
