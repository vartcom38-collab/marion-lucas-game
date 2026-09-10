import { moniaCreativeVault } from './creative-vault';
import { MARION_LUCAS_PROFILE } from './profile';

const BOOTSTRAP_KEY='monia-canon-bootstrap-v1';

export async function ensureMonIACanonBootstrap(){
  try{if(localStorage.getItem(BOOTSTRAP_KEY)==='1')return}catch{}
  const records=[
    {id:'canon-global-rules',scope:'global' as const,subject:'Règles globales',text:MARION_LUCAS_PROFILE.rules.join(' '),locked:true},
    {id:'canon-marion-core',scope:'character' as const,subject:'Marion',text:MARION_LUCAS_PROFILE.characters.Marion.canon,locked:true},
    {id:'canon-marion-agency',scope:'rule' as const,subject:'Agence Marion',text:MARION_LUCAS_PROFILE.characters.Marion.agency,locked:true},
    {id:'canon-lucas-core',scope:'character' as const,subject:'Lucas',text:MARION_LUCAS_PROFILE.characters.Lucas.canon,locked:true},
    {id:'canon-lucas-temperament',scope:'character' as const,subject:'Lucas tempérament',text:MARION_LUCAS_PROFILE.characters.Lucas.temperament,locked:true},
    {id:'canon-lucas-voice',scope:'character' as const,subject:'Lucas voix',text:MARION_LUCAS_PROFILE.characters.Lucas.voice,locked:true},
    {id:'canon-lucas-prohibitions',scope:'rule' as const,subject:'Lucas interdits',text:MARION_LUCAS_PROFILE.characters.Lucas.prohibitions,locked:true},
  ];
  await Promise.all(records.map(record=>moniaCreativeVault.putCanon(record)));
  try{localStorage.setItem(BOOTSTRAP_KEY,'1')}catch{}
}
