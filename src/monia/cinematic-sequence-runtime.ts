import type {VideoJob,VideoRequestV3} from '../monia-video-orchestrator';
import {buildMicroShotSequence,queueVideoJob} from '../monia-video-orchestrator';
import type {MoniaWorldState} from '../monia-world-state';

export type ApprovedMicroShot={jobId:string;candidateId:string;url:string;sequenceIndex:number;sequenceLength:number;shotSize?:string;angle?:string};
export type CinematicSequence={id:string;sceneId:string;intent:string;jobs:VideoJob[];approved:Map<number,ApprovedMicroShot>;state:'planning'|'generating'|'ready'|'playing'|'complete'};

const sequences=new Map<string,CinematicSequence>();
const seqId=(r:VideoRequestV3)=>`sequence:${r.runId}:${r.sceneId}:${r.beatId}`;

export function createCinematicSequence(r:VideoRequestV3,w:MoniaWorldState,intent:string){
 const jobs=buildMicroShotSequence(r,w,intent);
 const sequence:CinematicSequence={id:seqId(r),sceneId:r.sceneId,intent,jobs,approved:new Map(),state:'planning'};
 sequences.set(sequence.id,sequence);
 return sequence;
}

export function queueCinematicSequence(sequence:CinematicSequence){
 sequence.state='generating';
 // Start only the first shot. Each approved shot unlocks the next one so continuity
 // is based on validated media rather than on an unreviewed candidate.
 if(sequence.jobs[0])queueVideoJob(sequence.jobs[0]);
 window.dispatchEvent(new CustomEvent('monia:cinematic-sequence-state',{detail:{id:sequence.id,state:sequence.state,total:sequence.jobs.length}}));
 return sequence;
}

function sequenceForJob(jobId:string){
 for(const sequence of sequences.values()){
  const index=sequence.jobs.findIndex(j=>j.id===jobId);
  if(index>=0)return{sequence,index};
 }
 return null;
}

export function installCinematicSequenceRuntime(){
 window.addEventListener('monia:video-approved',((event:CustomEvent)=>{
  const jobId=String(event.detail?.jobId||'');
  const candidate=event.detail?.candidate;
  const found=sequenceForJob(jobId);
  if(!found||!candidate?.url)return;
  const {sequence,index}=found;
  const job=sequence.jobs[index];
  sequence.approved.set(index,{jobId,candidateId:String(candidate.id),url:String(candidate.url),sequenceIndex:index,sequenceLength:sequence.jobs.length,shotSize:job.sourceRequest.shotGrammar?.shotSize,angle:job.sourceRequest.shotGrammar?.angle});
  const next=sequence.jobs[index+1];
  if(next){
   // Carry only validated continuity into the following camera setup.
   next.continuity={...next.continuity,...event.detail?.continuity,previousApprovedShotUrl:String(candidate.url),previousShotIndex:index};
   queueVideoJob(next);
  }else{
   sequence.state='ready';
   const shots=[...sequence.approved.values()].sort((a,b)=>a.sequenceIndex-b.sequenceIndex);
   window.dispatchEvent(new CustomEvent('monia:cinematic-sequence-ready',{detail:{id:sequence.id,sceneId:sequence.sceneId,intent:sequence.intent,shots}}));
   window.dispatchEvent(new CustomEvent('monia:cinematic-sequence-state',{detail:{id:sequence.id,state:'ready',total:shots.length}}));
  }
 }) as EventListener);
}

export function getCinematicSequence(id:string){return sequences.get(id)||null}
