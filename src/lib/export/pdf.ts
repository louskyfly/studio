/**
 * Export PDF : mise en page identique à l'éditeur.
 * Le texte reste vectoriel ; cartes, frises et graphiques sont rendus en
 * images haute résolution pour garantir la fidélité.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import {
  SLIDE_H,
  SLIDE_W,
  type Align,
  type ChartEl,
  type IconEl,
  type ImageEl,
  type MapEl,
  type Paragraph,
  type Presentation,
  type ShapeEl,
  type Slide,
  type TableEl,
  type TextEl,
  type TextStyle,
  type TimelineEl,
} from '../model'
import type { Theme } from '../themes'
import { dbGetAsset } from '../db'
import { chartSvg, iconSvg, loadMapFeatures, mapSvg, svgToPng, timelineSvg } from '../svg'

const PT = 0.75 // 1280 px → 960 pt
const PAGE_W = SLIDE_W * PT
const PAGE_H = SLIDE_H * PT

const hexToRgb = (hex: string): RGB => {
  const clean = hex.replace('#', '').trim()
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0').slice(0, 6)
  const v = parseInt(full, 16)
  return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255)
}

const sanitize = (text: string): string =>
  text
    .replace(/\u00a0/g, ' ')
    .replace(/[\u202f\u2009\u2007]/g, ' ')
    .replace(/[\u2011]/g, '-')
    .replace(/[\u{1f300}-\u{1faff}]/gu, '')
    .replace(/[\u{2600}-\u{27bf}]/gu, '')

interface FontFamily {
  r: PDFFont
  b: PDFFont
  i: PDFFont
  bi: PDFFont
}

interface FontSet {
  sans: FontFamily
  serif: FontFamily
}

const pickFonts = (family: string, fonts: FontSet): FontFamily =>
  /georgia|palatino|cambria|times|book/i.test(family) ? fonts.serif : fonts.sans

interface PlacedRun {
  text: string
  font: PDFFont
  size: number
  color: RGB
  width: number
}

interface PlacedLine {
  runs: PlacedRun[]
  width: number
  height: number
  gapAfter: number
  align: Align
  indent: number
}

const measure = (font: PDFFont, text: string, size: number): number => {
  try {
    return font.widthOfTextAtSize(sanitize(text), size)
  } catch {
    return text.length * size * 0.5
  }
}

const layoutParagraph = (
  p: Paragraph,
  style: TextStyle,
  maxWidth: number,
  baseFonts: FontFamily,
  accent: RGB,
  bulletIndent: number,
): PlacedLine[] => {
  const size = (style.fontSize ?? 24) * PT
  const lineHeight = size * (style.lineHeight ?? 1.4)
  const align = p.align ?? style.align
  const bullet = p.bullet ?? 'none'
  const indent = (p.level ?? 0) * 18 + (bullet !== 'none' ? bulletIndent : 0)
  const available = Math.max(20, maxWidth - indent)
  const lines: PlacedLine[] = []
  let current: PlacedRun[] = []
  let width = 0
  const lineIndent = indent

  const pushLine = (last: boolean) => {
    lines.push({ runs: current, width, height: lineHeight, gapAfter: last ? (p.spaceAfter ?? 0) * PT : 0, align, indent: lineIndent })
    current = []
    width = 0
  }

  if (bullet !== 'none') {
    const marker = bullet === 'number' ? '1.' : bullet === 'dash' ? '—' : '•'
    const mw = measure(baseFonts.b, marker, size)
    current.push({ text: marker, font: baseFonts.b, size, color: accent, width: mw })
    width += mw + size * 0.45
    current.push({ text: '', font: baseFonts.b, size, color: accent, width: size * 0.45 })
  }

  p.runs.forEach((run) => {
    const bold = run.bold ?? style.bold ?? false
    const italic = run.italic ?? style.italic ?? false
    const font = bold && italic ? baseFonts.bi : bold ? baseFonts.b : italic ? baseFonts.i : baseFonts.r
    const rsize = (run.size ?? style.fontSize) * PT
    const color = hexToRgb(run.color ?? style.color)
    const text = run.text.replace(/\n/g, ' \n ')
    const tokens = text.split(/(\n|\s+)/).filter((t) => t !== '')
    for (const token of tokens) {
      if (token === '\n') {
        pushLine(false)
        continue
      }
      if (/^\s+$/.test(token)) {
        if (current.length && width > 0) {
          const w = measure(font, ' ', rsize)
          current.push({ text: ' ', font, size: rsize, color, width: w })
          width += w
        }
        continue
      }
      const w = measure(font, token, rsize)
      if (width + w > available && width > 0) {
        // retire l'espace final de la ligne précédente
        const last = current[current.length - 1]
        if (last && last.text === ' ') {
          width -= last.width
          current.pop()
        }
        pushLine(false)
      }
      current.push({ text: token, font, size: rsize, color, width: w })
      width += w
    }
  })
  if (current.length || !lines.length) pushLine(true)
  else if (lines.length) lines[lines.length - 1].gapAfter = (p.spaceAfter ?? 0) * PT
  return lines
}

const drawTextBlock = (
  page: PDFPage,
  el: TextEl,
  fonts: FontSet,
  accent: RGB,
) => {
  const base = pickFonts(el.style.fontFamily, fonts)
  const pad = (el.padding ?? 0) * PT
  const boxX = el.x * PT
  const boxY = PAGE_H - (el.y + el.h) * PT
  const maxWidth = el.w * PT - pad * 2
  if (el.fill) {
    page.drawRectangle({ x: boxX, y: boxY, width: el.w * PT, height: el.h * PT, color: hexToRgb(el.fill), opacity: el.opacity ?? 1 })
  }

  const bulletIndent = el.style.fontSize * PT * 0.9
  const lines = el.paragraphs.flatMap((p) => layoutParagraph(p, el.style, maxWidth, base, accent, bulletIndent))
  const total = lines.reduce((a, l) => a + l.height + l.gapAfter, 0)
  const contentH = el.h * PT - pad * 2
  const offset =
    el.style.valign === 'middle' ? Math.max(0, (contentH - total) / 2) : el.style.valign === 'bottom' ? Math.max(0, contentH - total) : 0

  let cursor = PAGE_H - el.y * PT - pad - offset
  for (const line of lines) {
    let x = boxX + pad + line.indent
    const lineW = line.width
    if (line.align === 'center') x = boxX + pad + (maxWidth - lineW) / 2
    else if (line.align === 'right') x = boxX + pad + maxWidth - lineW
    for (const r of line.runs) {
      if (r.text) {
        try {
          page.drawText(sanitize(r.text), {
            x,
            y: cursor - r.size * 0.8,
            size: r.size,
            font: r.font,
            color: r.color,
            opacity: el.opacity ?? 1,
          })
        } catch {
          /* glyphe non supporté */
        }
      }
      x += r.width
    }
    cursor -= line.height + line.gapAfter
  }
}

