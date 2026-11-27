import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Folder, ID, Presentation } from './model'

export interface Asset {
  id: ID
  blob: Blob
  mime: string
  name: string
  width?: number
  height?: number
  credit?: string
  creditUrl?: string
  createdAt: string
}

export interface Version {
  id: ID
  presentationId: ID
  createdAt: string
  label: string
  doc: Presentation
}

export interface Settings {
  ai: {
    provider: 'gemini' | 'ollama' | 'openai'
    model: string
    apiKey: string
    baseUrl: string
    temperature: number
  }
  ui: {
    libraryView: 'grid' | 'list'
    sidebarCollapsed: boolean
    lastFolderId: ID | null
  }
  onboarded: boolean
}

interface StudioDB extends DBSchema {
  presentations: {
    key: ID
    value: Presentation
    indexes: { updatedAt: string; folderId: ID }
  }
  assets: { key: ID; value: Asset }
  versions: {
    key: ID
    value: Version
    indexes: { presentationId: ID }
  }
  folders: { key: ID; value: Folder }
  kv: { key: string; value: unknown }
}

const DB_NAME = 'studio'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<StudioDB>> | null = null

export const openStudioDB = (): Promise<IDBPDatabase<StudioDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<StudioDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const p = db.createObjectStore('presentations', { keyPath: 'id' })
        p.createIndex('updatedAt', 'updatedAt')
        p.createIndex('folderId', 'folderId')
        db.createObjectStore('assets', { keyPath: 'id' })
        const v = db.createObjectStore('versions', { keyPath: 'id' })
        v.createIndex('presentationId', 'presentationId')
        db.createObjectStore('folders', { keyPath: 'id' })
        db.createObjectStore('kv')
      },
    })
  }
  return dbPromise
}

export const storageAvailable = async (): Promise<boolean> => {
  try {
    const db = await openStudioDB()
    await db.get('kv', '__probe')
    return true
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* Présentations                                                       */
/* ------------------------------------------------------------------ */

export const dbListPresentations = async (): Promise<Presentation[]> => {
  const db = await openStudioDB()
  return db.getAll('presentations')
}

export const dbGetPresentation = async (id: ID): Promise<Presentation | undefined> => {
  const db = await openStudioDB()
  return db.get('presentations', id)
}

export const dbPutPresentation = async (doc: Presentation): Promise<void> => {
  const db = await openStudioDB()
  await db.put('presentations', doc)
}

export const dbDeletePresentation = async (id: ID): Promise<void> => {
  const db = await openStudioDB()
  const tx = db.transaction(['presentations', 'versions'], 'readwrite')
  await tx.objectStore('presentations').delete(id)
  const idx = tx.objectStore('versions').index('presentationId')
  for await (const cursor of idx.iterate(id)) await cursor.delete()
  await tx.done
}

export const dbDuplicatePresentation = async (doc: Presentation, title: string): Promise<Presentation> => {
  const now = new Date().toISOString()
  const copy: Presentation = {
    ...structuredClone(doc),
    id: `pr_${Math.random().toString(36).slice(2, 12)}`,
    title,
    createdAt: now,
    updatedAt: now,
    favorite: false,
  }
  await dbPutPresentation(copy)
  return copy
}

/* ------------------------------------------------------------------ */
/* Dossiers                                                            */
/* ------------------------------------------------------------------ */

export const dbListFolders = async (): Promise<Folder[]> => {
  const db = await openStudioDB()
  return db.getAll('folders')
}

export const dbPutFolder = async (folder: Folder): Promise<void> => {
  const db = await openStudioDB()
  await db.put('folders', folder)
}

export const dbDeleteFolder = async (id: ID): Promise<void> => {
  const db = await openStudioDB()
  const folders = await db.getAll('folders')
  const ids = new Set<ID>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const f of folders) {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id)
        grew = true
      }
    }
  }
  const tx = db.transaction(['folders', 'presentations'], 'readwrite')
  for (const fid of ids) await tx.objectStore('folders').delete(fid)
  const all = await tx.objectStore('presentations').getAll()
  for (const p of all) {
    if (p.folderId && ids.has(p.folderId)) {
      await tx.objectStore('presentations').put({ ...p, folderId: null })
    }
  }
  await tx.done
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

