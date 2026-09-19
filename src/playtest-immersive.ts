import {shouldTriggerDay1FirstContact} from './day1-chronology';
import './playtest-ambient-audio';
type SceneKey='home'|'madeleine'|'esplanade'|'marine'|'arenes'|'feria'|'encounter';

type SceneDef={title:string;sub:string;image:string;video?:string;audio:'home'|'street'|'feria'|'quiet'};
const app=document.querySelector<HTMLDivElement>('#app')!;
const scenes:Record<SceneKey,SceneDef> = {
  home:{title:'Nîmes · Appartement',sub:'Jour 1 · 09:00',image:'./resources/appartement-nimes.png',audio:'home'},
  madeleine:{title:'Rue de la Madeleine',sub:'Vers le centre',image:'./resources/nimes/nimes-street.webp',video:'./resources/living/street.mp4',audio:'street'},
  esplanade:{title:'Esplanade Charles-de-Gaulle',sub:'Quelques minutes des arènes',image:'./resources/nimes/nimes-street.webp',video:'./resources/living/street.mp4',audio:'street'},
  marine:{title:'Avec Marine',sub:'En marchant vers les arènes',image:'./resources/nimes/nimes-street.webp',video:'./resources/living/street.mp4',audio:'street'},
  arenes:{title:'Arènes de Nîmes',sub:'Feria · la ville se densifie',image:'./resources/nimes/nimes-arenes.webp',video:'./resources/living/arenes.mp4',audio:'feria'},
  feria:{title:'Autour des arènes',sub:'Feria · foule en mouvement',image:'./resources/nimes/nimes-arenes.webp',video:'./resources/living/arenes.mp4',audio:'feria'},
  encounter:{title:'Un instant dans la foule',sub:'Rencontre imprévue',image:'./resources/nimes/nimes-arenes.webp',video:'./resources/living/arenes.mp4',audio:'feria'},
};

let scene:SceneKey='home';
let minutes=540;
let withMarine=false;
let encounterGenerated=false;
let metDominic=false;
let firstContactEarliestAbs=0;
const firstContactTarget=703; // deterministic hidden playtest window, equivalent to the real Day 1 morning window


const fmt=()=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
const advance=(m:number)=>{minutes+=m};

