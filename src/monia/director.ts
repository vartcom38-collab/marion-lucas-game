import { MARION_LUCAS_PROFILE, type MonIACompactContext } from './profile';

export type MonIAChannel = 'text' | 'voice' | 'video' | 'call' | 'visio' | 'scene';
export type MonIAEmotion = 'calm' | 'warm' | 'playful' | 'tender' | 'worried' | 'tired' | 'focused' | 'intense';
export type MonIAMessageTone = 'neutral' | 'tender' | 'playful' | 'worried' | 'jealous' | 'hurt' | 'angry' | 'distant' | 'urgent';

export type MonIADirectorRequest = {
  actor: string;
  playerText?: string;
  requestedChannel?: MonIAChannel;
  context: MonIACompactContext;
  availableMedia?: string[];
};

export type MonIADirectorResult = {
  channel: MonIAChannel;
  actor: string;
  text: string;
  spokenText: string;
  emotion: MonIAEmotion;
  scene: {
    location: string;
    framing: string;
    lighting: string;
    action: string;
    duration: number;
  } | null;
  memory: string;
  source: 'local' | 'fallback';
};

const channels = new Set<MonIAChannel>(['text', 'voice', 'video', 'call', 'visio', 'scene']);
const emotions = new Set<MonIAEmotion>(['calm', 'warm', 'playful', 'tender', 'worried', 'tired', 'focused', 'intense']);

