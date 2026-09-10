import { moniaCreativeVault, type MonIAAsset, type MonIAAssetKind } from './creative-vault';
import { moniaStorage, type MonIAMemory } from './storage';
import { MARION_LUCAS_PROFILE } from './profile';

export type MonIAContentNeed={
  kind:MonIAAssetKind|'text';
  actor?:string;
  role?:string;
  tags?:string[];
  day:number;
  time:string;
  place:string;
  intent:string;
};

export type MonIAContentDecision={
  mode:'reuse'|'generate';
  asset?:MonIAAsset;
  context:{canon:string[];memories:string[];rules:string[]};
  prompt:string;
};

function compactCanon(records:{subject:string;text:string;locked:boolean}[]){
  return records.slice(0,20).map(x=>`${x.locked?'LOCKED':'CANON'} · ${x.subject} · ${x.text}`);
}
function compactMemories(memories:MonIAMemory[]){return memories.slice(0,12).map(x=>`J${x.day} ${x.time} · ${x.text}`)}

export async function planMonIAContent(need:MonIAContentNeed):Promise<MonIAContentDecision>{
  const [canon,memories]=await Promise.all([
    moniaCreativeVault.canon().catch(()=>[]),
    moniaStorage.relevant({text:`${need.actor||''} ${need.place} ${need.intent}`,day:need.day,actors:need.actor?[need.actor]:undefined,limit:12}).catch(()=>[]),
  ]);
  const context={canon:compactCanon(canon),memories:compactMemories(memories),rules:[...MARION_LUCAS_PROFILE.rules]};

  if(need.kind!=='text'){
    const asset=await moniaCreativeVault.bestReusableAsset({kind:need.kind,actor:need.actor,role:need.role,tags:need.tags}).catch(()=>null);
    if(asset){
      await moniaCreativeVault.markUsed(asset.id).catch(()=>undefined);
      await moniaCreativeVault.recordGeneration({kind:need.kind==='voice'?'voice':need.kind==='video'?'video':'image',actor:need.actor,promptKey:need.intent,reusedAssetId:asset.id,resultUrl:asset.url,status:'reused'}).catch(()=>undefined);
      return {mode:'reuse',asset,context,prompt:`Réutiliser l’asset approuvé ${asset.id}. Aucune nouvelle génération nécessaire.`};
    }
  }

  const prompt=[
    'Tu es MonIA, moteur créatif du jeu Marion & Lucas.',
    'Règle absolue: préserver le canon, la continuité et les identités validées.',
    `BESOIN=${JSON.stringify(need)}`,
    `CANON=${JSON.stringify(context.canon)}`,
    `MEMOIRES=${JSON.stringify(context.memories)}`,
    `REGLES=${JSON.stringify(context.rules)}`,
    'Ne crée du nouveau contenu que si aucun asset approuvé suffisamment adapté n’existe.',
    'Toute sortie média nouvellement générée reste candidate jusqu’à validation explicite; jamais de publication directe dans le gameplay.'
  ].join('\n');
  return {mode:'generate',context,prompt};
}

export async function rememberGeneratedContent(input:{kind:'text'|'image'|'video'|'voice';actor?:string;promptKey:string;resultUrl?:string;resultText?:string;accepted?:boolean}){
  return moniaCreativeVault.recordGeneration({kind:input.kind,actor:input.actor,promptKey:input.promptKey,resultUrl:input.resultUrl,resultText:input.resultText,status:input.accepted?'generated':'generated'});
}
