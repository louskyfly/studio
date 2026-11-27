import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  SLIDE_H,
  SLIDE_W,
  type ChartEl,
  type IconEl,
  type ImageEl,
  type MapEl,
  type Paragraph,
  type ShapeEl,
  type Slide,
  type SlideBackground,
  type SlideElement,
  type TableEl,
  type TextEl,
  type TextRun,
  type TimelineEl,
  type Align,
} from '../../lib/model'
import type { Theme } from '../../lib/themes'
import { fontStack } from '../../lib/themes'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { chartSvg, iconSvg, loadMapFeatures, mapSvg, timelineSvg, type SvgTheme } from '../../lib/svg'
import { cn } from '../../lib/utils'

/* ------------------------------------------------------------------ */
/* Cadre à l'échelle                                                    */
/* ------------------------------------------------------------------ */

export const SlideFrame = ({
  children,
  className,
  style,
  radius = 0,
  innerRef,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  radius?: number
  innerRef?: React.Ref<HTMLDivElement>
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setScale(node.clientWidth / SLIDE_W)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn('relative w-full overflow-hidden bg-white', className)}
      style={{ aspectRatio: `${SLIDE_W} / ${SLIDE_H}`, borderRadius: radius, ...style }}
    >
      <div
        ref={innerRef}
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          visibility: scale ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Fond                                                                */
/* ------------------------------------------------------------------ */

const backgroundStyle = (bg: SlideBackground, imageUrl: string | null): React.CSSProperties => {
  switch (bg.type) {
    case 'solid':
      return { background: bg.color }
    case 'gradient':
      return { background: `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})` }
    case 'image':
      return {
        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#eee',
      }
    case 'pattern':
      return {
        backgroundColor: bg.base,
        backgroundImage:
          bg.variant === 'dots'
            ? `radial-gradient(${bg.color} 1.1px, transparent 1.1px)`
            : bg.variant === 'grid'
              ? `linear-gradient(${bg.color} 1px, transparent 1px), linear-gradient(90deg, ${bg.color} 1px, transparent 1px)`
              : `repeating-linear-gradient(135deg, ${bg.color} 0 1px, transparent 1px 12px)`,
        backgroundSize: bg.variant === 'dots' ? '22px 22px' : '40px 40px',
      }
  }
}

const SlideBackgroundLayer = ({ bg }: { bg: SlideBackground }) => {
  const url = useAssetUrl(bg.type === 'image' ? bg.assetId : null)
  return (
    <div className="absolute inset-0" style={backgroundStyle(bg, url)}>
      {bg.type === 'image' && bg.overlay ? (
        <div className="absolute inset-0" style={{ background: bg.overlayColor ?? '#000', opacity: bg.overlay }} />
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Texte                                                               */
/* ------------------------------------------------------------------ */

export const paragraphToHtml = (p: Paragraph): string => {
  if (!p.runs.length) return '<br>'
  return p.runs
    .map((r) => {
      let text = r.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
      if (!text) text = '<br>'
      const styles: string[] = []
      if (r.color) styles.push(`color:${r.color}`)
      if (r.size) styles.push(`font-size:${r.size}px`)
      if (r.font) styles.push(`font-family:${fontStack(r.font)}`)
      if (styles.length) text = `<span style="${styles.join(';')}">${text}</span>`
      if (r.underline) text = `<u>${text}</u>`
      if (r.italic) text = `<em>${text}</em>`
      if (r.bold) text = `<strong>${text}</strong>`
      return text
    })
    .join('')
    .replace(/^<br>$/, '')
    .replace(/(<br>)+$/, (m) => (p.runs.some((r) => r.text.trim()) ? '' : m))
}

const BULLETS: Record<string, string> = { dot: '•', dash: '—' }

const ParagraphLine = ({ p, style, theme, index }: { p: Paragraph; style: TextEl['style']; theme: Theme; index: number }) => {
  const align: Align = p.align ?? style.align
  const bullet = p.bullet ?? 'none'
  const level = p.level ?? 0
  const marker = BULLETS[bullet] ?? (bullet === 'number' ? `${index + 1}.` : '')
  const size = style.fontSize
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: bullet !== 'none' ? size * 0.5 : 0,
        paddingLeft: level * size * 1.1,
        marginTop: p.spaceBefore ?? 0,
        marginBottom: p.spaceAfter ?? size * 0.35,
        textAlign: align,
        justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      {bullet !== 'none' && (
        <span
          style={{
            flex: 'none',
            width: bullet === 'number' ? size * 0.95 : size * 0.55,
            color: style.bulletColor ?? theme.accent,
            fontWeight: 600,
            lineHeight: style.lineHeight,
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {marker}
        </span>
      )}
      <span style={{ flex: bullet !== 'none' ? 1 : undefined, minWidth: 0 }}>
        {p.runs.length === 0 ? <span>&nbsp;</span> : null}
        {p.runs.map((r, i) => (
          <span
            key={i}
            style={{
              fontWeight: r.bold ? 700 : style.bold ? 600 : 400,
              fontStyle: r.italic || style.italic ? 'italic' : undefined,
              textDecoration: r.underline || style.underline ? 'underline' : undefined,
              color: r.color ?? style.color,
              fontSize: r.size ?? size,
              fontFamily: fontStack(r.font ?? style.fontFamily),
            }}
          >
            {r.text}
          </span>
        ))}
      </span>
    </div>
  )
}

export const TextBlock = ({
  el,
  theme,
  editable,
  onChange,
  onEnd,
}: {
  el: TextEl
  theme: Theme
  editable: boolean
  onChange?: (paragraphs: Paragraph[]) => void
  onEnd?: () => void
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const frozenHtml = useRef<string | null>(null)

  const buildHtml = useCallback(() => {
    return el.paragraphs
      .map((p) => {
        const bullet = p.bullet ?? 'none'
        const align = p.align ?? el.style.align
        const pad = (p.level ?? 0) * el.style.fontSize * 1.1
        const marker =
          bullet === 'none'
            ? ''
            : `<span data-bm="1" contenteditable="false" style="display:inline-block;width:${bullet === 'number' ? '1.1em' : '0.6em'};color:${el.style.bulletColor ?? '#8a6d3b'};font-weight:600">${bullet === 'dash' ? '—' : bullet === 'number' ? '·' : '•'}</span>`
        return `<p data-bullet="${bullet}" style="text-align:${align};margin:0 0 ${p.spaceAfter ?? el.style.fontSize * 0.35}px 0;padding-left:${pad}px;min-height:${el.style.fontSize * el.style.lineHeight}px">${marker}${paragraphToHtml(
          p,
        )}</p>`
      })
      .join('')
  }, [el.paragraphs, el.style])

  useEffect(() => {
    if (!editable) frozenHtml.current = null
  }, [editable])

  const serialize = (root: HTMLElement): Paragraph[] => {
    const blocks: Paragraph[] = []
    const children = Array.from(root.childNodes)
    const elements = children.filter((n) => n.nodeType === Node.ELEMENT_NODE) as HTMLElement[]
    const sources: HTMLElement[] = elements.length ? elements : ([root] as HTMLElement[])

    for (const node of sources) {
      if (node.tagName === 'BR') continue
      const p: Paragraph = { runs: [] }
      const bullet = node.dataset?.bullet
      if (bullet && bullet !== 'none') p.bullet = bullet as Paragraph['bullet']
      const ta = (node.style.textAlign || '').toLowerCase()
      if (['left', 'center', 'right', 'justify'].includes(ta)) p.align = ta as Align
      const walk = (n: Node, fmt: Partial<TextRun>) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const text = (n.textContent ?? '').replace(/\u00a0/g, ' ')
          if (text) p.runs.push({ ...fmt, text })
          return
        }
        if (n.nodeType !== Node.ELEMENT_NODE) return
        const e = n as HTMLElement
        const tag = e.tagName
        if (e.dataset?.bm) return
        if (tag === 'BR') {
          p.runs.push({ ...fmt, text: '\n' })
          return
        }
        const next: Partial<TextRun> = { ...fmt }
        if (tag === 'STRONG' || tag === 'B') next.bold = true
        if (tag === 'EM' || tag === 'I') next.italic = true
        if (tag === 'U') next.underline = true
        if (tag === 'SPAN') {
          if (e.style.color) next.color = e.style.color
          if (e.style.fontSize) next.size = parseFloat(e.style.fontSize)
          if (e.style.fontFamily) next.font = e.style.fontFamily.replace(/["']/g, '').split(',')[0]
        }
        e.childNodes.forEach((c) => walk(c, next))
      }
      const inlineChildren = Array.from(node.childNodes)
      if (inlineChildren.length === 1 && inlineChildren[0].nodeType === Node.ELEMENT_NODE && (inlineChildren[0] as HTMLElement).tagName === 'BR') {
        p.runs = []
      } else {
        inlineChildren.forEach((c) => walk(c, {}))
      }
      blocks.push(p)
    }
    // fusionne les retours à la ligne vides consécutifs
    return blocks.length ? blocks : [{ runs: [] }]
  }

  const handleInput = () => {
    if (!ref.current || !onChange) return
    onChange(serialize(ref.current))
  }

  const initial = frozenHtml.current ?? buildHtml()
  if (editable && frozenHtml.current === null) frozenHtml.current = initial

  const commonStyle: React.CSSProperties = {
    padding: el.padding ?? 0,
    background: el.fill,
    color: el.style.color,
    fontFamily: fontStack(el.style.fontFamily),
    fontSize: el.style.fontSize,
    lineHeight: el.style.lineHeight,
    letterSpacing: el.style.letterSpacing ? `${el.style.letterSpacing}px` : undefined,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: el.style.valign === 'middle' ? 'center' : el.style.valign === 'bottom' ? 'flex-end' : 'flex-start',
    overflow: 'hidden',
  }

  if (editable) {
    return (
      <div
        ref={ref}
        className="h-full w-full cursor-text outline-none"
        style={commonStyle}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={handleInput}
        onBlur={() => {
          frozenHtml.current = null
          onEnd?.()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            ;(e.currentTarget as HTMLElement).blur()
            onEnd?.()
          }
        }}
        onPointerDown={(e) => e.stopPropagation()}
        dangerouslySetInnerHTML={{ __html: initial }}
      />
    )
  }

  return (
    <div ref={ref} className="h-full w-full" style={commonStyle}>
      {el.paragraphs.map((p, i) => (
        <ParagraphLine key={i} p={p} style={el.style} theme={theme} index={i} />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Image                                                               */
/* ------------------------------------------------------------------ */

const ImageBlock = ({ el }: { el: ImageEl }) => {
  const url = useAssetUrl(el.assetId)
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ borderRadius: el.radius ?? 0 }}>
      {url ? (
        <img
          src={url}
          alt={el.alt ?? ''}
          draggable={false}
          className="h-full w-full select-none"
          style={{ objectFit: el.fit, objectPosition: 'center' }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#eeece7] text-[11px] text-[#8d8a83]">Image indisponible</div>
      )}
      {el.credit ? (
        <div
          className="absolute bottom-0 left-0 right-0 truncate px-2 py-1 text-white"
          style={{
            fontSize: 9.5,
            background: 'linear-gradient(to top, rgba(0,0,0,.45), rgba(0,0,0,0))',
            letterSpacing: '0.01em',
          }}
        >
          {el.credit}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Formes                                                              */
/* ------------------------------------------------------------------ */

const starPoints = (w: number, h: number): string => {
  const cx = w / 2
  const cy = h / 2
  const outer = Math.min(w, h) / 2
  const inner = outer * 0.45
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI / 5) * i - Math.PI / 2
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`)
  }
  return pts.join(' ')
}

const ShapeBlock = ({ el }: { el: ShapeEl }) => {
  const { w, h } = el
  const fill = el.fill ?? 'transparent'
  const stroke = el.stroke ?? 'transparent'
  const sw = el.strokeWidth ?? 0
  const inset = sw / 2
  let body: React.ReactNode = null
  switch (el.shape) {
    case 'rect':
      body = <rect x={inset} y={inset} width={Math.max(0, w - sw)} height={Math.max(0, h - sw)} fill={fill} stroke={stroke} strokeWidth={sw} />
      break
    case 'roundRect':
      body = (
        <rect
          x={inset}
          y={inset}
          width={Math.max(0, w - sw)}
          height={Math.max(0, h - sw)}
          rx={el.radius ?? Math.min(18, h * 0.16)}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
      )
      break
    case 'ellipse':
      body = <ellipse cx={w / 2} cy={h / 2} rx={Math.max(0, w / 2 - inset)} ry={Math.max(0, h / 2 - inset)} fill={fill} stroke={stroke} strokeWidth={sw} />
      break
    case 'line':
      body = <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke={stroke || fill} strokeWidth={Math.max(1, sw || 2)} strokeLinecap="round" />
      break
    case 'divider':
      body = <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke={fill} strokeWidth={Math.max(1, sw || 2)} strokeLinecap="round" />
      break
    case 'arrow':
      body = (
        <>
          <defs>
            <marker id={`ah-${el.id}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill={stroke || fill} />
            </marker>
          </defs>
          <line x1={0} y1={h / 2} x2={w - 8} y2={h / 2} stroke={stroke || fill} strokeWidth={Math.max(1, sw || 2)} markerEnd={`url(#ah-${el.id})`} />
        </>
      )
      break
    case 'triangle':
      body = <polygon points={`${w / 2},${inset} ${w - inset},${h - inset} ${inset},${h - inset}`} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      break
    case 'chevron':
      body = <polygon points={`${inset},${inset} ${w * 0.72},${inset} ${w - inset},${h / 2} ${w * 0.72},${h - inset} ${inset},${h - inset} ${w * 0.28},${h / 2}`} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      break
    case 'star':
      body = <polygon points={starPoints(w, h)} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      break
    case 'bracket':
      body = <path d={`M ${w - inset} ${inset} H ${inset} V ${h - inset} H ${w - inset}`} fill="none" stroke={stroke || fill} strokeWidth={Math.max(1, sw || 3)} strokeLinecap="round" />
      break
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible', display: 'block' }}>
      {body}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Tableau                                                             */
/* ------------------------------------------------------------------ */

const TableBlock = ({ el }: { el: TableEl }) => {
  const total = el.columns.reduce((a, c) => a + (c.width ?? 1), 0)
  return (
    <div className="h-full w-full overflow-hidden" style={{ borderRadius: Math.min(10, el.h * 0.06), border: `1px solid ${el.borderColor}` }}>
      <table className="h-full w-full border-collapse" style={{ fontFamily: fontStack(el.fontFamily), fontSize: el.fontSize, color: el.bodyColor }}>
        <colgroup>
          {el.columns.map((c, i) => (
            <col key={i} style={{ width: `${((c.width ?? 1) / total) * 100}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {el.columns.map((c, i) => (
              <th
                key={i}
                style={{
                  background: el.headerFill,
                  color: el.headerColor,
                  textAlign: 'left',
                  padding: '0.55em 0.7em',
                  fontWeight: 600,
                  borderRight: i < el.columns.length - 1 ? `1px solid ${el.borderColor}` : undefined,
                  verticalAlign: 'middle',
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {el.rows.map((row, ri) => (
            <tr key={ri} style={{ background: el.zebra && ri % 2 === 1 ? 'rgba(0,0,0,0.028)' : undefined }}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: '0.5em 0.7em',
                    borderTop: `1px solid ${el.borderColor}`,
                    borderRight: ci < row.length - 1 ? `1px solid ${el.borderColor}` : undefined,
                    fontWeight: el.firstColBold && ci === 0 ? 600 : 400,
                    verticalAlign: 'top',
                    lineHeight: 1.35,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* SVG intégré                                                         */
/* ------------------------------------------------------------------ */

const InlineSvg = ({ svg, className }: { svg: string; className?: string }) => (
  <div className={cn('pointer-events-none h-full w-full [&>svg]:h-full [&>svg]:w-full', className)} dangerouslySetInnerHTML={{ __html: svg }} />
)

const MapBlock = ({ el, theme }: { el: MapEl; theme: Theme }) => {
  const [features, setFeatures] = useState<Awaited<ReturnType<typeof loadMapFeatures>> | null>(null)
  useEffect(() => {
    let alive = true
    loadMapFeatures()
      .then((f) => alive && setFeatures(f))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  if (!features) {
    return <div className="flex h-full w-full items-center justify-center rounded-[3px]" style={{ background: theme.bgAlt }} />
  }
  return <InlineSvg svg={mapSvg(el, el.w, el.h, features)} />
}

const ChartBlock = ({ el, theme }: { el: ChartEl; theme: Theme }) => {
  const t: SvgTheme = { font: theme.bodyFont, ink: theme.ink, muted: theme.muted, line: theme.line, bg: theme.bg, accent: theme.accent, palette: theme.palette }
  return <InlineSvg svg={chartSvg(el, el.w, el.h, t)} />
}

const TimelineBlock = ({ el }: { el: TimelineEl }) => <InlineSvg svg={timelineSvg(el, el.w, el.h)} />

const IconBlock = ({ el }: { el: IconEl }) => (
  <div className="flex h-full w-full items-center justify-center">
    <InlineSvg svg={iconSvg(el.icon, el.color, el.strokeWidth, Math.min(el.w, el.h))} />
  </div>
)

/* ------------------------------------------------------------------ */
/* Élément                                                             */
/* ------------------------------------------------------------------ */

const ElementBody = ({
  el,
  theme,
  editing,
  onTextChange,
  onEditingEnd,
}: {
  el: SlideElement
  theme: Theme
  editing: boolean
  onTextChange?: (id: string, paragraphs: Paragraph[]) => void
  onEditingEnd?: () => void
}) => {
  switch (el.type) {
    case 'text':
      return <TextBlock el={el} theme={theme} editable={editing} onChange={(p) => onTextChange?.(el.id, p)} onEnd={onEditingEnd} />
    case 'image':
      return <ImageBlock el={el} />
    case 'shape':
      return <ShapeBlock el={el} />
    case 'table':
      return <TableBlock el={el} />
    case 'chart':
      return <ChartBlock el={el} theme={theme} />
    case 'timeline':
      return <TimelineBlock el={el} />
    case 'map':
      return <MapBlock el={el} theme={theme} />
    case 'icon':
      return <IconBlock el={el} />
  }
}

/* ------------------------------------------------------------------ */
/* Diapositive                                                         */
/* ------------------------------------------------------------------ */

export const SlideView = ({
  slide,
  theme,
  editingId = null,
  onTextChange,
  onEditingEnd,
  showFooter,
  index,
  total,
  className,
}: {
  slide: Slide
  theme: Theme
  editingId?: string | null
  onTextChange?: (id: string, paragraphs: Paragraph[]) => void
  onEditingEnd?: () => void
  showFooter?: boolean
  index?: number
  total?: number
  className?: string
}) => {
  return (
    <div className={cn('relative overflow-hidden', className)} style={{ width: SLIDE_W, height: SLIDE_H, background: theme.bg }}>
      <SlideBackgroundLayer bg={slide.background} />
      {slide.elements.map((el) => (
        <div
          key={el.id}
          data-element-id={el.id}
          style={{
            position: 'absolute',
            left: el.x,
            top: el.y,
            width: el.w,
            height: el.h,
            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
            opacity: el.opacity ?? 1,
            zIndex: 1,
          }}
        >
          <ElementBody el={el} theme={theme} editing={editingId === el.id} onTextChange={onTextChange} onEditingEnd={onEditingEnd} />
        </div>
      ))}
      {showFooter && index != null ? (
        <div
          className="absolute bottom-[18px] right-[34px] flex items-center gap-2"
          style={{ color: theme.muted, fontFamily: fontStack(theme.bodyFont), fontSize: 11.5, opacity: 0.75 }}
        >
          <span>{index + 1}</span>
          {total ? <span>/ {total}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
