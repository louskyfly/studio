/**
 * Générateurs SVG partagés par l'éditeur, la présentation et les exports.
 * Un seul rendu = une seule source de vérité pour l'écran et le PPTX/PDF.
 */
import {
  Anchor,
  ArrowRight,
  BookOpen,
  Building,
  Castle,
  ChartColumn,
  Church,
  Clock,
  Coins,
  Compass,
  Crown,
  Droplet,
  Earth,
  Factory,
  Flag,
  Gavel,
  GraduationCap,
  Handshake,
  Hourglass,
  Landmark,
  Leaf,
  Lightbulb,
  Map,
  MapPin,
  Microscope,
  Mountain,
  Newspaper,
  PenTool,
  Quote,
  Route,
  Scale,
  ScrollText,
  Ship,
  Star,
  Sun,
  Swords,
  Target,
  Telescope,
  Users,
  Vote,
  Wheat,
  type IconNode,
} from 'lucide'
import { geoGraticule10, geoMercator, geoNaturalEarth1, geoPath } from 'd3-geo'
import type { ChartEl, MapEl, TimelineEl } from './model'

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const n = (v: number, d = 1): string => {
  const r = Math.round(v * 10 ** d) / 10 ** d
  return String(r)
}

export const svgDataUrl = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

export const svgToPng = (svg: string, width: number, height: number, scale = 2): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas indisponible'))
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('SVG illisible'))
    img.src = svgDataUrl(svg)
  })

const wrap = (text: string, size: number, maxWidth: number): string[] => {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  const perChar = size * 0.52
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word
    if (candidate.length * perChar > maxWidth && cur) {
      lines.push(cur)
      cur = word
    } else cur = candidate
  }
  if (cur) lines.push(cur)
  return lines
}

const truncate = (text: string, size: number, maxWidth: number): string => {
  const per = size * 0.55
  const max = Math.max(3, Math.floor(maxWidth / per))
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/* ------------------------------------------------------------------ */
/* Graphiques                                                          */
/* ------------------------------------------------------------------ */

export interface SvgTheme {
  font: string
  ink: string
  muted: string
  line: string
  bg: string
  accent: string
  palette: string[]
}

const niceScale = (rawMin: number, rawMax: number, count = 4): { min: number; max: number; step: number } => {
  let min = Math.min(0, rawMin)
  let max = Math.max(0, rawMax)
  if (max === min) max = min + 1
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(Math.abs(raw) || 1))
  const norm = raw / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step }
}

const polar = (cx: number, cy: number, r: number, angle: number): [number, number] => [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]

