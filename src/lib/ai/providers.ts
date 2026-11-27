export type ChatRole = 'system' | 'user' | 'assistant'
export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface AIRequest {
  messages: ChatMessage[]
  json?: boolean
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface AIProviderInfo {
  id: 'gemini' | 'ollama' | 'openai'
  label: string
  hint: string
}

export const PROVIDERS: AIProviderInfo[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    hint: 'Clé gratuite sur aistudio.google.com. Rapide, bon en français.',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    hint: 'Gratuit et privé. Nécessite Ollama lancé sur l’ordinateur.',
  },
  {
    id: 'openai',
    label: 'Compatible OpenAI',
    hint: 'OpenAI, Mistral, OpenRouter, Groq… selon l’URL de base.',
  },
]

export const DEFAULT_MODELS: Record<string, string[]> = {
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  ollama: ['qwen3:8b', 'llama3.1:8b', 'mistral-small3.1', 'gemma3:12b'],
  openai: ['gpt-4o-mini', 'gpt-4.1-mini', 'mistral-small-latest', 'meta-llama/llama-3.3-70b-instruct:free'],
}

export class AIError extends Error {
  code: string
  constructor(message: string, code = 'ai_error') {
    super(message)
    this.code = code
    this.name = 'AIError'
  }
}

const fetchWithTimeout = async (url: string, init: RequestInit, signal?: AbortSignal, ms = 180_000): Promise<Response> => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), ms)
  const onAbort = () => ctrl.abort(signal?.reason)
  signal?.addEventListener('abort', onAbort)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } catch (err) {
    if ((err as Error).name === 'TimeoutError' || (err as Error).name === 'AbortError') {
      if (signal?.aborted) throw new AIError('Génération annulée.', 'aborted')
      throw new AIError('Le modèle n’a pas répondu à temps. Réessaie avec moins de diapositives ou un modèle plus rapide.', 'timeout')
    }
    throw new AIError(
      'Connexion au modèle impossible. Vérifie la clé, l’URL, et — pour Ollama — que le service tourne et autorise cette page (OLLAMA_ORIGINS).',
      'network',
    )
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

const httpError = async (res: Response): Promise<never> => {
  let detail = ''
  try {
    const body = (await res.json()) as { error?: { message?: string } | string; message?: string }
    detail = typeof body.error === 'string' ? body.error : (body.error?.message ?? body.message ?? '')
  } catch {
    /* ignore */
  }
  const map: Record<number, string> = {
    400: 'Requête refusée par le modèle',
    401: 'Clé API invalide ou expirée',
    403: 'Accès refusé — vérifie les droits de la clé',
    404: 'Modèle introuvable — vérifie son nom',
    413: 'Contenu trop long pour ce modèle',
    429: 'Quota atteint ou trop de requêtes — attends un instant',
    500: 'Erreur interne du fournisseur',
    503: 'Modèle indisponible chez le fournisseur',
  }
  throw new AIError(`${map[res.status] ?? `Erreur ${res.status}`}${detail ? ` — ${detail.slice(0, 220)}` : ''}`, `http_${res.status}`)
}

export interface ProviderConfig {
  provider: 'gemini' | 'ollama' | 'openai'
  model: string
  apiKey: string
  baseUrl: string
  temperature: number
}

const geminiContents = (messages: ChatMessage[]) => {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const rest = messages.filter((m) => m.role !== 'system')
  return {
    system,
    contents: rest.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
  }
}

export const callGemini = async (cfg: ProviderConfig, req: AIRequest): Promise<string> => {
  if (!cfg.apiKey) throw new AIError('Aucune clé Gemini enregistrée. Ouvre Réglages → Intelligence artificielle.', 'no_key')
  const { system, contents } = geminiContents(req.messages)
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: {
          temperature: req.temperature ?? cfg.temperature,
          maxOutputTokens: req.maxTokens ?? 8192,
          ...(req.json ? { responseMimeType: 'application/json' } : {}),
        },
        ...(req.json ? { safetySettings: [] } : {}),
      }),
    },
    req.signal,
  )
  if (!res.ok) await httpError(res)
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
    promptFeedback?: { blockReason?: string }
    error?: { message?: string }
  }
  if (data.error) throw new AIError(data.error.message ?? 'Erreur Gemini', 'gemini')
  if (data.promptFeedback?.blockReason) throw new AIError('Requête bloquée par le filtre de sécurité de Gemini.', 'blocked')
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text.trim()) {
    const reason = data.candidates?.[0]?.finishReason
    throw new AIError(
      reason === 'MAX_TOKENS'
        ? 'Réponse tronquée (limite de tokens). Réduis le nombre de diapositives par lot.'
        : 'Réponse vide du modèle.',
      'empty',
    )
  }
  return text
}