function render(actions:Array<{label:string;primary?:boolean;run:()=>void}>,copy:{eyebrow?:string;title:string;body:string},opts?:{marine?:string;video?:string;status?:string}){
  const s=scenes[scene];
  window.dispatchEvent(new CustomEvent('playtest-ambience',{detail:{profile:s.audio,time:fmt(),scene,withMarine}}));
  app.innerHTML=`
  <main class="world" style="--bg:url('${s.image}')">
    ${s.video?`<video class="ambientSceneVideo" src="${s.video}" autoplay muted loop playsinline preload="metadata"></video>`:''}
    <div class="motionLayer"></div>
    ${scene!=='home'?`<div class="ambientPeople" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>`:''}
    <div class="grain"></div>
    <header class="hud">
      <span>JOUR 1 · ${fmt()}</span>
      <h1>${s.title}</h1>
      <small>${s.sub}</small>
    </header>

    <aside class="guide">
      <span>${copy.eyebrow||'MAINTENANT'}</span>
      <strong>${copy.title}</strong>
      <p>${copy.body}</p>
      <div class="actions">
        ${actions.map((a,i)=>`<button data-action="${i}" class="${a.primary?'primary':''}">${a.label}</button>`).join('')}
      </div>
    </aside>

    ${opts?.marine?`<aside class="companion"><span>MARINE · AVEC TOI</span><strong>${opts.marine}</strong><small>Elle marche dans la même direction. Tu n'es pas revenue à un menu.</small></aside>`:''}

    ${opts?.status?`<aside class="generation"><span>MONIA</span><strong>${opts.status}</strong><small>La scène importante est générée dans le contexte réel du jeu.</small></aside>`:''}

    ${opts?.video?`<div class="videoScene"><video autoplay playsinline controls src="${opts.video}"></video><button id="closeVideo">Revenir au jeu</button></div>`:''}

    <div class="edgeCue edgeLeft"></div><div class="edgeCue edgeRight"></div>
  </main>
  <style>
  *{box-sizing:border-box}.world{position:relative;width:100%;height:100%;background:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.34)),var(--bg) center/cover no-repeat;isolation:isolate;animation:arrive .7s ease both}
  .world:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.3),transparent 34%,transparent 68%,rgba(0,0,0,.2));z-index:0;pointer-events:none}
  .ambientSceneVideo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-3;filter:saturate(.98) contrast(1.02)}
  .ambientPeople{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden;opacity:.48}.ambientPeople i{position:absolute;bottom:7%;width:26px;height:84px;border-radius:46% 46% 38% 38%;background:linear-gradient(180deg,rgba(24,20,18,.5),rgba(9,8,8,.76));filter:blur(.8px);animation:passer 13s linear infinite}.ambientPeople i:before{content:"";position:absolute;left:4px;top:-15px;width:18px;height:18px;border-radius:50%;background:rgba(18,16,15,.72)}.ambientPeople i:nth-child(1){left:-8%;transform:scale(.78);animation-duration:15s}.ambientPeople i:nth-child(2){left:-15%;bottom:10%;transform:scale(.56);animation-delay:-6s;animation-duration:18s}.ambientPeople i:nth-child(3){left:-11%;bottom:4%;transform:scale(.95);animation-delay:-11s;animation-duration:20s}.ambientPeople i:nth-child(4){right:-8%;left:auto;bottom:12%;transform:scale(.64);animation:passerBack 17s linear infinite;animation-delay:-4s}.ambientPeople i:nth-child(5){right:-12%;left:auto;bottom:6%;transform:scale(.82);animation:passerBack 21s linear infinite;animation-delay:-12s}.ambientPeople i:nth-child(6){right:-15%;left:auto;bottom:8%;transform:scale(.48);animation:passerBack 24s linear infinite;animation-delay:-16s}
  .motionLayer{position:absolute;inset:-2%;background:var(--bg) center/cover no-repeat;z-index:-4;animation:living 11s ease-in-out infinite alternate;filter:saturate(.96)}
  .grain{position:absolute;inset:0;pointer-events:none;z-index:1;opacity:.11;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.45'/%3E%3C/svg%3E")}
  .hud{position:absolute;top:26px;left:30px;text-shadow:0 3px 22px #000;z-index:2}.hud span,.guide span,.companion span,.generation span{font-size:10px;letter-spacing:.18em;opacity:.7}.hud h1{font-family:Georgia,serif;font-size:30px;margin:6px 0 3px;font-weight:500}.hud small{opacity:.76}
  .guide{position:absolute;left:50%;bottom:28px;transform:translateX(-50%);width:min(760px,calc(100% - 36px));padding:17px 18px 18px;border:1px solid rgba(255,255,255,.18);border-radius:20px;background:rgba(15,12,10,.72);backdrop-filter:blur(18px);box-shadow:0 18px 80px rgba(0,0,0,.36);z-index:3}.guide strong{display:block;font-size:17px;margin-top:6px}.guide p{margin:7px 0 0;opacity:.76;line-height:1.45}.actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}.actions button{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#fff;border-radius:999px;padding:11px 15px;cursor:pointer;transition:.18s}.actions button:hover{transform:translateY(-2px);background:rgba(255,255,255,.14)}.actions .primary{background:#f3eee7;color:#181411;font-weight:750}
  .companion{position:absolute;left:28px;bottom:205px;width:min(330px,calc(100% - 56px));padding:14px 15px;border-radius:18px;border:1px solid rgba(255,255,255,.16);background:rgba(12,10,9,.64);backdrop-filter:blur(14px);z-index:3}.companion strong,.generation strong{display:block;margin-top:6px}.companion small,.generation small{display:block;margin-top:5px;opacity:.68;line-height:1.4}
  .generation{position:absolute;right:28px;bottom:205px;width:min(360px,calc(100% - 56px));padding:14px 15px;border-radius:18px;border:1px solid rgba(255,255,255,.16);background:rgba(12,10,9,.72);backdrop-filter:blur(14px);z-index:4}
  .videoScene{position:absolute;inset:0;background:#050505;z-index:10;display:grid;place-items:center}.videoScene video{width:100%;height:100%;object-fit:cover}.videoScene button{position:absolute;right:22px;bottom:22px;border:0;border-radius:999px;padding:11px 15px;background:rgba(255,255,255,.88);color:#171411;font-weight:700}
  .edgeCue{position:absolute;top:50%;width:18px;height:72px;border-radius:999px;background:rgba(255,255,255,.08);opacity:.45}.edgeLeft{left:12px}.edgeRight{right:12px}
  @keyframes living{0%{transform:scale(1.02) translate3d(-.4%,0,0)}100%{transform:scale(1.055) translate3d(.7%,-.35%,0)}}@keyframes passer{from{translate:-5vw 0}to{translate:118vw 0}}@keyframes passerBack{from{translate:5vw 0}to{translate:-118vw 0}}@keyframes arrive{from{opacity:.45;transform:scale(1.015)}to{opacity:1;transform:scale(1)}}
  @media(max-width:900px){.hud{top:18px;left:18px}.hud h1{font-size:25px}.guide{bottom:18px}.companion{left:18px;bottom:220px;width:300px}.generation{right:18px;bottom:220px;width:300px}}
  @media(max-width:680px){.guide{width:calc(100% - 20px);padding:14px}.actions{display:grid;grid-template-columns:1fr}.actions button{width:100%}.companion,.generation{display:none}}
  </style>`;

  actions.forEach((a,i)=>document.querySelector<HTMLButtonElement>(`[data-action="${i}"]`)?.addEventListener('click',a.run));
  document.querySelector<HTMLButtonElement>('#closeVideo')?.addEventListener('click',()=>renderEncounterAfterVideo());
}

function home(){
  scene='home';
  render([
    {label:'Lire Marine',primary:true,run:()=>{advance(6);madeleine()}},
    {label:'Prendre 10 min puis sortir',run:()=>{advance(10);madeleine()}}
  ],{eyebrow:'APPARTEMENT','title':'Marine vient de t’écrire.','body':'Tu sais quoi faire ensuite, mais tu n’es pas forcée : tu peux répondre tout de suite ou prendre quelques minutes avant de sortir.'});
}

function madeleine(){
  scene='madeleine';
  render([
    {label:'Retrouver Marine',primary:true,run:()=>{advance(7);meetMarine()}},
    {label:'Avancer vers l’esplanade',run:()=>{advance(6);esplanade(false)}},
    {label:'Continuer seule un moment',run:()=>{advance(8);esplanade(false)}},
  ],{eyebrow:'RUE DE LA MADELEINE','title':'Tu avances vraiment dans Nîmes.','body':'Le jeu te donne toujours une direction claire. Tu peux rejoindre Marine maintenant ou continuer encore un peu seule.'});
}

function esplanade(fromMarine:boolean){
  scene='esplanade';
  render([
    {label:withMarine?'Continuer avec Marine':'Rejoindre Marine',primary:true,run:()=>withMarine?arenes():meetMarine()},
    {label:'Avancer vers les arènes',run:()=>{advance(7);arenes()}},
  ],{eyebrow:'ESPLANADE','title':withMarine?'Vous continuez ensemble.':'Les arènes se rapprochent.','body':fromMarine?'Marine te parle en marchant. La caméra et les choix restent dans le monde.':'Tu peux encore rejoindre Marine ou avancer directement vers la Feria.'},withMarine?{marine:'“Viens, on passe par là, c’est plus calme.”'}:undefined);
}

function meetMarine(){
  withMarine=true;scene='marine';
  if(!firstContactEarliestAbs)firstContactEarliestAbs=1440+minutes+85;
  render([
    {label:'Marcher avec elle vers les arènes',primary:true,run:()=>{advance(9);arenes()}},
    {label:'Faire un détour par l’esplanade',run:()=>{advance(5);esplanade(true)}},
  ],{eyebrow:'AVEC MARINE','title':'Tu l’as vraiment rejointe.','body':'À partir d’ici tu n’es plus seule : elle reste dans la scène, vous marchez ensemble et les choix concernent ce que vous faites ensemble.'},{marine:'“Enfin 😭 viens, on va vers les arènes.”'});
}

function arenes(){
  scene='arenes';
  render([
    {label:'Suivre Marine dans le flux',primary:true,run:()=>{advance(6);feria()}},
    {label:'Faire le tour des arènes',run:()=>{advance(7);feria()}},
    {label:'Ralentir un instant',run:()=>{advance(3);arenes()}},
  ],{eyebrow:'ARÈNES','title':'La Feria prend vraiment de la place.','body':'La foule devient plus dense. Tu sais toujours comment avancer, mais tu ne sais pas ce qui va se passer ensuite.'},withMarine?{marine:'“C’est déjà blindé… reste avec moi.”'}:undefined);
}

function encounterEligible(){
  return shouldTriggerDay1FirstContact({
    day:1,
    place:'arenes',
    metDominic,
    flags:{firstContactTarget,firstContactEarliest:firstContactEarliestAbs}
  },minutes);
}

function continueFeria(mins:number,label:string){
  advance(mins);
  if(encounterEligible()){generateEncounter();return}
  scene='feria';
  render([
    {label:'Continuer avec Marine',primary:true,run:()=>continueFeria(14,'continuer')},
    {label:'Passer par une terrasse',run:()=>continueFeria(18,'terrasse')},
    {label:'Faire un tour autour des arènes',run:()=>continueFeria(16,'tour')},
  ],{
    eyebrow:'FERIA · '+fmt(),
    title:label==='terrasse'?'Vous vous laissez ralentir quelques minutes.':'La Feria continue autour de vous.',
    body:'La journée avance réellement. Tu as toujours une direction, mais le jeu ne te dit pas quand quelque chose d’important va arriver.'
  },withMarine?{marine:label==='terrasse'?'“On reste deux minutes et on repart.”':'“Viens, on continue par là.”'}:undefined);
}

function feria(){
  scene='feria';
  if(encounterEligible()){generateEncounter();return}
  render([
    {label:'Continuer avec Marine',primary:true,run:()=>continueFeria(14,'continuer')},
    {label:'Passer par une terrasse',run:()=>continueFeria(18,'terrasse')},
    {label:'Faire un tour autour des arènes',run:()=>continueFeria(16,'tour')},
  ],{eyebrow:'FERIA · EN MOUVEMENT','title':'Le passage se resserre devant vous.','body':'Tu continues dans la foule. La rencontre ne partira que lorsque le vrai moteur Jour 1 l’autorise.'},withMarine?{marine:'“Attends, passe par là.”'}:undefined);
}

async function generateEncounter(){
  if(encounterGenerated)return;
  encounterGenerated=true;scene='encounter';
  render([],{eyebrow:'UN INSTANT PLUS TARD','title':'Quelqu’un te coupe presque la trajectoire.','body':'MonIA prépare la scène dans le contexte exact : Jour 1, Feria, première rencontre, pas de relation préalable.'},{marine:'Marine est juste à côté, prise dans le mouvement de foule.',status:'Préparation de la scène…'});
  try{
    const { moniaExperience }=await import('./monia/experience-runtime');
    const experience=await moniaExperience.respond({
      actor:'Dominic',
      requestedChannel:'scene',
      playerText:'Première rencontre physique avec Marion pendant la Feria de Nîmes. Ils ne se connaissent pas encore. Un mouvement de foule et un téléphone tombé créent une raison naturelle de rester quelques secondes au même endroit. Dominic aide, vérifie qu’elle va bien, échange un regard et une première phrase simple. Aucun flirt appuyé, aucune intimité de couple, aucun spoiler.',
      context:{
        speaker:'Marion',
        place:'Feria de Nîmes, rues proches des arènes',
        time:fmt(),
        day:1,
        recentAction:'Marion marche avec Marine dans une foule dense vers les arènes',
        activeObjective:'continuer la Feria avec Marine',
        relationship:'Marion et Dominic ne se connaissent pas encore',
        memories:['Marine a rejoint Marion dans Nîmes et elles marchent ensemble vers les arènes.'],
        recentEvents:['Marion est sortie de son appartement et a traversé le centre de Nîmes.'],
        rules:[
          'Première rencontre absolue: aucun passé commun.',
          'Dominic est à Nîmes pour sa journée professionnelle avant sa corrida du lendemain.',
          'La caméra est cinématographique externe, jamais une visio.',
          'La scène doit rester brève, naturelle et crédible.',
          'Ne pas révéler la carrière de Dominic explicitement à Marion pendant cet instant.',
        ]
      }
    },'auto',true);
    const media=await moniaExperience.materialize(experience,{
      onImageState:(s,d)=>render([],{eyebrow:'MONIA · IMAGE',title:'La scène prend forme.',body:d||s},{marine:'Marine est juste à côté.',status:`Image · ${s}`}),
      onVideoState:(s,d)=>render([],{eyebrow:'MONIA · VIDÉO',title:'La rencontre se génère.',body:d||s},{marine:'Marine est juste à côté.',status:`Vidéo · ${s}`}),
    });
    if(media.videoUrl){
      render([],{eyebrow:'PREMIÈRE RENCONTRE',title:'Vidéo candidate générée par MonIA.','body':'C’est ce rendu qu’on doit juger avant de l’intégrer comme scène validée.'},{video:media.videoUrl});
    }else{
      renderEncounterFallback(media.state);
    }
  }catch(err){
    renderEncounterFallback(err instanceof Error?err.message:String(err));
  }
}

function renderEncounterFallback(reason:string){
  render([
    {label:'Continuer la scène sans vidéo',primary:true,run:renderEncounterAfterVideo},
    {label:'Réessayer la génération',run:()=>{encounterGenerated=false;generateEncounter()}},
  ],{eyebrow:'MONIA · FALLBACK','title':'La vidéo n’a pas pu être produite cette fois.','body':`Le gameplay continue quand même. Détail : ${reason}`},{marine:'Marine est toujours à côté de toi.'});
}

function renderEncounterAfterVideo(){
  if(!metDominic){
    metDominic=true;
    advance(34);
  }
  scene='encounter';
  render([
    {label:'Rester encore quelques secondes',primary:true,run:()=>continueAfterEncounter(3)},
    {label:'Reprendre avec Marine',run:()=>continueAfterEncounter(2)},
  ],{eyebrow:'APRÈS LA SCÈNE','title':'Tu n’es pas sortie du jeu.','body':`La rencontre a réellement pris du temps. Il est maintenant ${fmt()} et tu reprends la journée exactement là où tu étais.`},{marine:'“Ça va ?”'});
}

function continueAfterEncounter(extra:number){
  advance(extra);
  withMarine=true;
  scene='arenes';
  render([
    {label:'Continuer la Feria avec Marine',primary:true,run:()=>continueFeria(16,'continuer')},
    {label:'Faire une pause en terrasse',run:()=>continueFeria(18,'terrasse')},
    {label:'Rentrer doucement vers le centre',run:()=>{advance(14);esplanade(true)}},
  ],{eyebrow:'APRÈS LA RENCONTRE · '+fmt(),title:'La Feria continue.',body:'Dominic est reparti de son côté. Le monde ne se fige pas après la cinématique : Marine est toujours là et ta journée continue.'},{marine:'“Bon… tu me racontes ?”'});
}

try{home()}catch(err){
  const message=err instanceof Error?err.message:String(err);
  app.innerHTML=`<main style="display:grid;place-items:center;width:100%;height:100%;background:#171310;color:white;padding:24px;font-family:system-ui"><section style="max-width:680px"><small style="opacity:.6;letter-spacing:.16em">PLAYTEST IMMERSIF</small><h1>Le jeu n’a pas pu démarrer.</h1><p style="opacity:.75;line-height:1.5">${message}</p></section></main>`;
}
