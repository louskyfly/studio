/**
 * Studio — modèle de données.
 *
 * Une présentation est un document autonome : diapositives, éléments
 * positionnés, réglages. Les images ne sont pas stockées ici mais
 * référencées par `assetId` (stockage binaire séparé, voir db.ts).
 */

export const SLIDE_W = 1280
export const SLIDE_H = 720
export const SLIDE_RATIO = SLIDE_W / SLIDE_H

export type ID = string

export const uid = (prefix = ''): string => {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return prefix ? `${prefix}_${rand}` : rand
}

export type Subject = 'histoire' | 'geographie' | 'emc' | 'autre'
export type Level =
  | '6e'
  | '5e'
  | '4e'
  | '3e'
  | '2de'
  | '1ere'
  | 'tle'
  | 'college'
  | 'lycee'
  | 'autre'

export type Depth = 'synthetique' | 'equilibre' | 'approfondi'
export type Tone = 'sobre' | 'academique' | 'moderne'
export type CreateMode = 'topic' | 'documents' | 'notes' | 'blank'

export interface AIConfigUsed {
  provider: string
  model: string
  generatedAt: string
}

/* ------------------------------------------------------------------ */
/* Texte                                                               */
/* ------------------------------------------------------------------ */

export interface TextRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string
  size?: number
  font?: string
}

export type Align = 'left' | 'center' | 'right' | 'justify'
export type VAlign = 'top' | 'middle' | 'bottom'

export interface Paragraph {
  runs: TextRun[]
  align?: Align
  bullet?: 'none' | 'dot' | 'dash' | 'number'
  level?: number
  spaceBefore?: number
  spaceAfter?: number
}

export interface TextStyle {
  fontFamily: string
  fontSize: number
  color: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  align: Align
  valign: VAlign
  lineHeight: number
  letterSpacing?: number
  /** Couleur des puces. */
  bulletColor?: string
}

/* ------------------------------------------------------------------ */
/* Éléments                                                            */
/* ------------------------------------------------------------------ */

export interface ElBase {
  id: ID
  x: number
  y: number
  w: number
  h: number
  rotation?: number
  opacity?: number
  locked?: boolean
  name?: string
}

export interface TextEl extends ElBase {
  type: 'text'
  paragraphs: Paragraph[]
  style: TextStyle
  padding?: number
  /** Couleur de fond de la zone de texte. */
  fill?: string
}

export interface ImageEl extends ElBase {
  type: 'image'
  assetId: string
  fit: 'cover' | 'contain'
  radius?: number
  alt?: string
  /** Crédit affiché sous l'image, dans l'éditeur et l'export. */
  credit?: string
  creditUrl?: string
}

export type ShapeKind =
  | 'rect'
  | 'roundRect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'triangle'
  | 'chevron'
  | 'star'
  | 'divider'
  | 'bracket'

export interface ShapeEl extends ElBase {
  type: 'shape'
  shape: ShapeKind
  fill?: string
  stroke?: string
  strokeWidth?: number
  radius?: number
}

export interface TableEl extends ElBase {
  type: 'table'
  columns: { label: string; width?: number }[]
  rows: string[][]
  headerFill: string
  headerColor: string
  bodyColor: string
  borderColor: string
  fontSize: number
  fontFamily: string
  zebra?: boolean
  firstColBold?: boolean
}

export type ChartKind = 'bar' | 'hbar' | 'line' | 'area' | 'pie' | 'donut'

export interface ChartEl extends ElBase {
  type: 'chart'
  chart: ChartKind
  title?: string
  categories: string[]
  series: { name: string; values: (number | null)[]; color?: string }[]
  unit?: string
  source?: string
  legend?: boolean
  valueLabels?: boolean
  colors?: string[]
}

export interface TimelineEl extends ElBase {
  type: 'timeline'
  orientation: 'horizontal' | 'vertical'
  events: { date: string; label: string; desc?: string }[]
  accent: string
  ink: string
  muted: string
  fontFamily: string
  /** Affiche les dates au-dessus ou en dessous. */
  alternating?: boolean
}

