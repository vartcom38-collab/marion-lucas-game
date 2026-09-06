export type MonIAServerBrainTask='narration'|'director';
export type MonIAServerBrainResult={ok:boolean;text?:string;model?:string;error?:string;status:number};

/**
 * Paid/server AI is intentionally disabled in the runtime.
 * MonIA production uses the in-browser local model so normal play has no AI API cost.
 * This compatibility shim remains only so older runtime code fails over immediately
 * without performing any network request.
 */
export async function askMonIAServerBrain(_task:MonIAServerBrainTask,_prompt:string):Promise<MonIAServerBrainResult>{
  return {ok:false,status:0,error:'IA serveur désactivée · mode local gratuit'};
}
