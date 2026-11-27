/**
 * Moteur de mise en page : transforme un contenu structuré (produit par
 * l'IA ou par un modèle) en diapositives réellement éditables.
 *
 * Principe : l'IA fournit le fond, ce module fournit la forme. Chaque
 * diapositive en sort avec des éléments positionnés, stylés et modifiables
 * un par un dans l'éditeur.
 */
import {
  SLIDE_H,
  SLIDE_W,
  baseEl,
  newSlide,
  type ChartEl,
  type ChartKind,
  type Level,
  type MapEl,
  type Paragraph,
  type Presentation,
  type ShapeEl,
  type Slide,
  type SlideElement,
  type Subject,
  type TableEl,
  type TextEl,
  type TextStyle,
  type TextRun,
  type TimelineEl,
} from './model'
import type { Theme } from './themes'

/* ------------------------------------------------------------------ */
/* Contrat de contenu                                                  */
/* ------------------------------------------------------------------ */

export type GenSlide =
  | { kind: 'title'; title: string; subtitle?: string; kicker?: string; notes?: string }
  | { kind: 'problem'; question: string; axes?: string[]; notes?: string }
  | { kind: 'section'; title: string; subtitle?: string; number?: string; notes?: string }
  | { kind: 'bullets'; title: string; kicker?: string; intro?: string; bullets: string[]; notes?: string; imageQuery?: string }
  | {
      kind: 'two-col'
      title: string
      kicker?: string
      left: { heading: string; bullets: string[] }
      right: { heading: string; bullets: string[] }
      notes?: string
    }
  | { kind: 'quote'; quote: string; author?: string; context?: string; notes?: string }
  | {
      kind: 'document'
      title: string
      kicker?: string
      source: string
      excerpt: string
      questions: string[]
      notes?: string
      imageQuery?: string
    }
  | { kind: 'timeline'; title: string; kicker?: string; events: { date: string; label: string; desc?: string }[]; notes?: string }
  | {
      kind: 'map'
      title: string
      kicker?: string
      projection: 'world' | 'europe' | 'france' | 'mediterranee'
      highlight: string[]
      points?: { name: string; lon: number; lat: number; label?: string }[]
      caption?: string
      insight?: string
      notes?: string
    }
  | {
      kind: 'chart'
      title: string
      kicker?: string
      chart: 'bar' | 'hbar' | 'line' | 'pie'
      categories: string[]
      series: { name: string; values: number[] }[]
      unit?: string
      source?: string
      insight?: string
      notes?: string
    }
  | {
      kind: 'table'
      title: string
      kicker?: string
      columns: string[]
      rows: string[][]
      source?: string
      notes?: string
    }
  | { kind: 'conclusion'; title: string; points: string[]; takeaway?: string; notes?: string }

export interface DeckSpec {
  title: string
  subtitle?: string
  problematique?: string
  subject?: Subject
  level?: Level
  slides: GenSlide[]
}

export interface SlideImage {
  assetId: string
  credit?: string
  creditUrl?: string
  alt?: string
}

export interface BuildOptions {
  images?: Record<number, SlideImage>
  showNumbers?: boolean
}

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

const M = 84
const CW = SLIDE_W - M * 2

/** Transforme `**gras**` en segments de texte. */
export const inlineRuns = (text: string): TextRun[] => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return parts.map((part) =>
    part.startsWith('**') && part.endsWith('**') ? { text: part.slice(2, -2), bold: true } : { text: part },
  )
}

const paragraph = (text: string, extra: Partial<Paragraph> = {}): Paragraph => ({ runs: inlineRuns(text), ...extra })

const textStyle = (theme: Theme, over: Partial<TextStyle> = {}): TextStyle => ({
  fontFamily: theme.bodyFont,
  fontSize: 24,
  color: theme.ink,
  align: 'left',
  valign: 'top',
  lineHeight: 1.45,
  ...over,
})

const textEl = (
  theme: Theme,
  box: { x: number; y: number; w: number; h: number },
  paragraphs: Paragraph[],
  over: Partial<TextStyle> = {},
  extra: Partial<TextEl> = {},
): TextEl => ({
  ...baseEl(box.x, box.y, box.w, box.h),
  type: 'text',
  paragraphs,
  style: textStyle(theme, over),
  ...extra,
})

const rule = (x: number, y: number, w: number, color: string, h = 3): ShapeEl => ({
  ...baseEl(x, y, w, h),
  type: 'shape',
  shape: 'rect',
  fill: color,
})

