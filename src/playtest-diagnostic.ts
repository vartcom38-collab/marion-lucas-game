import {day1FirstContactThresholdAbs,shouldTriggerDay1FirstContact,shouldTriggerDay1FeriaPull,nextFeriaPullEarliestAbs} from './day1-chronology';
import {hasMetDominic,hasFirstDominicMessage,canDominicUsePhoneAutonomously} from './monia/relationship-chronology';
import {buildAutonomousMediaPlan} from './monia/media-orchestrator';
import {buildMonIAGenerationJob} from './monia/generation-job';
import {getDominicPresence} from './monia/lucas-presence-engine';
import type {MonIADirectorResult,MonIADirectorRequest} from './monia/director';

type Check={name:string;ok:boolean;detail:string;group:string};
const checks:Check[]=[];
const add=(group:string,name:string,ok:boolean,detail:string)=>checks.push({group,name,ok,detail});
const abs=(day:number,h:number,m=0)=>day*1440+h*60+m;

function director(channel:'call'|'visio'|'scene',spoken='Pardon… ça va ?'):MonIADirectorResult{
  return {
    channel,actor:'Dominic',text:spoken,spokenText:spoken,emotion:'calm',
    scene:channel==='call'?null:{
      location:'Feria de Nîmes, près des arènes',
      framing:channel==='visio'?'caméra téléphone, plan poitrine naturel':'plan cinématographique naturel à hauteur humaine',
      lighting:'lumière de matinée cohérente avec 09:31',
      action:'Dominic aide Marion après un mouvement de foule et un téléphone tombé',
      duration:12,
    },
    memory:'',source:'fallback'
  };
}
const context={
  speaker:'Marion',place:'Feria de Nîmes · Arènes',time:'09:31',day:1,
  recentAction:'Marion marche avec Marine dans la foule',
  activeObjective:'Continuer la Feria avec Marine',
  relationship:'Ils ne se connaissent pas encore',
  memories:['Marion a retrouvé Marine et marche avec elle.'],
  recentEvents:['Sortie de l’appartement','Marche dans Nîmes'],
  rules:['Première rencontre absolue','Aucune présence de couple','Aucun spoiler']
};

const pre={metDominic:false,flags:{}};
const met={metDominic:true,flags:{}};
const messaged={metDominic:true,flags:{firstMessage:true}};
add('Chronologie téléphone','Avant rencontre : Dominic inconnu',!hasMetDominic(pre),'metDominic=false reste l’autorité unique.');
add('Chronologie téléphone','Pas de premier message avant rencontre',!hasFirstDominicMessage(pre),'Le premier message exige la rencontre.');
add('Chronologie téléphone','Pas d’autonomie téléphone juste après rencontre',!canDominicUsePhoneAutonomously(met),'Rencontre seule ≠ appels/messages autonomes.');
add('Chronologie téléphone','Autonomie après premier message',canDominicUsePhoneAutonomously(messaged),'Après firstMessage=true, le téléphone peut devenir autonome.');

const afterMarine={day:1,place:'nimes',metDominic:false,flags:{firstContactTarget:700,firstContactEarliest:abs(1,13,5)}};
add('Jour 1','Respiration après Marine : trop tôt refusé',!shouldTriggerDay1FirstContact(afterMarine,12*60+50),'12:50 est avant l’heure minimale 13:05.');
add('Jour 1','Respiration après Marine : seuil accepté',shouldTriggerDay1FirstContact(afterMarine,13*60+5),'13:05 atteint le vrai seuil absolu.');
const targetWins={day:1,place:'arenes',metDominic:false,flags:{firstContactTarget:1000,firstContactEarliest:abs(1,14,0)}};
add('Jour 1','Fenêtre cachée reste prioritaire si plus tardive',day1FirstContactThresholdAbs(targetWins)===abs(1,16,40),'Le seuil est max(fenêtre cachée, respiration).');
add('Jour 1','Pas de rencontre avant la fenêtre cachée',!shouldTriggerDay1FirstContact(targetWins,16*60+39),'16:39 reste trop tôt.');
add('Jour 1','Rencontre possible à la fenêtre cachée',shouldTriggerDay1FirstContact(targetWins,16*60+40),'16:40 devient éligible.');
const homeLate={day:1,place:'home',metDominic:false,flags:{feriaPullDone:false,firstContactTarget:1190}};
add('Jour 1','Rester chez soi : pas de sortie forcée trop tôt',!shouldTriggerDay1FeriaPull(homeLate,1109),'18:29 : le jeu laisse encore respirer.');
add('Jour 1','Rester chez soi : Feria relance à 18:30',shouldTriggerDay1FeriaPull(homeLate,1110),'18:30 : la journée ne peut plus mourir dans l’appartement.');
const pulled={...homeLate,flags:{...homeLate.flags,feriaPullDone:true}};
add('Jour 1','Feria pull non répétable',!shouldTriggerDay1FeriaPull(pulled,1230),'Une seule relance naturelle.');
add('Jour 1','Sortie forcée ajoute 35 min minimum',nextFeriaPullEarliestAbs(homeLate,abs(1,18,30))===abs(1,19,5),'Pas de rencontre collée immédiatement à la sortie.');

