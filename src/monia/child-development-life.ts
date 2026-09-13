import './child-bond-life';
import './trusted-nanny-life';
import './family-visio-director';
import { getChildrenLife, type ChildLifeSnapshot } from './children-life';

export type ChildDevelopmentPhase='early-care'|'preschool-rhythm'|'school-rhythm'|'preteen-autonomy'|'teen-autonomy'|'adult-independent';
export type ChildDevelopmentCue={childId:string;stage:ChildLifeSnapshot['stage'];phase:ChildDevelopmentPhase;structureWeight:number;travelFriction:number;outingFriction:number;autonomy:number;activityTone:'home'|'play'|'learning'|'friends'|'independent';reason:string};
export type FamilyDevelopmentSnapshot={children:ChildDevelopmentCue[];structuredWeekWeight:number;travelFriction:number;outingFriction:number;autonomyRelief:number;reason:string};

function cueFor(child:ChildLifeSnapshot):ChildDevelopmentCue{
  if(child.stage==='newborn'||child.stage==='baby')return{childId:child.id,stage:child.stage,phase:'early-care',structureWeight:76,travelFriction:78,outingFriction:62,autonomy:0,activityTone:'home',reason:'Un tout-petit demande surtout présence, sommeil et logistique quotidienne.'};
  if(child.stage==='toddler')return{childId:child.id,stage:child.stage,phase:'preschool-rhythm',structureWeight:64,travelFriction:58,outingFriction:46,autonomy:8,activityTone:'play',reason:'Le rythme devient plus régulier, avec des temps de jeu et des habitudes qui structurent la semaine.'};
  if(child.stage==='child')return{childId:child.id,stage:child.stage,phase:'school-rhythm',structureWeight:82,travelFriction:54,outingFriction:24,autonomy:24,activityTone:'learning',reason:'La vie scolaire et les activités donnent davantage de structure aux semaines sans empêcher une vie familiale riche.'};
  if(child.stage==='preteen')return{childId:child.id,stage:child.stage,phase:'preteen-autonomy',structureWeight:76,travelFriction:42,outingFriction:16,autonomy:44,activityTone:'friends',reason:'Les repères scolaires restent forts, mais l’enfant gagne en autonomie et en vie sociale.'};
  if(child.stage==='teen')return{childId:child.id,stage:child.stage,phase:'teen-autonomy',structureWeight:60,travelFriction:30,outingFriction:8,autonomy:70,activityTone:'friends',reason:'L’adolescence crée davantage d’autonomie, d’activités propres et de choix séparés du rythme des parents.'};
  return{childId:child.id,stage:child.stage,phase:'adult-independent',structureWeight:12,travelFriction:4,outingFriction:0,autonomy:100,activityTone:'independent',reason:'L’enfant devenu adulte appartient toujours à la famille sans organiser le quotidien parental.'};
}

export function getFamilyDevelopmentSnapshot():FamilyDevelopmentSnapshot{
  const children=getChildrenLife();
  if(!children.length)return{children:[],structuredWeekWeight:0,travelFriction:0,outingFriction:0,autonomyRelief:100,reason:'Aucun enfant ne structure encore le rythme familial.'};
  const cues=children.map(cueFor);
  const structuredWeekWeight=Math.max(...cues.map(c=>c.structureWeight));
  const travelFriction=Math.max(...cues.map(c=>c.travelFriction));
  const outingFriction=Math.max(...cues.map(c=>c.outingFriction));
  const autonomyRelief=Math.round(cues.reduce((sum,c)=>sum+c.autonomy,0)/cues.length);
  const youngest=children.slice().sort((a,b)=>a.ageDays-b.ageDays)[0];
  const reason=youngest.stage==='newborn'||youngest.stage==='baby'?'Le plus jeune enfant maintient encore un rythme familial très centré sur les besoins immédiats.':youngest.stage==='toddler'?'Les habitudes du plus jeune structurent encore nettement les journées.':cues.some(c=>c.phase==='school-rhythm'||c.phase==='preteen-autonomy')?'La vie familiale s’organise maintenant davantage autour des semaines structurées, des activités et des retours à la maison.':cues.some(c=>c.phase==='teen-autonomy')?'Les adolescents ont davantage de vie propre : la famille reste coordonnée sans fonctionner comme un bloc unique.':'Les enfants ont gagné assez d’autonomie pour que le couple retrouve une grande souplesse de rythme.';
  return{children:cues,structuredWeekWeight,travelFriction,outingFriction,autonomyRelief,reason};
}

declare global{interface Window{__moniaFamilyDevelopment?:()=>FamilyDevelopmentSnapshot}}
window.__moniaFamilyDevelopment=getFamilyDevelopmentSnapshot;