export interface MapEl extends ElBase {
  type: 'map'
  projection: 'world' | 'europe' | 'france' | 'mediterranee'
  highlight: string[]
  points: { name: string; lon: number; lat: number; label?: string }[]
  fill: string
  stroke: string
  labelColor?: string
  highlightFill: string
  water: string
  graticule?: boolean
  /** Étiquette de carte / titre interne. */
  caption?: string
  source?: string
}

export interface IconEl extends ElBase {
  type: 'icon'
  icon: string
  color: string
  strokeWidth: number
}

export type SlideElement =
  | TextEl
  | ImageEl
  | ShapeEl
  | TableEl
  | ChartEl
  | TimelineEl
  | MapEl
  | IconEl

export type ElementType = SlideElement['type']

/* ------------------------------------------------------------------ */
/* Fond et diapositive                                                 */
/* ------------------------------------------------------------------ */

export type SlideBackground =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; from: string; to: string; angle: number }
  | { type: 'image'; assetId: string; overlay?: number; overlayColor?: string }
  | { type: 'pattern'; color: string; base: string; variant: 'grid' | 'dots' | 'lines' }

export type LayoutId =
  | 'title'
  | 'section'
  | 'bullets'
  | 'two-col'
  | 'quote'
  | 'document'
  | 'timeline'
  | 'map'
  | 'chart'
  | 'table'
  | 'conclusion'
  | 'image-full'
  | 'problem'
  | 'blank'

export interface Slide {
  id: ID
  layout: LayoutId
  elements: SlideElement[]
  background: SlideBackground
  notes?: string
  hidden?: boolean
}

/* ------------------------------------------------------------------ */
/* Présentation                                                        */
/* ------------------------------------------------------------------ */

export interface Presentation {
  id: ID
  schema: 1
  title: string
  description: string
  subject: Subject
  level: Level
  folderId: ID | null
  tags: string[]
  favorite: boolean
  status: 'draft' | 'ready'
  themeId: string
  slides: Slide[]
  createdAt: string
  updatedAt: string
  source: {
    kind: CreateMode
    prompt?: string
    docNames?: string[]
    params?: GenerationParams
  }
  ai?: AIConfigUsed
  /** Réglages libres (police de secours, options d'export…). */
  options?: { showSlideNumbers?: boolean; footer?: string }
}

export interface GenerationParams {
  level: Level
  subject: Subject
  slideCount: number
  depth: Depth
  themeId: string
  tone: Tone
}

export interface Folder {
  id: ID
  name: string
  parentId: ID | null
  color?: string
  createdAt: string
}

export const SUBJECTS: { id: Subject; label: string; short: string }[] = [
  { id: 'histoire', label: 'Histoire', short: 'H' },
  { id: 'geographie', label: 'Géographie', short: 'G' },
  { id: 'emc', label: 'EMC', short: 'E' },
  { id: 'autre', label: 'Autre', short: 'A' },
]

export const LEVELS: { id: Level; label: string; group: string }[] = [
  { id: '6e', label: 'Sixième', group: 'Collège' },
  { id: '5e', label: 'Cinquième', group: 'Collège' },
  { id: '4e', label: 'Quatrième', group: 'Collège' },
  { id: '3e', label: 'Troisième', group: 'Collège' },
  { id: '2de', label: 'Seconde', group: 'Lycée' },
  { id: '1ere', label: 'Première', group: 'Lycée' },
  { id: 'tle', label: 'Terminale', group: 'Lycée' },
  { id: 'college', label: 'Collège', group: 'Autre' },
  { id: 'lycee', label: 'Lycée', group: 'Autre' },
  { id: 'autre', label: 'Autre', group: 'Autre' },
]

