import { useEffect, useRef, useState } from 'react'
import { Menu as MenuIcon, Plus, Sparkles } from 'lucide-react'
import { useApp } from './lib/store'
import { seedIfEmpty } from './lib/seed'
import { Sidebar } from './components/layout/Sidebar'
import { Home } from './components/library/Home'
import { Library } from './components/library/Library'
import { Settings } from './components/settings/Settings'
import { GenerateWizard } from './components/wizard/GenerateWizard'
import { Editor } from './components/editor/Editor'
import { ExportDialog } from './components/ExportDialog'
import { ToastHost } from './components/ui'

const Splash = () => (
  <div className="flex h-full flex-col items-center justify-center gap-4 bg-[var(--color-paper)]">
    <div className="flex h-11 w-11 animate-pulse items-center justify-center rounded-[11px] bg-[var(--color-accent)]">
      <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden>
        <path d="M20 18h24M20 32h16M20 46h24" stroke="#F7F6F3" strokeWidth="6" strokeLinecap="round" />
        <circle cx="46" cy="32" r="4" fill="#C9A961" />
      </svg>
    </div>
    <div className="serif text-[18px] text-[var(--color-ink)]">Studio</div>
  </div>
)

const MobileBar = ({ onMenu }: { onMenu: () => void }) => {
  const navigate = useApp((s) => s.navigate)
  return (
    <div className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-line)] bg-[#faf9f6]/95 px-3 backdrop-blur lg:hidden">
      <button className="flex items-center gap-2" onClick={onMenu} aria-label="Menu">
        <MenuIcon size={18} className="text-[var(--color-ink-soft)]" />
        <span className="serif text-[16px]">Studio</span>
      </button>
      <button
        className="flex h-8 items-center gap-1.5 rounded-[8px] bg-[var(--color-accent)] px-2.5 text-[12px] font-medium text-white"
        onClick={() => navigate({ name: 'generate', mode: 'topic' })}
      >
        <Plus size={14} /> Nouvelle
      </button>
    </div>
  )
}

export default function App() {  const ready = useApp((s) => s.ready)
  const route = useApp((s) => s.route)
  const loadError = useApp((s) => s.loadError)
  const storageOk = useApp((s) => s.storageOk)
  const init = useApp((s) => s.init)
  const navigate = useApp((s) => s.navigate)
  const [navOpen, setNavOpen] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void (async () => {
      await init()
      await seedIfEmpty().catch(() => {})
    })()
  }, [init])

  if (!ready) return <Splash />

  if (route.name === 'editor' || route.name === 'present') {
    return (
      <>
        <Editor />
        <ExportDialog />
        <ToastHost />
      </>
    )
  }

  if (route.name === 'generate') {
    return (
      <>
        <div className="h-full overflow-y-auto bg-[var(--color-paper)]">
          <GenerateWizard initialMode={route.mode} />
        </div>
        <ExportDialog />
        <ToastHost />
      </>
    )
  }

  return (
    <div className="flex h-full">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {navOpen && (
        <div className="fixed inset-0 z-[70] flex lg:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setNavOpen(false)} />
          <div className="relative h-full animate-fade-in shadow-[10px_0_40px_rgba(0,0,0,.15)]">
            <Sidebar onNavigate={() => setNavOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MobileBar onMenu={() => setNavOpen(true)} />
        {(!storageOk || loadError) && (
          <div className="flex items-start gap-2 border-b border-[#e8dcc4] bg-[#fcf8ef] px-4 py-2 text-[12px] text-[#7a5a1e]">
            <Sparkles size={14} className="mt-0.5 shrink-0" />
            <span>{loadError ?? 'Le stockage local est indisponible. Vos modifications risquent d’être perdues : exportez une sauvegarde.'}</span>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {route.name === 'home' && <Home />}
          {route.name === 'library' && <Library />}
          {route.name === 'favorites' && <Library />}
          {route.name === 'drafts' && <Library />}
          {route.name === 'settings' && <Settings />}
        </div>
        <button
          className="fixed bottom-5 right-5 z-40 flex h-11 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-4 text-[12.5px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,22,26,.5)] transition hover:bg-[var(--color-accent-hover)] lg:hidden"
          onClick={() => navigate({ name: 'generate', mode: 'topic' })}
        >
          <Plus size={16} /> Créer
        </button>
      </main>

      <ExportDialog />
      <ToastHost />
    </div>
  )
}
