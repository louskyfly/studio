/**
 * Serveur de test local, compatible OpenAI, utilisé uniquement par les
 * tests automatisés. Il ne fait pas partie de l'application livrée.
 *
 *   node scripts/mock-ai.mjs
 *
 * Il permet de vérifier de bout en bout le pipeline : plan → lots de
 * diapositives → normalisation → mise en page → assistant → exports.
 */
import http from 'node:http'

const PORT = 8787

const plan = {
  title: 'La romanisation de l’Empire romain',
  subtitle: 'Une cité qui transforme les territoires conquis — Seconde',
  problematique: 'Comment Rome transforme-t-elle les territoires conquis en un Empire intégré ?',
  slides: [
    { kind: 'title', title: 'La romanisation de l’Empire romain', brief: 'Couverture' },
    { kind: 'problem', title: 'Problématique', brief: 'Question directrice' },
    { kind: 'section', title: 'Conquérir et administrer', brief: 'Première partie', number: '01' },
    { kind: 'bullets', title: 'Une cité qui étend sa domination', brief: 'Conquêtes et provinces', imageQuery: 'Roman legion relief' },
    { kind: 'map', title: 'L’Empire romain au IIe siècle', brief: 'Carte de l’Empire' },
    { kind: 'document', title: 'La citoyenneté, un instrument d’intégration', brief: 'Table claudienne' },
    { kind: 'section', title: 'Intégrer les populations', brief: 'Seconde partie', number: '02' },
    { kind: 'timeline', title: 'Des conquêtes à la citoyenneté universelle', brief: 'Frise' },
    { kind: 'chart', title: 'Une cité qui s’élargit', brief: 'Évolution de la citoyenneté' },
    { kind: 'conclusion', title: 'Ce qu’il faut retenir', brief: 'Bilan' },
  ],
}

const bodies = {
  bullets: {
    kind: 'bullets',
    title: 'Une cité qui étend sa domination',
    kicker: 'I. Conquérir et administrer',
    intro: 'De cité-État, Rome devient un empire méditerranéen.',
    bullets: [
      '**Une armée efficace** — la légion, instrument de la conquête.',
      '**Des provinces** — territoires conquis, administrés par des gouverneurs.',
      '**Des colonies** — implantations de citoyens romains en Gaule, en Hispanie, en Afrique.',
      '**Des cités** — modelées sur Rome : forum, thermes, amphithéâtre.',
    ],
    imageQuery: 'Pont du Gard Roman aqueduct',
    notes: 'Insister sur la durée : la conquête s’étale sur plusieurs siècles.',
  },
  map: {
    kind: 'map',
    title: 'L’Empire romain au IIe siècle',
    kicker: 'I. Conquérir et administrer',
    projection: 'mediterranee',
    highlight: ['Italy', 'France', 'Spain', 'Greece', 'Turkey', 'Egypt', 'Tunisia', 'Algeria', 'Morocco', 'United Kingdom'],
    points: [
      { name: 'Rome', lon: 12.5, lat: 41.9 },
      { name: 'Carthage', lon: 10.3, lat: 36.85 },
      { name: 'Lugdunum', lon: 4.83, lat: 45.76 },
      { name: 'Athènes', lon: 23.73, lat: 37.98 },
      { name: 'Alexandrie', lon: 29.9, lat: 31.2 },
    ],
    caption: 'Un Empire centré sur la Méditerranée',
    insight: 'La Méditerranée est le cœur économique et politique de l’Empire : « mare nostrum ».',
    notes: 'Faire localiser les provinces et les grandes cités.',
  },
  document: {
    kind: 'document',
    title: 'La citoyenneté, un instrument d’intégration',
    kicker: 'Étude de document',
    source: 'D’après la Table claudienne, Lyon, 48 apr. J.-C.',
    excerpt:
      'Claude rappelle que les notables de Gaule chevelue demandent le droit de siéger au Sénat. Il défend leur intégration : les Gaulois ont prouvé leur fidélité et partagent désormais les mœurs romaines.',
    questions: [
      'Qui demande la citoyenneté et pourquoi ?',
      'Quels arguments Claude avance-t-il pour la lui accorder ?',
      'Que révèle ce texte du fonctionnement de l’Empire ?',
    ],
    notes: 'Faire repérer la distinction entre citoyenneté et intégration des élites.',
  },
  timeline: {
    kind: 'timeline',
    title: 'Des conquêtes à la citoyenneté universelle',
    kicker: 'Repères',
    events: [
      { date: '509 av. J.-C.', label: 'Début de la République' },
      { date: '218 av. J.-C.', label: 'Hannibal franchit les Alpes' },
      { date: '52 av. J.-C.', label: 'Alésia' },
      { date: '27 av. J.-C.', label: 'Auguste, premier empereur' },
      { date: '212', label: 'Édit de Caracalla' },
    ],
    notes: 'Souligner la rupture de 212 : la citoyenneté devient universelle.',
  },
  chart: {
    kind: 'chart',
    title: 'Une cité qui s’élargit',
    kicker: 'Ordre de grandeur',
    chart: 'bar',
    categories: ['République', 'Auguste', 'Claude', 'Caracalla'],
    series: [{ name: 'Population citoyenne (ordre de grandeur)', values: [5, 8, 12, 30] }],
    unit: 'millions',
    source: 'Ordres de grandeur, d’après les historiens de Rome',
    insight: 'La citoyenneté progresse par étapes : elle reste d’abord réservée, puis s’élargit.',
    notes: 'Ne pas donner ces chiffres comme un recensement exact.',
  },
  conclusion: {
    kind: 'conclusion',
    title: 'Ce qu’il faut retenir',
    points: [
      'Rome conquiert puis **administre** : provinces, cités, colonies.',
      'La **citoyenneté** est un instrument d’intégration des élites.',
      'En **212**, l’édit de Caracalla généralise la citoyenneté.',
      'La romanisation n’efface pas les cultures locales : elle les recompose.',
    ],
    takeaway: 'Un Empire n’est pas seulement conquis : il se gouverne et se raconte.',
    notes: 'Revenir à la problématique et ouvrir sur l’héritage romain.',
  },
}

