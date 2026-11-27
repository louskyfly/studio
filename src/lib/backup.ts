import JSZip from 'jszip'
import { dbDeletePresentation, dbListAssets, dbListFolders, dbListPresentations, dbPutAsset, dbPutFolder, dbPutPresentation } from './db'
import { DB_SCHEMA_VERSION } from './version'
import type { Folder, Presentation } from './model'

interface LibraryFile {
  app: 'studio'
  schema: number
  exportedAt: string
  presentations: Presentation[]
  folders: Folder[]
}

const extOf = (mime: string): string => {
  if (mime.includes('png')) return 'png'
  if (mime.includes('jpeg')) return 'jpg'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  if (mime.includes('svg')) return 'svg'
  return 'bin'
}

export const exportLibrary = async (): Promise<Blob> => {
  const [presentations, folders, assets] = await Promise.all([dbListPresentations(), dbListFolders(), dbListAssets()])
  const zip = new JSZip()
  const meta: LibraryFile = { app: 'studio', schema: DB_SCHEMA_VERSION, exportedAt: new Date().toISOString(), presentations, folders }
  zip.file('studio-library.json', JSON.stringify(meta, null, 2))
  const assetFolder = zip.folder('assets')!
  const index: { id: string; file: string; mime: string; name: string; credit?: string; creditUrl?: string; width?: number; height?: number; createdAt: string }[] = []
  for (const a of assets) {
    const file = `${a.id}.${extOf(a.mime)}`
    assetFolder.file(file, a.blob)
    index.push({ id: a.id, file, mime: a.mime, name: a.name, credit: a.credit, creditUrl: a.creditUrl, width: a.width, height: a.height, createdAt: a.createdAt })
  }
  zip.file('studio-assets.json', JSON.stringify(index, null, 2))
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

export interface ImportResult {
  added: number
  updated: number
  assets: number
  skipped: number
}

export const importLibrary = async (file: File, mode: 'merge' | 'replace' = 'merge'): Promise<ImportResult> => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const metaFile = zip.file('studio-library.json')
  if (!metaFile) throw new Error('Ce fichier ne contient pas de bibliothèque Studio.')
  const meta = JSON.parse(await metaFile.async('string')) as LibraryFile
  if (meta.app !== 'studio' || !Array.isArray(meta.presentations)) throw new Error('Format de sauvegarde non reconnu.')

  const result: ImportResult = { added: 0, updated: 0, assets: 0, skipped: 0 }
  const existing = await dbListPresentations()
  const existingIds = new Set(existing.map((p) => p.id))
  const existingAssets = new Set((await dbListAssets()).map((a) => a.id))

  const assetIndex = zip.file('studio-assets.json')
  if (assetIndex) {
    const list = JSON.parse(await assetIndex.async('string')) as { id: string; file: string; mime: string; name: string; credit?: string; creditUrl?: string; width?: number; height?: number; createdAt: string }[]
    for (const item of list) {
      if (existingAssets.has(item.id)) continue
      const f = zip.file(`assets/${item.file}`)
      if (!f) continue
      const blob = await f.async('blob')
      await dbPutAsset({ ...item, blob, mime: item.mime || blob.type })
      result.assets++
    }
  }

  if (mode === 'replace') {
    for (const p of existing) await dbDeletePresentation(p.id)
  }

  for (const doc of meta.presentations) {
    if (!doc?.id || !Array.isArray(doc.slides)) {
      result.skipped++
      continue
    }
    if (existingIds.has(doc.id) && mode === 'merge') {
      const current = existing.find((p) => p.id === doc.id)!
      if (new Date(doc.updatedAt) <= new Date(current.updatedAt)) {
        result.skipped++
        continue
      }
      await dbPutPresentation(doc)
      result.updated++
    } else {
      await dbPutPresentation(doc)
      result.added++
    }
  }
  for (const folder of meta.folders ?? []) await dbPutFolder(folder)
  return result
}

/** Sauvegarde d'une seule présentation, pour partage entre appareils. */
export const exportPresentation = (doc: Presentation): Blob =>
  new Blob([JSON.stringify({ app: 'studio', schema: DB_SCHEMA_VERSION, presentation: doc }, null, 2)], { type: 'application/json' })

export const importPresentationFile = async (file: File): Promise<Presentation> => {
  const data = JSON.parse(await file.text()) as { app?: string; presentation?: Presentation }
  if (data.app !== 'studio' || !data.presentation?.id) throw new Error('Fichier Studio non reconnu.')
  const doc = data.presentation
  await dbPutPresentation(doc)
  return doc
}
