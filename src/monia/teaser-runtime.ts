import { moniaExperience, type MonIAMaterializedMedia } from './experience-runtime';

export type TeaserBeat={
  id:string; title:string; kicker:string; actor?:string; place:string; day:number; time:string;
  relationship:string; recentAction:string; channel:'scene'|'visio'; ui:'none'|'choices'|'phone'|'map'|'agenda'|'replay';
  prompt:string; duration:number;
};
export type TeaserClip={beat:TeaserBeat;state:'queued'|'directing'|'generating'|'ready'|'fallback'|'error';media?:MonIAMaterializedMedia;error?:string};

export const TEASER_BEATS:TeaserBeat[]=[
  {id:'opening',title:'Commencer une vie',kicker:'NÎMES · JOUR 1',actor:'Marion',place:'Appartement de Marion à Nîmes',day:1,time:'08:54',relationship:'Dominic est encore inconnu',recentAction:'Marion commence sa journée',channel:'scene',ui:'choices',duration:6,prompt:'Ouverture premium du jeu complet. Marion dans son appartement vivant à Nîmes, lumière du matin, téléphone, café, mouvement subtil. Montrer une sensation de vrai gameplay et de liberté quotidienne, pas une cinématique isolée.'},
  {id:'city',title:'Habiter une ville qui vit',kicker:'NÎMES',actor:'Marion',place:'Centre historique de Nîmes',day:1,time:'09:31',relationship:'Dominic est encore inconnu',recentAction:'Marion sort de chez elle',channel:'scene',ui:'map',duration:6,prompt:'Gameplay immersif dans Nîmes vivant. Passants, scooters, terrasses, soleil, ambiance Feria qui monte. Marion marche naturellement. Le monde doit avoir du mouvement et du son partout.'},
  {id:'marine',title:'Parler. Rire. Perdre du temps.',kicker:'MARINE',actor:'Marine',place:'Esplanade de Nîmes',day:1,time:'10:12',relationship:'Marine est la meilleure amie de Marion',recentAction:'Marine vient de rejoindre Marion',channel:'scene',ui:'choices',duration:7,prompt:'Marine prototype non canon apparaît physiquement, rejoint Marion, marche puis s’arrête pour discuter. Dialogue français naturel: Marine dit « Alors… maintenant que t’es vraiment installée, ça te fait quoi d’être ici ? » Montrer qu’une conversation peut être une activité de jeu complète.'},
  {id:'encounter',title:'Certaines choses arrivent sans prévenir',kicker:'FERIA',actor:'Dominic',place:'Près des Arènes de Nîmes',day:1,time:'12:18',relationship:'Première rencontre absolue entre Marion et Dominic',recentAction:'La foule les oblige à s’arrêter quelques secondes',channel:'scene',ui:'none',duration:8,prompt:'Première rencontre crédible avec Dominic Castellano. Identité canon stricte, visage et plein pied cohérents avec sa banque. Mouvement de foule, petit incident naturel, Dominic aide Marion. Dialogue français bref: « Ça va ? Vous vous êtes pas fait mal ? » Aucun comportement de couple, aucune pose romantique forcée.'},
  {id:'message',title:'Et parfois tout commence par une phrase',kicker:'PLUS TARD',actor:'Dominic',place:'Nîmes / Madrid',day:1,time:'21:43',relationship:'Ils viennent seulement de se rencontrer',recentAction:'Marion vient de rentrer',channel:'scene',ui:'phone',duration:5,prompt:'Montage téléphone premium et discret. Premier message canon de Dominic: « Tu es bien rentrée ? ». Montrer que le téléphone appartient au monde du jeu et que la relation progresse naturellement.'},
  {id:'visio',title:'Une relation qui vit même à distance',kicker:'VISIO',actor:'Dominic',place:'Madrid, intérieur privé',day:12,time:'22:16',relationship:'Relation naissante et proche',recentAction:'Dominic appelle Marion après une longue journée',channel:'visio',ui:'phone',duration:7,prompt:'Visio réaliste de Dominic en français avec voix V16. Caméra frontale du téléphone, téléphone invisible, cadrage bras tendu, respiration, clignements, regard écran puis objectif. Réplique: « Je voulais juste t’entendre deux minutes. »'},
  {id:'career',title:'Il a sa vie. Tu as la tienne.',kicker:'DEUX TRAJECTOIRES',actor:'Dominic',place:'Espagne, contexte professionnel tauromachique',day:38,time:'16:40',relationship:'Relation en construction',recentAction:'Dominic sort d’un engagement professionnel',channel:'scene',ui:'agenda',duration:6,prompt:'Montrer Dominic dans sa vie professionnelle autonome: déplacement, préparation, entourage, obligations. Pas de romantisation constante. En parallèle suggérer que Marion a ses propres projets, amis et journées.'},
  {id:'life',title:'Les grands moments. Et tous les autres.',kicker:'UNE VIE ENTIÈRE',actor:'Marion',place:'Nîmes puis Espagne',day:120,time:'18:20',relationship:'Relation établie',recentAction:'Vie quotidienne partagée entre plusieurs lieux',channel:'scene',ui:'none',duration:8,prompt:'Montage élégant de la richesse du jeu: cafés, garde-robe, sorties, voyages, maison, famille de Dominic, disputes, réconciliations, moments calmes, projets de Marion, blessures et presse autour de la carrière, tendresse quotidienne. Pas de montage kitsch.'},
  {id:'future',title:'Des années peuvent passer',kicker:'LE TEMPS CONTINUE',actor:'Dominic',place:'Maison familiale en Espagne',day:420,time:'19:05',relationship:'Vie de couple avancée',recentAction:'Retour à la maison après une journée ordinaire',channel:'scene',ui:'none',duration:6,prompt:'Aperçu futur sans spoiler précis: foyer, maturité de la relation, famille potentielle, nouveaux lieux. Montrer une vraie continuité de vie et d’âge, pas une fin figée.'},
  {id:'replay',title:'Et la prochaine partie ne sera pas la même',kicker:'REJOUABILITÉ',place:'Nîmes',day:1,time:'09:00',relationship:'Nouvelle partie',recentAction:'Nouvelle seed de partie',channel:'scene',ui:'replay',duration:7,prompt:'Montrer trois variantes rapides du même Jour 1: sortie tôt, rencontre Marine plus tard, autre itinéraire, ambiance différente. Faire comprendre que les grands piliers existent mais que le chemin, les conversations, les horaires et les micro-événements changent.'},
];

