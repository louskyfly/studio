/**
 * Extraction de texte côté navigateur : PDF, DOCX, PPTX, TXT/MD.
 * Aucun fichier n'est envoyé sur un serveur.
 */

export interface ExtractedDoc {
  name: string
  kind: 'pdf' | 'docx' | 'pptx' | 'text' | 'image'
  text: string
  pages?: number
  warning?: string
  size: number
}

const MAX_CHARS = 60_000

export const fileKind = (file: File): ExtractedDoc['kind'] | null => {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf'
  if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) return 'docx'
  if (name.endsWith('.pptx') || file.type.includes('presentationml')) return 'pptx'
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv') || file.type.startsWith('text/')) return 'text'
  if (file.type.startsWith('image/')) return 'image'
  return null
}

const tidy = (text: string): string =>
  text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\u00ad/g, '')
    .trim()

const extractPdf = async (file: File): Promise<{ text: string; pages: number }> => {
  const pdfjs = await import('pdfjs-dist')
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data, useWorkerFetch: false }).promise
  const chunks: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const items = content.items as { str?: string; transform?: number[] }[]
    // reconstitue les lignes à partir de la position verticale
    const rows = new Map<number, { x: number; s: string }[]>()
    for (const it of items) {
      if (!it.str || !it.transform) continue
      const y = Math.round(it.transform[5] / 3) * 3
      const x = it.transform[4]
      if (!rows.has(y)) rows.set(y, [])
      rows.get(y)!.push({ x, s: it.str })
    }
    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    chunks.push(lines.join('\n'))
    if (chunks.join('\n').length > MAX_CHARS) break
  }
  return { text: tidy(chunks.join('\n\n')), pages: doc.numPages }
}

const extractDocx = async (file: File): Promise<string> => {
  const mod = (await import('mammoth/mammoth.browser.js')) as unknown as {
    default?: { extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> }
    extractRawText?: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
  }
  const mammoth = mod.default ?? (mod as unknown as { extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> })
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  return tidy(result.value)
}

const extractPptx = async (file: File): Promise<string> => {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)![0], 10)
      const nb = parseInt(b.match(/\d+/)![0], 10)
      return na - nb
    })
  const out: string[] = []
  for (const name of slideNames) {
    const xml = await zip.files[name].async('string')
    const texts = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) =>
      m[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'"),
    )
    if (texts.length) out.push(texts.join('\n'))
  }
  return tidy(out.join('\n\n'))
}

export const extractFile = async (file: File): Promise<ExtractedDoc> => {
  const kind = fileKind(file)
  const base: ExtractedDoc = { name: file.name, kind: kind ?? 'text', text: '', size: file.size }
  if (!kind) {
    return { ...base, warning: 'Format non reconnu. Formats acceptés : PDF, DOCX, PPTX, TXT, MD.' }
  }
  try {
    if (kind === 'pdf') {
      const { text, pages } = await extractPdf(file)
      if (text.length < 40) {
        return {
          ...base,
          text,
          pages,
          warning:
            'Ce PDF semble être un scan sans couche texte. L’IA ne peut pas le lire : joins une version texte ou un document numérisé avec OCR.',
        }
      }
      return { ...base, text: text.slice(0, MAX_CHARS), pages }
    }
    if (kind === 'docx') {
      const text = await extractDocx(file)
      return { ...base, text: text.slice(0, MAX_CHARS), warning: text.length < 20 ? 'Ce document Word ne contient pas de texte exploitable.' : undefined }
    }
    if (kind === 'pptx') {
      const text = await extractPptx(file)
      return { ...base, text: text.slice(0, MAX_CHARS), warning: text.length < 20 ? 'Ce PowerPoint ne contient pas de texte exploitable.' : undefined }
    }
    if (kind === 'text') {
      const text = await file.text()
      return { ...base, text: tidy(text).slice(0, MAX_CHARS) }
    }
    return { ...base, warning: 'Image importée comme illustration. L’analyse de texte dans une image n’est pas activée.' }
  } catch (err) {
    return { ...base, warning: `Lecture impossible : ${err instanceof Error ? err.message : 'erreur inconnue'}` }
  }
}