export const chartSvg = (el: ChartEl, w: number, h: number, theme: SvgTheme): string => {
  const fs = Math.max(9.5, Math.min(15, w / 52))
  const colors = el.colors?.length ? el.colors : theme.palette
  const titleH = el.title ? fs * 2.1 : 0
  const parts: string[] = []
  const push = (s: string) => parts.push(s)

  push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${esc(theme.font)}">`)
  push(`<rect width="${w}" height="${h}" fill="none"/>`)
  if (el.title) {
    push(`<text x="0" y="${fs * 1.15}" font-size="${fs * 1.05}" font-weight="600" fill="${esc(theme.ink)}">${esc(el.title)}</text>`)
  }

  if (el.chart === 'pie' || el.chart === 'donut') {
    const total = el.series[0]?.values.reduce<number>((a, v) => a + (v ?? 0), 0) ?? 0
    const legendW = el.legend === false ? 0 : Math.min(w * 0.42, 190)
    const size = Math.min(w - legendW - fs * 2, h - titleH - fs * 2)
    const cx = fs + size / 2
    const cy = titleH + fs + size / 2
    const rOuter = size / 2
    const rInner = el.chart === 'donut' ? rOuter * 0.58 : 0
    let a0 = -Math.PI / 2
    if (!total) {
      push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rOuter)}" fill="none" stroke="${esc(theme.line)}" stroke-width="1"/>`)
    }
    el.series[0]?.values.forEach((v, i) => {
      const frac = (v ?? 0) / (total || 1)
      const a1 = a0 + frac * Math.PI * 2
      if (frac <= 0) {
        a0 = a1
        return
      }
      const [x0, y0] = polar(cx, cy, rOuter, a0)
      const [x1, y1] = polar(cx, cy, rOuter, a1)
      const large = a1 - a0 > Math.PI ? 1 : 0
      let d = `M ${n(x0)} ${n(y0)} A ${n(rOuter)} ${n(rOuter)} 0 ${large} 1 ${n(x1)} ${n(y1)}`
      if (rInner) {
        const [xi1, yi1] = polar(cx, cy, rInner, a1)
        const [xi0, yi0] = polar(cx, cy, rInner, a0)
        d += ` L ${n(xi1)} ${n(yi1)} A ${n(rInner)} ${n(rInner)} 0 ${large} 0 ${n(xi0)} ${n(yi0)} Z`
      } else {
        d += ` L ${n(cx)} ${n(cy)} Z`
      }
      push(`<path d="${d}" fill="${esc(colors[i % colors.length])}"/>`)
      if (frac > 0.06) {
        const mid = (a0 + a1) / 2
        const rLabel = rInner ? (rInner + rOuter) / 2 : rOuter * 0.66
        const [lx, ly] = polar(cx, cy, rLabel, mid)
        push(
          `<text x="${n(lx)}" y="${n(ly + fs * 0.35)}" font-size="${fs * 0.85}" fill="#fff" text-anchor="middle" font-weight="600">${Math.round(frac * 100)}%</text>`,
        )
      }
      a0 = a1
    })
    if (legendW) {
      const lx = w - legendW + fs * 0.6
      let ly = titleH + fs * 1.4
      el.categories.forEach((c, i) => {
        push(`<rect x="${n(lx)}" y="${n(ly - fs * 0.62)}" width="${n(fs * 0.66)}" height="${n(fs * 0.66)}" rx="2" fill="${esc(colors[i % colors.length])}"/>`)
        push(`<text x="${n(lx + fs * 1.05)}" y="${n(ly)}" font-size="${fs * 0.82}" fill="${esc(theme.ink)}">${esc(truncate(c, fs * 0.82, legendW - fs * 2))}</text>`)
        ly += fs * 1.45
        if (ly > h - fs) return
      })
    }
  } else {
    const horizontal = el.chart === 'hbar'
    const legendH = el.legend === false || el.series.length < 2 ? 0 : fs * 1.7
    const sourceH = el.source ? fs * 1.3 : 0
    const m = {
      top: titleH + fs * 0.4,
      right: fs * 0.8,
      bottom: (horizontal ? fs * 1.2 : fs * 2.6 + legendH) + sourceH,
      left: horizontal ? Math.min(w * 0.32, fs * 7.5) : fs * 4.1,
    }
    const plotW = w - m.left - m.right
    const plotH = h - m.top - m.bottom
    const all = el.series.flatMap((s) => s.values).filter((v): v is number => typeof v === 'number')
    const scale = niceScale(Math.min(0, ...all), Math.max(0, ...all), 4)
    const min = scale.min
    const max = scale.max
    const range = max - min || 1
    const ticks = Math.max(1, Math.round((max - min) / scale.step))
    const tickLabel = (v: number) => n(v, Number.isInteger(scale.step) ? 0 : 1)

    const xOf = (v: number) => m.left + ((v - min) / range) * plotW
    const yOf = (v: number) => m.top + plotH - ((v - min) / range) * plotH

    // grille + axe des valeurs
    for (let i = 0; i <= ticks; i++) {
      const v = min + (range * i) / ticks
      if (horizontal) {
        const x = xOf(v)
        push(`<line x1="${n(x)}" y1="${n(m.top)}" x2="${n(x)}" y2="${n(m.top + plotH)}" stroke="${esc(theme.line)}" stroke-width="1"/>`)
        push(
          `<text x="${n(x)}" y="${n(m.top + plotH + fs * 1.15)}" font-size="${fs * 0.72}" fill="${esc(theme.muted)}" text-anchor="middle">${tickLabel(v)}</text>`,
        )
      } else {
        const y = yOf(v)
        push(`<line x1="${n(m.left)}" y1="${n(y)}" x2="${n(m.left + plotW)}" y2="${n(y)}" stroke="${esc(theme.line)}" stroke-width="1"/>`)
        push(`<text x="${n(m.left - fs * 0.5)}" y="${n(y + fs * 0.26)}" font-size="${fs * 0.72}" fill="${esc(theme.muted)}" text-anchor="end">${tickLabel(v)}</text>`)
      }
    }

    if (el.chart === 'line' || el.chart === 'area') {
      const step = plotW / Math.max(1, el.categories.length - 1)
      const xAt = (i: number) => (el.categories.length === 1 ? m.left + plotW / 2 : m.left + i * step)
      el.series.forEach((s, si) => {
        const pts = s.values.map((v, i) => [xAt(i), v == null ? null : yOf(v)] as const).filter((p): p is readonly [number, number] => p[1] != null)
        if (!pts.length) return
        const color = s.color ?? colors[si % colors.length]
        if (el.chart === 'area') {
          push(
            `<path d="M ${n(pts[0][0])} ${n(m.top + plotH)} ${pts.map((p) => `L ${n(p[0])} ${n(p[1])}`).join(' ')} L ${n(pts[pts.length - 1][0])} ${n(m.top + plotH)} Z" fill="${esc(color)}" opacity="0.14"/>`,
          )
        }
        push(`<path d="${pts.map((p, i) => `${i ? 'L' : 'M'} ${n(p[0])} ${n(p[1])}`).join(' ')}" fill="none" stroke="${esc(color)}" stroke-width="${Math.max(2, fs * 0.16)}" stroke-linejoin="round" stroke-linecap="round"/>`)
        pts.forEach((p) => push(`<circle cx="${n(p[0])}" cy="${n(p[1])}" r="${Math.max(2.4, fs * 0.19)}" fill="#fff" stroke="${esc(color)}" stroke-width="${Math.max(1.6, fs * 0.12)}"/>`))
      })
      el.categories.forEach((c, i) => {
        push(
          `<text x="${n(xAt(i))}" y="${n(h - legendH - fs * 0.5)}" font-size="${fs * 0.72}" fill="${esc(theme.muted)}" text-anchor="middle">${esc(truncate(c, fs * 0.72, step * 1.6))}</text>`,
        )
      })
    } else {
      const groups = el.categories.length
      const groupW = (horizontal ? plotH : plotW) / Math.max(1, groups)
      const barW = (groupW * 0.62) / Math.max(1, el.series.length)
      el.series.forEach((s, si) => {
        s.values.forEach((v, i) => {
          if (v == null) return
          const color = s.color ?? colors[si % colors.length]
          if (horizontal) {
            const y = m.top + i * groupW + groupW * 0.19 + si * barW
            const x0 = xOf(Math.min(0, v))
            const width = Math.abs(xOf(v) - xOf(0))
            push(`<rect x="${n(x0)}" y="${n(y)}" width="${n(Math.max(1, width))}" height="${n(barW * 0.82)}" rx="${n(Math.min(4, barW * 0.2))}" fill="${esc(color)}"/>`)
            if (el.valueLabels) {
              push(
                `<text x="${n(x0 + width + fs * 0.3)}" y="${n(y + barW * 0.62)}" font-size="${fs * 0.7}" fill="${esc(theme.muted)}">${n(v, 0)}</text>`,
              )
            }
          } else {
            const x = m.left + i * groupW + groupW * 0.19 + si * barW
            const y0 = yOf(Math.max(0, v))
            const height = Math.abs(yOf(v) - yOf(0))
            push(`<rect x="${n(x)}" y="${n(y0)}" width="${n(barW * 0.82)}" height="${n(Math.max(1, height))}" rx="${n(Math.min(4, barW * 0.2))}" fill="${esc(color)}"/>`)
            if (el.valueLabels) {
              push(
                `<text x="${n(x + barW * 0.41)}" y="${n(Math.min(y0, yOf(0)) - fs * 0.3)}" font-size="${fs * 0.7}" fill="${esc(theme.muted)}" text-anchor="middle">${n(v, 0)}</text>`,
              )
            }
          }
        })
      })
      el.categories.forEach((c, i) => {
        if (horizontal) {
          push(
            `<text x="${n(m.left - fs * 0.55)}" y="${n(m.top + i * groupW + groupW / 2 + fs * 0.26)}" font-size="${fs * 0.74}" fill="${esc(theme.muted)}" text-anchor="end">${esc(truncate(c, fs * 0.74, m.left - fs * 0.8))}</text>`,
          )
        } else {
          push(
            `<text x="${n(m.left + i * groupW + groupW / 2)}" y="${n(m.top + plotH + fs * 1.15)}" font-size="${fs * 0.74}" fill="${esc(theme.muted)}" text-anchor="middle">${esc(truncate(c, fs * 0.74, groupW * 1.7))}</text>`,
          )
        }
      })
    }

    if (el.unit) {
      push(
        `<text x="${n(m.left - fs * 0.4)}" y="${n(m.top - fs * 0.35)}" font-size="${fs * 0.66}" fill="${esc(theme.muted)}" text-anchor="end">${esc(el.unit)}</text>`,
      )
    }

    if (legendH) {
      let lx = m.left
      const ly = h - fs * 0.45
      el.series.forEach((s, si) => {
        const color = s.color ?? colors[si % colors.length]
        push(`<rect x="${n(lx)}" y="${n(ly - fs * 0.6)}" width="${n(fs * 0.6)}" height="${n(fs * 0.6)}" rx="2" fill="${esc(color)}"/>`)
        push(`<text x="${n(lx + fs * 0.85)}" y="${n(ly)}" font-size="${fs * 0.74}" fill="${esc(theme.muted)}">${esc(s.name)}</text>`)
        lx += fs * 0.85 + s.name.length * fs * 0.45 + fs * 1.4
      })
    }
  }

  if (el.source) {
    push(`<text x="${n(w)}" y="${n(h - 2)}" font-size="${fs * 0.62}" fill="${esc(theme.muted)}" text-anchor="end" opacity="0.8">Source : ${esc(el.source)}</text>`)
  }
  push('</svg>')
  return parts.join('')
}

