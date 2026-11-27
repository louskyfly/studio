import { useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  FileText,
  Image as ImageIcon,
  Sparkles,
  TriangleAlert,
  Type,
  Upload,
  X,
} from 'lucide-react'
import { useApp } from '../../lib/store'
import {
  DEPTHS,
  LEVELS,
  SUBJECTS,
  TONES,
  emptyPresentation,
  levelLabel,
  subjectLabel,
  type CreateMode,
  type Depth,
  type Level,
  type Subject,
  type Tone,
} from '../../lib/model'
import { THEMES, themeById } from '../../lib/themes'
import { deckFromSpec } from '../../lib/layouts'
import { generateDeck, type GenerationProgress } from '../../lib/ai/generate'
import { describeAIError } from '../../lib/ai/providers'
import { extractFile, fileKind, type ExtractedDoc } from '../../lib/documents/extract'
import { Button, Field, Input, Progress, Select, Spinner, Switch, Textarea } from '../ui'
import { cn } from '../../lib/utils'

const EXAMPLES = [
  'La romanisation de l’Empire romain, pour une classe de Seconde',
  'Les espaces de faible densité en France, pour une Troisième',
  'La Révolution française et l’Empire : une nouvelle conception de la nation',
]

const PHASES: { id: GenerationProgress['phase']; label: string; detail: string }[] = [
  { id: 'plan', label: 'Analyse et plan', detail: 'Problématique, parties, objectif de chaque diapositive' },
  { id: 'slides', label: 'Rédaction', detail: 'Textes adaptés au niveau, documents, cartes et schémas' },
  { id: 'images', label: 'Illustrations', detail: 'Recherche d’images libres sur Wikimedia Commons' },
  { id: 'layout', label: 'Mise en page', detail: 'Composition typographique et contrôle de lisibilité' },
]

