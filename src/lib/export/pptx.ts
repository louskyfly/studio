/**
 * Export PowerPoint réellement éditable.
 *
 * Textes → zones de texte natives, images → images, formes → formes,
 * tableaux → tableaux, graphiques → graphiques PowerPoint.
 * Cartes, frises et icônes, qui sont des compositions vectorielles
 * propres à Studio, sont exportées en images haute résolution.
 */
import pptxgen from 'pptxgenjs'
import type { Presentation, Slide, TableEl, TextEl, ChartEl, TimelineEl, MapEl, IconEl, ImageEl, ShapeEl } from '../model'
import type { Theme } from '../themes'
import { SLIDE_H, SLIDE_W } from '../model'
import { assetDataUrl } from '../db'
import { iconSvg, loadMapFeatures, mapSvg, svgToPng } from '../svg'
const IN = (px: number) => px / 96
const PT = (px: number) => px * 0.75
const hex = (c?: string): string => (c ?? '#000000').replace('#', '').toUpperCase().slice(0, 6)

type Pptx = InstanceType<typeof pptxgen>

const backgroundData = async (slide: Slide): Promise<{ color: string } | { data: string } | null> => {
  const bg = slide.background
  if (bg.type === 'solid') return { color: hex(bg.color) }
  if (bg.type === 'image') {
    const data = await assetDataUrl(bg.assetId)
    if (data) return { data }
    return { color: 'FFFFFF' }
  }
  if (bg.type === 'gradient') {
    const canvas = document.createElement('canvas')
    canvas.width = SLIDE_W
    canvas.height = SLIDE_H
    const ctx = canvas.getContext('2d')!
    const angle = (bg.angle * Math.PI) / 180
    const x = Math.cos(angle)
    const y = Math.sin(angle)
    const grad = ctx.createLinearGradient(
      SLIDE_W / 2 - (x * SLIDE_W) / 2,
      SLIDE_H / 2 - (y * SLIDE_H) / 2,
      SLIDE_W / 2 + (x * SLIDE_W) / 2,
      SLIDE_H / 2 + (y * SLIDE_H) / 2,
    )
    grad.addColorStop(0, bg.from)
    grad.addColorStop(1, bg.to)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, SLIDE_W, SLIDE_H)
    return { data: canvas.toDataURL('image/png') }
  }
  if (bg.type === 'pattern') {
    const canvas = document.createElement('canvas')
    canvas.width = SLIDE_W
    canvas.height = SLIDE_H
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = bg.base
    ctx.fillRect(0, 0, SLIDE_W, SLIDE_H)
    ctx.fillStyle = bg.color
    if (bg.variant === 'dots') {
      for (let y = 0; y < SLIDE_H; y += 22) for (let x = 0; x < SLIDE_W; x += 22) {
        ctx.beginPath()
        ctx.arc(x, y, 1.1, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (bg.variant === 'grid') {
      ctx.strokeStyle = bg.color
      ctx.lineWidth = 1
      for (let x = 0; x < SLIDE_W; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, SLIDE_H)
        ctx.stroke()
      }
      for (let y = 0; y < SLIDE_H; y += 40) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(SLIDE_W, y)
        ctx.stroke()
      }
    } else {
      ctx.strokeStyle = bg.color
      ctx.lineWidth = 1
      for (let i = -SLIDE_H; i < SLIDE_W; i += 12) {
        ctx.beginPath()
        ctx.moveTo(i, SLIDE_H)
        ctx.lineTo(i + SLIDE_H, 0)
        ctx.stroke()
      }
    }
    return { data: canvas.toDataURL('image/png') }
  }
  return null
}

