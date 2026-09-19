import { moniaExperience, type MonIAMaterializedMedia } from './experience-runtime';

export type JuryBeatKind='gameplay'|'conversation'|'cinematic'|'phone'|'system'|'future';
export type JuryBeat={
  id:string;
  title:string;
  subtitle:string;
  kind:JuryBeatKind;
  actor?:string;
  place:string;
  day:number;
  time:string;
  relationship:string;
  recentAction:string;
  prompt?:string;
  interfaceMode:'world'|'choices'|'phone'|'agenda'|'wardrobe'|'map'|'cinema'|'replay';
  caption:string;
};
export type JuryClip={beat:JuryBeat;state:'queued'|'directing'|'generating'|'ready'|'fallback'|'error';media?:MonIAMaterializedMedia;error?:string};

export const JURY_BEATS:JuryBeat[]=[
  {id:'home',title:'Une vraie vie, pas un menu',subtitle:'Appartement · Nîmes · Jour 1',kind:'gameplay',actor:'Marion',place:'Appartement de Marion, Nîmes',day:1,time:'09:05',relationship:'Dominic est encore inconnu',recentAction:'Marion se réveille et consulte son téléphone',interfaceMode:'world',caption:'Le temps, la lumière, le son et les actions vivent ensemble.'},
  {id:'street',title:'Sortir, marcher, observer',subtitle:'Centre de Nîmes',kind:'gameplay',actor:'Marion',place:'Rue historique du centre de Nîmes',day:1,time:'09:34',relationship:'Dominic est encore inconnu',recentAction:'Marion vient de sortir',interfaceMode:'choices',caption:'Le joueur choisit quoi faire sans quitter le monde.'},
  {id:'marine',title:'Marine est un personnage, pas un waypoint',subtitle:'Conversation contextuelle',kind:'conversation',actor:'Marine',place:'Esplanade de Nîmes',day:1,time:'10:08',relationship:'Marine est la meilleure amie de Marion',recentAction:'Marine vient de rejoindre Marion',interfaceMode:'choices',caption:'On peut rester là, parler, rire, se confier, puis reprendre la journée.'},
  {id:'feria',title:'Le monde monte en intensité',subtitle:'Feria de Nîmes',kind:'gameplay',actor:'Marion',place:'Autour des Arènes de Nîmes',day:1,time:'11:21',relationship:'Dominic est encore inconnu',recentAction:'Marion et Marine avancent dans la foule',interfaceMode:'map',caption:'La ville reste vivante même quand aucun événement majeur ne se produit.'},
  {id:'encounter',title:'Une cinématique au milieu du gameplay',subtitle:'Première rencontre',kind:'cinematic',actor:'Dominic',place:'Foule près des Arènes de Nîmes',day:1,time:'12:18',relationship:'Première rencontre absolue Marion / Dominic',recentAction:'Un mouvement de foule les oblige à s’arrêter',interfaceMode:'cinema',caption:'MonIA génère la scène au bon moment, puis rend immédiatement la main.'},
  {id:'phone',title:'Le téléphone fait partie du monde',subtitle:'Messages · appels · visio',kind:'phone',actor:'Dominic',place:'Madrid, intérieur privé',day:8,time:'20:41',relationship:'Relation naissante',recentAction:'Dominic contacte Marion après sa journée',interfaceMode:'phone',caption:'Messages, appels et visios dépendent de la vraie chronologie de la relation.'},
  {id:'systems',title:'Une vie riche derrière l’écran',subtitle:'Agenda · garde-robe · déplacements',kind:'system',place:'Nîmes',day:24,time:'15:20',relationship:'Relation en évolution',recentAction:'Marion organise sa semaine',interfaceMode:'agenda',caption:'Agenda, tenue, projets, voyages et disponibilité des personnages sont reliés.'},
  {id:'future',title:'Le jeu continue pendant des années',subtitle:'Carrière · voyages · famille · maisons',kind:'future',actor:'Dominic',place:'Espagne',day:240,time:'18:30',relationship:'Relation établie',recentAction:'Retour d’une journée professionnelle',interfaceMode:'replay',caption:'Chaque partie garde les mêmes grandes vérités, mais jamais exactement le même chemin.'}
];

function generationPrompt(beat:JuryBeat){
  if(beat.id==='marine')return 'Prototype non canon de Marine pour présentation uniquement. Jeune femme française d’environ 20 ans, naturelle, meilleure amie de Marion. Elle arrive, parle et réagit spontanément. Pas de gros plan identitaire définitif.';
  if(beat.id==='encounter')return 'Première rencontre naturelle et crédible avec Dominic Castellano. Identité canon stricte. Montrer au moins un instant plein pied puis un plan moyen. Petit incident de foule, il aide Marion, vérifie qu’elle va bien et prononce une phrase française courte. Aucun comportement de couple.';
  if(beat.id==='phone')return 'Visio future de démonstration. Dominic parle en français avec V16. Caméra frontale de son téléphone, téléphone invisible, bras tendu, micro mouvements, respiration, regard écran puis objectif.';
  if(beat.id==='future')return 'Aperçu futur du life-sim. Dominic dans sa vie autonome en Espagne, contexte professionnel et familial crédible, calme après une journée chargée. Suggérer carrière, voyages et foyer sans montage kitsch.';
  return 'Gameplay photoréaliste vivant, mouvements subtils et environnement crédible. Aucun look de diaporama.';
}

export class MonIAJuryRuntime{
  clips:JuryClip[]=JURY_BEATS.map(beat=>({beat,state:'queued'}));
  private emit(){window.dispatchEvent(new CustomEvent('monia:jury-demo',{detail:{clips:this.clips}}));}
  async generate(onProgress?:(clips:JuryClip[])=>void){
    for(const clip of this.clips){
      if(!clip.beat.actor || clip.beat.kind==='system'){clip.state='fallback';this.emit();onProgress?.(this.clips);continue}
      clip.state='directing';this.emit();onProgress?.(this.clips);
      try{
        const experience=await moniaExperience.respond({
          actor:clip.beat.actor,
          requestedChannel:clip.beat.id==='phone'?'visio':'scene',
          playerText:generationPrompt(clip.beat),
          context:{
            speaker:'Marion',
            place:clip.beat.place,
            time:clip.beat.time,
            day:clip.beat.day,
            recentAction:clip.beat.recentAction,
            activeObjective:'Présentation jury du concept complet Marion & Dominic',
            relationship:clip.beat.relationship,
            memories:[],recentEvents:[],
            rules:[
              'Présentation conceptuelle uniquement: ne modifie pas la sauvegarde canon.',
              'Marion et Dominic gardent leurs identités canoniques.',
              'Marine reste un prototype visuel non canon.',
              'Aucun texte incrusté dans la vidéo générée.',
              'Mouvement humain naturel, pas de photo animée artificiellement.'
            ]
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
export const moniaJuryRuntime=new MonIAJuryRuntime();
