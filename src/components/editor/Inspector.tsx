import { useEffect, useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  BringToFront,
  Copy,
  Italic,
  Lock,
  Plus,
  SendToBack,
  Trash2,
  Underline,
  Unlock,
} from 'lucide-react'
import { useApp, useCurrentSlide } from '../../lib/store'
import type { ChartEl, IconEl, ImageEl, MapEl, ShapeEl, SlideElement, TableEl, TextEl, TimelineEl } from '../../lib/model'
import { themeById, FONT_CHOICES } from '../../lib/themes'
import { BACKGROUND_PRESETS, ELEMENT_LABELS, ICON_NAMES } from '../../lib/elements'
import { Button, Select } from '../ui'
import { BackgroundSwatch } from './BackgroundSwatch'
import { cn } from '../../lib/utils'

/* ------------------------------------------------------------------ */
/* Petits champs                                                       */
/* ------------------------------------------------------------------ */

const Section = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="border-b border-[var(--color-line)] px-4 py-3.5 last:border-b-0">
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-[var(--color-faint)]">{title}</h3>
      {action}
    </div>
    {children}
  </div>
)

const Num = ({ value, onChange, label, step = 1, min, max }: { value: number; onChange: (v: number) => void; label?: string; step?: number; min?: number; max?: number }) => (
  <label className="flex items-center gap-1.5 rounded-[7px] border border-[var(--color-line-strong)] bg-white px-2 py-1">
    {label && <span className="text-[10px] font-medium uppercase text-[var(--color-faint)]">{label}</span>}
    <input
      type="number"
      value={Number.isFinite(value) ? Math.round(value * 10) / 10 : 0}
      step={step}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full min-w-0 bg-transparent text-[12px] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
    />
  </label>
)

const ColorField = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) => {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'
  return (
    <label className="flex items-center gap-2">
      {label && <span className="text-[11.5px] text-[var(--color-muted)]">{label}</span>}
      <span className="relative h-7 w-7 overflow-hidden rounded-[6px] border border-[var(--color-line-strong)]">
        <input type="color" value={safe} onChange={(e) => onChange(e.target.value)} className="absolute -inset-2 h-12 w-12 cursor-pointer border-0 p-0" />
      </span>
      <input
        value={value.replace('#', '')}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6)
          onChange(`#${v}`)
        }}
        className="w-[74px] rounded-[6px] border border-[var(--color-line-strong)] px-1.5 py-1 font-mono text-[11px] uppercase outline-none focus:border-[#8ba3bd]"
      />
    </label>
  )
}

const CsvInput = ({ value, onCommit, placeholder }: { value: string; onCommit: (v: string[]) => void; placeholder?: string }) => {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text.split(/[,;]/).map((s) => s.trim()).filter(Boolean))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur()
        }
      }}
      placeholder={placeholder}
      className="input h-8 text-[12px]"
    />
  )
}

/* ------------------------------------------------------------------ */
/* Inspecteur                                                          */
/* ------------------------------------------------------------------ */