const drawShape = (page: PDFPage, el: ShapeEl) => {
  const x = el.x * PT
  const y = PAGE_H - (el.y + el.h) * PT
  const w = el.w * PT
  const h = el.h * PT
  const fill = el.fill && el.fill !== 'transparent' ? hexToRgb(el.fill) : undefined
  const stroke = el.stroke && el.stroke !== 'transparent' ? hexToRgb(el.stroke) : undefined
  const sw = (el.strokeWidth ?? 0) * PT

  if (el.shape === 'line' || el.shape === 'divider' || el.shape === 'arrow') {
    const color = hexToRgb(el.stroke ?? el.fill ?? '#000000')
    const cy = y + h / 2
    page.drawLine({ start: { x, y: cy }, end: { x: x + w, y: cy }, thickness: Math.max(0.5, el.strokeWidth ?? 2), color, opacity: el.opacity ?? 1 })
    if (el.shape === 'arrow') {
      const s = 4 + (el.strokeWidth ?? 2)
      page.drawSvgPath(`M 0 0 L ${s} ${s / 2} L 0 ${s} z`, { x: x + w - s, y: cy + s / 2, color })
    }
    return
  }
  if (el.shape === 'ellipse') {
    page.drawEllipse({ x: x + w / 2, y: y + h / 2, xScale: w / 2, yScale: h / 2, color: fill, borderColor: stroke, borderWidth: sw, opacity: el.opacity ?? 1 })
    return
  }
  if (el.shape === 'roundRect') {
    page.drawRectangle({ x, y, width: w, height: h, color: fill, borderColor: stroke, borderWidth: sw, opacity: el.opacity ?? 1 })
    return
  }
  if (el.shape === 'triangle' || el.shape === 'chevron' || el.shape === 'star' || el.shape === 'bracket') {
    let d = ''
    if (el.shape === 'triangle') d = `M ${w / 2} 0 L ${w} ${h} L 0 ${h} Z`
    else if (el.shape === 'chevron') d = `M 0 0 L ${w * 0.72} 0 L ${w} ${h / 2} L ${w * 0.72} ${h} L 0 ${h} L ${w * 0.28} ${h / 2} Z`
    else if (el.shape === 'star') {
      const pts: string[] = []
      const outer = Math.min(w, h) / 2
      const inner = outer * 0.45
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outer : inner
        const a = (Math.PI / 5) * i - Math.PI / 2
        pts.push(`${w / 2 + r * Math.cos(a)} ${h / 2 + r * Math.sin(a)}`)
      }
      d = `M ${pts.join(' L ')} Z`
    } else {
      d = `M ${w} 0 L 0 0 L 0 ${h} L ${w} ${h}`
    }
    page.drawSvgPath(d, {
      x,
      y: y + h,
      color: el.shape === 'bracket' ? undefined : fill,
      borderColor: el.shape === 'bracket' ? stroke ?? fill : stroke,
      borderWidth: el.shape === 'bracket' ? Math.max(1, el.strokeWidth ?? 3) : sw,
      opacity: el.opacity ?? 1,
    })
    return
  }
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: fill,
    borderColor: stroke,
    borderWidth: sw,
    opacity: el.opacity ?? 1,
  })
}