export const dbPutAsset = async (asset: Asset): Promise<Asset> => {
  const db = await openStudioDB()
  await db.put('assets', asset)
  return asset
}

export const dbGetAsset = async (id: ID): Promise<Asset | undefined> => {
  const db = await openStudioDB()
  return db.get('assets', id)
}

export const dbListAssets = async (): Promise<Asset[]> => {
  const db = await openStudioDB()
  return db.getAll('assets')
}

export const dbDeleteAsset = async (id: ID): Promise<void> => {
  const db = await openStudioDB()
  await db.delete('assets', id)
}

const urlCache = new Map<string, string>()

export const assetUrl = async (id: ID): Promise<string | null> => {
  const cached = urlCache.get(id)
  if (cached) return cached
  const asset = await dbGetAsset(id)
  if (!asset) return null
  const url = URL.createObjectURL(asset.blob)
  urlCache.set(id, url)
  return url
}

/** Précharge une image (utilisé par le glisser-déposer et l'export). */
export const primeAssetUrl = async (id: ID): Promise<string | null> => assetUrl(id)

export const assetDataUrl = async (id: ID): Promise<string | null> => {
  const asset = await dbGetAsset(id)
  if (!asset) return null
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(asset.blob)
  })
}

/* ------------------------------------------------------------------ */
/* Versions                                                            */
/* ------------------------------------------------------------------ */

export const dbAddVersion = async (doc: Presentation, label: string, keep = 25): Promise<void> => {
  const db = await openStudioDB()
  const version: Version = {
    id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    presentationId: doc.id,
    createdAt: new Date().toISOString(),
    label,
    doc: structuredClone(doc),
  }
  const tx = db.transaction('versions', 'readwrite')
  await tx.store.put(version)
  const idx = tx.store.index('presentationId')
  const keys: ID[] = []
  for await (const cursor of idx.iterate(doc.id)) keys.push(cursor.value.id)
  // conserve les plus récentes
  const all = await Promise.all(keys.map((k) => tx.store.get(k)))
  const sorted = all.filter(Boolean).sort((a, b) => (a!.createdAt < b!.createdAt ? 1 : -1))
  for (const old of sorted.slice(keep)) if (old) await tx.store.delete(old.id)
  await tx.done
}

export const dbListVersions = async (presentationId: ID): Promise<Version[]> => {
  const db = await openStudioDB()
  const versions = await db.getAllFromIndex('versions', 'presentationId', presentationId)
  return versions.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export const dbGetVersion = async (id: ID): Promise<Version | undefined> => {
  const db = await openStudioDB()
  return db.get('versions', id)
}

/* ------------------------------------------------------------------ */
/* Réglages                                                            */
/* ------------------------------------------------------------------ */

export const DEFAULT_SETTINGS: Settings = {
  ai: {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    apiKey: '',
    baseUrl: 'http://127.0.0.1:11434',
    temperature: 0.6,
  },
  ui: { libraryView: 'grid', sidebarCollapsed: false, lastFolderId: null },
  onboarded: false,
}

export const dbGetSettings = async (): Promise<Settings> => {
  try {
    const db = await openStudioDB()
    const stored = (await db.get('kv', 'settings')) as Partial<Settings> | undefined
    if (!stored) return structuredClone(DEFAULT_SETTINGS)
    return {
      ...structuredClone(DEFAULT_SETTINGS),
      ...stored,
      ai: { ...DEFAULT_SETTINGS.ai, ...(stored.ai ?? {}) },
      ui: { ...DEFAULT_SETTINGS.ui, ...(stored.ui ?? {}) },
    }
  } catch {
    return structuredClone(DEFAULT_SETTINGS)
  }
}

export const dbPutSettings = async (settings: Settings): Promise<void> => {
  const db = await openStudioDB()
  await db.put('kv', settings, 'settings')
}

export const dbUsage = async (): Promise<{ used: number; quota: number; persisted: boolean }> => {
  try {
    const est = await navigator.storage?.estimate?.()
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false
    return { used: est?.usage ?? 0, quota: est?.quota ?? 0, persisted }
  } catch {
    return { used: 0, quota: 0, persisted: false }
  }
}
