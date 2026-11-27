import { useCallback, useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, Sparkles, Shapes, Table as TableIcon, ChartColumn, Clock, Map as MapIcon, Type, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { useApp, useCurrentSlide } from '../../lib/store'
import { SLIDE_H, SLIDE_W, baseEl, type SlideElement, type TextEl } from '../../lib/model'
import { themeById } from '../../lib/themes'
import { SlideView } from '../slide/SlideView'
import { createChartElement, createIconElement, createMapElement, createShapeElement, createTableElement, createTextElement, createTimelineElement } from '../../lib/elements'
import { imageSize } from '../../lib/utils'
import { IconButton } from '../ui'

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

interface DragState {
  mode: 'move' | 'resize'
  handle?: Handle
  startX: number
  startY: number
  origin: { id: string; x: number; y: number; w: number; h: number }[]
}

const HANDLES: { id: Handle; cursor: string; x: number; y: number }[] = [
  { id: 'nw', cursor: 'nwse-resize', x: 0, y: 0 },
  { id: 'n', cursor: 'ns-resize', x: 0.5, y: 0 },
  { id: 'ne', cursor: 'nesw-resize', x: 1, y: 0 },
  { id: 'e', cursor: 'ew-resize', x: 1, y: 0.5 },
  { id: 'se', cursor: 'nwse-resize', x: 1, y: 1 },
  { id: 's', cursor: 'ns-resize', x: 0.5, y: 1 },
  { id: 'sw', cursor: 'nesw-resize', x: 0, y: 1 },
  { id: 'w', cursor: 'ew-resize', x: 0, y: 0.5 },
]

const SNAP = 5

export const Canvas = ({ editingId, setEditingId }: { editingId: string | null; setEditingId: (id: string | null) => void }) => {
  const current = useApp((s) => s.current)
  const slide = useCurrentSlide()
  const selection = useApp((s) => s.selection)
  const setSelection = useApp((s) => s.setSelection)
  const updateLive = useApp((s) => s.updateLive)
  const beginHistory = useApp((s) => s.beginHistory)
  const addElement = useApp((s) => s.addElement)
  const addAsset = useApp((s) => s.addAsset)
  const updateSlide = useApp((s) => s.updateSlide)
  const selectedSlideId = useApp((s) => s.selectedSlideId)
  const toast = useApp((s) => s.toast)

  const containerRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(0.6)
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState(false)
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] })
  const [hoverId, setHoverId] = useState<string | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const slideRef = useRef(slide)
  slideRef.current = slide
  const fileRef = useRef<HTMLInputElement>(null)

  const theme = themeById(current?.themeId ?? 'ivoire')
  const scale = Math.max(0.12, fit * zoom)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const measure = () => {
      const w = node.clientWidth - 64
      const h = node.clientHeight - 64
      setFit(Math.max(0.12, Math.min(w / SLIDE_W, h / SLIDE_H)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  const selectedEls = slide?.elements.filter((e) => selection.includes(e.id)) ?? []
  const primary = selectedEls[0]

  const updateElements = useCallback(
    (fn: (el: SlideElement) => void) => {
      if (!selectedSlideId) return
      updateLive((doc) => {
        const s = doc.slides.find((x) => x.id === selectedSlideId)
        if (!s) return
        s.elements.forEach(fn)
      })
    },
    [selectedSlideId, updateLive],
  )

  const startMove = (e: React.PointerEvent, elId: string) => {
    if (!slide || !current) return
    const el = slide.elements.find((x) => x.id === elId)
    if (!el || el.locked) return
    const ids = selection.includes(elId) ? selection : [elId]
    if (!selection.includes(elId)) setSelection(ids)
    beginHistory()
    dragRef.current = {
      mode: 'move',
      startX: e.clientX,
      startY: e.clientY,
      origin: slide.elements.filter((x) => ids.includes(x.id)).map((x) => ({ id: x.id, x: x.x, y: x.y, w: x.w, h: x.h })),
    }
    setDragging(true)
  }

  const startResize = (e: React.PointerEvent, handle: Handle) => {
    if (!primary) return
    e.stopPropagation()
    beginHistory()
    dragRef.current = {
      mode: 'resize',
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origin: [{ id: primary.id, x: primary.x, y: primary.y, w: primary.w, h: primary.h }],
    }
    setDragging(true)
  }

  const onPointerMove = useCallback(
    (ev: PointerEvent) => {
      const drag = dragRef.current
      const slide = slideRef.current
      if (!drag || !slide) return
      const dx = (ev.clientX - drag.startX) / scale
      const dy = (ev.clientY - drag.startY) / scale
      const others = slide.elements.filter((e) => !drag.origin.some((o) => o.id === e.id))

      if (drag.mode === 'move') {
        const primaryOrigin = drag.origin[0]
        let snapX = 0
        let snapY = 0
        const vGuides: number[] = []
        const hGuides: number[] = []
        const targetsX = [0, SLIDE_W / 2, SLIDE_W, 84, SLIDE_W - 84, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])]
        const targetsY = [0, SLIDE_H / 2, SLIDE_H, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])]
        const edgesX = [primaryOrigin.x + dx, primaryOrigin.x + dx + primaryOrigin.w / 2, primaryOrigin.x + dx + primaryOrigin.w]
        const edgesY = [primaryOrigin.y + dy, primaryOrigin.y + dy + primaryOrigin.h / 2, primaryOrigin.y + dy + primaryOrigin.h]
        for (const edge of edgesX) {
          const hit = targetsX.find((t) => Math.abs(t - edge) < SNAP)
          if (hit != null) {
            snapX = hit - edge
            vGuides.push(hit)
            break
          }
        }
        for (const edge of edgesY) {
          const hit = targetsY.find((t) => Math.abs(t - edge) < SNAP)
          if (hit != null) {
            snapY = hit - edge
            hGuides.push(hit)
            break
          }
        }
        setGuides({ v: vGuides, h: hGuides })
        updateElements((el) => {
          const origin = drag.origin.find((o) => o.id === el.id)
          if (!origin) return
          el.x = Math.round(Math.max(-el.w + 20, Math.min(SLIDE_W - 20, origin.x + dx + snapX)))
          el.y = Math.round(Math.max(-el.h + 20, Math.min(SLIDE_H - 20, origin.y + dy + snapY)))
        })
      } else {
        const o = drag.origin[0]
        const h = drag.handle!
        let x = o.x
        let y = o.y
        let w = o.w
        let hh = o.h
        if (h.includes('e')) w = o.w + dx
        if (h.includes('s')) hh = o.h + dy
        if (h.includes('w')) {
          x = o.x + dx
          w = o.w - dx
        }
        if (h.includes('n')) {
          y = o.y + dy
          hh = o.h - dy
        }
        const ratio = ev.shiftKey && o.h ? o.w / o.h : null
        if (ratio) hh = w / ratio
        w = Math.max(24, w)
        hh = Math.max(24, hh)
        updateElements((el) => {
          if (el.id !== o.id) return
          el.x = Math.round(x)
          el.y = Math.round(y)
          el.w = Math.round(w)
          el.h = Math.round(hh)
        })
      }
    },
    [scale, updateElements],
  )

  const onPointerUp = useCallback(() => {
    dragRef.current = null
    setDragging(false)
    setGuides({ v: [], h: [] })
  }, [])

  useEffect(() => {
    if (!dragging) return
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragging, onPointerMove, onPointerUp])

  const onArtboardPointerDown = (e: React.PointerEvent) => {
    if (editingId) {
      const insideEditor = (e.target as HTMLElement).closest('[contenteditable="true"]')
      if (insideEditor) return
      setEditingId(null)
    }
    const target = (e.target as HTMLElement).closest('[data-element-id]') as HTMLElement | null
    if (!target) {
      setSelection([])
      return
    }
    e.stopPropagation()
    const id = target.dataset.elementId!
    const el = slide?.elements.find((x) => x.id === id)
    if (!el) return
    if (el.type === 'text' && selection.includes(id) && !e.shiftKey) {
      setEditingId(id)
      return
    }
    if (e.shiftKey) {
      setSelection(selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id])
    } else if (!selection.includes(id)) {
      setSelection([id])
    }
    startMove(e, id)
  }

  const addImageFile = async (file: File, at?: { x: number; y: number }) => {
    const size = await imageSize(file)
    const asset = await addAsset(file, file.name)
    const maxW = 640
    const maxH = 460
    const ratio = size.width && size.height ? size.width / size.height : 4 / 3
    let w = maxW
    let h = w / ratio
    if (h > maxH) {
      h = maxH
      w = h * ratio
    }
    const el: SlideElement = {
      ...baseEl(at?.x ?? (SLIDE_W - w) / 2, at?.y ?? (SLIDE_H - h) / 2, w, h),
      type: 'image',
      assetId: asset.id,
      fit: 'cover',
      alt: file.name,
    }
    addElement(el)
    toast('Image ajoutée.', 'success')
  }

  const addFromButton = (kind: 'text' | 'shape' | 'table' | 'chart' | 'timeline' | 'map' | 'icon' | 'image') => {
    if (kind === 'image') {
      fileRef.current?.click()
      return
    }
    const factory = {
      text: createTextElement,
      shape: createShapeElement,
      table: createTableElement,
      chart: createChartElement,
      timeline: createTimelineElement,
      map: createMapElement,
      icon: createIconElement,
    }[kind]
    const el = factory(theme)
    addElement({ ...el, x: Math.round((SLIDE_W - el.w) / 2), y: Math.round((SLIDE_H - el.h) / 2) })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable="true"]')) return
      const state = useApp.getState()
      const cmd = e.ctrlKey || e.metaKey
      if (cmd && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void state.saveNow()
        return
      }
      if (cmd && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) state.redo()
        else state.undo()
        return
      }
      if (cmd && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        state.redo()
        return
      }
      if (cmd && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        state.duplicateElements(state.selection)
        return
      }
      if (cmd && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        state.setSelection(state.current?.slides.find((s) => s.id === state.selectedSlideId)?.elements.map((el) => el.id) ?? [])
        return
      }
      if (e.key === 'Escape') {
        setEditingId(null)
        state.setSelection([])
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selection.length) {
          e.preventDefault()
          state.deleteElements(state.selection)
        }
        return
      }
      if (e.key === 'Enter' && state.selection.length === 1) {
        const el = state.current?.slides.find((s) => s.id === state.selectedSlideId)?.elements.find((x) => x.id === state.selection[0])
        if (el?.type === 'text') {
          e.preventDefault()
          setEditingId(el.id)
        }
        return
      }
      const step = e.shiftKey ? 10 : 1
      const nudge: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      if (nudge[e.key] && state.selection.length) {
        e.preventDefault()
        const [dx, dy] = nudge[e.key]
        state.beginHistory()
        state.updateLive((doc) => {
          const s = doc.slides.find((x) => x.id === state.selectedSlideId)
          s?.elements.forEach((el) => {
            if (state.selection.includes(el.id)) {
              el.x += dx
              el.y += dy
            }
          })
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setEditingId])

  if (!slide || !current) return <div className="flex-1" />

  const onTextChange = (id: string, paragraphs: TextEl['paragraphs']) => {
    updateSlide(selectedSlideId!, (s) => {
      const el = s.elements.find((x) => x.id === id)
      if (el?.type === 'text') el.paragraphs = paragraphs
    })
  }

  return (
    <div className="relative flex flex-1 flex-col bg-[#e9e7e1]">
      {/* barre d'outils flottante */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-[11px] border border-[var(--color-line)] bg-white/95 px-1.5 py-1 shadow-[var(--shadow-sm)] backdrop-blur">
        <div className="pointer-events-auto flex items-center gap-0.5">
          <IconButton label="Texte" onClick={() => addFromButton('text')}>
            <Type size={15} />
          </IconButton>
          <IconButton label="Image" onClick={() => addFromButton('image')}>
            <ImageIcon size={15} />
          </IconButton>
          <IconButton label="Forme" onClick={() => addFromButton('shape')}>
            <Shapes size={15} />
          </IconButton>
          <IconButton label="Tableau" onClick={() => addFromButton('table')}>
            <TableIcon size={15} />
          </IconButton>
          <IconButton label="Graphique" onClick={() => addFromButton('chart')}>
            <ChartColumn size={15} />
          </IconButton>
          <IconButton label="Frise" onClick={() => addFromButton('timeline')}>
            <Clock size={15} />
          </IconButton>
          <IconButton label="Carte" onClick={() => addFromButton('map')}>
            <MapIcon size={15} />
          </IconButton>
          <IconButton label="Idée / icône" onClick={() => addFromButton('icon')}>
            <Sparkles size={15} />
          </IconButton>
        </div>
        <div className="mx-1 h-5 w-px bg-[var(--color-line)]" />
        <div className="pointer-events-auto flex items-center gap-0.5">
          <IconButton label="Réduire" onClick={() => setZoom((z) => Math.max(0.35, z - 0.1))}>
            <ZoomOut size={15} />
          </IconButton>
          <button className="min-w-[38px] rounded px-1 text-[11px] text-[var(--color-muted)] hover:bg-black/5" onClick={() => setZoom(1)} title="Ajuster">
            {Math.round(scale * 100)}%
          </button>
          <IconButton label="Agrandir" onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}>
            <ZoomIn size={15} />
          </IconButton>
          <IconButton label="Ajuster à la fenêtre" onClick={() => setZoom(1)}>
            <Maximize2 size={14} />
          </IconButton>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-auto p-8 pt-16"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
          if (files[0]) {
            const rect = containerRef.current!.getBoundingClientRect()
            const x = (e.clientX - rect.left - (rect.width - SLIDE_W * scale) / 2) / scale
            const y = (e.clientY - rect.top - (rect.height - SLIDE_H * scale) / 2) / scale
            void addImageFile(files[0], { x, y })
          }
        }}
      >
        <div
          className="relative bg-white shadow-[0_1px_2px_rgba(20,22,26,.08),0_18px_50px_-18px_rgba(20,22,26,.35)]"
          style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}
        >
          <div
            data-canvas="1"
            style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})`, transformOrigin: 'top left', touchAction: 'none' }}
            onPointerDown={onArtboardPointerDown}
            onPointerMove={(e) => {
              if (dragging) return
              const t = (e.target as HTMLElement).closest('[data-element-id]') as HTMLElement | null
              setHoverId(t?.dataset.elementId ?? null)
            }}
            onPointerLeave={() => setHoverId(null)}
          >
            <SlideView
              slide={slide}
              theme={theme}
              editingId={editingId}
              onTextChange={onTextChange}
              onEditingEnd={() => setEditingId(null)}
              showFooter={(current.options?.showSlideNumbers ?? true) && current.slides.indexOf(slide) > 0}
              index={current.slides.indexOf(slide)}
              total={current.slides.length}
            />

            {/* survol */}
            {hoverId && !selection.includes(hoverId) && !dragging
              ? (() => {
                  const el = slide.elements.find((x) => x.id === hoverId)
                  if (!el) return null
                  return (
                    <div
                      className="pointer-events-none absolute border border-[#7f9dc0]"
                      style={{ left: el.x, top: el.y, width: el.w, height: el.h, borderWidth: 1.5 / scale }}
                    />
                  )
                })()
              : null}

            {/* sélection */}
            {selectedEls.map((el) => (
              <div
                key={el.id}
                className="pointer-events-none absolute"
                style={{ left: el.x, top: el.y, width: el.w, height: el.h, border: `${1.6 / scale}px solid #2f6f9f` }}
              >
                {selectedEls.length === 1 &&
                  HANDLES.map((h) => (
                    <div
                      key={h.id}
                      onPointerDown={(e) => startResize(e, h.id)}
                      className="pointer-events-auto absolute flex items-center justify-center"
                      style={{
                        left: `${h.x * 100}%`,
                        top: `${h.y * 100}%`,
                        width: 22 / scale,
                        height: 22 / scale,
                        transform: 'translate(-50%, -50%)',
                        cursor: h.cursor,
                        touchAction: 'none',
                      }}
                    >
                      <div
                        style={{
                          width: 9 / scale,
                          height: 9 / scale,
                          background: '#fff',
                          border: `${1.6 / scale}px solid #2f6f9f`,
                          borderRadius: 2 / scale,
                        }}
                      />
                    </div>
                  ))}
              </div>
            ))}

            {/* repères */}
            {guides.v.map((g, i) => (
              <div key={`v${i}`} className="pointer-events-none absolute top-0 bottom-0" style={{ left: g, width: 1 / scale, background: '#d98b3a' }} />
            ))}
            {guides.h.map((g, i) => (
              <div key={`h${i}`} className="pointer-events-none absolute left-0 right-0" style={{ top: g, height: 1 / scale, background: '#d98b3a' }} />
            ))}
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void addImageFile(f)
          e.target.value = ''
        }}
      />

      {/* barre d'état */}
      <div className="flex h-9 shrink-0 items-center justify-between border-t border-[var(--color-line)] bg-[#f7f6f2] px-3 text-[11px] text-[var(--color-faint)]">
        <span>
          Diapositive {current.slides.indexOf(slide) + 1} sur {current.slides.length}
          {selection.length ? ` · ${selection.length} élément(s) sélectionné(s)` : ''}
        </span>
        <span className="hidden sm:inline">
          {editingId ? 'Modification du texte — Échap pour terminer' : 'Double-clic sur un texte pour l’éditer · glisser pour déplacer'}
        </span>
      </div>
    </div>
  )
}