const call=director('call');
const callPlan=buildAutonomousMediaPlan(call,context);
add('MonIA médias','Appel audio reste audio',callPlan.mode==='audio-call','mode=audio-call');
add('MonIA médias','Appel audio ne génère aucune image/vidéo',callPlan.visual.required===false&&!callPlan.visual.trueVideoRequired,'visual.required=false');
add('MonIA médias','Appel audio garde la voix',callPlan.voice.required===true&&callPlan.voice.liveTurnTaking===true&&!callPlan.voice.lipSyncRequired,'Voix live, zéro lipsync vidéo.');

const visio=director('visio');
const visioPlan=buildAutonomousMediaPlan(visio,context);
add('MonIA médias','Visio reste visio',visioPlan.mode==='live-visio'&&visioPlan.visual.required,'Caméra frontale nécessaire seulement ici.');

const scene=director('scene');
const scenePlan=buildAutonomousMediaPlan(scene,context);
add('MonIA rencontre','Rencontre = cinématique physique',scenePlan.mode==='cinematic-drama'&&scenePlan.visual.required,'Jamais convertie en visio.');
add('MonIA rencontre','Lumière liée à l’heure du jeu',scenePlan.visual.lighting.toLowerCase().includes('09:31')||scenePlan.visual.lighting.toLowerCase().includes('matin'),'La scène doit rester cohérente avec la matinée.');

const request:MonIADirectorRequest={actor:'Dominic',requestedChannel:'scene',playerText:'Première rencontre physique',context};
const job=buildMonIAGenerationJob(scene,scenePlan,request);
add('MonIA génération','Job vidéo identifié comme cinématique',job.medium==='cinematic','medium=cinematic');
add('MonIA génération','Identité Dominic liée à la banque canon',job.actors.some(a=>a.id==='Dominic'&&a.identityRef==='config/lucas-reference-bank.json'),'Référence identité canonique active.');
add('MonIA génération','Voix V16 exigée si Dominic parle',job.validation.requireV16WhenLucasSpeaks&&job.shots.some(s=>s.dialogue?.some(d=>d.actor==='Dominic'&&d.voice==='lucas-v16-direct-design')),'Dialogue exact + V16.');
add('MonIA génération','Caméra de rencontre non-visio',job.shots.every(s=>!s.camera.toLowerCase().includes('smartphone front camera')),'Caméra externe cinématographique.');