const card = (x: number, y: number, w: number, h: number, fill: string, radius = 10): ShapeEl => ({
  ...baseEl(x, y, w, h),
  type: 'shape',
  shape: 'roundRect',
  fill,
  radius,
  stroke: 'transparent',
  strokeWidth: 0,
})

const kickerEl = (theme: Theme, text: string, x = M, y = 64): TextEl =>
  textEl(theme, { x, y, w: CW, h: 20 }, [paragraph(text.toUpperCase())], {
    fontSize: 12,
    letterSpacing: 2.1,
    color: theme.accent,
    bold: true,
    lineHeight: 1.2,
  })

const header = (
  theme: Theme,
  opts: { kicker?: string; title: string; subtitle?: string; width?: number },
): { els: SlideElement[]; bodyY: number } => {
  const els: SlideElement[] = []
  const width = opts.width ?? CW
  let y = 66
  if (opts.kicker) {
    els.push(kickerEl(theme, opts.kicker, M, y))
    y += 26
  }
  const titleSize = opts.title.length > 82 ? 34 : opts.title.length > 58 ? 38 : 44
  // estime le nombre de lignes à partir de la largeur réellement disponible
  const charsPerLine = Math.max(12, Math.floor(width / (titleSize * 0.53)))
  const lines = Math.min(3, Math.max(1, Math.ceil(opts.title.length / charsPerLine)))
  const titleH = titleSize * 1.16 * lines
  els.push(
    textEl(theme, { x: M, y: y + 4, w: width, h: titleH + 12 }, [paragraph(opts.title)], {
      fontFamily: theme.headingFont,
      fontSize: titleSize,
      lineHeight: 1.14,
    }),
  )
  const ruleY = y + 28 + titleH
  els.push(rule(M, ruleY, 54, theme.accent, 3))
  let bodyY = ruleY + 28
  if (opts.subtitle) {
    els.push(
      textEl(theme, { x: M, y: bodyY, w: width, h: 30 }, [paragraph(opts.subtitle)], {
        fontSize: 18,
        color: theme.muted,
        lineHeight: 1.4,
      }),
    )
    bodyY += 34
  }
  return { els, bodyY }
}

const bulletsParagraphs = (items: string[], size: number): Paragraph[] =>
  items.map((b) => ({
    runs: inlineRuns(b),
    bullet: 'dot',
    spaceAfter: size * 0.62,
  }))

const bodyFontSize = (items: string[], base = 28, min = 20): number => {
  const chars = items.reduce((a, b) => a + b.length, 0)
  if (items.length >= 7 || chars > 520) return min
  if (items.length >= 6 || chars > 420) return Math.max(min, base - 5)
  if (items.length >= 5 || chars > 330) return Math.max(min, base - 3)
  return base
}

/* ------------------------------------------------------------------ */
/* Constructeurs par type                                              */
/* ------------------------------------------------------------------ */

const buildTitle = (s: Extract<GenSlide, { kind: 'title' }>, theme: Theme, image?: SlideImage): Slide => {
  const slide = newSlide('title', { type: 'solid', color: theme.bg })
  const els: SlideElement[] = []
  const hasImage = Boolean(image)
  const textW = hasImage ? 620 : 860

  if (s.kicker) els.push(kickerEl(theme, s.kicker, M, 118))
  els.push(
    textEl(theme, { x: M, y: 158, w: textW, h: 210 }, [paragraph(s.title)], {
      fontFamily: theme.headingFont,
      fontSize: s.title.length > 74 ? 50 : s.title.length > 48 ? 58 : 66,
      lineHeight: 1.08,
      valign: 'top',
    }),
  )
  els.push(rule(M, 392, 72, theme.accent2, 3))
  if (s.subtitle) {
    els.push(
      textEl(theme, { x: M, y: 418, w: textW, h: 96 }, [paragraph(s.subtitle)], {
        fontSize: 21,
        color: theme.muted,
        lineHeight: 1.42,
      }),
    )
  }

  if (hasImage && image) {
    els.push({
      ...baseEl(760, 0, 520, SLIDE_H),
      type: 'image',
      assetId: image.assetId,
      fit: 'cover',
      credit: image.credit,
      creditUrl: image.creditUrl,
      alt: image.alt ?? s.title,
    })
    els.push({
      ...baseEl(760, 0, 6, SLIDE_H),
      type: 'shape',
      shape: 'rect',
      fill: theme.bg,
      opacity: 0.9,
    })
  }

  slide.elements = els
  slide.notes = s.notes
  return slide
}