export const callOllama = async (cfg: ProviderConfig, req: AIRequest): Promise<string> => {
  const base = (cfg.baseUrl || 'http://127.0.0.1:11434').replace(/\/+$/, '')
  const res = await fetchWithTimeout(
    `${base}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        messages: req.messages,
        stream: false,
        ...(req.json ? { format: 'json' } : {}),
        options: { temperature: req.temperature ?? cfg.temperature, num_predict: req.maxTokens ?? 8192 },
      }),
    },
    req.signal,
  )
  if (!res.ok) await httpError(res)
  const data = (await res.json()) as { message?: { content?: string }; error?: string }
  if (data.error) throw new AIError(data.error, 'ollama')
  const text = data.message?.content ?? ''
  if (!text.trim()) throw new AIError('Réponse vide d’Ollama. Vérifie que le modèle est bien téléchargé.', 'empty')
  return text
}

export const callOpenAICompatible = async (cfg: ProviderConfig, req: AIRequest): Promise<string> => {
  if (!cfg.apiKey) throw new AIError('Aucune clé API enregistrée.', 'no_key')
  const base = (cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: req.messages,
    temperature: req.temperature ?? cfg.temperature,
    max_tokens: req.maxTokens ?? 8192,
  }
  if (req.json) body.response_format = { type: 'json_object' }
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` }
  if (base.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = location.origin
    headers['X-Title'] = 'Studio'
  }
  let res = await fetchWithTimeout(`${base}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) }, req.signal)
  // certains fournisseurs refusent response_format : on retente sans
  if (!res.ok && req.json && (res.status === 400 || res.status === 422)) {
    delete body.response_format
    res = await fetchWithTimeout(`${base}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) }, req.signal)
  }
  if (!res.ok) await httpError(res)
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } }
  if (data.error) throw new AIError(data.error.message ?? 'Erreur du fournisseur', 'openai')
  const text = data.choices?.[0]?.message?.content ?? ''
  if (!text.trim()) throw new AIError('Réponse vide du modèle.', 'empty')
  return text
}

export const callModel = async (cfg: ProviderConfig, req: AIRequest): Promise<string> => {
  switch (cfg.provider) {
    case 'gemini':
      return callGemini(cfg, req)
    case 'ollama':
      return callOllama(cfg, req)
    case 'openai':
      return callOpenAICompatible(cfg, req)
    default:
      throw new AIError('Fournisseur inconnu.', 'provider')
  }
}

export const listModels = async (cfg: ProviderConfig): Promise<string[]> => {
  try {
    if (cfg.provider === 'ollama') {
      const res = await fetchWithTimeout(`${(cfg.baseUrl || 'http://127.0.0.1:11434').replace(/\/+$/, '')}/api/tags`, {}, undefined, 8000)
      if (!res.ok) return []
      const data = (await res.json()) as { models?: { name: string }[] }
      return (data.models ?? []).map((m) => m.name)
    }
    if (cfg.provider === 'gemini') {
      if (!cfg.apiKey) return []
      const res = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cfg.apiKey)}`, {}, undefined, 12000)
      if (!res.ok) return []
      const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] }
      return (data.models ?? [])
        .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, ''))
    }
    if (!cfg.apiKey) return []
    const res = await fetchWithTimeout(
      `${(cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')}/models`,
      { headers: { Authorization: `Bearer ${cfg.apiKey}` } },
      undefined,
      12000,
    )
    if (!res.ok) return []
    const data = (await res.json()) as { data?: { id: string }[] }
    return (data.data ?? []).map((m) => m.id).slice(0, 200)
  } catch {
    return []
  }
}

/* ------------------------------------------------------------------ */
/* Analyse du JSON renvoyé par le modèle                               */
/* ------------------------------------------------------------------ */

export const extractJson = <T,>(raw: string): T => {
  let text = raw.trim()
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const start = text.search(/[[{]/)
  if (start === -1) throw new AIError('Le modèle n’a pas renvoyé de JSON exploitable.', 'json')
  const opener = text[start]
  const closer = opener === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escape = false
  let end = -1
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\') {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === opener) depth++
    else if (ch === closer) {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) throw new AIError('Réponse JSON incomplète (tronquée).', 'json')
  let slice = text.slice(start, end + 1)
  slice = slice.replace(/,\s*([}\]])/g, '$1')
  try {
    return JSON.parse(slice) as T
  } catch {
    // apostrophes typographiques dans les chaînes, retours à la ligne bruts
    slice = slice.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'")
    try {
      return JSON.parse(slice) as T
    } catch (err) {
      throw new AIError(`JSON invalide : ${(err as Error).message.slice(0, 140)}`, 'json')
    }
  }
}

export const describeAIError = (err: unknown): string => {
  if (err instanceof AIError) return err.message
  if (err instanceof Error) return err.message
  return 'Erreur inconnue.'
}
