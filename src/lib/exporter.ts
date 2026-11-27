import { create } from 'zustand'
import type { Presentation } from './model'

interface ExporterState {
  doc: Presentation | null
  open: boolean
  openFor: (doc: Presentation) => void
  close: () => void
}

export const useExporter = create<ExporterState>((set) => ({
  doc: null,
  open: false,
  openFor: (doc) => set({ doc, open: true }),
  close: () => set({ open: false }),
}))
