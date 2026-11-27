import { useMemo, useState } from 'react'
import { ArrowLeft, FileText, LayoutGrid, List, Plus, Search, SlidersHorizontal, Star, X } from 'lucide-react'
import { useApp } from '../../lib/store'
import { LEVELS, SUBJECTS, levelLabel, presentationText, subjectLabel, type Level, type Subject } from '../../lib/model'
import { PresentationCard } from './PresentationCard'
import { Button, EmptyState, IconButton, Input, Select } from '../ui'
import { cn, formatDate, plural } from '../../lib/utils'
import { themeById } from '../../lib/themes'
import { SlideFrame, SlideView } from '../slide/SlideView'

type Sort = 'updated' | 'created' | 'title'

export const Library = () => {
  const route = useApp((s) => s.route)
  const presentations = useApp((s) => s.presentations)
  const folders = useApp((s) => s.folders)
  const navigate = useApp((s) => s.navigate)
  const toggleFavorite = useApp((s) => s.toggleFavorite)

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('updated')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [subject, setSubject] = useState<Subject | ''>('')
  const [level, setLevel] = useState<Level | ''>('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const folderId = route.name === 'library' ? (route.folderId ?? null) : null
  const folder = folderId ? folders.find((f) => f.id === folderId) : null

  const ancestors = useMemo(() => {
    const chain = [] as typeof folders
    let cur = folder
    while (cur) {
      chain.unshift(cur)
      cur = cur.parentId ? folders.find((f) => f.id === cur!.parentId) ?? null : null
    }
    return chain
  }, [folder, folders])

  const scoped = useMemo(() => {
    let list = presentations
    if (route.name === 'favorites') list = list.filter((p) => p.favorite)
    else if (route.name === 'drafts') list = list.filter((p) => p.status === 'draft')
    else if (folderId) {
      const ids = new Set<string>([folderId])
      let grew = true
      while (grew) {
        grew = false
        for (const f of folders) {
          if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
            ids.add(f.id)
            grew = true
          }
        }
      }
      list = list.filter((p) => p.folderId && ids.has(p.folderId))
    }
    return list
  }, [presentations, route.name, folderId, folders])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = scoped
    if (q) list = list.filter((p) => presentationText(p).toLowerCase().includes(q))
    if (subject) list = list.filter((p) => p.subject === subject)
    if (level) list = list.filter((p) => p.level === level)
    return [...list].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'fr')
      if (sort === 'created') return a.createdAt < b.createdAt ? 1 : -1
      return a.updatedAt < b.updatedAt ? 1 : -1
    })
  }, [scoped, query, subject, level, sort])

  const title = route.name === 'favorites' ? 'Favoris' : route.name === 'drafts' ? 'Brouillons' : folder?.name ?? 'Toutes les présentations'
  const subtitle =
    route.name === 'favorites'
      ? 'Les présentations que vous gardez sous la main.'
      : route.name === 'drafts'
        ? 'Les présentations encore en travail.'
        : folder
          ? 'Dossier de la bibliothèque.'
          : 'Votre bibliothèque personnelle de cours et de supports.'

  return (
    <div className="mx-auto w-full max-w-[1220px] px-5 pb-28 pt-7 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {ancestors.length > 1 && (
            <div className="mb-1.5 flex flex-wrap items-center gap-1 text-[11.5px] text-[var(--color-faint)]">
              <button className="hover:text-[var(--color-ink)]" onClick={() => navigate({ name: 'library' })}>
                Bibliothèque
              </button>
              {ancestors.map((a, i) => (
                <span key={a.id} className="flex items-center gap-1">
                  <span className="opacity-50">/</span>
                  {i === ancestors.length - 1 ? (
                    <span className="text-[var(--color-muted)]">{a.name}</span>
                  ) : (
                    <button className="hover:text-[var(--color-ink)]" onClick={() => navigate({ name: 'library', folderId: a.id })}>
                      {a.name}
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          <h1 className="serif truncate text-[28px] leading-tight tracking-[-0.015em] sm:text-[32px]">{title}</h1>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            {subtitle} <span className="text-[var(--color-faint)]">·</span> {plural(filtered.length, 'présentation', 'présentations')}
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate({ name: 'generate', mode: 'topic' })}>
          <Plus size={15} /> Nouvelle présentation
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-[360px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un titre, un contenu…" className="pl-9 pr-8" />
          {query && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--color-faint)] hover:text-[var(--color-ink)]" onClick={() => setQuery('')} aria-label="Effacer">
              <X size={13} />
            </button>
          )}
        </div>

        <Button variant="secondary" className={cn('h-9', (subject || level) && 'border-[#b8c7d8] bg-[#f5f8fb] text-[var(--color-accent)]')} onClick={() => setFiltersOpen((v) => !v)}>
          <SlidersHorizontal size={14} /> Filtres
          {subject || level ? <span className="ml-0.5 rounded-full bg-[var(--color-accent)] px-1.5 text-[10px] text-white">{(subject ? 1 : 0) + (level ? 1 : 0)}</span> : null}
        </Button>

        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 w-auto min-w-[150px]">
          <option value="updated">Modifié récemment</option>
          <option value="created">Créé récemment</option>
          <option value="title">Titre (A–Z)</option>
        </Select>

        <div className="segmented ml-auto">
          <button aria-pressed={view === 'grid'} onClick={() => setView('grid')} title="Grille">
            <LayoutGrid size={14} />
          </button>
          <button aria-pressed={view === 'list'} onClick={() => setView('list')} title="Liste">
            <List size={14} />
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[10px] border border-[var(--color-line)] bg-[#fbfaf7] px-3 py-2.5">
          <Select value={subject} onChange={(e) => setSubject(e.target.value as Subject | '')} className="h-8 w-auto">
            <option value="">Toutes les matières</option>
            {SUBJECTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select value={level} onChange={(e) => setLevel(e.target.value as Level | '')} className="h-8 w-auto">
            <option value="">Tous les niveaux</option>
            {LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
          {(subject || level) && (
            <button
              className="text-[12px] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              onClick={() => {
                setSubject('')
                setLevel('')
              }}
            >
              Réinitialiser
            </button>
          )}
          <span className="ml-auto text-[11.5px] text-[var(--color-faint)]">
            {subject ? subjectLabel(subject) : 'Toutes matières'} · {level ? levelLabel(level) : 'Tous niveaux'}
          </span>
        </div>
      )}

      {route.name === 'library' && folderId && (
        <button className="mt-4 flex items-center gap-1 text-[12px] text-[var(--color-muted)] hover:text-[var(--color-ink)]" onClick={() => navigate({ name: 'library' })}>
          <ArrowLeft size={13} /> Retour à toute la bibliothèque
        </button>
      )}

      <div className="mt-5">
        {!filtered.length ? (
          scoped.length && (query || subject || level) ? (
            <EmptyState
              icon={<Search size={19} />}
              title="Aucun résultat"
              message="Essayez un autre mot-clé ou retirez un filtre. La recherche porte sur les titres et sur le texte des diapositives."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('')
                    setSubject('')
                    setLevel('')
                  }}
                >
                  Effacer les filtres
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<FileText size={19} />}
              title={route.name === 'favorites' ? 'Aucun favori' : route.name === 'drafts' ? 'Aucun brouillon' : 'Ce dossier est vide'}
              message="Créez une présentation et rangez-la ici. Les dossiers peuvent contenir des sous-dossiers."
              action={
                <Button variant="primary" onClick={() => navigate({ name: 'generate', mode: 'topic' })}>
                  <Plus size={15} /> Créer une présentation
                </Button>
              }
            />
          )
        ) : view === 'grid' ? (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((doc) => (
              <PresentationCard key={doc.id} doc={doc} />
            ))}
          </div>
        ) : (
          <div className="card divide-y divide-[var(--color-line)] overflow-hidden">
            {filtered.map((doc) => {
              const theme = themeById(doc.themeId)
              return (
                <div
                  key={doc.id}
                  className="group flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-[#fbfaf7]"
                  onClick={() => navigate({ name: 'editor', id: doc.id })}
                >
                  <div className="w-[92px] shrink-0 overflow-hidden rounded-[6px] border border-[var(--color-line)]">
                    {doc.slides[0] ? (
                      <SlideFrame>
                        <div className="pointer-events-none select-none">
                          <SlideView slide={doc.slides[0]} theme={theme} />
                        </div>
                      </SlideFrame>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-semibold">{doc.title}</span>
                      {doc.favorite && <Star size={11} className="shrink-0 text-[#b08a4a]" fill="currentColor" />}
                    </div>
                    <div className="mt-0.5 truncate text-[11.5px] text-[var(--color-muted)]">
                      {subjectLabel(doc.subject)} · {levelLabel(doc.level)} · {plural(doc.slides.length, 'diapositive', 'diapositives')}
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-[11.5px] text-[var(--color-faint)] sm:block">{formatDate(doc.updatedAt)}</div>
                  <IconButton
                    label={doc.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    className={cn('opacity-0 group-hover:opacity-100', doc.favorite && 'text-[#b08a4a] opacity-100')}
                    onClick={(e) => {
                      e.stopPropagation()
                      void toggleFavorite(doc.id)
                    }}
                  >
                    <Star size={14} fill={doc.favorite ? 'currentColor' : 'none'} />
                  </IconButton>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
