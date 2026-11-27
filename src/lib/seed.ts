import { emptyPresentation, uid, type Folder } from './model'
import { buildDeck, type DeckSpec } from './layouts'
import { themeById } from './themes'
import { dbPutFolder, dbPutPresentation } from './db'
import { useApp } from './store'

const folder = (name: string, parentId: string | null): Folder => ({
  id: uid('f'),
  name,
  parentId,
  createdAt: new Date().toISOString(),
})

export const seedIfEmpty = async (): Promise<void> => {
  const state = useApp.getState()
  if (state.presentations.length || state.settings.onboarded) return

  const histoire = folder('Histoire', null)
  const geo = folder('Géographie', null)
  const emc = folder('EMC', null)
  const college = folder('Collège', null)
  const lycee = folder('Lycée', null)
  const levels = [
    folder('Sixième', college.id),
    folder('Cinquième', college.id),
    folder('Quatrième', college.id),
    folder('Troisième', college.id),
    folder('Seconde', lycee.id),
    folder('Première', lycee.id),
    folder('Terminale', lycee.id),
  ]
  const folders = [histoire, geo, emc, college, lycee, ...levels]
  for (const f of folders) await dbPutFolder(f)

  const theme = themeById('ivoire')
  const spec: DeckSpec = {
    title: 'Bienvenue dans Studio',
    subtitle: 'Créer, modifier et exporter un cours en quelques minutes',
    problematique: 'Comment passer d’une idée de cours à un diaporama solide, modifiable et exportable ?',
    subject: 'histoire',
    level: '2de',
    slides: [
      {
        kind: 'title',
        title: 'Bienvenue dans Studio',
        subtitle: 'Votre atelier de présentations pédagogiques — histoire, géographie, EMC.',
        kicker: 'Studio · mode d’emploi',
      },
      {
        kind: 'problem',
        question: 'Comment passer d’une idée de cours à un diaporama solide, modifiable et exportable ?',
        axes: ['Un plan qui répond à une question', 'Des documents et des cartes, pas des murs de texte', 'Un fichier PowerPoint que l’on peut retoucher'],
      },
      {
        kind: 'bullets',
        title: 'Trois façons de commencer',
        kicker: 'Méthode',
        intro: 'Le même éditeur, quelle que soit l’entrée.',
        bullets: [
          '**Un sujet** — « La romanisation de l’Empire romain, pour une Seconde. »',
          '**Des documents** — PDF, Word, PowerPoint : le diaporama respecte leur contenu.',
          '**Vos notes** — un plan de cours, des idées en vrac ; Studio organise.',
          '**Puis vous modifiez** — chaque texte, image, carte et tableau reste éditable.',
        ],
      },
      {
        kind: 'timeline',
        title: 'Une frise, pas une liste de dates',
        kicker: 'Exemple',
        events: [
          { date: '509 av. J.-C.', label: 'Début de la République romaine' },
          { date: '218 av. J.-C.', label: 'Hannibal franchit les Alpes' },
          { date: '52 av. J.-C.', label: 'Alésia : victoire de César' },
          { date: '27 av. J.-C.', label: 'Auguste, premier empereur' },
          { date: '212', label: 'Édit de Caracalla' },
        ],
      },
      {
        kind: 'map',
        title: 'Des cartes historiques et géographiques',
        kicker: 'Exemple',
        projection: 'mediterranee',
        highlight: ['Italy', 'France', 'Spain', 'Greece', 'Turkey', 'Egypt', 'Tunisia', 'Algeria', 'Morocco'],
        points: [
          { name: 'Rome', lon: 12.5, lat: 41.9 },
          { name: 'Carthage', lon: 10.3, lat: 36.85 },
          { name: 'Athènes', lon: 23.73, lat: 37.98 },
        ],
        caption: 'L’Empire romain et la Méditerranée',
        insight: 'La carte est un élément éditable : changez la projection, les pays mis en avant et les points.',
      },
      {
        kind: 'chart',
        title: 'Des graphiques lisibles, construits sur des données',
        kicker: 'Exemple',
        chart: 'bar',
        categories: ['Italie', 'Gaules', 'Hispanie', 'Afrique', 'Orient'],
        series: [{ name: 'Contribution indicative', values: [28, 18, 14, 12, 28] }],
        unit: '%',
        source: 'Exemple pédagogique, valeurs illustratives',
        insight: 'Double-cliquez sur le graphique pour modifier les catégories et les séries.',
      },
      {
        kind: 'conclusion',
        title: 'Ce qu’il faut retenir',
        points: [
          'Studio produit un document **réellement éditable**, pas une image.',
          'La sauvegarde est automatique, dans ce navigateur.',
          'L’export PowerPoint conserve textes, images, formes et tableaux.',
        ],
        takeaway: 'Commencez par « Nouvelle présentation », puis laissez-vous guider.',
      },
    ],
  }

  const built = buildDeck(spec, theme)
  const doc = {
    ...emptyPresentation({ title: spec.title, subject: 'histoire', level: '2de', themeId: 'ivoire' }),
    description: spec.subtitle ?? '',
    slides: built.slides,
    status: 'ready' as const,
    source: { kind: 'blank' as const },
  }
  await dbPutPresentation(doc)
  await useApp.getState().setSettings({ onboarded: true })
  useApp.setState({ folders, presentations: [doc] })
}
