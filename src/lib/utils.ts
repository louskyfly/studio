import { clsx, type ClassValue } from 'clsx'

export const cn = (...args: ClassValue[]): string => clsx(args)

export const formatDate = (iso: string, opts: { long?: boolean } = {}): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `aujourd’hui à ${time}`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `hier à ${time}`
  const options: Intl.DateTimeFormatOptions = opts.long
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { day: 'numeric', month: 'short' }
  if (d.getFullYear() !== now.getFullYear()) options.year = 'numeric'
  return d.toLocaleDateString('fr-FR', options)
}

export const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 o'
  const units = ['o', 'Ko', 'Mo', 'Go']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1).replace('.', ',')} ${units[i]}`
}

export const debounce = <A extends unknown[]>(fn: (...args: A) => void, delay: number) => {
  let t: ReturnType<typeof setTimeout> | null = null
  const wrapped = (...args: A) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
  wrapped.cancel = () => {
    if (t) clearTimeout(t)
    t = null
  }
  wrapped.flush = (...args: A) => {
    if (t) clearTimeout(t)
    t = null
    fn(...args)
  }
  return wrapped
}

export const readFileAsDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })

export const readFileAsText = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsText(file)
  })

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export const slugify = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'presentation'

export const imageSize = (blob: Blob): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve({ width: 0, height: 0 })
      URL.revokeObjectURL(url)
    }
    img.src = url
  })

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export const sortBy = <T,>(arr: T[], key: (x: T) => string, dir: 'asc' | 'desc' = 'desc'): T[] =>
  [...arr].sort((a, b) => (key(a) < key(b) ? (dir === 'asc' ? -1 : 1) : dir === 'asc' ? 1 : -1))

export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

export const stripHtml = (html: string): string => {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent ?? ''
}
