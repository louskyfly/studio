import { useState } from 'react'
import { Copy, Download, Ellipsis, FolderInput, Pencil, Star, Trash2 } from 'lucide-react'
import type { Presentation } from '../../lib/model'
import { levelLabel, subjectLabel } from '../../lib/model'
import { themeById } from '../../lib/themes'
import { SlideFrame, SlideView } from '../slide/SlideView'
import { cn, formatDate } from '../../lib/utils'
import { useApp } from '../../lib/store'
import { Button, ConfirmDialog, Field, Input, Menu, MenuItem, Modal, Select } from '../ui'
import { useExporter } from '../../lib/exporter'

export const PresentationCard = ({ doc, compact }: { doc: Presentation; compact?: boolean }) => {
  const navigate = useApp((s) => s.navigate)
  const rename = useApp((s) => s.renamePresentation)
  const duplicate = useApp((s) => s.duplicatePresentation)
  const toggleFavorite = useApp((s) => s.toggleFavorite)
  const remove = useApp((s) => s.deletePresentation)
  const move = useApp((s) => s.movePresentation)
  const folders = useApp((s) => s.folders)
  const openExport = useExporter((s) => s.openFor)
  const theme = themeById(doc.themeId)
  const cover = doc.slides[0]

  const [renaming, setRenaming] = useState(false)
  const [moving, setMoving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [title, setTitle] = useState(doc.title)
  const [folderId, setFolderId] = useState(doc.folderId ?? '')

  const folderName = folders.find((f) => f.id === doc.folderId)?.name

  return (
    <article className="group relative">
      <button className="card card-hover block w-full overflow-hidden text-left" onClick={() => navigate({ name: 'editor', id: doc.id })}>
        <div className="relative overflow-hidden border-b border-[var(--color-line)] bg-[#f1efe9]">
          {cover ? (
            <SlideFrame radius={0}>
              <div className="pointer-events-none select-none">
                <SlideView slide={cover} theme={theme} />
              </div>
            </SlideFrame>
          ) : (
            <div className="aspect-video" />
          )}
          {doc.favorite && (
            <span className="absolute left-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/92 text-[#b08a4a] shadow-sm">
              <Star size={12} fill="currentColor" />
            </span>
          )}
        </div>
        <div className={cn('px-3.5', compact ? 'py-2.5' : 'py-3')}>
          <h3 className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">{doc.title}</h3>
          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[var(--color-muted)]">
            <span className="truncate">
              {subjectLabel(doc.subject)} · {levelLabel(doc.level)}
            </span>
            {folderName && (
              <>
                <span className="opacity-40">·</span>
                <span className="truncate">{folderName}</span>
              </>
            )}
          </div>
          {!compact && (
            <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--color-faint)]">
              <span>{doc.slides.length} diapositives</span>
              <span>{formatDate(doc.updatedAt)}</span>
            </div>
          )}
        </div>
      </button>

      <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full bg-white/92 text-[var(--color-muted)] shadow-sm backdrop-blur transition hover:text-[#b08a4a]',
            doc.favorite && 'text-[#b08a4a]',
          )}
          onClick={(e) => {
            e.stopPropagation()
            void toggleFavorite(doc.id)
          }}
          aria-label={doc.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <Star size={13} fill={doc.favorite ? 'currentColor' : 'none'} />
        </button>
        <Menu
          align="end"
          trigger={({ toggle }) => (
            <button
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/92 text-[var(--color-ink-soft)] shadow-sm backdrop-blur hover:bg-white"
              onClick={(e) => {
                e.stopPropagation()
                toggle()
              }}
              aria-label="Options"
            >
              <Ellipsis size={14} />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon={<Pencil size={14} />}
                onClick={() => {
                  close()
                  setTitle(doc.title)
                  setRenaming(true)
                }}
              >
                Renommer
              </MenuItem>
              <MenuItem
                icon={<Copy size={14} />}
                onClick={() => {
                  close()
                  void duplicate(doc.id)
                }}
              >
                Dupliquer
              </MenuItem>
              <MenuItem
                icon={<FolderInput size={14} />}
                onClick={() => {
                  close()
                  setFolderId(doc.folderId ?? '')
                  setMoving(true)
                }}
              >
                Déplacer vers…
              </MenuItem>
              <MenuItem
                icon={<Download size={14} />}
                onClick={() => {
                  close()
                  openExport(doc)
                }}
              >
                Exporter
              </MenuItem>
              <div className="my-1 h-px bg-[var(--color-line)]" />
              <MenuItem
                icon={<Trash2 size={14} />}
                danger
                onClick={() => {
                  close()
                  setDeleting(true)
                }}
              >
                Supprimer
              </MenuItem>
            </>
          )}
        </Menu>
      </div>

      <Modal
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Renommer la présentation"
        width={430}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              disabled={!title.trim()}
              onClick={() => {
                void rename(doc.id, title)
                setRenaming(false)
              }}
            >
              Renommer
            </Button>
          </>
        }
      >
        <Field label="Titre">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && title.trim() && (void rename(doc.id, title), setRenaming(false))} />
        </Field>
      </Modal>

      <Modal
        open={moving}
        onClose={() => setMoving(false)}
        title="Déplacer vers un dossier"
        width={430}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMoving(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void move(doc.id, folderId || null)
                setMoving(false)
              }}
            >
              Déplacer
            </Button>
          </>
        }
      >
        <Field label="Dossier">
          <Select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">Aucun dossier (racine)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.parentId ? '— ' : ''}
                {f.name}
              </option>
            ))}
          </Select>
        </Field>
      </Modal>

      <ConfirmDialog
        open={deleting}
        title="Supprimer cette présentation ?"
        message={`« ${doc.title} » sera définitivement supprimée, avec ses versions. Cette action est irréversible.`}
        onClose={() => setDeleting(false)}
        onConfirm={() => void remove(doc.id)}
      />
    </article>
  )
}
