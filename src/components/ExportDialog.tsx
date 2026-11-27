import { useState } from 'react'
import JSZip from 'jszip'
import { Download, FileText, Presentation as PresentationIcon, TriangleAlert } from 'lucide-react'
import { useExporter } from '../lib/exporter'
import { useApp } from '../lib/store'
import { themeById } from '../lib/themes'
import { exportPptx } from '../lib/export/pptx'
import { exportPdf, pdfPageCount } from '../lib/export/pdf'
import { downloadBlob, slugify } from '../lib/utils'
import { Button, Modal, Progress, Spinner } from './ui'

type Format = 'pptx' | 'pdf'

export const ExportDialog = () => {
  const { doc, open, close } = useExporter()
  const toast = useApp((s) => s.toast)
  const [format, setFormat] = useState<Format>('pptx')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const [result, setResult] = useState<{ blob: Blob; filename: string; note: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setBusy(false)
    setDone(0)
    setResult(null)
    setError(null)
  }

  const run = async () => {
    if (!doc) return
    setBusy(true)
    setDone(0)
    setError(null)
    setResult(null)
    const theme = themeById(doc.themeId)
    try {
      if (format === 'pptx') {
        const blob = await exportPptx(doc, theme, (d, t) => setDone(Math.round((d / t) * 100)))
        // vérification : le fichier doit contenir une diapositive par page et du texte natif
        const zip = await JSZip.loadAsync(await blob.arrayBuffer())
        const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        const first = slides[0] ? await zip.files[slides[0]].async('string') : ''
        const hasText = /<a:t>[^<]+<\/a:t>/.test(first)
        if (slides.length !== doc.slides.length || !hasText) {
          throw new Error(`Vérification échouée : ${slides.length} diapositive(s) sur ${doc.slides.length}, texte ${hasText ? 'présent' : 'absent'}.`)
        }
        setResult({
          blob,
          filename: `${slugify(doc.title)}.pptx`,
          note: `${slides.length} diapositives vérifiées, textes et formes natives.`,
        })
      } else {
        const blob = await exportPdf(doc, theme, (d, t) => setDone(Math.round((d / t) * 100)))
        const pages = await pdfPageCount(blob)
        if (pages !== doc.slides.length) throw new Error(`Vérification échouée : ${pages} page(s) sur ${doc.slides.length}.`)
        setResult({ blob, filename: `${slugify(doc.title)}.pdf`, note: `${pages} pages vérifiées, prêtes à imprimer.` })
      }
      setDone(100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export impossible.')
    } finally {
      setBusy(false)
    }
  }

  const download = () => {
    if (!result) return
    downloadBlob(result.blob, result.filename)
    toast('Export téléchargé.', 'success')
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (busy) return
        close()
        setTimeout(reset, 200)
      }}
      title="Exporter la présentation"
      description={doc ? `${doc.title} — ${doc.slides.length} diapositives` : undefined}
      width={540}
      footer={
        result ? (
          <>
            <Button variant="ghost" onClick={() => { close(); setTimeout(reset, 200) }}>
              Fermer
            </Button>
            <Button variant="primary" onClick={download}>
              <Download size={15} /> Télécharger
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" disabled={busy} onClick={() => { close(); setTimeout(reset, 200) }}>
              Annuler
            </Button>
            <Button variant="primary" disabled={busy} onClick={run}>
              {busy ? <Spinner /> : <Download size={15} />}
              {busy ? 'Export en cours…' : 'Exporter'}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            className={`rounded-[11px] border p-3.5 text-left transition ${format === 'pptx' ? 'border-[var(--color-accent)] bg-[#f6f8fb]' : 'border-[var(--color-line)] hover:border-[var(--color-line-strong)]'}`}
            onClick={() => {
              setFormat('pptx')
              reset()
            }}
            disabled={busy}
          >
            <PresentationIcon size={18} className="text-[var(--color-accent)]" />
            <div className="mt-2 text-[13px] font-semibold">PowerPoint</div>
            <div className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-muted)]">Fichier .pptx modifiable : textes, images, tableaux et graphiques natifs.</div>
          </button>
          <button
            className={`rounded-[11px] border p-3.5 text-left transition ${format === 'pdf' ? 'border-[var(--color-accent)] bg-[#f6f8fb]' : 'border-[var(--color-line)] hover:border-[var(--color-line-strong)]'}`}
            onClick={() => {
              setFormat('pdf')
              reset()
            }}
            disabled={busy}
          >
            <FileText size={18} className="text-[var(--color-accent)]" />
            <div className="mt-2 text-[13px] font-semibold">PDF</div>
            <div className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-muted)]">Mise en page fidèle, prêt à imprimer ou à projeter.</div>
          </button>
        </div>

        {busy && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[12px] text-[var(--color-muted)]">
              <span>Préparation du fichier…</span>
              <span className="num">{done}%</span>
            </div>
            <Progress value={done} />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-[9px] border border-[#e7c9c2] bg-[#fdf5f3] px-3 py-2.5 text-[12.5px] leading-snug text-[#8a3226]">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="rounded-[9px] border border-[#cfe2d6] bg-[#f4faf6] px-3 py-2.5 text-[12.5px] text-[#2a5f45]">
            <div className="font-semibold">Fichier prêt et vérifié</div>
            <div className="mt-0.5">{result.note}</div>
            <div className="mt-1 text-[11.5px] opacity-80">{result.filename}</div>
          </div>
        )}

        {!busy && !result && (
          <p className="text-[11.5px] leading-relaxed text-[var(--color-faint)]">
            L’export se fait entièrement dans le navigateur : aucun document n’est envoyé sur un serveur. Les cartes, frises et icônes sont exportées en images haute
            résolution ; le reste reste éditable dans PowerPoint.
          </p>
        )}
      </div>
    </Modal>
  )
}
