import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  CircleAlert,
  Copy,
  Download,
  Ellipsis,
  FileDown,
  History,
  Palette,
  PanelLeft,
  PanelRight,
  Play,
  Redo2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useApp } from '../../lib/store'
import { Canvas } from './Canvas'
import { SlideRail } from './SlideRail'
import { Inspector } from './Inspector'
import { AssistantPanel } from './AssistantPanel'
import { DesignPanel } from './DesignPanel'
import { PresentMode } from './PresentMode'
import { Button, ConfirmDialog, IconButton, Menu, MenuItem, Spinner } from '../ui'
import { cn, downloadBlob } from '../../lib/utils'
import { useExporter } from '../../lib/exporter'
import { exportPresentation } from '../../lib/backup'

type Tab = 'props' | 'ai' | 'design'

export const Editor = () => {
  const current = useApp((s) => s.current)
  const route = useApp((s) => s.route)
  const navigate = useApp((s) => s.navigate)
  const saveState = useApp((s) => s.saveState)
  const lastSavedAt = useApp((s) => s.lastSavedAt)
  const undo = useApp((s) => s.undo)
  const redo = useApp((s) => s.redo)
  const past = useApp((s) => s.past)
  const future = useApp((s) => s.future)
  const saveNow = useApp((s) => s.saveNow)
  const updateCurrent = useApp((s) => s.updateCurrent)
  const duplicatePresentation = useApp((s) => s.duplicatePresentation)
  const deletePresentation = useApp((s) => s.deletePresentation)
  const openExport = useExporter((s) => s.openFor)
  const toast = useApp((s) => s.toast)
  const selectedSlideId = useApp((s) => s.selectedSlideId)

  const [tab, setTab] = useState<Tab>('props')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showSlides, setShowSlides] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const title = current?.title

  useEffect(() => {
    if (!title) return
    document.title = `${title} — Studio`
    return () => {
      document.title = 'Studio'
    }
  }, [title])

  useEffect(() => {
    setEditingId(null)
  }, [selectedSlideId])

  if (!current) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[var(--color-muted)]">
          <Spinner size={20} />
          <span className="text-[12.5px]">Ouverture de la présentation…</span>
          <Button variant="ghost" onClick={() => navigate({ name: 'library' })}>
            Retour à la bibliothèque
          </Button>
        </div>
      </div>
    )
  }

  const presentIndex = Math.max(0, current.slides.findIndex((s) => s.id === selectedSlideId))
  const status = () => {
    if (saveState === 'saving') return { icon: <Spinner size={12} />, text: 'Enregistrement…', tone: 'text-[var(--color-muted)]' }
    if (saveState === 'dirty') return { icon: <span className="h-1.5 w-1.5 rounded-full bg-[#c99a3f]" />, text: 'Modifications en cours', tone: 'text-[#9a6b1f]' }
    if (saveState === 'error') return { icon: <CircleAlert size={12} />, text: 'Non enregistré', tone: 'text-[var(--color-danger)]' }
    return {
      icon: <span className="h-1.5 w-1.5 rounded-full bg-[#5a9a75]" />,
      text: lastSavedAt ? `Enregistré ${new Date(lastSavedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Enregistré',
      tone: 'text-[var(--color-muted)]',
    }
  }
  const s = status()

  const present = () => {
    void saveNow()
    navigate({ name: 'present', id: current.id })
  }

  return (
    <div className="flex h-full flex-col bg-[#e9e7e1]">
      <header className="z-30 flex h-[52px] shrink-0 items-center gap-1.5 border-b border-[var(--color-line)] bg-white px-2.5">
        <IconButton label="Retour à la bibliothèque" onClick={() => navigate({ name: 'library', folderId: current.folderId })}>
          <ArrowLeft size={17} />
        </IconButton>
        <IconButton label="Diapositives" className="xl:hidden" onClick={() => setShowSlides(true)}>
          <PanelLeft size={16} />
        </IconButton>

        <div className="min-w-0 flex-1 px-1">
          <input
            value={current.title}
            onChange={(e) =>
              updateCurrent(
                (doc) => {
                  doc.title = e.target.value
                },
                { coalesce: 'title' },
              )
            }
            onBlur={() => void saveNow()}
            className="w-full truncate rounded-[5px] border border-transparent bg-transparent px-1.5 py-1 text-[13.5px] font-semibold tracking-[-0.01em] outline-none transition hover:border-[var(--color-line)] focus:border-[#8ba3bd] focus:bg-white"
            aria-label="Titre de la présentation"
          />
        </div>

        <div className={cn('mr-1 hidden items-center gap-1.5 text-[11px] sm:flex', s.tone)}>
          {s.icon}
          <span className="hidden md:inline">{s.text}</span>
        </div>

        <div className="flex items-center gap-0.5">
          <IconButton label="Annuler (Ctrl+Z)" onClick={undo} disabled={!past.length}>
            <Undo2 size={15} />
          </IconButton>
          <IconButton label="Rétablir (Ctrl+Maj+Z)" onClick={redo} disabled={!future.length}>
            <Redo2 size={15} />
          </IconButton>
          <div className="mx-0.5 h-5 w-px bg-[var(--color-line)]" />
          <Button variant="secondary" className="hidden h-8 sm:flex" onClick={present}>
            <Play size={13} /> Présenter
          </Button>
          <IconButton label="Présenter" className="sm:hidden" onClick={present}>
            <Play size={15} />
          </IconButton>
          <Button variant="primary" className="hidden h-8 sm:flex" onClick={() => openExport(current)}>
            <Download size={14} /> Exporter
          </Button>
          <IconButton label="Exporter" className="sm:hidden" onClick={() => openExport(current)}>
            <Download size={15} />
          </IconButton>
          <IconButton label="Panneau de droite" className="xl:hidden" onClick={() => setShowPanel(true)}>
            <PanelRight size={16} />
          </IconButton>

          <Menu
            align="end"
            trigger={({ toggle }) => (
              <IconButton label="Plus d’options" onClick={toggle}>
                <Ellipsis size={16} />
              </IconButton>
            )}
          >
            {(close) => (
              <>
                <MenuItem
                  icon={<Copy size={14} />}
                  onClick={() => {
                    close()
                    void duplicatePresentation(current.id)
                  }}
                >
                  Dupliquer la présentation
                </MenuItem>
                <MenuItem
                  icon={<History size={14} />}
                  onClick={() => {
                    close()
                    setTab('design')
                    setShowPanel(true)
                  }}
                >
                  Historique des versions
                </MenuItem>
                <MenuItem
                  icon={<FileDown size={14} />}
                  onClick={() => {
                    close()
                    downloadBlob(exportPresentation(current), `${current.title.replace(/[^\w\s-]/g, '').slice(0, 50) || 'presentation'}.studio.json`)
                    toast('Fichier Studio téléchargé.', 'success')
                  }}
                >
                  Fichier Studio (.json)
                </MenuItem>
                <MenuItem
                  icon={<Palette size={14} />}
                  onClick={() => {
                    close()
                    setTab('design')
                    setShowPanel(true)
                  }}
                >
                  Design et thème
                </MenuItem>
                <div className="my-1 h-px bg-[var(--color-line)]" />
                <MenuItem
                  icon={<Trash2 size={14} />}
                  danger
                  onClick={() => {
                    close()
                    setConfirmDelete(true)
                  }}
                >
                  Supprimer
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="hidden xl:flex">
          <SlideRail onNavigate={() => setShowSlides(false)} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <Canvas editingId={editingId} setEditingId={setEditingId} />
        </div>

        <aside className="hidden w-[320px] shrink-0 flex-col border-l border-[var(--color-line)] bg-white xl:flex">
          <div className="grid shrink-0 grid-cols-3 border-b border-[var(--color-line)]">
            {[
              { id: 'props' as Tab, icon: <SlidersHorizontal size={14} />, label: 'Propriétés' },
              { id: 'ai' as Tab, icon: <Sparkles size={14} />, label: 'Assistant' },
              { id: 'design' as Tab, icon: <Palette size={14} />, label: 'Design' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center justify-center gap-1.5 border-b-2 py-2.5 text-[11.5px] font-medium transition',
                  tab === t.id ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]',
                )}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{tab === 'props' ? <Inspector onEditText={(id) => setEditingId(id)} /> : tab === 'ai' ? <AssistantPanel /> : <DesignPanel />}</div>
        </aside>
      </div>

      {/* tiroirs mobiles */}
      {showSlides && (
        <div className="fixed inset-0 z-[60] flex xl:hidden">
          <div className="absolute inset-0 bg-black/25" onClick={() => setShowSlides(false)} />
          <div className="relative h-full animate-fade-in">
            <SlideRail onNavigate={() => setShowSlides(false)} />
          </div>
        </div>
      )}
      {showPanel && (
        <div className="fixed inset-0 z-[60] flex justify-end xl:hidden">
          <div className="absolute inset-0 bg-black/25" onClick={() => setShowPanel(false)} />
          <div className="relative flex h-full w-[min(330px,88vw)] flex-col bg-white shadow-[-10px_0_40px_rgba(0,0,0,.15)]">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-3 py-2">
              <div className="grid flex-1 grid-cols-3">
                {[
                  { id: 'props' as Tab, icon: <SlidersHorizontal size={13} />, label: 'Props' },
                  { id: 'ai' as Tab, icon: <Sparkles size={13} />, label: 'IA' },
                  { id: 'design' as Tab, icon: <Palette size={13} />, label: 'Design' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn('flex items-center justify-center gap-1 rounded-[6px] py-1.5 text-[11px]', tab === t.id ? 'bg-[#eef1f5] font-medium text-[var(--color-accent)]' : 'text-[var(--color-muted)]')}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
              <button className="ml-1 rounded p-1.5 text-[var(--color-faint)] hover:bg-black/5" onClick={() => setShowPanel(false)} aria-label="Fermer">
                <ArrowLeft size={15} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{tab === 'props' ? <Inspector onEditText={(id) => setEditingId(id)} /> : tab === 'ai' ? <AssistantPanel /> : <DesignPanel />}</div>
          </div>
        </div>
      )}

      {route.name === 'present' && (
        <PresentMode
          doc={current}
          startIndex={presentIndex}
          onClose={() => {
            navigate({ name: 'editor', id: current.id })
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cette présentation ?"
        message={`« ${current.title} » sera définitivement supprimée. Cette action est irréversible.`}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void deletePresentation(current.id)}
      />
    </div>
  )
}