const buildProblem = (s: Extract<GenSlide, { kind: 'problem' }>, theme: Theme): Slide => {
  const slide = newSlide('problem', { type: 'solid', color: theme.bgAlt })
  const els: SlideElement[] = []
  els.push(kickerEl(theme, 'Problématique', M, 116))
  els.push(
    textEl(theme, { x: M, y: 158, w: CW - 80, h: 250 }, [paragraph(s.question)], {
      fontFamily: theme.headingFont,
      fontSize: s.question.length > 190 ? 34 : s.question.length > 120 ? 40 : 46,
      lineHeight: 1.24,
      valign: 'top',
    }),
  )
  els.push(rule(M, 438, 54, theme.accent, 3))
  if (s.axes?.length) {
    els.push(
      textEl(theme, { x: M, y: 470, w: CW - 220, h: 160 }, bulletsParagraphs(s.axes, 21), {
        fontSize: 21,
        lineHeight: 1.45,
        bulletColor: theme.accent2,
        color: theme.muted,
      }),
    )
  }
  slide.elements = els
  slide.notes = s.notes
  return slide
}

const buildSection = (s: Extract<GenSlide, { kind: 'section' }>, theme: Theme): Slide => {
  const slide = newSlide('section', { type: 'solid', color: theme.bgAlt })
  const els: SlideElement[] = []
  const num = s.number ?? ''
  if (num) {
    els.push(
      textEl(
        theme,
        { x: M - 8, y: 92, w: 300, h: 190 },
        [paragraph(num)],
        { fontFamily: theme.headingFont, fontSize: 150, color: theme.accent, lineHeight: 1 },
        { opacity: 0.14 },
      ),
    )
  }
  els.push(rule(M, 300, 54, theme.accent2, 3))
  els.push(
    textEl(theme, { x: M, y: 330, w: CW - 80, h: 150 }, [paragraph(s.title)], {
      fontFamily: theme.headingFont,
      fontSize: s.title.length > 60 ? 44 : 52,
      lineHeight: 1.12,
    }),
  )
  if (s.subtitle) {
    els.push(
      textEl(theme, { x: M, y: 500, w: CW - 160, h: 70 }, [paragraph(s.subtitle)], {
        fontSize: 19,
        color: theme.muted,
        lineHeight: 1.45,
      }),
    )
  }
  slide.elements = els
  slide.notes = s.notes
  return slide
}

const buildBullets = (s: Extract<GenSlide, { kind: 'bullets' }>, theme: Theme, image?: SlideImage): Slide => {
  const slide = newSlide('bullets', { type: 'solid', color: theme.bg })
  const { els, bodyY } = header(theme, { kicker: s.kicker, title: s.title, width: image ? 640 : CW })
  const startY = bodyY + (s.intro ? 44 : 0)
  if (s.intro) {
    els.push(
      textEl(theme, { x: M, y: bodyY - 4, w: image ? 630 : CW, h: 40 }, [paragraph(s.intro)], {
        fontSize: 18,
        color: theme.muted,
        italic: true,
        lineHeight: 1.4,
      }),
    )
  }
  const size = bodyFontSize(s.bullets)
  els.push(
    textEl(theme, { x: M, y: startY, w: image ? 630 : CW, h: 646 - startY }, bulletsParagraphs(s.bullets, size), {
      fontSize: size,
      lineHeight: 1.42,
      bulletColor: theme.accent2,
    }),
  )
  if (image) {
    els.push({
      ...baseEl(756, bodyY + 4, 440, 400),
      type: 'image',
      assetId: image.assetId,
      fit: 'cover',
      radius: 4,
      credit: image.credit,
      creditUrl: image.creditUrl,
      alt: image.alt ?? s.title,
    })
  }
  slide.elements = els
  slide.notes = s.notes
  return slide
}

