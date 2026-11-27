import { baseEl, type ChartEl, type IconEl, type MapEl, type ShapeEl, type Slide, type SlideBackground, type SlideElement, type TableEl, type TextEl, type TimelineEl } from './model'
import type { Theme } from './themes'
import { blankSlideFor } from './layouts'

export const defaultTextStyle = (theme: Theme) => ({
  fontFamily: theme.bodyFont,
  fontSize: 26,
  color: theme.ink,
  align: 'left' as const,
  valign: 'top' as const,
  lineHeight: 1.45,
})

export const createTextElement = (theme: Theme, x = 440, y = 300, w = 420, h = 140): TextEl => ({
  ...baseEl(x, y, w, h),
  type: 'text',
  paragraphs: [{ runs: [{ text: 'Nouveau texte' }] }],
  style: defaultTextStyle(theme),
})

export const createShapeElement = (theme: Theme, x = 520, y = 290): ShapeEl => ({
  ...baseEl(x, y, 240, 150),
  type: 'shape',
  shape: 'roundRect',
  fill: theme.accentSoft,
  stroke: theme.accent,
  strokeWidth: 1,
  radius: 12,
})

export const createTableElement = (theme: Theme, x = 160, y = 250): TableEl => ({
  ...baseEl(x, y, 960, 260),
  type: 'table',
  columns: [{ label: 'Critère' }, { label: 'Élément A' }, { label: 'Élément B' }],
  rows: [
    ['Contexte', '', ''],
    ['Acteurs', '', ''],
    ['Enjeux', '', ''],
  ],
  headerFill: theme.accent,
  headerColor: theme.dark ? theme.bg : '#FFFFFF',
  bodyColor: theme.ink,
  borderColor: theme.line,
  fontSize: 16,
  fontFamily: theme.bodyFont,
  zebra: true,
  firstColBold: true,
})

export const createChartElement = (theme: Theme, x = 180, y = 250): ChartEl => ({
  ...baseEl(x, y, 920, 380),
  type: 'chart',
  chart: 'bar',
  categories: ['2010', '2015', '2020', '2024'],
  series: [{ name: 'Série', values: [12, 18, 24, 31], color: theme.palette[0] }],
  legend: true,
  valueLabels: true,
})

export const createTimelineElement = (theme: Theme, x = 100, y = 270): TimelineEl => ({
  ...baseEl(x, y, 1080, 300),
  type: 'timeline',
  orientation: 'horizontal',
  events: [
    { date: '1789', label: 'Révolution française' },
    { date: '1848', label: 'Printemps des peuples' },
    { date: '1914', label: 'Première Guerre mondiale' },
    { date: '1945', label: 'Fin de la Seconde Guerre mondiale' },
  ],
  accent: theme.accent,
  ink: theme.ink,
  muted: theme.muted,
  fontFamily: theme.bodyFont,
  alternating: true,
})

export const createMapElement = (theme: Theme, x = 120, y = 220): MapEl => ({
  ...baseEl(x, y, 1040, 440),
  type: 'map',
  projection: 'europe',
  highlight: ['France'],
  points: [{ name: 'Paris', lon: 2.35, lat: 48.86 }],
  fill: theme.dark ? '#232B33' : '#E4E2D9',
  stroke: theme.dark ? '#0F1419' : '#FBFAF7',
  labelColor: theme.ink,
  highlightFill: theme.accent,
  water: theme.dark ? '#161D24' : '#DCE7EC',
  graticule: true,
  caption: 'Carte',
  source: 'Fond de carte : Natural Earth',
})

export const createIconElement = (theme: Theme, x = 600, y = 300): IconEl => ({
  ...baseEl(x, y, 80, 80),
  type: 'icon',
  icon: 'lightbulb',
  color: theme.accent,
  strokeWidth: 1.6,
})

export const ELEMENT_LABELS: Record<string, string> = {
  text: 'Texte',
  image: 'Image',
  shape: 'Forme',
  table: 'Tableau',
  chart: 'Graphique',
  timeline: 'Frise',
  map: 'Carte',
  icon: 'Icône',
}

export const ICON_NAMES = [
  ['landmark', 'Monument'],
  ['map', 'Carte'],
  ['earth', 'Globe'],
  ['users', 'Groupe'],
  ['scale', 'Balance'],
  ['crown', 'Couronne'],
  ['book', 'Livre'],
  ['scroll', 'Parchemin'],
  ['ship', 'Navire'],
  ['factory', 'Usine'],
  ['leaf', 'Nature'],
  ['chart', 'Graphique'],
  ['clock', 'Horloge'],
  ['graduation', 'Diplôme'],
  ['lightbulb', 'Idée'],
  ['flag', 'Drapeau'],
  ['swords', 'Conflit'],
  ['castle', 'Château'],
  ['church', 'Église'],
  ['coins', 'Économie'],
  ['handshake', 'Accord'],
  ['anchor', 'Port'],
  ['mountain', 'Relief'],
  ['wheat', 'Agriculture'],
  ['droplet', 'Eau'],
  ['sun', 'Climat'],
  ['compass', 'Boussole'],
  ['route', 'Route'],
  ['building', 'Ville'],
  ['vote', 'Vote'],
  ['gavel', 'Justice'],
  ['newspaper', 'Presse'],
  ['hourglass', 'Temps'],
  ['telescope', 'Science'],
  ['microscope', 'Recherche'],
  ['pen', 'Écriture'],
  ['target', 'Objectif'],
  ['arrow', 'Flèche'],
  ['quote', 'Citation'],
  ['star', 'Étoile'],
  ['pin', 'Lieu'],
] as const

export const BACKGROUND_PRESETS = (theme: Theme): { id: string; label: string; bg: SlideBackground }[] => [
  { id: 'plain', label: 'Fond simple', bg: { type: 'solid', color: theme.bg } },
  { id: 'alt', label: 'Papier teinté', bg: { type: 'solid', color: theme.bgAlt } },
  { id: 'dots', label: 'Pointillés', bg: { type: 'pattern', base: theme.bg, color: theme.line, variant: 'dots' } },
  { id: 'grid', label: 'Quadrillage', bg: { type: 'pattern', base: theme.bg, color: theme.line, variant: 'grid' } },
  {
    id: 'gradient',
    label: 'Dégradé',
    bg: { type: 'gradient', from: theme.bg, to: theme.bgAlt, angle: 135 },
  },
]

/** Diapositive prête pour un nouveau type de contenu. */
export const slideForLayout = (layout: Slide['layout'], theme: Theme): Slide => blankSlideFor(layout, theme)

export const elementsForLayout = (layout: Slide['layout'], theme: Theme): SlideElement[] => blankSlideFor(layout, theme).elements
