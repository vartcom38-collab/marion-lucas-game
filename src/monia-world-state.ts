export type StoryPhase='morning'|'midday'|'afternoon'|'evening'|'night';
export type WorldCharacterState={location?:string;activity?:string;outfitId?:string|null;mood?:string;knowledge:string[];commitments:string[]};
export type RelationshipState={familiarity:number;trust:number;attraction:number;affection:number;tension:number;conflict:number;intimacy:number;unresolvedTopics:string[]};
export type MoniaWorldState={
 version:2; runId:string; seed:number;
 clock:{dayIndex:number;year:number;month:number;dayOfMonth:number;time:string;phase:StoryPhase};
 marion:WorldCharacterState&{phoneState:'idle'|'open'|'call'|'visio'};
 dominic:WorldCharacterState&{met:boolean;hasNumber:boolean;contactStage:number;availabilityHidden?:string};
 relationships:Record<string,RelationshipState>;
 continuity:{memories:string[];promises:string[];arguments:string[];sharedEvents:string[];outfitHistory:string[];locationHistory:string[]};
 future:{scheduledEvents:any[];conditionalEvents:any[];hiddenOpportunities:any[];longArcFlags:string[];lifeState:string[]};
 runtime:{sceneId:string;beatId:string;lastChoiceId?:string;continuityToken?:Record<string,unknown>;prefetch:string[]};
};
export const WORLD_STATE_KEY='monia-world-state-v2';
const phaseFor=(time:string):StoryPhase=>{const h=Number(time.split(':')[0]||0);if(h<12)return'morning';if(h<14)return'midday';if(h<18)return'afternoon';if(h<22)return'evening';return'night'};
export const freshWorldState=(seed=Date.now()%2147483647):MoniaWorldState=>({
 version:2,runId:'run-'+Date.now(),seed,
 clock:{dayIndex:1,year:1998,month:5,dayOfMonth:1,time:'09:12',phase:'morning'},
 marion:{location:'Chez Marion, Nîmes',activity:'morning',outfitId:null,mood:'neutral',knowledge:[],commitments:[],phoneState:'idle'},
 dominic:{met:false,hasNumber:false,contactStage:0,location:undefined,activity:undefined,outfitId:null,mood:undefined,knowledge:[],commitments:[]},
 relationships:{'Marion:Dominic':{familiarity:0,trust:0,attraction:0,affection:0,tension:0,conflict:0,intimacy:0,unresolvedTopics:[]}},
 continuity:{memories:[],promises:[],arguments:[],sharedEvents:[],outfitHistory:[],locationHistory:['Chez Marion, Nîmes']},
 future:{scheduledEvents:[],conditionalEvents:[],hiddenOpportunities:[],longArcFlags:[],lifeState:[]},
 runtime:{sceneId:'D1_MORNING_HOME',beatId:'wake',prefetch:[]}
});
export const loadWorldState=():MoniaWorldState=>{try{const x=JSON.parse(localStorage.getItem(WORLD_STATE_KEY)||'null');return x?.version===2?x:freshWorldState()}catch{return freshWorldState()}};
export const saveWorldState=(w:MoniaWorldState)=>localStorage.setItem(WORLD_STATE_KEY,JSON.stringify(w));
export const advanceWorldClock=(w:MoniaWorldState,minutes:number)=>{let [h,m]=w.clock.time.split(':').map(Number);let total=h*60+m+Math.max(0,minutes);while(total>=1440){total-=1440;w.clock.dayIndex++;w.clock.dayOfMonth++}h=Math.floor(total/60);m=total%60;w.clock.time=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');w.clock.phase=phaseFor(w.clock.time);return w};
export const bridgeLegacyState=(w:MoniaWorldState,legacy:any)=>{w.clock.dayIndex=Number(legacy.day||w.clock.dayIndex);w.clock.year=Number(legacy.year||w.clock.year);w.clock.time=String(legacy.time||w.clock.time);w.clock.phase=phaseFor(w.clock.time);w.marion.location=String(legacy.place||w.marion.location);w.marion.outfitId=legacy.currentOutfitId??w.marion.outfitId;w.dominic.met=Boolean(legacy.metDominic);w.dominic.hasNumber=Boolean(legacy.hasDominicNumber);w.dominic.contactStage=Number(legacy.contactStage||0);w.runtime.sceneId=String(legacy.sceneId||w.runtime.sceneId);w.runtime.lastChoiceId=legacy.lastChoiceId;if(Array.isArray(legacy.memories))w.continuity.memories=[...legacy.memories];return w};
export const syncLegacyFromWorld=(legacy:any,w:MoniaWorldState)=>{legacy.day=w.clock.dayIndex;legacy.year=w.clock.year;legacy.time=w.clock.time;legacy.place=w.marion.location;legacy.currentOutfitId=w.marion.outfitId;legacy.metDominic=w.dominic.met;legacy.hasDominicNumber=w.dominic.hasNumber;legacy.contactStage=w.dominic.contactStage;legacy.sceneId=w.runtime.sceneId;legacy.lastChoiceId=w.runtime.lastChoiceId;legacy.memories=[...w.continuity.memories];return legacy};
export const writeWorldEvent=(w:MoniaWorldState,event:{type:string;id?:string;text?:string;minutes?:number;sceneId?:string;choiceId?:string;place?:string;outfitId?:string|null})=>{if(event.minutes)advanceWorldClock(w,event.minutes);if(event.sceneId)w.runtime.sceneId=event.sceneId;if(event.choiceId)w.runtime.lastChoiceId=event.choiceId;if(event.place){w.marion.location=event.place;if(w.continuity.locationHistory.at(-1)!==event.place)w.continuity.locationHistory.push(event.place)}if(event.outfitId!==undefined){w.marion.outfitId=event.outfitId;if(event.outfitId)w.continuity.outfitHistory.push(event.outfitId)}if(event.text&&!w.continuity.memories.includes(event.text))w.continuity.memories.unshift(event.text);saveWorldState(w);window.dispatchEvent(new CustomEvent('monia:world-state-v2',{detail:w}));return w};