const buildTwoCol = (s: Extract<GenSlide, { kind: 'two-col' }>, theme: Theme): Slide => {
  const slide = newSlide('two-col', { type: 'solid', color: theme.bg })
  const { els, bodyY } = header(theme, { kicker: s.kicker, title: s.title })
  const colW = (CW - 28) / 2
  const startY = bodyY + 6
  const h = 640 - startY
  const size = bodyFontSize([...s.left.bullets, ...s.right.bullets], 24, 18)
  ;[s.left, s.right].forEach((col, i) => {
    const x = M + i * (colW + 28)
    els.push(card(x, startY, colW, h, theme.bgAlt, 8))
    els.push(rule(x + 26, startY + 34, 40, i === 0 ? theme.accent : theme.accent2, 2.5))
    els.push(
      textEl(theme, { x: x + 26, y: startY + 48, w: colW - 52, h: 40 }, [paragraph(col.heading)], {
        fontFamily: theme.headingFont,
        fontSize: 21,
        lineHeight: 1.2,
      }),
    )
    els.push(
      textEl(theme, { x: x + 26, y: startY + 104, w: colW - 52, h: h - 126 }, bulletsParagraphs(col.bullets, size), {
        fontSize: size,
        lineHeight: 1.4,
        bulletColor: theme.accent2,
      }),
    )
  })
  slide.elements = els
  slide.notes = s.notes
  return slide
}

const buildQuote = (s: Extract<GenSlide, { kind: 'quote' }>, theme: Theme): Slide => {
  const slide = newSlide('quote', { type: 'solid', color: theme.bgAlt })
  const els: SlideElement[] = []
  els.push(
    textEl(theme, { x: M, y: 110, w: 120, h: 120 }, [paragraph('“')], {
      fontFamily: theme.headingFont,
      fontSize: 120,
      color: theme.accent2,
      lineHeight: 1,
    }),
  )
  els.push(
    textEl(theme, { x: M + 90, y: 150, w: CW - 200, h: 320 }, [paragraph(s.quote)], {
      fontFamily: theme.headingFont,
      fontSize: s.quote.length > 280 ? 30 : s.quote.length > 170 ? 36 : 42,
      italic: true,
      lineHeight: 1.3,
      valign: 'middle',
    }),
  )
  if (s.author) {
    els.push(rule(M + 90, 500, 40, theme.accent, 2))
    els.push(
      textEl(theme, { x: M + 90, y: 516, w: CW - 220, h: 30 }, [paragraph(`${s.author}${s.context ? `, ${s.context}` : ''}`)], {
        fontSize: 16,
        color: theme.muted,
        lineHeight: 1.3,
      }),
    )
  }
  slide.elements = els
  slide.notes = s.notes
  return slide
}

const buildDocument = (s: Extract<GenSlide, { kind: 'document' }>, theme: Theme, image?: SlideImage): Slide => {
  const slide = newSlide('document', { type: 'solid', color: theme.bg })
  const { els, bodyY } = header(theme, { kicker: s.kicker ?? 'Étude de document', title: s.title })
  const top = bodyY + 4
  const colW = image ? 610 : 640
  els.push(card(M, top, colW, 372, theme.bgAlt, 8))
  els.push(rule(M + 26, top + 30, 3, theme.accent, 60))
  els.push(
    textEl(theme, { x: M + 46, y: top + 26, w: colW - 76, h: 250 }, [paragraph(s.excerpt)], {
      fontFamily: theme.headingFont,
      fontSize: 19,
      lineHeight: 1.55,
      italic: true,
      color: theme.ink,
    }),
  )
  els.push(
    textEl(theme, { x: M + 46, y: top + 300, w: colW - 76, h: 46 }, [paragraph(s.source)], {
      fontSize: 12.5,
      color: theme.muted,
      lineHeight: 1.35,
    }),
  )
  const qx = image ? 744 : 748
  const qw = image ? 452 : 448
  els.push(
    textEl(theme, { x: qx, y: top + 4, w: qw, h: 34 }, [paragraph('QUESTIONS')], {
      fontSize: 11.5,
      bold: true,
      letterSpacing: 1.8,
      color: theme.accent,
      lineHeight: 1.2,
    }),
  )
  els.push(
    textEl(
      theme,
      { x: qx, y: top + 44, w: qw, h: 320 },
      s.questions.map((q) => ({ runs: inlineRuns(q), bullet: 'number', spaceAfter: 12 })),
      {
        fontSize: s.questions.join(' ').length > 220 ? 15 : 16.5,
        lineHeight: 1.4,
        bulletColor: theme.accent2,
      },
    ),
  )
  if (image) {
    els.push({
      ...baseEl(744, top + 352, 452, 130),
      type: 'image',
      assetId: image.assetId,
      fit: 'cover',
      radius: 4,
      credit: image.credit,
      alt: image.alt ?? s.title,
    })
  }
  slide.elements = els
  slide.notes = s.notes
  return slide
}

