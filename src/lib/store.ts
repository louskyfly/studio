import { create } from 'zustand'
import {
  clone,
  emptyPresentation,
  newSlide,
  reId,
  type CreateMode,
  type Folder,
  type ID,
  type Presentation,
  type Slide,
  type SlideElement,
  type Subject,
  type Level,
  type GenerationParams,
} from './model'
import {
  DEFAULT_SETTINGS,
  dbAddVersion,
  dbDeleteFolder,
  dbDeletePresentation,
  dbGetPresentation,
  dbGetSettings,
  dbListFolders,
  dbListPresentations,
  dbPutFolder,
  dbPutPresentation,
  dbPutSettings,
  storageAvailable,
  type Asset,
  dbPutAsset,
  type Settings,
} from './db'
import { imageSize } from './utils'

export type Route =
  | { name: 'home' }
  | { name: 'library'; folderId?: ID | null }
  | { name: 'favorites' }
  | { name: 'drafts' }
  | { name: 'editor'; id: ID }
  | { name: 'present'; id: ID }
  | { name: 'settings' }
  | { name: 'generate'; mode: CreateMode }

export type Toast = { id: string; message: string; tone: 'info' | 'success' | 'error'; action?: { label: string; run: () => void } }

export const parseRoute = (hash: string): Route => {
  const clean = hash.replace(/^#\/?/, '').replace(/\/$/, '')
  const [head, arg] = clean.split('/')
  switch (head) {
    case '':
      return { name: 'home' }
    case 'library':
      return { name: 'library', folderId: arg ?? null }
    case 'favorites':
      return { name: 'favorites' }
    case 'drafts':
      return { name: 'drafts' }
    case 'edit':
      return arg ? { name: 'editor', id: arg } : { name: 'home' }
    case 'present':
      return arg ? { name: 'present', id: arg } : { name: 'home' }
    case 'settings':
      return { name: 'settings' }
    case 'new':
      return { name: 'generate', mode: (arg as CreateMode) ?? 'topic' }
    default:
      return { name: 'home' }
  }
}

export const routeHash = (r: Route): string => {
  switch (r.name) {
    case 'home':
      return '#/'
    case 'library':
      return r.folderId ? `#/library/${r.folderId}` : '#/library'
    case 'favorites':
      return '#/favorites'
    case 'drafts':
      return '#/drafts'
    case 'editor':
      return `#/edit/${r.id}`
    case 'present':
      return `#/present/${r.id}`
    case 'settings':
      return '#/settings'
    case 'generate':
      return `#/new/${r.mode}`
  }
}

interface UpdateOpts {
  history?: boolean
  /** Regroupe les frappes successives dans une seule annulation. */
  coalesce?: string
}

interface AppState {
  ready: boolean
  storageOk: boolean
  loadError: string | null
  presentations: Presentation[]
  folders: Folder[]
  settings: Settings
  route: Route

  current: Presentation | null
  selectedSlideId: ID | null
  selection: ID[]
  past: Presentation[]
  future: Presentation[]
  saveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
  lastSavedAt: string | null
  assetTick: number
  toasts: Toast[]

  init: () => Promise<void>
  navigate: (route: Route) => void
  openPresentation: (id: ID) => Promise<void>
  closeEditor: () => void

  updateCurrent: (fn: (doc: Presentation) => void, opts?: UpdateOpts) => void
  updateSlide: (slideId: ID, fn: (slide: Slide) => void, opts?: UpdateOpts) => void
  updateLive: (fn: (doc: Presentation) => void) => void
  beginHistory: () => void
  applyDocument: (doc: Presentation, label?: string) => void
  undo: () => void
  redo: () => void
  saveNow: (label?: string) => Promise<void>
  scheduleSave: () => void

  selectSlide: (id: ID) => void
  setSelection: (ids: ID[]) => void
  addSlide: (slide?: Slide, afterId?: ID) => ID
  deleteSlide: (id: ID) => void
  duplicateSlide: (id: ID) => void
  moveSlide: (from: number, to: number) => void
  addElement: (el: SlideElement) => void
  updateElement: (elId: ID, patch: Partial<SlideElement>, opts?: UpdateOpts) => void
  deleteElements: (ids: ID[]) => void
  duplicateElements: (ids: ID[]) => void

  createPresentation: (opts?: { title?: string; subject?: Subject; level?: Level; themeId?: string; folderId?: ID | null; slides?: Slide[]; params?: GenerationParams }) => Promise<Presentation>
  insertGenerated: (doc: Presentation, label: string) => Promise<void>
  deletePresentation: (id: ID) => Promise<void>
  duplicatePresentation: (id: ID) => Promise<void>
  renamePresentation: (id: ID, title: string) => Promise<void>
  toggleFavorite: (id: ID) => Promise<void>
  movePresentation: (id: ID, folderId: ID | null) => Promise<void>

  createFolder: (name: string, parentId?: ID | null, color?: string) => Promise<Folder>
  renameFolder: (id: ID, name: string) => Promise<void>
  removeFolder: (id: ID) => Promise<void>

  setSettings: (patch: Partial<Settings>) => Promise<void>
  addAsset: (file: Blob, name: string, extra?: Partial<Asset>) => Promise<Asset>
  addAssetFromUrl: (url: string, name: string, extra?: Partial<Asset>) => Promise<Asset>
  toast: (message: string, tone?: Toast['tone'], action?: Toast['action']) => void
  dismissToast: (id: string) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let savingPromise: Promise<void> | null = null
let lastCoalesce: { key: string; at: number } | null = null
let toastSeq = 0

const HISTORY_LIMIT = 80

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  storageOk: true,
  loadError: null,
  presentations: [],
  folders: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  route: parseRoute(typeof location !== 'undefined' ? location.hash : ''),

  current: null,
  selectedSlideId: null,
  selection: [],
  past: [],
  future: [],
  saveState: 'idle',
  lastSavedAt: null,
  assetTick: 0,
  toasts: [],

  init: async () => {
    try {
      const ok = await storageAvailable()
      const [docs, folders, settings] = await Promise.all([dbListPresentations(), dbListFolders(), dbGetSettings()])
      if (!ok) {
        set({ storageOk: false, loadError: 'Le stockage local du navigateur est indisponible (navigation privée ?). Les modifications ne seront pas conservées.' })
      }
      if (navigator.storage?.persist) navigator.storage.persist().catch(() => {})
      set({ ready: true, presentations: docs, folders, settings, storageOk: ok })

      const route = parseRoute(location.hash)
      if (route.name === 'editor' || route.name === 'present') {
        const doc = docs.find((d) => d.id === route.id)
        if (doc) {
          set({
            current: clone(doc),
            selectedSlideId: doc.slides[0]?.id ?? null,
            route: route.name === 'present' ? { name: 'present', id: doc.id } : { name: 'editor', id: doc.id },
          })
          if (route.name === 'present') {
            // l'éditeur reste chargé derrière le mode présentation
            set({ route: { name: 'present', id: doc.id } })
          }
        } else {
          set({ route: { name: 'home' } })
          history.replaceState(null, '', '#/')
        }
      }
      window.addEventListener('hashchange', () => {
        const next = parseRoute(location.hash)
        if (next.name !== get().route.name) {
          get().closeEditor()
          set({ route: next })
          if (next.name === 'editor' || next.name === 'present') void get().openPresentation(next.id)
        }
      })
      window.addEventListener('pagehide', () => {
        const doc = get().current
        if (doc && get().saveState === 'dirty') void dbPutPresentation(doc)
      })
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          const doc = get().current
          if (doc && get().saveState === 'dirty') void dbPutPresentation(doc)
        }
      })
    } catch (err) {
      set({ ready: true, loadError: err instanceof Error ? err.message : 'Impossible de charger la bibliothèque.' })
    }
  },

  navigate: (route) => {
    if (get().current && get().route.name === 'editor' && route.name !== 'present') void get().saveNow()
    set({ route })
    const hash = routeHash(route)
    if (location.hash !== hash) history.pushState(null, '', hash)
    if (route.name === 'editor' || route.name === 'present') {
      if (get().current?.id !== route.id) void get().openPresentation(route.id)
    }
  },

  openPresentation: async (id) => {
    let doc = get().presentations.find((p) => p.id === id)
    if (!doc) doc = await dbGetPresentation(id)
    if (!doc) {
      get().toast('Présentation introuvable.', 'error')
      get().navigate({ name: 'home' })
      return
    }
    set({
      current: clone(doc),
      selectedSlideId: doc.slides[0]?.id ?? null,
      selection: [],
      past: [],
      future: [],
      saveState: 'saved',
      lastSavedAt: doc.updatedAt,
    })
  },

  closeEditor: () => {
    const doc = get().current
    if (doc && get().saveState !== 'saved') {
      void dbPutPresentation(doc)
      set((s) => ({ presentations: s.presentations.map((p) => (p.id === doc.id ? doc : p)) }))
    }
    set({ current: null, selectedSlideId: null, selection: [], past: [], future: [], saveState: 'idle' })
  },

  updateCurrent: (fn, opts = {}) => {
    const state = get()
    if (!state.current) return
    const before = state.current
    const next = clone(before)
    fn(next)
    next.updatedAt = new Date().toISOString()

    let past = state.past
    const now = Date.now()
    const coalesceKey = opts.coalesce
    const shouldPush = opts.history !== false && !(coalesceKey && lastCoalesce && lastCoalesce.key === coalesceKey && now - lastCoalesce.at < 1200)
    if (shouldPush) past = [...state.past, before].slice(-HISTORY_LIMIT)
    if (coalesceKey) lastCoalesce = { key: coalesceKey, at: now }

    set({ current: next, past, future: [], saveState: 'dirty', selection: state.selection.filter((id) => findElement(next, id)) })
    get().scheduleSave()
  },

  updateSlide: (slideId, fn, opts) => {
    get().updateCurrent((doc) => {
      const slide = doc.slides.find((s) => s.id === slideId)
      if (slide) fn(slide)
    }, opts)
  },

  beginHistory: () => {
    const state = get()
    if (!state.current) return
    set({ past: [...state.past, clone(state.current)].slice(-HISTORY_LIMIT), future: [] })
  },

  updateLive: (fn) => {
    const state = get()
    if (!state.current) return
    const next = clone(state.current)
    fn(next)
    next.updatedAt = new Date().toISOString()
    set({ current: next, saveState: 'dirty' })
    get().scheduleSave()
  },

  applyDocument: (doc, label) => {
    const state = get()
    const next = { ...doc, updatedAt: new Date().toISOString() }
    const keepSlide = state.selectedSlideId && doc.slides.some((s) => s.id === state.selectedSlideId) ? state.selectedSlideId : (doc.slides[0]?.id ?? null)
    set({
      current: next,
      past: state.current ? [...state.past, state.current].slice(-HISTORY_LIMIT) : state.past,
      future: [],
      selectedSlideId: keepSlide,
      selection: [],
      saveState: 'dirty',
    })
    if (state.current) void dbAddVersion(state.current, label ?? 'Avant modification').catch(() => {})
    get().scheduleSave()
  },

  undo: () => {
    const { past, current, future } = get()
    if (!past.length || !current) return
    const prev = past[past.length - 1]
    set({ current: prev, past: past.slice(0, -1), future: [current, ...future].slice(0, HISTORY_LIMIT), saveState: 'dirty' })
    get().scheduleSave()
  },

  redo: () => {
    const { past, current, future } = get()
    if (!future.length || !current) return
    const next = future[0]
    set({ current: next, past: [...past, current].slice(-HISTORY_LIMIT), future: future.slice(1), saveState: 'dirty' })
    get().scheduleSave()
  },

  saveNow: async (label) => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (savingPromise) await savingPromise
    const doc = get().current
    if (!doc) return
    const run = async () => {
      set({ saveState: 'saving' })
      try {
        await dbPutPresentation(doc)
        if (label) await dbAddVersion(doc, label)
        set((s) => ({
          saveState: 'saved',
          lastSavedAt: new Date().toISOString(),
          presentations: s.presentations.some((p) => p.id === doc.id) ? s.presentations.map((p) => (p.id === doc.id ? doc : p)) : [...s.presentations, doc],
        }))
      } catch (err) {
        console.error(err)
        set({ saveState: 'error' })
        get().toast('Sauvegarde impossible. Vérifie l’espace de stockage du navigateur.', 'error')
      }
    }
    savingPromise = run().finally(() => {
      savingPromise = null
    })
    await savingPromise
  },

  scheduleSave: () => {
    if (saveTimer) clearTimeout(saveTimer)
    set({ saveState: 'dirty' })
    saveTimer = setTimeout(() => {
      saveTimer = null
      void get().saveNow()
    }, 550)
  },

  selectSlide: (id) => set({ selectedSlideId: id, selection: [] }),
  setSelection: (ids) => set({ selection: ids }),

  addSlide: (slide, afterId) => {
    const newOne = slide ?? newSlide('blank')
    get().updateCurrent((doc) => {
      const idx = afterId ? doc.slides.findIndex((s) => s.id === afterId) : doc.slides.length - 1
      doc.slides.splice(idx + 1, 0, newOne)
    })
    set({ selectedSlideId: newOne.id, selection: [] })
    return newOne.id
  },

  deleteSlide: (id) => {
    const doc = get().current
    if (!doc || doc.slides.length <= 1) return
    const idx = doc.slides.findIndex((s) => s.id === id)
    get().updateCurrent((d) => {
      d.slides = d.slides.filter((s) => s.id !== id)
    })
    const nextSlide = doc.slides[Math.min(idx, doc.slides.length - 2)] ?? doc.slides[0]
    set({ selectedSlideId: nextSlide?.id ?? null, selection: [] })
  },

  duplicateSlide: (id) => {
    const doc = get().current
    const slide = doc?.slides.find((s) => s.id === id)
    if (!slide) return
    const copy = reId(slide)
    get().updateCurrent((d) => {
      const idx = d.slides.findIndex((s) => s.id === id)
      d.slides.splice(idx + 1, 0, copy)
    })
    set({ selectedSlideId: copy.id, selection: [] })
  },

  moveSlide: (from, to) => {
    if (from === to) return
    get().updateCurrent((doc) => {
      const [moved] = doc.slides.splice(from, 1)
      if (moved) doc.slides.splice(to, 0, moved)
    })
  },

  addElement: (el) => {
    const slideId = get().selectedSlideId
    if (!slideId) return
    get().updateSlide(slideId, (slide) => {
      slide.elements.push(el)
    })
    set({ selection: [el.id] })
  },

  updateElement: (elId, patch, opts) => {
    const slideId = get().selectedSlideId
    if (!slideId) return
    get().updateSlide(
      slideId,
      (slide) => {
        const el = slide.elements.find((e) => e.id === elId)
        if (el) Object.assign(el, patch)
      },
      opts,
    )
  },

  deleteElements: (ids) => {
    const slideId = get().selectedSlideId
    if (!slideId || !ids.length) return
    get().updateSlide(slideId, (slide) => {
      slide.elements = slide.elements.filter((e) => !ids.includes(e.id))
    })
    set({ selection: [] })
  },

  duplicateElements: (ids) => {
    const slideId = get().selectedSlideId
    if (!slideId || !ids.length) return
    const slide = get().current?.slides.find((s) => s.id === slideId)
    if (!slide) return
    const copies = slide.elements.filter((e) => ids.includes(e.id)).map((e) => ({ ...clone(e), id: `el_${Math.random().toString(36).slice(2, 12)}`, x: e.x + 24, y: e.y + 24 }))
    get().updateSlide(slideId, (s) => {
      s.elements.push(...copies)
    })
    set({ selection: copies.map((c) => c.id) })
  },

  createPresentation: async (opts = {}) => {
    const doc = emptyPresentation(opts)
    const theme = (await import('./themes')).themeById(doc.themeId)
    const { blankSlideFor } = await import('./layouts')
    doc.slides = opts.slides ?? [blankSlideFor('title', theme)]
    if (opts.title) doc.title = opts.title
    doc.source = { kind: 'blank', params: opts.params }
    await dbPutPresentation(doc)
    set((s) => ({ presentations: [doc, ...s.presentations] }))
    set({ current: clone(doc), selectedSlideId: doc.slides[0]?.id ?? null, past: [], future: [], saveState: 'saved' })
    get().navigate({ name: 'editor', id: doc.id })
    return doc
  },

  insertGenerated: async (doc, label) => {
    await dbPutPresentation(doc)
    set((s) => ({ presentations: [doc, ...s.presentations.filter((p) => p.id !== doc.id)] }))
    set({ current: clone(doc), selectedSlideId: doc.slides[0]?.id ?? null, past: [], future: [], saveState: 'saved' })
    await dbAddVersion(doc, label).catch(() => {})
    get().navigate({ name: 'editor', id: doc.id })
  },

  deletePresentation: async (id) => {
    await dbDeletePresentation(id)
    set((s) => ({
      presentations: s.presentations.filter((p) => p.id !== id),
      current: s.current?.id === id ? null : s.current,
    }))
    if (get().route.name === 'editor' || get().route.name === 'present') get().navigate({ name: 'library' })
    get().toast('Présentation supprimée.', 'success')
  },

  duplicatePresentation: async (id) => {
    const src = get().presentations.find((p) => p.id === id)
    if (!src) return
    const now = new Date().toISOString()
    const copy: Presentation = { ...clone(src), id: `pr_${Math.random().toString(36).slice(2, 12)}`, title: `${src.title} — copie`, createdAt: now, updatedAt: now, favorite: false }
    await dbPutPresentation(copy)
    set((s) => ({ presentations: [copy, ...s.presentations] }))
    get().toast('Copie créée.', 'success')
  },

  renamePresentation: async (id, title) => {
    const clean = title.trim()
    if (!clean) return
    const doc = get().presentations.find((p) => p.id === id)
    if (!doc) return
    const next = { ...doc, title: clean, updatedAt: new Date().toISOString() }
    await dbPutPresentation(next)
    set((s) => ({
      presentations: s.presentations.map((p) => (p.id === id ? next : p)),
      current: s.current?.id === id ? { ...s.current, title: clean } : s.current,
    }))
  },

  toggleFavorite: async (id) => {
    const doc = get().presentations.find((p) => p.id === id)
    if (!doc) return
    const next = { ...doc, favorite: !doc.favorite }
    await dbPutPresentation(next)
    set((s) => ({
      presentations: s.presentations.map((p) => (p.id === id ? next : p)),
      current: s.current?.id === id ? { ...s.current, favorite: next.favorite } : s.current,
    }))
  },

  movePresentation: async (id, folderId) => {
    const doc = get().presentations.find((p) => p.id === id)
    if (!doc) return
    const next = { ...doc, folderId, updatedAt: new Date().toISOString() }
    await dbPutPresentation(next)
    set((s) => ({ presentations: s.presentations.map((p) => (p.id === id ? next : p)) }))
  },

  createFolder: async (name, parentId = null, color) => {
    const folder: Folder = {
      id: `f_${Math.random().toString(36).slice(2, 12)}`,
      name: name.trim() || 'Nouveau dossier',
      parentId: parentId ?? null,
      color,
      createdAt: new Date().toISOString(),
    }
    await dbPutFolder(folder)
    set((s) => ({ folders: [...s.folders, folder] }))
    return folder
  },

  renameFolder: async (id, name) => {
    const folder = get().folders.find((f) => f.id === id)
    if (!folder) return
    const next = { ...folder, name: name.trim() || folder.name }
    await dbPutFolder(next)
    set((s) => ({ folders: s.folders.map((f) => (f.id === id ? next : f)) }))
  },

  removeFolder: async (id) => {
    await dbDeleteFolder(id)
    const closures = await dbListPresentations()
    set({ folders: (await dbListFolders()), presentations: closures })
    get().toast('Dossier supprimé. Les présentations ont été déplacées à la racine.', 'success')
  },

  setSettings: async (patch) => {
    const next: Settings = {
      ...get().settings,
      ...patch,
      ai: { ...get().settings.ai, ...(patch.ai ?? {}) },
      ui: { ...get().settings.ui, ...(patch.ui ?? {}) },
    }
    set({ settings: next })
    await dbPutSettings(next)
  },

  addAsset: async (file, name, extra = {}) => {
    const size = file.type.startsWith('image/') ? await imageSize(file) : { width: 0, height: 0 }
    const asset: Asset = {
      id: `a_${Math.random().toString(36).slice(2, 12)}`,
      blob: file,
      mime: file.type || 'application/octet-stream',
      name,
      width: size.width,
      height: size.height,
      createdAt: new Date().toISOString(),
      ...extra,
    }
    await dbPutAsset(asset)
    set((s) => ({ assetTick: s.assetTick + 1 }))
    return asset
  },

  addAssetFromUrl: async (url, name, extra = {}) => {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`)
    const blob = await res.blob()
    return get().addAsset(blob, name, extra)
  },

  toast: (message, tone = 'info', action) => {
    const id = `t${++toastSeq}`
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, tone, action }] }))
    setTimeout(() => get().dismissToast(id), action ? 8000 : 4200)
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

const findElement = (doc: Presentation, elId: ID): boolean => doc.slides.some((s) => s.elements.some((e) => e.id === elId))

/* Sélecteurs dérivés ------------------------------------------------ */

export const useCurrentSlide = (): Slide | null => {
  const current = useApp((s) => s.current)
  const selected = useApp((s) => s.selectedSlideId)
  return current?.slides.find((s) => s.id === selected) ?? null
}
