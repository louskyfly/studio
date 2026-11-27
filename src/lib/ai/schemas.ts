import { z } from 'zod'
import type { GenSlide, DeckSpec } from '../layouts'
import type { Level, Subject } from '../model'

/* ------------------------------------------------------------------ */
/* Lecture tolérante des réponses du modèle                            */
/* ------------------------------------------------------------------ */

const asString = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')

const clean = (v: unknown): string =>
  asString(v)
    .replace(/\r/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-•*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()

const cleanMultiline = (v: unknown): string =>
  asString(v)
    .replace(/\r/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v])

const asStringArray = (v: unknown, max = 8): string[] =>
  asArray(v)
    .map(clean)
    .filter(Boolean)
    .slice(0, max)

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(asString(v).replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

/* ------------------------------------------------------------------ */
/* Plan                                                                */
/* ------------------------------------------------------------------ */

export const planSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  problematique: z.string().optional(),
  slides: z.array(z.record(z.string(), z.unknown())).default([]),
})

export interface PlanItem {
  kind: string
  title: string
  brief: string
}

export interface NormalizedPlan {
  title: string
  subtitle: string
  problematique: string
  slides: PlanItem[]
}

const KNOWN_KINDS = new Set([
  'title',
  'problem',
  'section',
  'bullets',
  'two-col',
  'quote',
  'document',
  'timeline',
  'map',
  'chart',
  'table',
  'conclusion',
])

export const normalizePlan = (raw: unknown, fallbackTitle: string, slideCount: number): NormalizedPlan => {
  const parsed = planSchema.safeParse(raw)
  const data = parsed.success ? parsed.data : { slides: [] as Record<string, unknown>[], title: '' }
  const title = clean(data.title) || fallbackTitle
  const subtitle = clean(data.subtitle)
  const problematique = clean(data.problematique || '')

  let slides: PlanItem[] = (data.slides ?? []).map((s) => {
    const kind = clean(s.kind) || 'bullets'
    return {
      kind: KNOWN_KINDS.has(kind) ? kind : 'bullets',
      title: clean(s.title) || 'Diapositive',
      brief: clean(s.brief ?? s.description ?? ''),
    }
  })

  if (!slides.length) {
    slides = [{ kind: 'title', title, brief: subtitle }, { kind: 'conclusion', title: 'Ce qu’il faut retenir', brief: '' }]
  }

  // structure minimale : couverture en tête, bilan en fin
  if (slides[0].kind !== 'title') slides.unshift({ kind: 'title', title, brief: subtitle })
  slides[0] = { ...slides[0], kind: 'title', title: slides[0].title || title, brief: slides[0].brief || subtitle }
  if (slides[slides.length - 1].kind !== 'conclusion') slides.push({ kind: 'conclusion', title: 'Ce qu’il faut retenir', brief: '' })

  // une diapositive de problématique juste après la couverture
  if (slides[1]?.kind !== 'problem' && problematique) {
    slides.splice(1, 0, { kind: 'problem', title: 'Problématique', brief: problematique })
  }

  // ajuste le nombre demandé sans casser la structure
  if (slides.length > slideCount) {
    const head = slides.slice(0, 2)
    const tail = slides[slides.length - 1]
    const middle = slides.slice(2, -1).slice(0, Math.max(1, slideCount - 3))
    slides = [...head, ...middle, tail]
  } else if (slides.length < slideCount) {
    const last = slides.pop()!
    const fillers = Math.max(0, slideCount - slides.length - 1)
    for (let i = 0; i < fillers; i++) {
      slides.push({ kind: 'bullets', title: `Approfondir (${i + 1})`, brief: 'Développe un aspect du plan.' })
    }
    slides.push(last)
  }

  return { title, subtitle, problematique, slides }
}

/* ------------------------------------------------------------------ */
/* Diapositives                                                        */
/* ------------------------------------------------------------------ */