const buildTimeline = (s: Extract<GenSlide, { kind: 'timeline' }>, theme: Theme): Slide => {
  const slide = newSlide('timeline', { type: 'solid', color: theme.bg })
  const { els, bodyY } = header(theme, { kicker: s.kicker ?? 'Repères chronologiques', title: s.title })
  const top = bodyY + 16
  const el: TimelineEl = {
    ...baseEl(M, top, CW, 646 - top),
    type: 'timeline',
    orientation: 'horizontal',
    events: s.events,
    accent: theme.accent,
    ink: theme.ink,
    muted: theme.muted,
    fontFamily: theme.bodyFont,
    alternating: true,
  }
  els.push(el)
  slide.elements = els
  slide.notes = s.notes
  return slide
}

const buildMap = (s: Extract<GenSlide, { kind: 'map' }>, theme: Theme): Slide => {
  const slide = newSlide('map', { type: 'solid', color: theme.bg })
  const { els, bodyY } = header(theme, { kicker: s.kicker ?? 'Carte', title: s.title, width: s.insight ? 700 : CW })
  const top = bodyY + 10
  const mapW = s.insight ? 760 : CW
  const mapH = 646 - top
  const el: MapEl = {
    ...baseEl(M, top, mapW, mapH),
    type: 'map',
    projection: s.projection,
    highlight: s.highlight,
    points: s.points ?? [],
    fill: theme.dark ? '#232B33' : '#E4E2D9',
    stroke: theme.dark ? '#0F1419' : '#FBFAF7',
    labelColor: theme.ink,
    highlightFill: theme.accent,
    water: theme.dark ? '#161D24' : '#DCE7EC',
    graticule: true,
    caption: s.caption,
    source: 'Fond de carte : Natural Earth',
  }
  els.push(el)
  if (s.insight) {
    els.push(card(872, top + 8, 324, 220, theme.bgAlt, 8))
    els.push(
      textEl(theme, { x: 896, y: top + 32, w: 276, h: 180 }, [paragraph(s.insight)], {
        fontSize: 16,
        lineHeight: 1.45,
      }),
    )
  }
  slide.elements = els
  slide.notes = s.notes
  return slide
}

const buildChart = (s: Extract<GenSlide, { kind: 'chart' }>, theme: Theme): Slide => {
  const slide = newSlide('chart', { type: 'solid', color: theme.bg })
  const { els, bodyY } = header(theme, { kicker: s.kicker ?? 'Graphique', title: s.title, width: s.insight ? 700 : CW })
  const top = bodyY + 4
  const el: ChartEl = {
    ...baseEl(M, top, s.insight ? 748 : CW, 646 - top),
    type: 'chart',
    chart: s.chart as ChartKind,
    categories: s.categories,
    series: s.series.map((ser, i) => ({ ...ser, color: theme.palette[i % theme.palette.length] })),
    unit: s.unit,
    source: s.source,
    legend: true,
    valueLabels: s.series.length === 1 && s.categories.length <= 8,
  }
  els.push(el)
  if (s.insight) {
    els.push(card(864, top + 8, 332, 220, theme.bgAlt, 8))
    els.push(
      textEl(theme, { x: 888, y: top + 32, w: 284, h: 180 }, [paragraph(s.insight)], {
        fontSize: 16,
        lineHeight: 1.45,
      }),
    )
  }
  slide.elements = els
  slide.notes = s.notes
  return slide
}

const buildTable = (s: Extract<GenSlide, { kind: 'table' }>, theme: Theme): Slide => {
  const slide = newSlide('table', { type: 'solid', color: theme.bg })
  const { els, bodyY } = header(theme, { kicker: s.kicker ?? 'Tableau comparatif', title: s.title })
  const top = bodyY + 8
  const rows = s.rows.length
  const height = Math.min(646 - top, 62 + rows * 44)
  const el: TableEl = {
    ...baseEl(M, top, CW, height),
    type: 'table',
    columns: s.columns.map((label, i) => ({ label, width: i === 0 ? 1.15 : 1 })),
    rows: s.rows,
    headerFill: theme.accent,
    headerColor: theme.dark ? theme.bg : '#FFFFFF',
    bodyColor: theme.ink,
    borderColor: theme.line,
    fontSize: rows > 6 ? 14 : 16,
    fontFamily: theme.bodyFont,
    zebra: true,
    firstColBold: true,
  }
  els.push(el)
  if (s.source) {
    els.push(
      textEl(theme, { x: M, y: top + height + 6, w: CW, h: 22 }, [paragraph(`Source : ${s.source}`)], {
        fontSize: 11.5,
        color: theme.muted,
      }),
    )
  }
  slide.elements = els
  slide.notes = s.notes
  return slide
}