const addTextElement = (slide: any, el: TextEl) => {
  const runs: any[] = []
  const baseSize = el.style.fontSize * 0.75
  el.paragraphs.forEach((p, pi) => {
    const align = p.align ?? el.style.align
    const bulletOpt = p.bullet && p.bullet !== 'none' ? (p.bullet === 'number' ? { type: 'number' as const } : { code: p.bullet === 'dash' ? '2013' : '2022' }) : undefined
    if (!p.runs.length) {
      runs.push({
        text: ' ',
        options: {
          breakLine: pi < el.paragraphs.length - 1,
          fontSize: baseSize,
          color: hex(el.style.color),
          fontFace: el.style.fontFamily,
          align: align === 'justify' ? 'justify' : align,
        },
      })
      return
    }
    p.runs.forEach((r, ri) => {
      runs.push({
        text: r.text,
        options: {
          bold: r.bold ?? el.style.bold ?? false,
          italic: r.italic ?? el.style.italic ?? false,
          underline: r.underline ?? el.style.underline ? { style: 'sng' } : undefined,
          color: hex(r.color ?? el.style.color),
          fontSize: PT(r.size ?? el.style.fontSize),
          fontFace: r.font ?? el.style.fontFamily,
          align: align === 'justify' ? 'justify' : align,
          breakLine: ri === p.runs.length - 1 && pi < el.paragraphs.length - 1,
          ...(ri === 0 && bulletOpt ? { bullet: bulletOpt } : {}),
          indentLevel: p.level ?? 0,
        },
      })
    })
  })

  slide.addText(runs, {
    x: IN(el.x),
    y: IN(el.y),
    w: IN(el.w),
    h: IN(el.h),
    margin: 0,
    valign: el.style.valign === 'middle' ? 'middle' : el.style.valign === 'bottom' ? 'bottom' : 'top',
    align: el.style.align === 'justify' ? 'justify' : el.style.align,
    fontFace: el.style.fontFamily,
    fontSize: baseSize,
    color: hex(el.style.color),
    lineSpacing: Math.max(8, baseSize * el.style.lineHeight),
    charSpacing: el.style.letterSpacing ? el.style.letterSpacing * 0.75 : undefined,
    wrap: true,
    fit: 'shrink',
    ...(el.fill ? { fill: { color: hex(el.fill) } } : {}),
    ...(el.padding ? { inset: IN(el.padding) } : {}),
  })
}

const addImageElement = async (slide: any, el: ImageEl) => {
  const data = await assetDataUrl(el.assetId)
  if (!data) return
  slide.addImage({
    data,
    x: IN(el.x),
    y: IN(el.y),
    w: IN(el.w),
    h: IN(el.h),
    ...(el.fit === 'cover' ? { sizing: { type: 'cover' as const, w: IN(el.w), h: IN(el.h) } } : { sizing: { type: 'contain' as const, w: IN(el.w), h: IN(el.h) } }),
    ...(el.rotation ? { rotate: el.rotation } : {}),
  })
  if (el.credit) {
    slide.addText(el.credit, {
      x: IN(el.x + 6),
      y: IN(el.y + el.h - 20),
      w: IN(el.w - 12),
      h: IN(14),
      fontSize: 7,
      color: 'FFFFFF',
      align: 'left',
      margin: 0,
    })
  }
}

const SHAPE_MAP: Record<string, string> = {
  rect: 'rect',
  roundRect: 'roundRect',
  ellipse: 'ellipse',
  line: 'line',
  arrow: 'line',
  triangle: 'triangle',
  chevron: 'chevron',
  star: 'star5',
  divider: 'line',
  bracket: 'line',
}

const addShapeElement = (slide: any, el: ShapeEl) => {
  const type = SHAPE_MAP[el.shape] ?? 'rect'
  const pptxShape = type as never
  const isLine = el.shape === 'line' || el.shape === 'arrow' || el.shape === 'divider'
  slide.addShape(pptxShape, {
    x: IN(el.x),
    y: isLine ? IN(el.y + el.h / 2) : IN(el.y),
    w: IN(el.w),
    h: isLine ? 0 : IN(el.h),
    ...(isLine
      ? { line: { color: hex(el.stroke ?? el.fill), width: Math.max(0.5, PT(el.strokeWidth ?? 2)), ...(el.shape === 'arrow' ? { endArrowType: 'triangle' as const } : {}) } }
      : {
          fill: el.fill ? { color: hex(el.fill), transparency: Math.round((1 - (el.opacity ?? 1)) * 100) } : { color: 'FFFFFF', transparency: 100 },
          line: el.stroke && el.stroke !== 'transparent' ? { color: hex(el.stroke), width: PT(el.strokeWidth ?? 1) } : { color: hex(el.fill ?? '#FFFFFF'), width: 0 },
          ...(el.shape === 'roundRect' ? { rectRadius: IN(el.radius ?? 10) } : {}),
        }),
    ...(el.rotation ? { rotate: el.rotation } : {}),
  })
}