export const Inspector = ({ onEditText }: { onEditText: (id: string) => void }) => {
  const current = useApp((s) => s.current)
  const slide = useCurrentSlide()
  const selection = useApp((s) => s.selection)
  const updateElement = useApp((s) => s.updateElement)
  const updateSlide = useApp((s) => s.updateSlide)
  const deleteElements = useApp((s) => s.deleteElements)
  const duplicateElements = useApp((s) => s.duplicateElements)
  const setSelection = useApp((s) => s.setSelection)
  const addSlide = useApp((s) => s.addSlide)
  const deleteSlide = useApp((s) => s.deleteSlide)
  const duplicateSlide = useApp((s) => s.duplicateSlide)

  const theme = themeById(current?.themeId ?? 'ivoire')
  const el = slide?.elements.find((e) => e.id === selection[0])

  if (!slide || !current) return null

  const patch = (p: Partial<SlideElement>, coalesce?: string) => {
    if (!el) return
    updateElement(el.id, p, coalesce ? { coalesce } : undefined)
  }

  const patchStyle = (p: Partial<TextEl['style']>, key: string) => {
    if (!el || el.type !== 'text') return
    updateElement(el.id, { style: { ...el.style, ...p } } as Partial<SlideElement>, { coalesce: `style-${el.id}-${key}` })
  }

  /* --------------------------- diapositive --------------------------- */

  if (!el) {
    const bg = slide.background
    return (
      <div className="pb-10">
        <Section
          title="Arrière-plan"
          action={
            <span className="text-[10.5px] text-[var(--color-faint)]">{bg.type === 'solid' ? 'uni' : bg.type}</span>
          }
        >
          <div className="grid grid-cols-5 gap-1.5">
            {BACKGROUND_PRESETS(theme).map((p) => (
              <BackgroundSwatch
                key={p.id}
                bg={p.bg}
                theme={theme}
                title={p.label}
                selected={JSON.stringify(slide.background) === JSON.stringify(p.bg)}
                onClick={() =>
                  updateSlide(slide.id, (s) => {
                    s.background = p.bg
                  })
                }
              />
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <ColorField
              value={bg.type === 'solid' ? bg.color : bg.type === 'gradient' ? bg.from : theme.bg}
              onChange={(color) =>
                updateSlide(slide.id, (s) => {
                  s.background = { type: 'solid', color }
                })
              }
              label="Couleur"
            />
          </div>
          <label className="mt-2.5 flex cursor-pointer items-center justify-center gap-1.5 rounded-[7px] border border-dashed border-[var(--color-line-strong)] py-2 text-[11.5px] text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-ink)]">
            Image de fond…
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const asset = await useApp.getState().addAsset(f, f.name)
                updateSlide(slide.id, (s) => {
                  s.background = { type: 'image', assetId: asset.id, overlay: 0.25, overlayColor: '#000000' }
                })
                e.target.value = ''
              }}
            />
          </label>
          {bg.type === 'image' && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11.5px] text-[var(--color-muted)]">Voile</span>
              <input
                type="range"
                min={0}
                max={0.8}
                step={0.05}
                value={bg.overlay ?? 0}
                onChange={(e) =>
                  updateSlide(slide.id, (s) => {
                    s.background = { ...bg, overlay: Number(e.target.value) }
                  })
                }
                className="h-1 flex-1 accent-[var(--color-accent)]"
              />
            </div>
          )}
        </Section>

        <Section title="Notes du professeur">
          <textarea
            value={slide.notes ?? ''}
            onChange={(e) =>
              updateSlide(slide.id, (s) => {
                s.notes = e.target.value
              })
            }
            placeholder="Ce que vous direz à l’oral, les consignes, les questions à poser…"
            className="textarea min-h-[110px] text-[12px]"
          />
          <p className="mt-1.5 text-[10.5px] leading-snug text-[var(--color-faint)]">Les notes ne s’affichent pas sur la diapositive ; elles sont exportées dans PowerPoint.</p>
        </Section>

        <Section title="Cette diapositive">
          <div className="grid grid-cols-2 gap-1.5">
            <Button variant="secondary" className="h-8 text-[12px]" onClick={() => duplicateSlide(slide.id)}>
              <Copy size={13} /> Dupliquer
            </Button>
            <Button variant="secondary" className="h-8 text-[12px]" onClick={() => addSlide(undefined, slide.id)}>
              <Plus size={13} /> Insérer après
            </Button>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <Button
              variant="secondary"
              className="h-8 text-[12px]"
              onClick={() =>
                updateSlide(slide.id, (s) => {
                  s.hidden = !s.hidden
                })
              }
            >
              {slide.hidden ? 'Réafficher' : 'Masquer'}
            </Button>
            <Button variant="secondary" className="h-8 text-[12px] text-[var(--color-danger)]" disabled={current.slides.length <= 1} onClick={() => deleteSlide(slide.id)}>
              <Trash2 size={13} /> Supprimer
            </Button>
          </div>
          <p className="mt-2 text-[10.5px] leading-snug text-[var(--color-faint)]">
            Cliquez un élément pour le modifier, ou ajoutez du contenu avec la barre d’outils au-dessus de la diapositive.
          </p>
        </Section>
      </div>
    )
  }

  /* ------------------------------ élément ----------------------------- */

  const type = el.type

  return (
    <div className="pb-10">
      <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="chip chip-accent">{ELEMENT_LABELS[type]}</span>
          {el.locked && <Lock size={12} className="text-[var(--color-faint)]" />}
        </div>
        <span className="text-[10.5px] text-[var(--color-faint)]">
          {Math.round(el.w)} × {Math.round(el.h)}
        </span>
      </div>

      <Section title="Position et taille">
        <div className="grid grid-cols-2 gap-1.5">
          <Num label="X" value={el.x} onChange={(v) => patch({ x: v }, 'x')} />
          <Num label="Y" value={el.y} onChange={(v) => patch({ y: v }, 'y')} />
          <Num label="L" value={el.w} onChange={(v) => patch({ w: Math.max(12, v) }, 'w')} />
          <Num label="H" value={el.h} onChange={(v) => patch({ h: Math.max(12, v) }, 'h')} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="w-[65px] shrink-0 text-[11.5px] text-[var(--color-muted)]">Opacité</span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={el.opacity ?? 1}
            onChange={(e) => patch({ opacity: Number(e.target.value) }, 'opacity')}
            className="h-1 flex-1 accent-[var(--color-accent)]"
          />
          <span className="num w-8 text-right text-[11px] text-[var(--color-faint)]">{Math.round((el.opacity ?? 1) * 100)}%</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="w-[65px] shrink-0 text-[11.5px] text-[var(--color-muted)]">Rotation</span>
          <input
            type="range"
            min={-45}
            max={45}
            step={1}
            value={el.rotation ?? 0}
            onChange={(e) => patch({ rotation: Number(e.target.value) }, 'rot')}
            className="h-1 flex-1 accent-[var(--color-accent)]"
          />
          <span className="num w-8 text-right text-[11px] text-[var(--color-faint)]">{Math.round(el.rotation ?? 0)}°</span>
        </div>
      </Section>

      {el.type === 'text' && (
        <>
          <Section title="Texte">
            <Button variant="secondary" className="h-8 w-full text-[12px]" onClick={() => onEditText(el.id)}>
              Modifier le texte dans la diapositive
            </Button>
            <div className="mt-2 grid grid-cols-3 gap-1">
              <button
                className={cn('flex h-7 items-center justify-center rounded-[6px] border text-[12px]', el.style.bold ? 'border-[var(--color-accent)] bg-[#f0f4f9]' : 'border-[var(--color-line-strong)] hover:bg-[#faf9f6]')}
                onClick={() => patchStyle({ bold: !el.style.bold }, 'bold')}
                title="Gras"
              >
                <Bold size={13} />
              </button>
              <button
                className={cn('flex h-7 items-center justify-center rounded-[6px] border text-[12px]', el.style.italic ? 'border-[var(--color-accent)] bg-[#f0f4f9]' : 'border-[var(--color-line-strong)] hover:bg-[#faf9f6]')}
                onClick={() => patchStyle({ italic: !el.style.italic }, 'italic')}
                title="Italique"
              >
                <Italic size={13} />
              </button>
              <button
                className={cn('flex h-7 items-center justify-center rounded-[6px] border text-[12px]', el.style.underline ? 'border-[var(--color-accent)] bg-[#f0f4f9]' : 'border-[var(--color-line-strong)] hover:bg-[#faf9f6]')}
                onClick={() => patchStyle({ underline: !el.style.underline }, 'underline')}
                title="Souligné"
              >
                <Underline size={13} />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {(['left', 'center', 'right', 'justify'] as const).map((a) => (
                <button
                  key={a}
                  className={cn('flex h-7 items-center justify-center rounded-[6px] border', el.style.align === a ? 'border-[var(--color-accent)] bg-[#f0f4f9]' : 'border-[var(--color-line-strong)] hover:bg-[#faf9f6]')}
                  onClick={() => patchStyle({ align: a }, 'align')}
                  title={`Aligner ${a}`}
                >
                  {a === 'left' ? <AlignLeft size={13} /> : a === 'center' ? <AlignCenter size={13} /> : a === 'right' ? <AlignRight size={13} /> : <span className="text-[10px]">Just.</span>}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Num label="Taille" value={el.style.fontSize} onChange={(v) => patchStyle({ fontSize: Math.max(8, v) }, 'size')} />
              <Select value={el.style.valign} onChange={(e) => patchStyle({ valign: e.target.value as TextEl['style']['valign'] }, 'valign')} className="h-7 text-[11.5px]">
                <option value="top">Haut</option>
                <option value="middle">Milieu</option>
                <option value="bottom">Bas</option>
              </Select>
            </div>
            <Select value={el.style.fontFamily} onChange={(e) => patchStyle({ fontFamily: e.target.value }, 'font')} className="mt-1.5 h-8 text-[12px]">
              {FONT_CHOICES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
            <div className="mt-2 flex items-center justify-between">
              <ColorField value={el.style.color} onChange={(v) => patchStyle({ color: v }, 'color')} label="Couleur" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="w-[52px] shrink-0 text-[11.5px] text-[var(--color-muted)]">Interligne</span>
              <input
                type="range"
                min={1}
                max={2}
                step={0.05}
                value={el.style.lineHeight}
                onChange={(e) => patchStyle({ lineHeight: Number(e.target.value) }, 'lh')}
                className="h-1 flex-1 accent-[var(--color-accent)]"
              />
              <span className="num w-8 text-right text-[11px] text-[var(--color-faint)]">{el.style.lineHeight.toFixed(2)}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Button
                variant="secondary"
                className="h-7 text-[11.5px]"
                onClick={() =>
                  updateElement(el.id, { paragraphs: el.paragraphs.map((p) => ({ ...p, bullet: 'dot' as const })) })
                }
              >
                Puces
              </Button>
              <Button
                variant="secondary"
                className="h-7 text-[11.5px]"
                onClick={() => updateElement(el.id, { paragraphs: el.paragraphs.map((p) => ({ ...p, bullet: 'none' as const })) })}
              >
                Sans puces
              </Button>
            </div>
          </Section>
        </>
      )}

      {el.type === 'image' && <ImageInspector el={el} patch={patch} />}
      {el.type === 'shape' && <ShapeInspector el={el} patch={patch} theme={theme} />}
      {el.type === 'table' && <TableInspector el={el} patch={patch} />}
      {el.type === 'chart' && <ChartInspector el={el} patch={patch} />}
      {el.type === 'timeline' && <TimelineInspector el={el} patch={patch} />}
      {el.type === 'map' && <MapInspector el={el} patch={patch} />}
      {el.type === 'icon' && <IconInspector el={el} patch={patch} />}

      <Section title="Calque">
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="secondary"
            className="h-8 text-[11.5px]"
            onClick={() =>
              updateSlide(slide.id, (s) => {
                const idx = s.elements.findIndex((x) => x.id === el.id)
                if (idx < s.elements.length - 1) {
                  const [item] = s.elements.splice(idx, 1)
                  s.elements.push(item)
                }
              })
            }
          >
            <BringToFront size={13} /> Devant
          </Button>
          <Button
            variant="secondary"
            className="h-8 text-[11.5px]"
            onClick={() =>
              updateSlide(slide.id, (s) => {
                const idx = s.elements.findIndex((x) => x.id === el.id)
                if (idx > 0) {
                  const [item] = s.elements.splice(idx, 1)
                  s.elements.unshift(item)
                }
              })
            }
          >
            <SendToBack size={13} /> Derrière
          </Button>
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          <Button variant="secondary" className="h-8 text-[11.5px]" onClick={() => duplicateElements([el.id])}>
            <Copy size={13} /> Copier
          </Button>
          <Button variant="secondary" className="h-8 text-[11.5px]" onClick={() => patch({ locked: !el.locked })}>
            {el.locked ? <Unlock size={13} /> : <Lock size={13} />} {el.locked ? 'Déverr.' : 'Verrou.'}
          </Button>
          <Button
            variant="secondary"
            className="h-8 text-[11.5px] text-[var(--color-danger)]"
            onClick={() => {
              deleteElements([el.id])
              setSelection([])
            }}
          >
            <Trash2 size={13} /> Suppr.
          </Button>
        </div>
      </Section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sous-inspecteurs                                                    */
/* ------------------------------------------------------------------ */

type Patch = (p: Partial<SlideElement>, coalesce?: string) => void

const ImageInspector = ({ el, patch }: { el: ImageEl; patch: Patch }) => (
  <Section title="Image">
    <div className="grid grid-cols-2 gap-1.5">
      <Select value={el.fit} onChange={(e) => patch({ fit: e.target.value as ImageEl['fit'] })} className="h-8 text-[11.5px]">
        <option value="cover">Remplir</option>
        <option value="contain">Contenir</option>
      </Select>
      <Num label="Arrondi" value={el.radius ?? 0} onChange={(v) => patch({ radius: Math.max(0, v) }, 'radius')} />
    </div>
    <label className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-[7px] border border-dashed border-[var(--color-line-strong)] py-2 text-[11.5px] text-[var(--color-muted)] hover:border-[var(--color-accent)]">
      Remplacer l’image…
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f) return
          const asset = await useApp.getState().addAsset(f, f.name)
          patch({ assetId: asset.id, alt: f.name })
          e.target.value = ''
        }}
      />
    </label>
    <div className="mt-2 space-y-1.5">
      <input value={el.alt ?? ''} onChange={(e) => patch({ alt: e.target.value }, 'alt')} placeholder="Description (accessibilité)" className="input h-8 text-[11.5px]" />
      <input value={el.credit ?? ''} onChange={(e) => patch({ credit: e.target.value }, 'credit')} placeholder="Crédit affiché" className="input h-8 text-[11.5px]" />
    </div>
  </Section>
)

const SHAPES: { id: ShapeEl['shape']; label: string }[] = [
  { id: 'rect', label: 'Rectangle' },
  { id: 'roundRect', label: 'Arrondi' },
  { id: 'ellipse', label: 'Cercle' },
  { id: 'line', label: 'Ligne' },
  { id: 'arrow', label: 'Flèche' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'chevron', label: 'Chevron' },
  { id: 'star', label: 'Étoile' },
  { id: 'bracket', label: 'Crochet' },
]

const ShapeInspector = ({ el, patch, theme }: { el: ShapeEl; patch: Patch; theme: ReturnType<typeof themeById> }) => (
  <Section title="Forme">
    <Select value={el.shape} onChange={(e) => patch({ shape: e.target.value as ShapeEl['shape'] })} className="h-8 text-[11.5px]">
      {SHAPES.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </Select>
    <div className="mt-2 space-y-2">
      <ColorField value={el.fill ?? 'transparent'} onChange={(v) => patch({ fill: v }, 'fill')} label="Remplissage" />
      <ColorField value={el.stroke ?? theme.accent} onChange={(v) => patch({ stroke: v }, 'stroke')} label="Contour" />
      <div className="flex items-center gap-2">
        <span className="w-[72px] text-[11.5px] text-[var(--color-muted)]">Épaisseur</span>
        <input
          type="range"
          min={0}
          max={8}
          step={0.5}
          value={el.strokeWidth ?? 0}
          onChange={(e) => patch({ strokeWidth: Number(e.target.value) }, 'sw')}
          className="h-1 flex-1 accent-[var(--color-accent)]"
        />
        <span className="num w-6 text-right text-[11px]">{el.strokeWidth ?? 0}</span>
      </div>
      {(el.shape === 'roundRect' || el.shape === 'rect') && <Num label="Arrondi" value={el.radius ?? 0} onChange={(v) => patch({ radius: Math.max(0, v) }, 'sr')} />}
    </div>
  </Section>
)

const TableInspector = ({ el, patch }: { el: TableEl; patch: Patch }) => {
  const setCell = (ri: number, ci: number, value: string) => {
    const rows = el.rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? value : c)) : r))
    patch({ rows })
  }
  return (
    <Section title="Tableau">
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          className="h-7 flex-1 text-[11px]"
          onClick={() => patch({ rows: [...el.rows, el.columns.map(() => '')] })}
        >
          + ligne
        </Button>
        <Button
          variant="secondary"
          className="h-7 flex-1 text-[11px]"
          onClick={() => patch({ columns: [...el.columns, { label: 'Colonne' }], rows: el.rows.map((r) => [...r, '']) })}
        >
          + colonne
        </Button>
        <Button
          variant="secondary"
          className="h-7 flex-1 text-[11px]"
          onClick={() => {
            if (el.columns.length <= 2) return
            patch({ columns: el.columns.slice(0, -1), rows: el.rows.map((r) => r.slice(0, -1)) })
          }}
        >
          − colonne
        </Button>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              {el.columns.map((c, ci) => (
                <th key={ci} className="border border-[var(--color-line)] bg-[#f7f6f2] p-0">
                  <input
                    value={c.label}
                    onChange={(e) => patch({ columns: el.columns.map((col, i) => (i === ci ? { ...col, label: e.target.value } : col)) }, 'col')}
                    className="w-full min-w-[64px] bg-transparent px-1.5 py-1 font-semibold outline-none"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {el.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border border-[var(--color-line)] p-0">
                    <input value={cell} onChange={(e) => setCell(ri, ci, e.target.value)} className="w-full min-w-[64px] bg-transparent px-1.5 py-1 outline-none" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <ColorField value={el.headerFill} onChange={(v) => patch({ headerFill: v }, 'hfill')} label="En-tête" />
        <button className="text-[11px] text-[var(--color-danger)] hover:underline" onClick={() => patch({ rows: el.rows.slice(0, -1) })} disabled={el.rows.length <= 1}>
          − ligne
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Num label="Taille" value={el.fontSize} onChange={(v) => patch({ fontSize: Math.max(8, v) }, 'tfs')} />
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
          <input type="checkbox" checked={Boolean(el.zebra)} onChange={(e) => patch({ zebra: e.target.checked })} className="accent-[var(--color-accent)]" /> Lignes alternées
        </label>
      </div>
    </Section>
  )
}

const ChartInspector = ({ el, patch }: { el: ChartEl; patch: Patch }) => {
  const setSeries = (i: number, p: Partial<ChartEl['series'][number]>) => patch({ series: el.series.map((s, j) => (j === i ? { ...s, ...p } : s)) })
  return (
    <Section title="Graphique">
      <Select value={el.chart} onChange={(e) => patch({ chart: e.target.value as ChartEl['chart'] })} className="h-8 text-[11.5px]">
        <option value="bar">Barres verticales</option>
        <option value="hbar">Barres horizontales</option>
        <option value="line">Courbe</option>
        <option value="area">Aire</option>
        <option value="pie">Camembert</option>
        <option value="donut">Anneau</option>
      </Select>
      <div className="mt-2 space-y-1.5">
        <span className="text-[11px] text-[var(--color-muted)]">Catégories (séparées par des virgules)</span>
        <CsvInput value={el.categories.join(', ')} onCommit={(v) => patch({ categories: v })} />
      </div>
      <div className="mt-2 space-y-2">
        {el.series.map((s, i) => (
          <div key={i} className="rounded-[7px] border border-[var(--color-line)] p-2">
            <div className="flex items-center gap-1.5">
              <input value={s.name} onChange={(e) => setSeries(i, { name: e.target.value })} className="input h-7 flex-1 text-[11px]" />
              <button className="text-[var(--color-danger)]" onClick={() => patch({ series: el.series.filter((_, j) => j !== i) })} title="Supprimer la série">
                <Trash2 size={12} />
              </button>
            </div>
            <div className="mt-1.5">
              <CsvInput value={s.values.map((v) => v ?? '').join(', ')} onCommit={(v) => setSeries(i, { values: v.map((x) => Number(x.replace(',', '.')) || 0) })} placeholder="12, 18, 24" />
            </div>
          </div>
        ))}
        <Button variant="secondary" className="h-7 w-full text-[11px]" onClick={() => patch({ series: [...el.series, { name: `Série ${el.series.length + 1}`, values: el.categories.map(() => 0) }] })}>
          + série
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <input value={el.unit ?? ''} onChange={(e) => patch({ unit: e.target.value }, 'unit')} placeholder="Unité" className="input h-7 text-[11px]" />
        <input value={el.source ?? ''} onChange={(e) => patch({ source: e.target.value }, 'src')} placeholder="Source" className="input h-7 text-[11px]" />
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11.5px]">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={el.legend !== false} onChange={(e) => patch({ legend: e.target.checked })} className="accent-[var(--color-accent)]" /> Légende
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={Boolean(el.valueLabels)} onChange={(e) => patch({ valueLabels: e.target.checked })} className="accent-[var(--color-accent)]" /> Valeurs
        </label>
      </div>
    </Section>
  )
}

const TimelineInspector = ({ el, patch }: { el: TimelineEl; patch: Patch }) => {
  const setEvent = (i: number, p: Partial<TimelineEl['events'][number]>) => patch({ events: el.events.map((e, j) => (j === i ? { ...e, ...p } : e)) })
  return (
    <Section title="Frise chronologique">
      <div className="flex items-center gap-1.5">
        <Select value={el.orientation} onChange={(e) => patch({ orientation: e.target.value as TimelineEl['orientation'] })} className="h-8 flex-1 text-[11.5px]">
          <option value="horizontal">Horizontale</option>
          <option value="vertical">Verticale</option>
        </Select>
        <label className="flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
          <input type="checkbox" checked={el.alternating !== false} onChange={(e) => patch({ alternating: e.target.checked })} className="accent-[var(--color-accent)]" /> Alternée
        </label>
      </div>
      <div className="mt-2 space-y-1.5">
        {el.events.map((ev, i) => (
          <div key={i} className="rounded-[7px] border border-[var(--color-line)] p-1.5">
            <div className="flex items-center gap-1">
              <input value={ev.date} onChange={(e) => setEvent(i, { date: e.target.value })} className="input h-7 w-[74px] text-[11px] font-semibold" />
              <input value={ev.label} onChange={(e) => setEvent(i, { label: e.target.value })} className="input h-7 flex-1 text-[11px]" />
              <button className="text-[var(--color-danger)]" onClick={() => patch({ events: el.events.filter((_, j) => j !== i) })}>
                <Trash2 size={12} />
              </button>
            </div>
            <input value={ev.desc ?? ''} onChange={(e) => setEvent(i, { desc: e.target.value })} placeholder="Précision (facultatif)" className="input mt-1 h-6 text-[10.5px]" />
          </div>
        ))}
        <Button variant="secondary" className="h-7 w-full text-[11px]" onClick={() => patch({ events: [...el.events, { date: '18..', label: 'Événement' }] })}>
          + événement
        </Button>
      </div>
    </Section>
  )
}

const MapInspector = ({ el, patch }: { el: MapEl; patch: Patch }) => {
  const setPoint = (i: number, p: Partial<MapEl['points'][number]>) => patch({ points: el.points.map((pt, j) => (j === i ? { ...pt, ...p } : pt)) })
  return (
    <Section title="Carte">
      <Select value={el.projection} onChange={(e) => patch({ projection: e.target.value as MapEl['projection'] })} className="h-8 text-[11.5px]">
        <option value="world">Monde</option>
        <option value="europe">Europe</option>
        <option value="france">France</option>
        <option value="mediterranee">Méditerranée</option>
      </Select>
      <div className="mt-2 space-y-1.5">
        <span className="text-[11px] text-[var(--color-muted)]">Pays mis en avant (noms anglais)</span>
        <CsvInput value={el.highlight.join(', ')} onCommit={(v) => patch({ highlight: v })} placeholder="France, Germany, Italy" />
      </div>
      <div className="mt-2 space-y-1.5">
        <span className="text-[11px] text-[var(--color-muted)]">Points</span>
        {el.points.map((pt, i) => (
          <div key={i} className="flex items-center gap-1">
            <input value={pt.name} onChange={(e) => setPoint(i, { name: e.target.value })} className="input h-7 flex-1 text-[11px]" placeholder="Ville" />
            <input value={pt.lon} onChange={(e) => setPoint(i, { lon: Number(e.target.value) })} className="input h-7 w-[52px] text-[10.5px]" placeholder="lon" />
            <input value={pt.lat} onChange={(e) => setPoint(i, { lat: Number(e.target.value) })} className="input h-7 w-[52px] text-[10.5px]" placeholder="lat" />
            <button className="text-[var(--color-danger)]" onClick={() => patch({ points: el.points.filter((_, j) => j !== i) })}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <Button variant="secondary" className="h-7 w-full text-[11px]" onClick={() => patch({ points: [...el.points, { name: 'Lieu', lon: 2.35, lat: 48.86 }] })}>
          + point
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <input value={el.caption ?? ''} onChange={(e) => patch({ caption: e.target.value }, 'cap')} placeholder="Titre de carte" className="input h-7 text-[11px]" />
        <input value={el.source ?? ''} onChange={(e) => patch({ source: e.target.value }, 'msrc')} placeholder="Source" className="input h-7 text-[11px]" />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <ColorField value={el.highlightFill} onChange={(v) => patch({ highlightFill: v }, 'hfill')} label="Pays" />
        <ColorField value={el.water} onChange={(v) => patch({ water: v }, 'water')} label="Eau" />
      </div>
    </Section>
  )
}

const IconInspector = ({ el, patch }: { el: IconEl; patch: Patch }) => (
  <Section title="Icône">
    <Select value={el.icon} onChange={(e) => patch({ icon: e.target.value })} className="h-8 text-[11.5px]">
      {ICON_NAMES.map(([id, label]) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </Select>
    <div className="mt-2 flex items-center justify-between">
      <ColorField value={el.color} onChange={(v) => patch({ color: v }, 'icolor')} label="Couleur" />
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-[var(--color-muted)]">Trait</span>
        <input
          type="range"
          min={0.8}
          max={3}
          step={0.1}
          value={el.strokeWidth}
          onChange={(e) => patch({ strokeWidth: Number(e.target.value) }, 'isw')}
          className="h-1 w-[70px] accent-[var(--color-accent)]"
        />
      </div>
    </div>
  </Section>
)
