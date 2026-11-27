import { useEffect, useMemo, useState } from 'react'
import {
  ChevronRight,
  Clock,
  Ellipsis,
  Folder as FolderIcon,
  FolderPlus,
  Library,
  Pencil,
  Plus,
  Settings as SettingsIcon,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { useApp } from '../../lib/store'
import type { Folder } from '../../lib/model'
import { cn, formatBytes } from '../../lib/utils'
import { dbUsage } from '../../lib/db'
import { Button, ConfirmDialog, Field, IconButton, Input, Menu, MenuItem, Modal } from '../ui'

const Logo = () => (
  <div className="flex items-center gap-2.5">
    <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--color-accent)]">
      <svg width="17" height="17" viewBox="0 0 64 64" aria-hidden>
        <path d="M20 18h24M20 32h16M20 46h24" stroke="#F7F6F3" strokeWidth="6" strokeLinecap="round" />
        <circle cx="46" cy="32" r="4" fill="#C9A961" />
      </svg>
    </div>
    <span className="serif text-[19px] tracking-[-0.01em] text-[var(--color-ink)]">Studio</span>
  </div>
)

export const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => {
  const route = useApp((s) => s.route)
  const navigate = useApp((s) => s.navigate)
  const folders = useApp((s) => s.folders)
  const presentations = useApp((s) => s.presentations)
  const createFolder = useApp((s) => s.createFolder)
  const renameFolder = useApp((s) => s.renameFolder)
  const removeFolder = useApp((s) => s.removeFolder)
  const toast = useApp((s) => s.toast)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [creating, setCreating] = useState<{ parentId: string | null } | null>(null)
  const [renaming, setRenaming] = useState<Folder | null>(null)
  const [deleting, setDeleting] = useState<Folder | null>(null)
  const [name, setName] = useState('')
  const [usage, setUsage] = useState({ used: 0, quota: 0, persisted: false })

  useEffect(() => {
    dbUsage().then(setUsage).catch(() => {})
  }, [presentations.length])

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of presentations) if (p.folderId) map.set(p.folderId, (map.get(p.folderId) ?? 0) + 1)
    return map
  }, [presentations])

  const roots = folders.filter((f) => !f.parentId)
  const childrenOf = (id: string) => folders.filter((f) => f.parentId === id)
  const activeFolder = route.name === 'library' ? route.folderId : undefined
  const favorites = presentations.filter((p) => p.favorite).length
  const drafts = presentations.filter((p) => p.status === 'draft').length

  const go = (r: Parameters<typeof navigate>[0]) => {
    navigate(r)
    onNavigate?.()
  }

  const submitCreate = async () => {
    if (!name.trim()) return
    const folder = await createFolder(name, creating?.parentId ?? null)
    setExpanded((e) => ({ ...e, [folder.parentId ?? 'root']: true }))
    setCreating(null)
    setName('')
    toast('Dossier créé.', 'success')
  }

  const submitRename = async () => {
    if (!renaming) return
    await renameFolder(renaming.id, name)
    setRenaming(null)
    setName('')
  }

  const renderFolder = (folder: Folder, depth: number) => {
    const kids = childrenOf(folder.id)
    const isOpen = expanded[folder.id] ?? depth === 0
    const selected = activeFolder === folder.id
    return (
      <div key={folder.id}>
        <div
          className={cn('navitem group', selected && 'active')}
          style={{ paddingLeft: 8 + depth * 14 }}
          role="button"
          tabIndex={0}
          data-folder-id={folder.id}
          onClick={() => go({ name: 'library', folderId: folder.id })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              go({ name: 'library', folderId: folder.id })
            }
          }}
          onDoubleClick={() => {
            setName(folder.name)
            setRenaming(folder)
          }}
        >
          <button
            className={cn('flex h-4 w-4 items-center justify-center rounded text-[var(--color-faint)] transition-transform', kids.length ? 'opacity-100' : 'opacity-0', isOpen && 'rotate-90')}
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((s) => ({ ...s, [folder.id]: !isOpen }))
            }}
            aria-label="Déplier"
          >
            <ChevronRight size={12} />
          </button>
          <FolderIcon size={14} className="opacity-55" />
          <span className="truncate">{folder.name}</span>
          <span className="count">{counts.get(folder.id) ?? ''}</span>
          <Menu
            align="end"
            trigger={({ toggle }) => (
              <button
                className="ml-0.5 hidden h-6 w-6 items-center justify-center rounded text-[var(--color-faint)] hover:bg-black/5 hover:text-[var(--color-ink)] group-hover:flex"
                onClick={(e) => {
                  e.stopPropagation()
                  toggle()
                }}
                aria-label="Options du dossier"
              >
                <Ellipsis size={14} />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem
                  icon={<Plus size={14} />}
                  onClick={() => {
                    close()
                    setCreating({ parentId: folder.id })
                    setName('')
                  }}
                >
                  Sous-dossier
                </MenuItem>
                <MenuItem
                  icon={<Pencil size={14} />}
                  onClick={() => {
                    close()
                    setName(folder.name)
                    setRenaming(folder)
                  }}
                >
                  Renommer
                </MenuItem>
                <MenuItem
                  icon={<Trash2 size={14} />}
                  danger
                  onClick={() => {
                    close()
                    setDeleting(folder)
                  }}
                >
                  Supprimer
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
        {isOpen && kids.map((k) => renderFolder(k, depth + 1))}
      </div>
    )
  }

  return (
    <aside className="flex h-full w-[252px] shrink-0 flex-col border-r border-[var(--color-line)] bg-[#faf9f6]">
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <button onClick={() => go({ name: 'home' })} aria-label="Accueil">
          <Logo />
        </button>
        <IconButton label="Fermer le menu" className="lg:hidden" onClick={onNavigate}>
          <X size={16} />
        </IconButton>
      </div>

      <div className="px-3 pb-3">
        <Button variant="primary" className="w-full justify-start shadow-[0_1px_2px_rgba(20,22,26,.14)]" onClick={() => go({ name: 'generate', mode: 'topic' })}>
          <Plus size={16} />
          Nouvelle présentation
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="space-y-0.5">
          <button className={cn('navitem', route.name === 'home' && 'active')} onClick={() => go({ name: 'home' })}>
            <Library size={15} className="opacity-65" />
            Accueil
          </button>
          <button className={cn('navitem', route.name === 'library' && !activeFolder && 'active')} onClick={() => go({ name: 'library' })}>
            <FolderIcon size={15} className="opacity-65" />
            Toutes les présentations
            <span className="count">{presentations.length || ''}</span>
          </button>
          <button className={cn('navitem', route.name === 'drafts' && 'active')} onClick={() => go({ name: 'drafts' })}>
            <Clock size={15} className="opacity-65" />
            Brouillons
            <span className="count">{drafts || ''}</span>
          </button>
          <button className={cn('navitem', route.name === 'favorites' && 'active')} onClick={() => go({ name: 'favorites' })}>
            <Star size={15} className="opacity-65" />
            Favoris
            <span className="count">{favorites || ''}</span>
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between px-2 pb-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-faint)]">Dossiers</span>
          <button
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--color-faint)] hover:bg-black/5 hover:text-[var(--color-ink)]"
            onClick={() => {
              setCreating({ parentId: null })
              setName('')
            }}
            aria-label="Nouveau dossier"
            title="Nouveau dossier"
          >
            <FolderPlus size={14} />
          </button>
        </div>
        <div className="space-y-0.5">{roots.map((f) => renderFolder(f, 0))}</div>
        {!roots.length && (
          <button
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-[var(--color-muted)] hover:bg-black/[0.035]"
            onClick={() => setCreating({ parentId: null })}
          >
            <Plus size={13} /> Créer un premier dossier
          </button>
        )}
      </nav>

      <div className="border-t border-[var(--color-line)] px-2 py-2">
        <button className={cn('navitem', route.name === 'settings' && 'active')} onClick={() => go({ name: 'settings' })}>
          <SettingsIcon size={15} className="opacity-65" />
          Réglages
        </button>
        <div className="px-2.5 pb-1 pt-1.5">
          <div className="flex items-center justify-between text-[10.5px] text-[var(--color-faint)]">
            <span>Stockage local</span>
            <span className="num">{formatBytes(usage.used)}</span>
          </div>
          <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[#e7e3da]">
            <div className="h-full rounded-full bg-[#b9c4d1]" style={{ width: `${Math.min(100, (usage.used / Math.max(1, usage.quota)) * 100)}%` }} />
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(creating)}
        onClose={() => setCreating(null)}
        title={creating?.parentId ? 'Nouveau sous-dossier' : 'Nouveau dossier'}
        description="Les dossiers peuvent être imbriqués (par exemple : Histoire › Sixième)."
        width={420}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(null)}>
              Annuler
            </Button>
            <Button variant="primary" onClick={submitCreate} disabled={!name.trim()}>
              Créer
            </Button>
          </>
        }
      >
        <Field label="Nom du dossier">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitCreate()} placeholder="Ex. Seconde — Rome" />
        </Field>
      </Modal>

      <Modal
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        title="Renommer le dossier"
        width={420}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Annuler
            </Button>
            <Button variant="primary" onClick={submitRename} disabled={!name.trim()}>
              Renommer
            </Button>
          </>
        }
      >
        <Field label="Nom">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitRename()} />
        </Field>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Supprimer ce dossier ?"
        message={`Le dossier « ${deleting?.name ?? ''} » et ses sous-dossiers seront supprimés. Les présentations ne sont pas effacées : elles reviennent à la racine.`}
        confirmLabel="Supprimer le dossier"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void removeFolder(deleting.id)
        }}
      />
    </aside>
  )
}