const addTableElement = (slide: any, el: TableEl) => {
  const head: any[] = el.columns.map((c) => ({
    text: c.label,
    options: {
      bold: true,
      color: hex(el.headerColor),
      fill: { color: hex(el.headerFill) },
      fontSize: PT(el.fontSize),
      fontFace: el.fontFamily,
      align: 'left',
      valign: 'middle',
    },
  }))
  const body: any[][] = el.rows.map((row, ri) =>
    row.map((cell, ci) => ({
      text: cell,
      options: {
        color: hex(el.bodyColor),
        fill: { color: el.zebra && ri % 2 === 1 ? 'F7F6F3' : 'FFFFFF' },
        fontSize: PT(el.fontSize),
        fontFace: el.fontFamily,
        bold: Boolean(el.firstColBold && ci === 0),
        align: 'left',
        valign: 'top',
      },
    })),
  )
  const total = el.columns.reduce((a, c) => a + (c.width ?? 1), 0)
  slide.addTable([head, ...body], {
    x: IN(el.x),
    y: IN(el.y),
    w: IN(el.w),
    colW: el.columns.map((c) => IN((el.w * (c.width ?? 1)) / total)),
    rowH: IN(el.h / (el.rows.length + 1)),
    border: { type: 'solid', pt: 0.6, color: hex(el.borderColor) },
    margin: 0.06,
    autoPage: false,
    valign: 'top',
  })
}

const CHART_MAP: Record<string, string> = {
  bar: 'bar',
  hbar: 'bar',
  line: 'line',
  area: 'area',
  pie: 'pie',
  donut: 'doughnut',
}

const addChartElement = (slide: any, el: ChartEl) => {
  const data = el.series.map((s) => ({
    name: s.name,
    labels: el.categories,
    values: s.values.map((v) => v ?? 0),
  }))
  const chartType = (CHART_MAP[el.chart] ?? 'bar') as never
  slide.addChart(chartType, data, {
    x: IN(el.x),
    y: IN(el.y),
    w: IN(el.w),
    h: IN(el.h),
    barDir: el.chart === 'hbar' ? 'bar' : 'col',
    barGrouping: 'clustered',
    showLegend: el.legend !== false && el.series.length > 1,
    legendPos: 'b',
    legendFontSize: 9,
    showValue: Boolean(el.valueLabels),
    dataLabelFontSize: 8,
    catAxisLabelFontSize: 9,
    valAxisLabelFontSize: 9,
    catAxisLabelColor: hex('#71767D'),
    valAxisLabelColor: hex('#71767D'),
    catAxisLineShow: false,
    valAxisLineShow: false,
    valGridLine: { color: 'E5E1D9', size: 1 },
    chartColors: el.series.map((s, i) => hex(s.color ?? ['1F3A5F', 'B08A4A', '6D8AA8', '8C6A5D'][i % 4])),
    showTitle: false,
    ...(el.unit ? { valAxisTitle: el.unit, showValAxisTitle: true, valAxisTitleFontSize: 9 } : {}),
  })
}

