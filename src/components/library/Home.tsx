import { useMemo } from 'react'
import { ArrowRight, BookOpen, Folder, FileText, Sparkles, Type, Clock, Star, Presentation as PresentationIcon } from 'lucide-react'
import { useApp } from '../../lib/store'
import { PresentationCard } from './PresentationCard'
import { Button } from '../ui'
import { formatDate, plural } from '../../lib/utils'
import type { CreateMode } from '../../lib/model'

const MODES: { mode: CreateMode; icon: React.ReactNode; title: string; text: string; hint: string }[] = [
  {
    mode: 'topic',
    icon: <Sparkles size={19} />,
    title: 'À partir d’un sujet',
    text: '« La romanisation de l’Empire romain, pour une Seconde. »',
    hint: 'L’IA construit la problématique, le plan et les diapositives.',
  },
  {
    mode: 'documents',
    icon: <FileText size={19} />,
    title: 'À partir de documents',
    text: 'PDF, Word, PowerPoint, images, texte.',
    hint: 'Le diaporama respecte strictement le contenu fourni.',
  },
  {
    mode: 'notes',
    icon: <Type size={19} />,
    title: 'À partir de vos notes',
    text: 'Un plan, un cours, des idées en vrac.',
    hint: 'Studio organise et met en forme sans rien inventer.',
  },
]