const buildConclusion = (s: Extract<GenSlide, { kind: 'conclusion' }>, theme: Theme): Slide => {
  const slide = newSlide('conclusion', { type: 'solid', color: theme.bg })
  const { els, bodyY } = header(theme, { kicker: 'Bilan', title: s.title })
  const size = bodyFontSize(s.points, 26, 18)
  els.push(
    textEl(theme, { x: M, y: bodyY, w: CW, h: s.takeaway ? 300 : 360 }, bulletsParagraphs(s.points, size), {
      fontSize: size,
      lineHeight: 1.45,
      bulletColor: theme.accent2,
    }),
  )
  if (s.takeaway) {
    els.push(card(M, 556, CW, 96, theme.accent, 10))
    els.push(
      textEl(theme, { x: M + 28, y: 572, w: CW - 56, h: 64 }, [paragraph(s.takeaway)], {
        fontSize: 20,
        color: theme.dark ? theme.bg : '#FFFFFF',
        lineHeight: 1.4,
        valign: 'middle',
      }),
    )
  }
  slide.elements = els
  slide.notes = s.notes
  return slide
}

/* ------------------------------------------------------------------ */
/* Entrée publique                                                     */
/* ------------------------------------------------------------------ */

export const buildSlide = (
  spec: GenSlide,
  theme: Theme,
  opts: { index: number; total?: number; image?: SlideImage } = { index: 0 },
): Slide => {
  switch (spec.kind) {
    case 'title':
      return buildTitle(spec, theme, opts.image)
    case 'problem':
      return buildProblem(spec, theme)
    case 'section':
      return buildSection(spec, theme)
    case 'bullets':
      return buildBullets(spec, theme, opts.image)
    case 'two-col':
      return buildTwoCol(spec, theme)
    case 'quote':
      return buildQuote(spec, theme)
    case 'document':
      return buildDocument(spec, theme, opts.image)
    case 'timeline':
      return buildTimeline(spec, theme)
    case 'map':
      return buildMap(spec, theme)
    case 'chart':
      return buildChart(spec, theme)
    case 'table':
      return buildTable(spec, theme)
    case 'conclusion':
      return buildConclusion(spec, theme)
  }
}

export const buildDeck = (spec: DeckSpec, theme: Theme, opts: BuildOptions = {}): { slides: Slide[]; title: string; subtitle: string } => {
  const slides = spec.slides.map((s, i) => buildSlide(s, theme, { index: i, total: spec.slides.length, image: opts.images?.[i] }))
  return { slides, title: spec.title, subtitle: spec.subtitle ?? '' }
}

export const deckFromSpec = (
  spec: DeckSpec,
  opts: { presentation: Presentation; theme: Theme; images?: Record<number, SlideImage> },
): Presentation => {
  const { slides } = buildDeck(spec, opts.theme, { images: opts.images })
  return {
    ...opts.presentation,
    title: spec.title,
    description: spec.subtitle ?? '',
    subject: spec.subject ?? opts.presentation.subject,
    level: spec.level ?? opts.presentation.level,
    slides,
    status: 'draft',
    updatedAt: new Date().toISOString(),
  }
}

/* ------------------------------------------------------------------ */
/* Diapositive vierge par disposition                                  */
/* ------------------------------------------------------------------ */