export const DEPTHS: { id: Depth; label: string; hint: string }[] = [
  { id: 'synthetique', label: 'Synthétique', hint: 'Peu de texte, beaucoup de visuels' },
  { id: 'equilibre', label: 'Équilibré', hint: 'Explications et illustrations' },
  { id: 'approfondi', label: 'Approfondi', hint: 'Contenu détaillé, cours magistral' },
]

export const TONES: { id: Tone; label: string }[] = [
  { id: 'sobre', label: 'Sobre' },
  { id: 'academique', label: 'Académique' },
  { id: 'moderne', label: 'Moderne' },
]

export const levelLabel = (l: Level): string => LEVELS.find((x) => x.id === l)?.label ?? l
export const subjectLabel = (s: Subject): string => SUBJECTS.find((x) => x.id === s)?.label ?? s

/* ------------------------------------------------------------------ */
/* Fabriques                                                           */
/* ------------------------------------------------------------------ */

export const baseEl = (x: number, y: number, w: number, h: number) => ({
  id: uid('el'),
  x,
  y,
  w,
  h,
})

export const pt = (text: string, extra: Partial<Paragraph> = {}): Paragraph => ({
  runs: [{ text }],
  ...extra,
})

export const runsText = (p: Paragraph): string => p.runs.map((r) => r.text).join('')

export const paragraphText = (p: Paragraph): string => runsText(p)

export const elementText = (el: SlideElement): string => {
  if (el.type === 'text') return el.paragraphs.map(runsText).join('\n')
  if (el.type === 'table') return [el.columns.map((c) => c.label).join(' '), ...el.rows.map((r) => r.join(' '))].join('\n')
  if (el.type === 'timeline') return el.events.map((e) => `${e.date} ${e.label}`).join('\n')
  if (el.type === 'chart') return [el.title ?? '', ...el.categories].join(' ')
  if (el.type === 'map') return [el.caption ?? '', ...el.highlight, ...el.points.map((p) => p.name)].join(' ')
  if (el.type === 'image') return el.alt ?? ''
  return ''
}

export const slideText = (s: Slide): string =>
  s.elements
    .map(elementText)
    .filter(Boolean)
    .join('\n')

export const presentationText = (p: Presentation): string =>
  [p.title, p.description, ...p.slides.map(slideText)].join('\n')

export const sortedElements = (s: Slide): SlideElement[] => s.elements

export const newSlide = (layout: LayoutId = 'blank', background: SlideBackground = { type: 'solid', color: '#FFFFFF' }): Slide => ({
  id: uid('sl'),
  layout,
  elements: [],
  background,
})

export const emptyPresentation = (opts: { title?: string; subject?: Subject; level?: Level; themeId?: string; folderId?: ID | null } = {}): Presentation => {
  const now = new Date().toISOString()
  return {
    id: uid('pr'),
    schema: 1,
    title: opts.title ?? 'Présentation sans titre',
    description: '',
    subject: opts.subject ?? 'histoire',
    level: opts.level ?? '2de',
    folderId: opts.folderId ?? null,
    tags: [],
    favorite: false,
    status: 'draft',
    themeId: opts.themeId ?? 'ivoire',
    slides: [],
    createdAt: now,
    updatedAt: now,
    source: { kind: 'blank' },
  }
}

export const clone = <T,>(value: T): T =>
  typeof structuredClone === 'function' ? structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T)

export const reId = (slide: Slide): Slide => ({
  ...slide,
  id: uid('sl'),
  elements: slide.elements.map((el) => ({ ...el, id: uid('el') })),
})

/** Normalise les mesures d'un élément dans la diapositive. */
export const clampEl = <T extends { x: number; y: number; w: number; h: number }>(el: T): T => ({
  ...el,
  w: Math.max(8, el.w),
  h: Math.max(8, el.h),
})

export const isText = (el: SlideElement): el is TextEl => el.type === 'text'
export const isImage = (el: SlideElement): el is ImageEl => el.type === 'image'