export const Home = () => {
  const presentations = useApp((s) => s.presentations)
  const folders = useApp((s) => s.folders)
  const navigate = useApp((s) => s.navigate)
  const settings = useApp((s) => s.settings)

  const recent = useMemo(() => [...presentations].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 4), [presentations])
  const favorites = presentations.filter((p) => p.favorite).slice(0, 4)
  const folderCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of presentations) if (p.folderId) map.set(p.folderId, (map.get(p.folderId) ?? 0) + 1)
    return map
  }, [presentations])

  const aiReady = settings.ai.provider === 'ollama' || Boolean(settings.ai.apiKey)
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="mx-auto w-full max-w-[1220px] px-5 pb-28 pt-7 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-faint)]">{today}</div>
          <h1 className="serif mt-1.5 text-[31px] leading-tight tracking-[-0.015em] text-[var(--color-ink)] sm:text-[36px]">Votre studio pédagogique</h1>
          <p className="mt-1.5 max-w-[560px] text-[13.5px] leading-relaxed text-[var(--color-muted)]">
            Créez un diaporama, retrouvez vos cours, modifiez chaque détail et exportez en PowerPoint.
          </p>
        </div>
        <Button variant="primary" className="h-9 px-3.5" onClick={() => navigate({ name: 'generate', mode: 'topic' })}>
          <Sparkles size={15} />
          Nouvelle présentation
        </Button>
      </div>

      {!aiReady && (
        <button
          onClick={() => navigate({ name: 'settings' })}
          className="mt-5 flex w-full items-center gap-3 rounded-[11px] border border-[#e8dcc4] bg-[#fcf8ef] px-4 py-2.5 text-left transition hover:border-[#dccba8]"
        >
          <Sparkles size={15} className="text-[#9a6b1f]" />
          <span className="flex-1 text-[12.5px] leading-snug text-[#7a5a1e]">
            <strong className="font-semibold">L’IA n’est pas encore connectée.</strong> Ajoutez une clé Gemini gratuite ou lancez Ollama pour générer réellement des présentations.
          </span>
          <span className="flex items-center gap-1 text-[12px] font-semibold text-[#7a5a1e]">
            Configurer <ArrowRight size={13} />
          </span>
        </button>
      )}

      <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
        {MODES.map((m) => (
          <button
            key={m.mode}
            onClick={() => navigate({ name: 'generate', mode: m.mode })}
            className="card card-hover group relative overflow-hidden p-4 text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-[#eef1f5] text-[var(--color-accent)] transition group-hover:bg-[var(--color-accent)] group-hover:text-white">
              {m.icon}
            </div>
            <div className="mt-3 text-[14px] font-semibold tracking-[-0.01em]">{m.title}</div>
            <div className="mt-1 text-[12px] leading-snug text-[var(--color-muted)]">{m.text}</div>
            <div className="mt-2.5 text-[11.5px] leading-snug text-[var(--color-faint)]">{m.hint}</div>
            <ArrowRight size={15} className="absolute right-3.5 top-4 text-[var(--color-faint)] opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
          </button>
        ))}
      </div>

      {!presentations.length ? (
        <div className="card mt-7 px-6 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#efece5] text-[var(--color-muted)]">
            <PresentationIcon size={21} />
          </div>
          <h2 className="serif mt-3.5 text-[20px]">Votre bibliothèque est vide</h2>
          <p className="mx-auto mt-1.5 max-w-[430px] text-[13px] leading-relaxed text-[var(--color-muted)]">
            Commencez par un sujet, un document ou vos notes. Tout est enregistré sur cet appareil, automatiquement, sans compte ni abonnement.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button variant="primary" onClick={() => navigate({ name: 'generate', mode: 'topic' })}>
              <Sparkles size={15} /> Créer ma première présentation
            </Button>
            <Button variant="ghost" onClick={() => navigate({ name: 'settings' })}>
              Voir les réglages IA
            </Button>
          </div>
        </div>
      ) : (
        <>
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-[var(--color-faint)]" />
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--color-muted)]">Reprendre</h2>
              </div>
              <button className="flex items-center gap-1 text-[12px] font-medium text-[var(--color-accent)] hover:underline" onClick={() => navigate({ name: 'library' })}>
                Tout voir <ArrowRight size={12} />
              </button>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
              {recent.map((doc) => (
                <PresentationCard key={doc.id} doc={doc} compact />
              ))}
            </div>
          </section>

          <section className="mt-9">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Folder size={14} className="text-[var(--color-faint)]" />
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--color-muted)]">Dossiers</h2>
              </div>
              <button className="flex items-center gap-1 text-[12px] font-medium text-[var(--color-accent)] hover:underline" onClick={() => navigate({ name: 'library' })}>
                Toute la bibliothèque <ArrowRight size={12} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {folders
                .filter((f) => !f.parentId)
                .slice(0, 5)
                .map((f) => (
                  <button
                    key={f.id}
                    className="card card-hover flex items-center gap-3 px-3.5 py-3 text-left"
                    onClick={() => navigate({ name: 'library', folderId: f.id })}
                  >
                    <Folder size={17} className="shrink-0 text-[#b08a4a]" />
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-medium">{f.name}</div>
                      <div className="text-[11px] text-[var(--color-faint)]">{plural(folderCounts.get(f.id) ?? 0, 'présentation', 'présentations')}</div>
                    </div>
                  </button>
                ))}
              {!folders.length && (
                <div className="col-span-2 text-[12.5px] text-[var(--color-muted)] sm:col-span-3 lg:col-span-5">
                  Créez vos dossiers depuis la barre latérale : Histoire, Géographie, EMC, Sixième, Seconde…
                </div>
              )}
            </div>
          </section>

          {favorites.length > 0 && (
            <section className="mt-9">
              <div className="mb-3 flex items-center gap-2">
                <Star size={14} className="text-[#b08a4a]" />
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--color-muted)]">Favoris</h2>
              </div>
              <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
                {favorites.map((doc) => (
                  <PresentationCard key={doc.id} doc={doc} compact />
                ))}
              </div>
            </section>
          )}

          <section className="mt-9 flex flex-wrap items-center justify-between gap-3 rounded-[13px] border border-[var(--color-line)] bg-[#fbfaf7] px-4 py-3">
            <div className="flex items-center gap-2.5 text-[12.5px] text-[var(--color-muted)]">
              <BookOpen size={15} className="text-[var(--color-faint)]" />
              <span>
                {plural(presentations.length, 'présentation enregistrée', 'présentations enregistrées')} ·{' '}
                {plural(presentations.reduce((a, p) => a + p.slides.length, 0), 'diapositive', 'diapositives')}
              </span>
            </div>
            <span className="text-[11.5px] text-[var(--color-faint)]">Dernière modification {formatDate(recent[0]?.updatedAt ?? new Date().toISOString())}</span>
          </section>
        </>
      )}
    </div>
  )
}
