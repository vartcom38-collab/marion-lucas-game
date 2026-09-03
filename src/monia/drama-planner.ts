import { monia } from './runtime';
import { fallbackDramaPlan, type MonIADramaPlan, type MonIADramaRequest, type MonIADramaShot } from './drama';

function videoPrompt(request: MonIADramaRequest, shot: Omit<MonIADramaShot,'generationPrompt'>) {
  return `Photorealistic cinematic micro-drama, ${request.format || '9:16'}, ${request.context.place}, ${shot.focusActor}, ${shot.shotSize} shot, emotion ${shot.emotion}, ${shot.action}, ${shot.reaction}, camera ${shot.cameraMove}, ${shot.lighting}. Keep character appearance, wardrobe, hairstyle and location consistent with adjacent shots. Real human motion: breathing, blinking, subtle head movement, gaze shifts and natural posture changes. No text, captions, logos or watermarks. True video only; never simulate motion with a still-image zoom.`;
}

function shot(request: MonIADramaRequest, value: Omit<MonIADramaShot,'generationPrompt'>): MonIADramaShot {
  return {...value, generationPrompt: videoPrompt(request, value)};
}

export async function planDrama(request: MonIADramaRequest, enabled = true): Promise<MonIADramaPlan> {
  const safe = fallbackDramaPlan(request);
  const lead = request.actors.includes('Lucas') ? 'Lucas' : request.actors[0] || 'Lucas';
  const result = await monia.direct({
    actor: lead,
    requestedChannel: 'scene',
    playerText: request.premise,
    context: {
      ...request.context,
      recentAction: `Préparer un mini-drama vidéo à partir de cette prémisse autorisée: ${request.premise}`,
      activeObjective: 'Définir la réaction immédiate, le dialogue bref et le ton; aucun nouveau tournant de scénario.',
      rules: [...(request.context.rules || []), 'Préparer un storyboard de vraie vidéo courte.', 'Ne jamais accepter une image fixe zoomée comme rendu final.', 'Ne jamais inventer un événement futur majeur.', 'Lucas reste absolument fidèle.', 'Dialogue bref et réactions naturelles.'],
    },
    availableMedia: request.availableMedia || [],
  }, 'advanced', enabled).catch(() => null);

  if (!result) return safe;
  const actors = request.actors.length ? request.actors : [lead];
  const other = actors.find(a => a !== lead);
  const emotion = result.emotion || 'calm';
  const location = result.scene?.location || request.context.place;
  const lighting = result.scene?.lighting || 'realistic cinematic lighting coherent with the time';
  const continuity = `Même lieu, mêmes personnages, mêmes vêtements et coiffures pendant toute la scène à ${location}.`;
  const shots: MonIADramaShot[] = [];

  shots.push(shot(request,{id:'s1',duration:3,shotSize:'medium-close',cameraMove:'locked',actors:[lead],focusActor:lead,emotion,action:`${lead} laisse apparaître l’émotion avant de parler.`,dialogue:'',reaction:'regard et respiration subtils',lighting,continuity,transition:'cut'}));
  if(other) shots.push(shot(request,{id:'s2',duration:2.5,shotSize:'close',cameraMove:'slow-push',actors:[other],focusActor:other,emotion:'attentive',action:`${other} reçoit silencieusement le moment.`,dialogue:'',reaction:'micro-réaction naturelle dans le regard',lighting,continuity,transition:'reaction-cut'}));
  shots.push(shot(request,{id:`s${shots.length+1}`,duration:4,shotSize:'close',cameraMove:'slow-push',actors:[lead],focusActor:lead,emotion,action:result.scene?.action || `${lead} répond.`,dialogue:result.spokenText || result.text,reaction:'expression retenue et regard vivant',lighting,continuity,transition:'reaction-cut'}));
  if(other) shots.push(shot(request,{id:`s${shots.length+1}`,duration:2.7,shotSize:'extreme-close',cameraMove:'locked',actors:[other],focusActor:other,emotion:'affected',action:`Silence après la phrase de ${lead}.`,dialogue:'',reaction:'réaction immédiate dans les yeux et le souffle',lighting,continuity,transition:'cut'}));
  if(other) shots.push(shot(request,{id:`s${shots.length+1}`,duration:3.4,shotSize:'two-shot',cameraMove:'handheld-soft',actors:[lead,other],focusActor:lead,emotion,action:'Les deux restent dans le même espace; leur distance et leurs regards portent le moment.',dialogue:'',reaction:'silence vivant et mouvements très légers',lighting,continuity,transition:'cut'}));
  shots.push(shot(request,{id:`s${shots.length+1}`,duration:2.3,shotSize:'detail',cameraMove:'locked',actors:[lead],focusActor:lead,emotion,action:'Insert bref sur un détail de réaction déjà présent.',dialogue:'',reaction:'main, regard ou posture qui prolonge l’émotion',lighting,continuity,transition:'match-cut'}));
  shots.push(shot(request,{id:`s${shots.length+1}`,duration:3.2,shotSize:'close',cameraMove:'slow-pull',actors:[lead],focusActor:lead,emotion,action:`${lead} laisse le silence retomber.`,dialogue:'',reaction:'expression finale sans résolution artificielle',lighting,continuity,transition:'hold'}));

  const wanted=Math.max(12,Math.min(60,request.targetDuration||28));
  const current=shots.reduce((n,s)=>n+s.duration,0);
  const factor=Math.max(.75,Math.min(1.6,wanted/current));
  const timed=shots.map(s=>({...s,duration:Math.round(Math.max(1.5,Math.min(8,s.duration*factor))*10)/10}));
  return {title:request.title||'Drama MonIA',format:request.format||'9:16',targetDuration:Math.round(timed.reduce((n,s)=>n+s.duration,0)*10)/10,rhythm:emotion==='playful'?'playful':emotion==='tender'||emotion==='warm'?'romantic':emotion==='intense'||emotion==='worried'?'tense':'intimate',location,continuityAnchor:`${location} · J${request.context.day} ${request.context.time}`,shots:timed,voiceLines:timed.filter(s=>s.dialogue).map(s=>({actor:s.focusActor,text:s.dialogue,emotion:s.emotion,shotId:s.id})),source:result.source,renderMode:request.renderMode||'true_video_required'};
}
