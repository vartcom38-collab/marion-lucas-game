const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;engaged?:boolean;married?:boolean;relationship?:number;trust?:number;flags?:Record<string,unknown>;calendar?:Array<{owner?:string;title?:string;day?:number;note?:string}>};
export type WeddingStepStatus='locked'|'available'|'chosen'|'done';
export type WeddingStep={id:string;label:string;status:WeddingStepStatus;choices?:string[];dependsOn?:string[];surprise?:boolean};
export type WeddingJourney={active:boolean;phase:string;steps:WeddingStep[];nextSuggested?:string;progress:number};

function readSave():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function flag(s:Save,key:string){return s.flags?.[key]}
function done(s:Save,key:string){return !!flag(s,`wedding_${key}_done`)||!!flag(s,`wedding_${key}`)}
function status(s:Save,id:string,dependsOn:string[]=[]):WeddingStepStatus{
  if(done(s,id))return'done';
  if(dependsOn.some(d=>!done(s,d)))return'locked';
  if(flag(s,`wedding_${id}_choice`))return'chosen';
  return'available';
}

export function getWeddingJourney():WeddingJourney|null{
  const s=readSave();if(!s)return null;
  const active=!!s.engaged&&!s.married;
  const defs:Array<[string,string,string[],string[]?,boolean?]>=[
    ['vision','Définir l’ambiance du mariage',[],['intime','élégant','traditionnel','champêtre','urbain','mixte']],
    ['budget','Fixer une enveloppe et les priorités',['vision']],
    ['date','Choisir une période ou une date',['vision','budget']],
    ['country','Choisir le pays / la région',['vision','date'],['France','Espagne','Entre les deux']],
    ['venue','Choisir le lieu',['country','date']],
    ['guestlist','Construire la liste des invités',['venue']],
    ['invitations','Créer et envoyer les invitations',['guestlist']],
    ['ceremony','Choisir le type de cérémonie',['venue']],
    ['dress-search','Commencer les essayages de robe',['vision','date']],
    ['dress','Choisir la robe',['dress-search']],
    ['lucas-look','Préparer la tenue de Lucas',['vision']],
    ['palette','Choisir les couleurs',['vision']],
    ['flowers','Choisir les fleurs',['palette','venue']],
    ['decor','Imaginer la décoration',['palette','venue']],
    ['meal','Choisir repas et boissons',['venue']],
    ['cake','Choisir le gâteau',['meal']],
    ['music','Choisir musique / groupe / DJ',['venue']],
    ['photos','Choisir photo et vidéo',['venue']],
    ['transport','Organiser les déplacements',['venue']],
    ['seating','Préparer le plan de table',['guestlist']],
    ['rings','Choisir les alliances',['date']],
    ['vows','Préparer les vœux',['ceremony'],undefined,true],
    ['beauty','Coiffure, maquillage et préparation',['dress','date']],
    ['rehearsal','Répétition / derniers réglages',['ceremony','seating','transport']],
    ['eve','Veille du mariage',['rehearsal'],undefined,true],
    ['wedding-day','Jour du mariage',['dress','rings','ceremony','rehearsal'],undefined,true],
    ['after','Retour, souvenirs et lendemain',['wedding-day'],undefined,true]
  ];
  const steps=defs.map(([id,label,deps,choices,surprise])=>({id,label,status:active?status(s,id,deps):'locked' as WeddingStepStatus,choices,dependsOn:deps,surprise}));
  const finished=steps.filter(x=>x.status==='done').length;
  const next=steps.find(x=>x.status==='available'||x.status==='chosen');
  const phase=!active?(s.married?'terminé':'inactif'):finished<5?'fondations':finished<14?'préparation':finished<22?'finalisation':'jour-j';
  return{active,phase,steps,nextSuggested:next?.id,progress:Math.round(finished/steps.length*100)};
}

declare global{interface Window{__moniaWeddingJourney?:()=>WeddingJourney|null}}
window.__moniaWeddingJourney=getWeddingJourney;
