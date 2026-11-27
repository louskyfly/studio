import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Sparkles, TriangleAlert, WandSparkles } from 'lucide-react'
import { useApp } from '../../lib/store'
import { askAssistant } from '../../lib/ai/assistant'
import { describeAIError } from '../../lib/ai/providers'
import { Button, Spinner } from '../ui'
import { cn } from '../../lib/utils'

interface Msg {
  id: string
  role: 'user' | 'assistant' | 'error'
  text: string
}

const SUGGESTIONS = [
  'Raccourcis cette diapositive.',
  'Ajoute une explication plus claire.',
  'Transforme cette diapositive en frise chronologique.',
  'Harmonise le design de toute la présentation.',
  'Adapte le vocabulaire à des élèves de Troisième.',
]

export const AssistantPanel = () => {
  const current = useApp((s) => s.current)
  const selectedSlideId = useApp((s) => s.selectedSlideId)
  const applyDocument = useApp((s) => s.applyDocument)
  const toast = useApp((s) => s.toast)
  const settings = useApp((s) => s.settings)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [scope, setScope] = useState<'slide' | 'deck'>('slide')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const index = current?.slides.findIndex((s) => s.id === selectedSlideId) ?? 0
  const aiReady = settings.ai.provider === 'ollama' || Boolean(settings.ai.apiKey)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const send = async (text: string) => {
    const clean = text.trim()
    if (!clean || !current || busy) return
    setError(null)
    setInput('')
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: 'user', text: clean }])
    setBusy(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await askAssistant(settings.ai, current, clean, scope, Math.max(0, index), controller.signal)
      if (result.changed) {
        applyDocument(result.doc, 'Assistant IA')
        toast('Modification appliquée. Annulable avec Ctrl+Z.', 'success')
      } else {
        toast(result.reply, 'info')
      }
      setMessages((m) => [...m, { id: `a${Date.now()}`, role: 'assistant', text: result.reply }])
    } catch (err) {
      const msg = describeAIError(err)
      setError(msg)
      setMessages((m) => [...m, { id: `e${Date.now()}`, role: 'error', text: msg }])
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eef1f5] text-[var(--color-accent)]">
            <Sparkles size={13} />
          </span>
          <div>
            <div className="text-[12.5px] font-semibold">Assistant</div>
            <div className="text-[10.5px] text-[var(--color-faint)]">Il agit sur le document, pas seulement sur l’aperçu.</div>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-[8px] bg-[#eceae5] p-0.5">
          <button
            className={cn('rounded-[6px] py-1.5 text-[11px] font-medium transition', scope === 'slide' ? 'bg-white text-[var(--color-ink)] shadow-[var(--shadow-xs)]' : 'text-[var(--color-muted)]')}
            onClick={() => setScope('slide')}
          >
            Diapositive {index + 1}
          </button>
          <button
            className={cn('rounded-[6px] py-1.5 text-[11px] font-medium transition', scope === 'deck' ? 'bg-white text-[var(--color-ink)] shadow-[var(--shadow-xs)]' : 'text-[var(--color-muted)]')}
            onClick={() => setScope('deck')}
          >
            Toute la présentation
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3.5">
        {!messages.length && (
          <>
            <div className="rounded-[10px] bg-[#f7f6f2] px-3 py-2.5 text-[12px] leading-relaxed text-[var(--color-muted)]">
              Demandez une modification en français. L’assistant comprend la présentation entière et ne touche qu’à ce que vous demandez.
            </div>
            <div className="space-y-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="flex w-full items-start gap-1.5 rounded-[7px] px-2 py-1.5 text-left text-[11.5px] leading-snug text-[var(--color-ink-soft)] transition hover:bg-[#f3f1ec]"
                >
                  <WandSparkles size={12} className="mt-0.5 shrink-0 text-[var(--color-faint)]" />
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              'max-w-[95%] rounded-[10px] px-3 py-2 text-[12px] leading-relaxed',
              m.role === 'user'
                ? 'ml-auto bg-[var(--color-accent)] text-white'
                : m.role === 'error'
                  ? 'border border-[#e7c9c2] bg-[#fdf5f3] text-[#8a3226]'
                  : 'border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)]',
            )}
          >
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-[11.5px] text-[var(--color-muted)]">
            <Spinner size={13} /> Modification en cours…
          </div>
        )}
      </div>

      {!aiReady && (
        <div className="mx-3.5 mb-2 flex items-start gap-2 rounded-[8px] border border-[#e8dcc4] bg-[#fcf8ef] px-2.5 py-2 text-[11px] leading-snug text-[#7a5a1e]">
          <TriangleAlert size={13} className="mt-0.5 shrink-0" />
          <span>Connectez un modèle dans les réglages pour utiliser l’assistant.</span>
        </div>
      )}

      {error && (
        <div className="mx-3.5 mb-2 flex items-center justify-between gap-2 rounded-[8px] border border-[#e7c9c2] bg-[#fdf5f3] px-2.5 py-2 text-[11px] text-[#8a3226]">
          <span className="line-clamp-3">{error}</span>
          <button className="shrink-0 underline" onClick={() => setError(null)}>
            OK
          </button>
        </div>
      )}

      <div className="border-t border-[var(--color-line)] p-2.5">
        <div className="rounded-[10px] border border-[var(--color-line-strong)] bg-white p-1.5 focus-within:border-[#8ba3bd] focus-within:shadow-[0_0_0_3px_rgba(27,51,80,.07)]">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
            rows={2}
            placeholder={scope === 'slide' ? `Modifier la diapositive ${index + 1}…` : 'Modifier toute la présentation…'}
            className="w-full resize-none bg-transparent px-1.5 py-1 text-[12px] leading-relaxed outline-none placeholder:text-[#a5a29b]"
          />
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] text-[var(--color-faint)]">{busy ? '…' : 'Entrée pour envoyer'}</span>
            <Button variant="primary" className="h-7 w-7 rounded-full p-0" disabled={!input.trim() || busy || !aiReady} onClick={() => void send(input)} aria-label="Envoyer">
              <ArrowUp size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
