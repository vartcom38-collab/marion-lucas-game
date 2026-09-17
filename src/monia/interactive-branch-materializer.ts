import type { MonIAExperienceResult, MonIAMaterializedMedia } from './experience-runtime';
import { executeMonIAGenerationJob } from './generation-executor';
import { generateFreeCanonVideo } from './free-video';
import { buildSpeechPerformanceRequest, renderSpeechPerformance } from './speech-performance-bridge';

function branchPrompt(input:MonIAExperienceResult,voiceDuration?:number){
  const visual=input.mediaPlan.visual;
  const first=input.generationJob.shots[0];
  const line=first?.dialogue?.find(item=>item.actor==='Lucas')?.text;
  const speech=line?` Exact Lucas dialogue: "${line}". V16 is the master clock${voiceDuration?` (${voiceDuration.toFixed(2)}s)`:''}. Do not invent or replace words.`:'';
  return `Photorealistic live-action continuation of the exact previous frame. Do not reset or redesign the scene. Preserve the exact same canonical identities, face geometry, hair, wardrobe, visible tattoos, props, room geometry, lighting, eyelines, screen direction and physical positions unless the player's choice causally changes one of them. Actor focus: ${input.mediaPlan.actor}. Location: ${visual.location}. Framing: ${visual.framing}. Emotion: ${visual.emotion}. Continue action naturally: ${visual.action}.${speech} Natural breathing, blinking, small posture corrections and physically believable motion. No text, subtitles, watermark, morphing, identity drift or scene reset.`;
}

export async function materializeInteractiveBranchFromFrame(input:MonIAExperienceResult,referenceFile:File):Promise<MonIAMaterializedMedia>{
  let execution;
  try{execution=await executeMonIAGenerationJob(input.generationJob)}catch{return {image:null,video:null,generationJobId:input.generationJob.id,state:'voice-failed'}}
  const voice=execution.voice;
  const prepared={...input,generationJob:execution.job};
  if(!prepared.mediaPlan.visual.required){
    return {image:null,video:null,generationJobId:prepared.generationJob.id,voiceAudioUrl:voice?.audioUrl,voiceDuration:voice?.duration,voiceText:voice?.text,state:'ready'};
  }
  const video=await generateFreeCanonVideo({referenceFile,prompt:branchPrompt(prepared,voice?.duration)});
  if(video.state!=='ready'||!video.videoUrl){
    return {image:null,video,generationJobId:prepared.generationJob.id,voiceAudioUrl:voice?.audioUrl,voiceDuration:voice?.duration,voiceText:voice?.text,state:'video-failed'};
  }
  let finalVideoUrl=video.videoUrl;
  if(voice){
    try{
      const speech=await renderSpeechPerformance(buildSpeechPerformanceRequest(video.videoUrl,voice.audioUrl,prepared.generationJob.id));
      finalVideoUrl=speech.videoUrl;
    }catch{
      return {image:null,video,videoUrl:video.videoUrl,generationJobId:prepared.generationJob.id,voiceAudioUrl:voice.audioUrl,voiceDuration:voice.duration,voiceText:voice.text,state:'video-failed'};
    }
  }
  return {image:null,video,videoUrl:finalVideoUrl,generationJobId:prepared.generationJob.id,voiceAudioUrl:voice?.audioUrl,voiceDuration:voice?.duration,voiceText:voice?.text,state:'candidate'};
}

console.info('[MonIA] Interactive branch materializer active · previous frame continuity → V16 → speech-performance → next branch');