export const normalizeGenSlide = (raw: unknown): GenSlide | null => {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const kind = clean(o.kind)

  switch (kind) {
    case 'title': {
      const title = clean(o.title)
      if (!title) return null
      return { kind: 'title', title, subtitle: clean(o.subtitle) || undefined, kicker: clean(o.kicker) || undefined, notes: clean(o.notes) || undefined }
    }
    case 'problem': {
      const question = clean(o.question ?? o.title)
      if (!question) return null
      return { kind: 'problem', question, axes: asStringArray(o.axes, 4), notes: clean(o.notes) || undefined }
    }
    case 'section': {
      const title = clean(o.title)
      if (!title) return null
      return {
        kind: 'section',
        title,
        subtitle: clean(o.subtitle) || undefined,
        number: clean(o.number) || undefined,
        notes: clean(o.notes) || undefined,
      }
    }
    case 'bullets': {
      const title = clean(o.title)
      const bullets = asStringArray(o.bullets ?? o.points, 7)
      if (!title || !bullets.length) return null
      return {
        kind: 'bullets',
        title,
        kicker: clean(o.kicker) || undefined,
        intro: clean(o.intro) || undefined,
        bullets,
        notes: clean(o.notes) || undefined,
        imageQuery: clean(o.imageQuery) || undefined,
      }
    }
    case 'two-col': {
      const title = clean(o.title)
      const leftRaw = (o.left ?? {}) as Record<string, unknown>
      const rightRaw = (o.right ?? {}) as Record<string, unknown>
      const left = { heading: clean(leftRaw.heading), bullets: asStringArray(leftRaw.bullets, 6) }
      const right = { heading: clean(rightRaw.heading), bullets: asStringArray(rightRaw.bullets, 6) }
      if (!title || !left.bullets.length || !right.bullets.length) return null
      return { kind: 'two-col', title, kicker: clean(o.kicker) || undefined, left, right, notes: clean(o.notes) || undefined }
    }
    case 'quote': {
      const quote = clean(o.quote)
      if (!quote) return null
      return { kind: 'quote', quote, author: clean(o.author) || undefined, context: clean(o.context) || undefined, notes: clean(o.notes) || undefined }
    }
    case 'document': {
      const title = clean(o.title)
      const excerpt = cleanMultiline(o.excerpt ?? o.text)
      const source = clean(o.source)
      if (!title || !excerpt) return null
      return {
        kind: 'document',
        title,
        kicker: clean(o.kicker) || undefined,
        source: source || 'Document fourni',
        excerpt,
        questions: asStringArray(o.questions, 4),
        notes: clean(o.notes) || undefined,
        imageQuery: clean(o.imageQuery) || undefined,
      }
    }
    case 'timeline': {
      const title = clean(o.title)
      const events = asArray(o.events)
        .map((e) => {
          const ev = e as Record<string, unknown>
          return { date: clean(ev.date), label: clean(ev.label), desc: clean(ev.desc) || undefined }
        })
        .filter((e) => e.date && e.label)
        .slice(0, 7)
      if (!title || events.length < 2) return null
      return { kind: 'timeline', title, kicker: clean(o.kicker) || undefined, events, notes: clean(o.notes) || undefined }
    }
    case 'map': {
      const title = clean(o.title)
      const projection = clean(o.projection)
      if (!title) return null
      const proj = ['world', 'europe', 'france', 'mediterranee'].includes(projection)
        ? (projection as 'world' | 'europe' | 'france' | 'mediterranee')
        : 'europe'
      const points = asArray(o.points)
        .map((p) => {
          const pt = p as Record<string, unknown>
          return { name: clean(pt.name), lon: num(pt.lon), lat: num(pt.lat), label: clean(pt.label) || undefined }
        })
        .filter((p) => p.name && Math.abs(p.lon) <= 180 && Math.abs(p.lat) <= 90)
        .slice(0, 8)
      return {
        kind: 'map',
        title,
        kicker: clean(o.kicker) || undefined,
        projection: proj,
        highlight: asStringArray(o.highlight, 10),
        points,
        caption: clean(o.caption) || undefined,
        insight: clean(o.insight) || undefined,
        notes: clean(o.notes) || undefined,
      }
    }
    case 'chart': {
      const title = clean(o.title)
      const chartRaw = clean(o.chart)
      const chart = ['bar', 'hbar', 'line', 'pie'].includes(chartRaw) ? (chartRaw as 'bar' | 'hbar' | 'line' | 'pie') : 'bar'
      const categories = asStringArray(o.categories, 12)
      const series = asArray(o.series)
        .map((s) => {
          const ser = s as Record<string, unknown>
          return {
            name: clean(ser.name) || 'Série',
            values: asArray(ser.values).map((v) => num(v)).slice(0, categories.length),
          }
        })
        .filter((s) => s.values.length)
        .slice(0, 4)
      if (!title || !categories.length || !series.length) return null
      return {
        kind: 'chart',
        title,
        kicker: clean(o.kicker) || undefined,
        chart,
        categories,
        series,
        unit: clean(o.unit) || undefined,
        source: clean(o.source) || undefined,
        insight: clean(o.insight) || undefined,
        notes: clean(o.notes) || undefined,
      }
    }
    case 'table': {
      const title = clean(o.title)
      const columns = asStringArray(o.columns, 5)
      const rows = asArray(o.rows)
        .map((r) => asStringArray(r, 5))
        .filter((r) => r.length)
        .slice(0, 7)
      if (!title || columns.length < 2 || !rows.length) return null
      return {
        kind: 'table',
        title,
        kicker: clean(o.kicker) || undefined,
        columns,
        rows: rows.map((r) => columns.map((_, i) => r[i] ?? '')),
        source: clean(o.source) || undefined,
        notes: clean(o.notes) || undefined,
      }
    }
    case 'conclusion': {
      const title = clean(o.title) || 'Ce qu’il faut retenir'
      const points = asStringArray(o.points ?? o.bullets, 5)
      if (!points.length) return null
      return {
        kind: 'conclusion',
        title,
        points,
        takeaway: clean(o.takeaway) || undefined,
        notes: clean(o.notes) || undefined,
      }
    }
    default:
      return null
  }
}

/** Remplace une diapositive manquante par une version « puces » lisible. */
export const fallbackFor = (item: PlanItem): GenSlide => ({
  kind: 'bullets',
  title: item.title || 'Diapositive',
  bullets: [item.brief || 'Contenu à compléter.'],
})

export const normalizeDeck = (raw: unknown, plan: NormalizedPlan, subject: Subject, level: Level): DeckSpec => {
  const o = (raw ?? {}) as Record<string, unknown>
  const slides = asArray(o.slides)
    .map(normalizeGenSlide)
    .filter((s): s is GenSlide => Boolean(s))
  return {
    title: clean(o.title) || plan.title,
    subtitle: clean(o.subtitle) || plan.subtitle,
    problematique: clean(o.problematique) || plan.problematique,
    subject,
    level,
    slides,
  }
}
