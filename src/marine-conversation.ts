export type MarineConversationPhase='before-contact'|'after-contact'|'ordinary';
export type MarineConversationContext={
  day:number;
  time:string;
  place:string;
  phase:MarineConversationPhase;
  seed:number;
  used?:string[];
};
export type MarineConversationChoice={
  id:string;
  label:string;
  reply:string;
  marineReaction:string;
  mood:'light'|'warm'|'personal'|'playful';
  minutes:number;
};
export type MarineConversation={
  id:string;
  category:string;
  opener:string;
  line:string;
  followup:string;
  choices:MarineConversationChoice[];
};

const topics:MarineConversation[]=[
  {
    id:'settling-nimes',category:'Nîmes',
    opener:'En marchant, Marine te jette un regard de côté.',
    line:'“Alors, maintenant que tu es vraiment installée… ça te fait quoi d’être ici pour de vrai ?”',
    followup:'Elle ne cherche pas une réponse parfaite. Juste à savoir comment tu le vis vraiment.',
    choices:[
      {id:'good',label:'Lui dire que ça te fait du bien',reply:'Tu lui dis que, malgré le côté nouveau, tu te sens plutôt bien ici.',marineReaction:'“Je le savais. T’avais besoin que ça bouge un peu.”',mood:'warm',minutes:6},
      {id:'strange',label:'Avouer que c’est encore bizarre',reply:'Tu lui dis que certains matins tu réalises encore à peine que tu vis ici.',marineReaction:'“Normal. Laisse-toi deux semaines avant de faire semblant d’avoir tout compris.”',mood:'personal',minutes:7},
      {id:'joke',label:'Plaisanter sur le chaos de la Feria',reply:'Tu lui dis que choisir la Feria pour découvrir le calme nîmois était peut-être une erreur.',marineReaction:'Elle éclate de rire. “Oui, là t’as choisi le mode facile.”',mood:'playful',minutes:5},
    ]
  },
  {
    id:'old-life',category:'Avant',
    opener:'Vous ralentissez un peu à cause du monde.',
    line:'“Tu regrettes des trucs de ta vie d’avant, ou pas vraiment ?”',
    followup:'Le ton est léger, mais la question ne l’est pas complètement.',
    choices:[
      {id:'some',label:'Dire qu’il y a quelques choses qui te manquent',reply:'Tu lui dis que certains repères te manquent, même si tu ne voudrais pas revenir en arrière.',marineReaction:'“Ça veut pas dire que t’as fait le mauvais choix. Juste que t’as eu une vie avant.”',mood:'personal',minutes:8},
      {id:'no',label:'Dire que tu avais besoin de changer',reply:'Tu lui dis que tu avais surtout besoin de sortir de ton ancien rythme.',marineReaction:'Elle hoche la tête. “Ça, je l’avais compris avant toi.”',mood:'warm',minutes:6},
      {id:'avoid',label:'Esquiver en la taquinant',reply:'Tu lui demandes depuis quand elle fait des interviews existentielles au milieu de la Feria.',marineReaction:'“Depuis que tu réponds jamais sérieusement du premier coup.”',mood:'playful',minutes:5},
    ]
  },
  {
    id:'feria-people',category:'Feria',
    opener:'Un groupe passe devant vous en chantant et Marine les regarde s’éloigner.',
    line:'“La Feria, c’est le meilleur endroit pour observer les gens. T’as déjà repéré les trois types de personnes ?”',
    followup:'Elle commence déjà à désigner discrètement des inconnus.',
    choices:[
      {id:'ask',label:'Lui demander ses trois catégories',reply:'Tu lui demandes de développer sa théorie.',marineReaction:'Elle commence un classement parfaitement arbitraire et beaucoup trop précis. Vous finissez par rire sur des gens qui n’ont rien demandé.',mood:'light',minutes:9},
      {id:'counter',label:'Inventer tes propres catégories',reply:'Tu lui proposes ton propre classement.',marineReaction:'“Non mais attends, celle-là elle est meilleure.” Elle reprend ton idée et l’améliore immédiatement.',mood:'playful',minutes:8},
      {id:'watch',label:'Juste observer avec elle',reply:'Vous restez quelques minutes à regarder la ville passer.',marineReaction:'Le silence est confortable, ponctué de petits commentaires inutiles mais drôles.',mood:'warm',minutes:6},
    ]
  },
  {
    id:'future-plans',category:'Projets',
    opener:'Vous vous écartez un peu du flux principal.',
    line:'“Tu sais déjà ce que t’as envie de faire ici, ou tu veux juste voir venir ?”',
    followup:'Marine te laisse réfléchir sans remplir le silence.',
    choices:[
      {id:'explore',label:'Dire que tu veux découvrir sans tout prévoir',reply:'Tu lui dis que tu préfères laisser les choses se construire.',marineReaction:'“Ça te ressemble pas mal, en vrai. Même quand tu fais semblant de tout organiser.”',mood:'warm',minutes:7},
      {id:'project',label:'Parler d’un projet qui te trotte dans la tête',reply:'Tu lui dis que tu as envie de construire quelque chose qui soit vraiment à toi.',marineReaction:'“Ça, j’aime bien. Et je vais te harceler jusqu’à ce que tu le fasses.”',mood:'personal',minutes:8},
      {id:'today',label:'Dire que pour aujourd’hui, survivre à la foule suffit',reply:'Tu lui dis que ton plan de carrière immédiat consiste à ne perdre ni téléphone ni chaussures.',marineReaction:'“Objectif raisonnable.”',mood:'light',minutes:5},
    ]
  },
  {
    id:'friend-memory',category:'Vous deux',
    opener:'Un détail dans la rue lui rappelle quelque chose.',
    line:'“Tu te rappelles la fois où on avait juré qu’on rentrerait tôt et qu’on avait fini par…”',
    followup:'Elle n’a même pas besoin de finir la phrase. Tu vois très bien de quoi elle parle.',
    choices:[
      {id:'laugh',label:'Finir l’histoire à sa place',reply:'Tu termines la phrase exactement comme elle allait le faire.',marineReaction:'Elle te coupe en riant. “Oui, voilà. Et après tu dis que c’est moi le problème.”',mood:'playful',minutes:7},
      {id:'deny',label:'Nier complètement',reply:'Tu lui expliques avec le plus grand sérieux que cette histoire n’a jamais existé.',marineReaction:'“Ah oui ? Donc j’ai halluciné les photos aussi ?”',mood:'light',minutes:6},
      {id:'soft',label:'Lui dire que ça te manquait, ce genre de moment',reply:'Tu lui dis que ces moments simples avec elle t’avaient manqué.',marineReaction:'Son sourire change un peu. “Ouais. Moi aussi.”',mood:'warm',minutes:8},
    ]
  },
  {
    id:'random-gossip',category:'Léger',
    opener:'Marine baisse légèrement la voix comme si elle allait annoncer quelque chose de capital.',
    line:'“Attends, faut que je te raconte un truc complètement inutile mais incroyable.”',
    followup:'Le ton suffit à te faire comprendre que ça va prendre quelques minutes.',
    choices:[
      {id:'tell',label:'“Vas-y, raconte.”',reply:'Tu lui donnes toute ton attention comme si l’avenir du pays en dépendait.',marineReaction:'Elle te raconte une histoire minuscule avec une quantité disproportionnée de détails.',mood:'light',minutes:10},
      {id:'guess',label:'Essayer de deviner',reply:'Tu lui proposes trois hypothèses de plus en plus absurdes.',marineReaction:'“La troisième aurait été mieux que la vraie histoire, franchement.”',mood:'playful',minutes:8},
    ]
  },
  {
    id:'after-contact-who',category:'Ce qui vient de se passer',
    opener:'Après quelques pas, Marine tourne enfin la tête vers toi.',
    line:'“Bon… tu comptes faire comme si je venais pas de voir ça ?”',
    followup:'Elle a ce sourire qui dit qu’elle ne va clairement pas laisser tomber le sujet.',
    choices:[
      {id:'nothing',label:'Dire que ce n’était rien',reply:'Tu essaies de minimiser la rencontre.',marineReaction:'“Bien sûr. Et moi j’ai absolument rien vu.”',mood:'playful',minutes:7},
      {id:'cute',label:'Admettre que tu l’as trouvé intriguant',reply:'Tu lui dis simplement que tu ne sais pas trop quoi en penser, mais qu’il t’a intriguée.',marineReaction:'“Voilà. Là on parle.” Elle ne pousse pas plus loin.',mood:'warm',minutes:8},
      {id:'confused',label:'Dire que tu ne sais même pas qui c’était',reply:'Tu lui dis que vous avez à peine eu le temps de parler.',marineReaction:'“Encore mieux. Mystère complet.” Elle sourit mais change de sujet après quelques secondes.',mood:'light',minutes:6},
    ]
  },
  {
    id:'after-contact-number',category:'Ce qui vient de se passer',
    opener:'Marine te regarde avec un air faussement innocent.',
    line:'“Et donc… vous avez échangé vos numéros ou je dois faire semblant de ne pas avoir vu ?”',
    followup:'Elle attend ta réaction plus que la réponse.',
    choices:[
      {id:'yes',label:'Lui dire oui, simplement',reply:'Tu confirmes sans en faire toute une histoire.',marineReaction:'“Mmh. Très bien.” Son sourire dit exactement l’inverse de son ton.',mood:'playful',minutes:6},
      {id:'maybe',label:'Faire durer le suspense',reply:'Tu refuses de lui répondre tout de suite.',marineReaction:'“T’es insupportable.” Elle rit et te donne un petit coup d’épaule.',mood:'playful',minutes:5},
      {id:'moveon',label:'Changer de sujet',reply:'Tu détournes la conversation sur autre chose.',marineReaction:'Elle te laisse faire… pour l’instant.',mood:'warm',minutes:5},
    ]
  }
];

function hash(value:string){
  let h=2166136261;
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0;
}

export function pickMarineConversation(context:MarineConversationContext):MarineConversation{
  const used=new Set(context.used||[]);
  const eligible=topics.filter(topic=>{
    if(context.phase==='before-contact'&&topic.id.startsWith('after-contact'))return false;
    if(context.phase!=='after-contact'&&topic.id.startsWith('after-contact'))return false;
    return !used.has(topic.id);
  });
  const pool=eligible.length?eligible:topics.filter(topic=>context.phase==='after-contact'?topic.id.startsWith('after-contact'):!topic.id.startsWith('after-contact'));
  const key=[context.seed,context.day,context.time,context.place,context.phase,(context.used||[]).join(',')].join('|');
  return pool[hash(key)%pool.length]!;
}

export function allMarineConversationIds(){return topics.map(t=>t.id)}
