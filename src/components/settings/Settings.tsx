import { useEffect, useRef, useState } from 'react'
import { Check, CircleCheck, Download, Eye, EyeOff, ExternalLink, Sparkles, TriangleAlert, Upload } from 'lucide-react'
import { useApp } from '../../lib/store'
import { DEFAULT_MODELS, PROVIDERS, describeAIError, listModels } from '../../lib/ai/providers'
import { Button, Field, Input, Spinner } from '../ui'
import { dbUsage } from '../../lib/db'
import { exportLibrary, importLibrary } from '../../lib/backup'
import { downloadBlob, formatBytes } from '../../lib/utils'
import { APP_VERSION } from '../../lib/version'

export const Settings = () => {
  const settings = useApp((s) => s.settings)
  const setSettings = useApp((s) => s.setSettings)
  const toast = useApp((s) => s.toast)
  const [showKey, setShowKey] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [usage, setUsage] = useState({ used: 0, quota: 0, persisted: false })
  const [busyBackup, setBusyBackup] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const singleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    dbUsage().then(setUsage).catch(() => {})
  }, [])

  const ai = settings.ai
  const needsKey = ai.provider !== 'ollama'

  const updateAi = (patch: Partial<typeof ai>) => {
    setTestResult(null)
    void setSettings({ ai: { ...ai, ...patch } })
  }

  const test = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const found = await listModels(ai)
      if (found.length) setModels(found)
      const { callModel } = await import('../../lib/ai/providers')
      const res = await callModel(ai, {
        messages: [
          { role: 'system', content: 'Tu réponds en un mot.' },
          { role: 'user', content: 'Réponds uniquement par : OK' },
        ],
        maxTokens: 12,
        temperature: 0,
      })
      setTestResult({ ok: true, message: `Connexion réussie — ${res.trim().slice(0, 30) || 'modèle joignable'}.` })
    } catch (err) {
      setTestResult({ ok: false, message: describeAIError(err) })
    } finally {
      setTesting(false)
    }
  }

  const refreshModels = async () => {
    setLoadingModels(true)
    try {
      const found = await listModels(ai)
      setModels(found)
      if (!found.length) toast('Aucun modèle listé. Vérifie la clé et l’URL.', 'error')
    } finally {
      setLoadingModels(false)
    }
  }

  const backup = async () => {
    setBusyBackup(true)
    try {
      const blob = await exportLibrary()
      downloadBlob(blob, `studio-bibliotheque-${new Date().toISOString().slice(0, 10)}.zip`)
      toast('Bibliothèque exportée.', 'success')
    } catch (err) {
      toast(describeAIError(err), 'error')
    } finally {
      setBusyBackup(false)
    }
  }

  const restore = async (file: File) => {
    setBusyBackup(true)
    try {
      const res = await importLibrary(file)
      const docs = await import('../../lib/db').then((m) => m.dbListPresentations())
      useApp.setState({ presentations: docs })
      toast(`Restauration terminée : ${res.added} ajoutée(s), ${res.updated} mise(s) à jour.`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Restauration impossible.', 'error')
    } finally {
      setBusyBackup(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[880px] px-5 pb-20 pt-7 sm:px-8">
      <h1 className="serif text-[30px] leading-tight tracking-[-0.015em]">Réglages</h1>
      <p className="mt-1 text-[13px] text-[var(--color-muted)]">Modèle d’intelligence artificielle, stockage et sauvegardes.</p>

      <section className="card mt-6 overflow-hidden">
        <div className="border-b border-[var(--color-line)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-[var(--color-accent)]" />
            <h2 className="text-[14px] font-semibold">Intelligence artificielle</h2>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-[var(--color-muted)]">
            Studio n’impose aucun fournisseur. La clé reste dans ce navigateur et n’est jamais envoyée ailleurs qu’au fournisseur choisi.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  const baseUrl =
                    p.id === 'ollama'
                      ? 'http://127.0.0.1:11434'
                      : p.id === 'openai'
                        ? ai.baseUrl && ai.baseUrl !== 'http://127.0.0.1:11434'
                          ? ai.baseUrl
                          : 'https://api.openai.com/v1'
                        : ''
                  updateAi({ provider: p.id, baseUrl, model: DEFAULT_MODELS[p.id][0] })
                }}
                className={`rounded-[10px] border px-3 py-2.5 text-left transition ${
                  ai.provider === p.id ? 'border-[var(--color-accent)] bg-[#f5f8fb]' : 'border-[var(--color-line)] hover:border-[var(--color-line-strong)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold">{p.label}</span>
                  {ai.provider === p.id && <CircleCheck size={14} className="text-[var(--color-accent)]" />}
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-muted)]">{p.hint}</p>
              </button>
            ))}
          </div>

          {needsKey && (
            <Field label={ai.provider === 'gemini' ? 'Clé API Google AI Studio' : 'Clé API'}>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={ai.apiKey}
                  onChange={(e) => updateAi({ apiKey: e.target.value })}
                  placeholder={ai.provider === 'gemini' ? 'AIza…' : 'sk-…'}
                  className="pr-10 font-mono text-[12px]"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--color-faint)] hover:text-[var(--color-ink)]"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? 'Masquer' : 'Afficher'}
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-[var(--color-faint)]">
                {ai.provider === 'gemini' ? (
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline">
                    Créer une clé gratuite sur Google AI Studio <ExternalLink size={10} />
                  </a>
                ) : (
                  'La clé est stockée localement dans le navigateur de cet appareil.'
                )}
              </p>
            </Field>
          )}

          {ai.provider !== 'gemini' && (
            <Field
              label="URL de base"
              hint={
                ai.provider === 'ollama'
                  ? 'Ollama doit tourner sur l’ordinateur. Autorise cette page : OLLAMA_ORIGINS=* (ou l’origine exacte de Studio).'
                  : 'Exemples : https://api.openai.com/v1 · https://api.mistral.ai/v1 · https://openrouter.ai/api/v1'
              }
            >
              <Input value={ai.baseUrl} onChange={(e) => updateAi({ baseUrl: e.target.value })} placeholder="https://…/v1" className="font-mono text-[12px]" />
            </Field>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Modèle">
              <div className="flex gap-2">
                <Input list="studio-models" value={ai.model} onChange={(e) => updateAi({ model: e.target.value })} className="font-mono text-[12px]" />
                <datalist id="studio-models">
                  {[...new Set([...models, ...(DEFAULT_MODELS[ai.provider] ?? [])])].map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <Button variant="secondary" onClick={refreshModels} disabled={loadingModels} className="shrink-0">
                  {loadingModels ? <Spinner /> : 'Lister'}
                </Button>
              </div>
            </Field>
            <Field label={`Créativité — ${ai.temperature.toFixed(2)}`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={ai.temperature}
                onChange={(e) => updateAi({ temperature: Number(e.target.value) })}
                className="mt-2.5 h-1.5 w-full min-w-[150px] accent-[var(--color-accent)]"
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={test} disabled={testing || (needsKey && !ai.apiKey)}>
              {testing ? <Spinner /> : <Check size={15} />}
              {testing ? 'Test en cours…' : 'Tester la connexion'}
            </Button>
            <span className="text-[11.5px] text-[var(--color-faint)]">
              {needsKey && !ai.apiKey ? 'Ajoute une clé pour activer la génération.' : 'Un appel réel est envoyé au modèle.'}
            </span>
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-2 rounded-[9px] border px-3 py-2 text-[12.5px] leading-snug ${
                testResult.ok ? 'border-[#cfe2d6] bg-[#f4faf6] text-[#2a5f45]' : 'border-[#e7c9c2] bg-[#fdf5f3] text-[#8a3226]'
              }`}
            >
              {testResult.ok ? <Check size={14} className="mt-0.5 shrink-0" /> : <TriangleAlert size={14} className="mt-0.5 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="rounded-[9px] bg-[#f7f6f2] px-3.5 py-3 text-[11.5px] leading-relaxed text-[var(--color-muted)]">
            <strong className="font-semibold text-[var(--color-ink-soft)]">Ce qui est réellement gratuit.</strong> Avec Ollama, la génération est gratuite et privée, mais
            votre ordinateur doit rester allumé. Avec Gemini, l’offre gratuite de Google suffit à un usage quotidien raisonnable ; au-delà du quota, Google peut facturer ou
            limiter. Studio ne promet aucune IA illimitée : il vous laisse choisir la source.
          </div>
        </div>
      </section>

      <section className="card mt-5 overflow-hidden">
        <div className="border-b border-[var(--color-line)] px-5 py-3.5">
          <h2 className="text-[14px] font-semibold">Données et sauvegardes</h2>
          <p className="mt-1 text-[12px] leading-snug text-[var(--color-muted)]">Tout est stocké dans ce navigateur (IndexedDB), automatiquement. Exportez régulièrement une sauvegarde.</p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="flex items-center justify-between rounded-[9px] bg-[#f7f6f2] px-3.5 py-2.5 text-[12.5px]">
            <span className="text-[var(--color-muted)]">Espace utilisé</span>
            <span className="num font-medium">
              {formatBytes(usage.used)} {usage.quota ? <span className="font-normal text-[var(--color-faint)]">sur {formatBytes(usage.quota)}</span> : null}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={backup} disabled={busyBackup}>
              {busyBackup ? <Spinner /> : <Download size={15} />} Exporter la bibliothèque (.zip)
            </Button>
            <Button variant="secondary" onClick={() => importRef.current?.click()} disabled={busyBackup}>
              <Upload size={15} /> Restaurer une sauvegarde
            </Button>
            <input
              ref={importRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void restore(f)
                e.target.value = ''
              }}
            />
            <Button variant="ghost" className="justify-start px-1 text-[12px] sm:col-span-2" onClick={() => singleRef.current?.click()} disabled={busyBackup}>
              <Upload size={14} /> Importer une présentation (.studio.json)
            </Button>
            <input
              ref={singleRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                try {
                  const { importPresentationFile } = await import('../../lib/backup')
                  const doc = await importPresentationFile(f)
                  const docs = await import('../../lib/db').then((m) => m.dbListPresentations())
                  useApp.setState({ presentations: docs })
                  toast(`« ${doc.title} » importée.`, 'success')
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Import impossible.', 'error')
                }
              }}
            />
          </div>
          {!usage.persisted && (
            <div className="flex items-start gap-2 text-[11.5px] leading-snug text-[var(--color-muted)]">
              <TriangleAlert size={13} className="mt-0.5 shrink-0 text-[#9a6b1f]" />
              <span>
                Le navigateur peut libérer cet espace s’il manque de place.{' '}
                <button
                  className="font-medium text-[var(--color-accent)] hover:underline"
                  onClick={async () => {
                    const ok = await navigator.storage?.persist?.()
                    toast(ok ? 'Stockage persistant accordé.' : 'Le navigateur a refusé ; exportez une sauvegarde.', ok ? 'success' : 'error')
                    setUsage(await dbUsage())
                  }}
                >
                  Demander un stockage persistant
                </button>
                .
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 flex flex-wrap items-center justify-between gap-2 px-1 text-[11.5px] text-[var(--color-faint)]">
        <span>Studio {APP_VERSION} — application locale, sans compte.</span>
        <span>Vos présentations ne quittent jamais cet appareil, sauf export ou appel au modèle choisi.</span>
      </section>
    </div>
  )
}
