import type {MoniaWorldState} from './monia-world-state';

export type VideoRequestV3={
 schema:'monia-video-request-v3';runId:string;sceneId:string;beatId:string;
 story:{day:number;time:string;phase:string;location?:string};
 characters:Array<{name:string;outfitId?:string|null;canonicalIdentityRequired:boolean}>;
 cameraCandidates:string[];durationTargetSeconds:[number,number];
 continuity:{token:any;location?:string;outfitMarion?:string|null;outfitDominic?:string|null};
 quality:{candidateOnly:boolean;requireIdentity:boolean;requireEyeStability:boolean;requireTemporalStability:boolean;requireWardrobeContinuity:boolean};
 prefetch:string[];
};
export type VideoJob={id:string;candidateOnly:true;narrativeAuthority:false;schemaVersion:3;sourceRequest:VideoRequestV3;primaryCharacter:string;characters:any[];prompt:string;negativePrompt:string;generation:any;qualityGate:any;continuity:any};
const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64);
const identity=(name:string)=>name.toLowerCase()==='dominic'?'lucas':name.toLowerCase();
const characterPack=(c:VideoRequestV3['characters'][number])=>{
 const id=identity(c.name);
 if(id==='marion')return{id,canonRef:'https://marion-lucas.marionbolomey.fr/resources/monia/canon/marion/reference.jpg',atlasChunks:['https://raw.githubusercontent.com/vartcom38-collab/marion-lucas-game/main/assets/monia-atlas/chunks/marion-001.b64'],outfitId:c.outfitId||null};
 return{id:'lucas',canonRef:'https://marion-lucas.marionbolomey.fr/resources/monia/canon/lucas/reference.jpg',priorityImages:['https://raw.githubusercontent.com/vartcom38-collab/marion-lucas-game/main/assets/monia-atlas/lucas-priority-01.jpg.b64','https://raw.githubusercontent.com/vartcom38-collab/marion-lucas-game/main/assets/monia-atlas/lucas-priority-02.jpg.b64'],outfitId:c.outfitId||null};
};
export const buildVideoJob=(r:VideoRequestV3,w:MoniaWorldState):VideoJob=>{
 const names=r.characters.map(x=>x.name).join(' and ');
 const camera=r.cameraCandidates[0]||'cinematic';
 const prompt=`Photorealistic lived-life cinematic video in ${r.story.location||'Nîmes'}, May 1998. ${names} are the canonical people from supplied identity references. ${camera} camera grammar. Natural human micro-movements, physically plausible posture, stable gaze and facial anatomy, restrained motion, coherent light and environment. Preserve exact identity and current wardrobe across every frame. This is one continuous interactive story beat, not a montage, advertisement or stylized clip.`;
 return{id:`v3-${slug(r.sceneId)}-${slug(r.beatId)}-${w.clock.dayIndex}-${w.clock.time.replace(':','')}`,candidateOnly:true,narrativeAuthority:false,schemaVersion:3,sourceRequest:r,primaryCharacter:identity(r.characters[0]?.name||'Marion'),characters:r.characters.map(characterPack),prompt,negativePrompt:'identity drift, different person, face morphing, facial jitter, eye drift, crossed eyes, asymmetric eyes, malformed iris, malformed pupils, eyelid warping, gaze jump, repeated blink, plastic skin, mouth deformation, bad teeth, hand deformation, extra fingers, body morphing, wardrobe change, hairstyle change, temporal flicker, camera jump, text, captions, logo, watermark, illustration, CGI look',generation:{router:'auto-v3',backendOrder:['ltx-current','future-reference-video-backend'],selectionMode:'quality-first',shotCount:Math.min(3,Math.max(1,r.prefetch.length||1)),width:768,height:432,frames:49,steps:12,fps:12,seed:w.seed,shotCharacters:r.characters.length===1?[identity(r.characters[0].name)]:[],cameraCandidates:r.cameraCandidates},qualityGate:{required:true,humanApprovalBeforeLive:true,checks:['canonical-identity','eyes','temporal-face-stability','wardrobe','hands-when-visible','location','lighting','camera-contract','artifact-free']},continuity:r.continuity};
};
export const queueVideoJob=(job:VideoJob)=>{
 const detail={job,dispatchType:'monia_kaggle_run',jobId:job.id,candidateOnly:true};
 window.dispatchEvent(new CustomEvent('monia:video-job-ready',{detail}));
 return detail;
};
export const handleVideoRequest=(r:VideoRequestV3,w:MoniaWorldState)=>queueVideoJob(buildVideoJob(r,w));
