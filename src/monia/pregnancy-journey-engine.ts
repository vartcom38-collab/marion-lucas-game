import { getPregnancyState } from './pregnancy-state';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;place?:string;children?:number;flags?:Record<string,unknown>;calendar?:Array<{owner?:string;title?:string;day?:number;note?:string}>};
export type PregnancyStage='none'|'trying'|'possible'|'confirmed'|'first-trimester'|'second-trimester'|'third-trimester'|'labor'|'postpartum'|'loss';
export type PregnancyStep={id:string;label:string;available:boolean;done:boolean;sensitive?:boolean;surprise?:boolean};
export type PregnancyJourney={stage:PregnancyStage;gestationDay:number|null;steps:PregnancyStep[];birthWindow:boolean;birthContext:string;nextSuggested?:string};

function readSave():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function flag(s:Save,key:string){return s.flags?.[key]}
function yes(s:Save,key:string){return !!flag(s,key)}

export function getPregnancyJourney():PregnancyJourney|null{
  const s=readSave();if(!s)return null;
  const canonical=getPregnancyState(s);const timelineStart=canonical?.startDay||canonical?.confirmedDay||null;
  const day=Math.max(1,n(s.day,1));
  const g=timelineStart?Math.max(0,day-timelineStart):null;let stage:PregnancyStage='none';
  if(canonical?.state==='loss')stage='loss';
  else if(canonical?.state==='postpartum')stage='postpartum';
  else if(yes(s,'inLabor')&&canonical?.state==='confirmed')stage='labor';
  else if(canonical?.state==='confirmed')stage=g!==null&&g<84?'first-trimester':g!==null&&g<189?'second-trimester':'third-trimester';
  else if(canonical?.state==='possible')stage='possible';
  else if(canonical?.state==='trying')stage='trying';

  const possibleDay=canonical?.possibleDay||0;
  const testEarliest=Math.max(possibleDay?possibleDay+10:0,n(flag(s,'pregnancyTestEarliestDay'),0));
  const signsEarliest=possibleDay?possibleDay+7:0;
  const d=(id:string,label:string,available:boolean,sensitive=false,surprise=false):PregnancyStep=>({id,label,available,done:yes(s,`preg_${id}_done`)||yes(s,`preg_${id}`),sensitive,surprise});
  const confirmed=stage==='first-trimester'||stage==='second-trimester'||stage==='third-trimester'||stage==='labor'||stage==='postpartum';
  const steps:PregnancyStep[]=[
    d('notice-signs','Remarquer un retard ou des signes possibles',stage==='possible'&&!!signsEarliest&&day>=signsEarliest,false,true),
    d('test','Faire un test de grossesse',stage==='possible'&&!!testEarliest&&day>=testEarliest),
    d('tell-lucas','Décider quand et comment l’annoncer à Lucas',confirmed,false,true),
    d('care-choice','Choisir le suivi médical / la maternité',confirmed),
    d('first-visit','Premier rendez-vous médical',confirmed),
    d('first-ultrasound','Première échographie',confirmed),
    d('screening','Examens et suivi du premier trimestre',stage==='first-trimester'),
    d('second-ultrasound','Échographie morphologique',stage==='second-trimester'),
    d('sex-reveal','Décider de connaître ou non le sexe du bébé',stage==='second-trimester',false,true),
    d('baby-name','Réfléchir aux prénoms',stage==='second-trimester'||stage==='third-trimester'),
    d('nursery','Préparer l’arrivée du bébé',stage==='second-trimester'||stage==='third-trimester'),
    d('birth-plan','Préparer le projet de naissance',stage==='third-trimester'),
    d('late-checks','Rendez-vous et contrôles de fin de grossesse',stage==='third-trimester'),
    d('labor-start','Début du travail',stage==='third-trimester'||stage==='labor',false,true),
    d('birth','Accouchement',stage==='labor',true,true),
    d('first-hours','Premières heures avec le bébé',stage==='postpartum',false,true),
    d('homecoming','Retour à la maison',stage==='postpartum'),
    d('new-rhythm','Nouvelle vie de famille',stage==='postpartum'),
    d('loss-care','Prise en charge et récupération après une perte',stage==='loss',true)
  ];
  const birthWindow=stage==='third-trimester'&&(g!==null&&g>=245);
  const place=String(s.place||'home');
  const birthContext=place==='arenes'?'Une naissance peut démarrer pendant une journée aux arènes, mais le scénario doit prioriser la sécurité et le transfert vers les soins si possible.':place==='madrid'||place==='nimes'?'Le lieu actuel influence l’hôpital, l’entourage disponible et la logistique.':'Le directeur doit tenir compte du lieu réel, des trajets et des professionnels disponibles.';
  return{stage,gestationDay:g,steps,birthWindow,birthContext,nextSuggested:steps.find(x=>x.available&&!x.done)?.id};
}

declare global{interface Window{__moniaPregnancyJourney?:()=>PregnancyJourney|null}}
window.__moniaPregnancyJourney=getPregnancyJourney;
