import { getChildrenLife } from './children-life';
import { ensureChildBonds } from './child-bond-life';
import { getTrustedNannySnapshot } from './trusted-nanny-life';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;place?:string;flags?:Record<string,unknown>;eventHistory?:string[]};
export type FamilyMemoryEcho={childId:string;source:'bond'|'nanny';day:number;kind:string;text:string;ageAtMomentYears:number;currentAgeYears:number;};
function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function label(id:string){const kid=getChildrenLife().find(k=>k.id===id);return kid?.name?.trim()||'cet enfant'}

export function getFamilyMemoryEcho():FamilyMemoryEcho|null{
  const s=read();if(!s)return null;const day=Math.max(1,n(s.day,1)),kids=getChildrenLife();if(!kids.length)return null;const f=s.flags||{};const last=n(f.familyMemoryEchoDay,0);if(last&&day-last<30)return null;
  const candidates:FamilyMemoryEcho[]=[];
  for(const bond of ensureChildBonds()){
    const kid=kids.find(k=>k.id===bond.childId);if(!kid)continue;
    for(const m of bond.recentMoments){const ageAt=Math.max(0,(m.day-kid.birthDay)/365);if(day-m.day<120)continue;const name=label(kid.id);const text=m.kind==='school'?`Un détail te rappelle une ancienne période d’école de ${name}.`:m.kind==='travel'?`Ce lieu ou ce trajet te fait repenser à un ancien voyage vécu avec ${name}.`:m.kind==='celebration'?`Un petit détail te rappelle une ancienne célébration avec ${name}.`:m.kind==='play'?`Quelque chose ici te rappelle une époque où jouer avec ${name} remplissait une partie de la journée.`:m.kind==='support'?`Tu repenses brièvement à un moment où ${name} avait particulièrement besoin de vous.`:`Un petit souvenir de ${name} revient sans prévenir.`;candidates.push({childId:kid.id,source:'bond',day:m.day,kind:m.kind,text,ageAtMomentYears:ageAt,currentAgeYears:kid.ageYears})}
  }
  const nanny=getTrustedNannySnapshot();for(const u of nanny?.updates||[]){const kid=kids.find(k=>k.id===u.childId);if(!kid||day-u.day<120)continue;if(u.kind!=='drawing'&&u.kind!=='photo')continue;const text=u.kind==='drawing'?`Tu retombes sur le souvenir d’un dessin que ${label(kid.id)} vous avait envoyé pendant un déplacement.`:`Une ancienne photo envoyée par la nounou te revient en tête.`;candidates.push({childId:kid.id,source:'nanny',day:u.day,kind:u.kind,text,ageAtMomentYears:Math.max(0,(u.day-kid.birthDay)/365),currentAgeYears:kid.ageYears})}
  if(!candidates.length)return null;const pick=candidates[(day*13+candidates.length*7)%candidates.length];if(pick.currentAgeYears-pick.ageAtMomentYears<.3)return null;return pick
}

export function consumeFamilyMemoryEcho(){const echo=getFamilyMemoryEcho();if(!echo)return null;const s=read();if(!s)return echo;const f=s.flags||(s.flags={});f.familyMemoryEchoDay=Math.max(1,n(s.day,1));s.eventHistory=[...(s.eventHistory||[]),`family-memory-echo:${echo.childId}:${echo.kind}:${f.familyMemoryEchoDay}`].slice(-520);localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:family-memory-echo',{detail:echo}));return echo}

declare global{interface Window{__moniaFamilyMemoryEcho?:()=>FamilyMemoryEcho|null;__moniaConsumeFamilyMemoryEcho?:()=>FamilyMemoryEcho|null}}
window.__moniaFamilyMemoryEcho=getFamilyMemoryEcho;window.__moniaConsumeFamilyMemoryEcho=consumeFamilyMemoryEcho;