const drawImage = async (pdf: PDFDocument, page: PDFPage, el: ImageEl) => {
  const asset = await dbGetAsset(el.assetId)
  if (!asset) return
  const bytes = new Uint8Array(await asset.blob.arrayBuffer())
  let img
  try {
    img = asset.mime.includes('png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
  } catch {
    return
  }
  const x = el.x * PT
  const y = PAGE_H - (el.y + el.h) * PT
  const w = el.w * PT
  const h = el.h * PT
  // « cover » : recadrage centré
  if (el.fit === 'cover') {
    const scale = Math.max(w / img.width, h / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    page.drawImage(img, { x: x - (dw - w) / 2, y: y - (dh - h) / 2, width: dw, height: dh, opacity: el.opacity ?? 1 })
  } else {
    const scale = Math.min(w / img.width, h / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    page.drawImage(img, { x: x + (w - dw) / 2, y: y + (h - dh) / 2, width: dw, height: dh, opacity: el.opacity ?? 1 })
  }
}

const drawTable = (page: PDFPage, el: TableEl, fonts: FontSet) => {
  const base = pickFonts(el.fontFamily, fonts)
  const total = el.columns.reduce((a, c) => a + (c.width ?? 1), 0)
  const x = el.x * PT
  const top = PAGE_H - el.y * PT
  const widths = el.columns.map((c) => ((c.width ?? 1) / total) * el.w * PT)
  const rowH = (el.h * PT) / (el.rows.length + 1)
  const fs = el.fontSize * PT

  // en-tête
  page.drawRectangle({ x, y: top - rowH, width: el.w * PT, height: rowH, color: hexToRgb(el.headerFill) })
  let cx = x
  el.columns.forEach((c, i) => {
    page.drawText(sanitize(c.label), {
      x: cx + 5,
      y: top - rowH + rowH / 2 - fs * 0.35,
      size: fs,
      font: base.b,
      color: hexToRgb(el.headerColor),
    })
    cx += widths[i]
  })

  // corps
  el.rows.forEach((row, ri) => {
    const ry = top - rowH * (ri + 2)
    if (el.zebra && ri % 2 === 1) page.drawRectangle({ x, y: ry, width: el.w * PT, height: rowH, color: hexToRgb('#F7F6F3') })
    let x2 = x
    row.forEach((cell, ci) => {
      const font = el.firstColBold && ci === 0 ? base.b : base.r
      const maxW = widths[ci] - 10
      const words = sanitize(cell).split(/\s+/)
      const lines: string[] = []
      let cur = ''
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w
        if (measure(font, test, fs) > maxW && cur) {
          lines.push(cur)
          cur = w
        } else cur = test
      }
      if (cur) lines.push(cur)
      lines.slice(0, Math.max(1, Math.floor(rowH / (fs * 1.2)))).forEach((line, li) => {
        page.drawText(line, {
          x: x2 + 5,
          y: ry + rowH - fs * 1.15 - li * fs * 1.25,
          size: fs,
          font,
          color: hexToRgb(el.bodyColor),
        })
      })
      x2 += widths[ci]
    })
    page.drawLine({ start: { x, y: ry }, end: { x: x + el.w * PT, y: ry }, thickness: 0.6, color: hexToRgb(el.borderColor) })
  })

  // bordures verticales
  let vx = x
  page.drawLine({ start: { x, y: top }, end: { x, y: top - rowH * (el.rows.length + 1) }, thickness: 0.6, color: hexToRgb(el.borderColor) })
  for (const w of widths) {
    vx += w
    page.drawLine({ start: { x: vx, y: top }, end: { x: vx, y: top - rowH * (el.rows.length + 1) }, thickness: 0.6, color: hexToRgb(el.borderColor) })
  }
}

const drawRasterized = async (pdf: PDFDocument, page: PDFPage, el: MapEl | ChartEl | TimelineEl | IconEl, svg: string) => {
  const dataUrl = await svgToPng(svg, el.w, el.h, 2)
  const base64 = dataUrl.split(',')[1]
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const img = await pdf.embedPng(bytes)
  page.drawImage(img, {
    x: el.x * PT,
    y: PAGE_H - (el.y + el.h) * PT,
    width: el.w * PT,
    height: el.h * PT,
    opacity: el.opacity ?? 1,
  })
}

const drawBackground = async (pdf: PDFDocument, page: PDFPage, slide: Slide): Promise<boolean> => {
  const bg = slide.background
  if (bg.type === 'solid') {
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: hexToRgb(bg.color) })
    return true
  }
  if (bg.type === 'image') {
    const asset = await dbGetAsset(bg.assetId)
    if (asset) {
      const bytes = new Uint8Array(await asset.blob.arrayBuffer())
      try {
        const img = asset.mime.includes('png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
        const scale = Math.max(PAGE_W / img.width, PAGE_H / img.height)
        page.drawImage(img, { x: (PAGE_W - img.width * scale) / 2, y: (PAGE_H - img.height * scale) / 2, width: img.width * scale, height: img.height * scale })
        if (bg.overlay) page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: hexToRgb(bg.overlayColor ?? '#000000'), opacity: bg.overlay })
        return true
      } catch {
        /* ignore */
      }
    }
    return false
  }
  // dégradé / motif : rendu canvas puis image
  const svg =
    bg.type === 'gradient'
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="${SLIDE_W}" height="${SLIDE_H}"><defs><linearGradient id="g" gradientTransform="rotate(${bg.angle} .5 .5)"><stop offset="0" stop-color="${bg.from}"/><stop offset="1" stop-color="${bg.to}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="${SLIDE_W}" height="${SLIDE_H}"><rect width="100%" height="100%" fill="${bg.base}"/></svg>`
  const dataUrl = await svgToPng(svg, SLIDE_W, SLIDE_H, 1.5)
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0))
  const img = await pdf.embedPng(bytes)
  page.drawImage(img, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
  return true
}

