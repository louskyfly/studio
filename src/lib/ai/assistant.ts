import type { Presentation } from '../model'
import { slideText } from '../model'
import { buildDeck, buildSlide, applyThemeToDoc, type GenSlide } from '../layouts'
import { themeById, THEMES } from '../themes'
import { callModel, extractJson, AIError, type ProviderConfig } from './providers'
import { assistantPrompt, SYSTEM } from './prompts'
import { normalizeGenSlide } from './schemas'

export interface AssistantOutcome {
  reply: string
  doc: Presentation
  changed: boolean
}

export const askAssistant = async (
  cfg: ProviderConfig,
  doc: Presentation,
  request: string,
  scope: 'slide' | 'deck',
  slideIndex: number,
  signal?: AbortSignal,
): Promise<AssistantOutcome> => {
  const theme = themeById(doc.themeId)
  const summaries = doc.slides.map((s, index) => {
    const texts = s.elements
    const firstText = texts.find((e) => e.type === 'text' && e.paragraphs.length)
    const title =
      firstText && firstText.type === 'text' ? (firstText.paragraphs[0]?.runs.map((r) => r.text).join('') ?? '').slice(0, 90) : `Diapositive ${index + 1}`
    return { index, kind: s.layout, title, text: slideText(s) }
  })

  const raw = await callModel(cfg, {
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: assistantPrompt({
          deckTitle: doc.title,
          themeId: doc.themeId,
          level: doc.level,
          subject: doc.subject,
          slides: summaries,
          scope,
          slideIndex,
          request,
        }),
      },
    ],
    json: true,
    temperature: 0.45,
    maxTokens: 6000,
    signal,
  })

  const data = extractJson<Record<string, unknown>>(raw)
  const reply = String(data.reply ?? 'Modification appliquée.').trim()
  const next: Presentation = structuredClone(doc)
  let changed = false

  const themeRequest = typeof data.themeId === 'string' ? data.themeId : null
  if (themeRequest && THEMES.some((t) => t.id === themeRequest) && themeRequest !== doc.themeId) {
    const target = themeById(themeRequest)
    const themed = applyThemeToDoc(next, theme, target)
    next.slides = themed.slides
    next.themeId = target.id
    changed = true
  }

  const deckRaw = data.deck as Record<string, unknown> | undefined
  if (deckRaw && Array.isArray(deckRaw.slides) && deckRaw.slides.length > 1) {
    const slides = (deckRaw.slides as unknown[])
      .map(normalizeGenSlide)
      .filter((s): s is GenSlide => Boolean(s))
    if (slides.length > 1) {
      const spec = {
        title: String(deckRaw.title ?? doc.title),
        subtitle: String(deckRaw.subtitle ?? doc.description),
        problematique: String(deckRaw.problematique ?? ''),
        subject: doc.subject,
        level: doc.level,
        slides,
      }
      const built = buildDeck(spec, themeById(next.themeId), {})
      next.slides = built.slides
      next.title = spec.title || next.title
      next.description = spec.subtitle || next.description
      changed = true
    }
  }

  const slideRaw = data.slide as Record<string, unknown> | undefined
  if (slideRaw && !deckRaw) {
    const targetIndex = Number.isFinite(Number(data.slideIndex)) ? Number(data.slideIndex) : slideIndex
    const normalized = normalizeGenSlide(slideRaw)
    if (normalized && next.slides[targetIndex]) {
      const previous = next.slides[targetIndex]
      const built = buildSlide(normalized, themeById(next.themeId), { index: targetIndex, total: next.slides.length })
      built.id = previous.id
      built.notes = built.notes ?? previous.notes
      next.slides[targetIndex] = built
      changed = true
    }
  }

  if (!changed && !reply) {
    throw new AIError('L’assistant n’a proposé aucune modification exploitable.', 'no_change')
  }

  next.updatedAt = new Date().toISOString()
  return { reply, doc: next, changed }
}
