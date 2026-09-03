import type { MonIACompactContext } from './profile';
import type { MonIADirectorResult, MonIAChannel, MonIAEmotion } from './director';

export type MonIAExperienceMode = 'message'|'voice-note'|'live-visio'|'cinematic-drama';
export type MonIAFraming = 'close'|'chest'|'waist'|'full-body'|'two-shot'|'adaptive';
export type MonIAVideoQuality = 'preview'|'production';

export type MonIAMediaPlan = {
  mode: MonIAExperienceMode;
  actor: string;
  channel: MonIAChannel;
  autonomous: true;
  surpriseSafe: true;
  visual: {
    required: boolean;
    trueVideoRequired: boolean;
    sourceStrategy: 'none'|'reuse-canon-asset'|'generate-clean-source';
    framing: MonIAFraming;
    location: string;
    wardrobe: string;
    lighting: string;
    action: string;
    emotion: MonIAEmotion;
    durationTarget: number;
    quality: MonIAVideoQuality;
    allowTextInFrame: false;
    allowStoryboardAsFinal: false;
    identityLock: 'strict';
  };
  voice: {
    required: boolean;
    text: string;
    liveTurnTaking: boolean;
    lipSyncRequired: boolean;
    emotion: MonIAEmotion;
  };
  assembly: {
    multiShot: boolean;
    targetSceneDuration: number;
    clipDurationRange: [number,number];
    reuseValidatedClips: boolean;
    generateMissingClips: boolean;
  };
  cache: {
    serverOnly: true;
    reusable: boolean;
    tags: string[];
  };
  rationale: string[];
};

function hasAny(text:string, words:string[]){
  const value=text.toLowerCase();
  return words.some(word=>value.includes(word));
}

function contextText(c:MonIACompactContext){
  return [c.place,c.recentAction,c.activeObjective,...c.memories,...c.recentEvents].join(' · ');
}

function inferMode(result:MonIADirectorResult):MonIAExperienceMode{
  if(result.channel==='visio'||result.channel==='call')return 'live-visio';
  if(result.channel==='scene'||result.channel==='video')return 'cinematic-drama';
  if(result.channel==='voice')return 'voice-note';
  return 'message';
}

function inferFraming(mode:MonIAExperienceMode,result:MonIADirectorResult,c:MonIACompactContext):MonIAFraming{
  const text=`${result.scene?.framing||''} ${result.scene?.action||''} ${contextText(c)}`.toLowerCase();
  if(hasAny(text,['plein pied','full body','debout','marche','sort des arènes','sort des arenes']))return 'full-body';
  if(hasAny(text,['plan taille','waist','défait','defait','costume','veste','chemise']))return 'waist';
  if(mode==='live-visio')return 'chest';
  if(hasAny(text,['deux','ensemble','face à face','face a face']))return 'two-shot';
  if(hasAny(text,['gros plan','close','visage','regard']))return 'close';
  return 'adaptive';
}

function inferWardrobe(c:MonIACompactContext){
  const text=contextText(c).toLowerCase();
  if(hasAny(text,['après une corrida','apres une corrida','sort des arènes','sort des arenes','fin de corrida','chambre d’hôtel après','chambre d\'hôtel après'])){
    return 'Conserver strictement la continuité de sortie de corrida décrite par le contexte; si le contexte confirme qu’il vient juste de rentrer, une partie de la tenue de torero peut encore être portée ou en cours d’être retirée. Ne jamais inventer ce détail si le contexte temporel ne le permet pas.';
  }
  if(hasAny(text,['hôtel','hotel']))return 'Tenue réaliste cohérente avec le moment déjà établi à l’hôtel; conserver la continuité des vêtements connus, sinon choisir une tenue quotidienne sobre sans élément narratif nouveau.';
  if(hasAny(text,['arènes','arenes','corrida']))return 'Tenue cohérente avec l’activité taurine explicitement en cours, sans ajouter de blessure, trophée ou résultat absent du contexte.';
  return 'Conserver la dernière tenue connue. Si aucune tenue n’est connue, choisir une tenue quotidienne crédible et neutre sans créer de fait narratif.';
}

function targetDuration(mode:MonIAExperienceMode,result:MonIADirectorResult){
  if(mode==='live-visio')return Math.max(20,Math.min(180,result.scene?.duration||45));
  if(mode==='cinematic-drama')return Math.max(15,Math.min(75,result.scene?.duration||30));
  if(mode==='voice-note')return 0;
  return 0;
}

export function buildAutonomousMediaPlan(result:MonIADirectorResult,context:MonIACompactContext):MonIAMediaPlan{
  const mode=inferMode(result);
  const visualRequired=mode==='live-visio'||mode==='cinematic-drama';
  const voiceRequired=mode==='voice-note'||mode==='live-visio'||mode==='cinematic-drama';
  const duration=targetDuration(mode,result);
  const framing=inferFraming(mode,result,context);
  const multiShot=mode==='cinematic-drama' && duration>8;
  const sourceStrategy=visualRequired?'generate-clean-source':'none';
  const tags=[result.actor,result.emotion,mode,context.place,framing].filter(Boolean).map(String);
  return {
    mode,
    actor:result.actor,
    channel:result.channel,
    autonomous:true,
    surpriseSafe:true,
    visual:{
      required:visualRequired,
      trueVideoRequired:visualRequired,
      sourceStrategy,
      framing,
      location:result.scene?.location||context.place,
      wardrobe:inferWardrobe(context),
      lighting:result.scene?.lighting||`Lumière réaliste cohérente avec ${context.time} et ${context.place}`,
      action:result.scene?.action||`${result.actor} réagit naturellement dans le contexte présent`,
      emotion:result.emotion,
      durationTarget:duration,
      quality:'production',
      allowTextInFrame:false,
      allowStoryboardAsFinal:false,
      identityLock:'strict',
    },
    voice:{
      required:voiceRequired,
      text:result.spokenText||result.text,
      liveTurnTaking:mode==='live-visio',
      lipSyncRequired:mode==='live-visio'||mode==='cinematic-drama',
      emotion:result.emotion,
    },
    assembly:{
      multiShot,
      targetSceneDuration:duration,
      clipDurationRange:mode==='live-visio'?[2,8]:[3,6],
      reuseValidatedClips:true,
      generateMissingClips:visualRequired,
    },
    cache:{serverOnly:true,reusable:visualRequired,tags},
    rationale:[
      'Le joueur ne gère aucun asset manuellement.',
      visualRequired?'Toute sortie visuelle finale exige une vraie vidéo animée.':'Aucune vidéo nécessaire pour ce tour.',
      visualRequired?'Les images/atlas canoniques servent uniquement de verrou d’identité et de référence, jamais de rendu final.':'',
      mode==='live-visio'?'La visio utilise des états continus écoute/réponse/idle et une voix synchronisée pour donner une sensation d’appel vivant.':'',
      multiShot?'Les scènes longues sont construites par plusieurs clips vrais assemblés automatiquement afin d’éviter un plan artificiellement long.':'',
    ].filter(Boolean),
  };
}