function rules(beat:TeaserBeat){
  return [
    'Teaser conceptuel uniquement: ne jamais modifier la sauvegarde canon.',
    'Marion et Dominic gardent leurs identités canoniques.',
    'Dominic parle en français avec V16 lorsqu’il parle.',
    'Marine reste un prototype visuel non canon.',
    'Mouvement humain et environnemental naturel, jamais effet diaporama.',
    'Aucun texte incrusté par le générateur vidéo; l’interface est ajoutée par le lecteur teaser.',
    'Respecter strictement la chronologie relationnelle propre à chaque beat.'
  ];
}

export class MonIATeaserRuntime{
  clips:TeaserClip[]=TEASER_BEATS.map(beat=>({beat,state:'queued'}));
  private emit(){window.dispatchEvent(new CustomEvent('monia:teaser',{detail:{clips:this.clips}}));}
  async generate(onProgress?:(clips:TeaserClip[])=>void){
    for(const clip of this.clips){
      if(!clip.beat.actor){clip.state='fallback';this.emit();onProgress?.(this.clips);continue}
      clip.state='directing';this.emit();onProgress?.(this.clips);
      try{
        const experience=await moniaExperience.respond({
          actor:clip.beat.actor,
          requestedChannel:clip.beat.channel,
          playerText:clip.beat.prompt,
          context:{
            speaker:'Marion',place:clip.beat.place,time:clip.beat.time,day:clip.beat.day,
            recentAction:clip.beat.recentAction,activeObjective:'Teaser officiel du jeu complet Marion & Dominic',
            relationship:clip.beat.relationship,memories:[],recentEvents:[],rules:rules(clip.beat)
          }
        },'auto',true);
        clip.state='generating';this.emit();onProgress?.(this.clips);
        const media=await moniaExperience.materialize(experience);
        clip.media=media;
        clip.state=media.videoUrl?'ready':'fallback';
        if(!media.videoUrl)clip.error=media.state;
      }catch(error){
        clip.state='error';clip.error=error instanceof Error?error.message:String(error);
      }
      this.emit();onProgress?.(this.clips);
    }
    return this.clips;
  }
}
export const moniaTeaserRuntime=new MonIATeaserRuntime();
