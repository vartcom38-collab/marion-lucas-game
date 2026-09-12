const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;official?:boolean;visibility?:number;calendar?:Array<{day?:number;owner?:string;title?:string;note?:string}>;flags?:Record<string,unknown>};
export type TaurineContact={name:string;role:'torero'|'professional'|'social';realPerson:boolean;allowed:boolean;usage:string};
export type TaurineWorldSnapshot={enabled:boolean;contacts:TaurineContact[];rules:string[]};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}

const TOREROS=['Roca Rey','Juan Ortega','Pablo Aguado','Borja Jiménez','Daniel Luque','Tomás Rufo','David de Miranda','Manuel Escribano'];
const EXCLUDED=['El Rulli'];

export function getTaurineWorldNetwork():TaurineWorldSnapshot|null{
  const s=read();if(!s)return null;const enabled=!!s.official;
  const contacts:TaurineContact[]=TOREROS.map(name=>({name,role:'torero',realPerson:true,allowed:true,usage:'Peut apparaître comme collègue de cartel, connaissance publique, présence à une feria, dîner, remise de prix ou contexte professionnel. Ne pas inventer de faits privés sensibles.'}));
  EXCLUDED.forEach(name=>contacts.push({name,role:'torero',realPerson:true,allowed:false,usage:'Exclu explicitement du monde social du jeu.'}));
  return{enabled,contacts,rules:[
    'Les personnes réelles servent uniquement de contexte public ou professionnel crédible.',
    'Ne pas inventer de scandale, relation intime, maladie, conflit privé ou comportement compromettant concernant une personne réelle.',
    'Les intrigues privées fortes utilisent des personnages fictifs originaux.',
    'Marion peut développer ses propres amitiés, connaissances et invitations indépendamment de Lucas.',
    'El Rulli est toujours exclu.'
  ]};
}

declare global{interface Window{__moniaTaurineWorldNetwork?:()=>TaurineWorldSnapshot|null}}
window.__moniaTaurineWorldNetwork=getTaurineWorldNetwork;
