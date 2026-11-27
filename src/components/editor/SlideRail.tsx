import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Ellipsis, Eye, EyeOff, GripVertical, Plus, Trash2, X } from 'lucide-react'
import { useApp } from '../../lib/store'
import { themeById } from '../../lib/themes'
import { blankSlideFor } from '../../lib/layouts'
import type { LayoutId } from '../../lib/model'
import { SlideFrame, SlideView } from '../slide/SlideView'
import { Button, IconButton, Menu, MenuItem, Modal } from '../ui'
import { cn } from '../../lib/utils'

const LAYOUTS: { id: LayoutId; label: string }[] = [
  { id: 'title', label: 'Couverture' },
  { id: 'problem', label: 'Problématique' },
  { id: 'section', label: 'Ouverture de partie' },
  { id: 'bullets', label: 'Idées et puces' },
  { id: 'two-col', label: 'Comparaison' },
  { id: 'quote', label: 'Citation' },
  { id: 'document', label: 'Étude de document' },
  { id: 'timeline', label: 'Frise' },
  { id: 'map', label: 'Carte' },
  { id: 'chart', label: 'Graphique' },
  { id: 'table', label: 'Tableau' },
  { id: 'conclusion', label: 'Bilan' },
  { id: 'blank', label: 'Page blanche' },
]

export const SlideRail = ({ onNavigate }: { onNavigate?: () => void }) => {
  const current = useApp((s) => s.current)
  const selectedSlideId = useApp((s) => s.selectedSlideId)
  const selectSlide = useApp((s) => s.selectSlide)
  const addSlide = useApp((s) => s.addSlide)
  const duplicateSlide = useApp((s) => s.duplicateSlide)
  const deleteSlide = useApp((s) => s.deleteSlide)
  const moveSlide = useApp((s) => s.moveSlide)
  const updateSlide = useApp((s) => s.updateSlide)
  const [picker, setPicker] = useState(false)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  if (!current) return null
  const theme = themeById(current.themeId)

  const add = (layout: LayoutId) => {
    const slide = blankSlideFor(layout, theme)
    addSlide(slide, selectedSlideId ?? undefined)
    setPicker(false)
    onNavigate?.()
  }

  return (
    <div className="flex h-full w-[186px] shrink-0 flex-col border-r border-[var(--color-line)] bg-[#f7f6f2]">
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-[var(--color-faint)]">Diapositives</span>
        <div className="flex items-center gap-0.5">
          <IconButton label="Ajouter une diapositive" onClick={() => setPicker(true)}>
            <Plus size={15} />
          </IconButton>
          <IconButton label="Fermer" className="xl:hidden" onClick={onNavigate}>
            <X size={15} />
          </IconButton>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-2.5 pb-3">
        {current.slides.map((s, i) => {
          const active = s.id === selectedSlideId
          return (
            <div
              key={s.id}
              draggable
              onDragStart={(e) => {
                setDragFrom(i)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', String(i))
              }}
              onDragEnd={() => {
                setDragFrom(null)
                setDragOver(null)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(i)
              }}
              onDrop={(e) => {
                e.preventDefault()
                const from = dragFrom ?? Number(e.dataTransfer.getData('text/plain'))
                if (Number.isFinite(from)) moveSlide(from, i)
                setDragFrom(null)
                setDragOver(null)
              }}
              onClick={() => selectSlide(s.id)}
              className={cn(
                'group relative cursor-pointer rounded-[7px] border bg-white p-1 transition',
                active ? 'border-[var(--color-accent)] shadow-[0_0_0_2px_rgba(27,51,80,.12)]' : 'border-[var(--color-line)] hover:border-[var(--color-line-strong)]',
                dragOver === i && dragFrom !== null && 'border-t-[3px] border-t-[var(--color-accent)]',
                s.hidden && 'opacity-45',
              )}
            >
              <div className="pointer-events-none select-none">
                <SlideFrame radius={4}>
                  <SlideView slide={s} theme={theme} />
                </SlideFrame>
              </div>
              <div className="mt-1 flex items-center justify-between px-0.5">
                <span className={cn('num text-[10.5px]', active ? 'font-semibold text-[var(--color-accent)]' : 'text-[var(--color-faint)]')}>{i + 1}</span>
                <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                  <Menu
                    align="end"
                    trigger={({ toggle }) => (
                      <button
                        className="flex h-5 w-5 items-center justify-center rounded text-[var(--color-faint)] hover:bg-black/5 hover:text-[var(--color-ink)]"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggle()
                        }}
                        aria-label="Options de la diapositive"
                      >
                        <Ellipsis size={13} />
                      </button>
                    )}
                  >
                    {(close) => (
                      <>
                        <MenuItem
                          icon={<Copy size={13} />}
                          onClick={() => {
                            close()
                            duplicateSlide(s.id)
                          }}
                        >
                          Dupliquer
                        </MenuItem>
                        <MenuItem
                          icon={<ChevronUp size={13} />}
                          disabled={i === 0}
                          onClick={() => {
                            close()
                            moveSlide(i, i - 1)
                          }}
                        >
                          Monter
                        </MenuItem>
                        <MenuItem
                          icon={<ChevronDown size={13} />}
                          disabled={i === current.slides.length - 1}
                          onClick={() => {
                            close()
                            moveSlide(i, i + 1)
                          }}
                        >
                          Descendre
                        </MenuItem>
                        <MenuItem
                          icon={s.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                          onClick={() => {
                            close()
                            updateSlide(s.id, (sl) => {
                              sl.hidden = !sl.hidden
                            })
                          }}
                        >
                          {s.hidden ? 'Réafficher' : 'Masquer'}
                        </MenuItem>
                        <MenuItem
                          icon={<Trash2 size={13} />}
                          danger
                          disabled={current.slides.length <= 1}
                          onClick={() => {
                            close()
                            deleteSlide(s.id)
                          }}
                        >
                          Supprimer
                        </MenuItem>
                      </>
                    )}
                  </Menu>
                </div>
              </div>
              {active && (
                <span className="absolute -left-[7px] top-1/2 -translate-y-1/2 text-[var(--color-accent)]">
                  <GripVertical size={12} />
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div className="border-t border-[var(--color-line)] p-2">
        <Button variant="ghost" className="h-8 w-full justify-start text-[12px]" onClick={() => setPicker(true)}>
          <Plus size={14} /> Nouvelle diapositive
        </Button>
      </div>

      <Modal open={picker} onClose={() => setPicker(false)} title="Nouvelle diapositive" description="Choisissez une disposition de départ. Tout reste modifiable ensuite." width={700}>
        <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
          {LAYOUTS.map((l) => (
            <button key={l.id} data-layout={l.id} onClick={() => add(l.id)} className="group rounded-[8px] border border-[var(--color-line)] p-1.5 text-left transition hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-sm)]">
              <div className="pointer-events-none select-none overflow-hidden rounded-[4px]">
                <SlideFrame radius={3}>
                  <SlideView slide={blankSlideFor(l.id, theme)} theme={theme} />
                </SlideFrame>
              </div>
              <div className="mt-1.5 px-0.5 text-[11.5px] font-medium">{l.label}</div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