const SAVE='marion-lucas-save-v4';
const previous=localStorage.getItem(SAVE);
try{
  localStorage.setItem(SAVE,JSON.stringify({day:1,time:'09:31',place:'arenes',metDominic:false,official:false,calendar:[],flags:{}}));
  const p0=getDominicPresence();
  add('Présence physique','Avant rencontre : Dominic ne peut pas être physiquement avec Marion',p0?.together===false&&p0?.reachableByPhone===false,'Présence physique et téléphone bloqués.');

  localStorage.setItem(SAVE,JSON.stringify({day:6,time:'14:00',place:'home',metDominic:true,official:true,calendar:[],flags:{}}));
  const p1=getDominicPresence();
  add('Présence physique','Être en couple ne téléporte pas Dominic',p1?.together===false,'official=true sans contexte explicite reste together=false.');

  localStorage.setItem(SAVE,JSON.stringify({day:6,time:'14:00',place:'home',metDominic:true,official:true,calendar:[],flags:{lucasCurrentPlace:'home',lucasWithMarion:true}}));
  const p2=getDominicPresence();
  add('Présence physique','Présence explicite autorise les actions à deux',p2?.together===true,'Seulement un vrai contexte de coprésence active les scènes locales.');
}finally{
  if(previous==null)localStorage.removeItem(SAVE);else localStorage.setItem(SAVE,previous);
}

const timeline=[
 ['09:00','Appartement','Marine écrit ; Marion garde la main.'],
 ['09:06','Sortie','Le temps avance selon l’action choisie.'],
 ['09:13','Rue de la Madeleine','Direction claire : Marine / esplanade / marche seule.'],
 ['09:22','Avec Marine','Marine reste présente dans le gameplay.'],
 ['09:28','Arènes','La Feria devient plus dense.'],
 ['09:32','Foule','La rencontre peut émerger sans bouton “rencontrer Dominic”.'],
 ['Après seuil caché','Première rencontre','Cinématique physique MonIA, jamais visio.'],
 ['≥ 90 min plus tard','Premier message','“Tu es bien rentrée ?” seulement après la rencontre.'],
];

const passed=checks.filter(c=>c.ok).length;
const failed=checks.length-passed;
const groups=[...new Set(checks.map(c=>c.group))];
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`
<main class="wrap">
  <header><span>SIMULATION ULTRA-COMPLÈTE · JOUR 1</span><h1>${failed===0?'Tout passe':'Des points restent à corriger'}</h1><p>${passed}/${checks.length} contrôles réussis · ${failed} échec(s)</p></header>
  <section class="score ${failed?'bad':'good'}"><strong>${passed}/${checks.length}</strong><span>contrôles</span></section>
  <section class="timeline"><h2>Parcours simulé</h2>${timeline.map(([t,l,d])=>`<article><time>${t}</time><div><strong>${l}</strong><p>${d}</p></div></article>`).join('')}</section>
  ${groups.map(g=>`<section class="group"><h2>${g}</h2>${checks.filter(c=>c.group===g).map(c=>`<article class="${c.ok?'pass':'fail'}"><b>${c.ok?'PASS':'FAIL'}</b><div><strong>${c.name}</strong><p>${c.detail}</p></div></article>`).join('')}</section>`).join('')}
</main>
<style>
.wrap{max-width:980px;margin:auto;padding:28px 0 60px}header{padding:12px 4px 24px}header span{font-size:11px;letter-spacing:.18em;opacity:.62}h1{font:500 38px/1.1 Georgia,serif;margin:8px 0}header p{opacity:.72}.score{display:flex;align-items:baseline;gap:10px;padding:18px 20px;border-radius:20px;margin-bottom:22px}.score.good{background:#183224}.score.bad{background:#4a2020}.score strong{font-size:32px}.score span{opacity:.7}.group,.timeline{background:#191714;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:18px;margin:14px 0}.group h2,.timeline h2{font-size:14px;letter-spacing:.08em;text-transform:uppercase;opacity:.72;margin:0 0 12px}.group article,.timeline article{display:grid;grid-template-columns:76px 1fr;gap:12px;padding:12px 0;border-top:1px solid rgba(255,255,255,.07)}.group article:first-of-type,.timeline article:first-of-type{border-top:0}.group b{font-size:11px;letter-spacing:.1em;padding-top:2px}.pass b{color:#7ce3a2}.fail b{color:#ff8d8d}.group strong,.timeline strong{display:block}.group p,.timeline p{margin:4px 0 0;opacity:.66;line-height:1.4;font-size:14px}.timeline time{font-size:12px;opacity:.62;padding-top:2px}@media(max-width:620px){body{padding:12px}.wrap{padding-top:10px}h1{font-size:30px}.group article,.timeline article{grid-template-columns:64px 1fr}}
</style>
`;