export const GenerateWizard = ({ initialMode }: { initialMode: CreateMode }) => {
  const navigate = useApp((s) => s.navigate)
  const insertGenerated = useApp((s) => s.insertGenerated)
  const createPresentation = useApp((s) => s.createPresentation)
  const settings = useApp((s) => s.settings)
  const toast = useApp((s) => s.toast)

  const [mode, setMode] = useState<CreateMode>(initialMode)
  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')
  const [problematique, setProblematique] = useState('')
  const [docs, setDocs] = useState<ExtractedDoc[]>([])
  const [reading, setReading] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const [level, setLevel] = useState<Level>('2de')
  const [subject, setSubject] = useState<Subject>('histoire')
  const [slideCount, setSlideCount] = useState(10)
  const [depth, setDepth] = useState<Depth>('equilibre')
  const [tone, setTone] = useState<Tone>('sobre')
  const [themeId, setThemeId] = useState('ivoire')
  const [withImages, setWithImages] = useState(true)

  const [step, setStep] = useState<'setup' | 'generating' | 'error'>('setup')
  const [progress, setProgress] = useState<GenerationProgress>({ phase: 'plan', message: 'Préparation…', done: 0, total: 1 })
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const aiReady = settings.ai.provider === 'ollama' || Boolean(settings.ai.apiKey)

  const valid = useMemo(() => {
    if (mode === 'topic') return topic.trim().length >= 8
    if (mode === 'notes') return notes.trim().length >= 25
    return docs.some((d) => d.text.trim().length > 40)
  }, [mode, topic, notes, docs])

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files)
    for (const file of list) {
      const kind = fileKind(file)
      if (!kind) {
        toast(`Format non pris en charge : ${file.name}`, 'error')
        continue
      }
      setReading(file.name)
      try {
        if (kind === 'image') {
          const asset = await useApp.getState().addAsset(file, file.name)
          setDocs((d) => [
            ...d,
            { name: file.name, kind, text: '', size: file.size, warning: `Image conservée comme illustration (${asset.id.slice(0, 6)}…). Le texte dans l’image n’est pas lu.` },
          ])
        } else {
          const doc = await extractFile(file)
          setDocs((d) => [...d.filter((x) => x.name !== doc.name), doc])
          if (doc.warning) toast(doc.warning, 'info')
        }
      } catch (err) {
        toast(`Lecture impossible : ${err instanceof Error ? err.message : file.name}`, 'error')
      } finally {
        setReading(null)
      }
    }
  }

  const generate = async () => {
    if (!aiReady) {
      setError('Aucun modèle n’est configuré. Ouvre les réglages pour ajouter une clé ou lancer Ollama.')
      setStep('error')
      return
    }
    setStep('generating')
    setError(null)
    const controller = new AbortController()
    abortRef.current = controller
    setProgress({ phase: 'plan', message: 'Analyse du sujet…', done: 0, total: 1 })

    try {
      const result = await generateDeck(
        settings.ai,
        {
          mode: mode === 'blank' ? 'topic' : mode,
          subject,
          level,
          depth,
          tone,
          slideCount,
          themeId,
          topic: topic.trim() || undefined,
          notes: notes.trim() || undefined,
          documents: docs.filter((d) => d.text.trim()).map((d) => ({ name: d.name, text: d.text })),
          problematique: problematique.trim() || undefined,
          withImages,
        },
        setProgress,
        controller.signal,
      )

      const theme = themeById(themeId)
      const base = emptyPresentation({ title: result.spec.title, subject, level, themeId })
      const doc = deckFromSpec(result.spec, { presentation: base, theme, images: result.images })
      doc.description = result.spec.subtitle ?? ''
      doc.source = {
        kind: mode,
        prompt: topic.trim() || notes.trim().slice(0, 300) || undefined,
        docNames: docs.map((d) => d.name),
        params: { level, subject, slideCount, depth, themeId, tone },
      }
      doc.ai = { provider: settings.ai.provider, model: settings.ai.model, generatedAt: new Date().toISOString() }
      if (result.warnings.length) doc.description = `${doc.description}${doc.description ? ' ' : ''}`
      await insertGenerated(doc, 'Génération IA')
      if (result.warnings.length) {
        toast(`${result.warnings.length} diapositive(s) reconstruite(s) simplement. Vérifie-les dans l’éditeur.`, 'info')
      } else {
        toast(`Présentation générée : ${doc.slides.length} diapositives.`, 'success')
      }
    } catch (err) {
      if (controller.signal.aborted) {
        setStep('setup')
        return
      }
      setError(describeAIError(err))
      setStep('error')
    } finally {
      abortRef.current = null
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
    setStep('setup')
  }

  if (step === 'generating' || step === 'error') {
    const phaseIndex = PHASES.findIndex((p) => p.id === progress.phase)
    return (
      <div className="flex min-h-full flex-col bg-[var(--color-paper)]">
        <div className="mx-auto w-full max-w-[720px] px-5 pb-12 pt-16 sm:px-8">
          <div className="card overflow-hidden">
            <div className="border-b border-[var(--color-line)] px-6 py-5">
              <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">
                <Sparkles size={13} /> {step === 'error' ? 'Génération interrompue' : 'Génération en cours'}
              </div>
              <h1 className="serif mt-1.5 text-[25px] leading-tight">{step === 'error' ? 'Quelque chose n’a pas abouti' : 'Votre présentation prend forme'}</h1>
              <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">
                {levelLabel(level)} · {subjectLabel(subject)} · {slideCount} diapositives · {themeById(themeId).name}
              </p>
            </div>

            <div className="px-6 py-5">
              {step === 'error' ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-2.5 rounded-[10px] border border-[#e7c9c2] bg-[#fdf5f3] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#8a3226]">
                    <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onClick={() => setStep('setup')}>
                      Revenir aux réglages
                    </Button>
                    <Button variant="secondary" onClick={() => navigate({ name: 'settings' })}>
                      Ouvrir les réglages IA
                    </Button>
                  </div>
                  <p className="text-[11.5px] leading-relaxed text-[var(--color-faint)]">
                    Rien n’a été perdu : la présentation n’a pas été créée et vos paramètres sont conservés.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3.5">
                    {PHASES.map((p, i) => {
                      const state = i < phaseIndex ? 'done' : i === phaseIndex ? 'current' : 'todo'
                      return (
                        <div key={p.id} className="flex items-start gap-3">
                          <div
                            className={cn(
                              'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10.5px] font-semibold',
                              state === 'done' && 'border-[#cfe2d6] bg-[#eef7f1] text-[#2f6b4f]',
                              state === 'current' && 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white',
                              state === 'todo' && 'border-[var(--color-line-strong)] text-[var(--color-faint)]',
                            )}
                          >
                            {state === 'done' ? <CircleCheck size={14} /> : state === 'current' ? <Spinner size={12} /> : i + 1}
                          </div>
                          <div className="min-w-0">
                            <div className={cn('text-[13px] font-medium', state === 'todo' ? 'text-[var(--color-faint)]' : 'text-[var(--color-ink)]')}>{p.label}</div>
                            <div className="text-[11.5px] leading-snug text-[var(--color-faint)]">{p.detail}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-5 space-y-2">
                    <Progress value={progress.phase === 'slides' ? 25 + (progress.done / Math.max(1, progress.total)) * 50 : progress.phase === 'images' ? 80 : progress.phase === 'layout' ? 96 : 8} />
                    <div className="flex items-center justify-between text-[11.5px] text-[var(--color-muted)]">
                      <span className="truncate pr-3">{progress.message}</span>
                      {progress.phase === 'slides' && progress.total > 1 ? <span className="num shrink-0">{progress.done}/{progress.total}</span> : null}
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between">
                    <Button variant="ghost" onClick={cancel}>
                      Annuler
                    </Button>
                    <span className="text-[11px] text-[var(--color-faint)]">Le modèle est réellement interrogé ; cela peut prendre une minute.</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-[var(--color-line)] bg-[#fbfaf7]">
        <div className="mx-auto flex w-full max-w-[960px] items-center justify-between px-5 py-3 sm:px-8">
          <button className="flex items-center gap-1.5 text-[12.5px] text-[var(--color-muted)] hover:text-[var(--color-ink)]" onClick={() => navigate({ name: 'home' })}>
            <ArrowLeft size={14} /> Retour
          </button>
          <span className="text-[11.5px] text-[var(--color-faint)]">{aiReady ? `${settings.ai.model}` : 'IA non configurée'}</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[960px] flex-1 px-5 pb-28 pt-7 sm:px-8">
        <h1 className="serif text-[30px] leading-tight tracking-[-0.015em]">Nouvelle présentation</h1>
        <p className="mt-1 max-w-[620px] text-[13px] leading-relaxed text-[var(--color-muted)]">
          Choisissez un point de départ. L’IA construit ensuite un plan, rédige les diapositives et les met en page ; vous pourrez tout modifier.
        </p>

        {!aiReady && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[10px] border border-[#e8dcc4] bg-[#fcf8ef] px-3.5 py-2.5 text-[12px] text-[#7a5a1e]">
            <TriangleAlert size={14} className="shrink-0" />
            <span className="flex-1">Aucun modèle configuré. La génération nécessite une clé Gemini ou Ollama.</span>
            <button className="font-semibold underline underline-offset-2" onClick={() => navigate({ name: 'settings' })}>
              Configurer
            </button>
          </div>
        )}

        <div className="mt-5 grid gap-1.5 rounded-[12px] bg-[#eceae5] p-1 sm:grid-cols-3">
          {[
            { id: 'topic' as const, icon: <Sparkles size={15} />, label: 'Un sujet' },
            { id: 'documents' as const, icon: <FileText size={15} />, label: 'Des documents' },
            { id: 'notes' as const, icon: <Type size={15} />, label: 'Des notes' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-[9px] py-2.5 text-[12.5px] font-medium transition',
                mode === m.id ? 'bg-white text-[var(--color-ink)] shadow-[var(--shadow-xs)]' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]',
              )}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        <div className="card mt-4 p-5">
          {mode === 'topic' && (
            <div>
              <Field label="Sujet ou demande" hint="Une phrase suffit. Précisez le niveau, le chapitre ou l’angle si vous le souhaitez.">
                <Textarea
                  autoFocus
                  rows={3}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ex. Crée une présentation sur la romanisation de l’Empire romain pour une classe de Seconde."
                  className="text-[14px]"
                />
              </Field>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button key={ex} onClick={() => setTopic(ex)} className="chip max-w-full truncate transition hover:bg-[#e8e5dd]">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'documents' && (
            <div>
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files)
                }}
                className={cn(
                  'flex flex-col items-center justify-center rounded-[11px] border-2 border-dashed px-5 py-9 text-center transition',
                  dragging ? 'border-[var(--color-accent)] bg-[#f4f7fa]' : 'border-[var(--color-line-strong)] bg-[#fbfaf7]',
                )}
              >
                <Upload size={20} className="text-[var(--color-faint)]" />
                <div className="mt-2.5 text-[13px] font-medium">Déposez vos documents ici</div>
                <div className="mt-0.5 text-[11.5px] text-[var(--color-muted)]">PDF, Word, PowerPoint, texte. Les images sont conservées comme illustrations.</div>
                <Button variant="secondary" className="mt-3 h-8" onClick={() => fileRef.current?.click()}>
                  Choisir des fichiers
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.pptx,.txt,.md,.csv,image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) void addFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </div>

              {reading && (
                <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--color-muted)]">
                  <Spinner size={13} /> Lecture de {reading}…
                </div>
              )}

              {docs.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {docs.map((d) => (
                    <div key={d.name} className="flex items-start gap-2.5 rounded-[9px] border border-[var(--color-line)] bg-white px-3 py-2">
                      {d.kind === 'image' ? <ImageIcon size={15} className="mt-0.5 text-[var(--color-faint)]" /> : <FileText size={15} className="mt-0.5 text-[var(--color-faint)]" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[12.5px] font-medium">{d.name}</span>
                          <span className="shrink-0 text-[10.5px] text-[var(--color-faint)]">{d.pages ? `${d.pages} p.` : ''} {d.text ? `· ${d.text.length.toLocaleString('fr-FR')} car.` : ''}</span>
                        </div>
                        {d.warning && <div className="mt-0.5 text-[11px] leading-snug text-[#8a6a2a]">{d.warning}</div>}
                      </div>
                      <button
                        className="rounded p-1 text-[var(--color-faint)] hover:bg-black/5 hover:text-[var(--color-ink)]"
                        onClick={() => setDocs((list) => list.filter((x) => x.name !== d.name))}
                        aria-label="Retirer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'notes' && (
            <Field label="Vos notes" hint="Plan de cours, texte libre, idées en vrac. L’IA organise sans ajouter de faits extérieurs.">
              <Textarea
                autoFocus
                rows={9}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={'Ex.\nI. Une cité conquérante\n- victoires militaires, légion\n- alliance avec les cités italiennes\nII. Comment Rome gouverne-t-elle ?\n- provinces, gouverneurs\n- citoyenneté progressive (édit de Caracalla, 212)'}
              />
            </Field>
          )}
        </div>

        <h2 className="mt-7 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">Paramètres</h2>
        <div className="card mt-2.5 divide-y divide-[var(--color-line)]">
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <Field label="Matière">
              <div className="segmented w-full">
                {SUBJECTS.map((s) => (
                  <button key={s.id} aria-pressed={subject === s.id} onClick={() => setSubject(s.id)} className="flex-1">
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Niveau scolaire">
              <Select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
                {['Collège', 'Lycée', 'Autre'].map((group) => (
                  <optgroup key={group} label={group}>
                    {LEVELS.filter((l) => l.group === group).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-end justify-between">
              <span className="label mb-0">Nombre de diapositives</span>
              <span className="num text-[13px] font-semibold">{slideCount}</span>
            </div>
            <input
              type="range"
              min={6}
              max={20}
              step={1}
              value={slideCount}
              onChange={(e) => setSlideCount(Number(e.target.value))}
              className="mt-2.5 h-1.5 w-full accent-[var(--color-accent)]"
            />
            <div className="mt-1 flex justify-between text-[10.5px] text-[var(--color-faint)]">
              <span>6 — courte séance</span>
              <span>20 — chapitre complet</span>
            </div>
          </div>

          <div className="px-5 py-4">
            <span className="label">Niveau de détail</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {DEPTHS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDepth(d.id)}
                  className={cn(
                    'rounded-[9px] border px-3 py-2.5 text-left transition',
                    depth === d.id ? 'border-[var(--color-accent)] bg-[#f5f8fb]' : 'border-[var(--color-line)] hover:border-[var(--color-line-strong)]',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold">{d.label}</span>
                    {depth === d.id && <CircleCheck size={13} className="text-[var(--color-accent)]" />}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-[var(--color-muted)]">{d.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 py-4">
            <span className="label">Style graphique</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-[9px] border px-2.5 py-2 text-left transition',
                    themeId === t.id ? 'border-[var(--color-accent)] bg-[#f5f8fb]' : 'border-[var(--color-line)] hover:border-[var(--color-line-strong)]',
                  )}
                >
                  <span className="flex h-7 w-9 shrink-0 flex-col justify-center gap-[3px] rounded-[4px] border border-black/10 px-1" style={{ background: t.bg }}>
                    <span className="h-[2px] w-3 rounded-full" style={{ background: t.accent }} />
                    <span className="h-[1.5px] w-5 rounded-full opacity-40" style={{ background: t.ink }} />
                    <span className="h-[1.5px] w-4 rounded-full opacity-25" style={{ background: t.ink }} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-medium">{t.name}</span>
                    <span className="block truncate text-[10px] text-[var(--color-faint)]">{t.mood}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <Field label="Ton">
              <Select value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
                {TONES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Problématique (facultatif)" hint="Laissez vide pour que l’IA la formule.">
              <Input value={problematique} onChange={(e) => setProblematique(e.target.value)} placeholder="Ex. Comment Rome transforme-t-elle les territoires conquis ?" />
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div>
              <div className="text-[12.5px] font-medium">Illustrations</div>
              <div className="text-[11px] text-[var(--color-muted)]">Images libres (Wikimedia Commons), créditées automatiquement.</div>
            </div>
            <Switch checked={withImages} onChange={setWithImages} label={withImages ? 'Activées' : 'Désactivées'} />
          </div>
        </div>

        <div className="mt-3 text-[11.5px] leading-relaxed text-[var(--color-faint)]">
          {mode === 'documents'
            ? 'Le diaporama respectera le contenu des documents. Les informations manquantes seront signalées « [à compléter] » plutôt qu’inventées.'
            : 'L’IA ne doit inventer ni date, ni citation, ni chiffre. Vérifiez toujours le résultat avant de le projeter : vous restez l’auteur du cours.'}
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-[var(--color-line)] bg-[#fbfaf7]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[960px] items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <div className="min-w-0 text-[11.5px] text-[var(--color-faint)]">
            {valid ? (
              <span>
                {slideCount} diapositives · {levelLabel(level)} · {themeById(themeId).name}
              </span>
            ) : (
              <span>{mode === 'topic' ? 'Décrivez le sujet pour continuer.' : mode === 'notes' ? 'Collez vos notes pour continuer.' : 'Ajoutez un document lisible pour continuer.'}</span>
            )}
            {!aiReady && <span className="block text-[#9a6b1f]">Configure un modèle (Gemini ou Ollama) pour lancer la génération.</span>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="ghost"
              className="hidden sm:flex"
              onClick={() => {
                void createPresentation({ subject, level, themeId })
              }}
            >
              Page blanche
            </Button>
            <Button variant="primary" disabled={!valid || !aiReady} onClick={generate} className="shrink-0 px-4">
              <Sparkles size={15} /> Générer la présentation <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
