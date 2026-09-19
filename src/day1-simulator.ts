import {day1FirstContactThresholdAbs,shouldTriggerDay1FirstContact,shouldTriggerDay1FeriaPull,nextFeriaPullEarliestAbs} from './day1-chronology';

export type Day1SimRoute='marine-direct'|'solo-city'|'stay-home';
export type Day1SimStep={time:string;place:string;action:string;direction:string;checks:string[]};
export type Day1Simulation={route:Day1SimRoute;seed:number;context:string;target:string;encounterAt:string;steps:Day1SimStep[];warnings:string[]};

const fmt=(m:number)=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const add=(steps:Day1SimStep[],minute:number,place:string,action:string,direction:string,checks:string[]=[])=>
  steps.push({time:fmt(minute),place,action,direction,checks});

export function firstContactWindow(seed:number){
  const windows=[
    {key:'arena-midday',start:700,span:70},
    {key:'feria-afternoon',start:1000,span:80},
    {key:'feria-evening',start:1190,span:100},
  ];
  const w=windows[seed%windows.length]!;
  return {context:w.key,target:w.start+(seed%w.span)};
}

export function simulateDay1(seed:number,route:Day1SimRoute):Day1Simulation{
  const {context,target}=firstContactWindow(seed);
  const steps:Day1SimStep[]=[];
  const warnings:string[]=[];
  let t=540;
  let place='home';
  let earliest=0;
  let feriaPullDone=false;

  add(steps,t,'Appartement','Début de partie','Marine existe dans le téléphone; la matinée reste jouable.',['Dominic absent','pas de téléphone Dominic']);
  if(route==='marine-direct'){
    t+=5;add(steps,t,'Appartement','Lire Marine','Répondre naturellement; choisir de la rejoindre.');
    t+=25;add(steps,t,'Appartement','Se préparer','La direction est claire sans lancer une quête.');
    t+=20;place='arenes';add(steps,t,'Arènes','Marcher jusqu’aux arènes','Marine devient la prochaine présence logique.');
    t+=58;add(steps,t,'Arènes','Vivre la scène avec Marine','Marine reste présente pendant une vraie séquence.');
    earliest=1*1440+t+85;
    add(steps,t,'Arènes','Fin du moment avec Marine','Le moteur interdit une rencontre immédiate.',[`rencontre pas avant ${fmt((earliest-1440)%1440)}`]);
  }else if(route==='solo-city'){
    t+=20;add(steps,t,'Appartement','Commencer tranquillement','Pas de pénalité pour ne pas ouvrir le téléphone.');
    t+=25;add(steps,t,'Appartement','Se préparer','Le jeu garde une sortie naturelle disponible.');
    t+=15;place='nimes';add(steps,t,'Centre de Nîmes','Sortir seule','Directions visibles: marcher, café, arènes.');
    t+=30;add(steps,t,'Centre de Nîmes','Marcher','La ville avance avec le temps, sans Dominic.');
    earliest=1*1440+t;
  }else{
    t+=30;add(steps,t,'Appartement','Se poser','Le jeu laisse du calme.');
    t+=25;add(steps,t,'Appartement','Lire','Toujours aucune apparition forcée de Dominic.');
    t+=35;add(steps,t,'Appartement','Ranger','Le temps avance réellement.');
    while(t<1110){
      t+=Math.min(35,1110-t);
      add(steps,t,'Appartement','Continuer sa matinée','Le monde laisse vivre la joueuse mais surveille la Feria.');
    }
    const state={day:1,place:'home',metDominic:false,flags:{feriaPullDone,firstContactTarget:target}};
    if(shouldTriggerDay1FeriaPull(state,t)){
      feriaPullDone=true;
      earliest=nextFeriaPullEarliestAbs(state,1*1440+t);
      add(steps,t,'Appartement','Relance Feria','Marine/la ville donnent une raison naturelle de sortir.',[`rencontre pas avant ${fmt((earliest-1440)%1440)}`]);
      t+=22;
      place='nimes';
      add(steps,t,'Centre de Nîmes','Sortir après la relance','Le Jour 1 ne peut pas mourir dans l’appartement.');
    }else warnings.push('La relance Feria ne s’est pas déclenchée alors qu’elle aurait dû.');
  }

  const state={day:1,place,metDominic:false,flags:{firstContactTarget:target,firstContactEarliest:earliest,feriaPullDone}};
  const threshold=day1FirstContactThresholdAbs(state)-1440;
  if(t<threshold){
    add(steps,t,place,'Continuer la journée','La rencontre reste cachée; le jeu propose encore des actions ordinaires.');
    t=threshold;
  }
  if(place==='home')place='nimes';
  const trigger=shouldTriggerDay1FirstContact({...state,place},t);
  add(steps,t,place,trigger?'Première rencontre disponible':'Rencontre encore verrouillée',trigger?'La scène physique peut maintenant arriver naturellement.':'Le moteur attend encore.',[
    'pas de visio','pas d’appel','pas de statut couple','cinématique physique seulement'
  ]);
  if(!trigger)warnings.push('La rencontre n’est pas éligible au seuil calculé.');

  const encounterAt=t;
  t+=34;
  add(steps,t,place,'Fin de la rencontre','Numéros échangés; Dominic est maintenant rencontré, mais son téléphone autonome reste verrouillé.',['metDominic=true','firstMessage=false']);
  const firstMessageEarliest=Math.max(route==='stay-home'?480:1140,encounterAt+90);
  if(firstMessageEarliest<1440){
    t=Math.max(t,firstMessageEarliest);
    add(steps,t,place,'Premier message possible','Texte canon: “Tu es bien rentrée ?” seulement après le délai.',['firstMessage=true après résolution']);
  }else{
    add(steps,1439,place,'Fin du Jour 1','Le premier message glissera au Jour 2 matin si nécessaire.');
  }

  return {route,seed,context,target:fmt(target),encounterAt:fmt(encounterAt),steps,warnings};
}

export function simulateDay1Matrix(){
  return [
    simulateDay1(3,'marine-direct'),
    simulateDay1(4,'solo-city'),
    simulateDay1(5,'stay-home'),
  ];
}