export const exportPdf = async (
  doc: Presentation,
  theme: Theme,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> => {
  const pdf = await PDFDocument.create()
  pdf.setTitle(doc.title)
  pdf.setAuthor('Studio')
  pdf.setSubject(doc.subject)
  pdf.setCreator('Studio — présentations pédagogiques')
  pdf.setLanguage('fr-FR')

  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique)
  const boldItalic = await pdf.embedFont(StandardFonts.HelveticaBoldOblique)
  const serifR = await pdf.embedFont(StandardFonts.TimesRoman)
  const serifB = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const serifI = await pdf.embedFont(StandardFonts.TimesRomanItalic)
  const serifBI = await pdf.embedFont(StandardFonts.TimesRomanBoldItalic)
  const fonts: FontSet = {
    sans: { r: regular, b: bold, i: italic, bi: boldItalic },
    serif: { r: serifR, b: serifB, i: serifI, bi: serifBI },
  }

  const needsMaps = doc.slides.some((s) => s.elements.some((e) => e.type === 'map'))
  const mapFeatures = needsMaps ? await loadMapFeatures() : null

  let done = 0
  for (const [slideIndex, slide] of doc.slides.entries()) {
    const page = pdf.addPage([PAGE_W, PAGE_H])
    await drawBackground(pdf, page, slide)
    for (const el of slide.elements) {
      if (el.type === 'text') drawTextBlock(page, el, fonts, hexToRgb(theme.accent))
      else if (el.type === 'image') await drawImage(pdf, page, el)
      else if (el.type === 'shape') drawShape(page, el)
      else if (el.type === 'table') drawTable(page, el, fonts)
      else if (el.type === 'chart') await drawRasterized(pdf, page, el, chartSvg(el, el.w, el.h, {
        font: theme.bodyFont,
        ink: theme.ink,
        muted: theme.muted,
        line: theme.line,
        bg: theme.bg,
        accent: theme.accent,
        palette: theme.palette,
      }))
      else if (el.type === 'timeline') await drawRasterized(pdf, page, el, timelineSvg(el, el.w, el.h))
      else if (el.type === 'map' && mapFeatures) await drawRasterized(pdf, page, el, mapSvg(el, el.w, el.h, mapFeatures))
      else if (el.type === 'icon') await drawRasterized(pdf, page, el, iconSvg(el.icon, el.color, el.strokeWidth, Math.min(el.w, el.h)))
    }
    if ((doc.options?.showSlideNumbers ?? true) && slideIndex > 0) {
      const label = `${slideIndex + 1} / ${doc.slides.length}`
      const size = 8.25
      const w = fonts.sans.r.widthOfTextAtSize(label, size)
      page.drawText(label, { x: PAGE_W - 63 - w, y: 26, size, font: fonts.sans.r, color: hexToRgb(theme.muted) })
    }
    done++
    onProgress?.(done, doc.slides.length)
  }

  const bytes = await pdf.save()
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
}

/** Vérifie qu'un export contient bien le nombre de pages attendu. */
export const pdfPageCount = async (blob: Blob): Promise<number> => {
  try {
    const doc = await PDFDocument.load(await blob.arrayBuffer())
    return doc.getPageCount()
  } catch {
    return 0
  }
}
