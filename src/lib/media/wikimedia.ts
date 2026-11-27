/**
 * Illustrations libres : recherche sur Wikimedia Commons.
 * On ne retient que des fichiers réutilisables et on conserve le crédit.
 */

export interface CommonsImage {
  title: string
  thumbUrl: string
  pageUrl: string
  artist: string
  license: string
}

const API = 'https://commons.wikimedia.org/w/api.php'

const stripHtml = (html: string): string => {
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent ?? '').replace(/\s+/g, ' ').trim()
}

const LICENSE_OK = /(public domain|cc0|cc[ -]by(-sa)?[ -]?\d|pd-|domaine public)/i
const LICENSE_BAD = /(fair use|non[- ]free|all rights reserved|copyright)/i

const mapPage = (page: Record<string, unknown>): CommonsImage | null => {
  const info = (page.imageinfo as Record<string, unknown>[] | undefined)?.[0]
  if (!info) return null
  const url = String(info.thumburl ?? info.url ?? '')
  const mime = String(info.mime ?? '')
  if (!url || !/^image\/(jpeg|png|webp)$/.test(mime)) return null

  const meta = (info.extmetadata ?? {}) as Record<string, { value?: string }>
  const license = stripHtml(meta.LicenseShortName?.value ?? '')
  if (license && (LICENSE_BAD.test(license) || !LICENSE_OK.test(license))) return null
  const artist = stripHtml(meta.Artist?.value ?? '').slice(0, 90)
  const title = String(page.title ?? '').replace(/^File:/, '').replace(/\.[a-z]+$/i, '')

  return {
    title,
    thumbUrl: url,
    pageUrl: String(info.descriptionurl ?? ''),
    artist,
    license: license || 'Wikimedia Commons',
  }
}

const cache = new Map<string, CommonsImage[]>()

export const searchCommons = async (query: string, signal?: AbortSignal): Promise<CommonsImage[]> => {
  const key = query.trim().toLowerCase()
  if (!key) return []
  const hit = cache.get(key)
  if (hit) return hit
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: '6',
    gsrlimit: '10',
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: '1600',
  })
  const res = await fetch(`${API}?${params.toString()}`, { signal })
  if (!res.ok) throw new Error(`Wikimedia a répondu ${res.status}`)
  const data = (await res.json()) as { query?: { pages?: Record<string, Record<string, unknown>> } }
  const pages = Object.values(data.query?.pages ?? {})
  const images = pages.map(mapPage).filter((x): x is CommonsImage => Boolean(x))
  cache.set(key, images)
  return images
}

export const creditFor = (img: CommonsImage): string => {
  const author = img.artist ? img.artist.replace(/\s*\(.*?\)\s*$/, '') : 'Auteur inconnu'
  const lic = img.license.replace(/^CC BY-SA (\d\.\d)$/, 'CC BY-SA $1').replace(/^CC BY (\d\.\d)$/, 'CC BY $1')
  return `${author} — ${lic} — Wikimedia Commons`
}

/**
 * Télécharge la meilleure illustration pour une requête.
 * Renvoie null si rien de réutilisable (on préfère aucune image à une image douteuse).
 */
export const fetchCommonsImage = async (
  query: string,
  signal?: AbortSignal,
): Promise<{ blob: Blob; credit: string; creditUrl: string; name: string } | null> => {
  const images = await searchCommons(query, signal)
  for (const img of images.slice(0, 4)) {
    try {
      const res = await fetch(img.thumbUrl, { signal, mode: 'cors' })
      if (!res.ok) continue
      const blob = await res.blob()
      if (blob.size < 12_000) continue
      return { blob, credit: creditFor(img), creditUrl: img.pageUrl, name: img.title }
    } catch {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      continue
    }
  }
  return null
}
