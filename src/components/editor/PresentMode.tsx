import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X, StickyNote } from 'lucide-react'
import type { Presentation } from '../../lib/model'
import { themeById } from '../../lib/themes'
import { SlideFrame, SlideView } from '../slide/SlideView'
import { cn } from '../../lib/utils'
import { useApp } from '../../lib/store'

export const PresentMode = ({ doc, startIndex, onClose }: { doc: Presentation; startIndex: number; onClose: () => void }) => {
  const [index, setIndex] = useState(Math.max(0, Math.min(doc.slides.length - 1, startIndex)))
  const [notes, setNotes] = useState(false)
  const [showBar, setShowBar] = useState(true)
  const theme = themeById(doc.themeId)
  const slide = doc.slides[index]
  const toast = useApp((s) => s.toast)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        setIndex((i) => Math.min(doc.slides.length - 1, i + 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'Escape') {
        onClose()
      } else if (e.key.toLowerCase() === 'n') {
        setNotes((v) => !v)
      } else if (e.key === 'Home') {
        setIndex(0)
      } else if (e.key === 'End') {
        setIndex(doc.slides.length - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doc.slides.length, onClose])

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {})
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    }
  }, [])

  if (!slide) return null

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-[#0d0f12]" onMouseMove={() => setShowBar(true)} onClick={() => setShowBar((v) => !v)}>
      <div className="flex flex-1 items-center justify-center px-2 py-8 sm:px-8">
        <div className="w-full" style={{ maxWidth: 'min(100%, calc((100dvh - 110px) * 16 / 9))' }}>
          <SlideFrame style={{ boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)' }}>
            <SlideView slide={slide} theme={theme} showFooter={(doc.options?.showSlideNumbers ?? true) && index > 0} index={index} total={doc.slides.length} />
          </SlideFrame>
        </div>
      </div>

      <div
        className={cn('pointer-events-none absolute left-0 top-1/3 h-1/3 w-1/4 cursor-w-resize', showBar ? 'opacity-100' : 'opacity-0')}
        onClick={(e) => {
          e.stopPropagation()
          setIndex((i) => Math.max(0, i - 1))
        }}
      />
      <div
        className="absolute right-0 top-1/3 h-1/3 w-1/4 cursor-e-resize"
        onClick={(e) => {
          e.stopPropagation()
          setIndex((i) => Math.min(doc.slides.length - 1, i + 1))
        }}
      />

      <div
        className={cn(
          'absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/85 to-transparent px-4 pb-3 pt-10 transition-opacity duration-200',
          showBar ? 'opacity-100' : 'opacity-0',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          <button className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white" onClick={() => setIndex((i) => Math.max(0, i - 1))} aria-label="Précédent">
            <ChevronLeft size={18} />
          </button>
          <span className="num min-w-[52px] text-center text-[12px] text-white/70">
            {index + 1} / {doc.slides.length}
          </span>
          <button className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white" onClick={() => setIndex((i) => Math.min(doc.slides.length - 1, i + 1))} aria-label="Suivant">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="hidden max-w-[50%] items-center gap-1 overflow-hidden sm:flex">
          {doc.slides.map((s, i) => (
            <button
              key={s.id}
              className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/60')}
              onClick={() => setIndex(i)}
              aria-label={`Diapositive ${i + 1}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            className={cn('flex h-8 items-center gap-1.5 rounded-full px-3 text-[11.5px]', notes ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white')}
            onClick={() => {
              if (!slide.notes) {
                toast('Aucune note pour cette diapositive.', 'info')
                return
              }
              setNotes((v) => !v)
            }}
          >
            <StickyNote size={14} /> Notes
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Quitter">
            <X size={18} />
          </button>
        </div>
      </div>

      {notes && (
        <div className="absolute bottom-[62px] right-4 max-h-[40vh] w-[min(420px,calc(100%-2rem))] overflow-y-auto rounded-[10px] border border-white/10 bg-[#191d23] p-4 text-[12.5px] leading-relaxed text-white/80 shadow-xl">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Notes</div>
          {slide.notes || 'Aucune note.'}
        </div>
      )}
    </div>
  )
}
