import { useEffect, useState } from 'react'
import { assetUrl } from '../lib/db'

const cache = new Map<string, string>()
const pending = new Map<string, Promise<string | null>>()

export const useAssetUrl = (id: string | undefined | null): string | null => {
  const [url, setUrl] = useState<string | null>(() => (id ? (cache.get(id) ?? null) : null))

  useEffect(() => {
    let alive = true
    if (!id) {
      setUrl(null)
      return
    }
    const ready = cache.get(id)
    if (ready) {
      setUrl(ready)
      return
    }
    let p = pending.get(id)
    if (!p) {
      p = assetUrl(id)
      pending.set(id, p)
    }
    p.then((u) => {
      pending.delete(id)
      if (u) cache.set(id, u)
      if (alive) setUrl(u)
    })
    return () => {
      alive = false
    }
  }, [id])

  return url
}

export const peekAssetUrl = (id: string): string | null => cache.get(id) ?? null