/* ------------------------------------------------------------------ */
/* Frise chronologique                                                 */
/* ------------------------------------------------------------------ */

export const timelineSvg = (el: TimelineEl, w: number, h: number): string => {
  const parts: string[] = []
  const ink = el.ink
  const muted = el.muted
  const accent = el.accent
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${esc(el.fontFamily)}">`)

  if (el.orientation === 'vertical') {
    const n2 = el.events.length
    const pad = Math.max(10, w * 0.04)
    const lineX = pad + Math.min(110, w * 0.16)
    const top = 18
    const usable = h - 34
    const step = usable / Math.max(1, n2)
    parts.push(`<line x1="${n(lineX)}" y1="${n(top)}" x2="${n(lineX)}" y2="${n(top + usable)}" stroke="${esc(accent)}" stroke-width="2" opacity="0.35"/>`)
    el.events.forEach((e, i) => {
      const cy = top + step * i + step * 0.5
      parts.push(`<circle cx="${n(lineX)}" cy="${n(cy)}" r="${n(Math.min(6, step * 0.16))}" fill="${esc(accent)}"/>`)
      parts.push(`<text x="${n(lineX - 16)}" y="${n(cy - 2)}" text-anchor="end" font-size="${n(Math.min(16, Math.max(10, w * 0.026)))}" font-weight="700" fill="${esc(accent)}">${esc(e.date)}</text>`)
      const fs = Math.min(17, Math.max(10.5, w * 0.028))
      parts.push(`<text x="${n(lineX + 20)}" y="${n(cy - 1)}" font-size="${n(fs)}" font-weight="600" fill="${esc(ink)}">${esc(truncate(e.label, fs, w - lineX - 30))}</text>`)
      if (e.desc) {
        parts.push(`<text x="${n(lineX + 20)}" y="${n(cy + fs * 1.15)}" font-size="${n(fs * 0.78)}" fill="${esc(muted)}">${esc(truncate(e.desc, fs * 0.78, w - lineX - 30))}</text>`)
      }
    })
  } else {
    const pad = Math.max(14, w * 0.035)
    const cy = h * 0.52
    const n2 = el.events.length
    const step = (w - pad * 2) / Math.max(1, n2)
    const fsDate = Math.min(15, Math.max(9.5, w * 0.0165))
    const fsLabel = Math.min(15, Math.max(9.5, w * 0.0155))
    parts.push(`<line x1="${n(pad)}" y1="${n(cy)}" x2="${n(w - pad)}" y2="${n(cy)}" stroke="${esc(accent)}" stroke-width="2.5" opacity="0.4"/>`)
    el.events.forEach((e, i) => {
      const x = pad + step * i + step / 2
      const above = el.alternating === false ? true : i % 2 === 0
      parts.push(`<line x1="${n(x)}" y1="${n(cy)}" x2="${n(x)}" y2="${n(above ? cy - 18 : cy + 18)}" stroke="${esc(accent)}" stroke-width="1.5" opacity="0.55"/>`)
      parts.push(`<circle cx="${n(x)}" cy="${n(cy)}" r="5" fill="#fff" stroke="${esc(accent)}" stroke-width="2.5"/>`)
      const labelLines = wrap(e.label, fsLabel, step * 1.55).slice(0, 3)
      if (above) {
        let y = cy - 30
        parts.push(`<text x="${n(x)}" y="${n(y)}" text-anchor="middle" font-size="${n(fsDate)}" font-weight="700" fill="${esc(accent)}">${esc(e.date)}</text>`)
        y -= fsLabel * 1.25
        for (const line of labelLines.reverse()) {
          parts.push(`<text x="${n(x)}" y="${n(y)}" text-anchor="middle" font-size="${n(fsLabel)}" fill="${esc(ink)}">${esc(line)}</text>`)
          y -= fsLabel * 1.2
        }
      } else {
        let y = cy + 30
        parts.push(`<text x="${n(x)}" y="${n(y)}" text-anchor="middle" font-size="${n(fsDate)}" font-weight="700" fill="${esc(accent)}">${esc(e.date)}</text>`)
        y += fsLabel * 1.3
        for (const line of labelLines) {
          parts.push(`<text x="${n(x)}" y="${n(y)}" text-anchor="middle" font-size="${n(fsLabel)}" fill="${esc(ink)}">${esc(line)}</text>`)
          y += fsLabel * 1.2
        }
      }
    })
  }
  parts.push('</svg>')
  return parts.join('')
}