function asksWhenToMeet(text: string) {
  return /\b(on se voit quand|quand est[- ]?ce qu['’]on se voit|quand on se voit|quand tu viens|tu viens quand|on se revoit quand)\b/i.test(text);
}

function asksWhatDoing(text: string) {
  return /\b(tu fais quoi|qu['’]est[- ]?ce que tu fais|t['’]es où|tu es où)\b/i.test(text);
}

export function inferMessageTone(text: string): MonIAMessageTone {
  const value = text.trim().toLowerCase();
  if (!value) return 'neutral';
  if (/\b(urgent|vite|réponds|reponds|appelle[- ]?moi maintenant|tout de suite|c['’]est important)\b/i.test(value)) return 'urgent';
  if (/\b(t['’]es avec qui|tu es avec qui|c['’]est qui|une autre|quelqu['’]un d['’]autre|tu me caches|tu mens|jaloux|jalouse)\b/i.test(value)) return 'jealous';
  if (/\b(laisse tomber|oublie|j['’]ai compris|c['’]est bon|tant pis|ça sert à rien|ca sert a rien|fais comme tu veux)\b/i.test(value)) return 'hurt';
  if (/\b(énervée|enervee|énervé|enerve|marre|ça m['’]énerve|ca m['’]enerve|tu abuses|n['’]importe quoi)\b/i.test(value) || /!{2,}/.test(value)) return 'angry';
  if (/\b(tu vas bien|ça va vraiment|ca va vraiment|inquiète|inquiete|j['’]ai peur|fais attention|donne[- ]?moi des nouvelles)\b/i.test(value)) return 'worried';
  if (/\b(tu me manques|je pense à toi|je pense a toi|bisou|bisous|embrasse|j['’]ai envie de te voir|bonne nuit|dors bien|mon coeur|mon cœur)\b/i.test(value)) return 'tender';
  if (/\b(mdr|haha|ahaha|je rigole|je plaisante|taquine|devine|😏|😂|🤣|😉)\b/i.test(value)) return 'playful';
  if (/^(ok|d['’]accord|comme tu veux|bonne soirée|bonne soiree|à plus|a plus)\.?$/i.test(value)) return 'distant';
  return 'neutral';
}

function toneInstruction(tone: MonIAMessageTone) {
  const instructions: Record<MonIAMessageTone, string> = {
    neutral: 'Répondre simplement et directement, sans surjouer une émotion.',
    tender: 'Accueillir la tendresse sans devenir mièvre; Lucas peut être chaleureux et intime selon la relation.',
    playful: 'Répondre avec une légère taquinerie ou un sourire, jamais comme une blague forcée.',
    worried: 'Rassurer avec des faits disponibles et reconnaître l’inquiétude, sans inventer une situation.',
    jealous: 'Ne pas provoquer ni alimenter la jalousie. Lucas reste calme, fidèle et peut demander ce qui inquiète Marion.',
    hurt: 'Percevoir la blessure derrière une réponse froide; ne pas répondre sèchement ni dramatiser artificiellement.',
    angry: 'Ne pas escalader. Lucas peut poser une limite ou demander ce qui ne va pas, avec naturel.',
    distant: 'Respecter la distance; ne pas forcer de déclaration affective ni faire comme si tout allait parfaitement.',
    urgent: 'Répondre d’abord au caractère urgent; être bref, clair et concret avec les informations disponibles.',
  };
  return instructions[tone];
}

export function fallbackDirector(request: MonIADirectorRequest): MonIADirectorResult {
  const actor = request.actor || 'Lucas';
  const incomingRaw = request.playerText || '';
  const incoming = incomingRaw.toLowerCase();
  const relation = request.context.relationship.toLowerCase();
  const affectionate = relation.includes('proche') || relation.includes('fort') || relation.includes('intime') || relation.includes('affectueuse');
  const tone = inferMessageTone(incomingRaw);
  let text = affectionate ? "Je viens de voir ton message. Ça me fait sourire." : "Je viens de voir ton message.";
  let emotion: MonIAEmotion = affectionate ? 'warm' : 'calm';

  if (asksWhenToMeet(incomingRaw)) {
    text = affectionate
      ? "J’en ai envie aussi. Je préfère te dire dès que je sais vraiment quand je peux me libérer, plutôt que te promettre un moment au hasard."
      : "J’aimerais bien. Dès que je sais quand je peux vraiment me libérer, je te le dis.";
    emotion = affectionate ? 'tender' : 'warm';
  } else if (asksWhatDoing(incomingRaw)) {
    text = `Là, je suis pris par ma journée. Et toi, tu fais quoi à ${request.context.place} ?`;
    emotion = 'calm';
  } else if (tone === 'urgent') {
    text = "Je suis là. Dis-moi ce qu’il se passe, je te lis.";
    emotion = 'focused';
  } else if (tone === 'jealous') {
    text = affectionate ? "Hé… qu’est-ce qui t’inquiète ? Dis-moi franchement." : "Pourquoi tu me demandes ça ? Dis-moi ce qui t’inquiète.";
    emotion = 'worried';
  } else if (tone === 'hurt') {
    text = affectionate ? "Attends… je sens que quelque chose t’a blessée. Dis-moi ce qui ne va pas." : "Je crois que quelque chose t’a vexée. Tu veux me dire quoi ?";
    emotion = 'worried';
  } else if (tone === 'angry') {
    text = "Je vois que tu es énervée. Dis-moi ce qui t’a mise comme ça, je préfère comprendre plutôt que répondre à côté.";
    emotion = 'focused';
  } else if (tone === 'worried') {
    text = "Oui, ça va. Merci de t’inquiéter. Je te dirais si quelque chose n’allait pas.";
    emotion = 'warm';
  } else if (incoming.includes('manque') || tone === 'tender') {
    text = affectionate ? 'Toi aussi tu me manques. Beaucoup.' : 'Ça me fait plaisir que tu me dises ça.';
    emotion = 'tender';
  } else if (tone === 'playful') {
    text = affectionate ? "Ah ouais ? Je te vois venir, toi 😏" : "Je sens que tu te moques de moi là.";
    emotion = 'playful';
  } else if (tone === 'distant') {
    text = "D’accord. Je te laisse tranquille un peu. On se reparle quand tu veux.";
    emotion = 'calm';
  } else if (incoming.includes('visio')) {
    text = 'Oui. Appelle-moi quand tu veux, si je peux décrocher je réponds.';
    emotion = 'warm';
  } else if (incoming.includes('photo') || incoming.includes('vidéo') || incoming.includes('video')) {
    text = 'Attends, je t’envoie quelque chose.';
    emotion = 'playful';
  } else if (/\b(bonne nuit|dors bien)\b/i.test(incomingRaw)) {
    text = affectionate ? 'Bonne nuit, toi. Dors bien.' : 'Bonne nuit. Repose-toi bien.';
    emotion = 'tender';
  } else if (/\b(bonjour|salut|coucou)\b/i.test(incomingRaw)) {
    text = affectionate ? 'Coucou toi. Ça va ?' : 'Salut. Ça va ?';
    emotion = 'warm';
  } else if (incomingRaw.trim().endsWith('?')) {
    text = "Je te répondrais bien précisément, mais là il me manque une info. Dis-moi juste un peu mieux ce que tu veux savoir.";
    emotion = 'calm';
  }

  const channel: MonIAChannel = request.requestedChannel || (incoming.includes('vocal') ? 'voice' : incoming.includes('visio') ? 'visio' : incoming.includes('vidéo') || incoming.includes('video') ? 'video' : 'text');
  return {
    channel,
    actor,
    text,
    spokenText: text,
    emotion,
    scene: channel === 'video' || channel === 'visio' || channel === 'scene' ? {
      location: request.context.place,
      framing: channel === 'visio' ? 'caméra téléphone, plan poitrine naturel' : 'plan cinématographique intime',
      lighting: 'lumière cohérente avec l’heure et le lieu',
      action: `${actor} réagit naturellement au message de Marion`,
      duration: channel === 'scene' ? 18 : 8,
    } : null,
    memory: request.playerText ? `Marion a écrit à ${actor}: ${request.playerText.slice(0, 120)}` : '',
    source: 'fallback',
  };
}

export function directorPrompt(request: MonIADirectorRequest) {
  const detectedTone = inferMessageTone(request.playerText || '');
  return `Tu es MonIA Director, le cerveau local multimodal du jeu Marion & Lucas.\nTu contrôles les réactions de personnages, SMS, vocaux, appels, visios et micro-scènes, mais tu ne dois JAMAIS inventer un événement futur important ni révéler une surprise au joueur.\n\nRéponds UNIQUEMENT avec un JSON valide sans markdown de cette forme exacte:\n{"channel":"text","actor":"Lucas","text":"...","spokenText":"...","emotion":"warm","scene":null,"memory":"..."}\n\nLECTURE ÉMOTIONNELLE PRÉALABLE:\n- ton détecté du message de Marion = ${detectedTone}.\n- ${toneInstruction(detectedTone)}\n- Ce signal aide à comprendre le sous-texte mais ne remplace jamais les faits du contexte.\n\nRÈGLES:\n- channel doit être text, voice, video, call, visio ou scene.\n- Si requestedChannel est fourni, respecte-le sauf impossibilité logique du contexte.\n- Réponds d'abord directement à la question ou au message de Marion. Pas de phrase générique d'accusé de réception si une réponse concrète est possible.\n- text = contenu visible par la joueuse. Court, naturel, jamais robotique. En général 1 à 3 phrases.\n- spokenText = phrase à prononcer si un audio/visio/scène en a besoin. Sinon identique à text.\n- emotion = calm, warm, playful, tender, worried, tired, focused ou intense.\n- scene vaut null sauf pour video, visio ou scene. Dans ce cas: {"location":"...","framing":"...","lighting":"...","action":"...","duration":8}.\n- duration entre 4 et 30 secondes.\n- Lucas est autonome: il peut être occupé, fatigué, tendre, taquin ou concentré selon le contexte.\n- Lucas reste absolument fidèle.\n- Lucas n'est pas omniscient: il ne sait que ce qui se trouve dans CONTEXTE, REQUEST et les souvenirs fournis.\n- Ne parle jamais au nom de Marion et ne décide jamais ce qu’elle ressent ou répond.\n- Ne révèle jamais une surprise future.\n- N'invente jamais de date, rendez-vous, voyage, promesse ou événement canon majeur si ce fait n'est pas déjà dans le contexte.\n- Si une information manque, réponds naturellement sans la fabriquer.\n- Évite de répéter les mêmes tournures d'un message à l'autre.\n- Une émotion forte ne doit pas automatiquement créer du drama: elle modifie le ton, pas les faits.\n- Une visio ou vidéo doit rester compatible avec les médias disponibles; n’invente pas une apparence canonique différente.\n- memory = une trace factuelle courte seulement si l’échange mérite d’être retenu; sinon chaîne vide.\n\nPROFIL=${JSON.stringify(MARION_LUCAS_PROFILE)}\nREQUEST=${JSON.stringify(request)}`;
}

export function parseDirectorJSON(raw: string, fallback: MonIADirectorResult): MonIADirectorResult | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(raw.slice(start, end + 1));
    const channel = channels.has(value?.channel) ? value.channel as MonIAChannel : fallback.channel;
    const emotion = emotions.has(value?.emotion) ? value.emotion as MonIAEmotion : fallback.emotion;
    const text = typeof value?.text === 'string' ? value.text.trim().slice(0, 500) : '';
    if (!text) return null;
    const spokenText = typeof value?.spokenText === 'string' && value.spokenText.trim() ? value.spokenText.trim().slice(0, 500) : text;
    let scene: MonIADirectorResult['scene'] = null;
    if ((channel === 'video' || channel === 'visio' || channel === 'scene') && value?.scene && typeof value.scene === 'object') {
      scene = {
        location: String(value.scene.location || fallback.scene?.location || '').slice(0, 120),
        framing: String(value.scene.framing || fallback.scene?.framing || '').slice(0, 160),
        lighting: String(value.scene.lighting || fallback.scene?.lighting || '').slice(0, 160),
        action: String(value.scene.action || fallback.scene?.action || '').slice(0, 220),
        duration: Math.max(4, Math.min(30, Number(value.scene.duration || fallback.scene?.duration || 8))),
      };
    }
    return {
      channel,
      actor: typeof value?.actor === 'string' && value.actor.trim() ? value.actor.trim().slice(0, 60) : fallback.actor,
      text,
      spokenText,
      emotion,
      scene,
      memory: typeof value?.memory === 'string' ? value.memory.trim().slice(0, 220) : '',
      source: 'local',
    };
  } catch {
    return null;
  }
}