const sections = {
  'section#2': { kind: 'section', title: 'Conquérir et administrer', number: '01', subtitle: 'De la cité-État à l’Empire méditerranéen' },
  'section#6': { kind: 'section', title: 'Intégrer les populations', number: '02', subtitle: 'Citoyenneté, cités et romanisation' },
}

const buildSlides = (prompt) => {
  const targets = [...prompt.matchAll(/^(\d+)\. \[([a-z-]+)\]\s*([^\n]*)/gm)].map((m) => ({ index: Number(m[1]), kind: m[2] }))
  const slides = targets.map(({ index, kind }) => {
    const body = kind === 'section' ? sections[`section#${index}`] : bodies[kind]
    if (body) return { index, ...body }
    return {
      index,
      kind: 'bullets',
      title: plan.slides[index]?.title ?? 'Diapositive',
      bullets: ['**Point 1** — contenu rédigé pour le test.', '**Point 2** — deuxième idée.', '**Point 3** — troisième idée.'],
    }
  })
  return { slides }
}

const assistant = {
  reply: 'Diapositive raccourcie : trois idées au lieu de quatre.',
  scope: 'slide',
  slideIndex: 3,
  slide: {
    kind: 'bullets',
    title: 'Une cité qui étend sa domination',
    kicker: 'I. Conquérir et administrer',
    bullets: ['**Une armée efficace** — la légion conquiert et tient les territoires.', '**Des provinces** — administrées par des gouverneurs.', '**Des cités** — forum, thermes, amphithéâtre.'],
  },
}

const server = http.createServer((req, res) => {
  const send = (obj, code = 200) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' })
    res.end(JSON.stringify(obj))
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' })
    res.end()
    return
  }
  if (req.method === 'GET' && req.url?.startsWith('/v1/models')) {
    return send({ data: [{ id: 'mock-studio' }, { id: 'mock-studio-pro' }] })
  }
  if (req.method !== 'POST') return send({ error: { message: 'not found' } }, 404)

  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    let body = {}
    try {
      body = JSON.parse(raw)
    } catch {
      return send({ error: { message: 'invalid json' } }, 400)
    }
    const prompt = (body.messages ?? []).map((m) => m.content ?? '').join('\n\n')
    let content = '{}'
    if (prompt.includes('Construis le PLAN')) content = JSON.stringify(plan)
    else if (prompt.includes('À RÉDIGER')) content = '```json\n' + JSON.stringify(buildSlides(prompt)) + '\n```'
    else if (prompt.includes('DEMANDE DU PROFESSEUR')) content = JSON.stringify(assistant)
    else content = JSON.stringify({ ok: true })

    setTimeout(() => {
      send({ id: 'mock', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: {} })
    }, 400)
  })
})

server.listen(PORT, '127.0.0.1', () => console.log(`mock-ai sur http://127.0.0.1:${PORT}/v1`))
