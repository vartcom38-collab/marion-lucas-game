import type { ValidatedDramaPackId } from './validated-drama-packs';

export type DramaAtlasCrop = { x:number; y:number; width:number; height:number };
export type DramaAtlasCell = {
  id:string;
  label:string;
  packId:ValidatedDramaPackId;
  src:string;
  actors:('Marion'|'Lucas')[];
  mood:string;
  interaction?:string;
  crop:DramaAtlasCrop;
};

function gridCrop(columns:number, rows:number, index:number, top:number, bottom:number, side:number, gap:number):DramaAtlasCrop {
  const row=Math.floor(index/columns);
  const col=index%columns;
  const usableW=1-side*2-gap*(columns-1);
  const usableH=1-top-bottom-gap*(rows-1);
  const w=usableW/columns;
  const h=usableH/rows;
  return {x:side+col*(w+gap),y:top+row*(h+gap),width:w,height:h};
}

const lucasLabels=[
  ['neutral','Neutre'],['intense','Intense'],['quiet','Pensif'],['worried','Inquiet'],
  ['tender','Tendre'],['playful','Amusé'],['intense','Séducteur'],['hurt','Blessé'],
  ['angry','Colère contenue'],['quiet','Fatigué'],['neutral','Profil'],['intense','Concentré'],
] as const;

const marionLabels=[
  ['neutral','Neutre'],['playful','Sourire doux'],['playful','Sourire chaleureux'],['neutral','Attentive'],
  ['tender','Tendre'],['worried','Inquiète'],['quiet','Pensive'],['playful','Amusée'],
  ['intense','Déterminée'],['hurt','Triste / blessée'],['neutral','Profil gauche'],['neutral','3/4 droit'],
] as const;

const duoILabels=[
  ['neutral','Face à face','conversation'],['tender','Conversation douce','conversation'],['playful','Sourires partagés','complicity'],
  ['neutral','Écoute attentive','conversation'],['intense','Tension légère','tension'],['worried','Réconfort','comfort'],
  ['intense','Regard sérieux','tension'],['tender','Tendresse silencieuse','tenderness'],['tender','Fronts proches','tenderness'],
  ['playful','Complicité','complicity'],['neutral','Côte à côte','conversation'],['tender','Presque un baiser','near-kiss'],
] as const;

const duoIILabels=[
  ['intense','Tension silencieuse','tension'],['tender','Proximité romantique','near-kiss'],['tender','Regard doux','romantic'],
  ['hurt','Front contre front','comfort'],['tender','Étreinte protectrice','embrace'],['intense','Conversation intime','conversation'],
  ['intense','Proximité intense','romantic'],['intense','Face à face intense','tension'],['tender','Main sur le visage','romantic'],
  ['hurt','Réconfort silencieux','comfort'],['tender','Toucher tendre','tenderness'],['tender','Étreinte intime','embrace'],
] as const;

export const CANON_DRAMA_ATLAS_CELLS:DramaAtlasCell[]=[
  ...lucasLabels.map((row,index)=>({id:`lucas-${index+1}`,label:row[1],packId:'lucas-solo' as const,src:'/resources/monia/atlas-lucas.jpg',actors:['Lucas'] as ['Lucas'],mood:row[0],crop:gridCrop(4,3,index,.13,.025,.012,.008)})),
  ...marionLabels.map((row,index)=>({id:`marion-${index+1}`,label:row[1],packId:'marion-solo' as const,src:'/resources/monia/atlas-marion.jpg',actors:['Marion'] as ['Marion'],mood:row[0],crop:gridCrop(4,3,index,.13,.025,.012,.008)})),
  ...duoILabels.map((row,index)=>({id:`duo-i-${index+1}`,label:row[1],packId:'duo-i' as const,src:'/resources/monia/atlas-duo-i.jpg',actors:['Marion','Lucas'] as ['Marion','Lucas'],mood:row[0],interaction:row[2],crop:gridCrop(3,4,index,.12,.025,.015,.008)})),
  ...duoIILabels.map((row,index)=>({id:`duo-ii-${index+1}`,label:row[1],packId:'duo-ii' as const,src:'/resources/monia/atlas-duo-ii.jpg',actors:['Marion','Lucas'] as ['Marion','Lucas'],mood:row[0],interaction:row[2],crop:gridCrop(3,4,index,.115,.025,.006,.006)})),
];

export function atlasCellsForPack(packId:ValidatedDramaPackId){
  return CANON_DRAMA_ATLAS_CELLS.filter(cell=>cell.packId===packId);
}