const addTimelineElement = (slide: any, el: TimelineEl) => {
  const accent = hex(el.accent)
  const ink = hex(el.ink)
  if (el.orientation === 'vertical') {
    slide.addShape('line' as never, {
      x: IN(el.x + 110),
      y: IN(el.y + 10),
      w: 0,
      h: IN(el.h - 20),
      line: { color: accent, width: 1.5 },
    })
  } else {
    slide.addShape('line' as never, {
      x: IN(el.x + 20),
      y: IN(el.y + el.h * 0.52),
      w: IN(el.w - 40),
      h: 0,
      line: { color: accent, width: 1.5 },
    })
  }
  const step = el.orientation === 'vertical' ? el.h / Math.max(1, el.events.length) : el.w / Math.max(1, el.events.length)
  el.events.forEach((e, i) => {
    if (el.orientation === 'vertical') {
      const cy = el.y + step * i + step / 2
      slide.addShape('ellipse' as never, {
        x: IN(el.x + 106),
        y: IN(cy - 4),
        w: IN(8),
        h: IN(8),
        fill: { color: accent },
        line: { color: accent, width: 0 },
      })
      slide.addText(e.date, { x: IN(el.x), y: IN(cy - 12), w: IN(96), h: IN(20), align: 'right', fontSize: 12, bold: true, color: accent, margin: 0 })
      slide.addText(e.label, { x: IN(el.x + 128), y: IN(cy - 12), w: IN(el.w - 140), h: IN(20), fontSize: 13, color: ink, margin: 0 })
      if (e.desc) slide.addText(e.desc, { x: IN(el.x + 128), y: IN(cy + 8), w: IN(el.w - 140), h: IN(18), fontSize: 10, color: hex(el.muted), margin: 0 })
    } else {
      const x = el.x + step * i + step / 2
      slide.addShape('ellipse' as never, {
        x: IN(x - 4),
        y: IN(el.y + el.h * 0.52 - 4),
        w: IN(8),
        h: IN(8),
        fill: { color: 'FFFFFF' },
        line: { color: accent, width: 1.5 },
      })
      const above = i % 2 === 0
      slide.addText(e.date, {
        x: IN(x - step / 2),
        y: IN(above ? el.y + el.h * 0.52 - 46 : el.y + el.h * 0.52 + 16),
        w: IN(step),
        h: IN(18),
        align: 'center',
        fontSize: 12,
        bold: true,
        color: accent,
        margin: 0,
      })
      slide.addText(e.label, {
        x: IN(x - step / 2),
        y: IN(above ? el.y + el.h * 0.52 - 70 : el.y + el.h * 0.52 + 38),
        w: IN(step),
        h: IN(26),
        align: 'center',
        fontSize: 11,
        color: ink,
        margin: 0,
        fit: 'shrink',
      })
    }
  })
}

const addSvgElement = async (slide: any, el: MapEl | ChartEl | TimelineEl | IconEl, svg: string) => {
  const png = await svgToPng(svg, el.w, el.h, 2)
  slide.addImage({ data: png, x: IN(el.x), y: IN(el.y), w: IN(el.w), h: IN(el.h) })
}

export const exportPptx = async (
  doc: Presentation,
  theme: Theme,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> => {
  const pptx: Pptx = new pptxgen()
  pptx.defineLayout({ name: 'STUDIO_16x9', width: IN(SLIDE_W), height: IN(SLIDE_H) })
  pptx.layout = 'STUDIO_16x9'
  pptx.author = 'Studio'
  pptx.company = 'Studio'
  pptx.title = doc.title
  pptx.subject = doc.subject
  pptx.theme = {
    headFontFace: theme.headingFont,
    bodyFontFace: theme.bodyFont,
  }

  const mapFeatures = doc.slides.some((s) => s.elements.some((e) => e.type === 'map')) ? await loadMapFeatures() : null

  let done = 0
  for (const [slideIndex, s] of doc.slides.entries()) {
    const slide = pptx.addSlide()
    const bg = await backgroundData(s)
    if (bg && 'data' in bg) {
      slide.background = { data: bg.data }
    } else if (bg && 'color' in bg) {
      slide.background = { color: bg.color }
    }
    if (s.notes) slide.addNotes(s.notes)

    for (const el of s.elements) {
      if (el.type === 'text') addTextElement(slide, el)
      else if (el.type === 'image') await addImageElement(slide, el)
      else if (el.type === 'shape') addShapeElement(slide, el)
      else if (el.type === 'table') addTableElement(slide, el)
      else if (el.type === 'chart') addChartElement(slide, el)
      else if (el.type === 'timeline') addTimelineElement(slide, el)
      else if (el.type === 'map' && mapFeatures) await addSvgElement(slide, el, mapSvg(el, el.w, el.h, mapFeatures))
      else if (el.type === 'icon') await addSvgElement(slide, el, iconSvg(el.icon, el.color, el.strokeWidth, Math.min(el.w, el.h)))
    }

    if ((doc.options?.showSlideNumbers ?? true) && slideIndex > 0) {
      slide.addText(`${slideIndex + 1} / ${doc.slides.length}`, {
        x: IN(SLIDE_W - 180),
        y: IN(SLIDE_H - 48),
        w: IN(140),
        h: IN(20),
        align: 'right',
        fontSize: 8.25,
        color: hex(theme.muted),
        fontFace: theme.bodyFont,
        margin: 0,
      })
    }
    done++
    onProgress?.(done, doc.slides.length)
  }

  const out = await pptx.write({ outputType: 'blob' })
  return out as Blob
}
