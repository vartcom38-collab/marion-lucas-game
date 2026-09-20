export type LivingChoice={id:string;label:string;next?:string[];nextNodeIds?:string[];effects?:Record<string,unknown>};
export type LivingNode={id:string;entrySrc?:string;holdSrc?:string;choices:LivingChoice[];directorNext?:string[];fallbackMs?:number;directorBeat?:{kind:'message'|'presence'|'world';from?:string;text?:string};framing?:{subject?:string;faceReadable?:boolean;movement?:string}};
type RuntimeState={node:LivingNode|null;video:HTMLVideoElement|null;hold:HTMLVideoElement|null;root:HTMLElement|null;preloads:Map<string,HTMLVideoElement>;history:string[]};
const state:RuntimeState={node:null,video:null,hold:null,root:null,preloads:new Map(),history:[]};

const MARION_MORNING_VIDEO='https://pikaso.cdnpk.net/private/production/5500260735/be35cd8f-953e-4419-9568-a7dc01c1c624-0.mp4?token=exp=1790294400~hmac=c5f554912bb8c0acada900bf54be92c67441f165839bdeafef843c51411839a9';

const day1Nodes:Record<string,LivingNode>={
 D1_HOME_WAKE_001:{id:'D1_HOME_WAKE_001',entrySrc:MARION_MORNING_VIDEO,holdSrc:MARION_MORNING_VIDEO,framing:{subject:'Marion',faceReadable:true,movement:'keep face readable through standing and walking; follow/reframe rather than crop'},choices:[
  {id:'phone',label:'Regarder le téléphone',nextNodeIds:['D1_PHONE_MARINE'],effects:{minutes:4,memory:'Tu as commencé la matinée en regardant ton téléphone.',flags:{day1CheckedPhone:true}}},
  {id:'ready',label:'Me préparer',nextNodeIds:['D1_GET_READY'],effects:{minutes:12,energy:-1,memory:'Tu as pris le temps de te préparer avant de sortir.',flags:{day1GettingReady:true}}},
  {id:'coffee',label:'Prendre un café',nextNodeIds:['D1_COFFEE'],effects:{minutes:10,energy:4,stress:-2,memory:'Tu as commencé la journée tranquillement autour d’un café.',flags:{day1Coffee:true}}},
  {id:'wait',label:'Rester encore un peu',nextNodeIds:['D1_QUIET_WINDOW'],effects:{minutes:8,stress:-1,memory:'Tu as laissé la matinée commencer sans te presser.',flags:{day1StayedQuiet:true}}}
 ]},
 D1_PHONE_MARINE:{id:'D1_PHONE_MARINE',fallbackMs:180,directorBeat:{kind:'message',from:'Marine',text:'Tu vas pas passer ta matinée enfermée 😭 Allez viens. Je suis vers les arènes. On prend un café ?'},choices:[
  {id:'reply',label:'Répondre à Marine',nextNodeIds:['D1_HOME_AFTER_PHONE'],effects:{minutes:5,memory:'Tu as répondu à Marine sans quitter le rythme tranquille du matin.',flags:{day1RepliedMarine:true}}},
  {id:'later',label:'Répondre plus tard',nextNodeIds:['D1_HOME_AFTER_PHONE'],effects:{minutes:2,memory:'Tu as gardé le message de Marine pour un peu plus tard.'}}
 ]},
 D1_HOME_AFTER_PHONE:{id:'D1_HOME_AFTER_PHONE',fallbackMs:180,choices:[
  {id:'coffee',label:'Faire un café',nextNodeIds:['D1_COFFEE'],effects:{minutes:10,energy:4,stress:-2}},
  {id:'ready',label:'Commencer à me préparer',nextNodeIds:['D1_GET_READY'],effects:{minutes:12,energy:-1}},
  {id:'quiet',label:'Rester près de la fenêtre',nextNodeIds:['D1_QUIET_WINDOW'],effects:{minutes:6,stress:-1}}
 ]},
 D1_COFFEE:{id:'D1_COFFEE',fallbackMs:180,choices:[
  {id:'ready',label:'Me préparer',nextNodeIds:['D1_GET_READY'],effects:{minutes:12,energy:-1}},
  {id:'phone',label:'Reprendre mon téléphone',nextNodeIds:['D1_PHONE_MARINE'],effects:{minutes:3}},
  {id:'window',label:'Finir le café près de la fenêtre',nextNodeIds:['D1_QUIET_WINDOW'],effects:{minutes:6,stress:-1}}
 ]},
 D1_QUIET_WINDOW:{id:'D1_QUIET_WINDOW',fallbackMs:180,choices:[
  {id:'ready',label:'Bon, je me prépare',nextNodeIds:['D1_GET_READY'],effects:{minutes:12}},
  {id:'phone',label:'Voir le message de Marine',nextNodeIds:['D1_PHONE_MARINE'],effects:{minutes:3}},
  {id:'linger',label:'Encore quelques minutes',nextNodeIds:['D1_GET_READY'],effects:{minutes:5,stress:-1}}
 ]},
 D1_GET_READY:{id:'D1_GET_READY',fallbackMs:180,choices:[
  {id:'finish',label:'Finir de me préparer',nextNodeIds:['D1_READY_TO_GO'],effects:{minutes:10,flags:{day1Ready:true}}},
  {id:'phone',label:'Vérifier mon téléphone',nextNodeIds:['D1_PHONE_MARINE'],effects:{minutes:3}}
 ]},
 D1_READY_TO_GO:{id:'D1_READY_TO_GO',fallbackMs:180,choices:[
  {id:'leave',label:'Sortir dans Nîmes',nextNodeIds:['D1_NIMES_ENTRY'],effects:{minutes:8,place:'nimes',memory:'Tu as quitté l’appartement pour commencer vraiment la journée.',flags:{day1LeftHome:true}}},
  {id:'coffee',label:'Un dernier café avant de partir',nextNodeIds:['D1_COFFEE'],effects:{minutes:7,energy:2}}
 ]},
 D1_NIMES_ENTRY:{id:'D1_NIMES_ENTRY',fallbackMs:450,directorBeat:{kind:'world',text:'Nîmes est déjà en mouvement. Marine est dans le secteur.'},choices:[
  {id:'walk',label:'Marcher vers le centre',nextNodeIds:['D1_NIMES_WALK'],effects:{minutes:12,memory:'Tu as pris la direction du centre de Nîmes.',flags:{day1InNimes:true}}},
  {id:'marine',label:'Regarder où est Marine',nextNodeIds:['D1_NIMES_WALK'],effects:{minutes:4,flags:{day1LookingForMarine:true}}},
  {id:'wander',label:'Prendre mon temps',nextNodeIds:['D1_NIMES_WALK'],effects:{minutes:9,stress:-1}}
 ]},
 D1_NIMES_WALK:{id:'D1_NIMES_WALK',fallbackMs:450,choices:[
  {id:'arenes',label:'Continuer vers les arènes',nextNodeIds:['D1_MARINE_APPROACH'],effects:{minutes:10,memory:'Tu t’es rapprochée des arènes sans savoir ce que la journée allait provoquer.',flags:{day1NearArenes:true}}},
  {id:'message',label:'Envoyer un message à Marine',nextNodeIds:['D1_MARINE_APPROACH'],effects:{minutes:4,flags:{day1PingedMarine:true}}},
  {id:'observe',label:'Regarder la ville autour de moi',nextNodeIds:['D1_MARINE_APPROACH'],effects:{minutes:7}}
 ]},
 D1_MARINE_APPROACH:{id:'D1_MARINE_APPROACH',fallbackMs:550,directorBeat:{kind:'presence',from:'Marine',text:'Marine apparaît dans le mouvement de la ville, sans interrompre la scène.'},choices:[
  {id:'join',label:'Rejoindre Marine',nextNodeIds:[],effects:{minutes:6,memory:'Tu as retrouvé Marine près des arènes.',flags:{day1MarineReached:true}}},
  {id:'wait',label:'L’attendre quelques minutes',nextNodeIds:[],effects:{minutes:5,flags:{day1WaitingMarine:true}}}
 ]}
};

