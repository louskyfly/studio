import { useEffect, useState } from 'react'
import { CircleCheck, Clock, RotateCcw, Save } from 'lucide-react'
import { useApp } from '../../lib/store'
import { THEMES, themeById } from '../../lib/themes'
import { applyThemeToDoc } from '../../lib/layouts'
import { dbListVersions, type Version } from '../../lib/db'
import { BACKGROUND_PRESETS } from '../../lib/elements'
import { formatDate } from '../../lib/utils'
import { Switch } from '../ui'
import { BackgroundSwatch } from './BackgroundSwatch'

export const DesignPanel = () => {
  const current = useApp((s) => s.current)
  const updateCurrent = useApp((s) => s.updateCurrent)
  const updateSlide = useApp((s) => s.updateSlide)
  const selectedSlideId = useApp((s) => s.selectedSlideId)
  const applyDocument = useApp((s) => s.applyDocument)
  const saveNow = useApp((s) => s.saveNow)
  const toast = useApp((s) => s.toast)
  const [versions, setVersions] = useState<Version[]>([])
  const [busy, setBusy] = useState(false)

  const theme = themeById(current?.themeId ?? 'ivoire')
  const slide = current?.slides.find((s) => s.id === selectedSlideId)

  const loadVersions = async () => {
    if (!current) return
    try {
      setVersions(await dbListVersions(current.id))
    } catch {
      setVersions([])
    }
  }

  useEffect(() => {
    void loadVersions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  if (!current) return null

  const applyTheme = (id: string) => {
    if (id === current.themeId) return
    const to = themeById(id)
    updateCurrent((doc) => {
      const next = applyThemeToDoc(doc, theme, to)
      doc.themeId = next.themeId
      doc.slides = next.slides
    })
    toast(`Thème « ${to.name} » appliqué à toute la présentation.`, 'success')
  }

  return (
    <div className="pb-10">
      <div className="border-b border-[var(--color-line)] px-4 py-3.5">
        <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-[var(--color-faint)]">Thème de la présentation</h3>
        <p className="mt-1 text-[11px] leading-snug text-[var(--color-muted)]">Couleurs et polices de toutes les diapositives. Le contenu et la mise en page sont conservés.</p>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => applyTheme(t.id)}
              className={`flex items-center gap-2 rounded-[8px] border px-2 py-1.5 text-left transition ${
                current.themeId === t.id ? 'border-[var(--color-accent)] bg-[#f5f8fb]' : 'border-[var(--color-line)] hover:border-[var(--color-line-strong)]'
              }`}
            >
              <span className="flex h-6 w-8 shrink-0 flex-col justify-center gap-[2px] rounded-[3px] border border-black/10 px-1" style={{ background: t.bg }}>
                <span className="h-[2px] w-3 rounded-full" style={{ background: t.accent }} />
                <span className="h-[1.5px] w-4 rounded-full opacity-40" style={{ background: t.ink }} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium">{t.name}</span>
              {current.themeId === t.id && <CircleCheck size={11} className="shrink-0 text-[var(--color-accent)]" />}
            </button>
          ))}
        </div>
      </div>

      {slide && (
        <div className="border-b border-[var(--color-line)] px-4 py-3.5">
          <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-[var(--color-faint)]">Fond de la diapositive</h3>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {BACKGROUND_PRESETS(theme).map((p) => (
              <BackgroundSwatch
                key={p.id}
                bg={p.bg}
                theme={theme}
                title={p.label}
                selected={JSON.stringify(slide.background) === JSON.stringify(p.bg)}
                onClick={() =>
                  updateSlide(slide.id, (s) => {
                    s.background = p.bg
                  })
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className="border-b border-[var(--color-line)] px-4 py-3.5">
        <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-[var(--color-faint)]">Options</h3>
        <div className="mt-2.5 space-y-2.5">
          <Switch
            checked={current.options?.showSlideNumbers ?? true}
            onChange={(v) =>
              updateCurrent((doc) => {
                doc.options = { ...doc.options, showSlideNumbers: v }
              })
            }
            label="Numéroter les diapositives"
          />
          <Switch
            checked={current.status === 'ready'}
            onChange={(v) =>
              updateCurrent((doc) => {
                doc.status = v ? 'ready' : 'draft'
              })
            }
            label="Marquer comme prête"
          />
        </div>
      </div>

      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-[var(--color-faint)]">Historique</h3>
          <button
            className="flex items-center gap-1 text-[10.5px] font-medium text-[var(--color-accent)] hover:underline"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await saveNow('Version manuelle')
              await loadVersions()
              setBusy(false)
              toast('Version enregistrée.', 'success')
            }}
          >
            <Save size={11} /> Enregistrer
          </button>
        </div>
        <div className="mt-2 space-y-1">
          {versions.slice(0, 8).map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-2 rounded-[6px] px-1.5 py-1 text-[11px] hover:bg-[#f7f6f2]">
              <div className="min-w-0">
                <div className="truncate text-[var(--color-ink-soft)]">{v.label}</div>
                <div className="text-[10px] text-[var(--color-faint)]">{formatDate(v.createdAt)}</div>
              </div>
              <button
                className="flex shrink-0 items-center gap-1 text-[10.5px] text-[var(--color-accent)] hover:underline"
                onClick={() => {
                  applyDocument(v.doc, 'Avant restauration')
                  toast('Version restaurée.', 'success')
                }}
              >
                <RotateCcw size={11} /> Restaurer
              </button>
            </div>
          ))}
          {!versions.length && (
            <div className="flex items-center gap-1.5 px-1 py-1 text-[11px] text-[var(--color-faint)]">
              <Clock size={11} /> Les versions apparaissent après une génération ou un enregistrement manuel.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