/* ------------------------------------------------------------------ */
/* Cartes                                                              */
/* ------------------------------------------------------------------ */

type CountryFeature = {
  type: 'Feature'
  id?: string | number
  properties: { name?: string }
  geometry: unknown
}

const ALIASES: Record<string, string> = {
  'etats-unis': 'united states of america',
  usa: 'united states of america',
  'royaume-uni': 'united kingdom',
  'allemagne de l ouest': 'germany',
  'republique democratique du congo': 'democratic republic of the congo',
  'coree du sud': 'south korea',
  'coree du nord': 'north korea',
  'afrique du sud': 'south africa',
  'nouvelle-zelande': 'new zealand',
  'arabie saoudite': 'saudi arabia',
  'emirats arabes unis': 'united arab emirates',
  'republique tcheque': 'czechia',
  'cote d ivoire': 'ivory coast',
  'burkina': 'burkina faso',
  'viet nam': 'vietnam',
  'laos': 'laos',
  'birmanie': 'myanmar',
  'myanmar': 'myanmar',
  'iran': 'iran',
  'irak': 'iraq',
  'syrie': 'syria',
  'liban': 'lebanon',
  'israel': 'israel',
  'palestine': 'palestine',
  'jordanie': 'jordan',
  'egypte': 'egypt',
  'maroc': 'morocco',
  'algerie': 'algeria',
  'tunisie': 'tunisia',
  'libye': 'libya',
  'mauritanie': 'mauritania',
  'mali': 'mali',
  'niger': 'niger',
  'tchad': 'chad',
  'soudan': 'sudan',
  'ethiopie': 'ethiopia',
  'kenya': 'kenya',
  'tanzanie': 'tanzania',
  'mozambique': 'mozambique',
  'madagascar': 'madagascar',
  'angola': 'angola',
  'zambie': 'zambia',
  'zimbabwe': 'zimbabwe',
  'namibie': 'namibia',
  'botswana': 'botswana',
  'senegal': 'senegal',
  'guinee': 'guinea',
  'cameroun': 'cameroon',
  'gabon': 'gabon',
  'congo': 'republic of the congo',
  'bresil': 'brazil',
  'argentine': 'argentina',
  'chili': 'chile',
  'perou': 'peru',
  'colombie': 'colombia',
  'venezuela': 'venezuela',
  'mexique': 'mexico',
  'cuba': 'cuba',
  'canada': 'canada',
  'australie': 'australia',
  'inde': 'india',
  'chine': 'china',
  'japon': 'japan',
  'coree': 'south korea',
  'indonesie': 'indonesia',
  'philippines': 'philippines',
  'pakistan': 'pakistan',
  'afghanistan': 'afghanistan',
  'kazakhstan': 'kazakhstan',
  'russie': 'russia',
  'ukraine': 'ukraine',
  'pologne': 'poland',
  'roumanie': 'romania',
  'bulgarie': 'bulgaria',
  'grece': 'greece',
  'turquie': 'turkey',
  'italie': 'italy',
  'espagne': 'spain',
  'portugal': 'portugal',
  'france': 'france',
  'belgique': 'belgium',
  'pays-bas': 'netherlands',
  'suisse': 'switzerland',
  'autriche': 'austria',
  'hongrie': 'hungary',
  'serbie': 'serbia',
  'croatie': 'croatia',
  'bosnie-herzegovine': 'bosnia and herz.',
  'albanie': 'albania',
  'suede': 'sweden',
  'norvege': 'norway',
  'finlande': 'finland',
  'danemark': 'denmark',
  'irlande': 'ireland',
  'islande': 'iceland',
  'estonie': 'estonia',
  'lettonie': 'latvia',
  'lituanie': 'lithuania',
  'bielorussie': 'belarus',
  'moldavie': 'moldova',
  'slovaquie': 'slovakia',
  'slovenie': 'slovenia',
  'macedoine': 'north macedonia',
  'montenegro': 'montenegro',
}

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const aliasName = (name: string): string => {
  const k = norm(name)
  return ALIASES[k] ?? k
}