function setFilmState(active:boolean){document.querySelector<HTMLElement>('.game')?.classList.toggle('livingSceneActive',active);document.body.classList.toggle('livingSceneActive',active)}
function ensureRoot(){
 let root=document.getElementById('livingBranchPlayer');
 if(!root){root=document.createElement('section');root.id='livingBranchPlayer';root.className='livingBranchPlayer';root.innerHTML='<video class="livingEntry" playsinline></video><video class="livingHold" playsinline loop muted></video><div class="livingChoices" aria-live="polite"></div>';document.body.appendChild(root)}
 state.root=root;state.video=root.querySelector('.livingEntry');state.hold=root.querySelector('.livingHold');return root;
}
function preload(url:string){if(!url||state.preloads.has(url))return;const v=document.createElement('video');v.preload='auto';v.playsInline=true;v.muted=true;v.src=url;state.preloads.set(url,v)}
function candidateNode(choice:LivingChoice){
 const ids=(choice.nextNodeIds||[]).filter(id=>!state.history.slice(-3).includes(id));
 const pool=ids.length?ids:(choice.nextNodeIds||[]);
 return pool.length?day1Nodes[pool[Math.floor(Math.random()*pool.length)]]:null;
}
function showDirectorBeat(node:LivingNode){const root=ensureRoot();root.querySelector('.livingDirectorBeat')?.remove();if(!node.directorBeat)return;const beat=document.createElement('div');beat.className='livingDirectorBeat';beat.innerHTML=`${node.directorBeat.from?`<b>${node.directorBeat.from}</b>`:''}<span>${node.directorBeat.text||''}</span>`;root.appendChild(beat);requestAnimationFrame(()=>beat.classList.add('visible'));window.setTimeout(()=>beat.classList.add('leaving'),2600);window.setTimeout(()=>beat.remove(),3100)}
function showChoices(node:LivingNode){
 const root=ensureRoot(),box=root.querySelector('.livingChoices') as HTMLElement;box.innerHTML='';
 node.choices.slice(0,4).forEach((choice,i)=>{const b=document.createElement('button');b.type='button';b.className='livingChoice';b.textContent=choice.label;b.style.setProperty('--choice-index',String(i));b.onclick=()=>selectChoice(choice);box.appendChild(b);(choice.next||[]).forEach(preload);(choice.nextNodeIds||[]).forEach(id=>{const n=day1Nodes[id];if(n?.entrySrc)preload(n.entrySrc);if(n?.holdSrc)preload(n.holdSrc)})});
 root.classList.add('choiceOpen');
 window.dispatchEvent(new CustomEvent('monia:living-choice-open',{detail:{nodeId:node.id,choices:node.choices.map(c=>c.id)}}));
}
async function selectChoice(choice:LivingChoice){
 const root=ensureRoot();root.classList.add('choiceCommitted');root.querySelectorAll('button').forEach(b=>(b as HTMLButtonElement).disabled=true);
 window.dispatchEvent(new CustomEvent('monia:living-choice',{detail:{nodeId:state.node?.id,choiceId:choice.id,effects:choice.effects||{}}}));
 const next=candidateNode(choice);
 root.classList.remove('choiceOpen','choiceCommitted');(root.querySelector('.livingChoices') as HTMLElement).innerHTML='';
 if(next){await playLivingNode(next);return}
 closeLivingNode();
}
export async function playLivingNode(node:LivingNode){
 const root=ensureRoot();setFilmState(true);state.node=node;state.history.push(node.id);state.history=state.history.slice(-8);root.classList.add('active');root.classList.remove('holding','choiceOpen','choiceCommitted');root.dataset.node=node.id;
 if(node.holdSrc&&state.hold){state.hold.src=node.holdSrc;state.hold.currentTime=0;state.hold.muted=true;await state.hold.play().catch(()=>{})}
 showDirectorBeat(node);
 if(node.entrySrc&&state.video){state.video.src=node.entrySrc;state.video.currentTime=0;state.video.muted=true;await state.video.play().catch(()=>{});state.video.onended=()=>{root.classList.add('holding');showChoices(node)}}
 else window.setTimeout(()=>{root.classList.add('holding');showChoices(node)},node.fallbackMs||250);
}
export function closeLivingNode(){setFilmState(false);const root=state.root;if(!root)return;state.video?.pause();state.hold?.pause();root.remove();state.node=null;state.root=null;state.video=null;state.hold=null;state.preloads.clear()}
window.addEventListener('monia:play-living-node',((e:CustomEvent<LivingNode>)=>{const canonical=day1Nodes[e.detail?.id];playLivingNode(canonical||e.detail)}) as EventListener);
