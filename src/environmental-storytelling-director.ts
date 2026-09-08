import './environmentalStorytellingDirector.css';

type SaveLike={day:number;place:string;screen:string;official:boolean;relationship:number;trust:number;stress?:number;chemistry?:number;memories?:string[];flags:Record<string,boolean|number|string>;updatedAt?:number};
const SAVE_KEY='marion-lucas-save-v4';
let lastSignature='';
let open=false;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function homeLike(place:string){return['finca','estate','madrid'].includes(place)}
function clean(game:HTMLElement){game.querySelector('#environmentalStorytellingLayer')?.remove();game.querySelector('#environmentalStoryMoment')?.remove();lastSignature='';open=false}
function addMemory(s:SaveLike,t:string){s.memories=Array.isArray(s.memories)?s.memories:[];if(!s.memories.includes(t))s.memories.unshift(t);s.memories=s.memories.slice(0,260)}

function stage(s:SaveLike){
  const finca=Math.max(Number(s.flags.fincaBelongingLevel||0),Number(s.flags.fincaDaysSeen||0)>=7?4:Number(s.flags.fincaDaysSeen||0)>=5?3:Number(s.flags.fincaDaysSeen||0)>=3?2:Number(s.flags.fincaDaysSeen||0)>=1?1:0);
  const rituals=Number(s.flags.coupleRitualCount||0);
  const domestic=Number(s.flags.domesticCoexistenceLastDay||0)>0;
  const returned=Number(s.flags.postTravelHomeResetDay||0)===s.day;
  const close=Number(s.relationship||0)>=68&&Number(s.trust||0)>=50;
  return{finca,rituals,domestic,returned,close};
}

function propsFor(s:SaveLike){
  const x=stage(s);const out:string[]=[];
  if(s.place==='finca'||s.place==='estate'){
    if(x.finca>=1)out.push('bag');
    if(x.finca>=2)out.push('bath');
    if(x.finca>=3)out.push('book','charger');
    if(x.finca>=4)out.push('drawer');
    if(x.rituals>=2)out.push('mugs');
    if(x.domestic&&x.close)out.push('jacket');
    if(x.returned)out.push('travelbag');
  }else if(s.place==='madrid'){
    if(x.rituals>=2)out.push('mugs');
    if(x.domestic)out.push('jacket');
    if(x.close)out.push('book','charger');
    if(x.returned)out.push('travelbag');
  }
  return out;
}

function momentFor(kind:string,s:SaveLike){
  if(kind==='bag')return{title:'Ton sac',body:'Tu sais maintenant où le poser sans regarder autour de toi.',action:'Le poser à sa place',memory:'À la finca, tu as eu le réflexe de poser ton sac à sa place sans te sentir invitée.'};
  if(kind==='bath')return{title:'Un petit truc à toi',body:'Il est resté là assez longtemps pour ne plus ressembler à un oubli.',action:'Le laisser là',memory:'Une petite affaire à toi est restée naturellement près de celles de Lucas.'};
  if(kind==='book')return{title:'Ton livre',body:'Tu l’avais posé là pour quelques pages. Il a fini par faire partie du décor.',action:'Lire quelques minutes',memory:'Tu as retrouvé ton livre là où tu l’avais laissé, comme dans un endroit devenu familier.'};
  if(kind==='charger')return{title:'Le chargeur',body:'Le détail le moins romantique du monde. Et pourtant, il dit beaucoup.',action:'Brancher ton téléphone',memory:'Même ton chargeur avait fini par avoir sa place dans le quotidien avec Lucas.'};
  if(kind==='drawer')return{title:'Le tiroir',body:'Tu l’ouvres sans demander. Tes affaires sont là, rangées parmi les siennes.',action:'Y ranger quelque chose',memory:'Tu as ouvert un tiroir pour ranger quelque chose sans avoir à demander où était ta place.'};
  if(kind==='mugs')return{title:'Deux mugs',body:'Personne n’a décrété que c’était votre habitude. C’est juste devenu le cas.',action:'Préparer les deux',memory:'Tu as préparé deux mugs par réflexe, comme un petit rituel déjà installé.'};
  if(kind==='jacket')return{title:'Sa veste',body:'Elle traîne encore là où il l’a laissée. Le genre de détail qui rend un lieu habité.',action:'La laisser tranquille',memory:'La veste de Lucas traînait dans la pièce, petite preuve d’un quotidien pas toujours rangé.'};
  if(kind==='travelbag')return{title:'Le sac de voyage',body:'Il est encore posé là. Le retour n’est pas tout à fait terminé.',action:'Le pousser dans un coin',memory:'Le sac de voyage est resté posé un moment, comme si le déplacement n’avait pas encore complètement quitté la maison.'};
  return{title:'Un détail',body:'Quelque chose dans le décor te rappelle que ce lieu a changé avec vous.',action:'Continuer',memory:'Un détail du lieu t’a rappelé que votre histoire y laisse maintenant des traces.'};
}

function interact(kind:string){
  if(open)return;const s=read();const game=document.querySelector<HTMLElement>('main.game');if(!s||!game||!homeLike(s.place))return;
  open=true;const e=momentFor(kind,s);const card=document.createElement('aside');card.id='environmentalStoryMoment';card.className='environmentalStoryMoment';
  card.innerHTML=`<span>UN DÉTAIL DU QUOTIDIEN</span><strong>${e.title}</strong><small>${e.body}</small><button type="button">${e.action}</button>`;game.appendChild(card);
  card.querySelector('button')?.addEventListener('click',()=>{
    const f=read();if(f){f.flags.environmentInteractionDay=f.day;f.flags.environmentInteractionKind=kind;f.stress=Math.max(0,Number(f.stress||0)-1);if(kind==='drawer'||kind==='mugs')f.trust=Number(f.trust||0)+1;addMemory(f,e.memory);write(f)}
    card.classList.add('is-leaving');setTimeout(()=>{card.remove();open=false},260);
  });
}

function render(){
  const s=read();const game=document.querySelector<HTMLElement>('main.game');
  if(!s||!game||s.screen!=='game'||!s.official||!homeLike(s.place)){if(game)clean(game);return}
  const props=propsFor(s);const sig=`${s.place}|${props.join(',')}`;if(sig===lastSignature&&game.querySelector('#environmentalStorytellingLayer'))return;
  clean(game);lastSignature=sig;if(!props.length)return;
  const layer=document.createElement('div');layer.id='environmentalStorytellingLayer';layer.className=`environmentalStorytellingLayer env-${s.place}`;layer.setAttribute('aria-label','Détails du lieu');
  props.forEach((kind,i)=>{const node=document.createElement('button');node.type='button';node.className=`envProp env-${kind}`;node.dataset.envKind=kind;node.style.setProperty('--env-i',String(i));node.setAttribute('aria-label',`Observer ${momentFor(kind,s).title}`);node.addEventListener('click',ev=>{ev.stopPropagation();interact(kind)});layer.appendChild(node)});
  game.appendChild(layer);
}

window.addEventListener('storage',render);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
window.setInterval(render,12000);
window.setTimeout(render,900);
console.info('[World] environmental storytelling is visible and subtly interactive without hotspot clutter');