const BBOX: Record<string, [[number, number], [number, number]]> = {
  world: [
    [-180, -58],
    [180, 84],
  ],
  europe: [
    [-25, 34],
    [46, 72],
  ],
  france: [
    [-5.6, 41],
    [9.9, 51.6],
  ],
  mediterranee: [
    [-11, 29],
    [42, 47],
  ],
}

export const mapSvg = (el: MapEl, w: number, h: number, features: CountryFeature[]): string => {
  const parts: string[] = []
  const [[wlon, slat], [elon, nlat]] = BBOX[el.projection] ?? BBOX.world
  const pad = 6
  const bbox = {
    type: 'Polygon',
    // anneau horaire : d3-geo interprète un anneau antihoraire comme
    // le complément du polygone (toute la sphère), ce qui casse le cadrage.
    coordinates: [
      [
        [wlon, slat],
        [wlon, nlat],
        [elon, nlat],
        [elon, slat],
        [wlon, slat],
      ],
    ],
  }
  const projection =
    el.projection === 'world'
      ? geoNaturalEarth1().fitExtent(
          [
            [pad, pad],
            [w - pad, h - pad],
          ],
          { type: 'Sphere' },
        )
      : geoMercator().fitExtent(
          [
            [pad, pad],
            [w - pad, h - pad],
          ],
          bbox as never,
        )
  const path = geoPath(projection)
  const highlight = new Set(el.highlight.map(aliasName))

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`)
  parts.push(`<rect width="${w}" height="${h}" fill="${esc(el.water)}"/>`)
  if (el.graticule) {
    parts.push(`<path d="${path(geoGraticule10()) ?? ''}" fill="none" stroke="${esc(el.stroke)}" stroke-width="0.5" opacity="0.25"/>`)
  }
  for (const f of features) {
    const name = aliasName(f.properties?.name ?? '')
    const isHi = highlight.has(name)
    const d = path(f as never)
    if (!d) continue
    parts.push(
      `<path d="${d}" fill="${esc(isHi ? el.highlightFill : el.fill)}" stroke="${esc(el.stroke)}" stroke-width="${isHi ? 0.9 : 0.45}" stroke-linejoin="round"/>`,
    )
  }
  // étiquettes des pays mis en avant
  const labelColor = el.labelColor ?? el.stroke
  if (highlight.size <= 8) {
    for (const f of features) {
      if (!highlight.has(aliasName(f.properties?.name ?? ''))) continue
      const c = path.centroid(f as never)
      if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue
      const label = (f.properties?.name ?? '').toUpperCase()
      parts.push(
        `<text x="${n(c[0])}" y="${n(c[1])}" text-anchor="middle" font-size="${n(Math.max(7.5, Math.min(11, w / 70)))}" font-family="Segoe UI, sans-serif" font-weight="600" fill="${esc(labelColor)}" opacity="0.9" letter-spacing="0.5">${esc(truncate(label, 10, w * 0.2))}</text>`,
      )
    }
  }
  // points
  for (const p of el.points) {
    const xy = projection([p.lon, p.lat])
    if (!xy) continue
    parts.push(`<circle cx="${n(xy[0])}" cy="${n(xy[1])}" r="${n(Math.max(3, w / 220))}" fill="${esc(el.stroke)}" stroke="#fff" stroke-width="1.4"/>`)
    if (p.label !== '' && p.name) {
      const fs = Math.max(8.5, Math.min(13, w / 58))
      const anchor = xy[0] > w * 0.78 ? 'end' : xy[0] < w * 0.22 ? 'start' : 'middle'
      parts.push(
        `<text x="${n(xy[0])}" y="${n(xy[1] - fs * 0.9)}" text-anchor="${anchor}" font-size="${n(fs)}" font-family="Segoe UI, sans-serif" font-weight="600" fill="${esc(el.labelColor ?? el.stroke)}" paint-order="stroke" stroke="#ffffff" stroke-width="2.6">${esc(p.label ?? p.name)}</text>`,
      )
    }
  }
  if (el.caption) {
    const fs = Math.max(11, Math.min(16, w / 50))
    const label = truncate(el.caption, fs, w * 0.58)
    const tw = label.length * fs * 0.68 + 22
    parts.push(`<rect x="8" y="${n(h - fs * 2.15)}" width="${n(tw)}" height="${n(fs * 1.65)}" rx="4" fill="#ffffff" opacity="0.86"/>`)
    parts.push(
      `<text x="15" y="${n(h - fs * 0.95)}" font-size="${n(fs)}" font-family="Georgia, serif" fill="${esc(labelColor)}">${esc(label)}</text>`,
    )
  }
  if (el.source) {
    const fs = Math.max(7, Math.min(10, w / 80))
    const sw = el.source.length * fs * 0.5 + 12
    parts.push(`<rect x="${n(w - sw - 6)}" y="${n(h - fs * 2)}" width="${n(sw)}" height="${n(fs * 1.5)}" rx="3" fill="#ffffff" opacity="0.8"/>`)
    parts.push(`<text x="${n(w - 12)}" y="${n(h - fs * 0.95)}" text-anchor="end" font-size="${n(fs)}" font-family="Segoe UI, sans-serif" fill="${esc(labelColor)}" opacity="0.85">${esc(el.source)}</text>`)
  }
  parts.push('</svg>')
  return parts.join('')
}

export const loadMapFeatures = async (): Promise<CountryFeature[]> => {
  if (mapFeaturesCache) return mapFeaturesCache
  const topoMod = (await import('world-atlas/countries-110m.json')) as unknown as { default?: unknown }
  const { feature } = await import('topojson-client')
  const topo = (topoMod.default ?? topoMod) as { objects: { countries: never } }
  const fc = feature(topo as never, topo.objects.countries) as unknown as { features: CountryFeature[] }
  mapFeaturesCache = fc.features
  return mapFeaturesCache
}

let mapFeaturesCache: CountryFeature[] | null = null

/* ------------------------------------------------------------------ */
/* Icônes                                                              */
/* ------------------------------------------------------------------ */

export const ICON_SET: Record<string, IconNode> = {
  landmark: Landmark,
  map: Map,
  earth: Earth,
  users: Users,
  scale: Scale,
  crown: Crown,
  book: BookOpen,
  scroll: ScrollText,
  ship: Ship,
  factory: Factory,
  leaf: Leaf,
  chart: ChartColumn,
  clock: Clock,
  graduation: GraduationCap,
  lightbulb: Lightbulb,
  flag: Flag,
  swords: Swords,
  castle: Castle,
  church: Church,
  coins: Coins,
  handshake: Handshake,
  anchor: Anchor,
  mountain: Mountain,
  wheat: Wheat,
  droplet: Droplet,
  sun: Sun,
  compass: Compass,
  route: Route,
  building: Building,
  vote: Vote,
  gavel: Gavel,
  newspaper: Newspaper,
  hourglass: Hourglass,
  telescope: Telescope,
  microscope: Microscope,
  pen: PenTool,
  target: Target,
  arrow: ArrowRight,
  quote: Quote,
  star: Star,
  pin: MapPin,
}

export const iconSvg = (name: string, color: string, strokeWidth = 1.6, size = 48): string => {
  const node = ICON_SET[name] ?? ICON_SET.lightbulb
  const body = node
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .map(([k, v]) => `${k}="${esc(String(v))}"`)
        .join(' ')
      return `<${tag} ${a}/>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${esc(color)}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
}