export const blankSlideFor = (layout: Slide['layout'], theme: Theme): Slide => {
  const slide = newSlide(layout, { type: 'solid', color: theme.bg })
  switch (layout) {
    case 'title':
      slide.elements = [
        textEl(theme, { x: M, y: 180, w: 900, h: 140 }, [paragraph('Titre de la présentation')], {
          fontFamily: theme.headingFont,
          fontSize: 58,
          lineHeight: 1.1,
        }),
        rule(M, 350, 72, theme.accent2, 3),
        textEl(theme, { x: M, y: 372, w: 760, h: 80 }, [paragraph('Sous-titre, classe, chapitre')], {
          fontSize: 20,
          color: theme.muted,
        }),
      ]
      break
    case 'section':
      slide.background = { type: 'solid', color: theme.bgAlt }
      slide.elements = [
        rule(M, 300, 54, theme.accent2, 3),        textEl(theme, { x: M, y: 330, w: CW - 100, h: 140 }, [paragraph('Titre de partie')], {
          fontFamily: theme.headingFont,
          fontSize: 50,
          lineHeight: 1.12,
        }),
      ]
      break
    case 'bullets':
      slide.elements = [
        kickerEl(theme, 'Partie'),
        textEl(theme, { x: M, y: 96, w: CW, h: 130 }, [paragraph('Titre de la diapositive')], {
          fontFamily: theme.headingFont,
          fontSize: 42,
          lineHeight: 1.14,
        }),
        rule(M, 236, 54, theme.accent, 3),
        textEl(theme, { x: M, y: 272, w: CW, h: 340 }, bulletsParagraphs(['Premier point', 'Deuxième point', 'Troisième point'], 28), {
          fontSize: 28,
          lineHeight: 1.42,
          bulletColor: theme.accent2,
        }),
      ]
      break
    case 'two-col':
      slide.elements = [
        textEl(theme, { x: M, y: 90, w: CW, h: 100 }, [paragraph('Comparer deux phénomènes')], {
          fontFamily: theme.headingFont,
          fontSize: 40,
        }),
        card(M, 220, (CW - 28) / 2, 380, theme.bgAlt),
        card(M + (CW - 28) / 2 + 28, 220, (CW - 28) / 2, 380, theme.bgAlt),
      ]
      break
    case 'quote':
      slide.background = { type: 'solid', color: theme.bgAlt }
      slide.elements = [
        textEl(theme, { x: 170, y: 190, w: 940, h: 300 }, [paragraph('« Une citation marquante. »')], {
          fontFamily: theme.headingFont,
          fontSize: 42,
          italic: true,
          lineHeight: 1.3,
          valign: 'middle',
          align: 'center',
        }),
      ]
      break
    case 'timeline':
      slide.elements = [
        textEl(theme, { x: M, y: 92, w: CW, h: 100 }, [paragraph('Frise chronologique')], { fontFamily: theme.headingFont, fontSize: 42 }),
        {
          ...baseEl(M, 250, CW, 380),
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
        },
      ]
      break
    case 'map':
      slide.elements = [
        textEl(theme, { x: M, y: 92, w: CW, h: 100 }, [paragraph('Carte')], { fontFamily: theme.headingFont, fontSize: 42 }),
        {
          ...baseEl(M, 210, CW, 440),
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
        },
      ]
      break
    case 'chart':
      slide.elements = [
        textEl(theme, { x: M, y: 92, w: CW, h: 100 }, [paragraph('Graphique')], { fontFamily: theme.headingFont, fontSize: 42 }),
        {
          ...baseEl(M, 230, CW, 400),
          type: 'chart',
          chart: 'bar',
          categories: ['2010', '2015', '2020', '2024'],
          series: [{ name: 'Série', values: [12, 18, 24, 31] }],
          legend: true,
        },
      ]
      break
    case 'table':
      slide.elements = [
        textEl(theme, { x: M, y: 92, w: CW, h: 100 }, [paragraph('Tableau')], { fontFamily: theme.headingFont, fontSize: 42 }),
        {
          ...baseEl(M, 240, CW, 260),
          type: 'table',
          columns: [{ label: 'Critère' }, { label: 'Cas A' }, { label: 'Cas B' }],
          rows: [
            ['Contexte', '', ''],
            ['Acteurs', '', ''],
            ['Enjeux', '', ''],
          ],
          headerFill: theme.accent,
          headerColor: '#FFFFFF',
          bodyColor: theme.ink,
          borderColor: theme.line,
          fontSize: 16,
          fontFamily: theme.bodyFont,
          zebra: true,
          firstColBold: true,
        },
      ]
      break
    case 'document':
      slide.elements = [
        textEl(theme, { x: M, y: 92, w: CW, h: 100 }, [paragraph('Étude de document')], { fontFamily: theme.headingFont, fontSize: 42 }),
        card(M, 220, 640, 340, theme.bgAlt),
      ]
      break
    case 'conclusion':
      slide.elements = [
        textEl(theme, { x: M, y: 92, w: CW, h: 100 }, [paragraph('Ce qu’il faut retenir')], { fontFamily: theme.headingFont, fontSize: 42 }),
      ]
      break
    case 'problem':
      slide.background = { type: 'solid', color: theme.bgAlt }
      slide.elements = [
        kickerEl(theme, 'Problématique', M, 116),
        textEl(theme, { x: M, y: 170, w: CW - 100, h: 200 }, [paragraph('Comment … ?')], {
          fontFamily: theme.headingFont,
          fontSize: 42,
          lineHeight: 1.25,
        }),
      ]
      break
    default:
      break
  }
  return slide
}

