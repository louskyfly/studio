import type { Depth, Level, Subject, Tone } from '../model'
import { levelLabel, subjectLabel } from '../model'
import { themeById } from '../themes'
import { buildDeck, type DeckSpec, type GenSlide, type SlideImage } from '../layouts'
import { useApp } from '../store'
import { extractJson, AIError, callModel, type ProviderConfig } from './providers'
import { planPrompt, slidesPrompt, SYSTEM } from './prompts'
import { fallbackFor, normalizeGenSlide, normalizePlan, type NormalizedPlan } from './schemas'
import { fetchCommonsImage } from '../media/wikimedia'
import type { Slide } from '../model'

export interface GenerationInput {
  mode: 'topic' | 'documents' | 'notes'
  subject: Subject
  level: Level
  depth: Depth
  tone: Tone
  slideCount: number
  themeId: string
  topic?: string
  notes?: string
  documents?: { name: string; text: string }[]
  problematique?: string
  withImages: boolean
}

export interface GenerationProgress {
  phase: 'plan' | 'slides' | 'images' | 'layout'
  message: string
  done: number
  total: number
}

export interface GenerationResult {
  spec: DeckSpec
  slides: Slide[]
  images: Record<number, SlideImage>
  warnings: string[]
  plan: NormalizedPlan
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const batchSize = 3

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const splitSentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
    .slice(0, 4)

export const generateDeck = async (
  cfg: ProviderConfig,
  input: GenerationInput,
  onProgress: (p: GenerationProgress) => void,
  signal?: AbortSignal,
): Promise<GenerationResult> => {
  const theme = themeById(input.themeId)
  const warnings: string[] = []
  onProgress({ phase: 'plan', message: 'Analyse du sujet et construction du plan…', done: 0, total: 1 })

  const baseMessages = [{ role: 'system' as const, content: SYSTEM }]
  const rawPlan = await callModel(cfg, {
    messages: [...baseMessages, { role: 'user', content: planPrompt({ ...input, documents: input.documents }) }],
    json: true,
    temperature: Math.min(0.7, cfg.temperature ?? 0.6),
    maxTokens: 3200,
    signal,
  })
  const plan = normalizePlan(extractJson(rawPlan), input.topic || 'Présentation', input.slideCount)
  if (plan.slides.length < 3) throw new AIError('Le plan renvoyé est inutilisable. Réessaie.', 'plan')

  onProgress({
    phase: 'plan',
    message: `Plan prêt : ${plan.slides.length} diapositives, ${plan.problematique ? 'problématique définie' : 'sans problématique'}.`,
    done: 1,
    total: 1,
  })

  const targets = plan.slides
    .map((s, index) => ({ ...s, index }))
    .filter((s) => s.index !== 0 && s.kind !== 'problem')

  const batches = chunk(targets, batchSize)
  const generated = new Map<number, GenSlide>()
  let done = 0

  for (const batch of batches) {
    if (signal?.aborted) throw new AIError('Génération annulée.', 'aborted')
    onProgress({
      phase: 'slides',
      message: `Rédaction des diapositives ${batch[0].index + 1} à ${batch[batch.length - 1].index + 1}…`,
      done,
      total: targets.length,
    })

    const prompt = slidesPrompt({
      deckTitle: plan.title,
      problematique: plan.problematique,
      subject: input.subject,
      level: input.level,
      depth: input.depth,
      tone: input.tone,
      plan: plan.slides,
      targets: batch,
      documents: input.documents,
      mode: input.mode,
    })

    let attempt = 0
    const missing = new Set(batch.map((b) => b.index))
    while (attempt < 2 && missing.size) {
      attempt++
      try {
        const raw = await callModel(cfg, {
          messages: [
            ...baseMessages,
            { role: 'user', content: prompt },
            ...(attempt > 1
              ? [
                  {
                    role: 'assistant' as const,
                    content: 'Je renvoie uniquement le JSON demandé, avec tous les champs obligatoires.',
                  },
                  {
                    role: 'user' as const,
                    content: 'Ta réponse précédente était incomplète ou invalide. Renvoie le JSON complet, sans commentaire, en respectant exactement les kinds et les index.',
                  },
                ]
              : []),
          ],
          json: true,
          temperature: Math.min(0.75, (cfg.temperature ?? 0.6) + 0.05 * attempt),
          maxTokens: 4096,
          signal,
        })
        const parsed = extractJson<{ slides?: unknown[] }>(raw)
        for (const item of parsed.slides ?? []) {
          const idx = Number((item as { index?: unknown }).index)
          if (!Number.isFinite(idx) || !missing.has(idx)) continue
          const slide = normalizeGenSlide({ ...(item as Record<string, unknown>), index: undefined })
          if (slide) {
            generated.set(idx, slide)
            missing.delete(idx)
          }
        }
      } catch (err) {
        if (signal?.aborted) throw err
        if (attempt >= 2) warnings.push(`Lot ${batch[0].index + 1}–${batch[batch.length - 1].index + 1} : ${(err as Error).message}`)
      }
    }

    for (const idx of missing) {
      const item = plan.slides[idx]
      generated.set(idx, fallbackFor(item))
      warnings.push(`Diapositive ${idx + 1} reconstruite simplement (réponse du modèle incomplète).`)
    }

    done += batch.length
    onProgress({
      phase: 'slides',
      message: `Diapositives rédigées (${Math.min(done, targets.length)}/${targets.length}).`,
      done: Math.min(done, targets.length),
      total: targets.length,
    })
  }

  // assemblage dans l'ordre du plan
  const specSlides: GenSlide[] = plan.slides.map((item, index) => {
    if (index === 0) {
      return { kind: 'title', title: plan.title, subtitle: plan.subtitle || undefined, kicker: subjectLabel(input.subject) + ' · ' + levelLabel(input.level) }
    }
    if (item.kind === 'problem' || (index === 1 && plan.problematique)) {
      return { kind: 'problem', question: plan.problematique || item.brief || plan.title, axes: [] }
    }
    const gen = generated.get(index)
    if (gen) return gen
    if (item.kind === 'conclusion') {
      const points = splitSentences(item.brief)
      return {
        kind: 'conclusion',
        title: item.title || 'Ce qu’il faut retenir',
        points: points.length >= 2 ? points : [item.brief || 'Bilan de la leçon.'],
      }
    }
    return fallbackFor(item)
  })

  const last = specSlides[specSlides.length - 1]
  if (!last || last.kind !== 'conclusion') {
    specSlides.push({
      kind: 'conclusion',
      title: 'Ce qu’il faut retenir',
      points: splitSentences(plan.slides[plan.slides.length - 1]?.brief ?? '').slice(0, 3).concat('Revenir à la problématique de départ.').slice(0, 4),
    })
  }

  const spec: DeckSpec = {
    title: plan.title,
    subtitle: plan.subtitle,
    problematique: plan.problematique,
    subject: input.subject,
    level: input.level,
    slides: specSlides,
  }

  // illustrations libres
  const images: Record<number, SlideImage> = {}
  if (input.withImages) {
    const candidates = specSlides
      .map((s, index) => ({ s, index }))
      .filter(({ s }) => s.kind === 'bullets' || s.kind === 'document' || s.kind === 'title')
      .map(({ s, index }) => ({
        index,
        query:
          s.kind === 'title'
            ? ''
            : s.kind === 'bullets' || s.kind === 'document'
              ? (s.imageQuery ?? '')
              : '',
      }))
      .filter((c) => c.query)
      .slice(0, 4)

    let found = 0
    for (const c of candidates) {
      if (signal?.aborted) break
      onProgress({
        phase: 'images',
        message: found ? 'Illustrations trouvées…' : 'Recherche d’illustrations libres…',
        done: found,
        total: candidates.length,
      })
      try {
        const img = await fetchCommonsImage(c.query, signal)
        if (!img) continue
        const asset = await useApp.getState().addAsset(img.blob, img.name, { credit: img.credit, creditUrl: img.creditUrl })
        images[c.index] = { assetId: asset.id, credit: img.credit, creditUrl: img.creditUrl, alt: img.name }
        found++
      } catch {
        /* image facultative */
      }
      await sleep(120)
    }
    onProgress({ phase: 'images', message: `${found} illustration(s) ajoutée(s).`, done: found, total: candidates.length })
  }

  onProgress({ phase: 'layout', message: 'Mise en page…', done: 1, total: 1 })
  const built = buildDeck(spec, theme, { images })

  return { spec, slides: built.slides, images, warnings, plan }
}
