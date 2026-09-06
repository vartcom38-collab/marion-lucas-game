export type MonIAServerBrainTask='narration'|'director';
export type MonIAServerBrainResult={ok:boolean;text?:string;model?:string;error?:string;status:number};

const ENDPOINT='./api/monia-ai.php';
const TIMEOUT_MS=24_000;

export async function askMonIAServerBrain(task:MonIAServerBrainTask,prompt:string):Promise<MonIAServerBrainResult>{
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const response=await fetch(ENDPOINT,{
      method:'POST',
      credentials:'same-origin',
      cache:'no-store',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({task,prompt}),
      signal:controller.signal,
    });
    let data:any=null;
    try{data=await response.json()}catch{}
    if(!response.ok)return {ok:false,status:response.status,error:String(data?.error||`HTTP ${response.status}`)};
    const text=typeof data?.text==='string'?data.text.trim():'';
    if(!text)return {ok:false,status:502,error:'réponse IA serveur vide'};
    return {ok:true,status:response.status,text,model:typeof data?.model==='string'?data.model:undefined};
  }catch(error){
    const message=error instanceof DOMException&&error.name==='AbortError'?'timeout IA serveur':error instanceof Error?error.message:String(error);
    return {ok:false,status:0,error:message};
  }finally{window.clearTimeout(timer)}
}