export const emptyDeck = (theme: Theme): Slide[] => [blankSlideFor('title', theme)]

/* ------------------------------------------------------------------ */
/* Réappliquer un thème sans casser la mise en page                    */
/* ------------------------------------------------------------------ */

export const restyleSlides = (slides: Slide[], from: Theme, to: Theme): Slide[] => {
  const swap = (color?: string): string | undefined => {
    if (!color) return color
    const map: Record<string, string> = {
      [from.bg.toLowerCase()]: to.bg,
      [from.bgAlt.toLowerCase()]: to.bgAlt,
      [from.ink.toLowerCase()]: to.ink,
      [from.muted.toLowerCase()]: to.muted,
      [from.accent.toLowerCase()]: to.accent,
      [from.accentSoft.toLowerCase()]: to.accentSoft,
      [from.accent2.toLowerCase()]: to.accent2,
      [from.line.toLowerCase()]: to.line,
      [from.surface.toLowerCase()]: to.surface,
    }
    return map[color.toLowerCase()] ?? color
  }

  const restyleEl = (el: SlideElement): SlideElement => {
    if (el.type === 'text') {
      return {
        ...el,
        style: {
          ...el.style,
          color: swap(el.style.color) ?? to.ink,
          fontFamily:
            el.style.fontFamily === from.bodyFont
              ? to.bodyFont
              : el.style.fontFamily === from.headingFont
                ? to.headingFont
                : el.style.fontFamily,
          bulletColor: swap(el.style.bulletColor),
        },
        paragraphs: el.paragraphs.map((p) => ({ ...p, runs: p.runs.map((r) => ({ ...r, color: swap(r.color) })) })),
      }
    }
    if (el.type === 'shape') return { ...el, fill: swap(el.fill), stroke: swap(el.stroke) }
    if (el.type === 'table')
      return {
        ...el,
        headerFill: swap(el.headerFill) ?? to.accent,
        headerColor: el.headerColor.toUpperCase() === '#FFFFFF' ? (to.dark ? to.bg : '#FFFFFF') : (swap(el.headerColor) ?? to.ink),
        bodyColor: swap(el.bodyColor) ?? to.ink,
        borderColor: swap(el.borderColor) ?? to.line,
        fontFamily: el.fontFamily === from.bodyFont ? to.bodyFont : el.fontFamily,
      }
    if (el.type === 'chart') return { ...el, series: el.series.map((s, i) => ({ ...s, color: to.palette[i % to.palette.length] })) }
    if (el.type === 'timeline') return { ...el, accent: to.accent, ink: to.ink, muted: to.muted, fontFamily: to.bodyFont }
    if (el.type === 'map')
      return {
        ...el,
        fill: themeLike(el.fill, from.bgAlt) ? (to.dark ? '#232B33' : '#E4E2D9') : el.fill,
        water: to.dark ? '#161D24' : '#DCE7EC',
        highlightFill: to.accent,
        labelColor: to.ink,
      }
    return el
  }

  return slides.map((s) => ({
    ...s,
    background:
      s.background.type === 'solid'
        ? { ...s.background, color: swap(s.background.color) ?? to.bg }
        : s.background.type === 'gradient'
          ? { ...s.background, from: swap(s.background.from) ?? to.bg, to: swap(s.background.to) ?? to.bgAlt }
          : s.background,
    elements: s.elements.map(restyleEl),
  }))
}

const themeLike = (a: string | undefined, b: string): boolean => (a ?? '').toLowerCase() === b.toLowerCase()

/** Applique un thème à toute une présentation. */
export const applyThemeToDoc = (doc: Presentation, from: Theme, to: Theme): Presentation => ({
  ...doc,
  themeId: to.id,
  slides: restyleSlides(doc.slides, from, to),
  updatedAt: new Date().toISOString(),
})
