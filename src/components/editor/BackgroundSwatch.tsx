import type { SlideBackground } from '../../lib/model'
import type { Theme } from '../../lib/themes'

/** Vignette de fond, utilisée dans les panneaux Propriétés et Design. */
export const BackgroundSwatch = ({ bg, theme, selected, onClick, title }: { bg: SlideBackground; theme: Theme; selected?: boolean; onClick: () => void; title?: string }) => {
  const style: React.CSSProperties =
    bg.type === 'solid'
      ? { background: bg.color }
      : bg.type === 'gradient'
        ? { background: `linear-gradient(135deg, ${bg.from}, ${bg.to})` }
        : bg.type === 'pattern'
          ? { backgroundColor: bg.base }
          : { background: theme.bg }

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`relative aspect-[4/3] overflow-hidden rounded-[6px] border transition ${selected ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]' : 'border-[var(--color-line-strong)] hover:border-[var(--color-accent)]'}`}
      style={style}
    >
      {bg.type === 'pattern' && (
        <span
          className="absolute inset-0"
          style={{
            backgroundImage:
              bg.variant === 'dots'
                ? `radial-gradient(${bg.color} 1px, transparent 1px)`
                : bg.variant === 'grid'
                  ? `linear-gradient(${bg.color} 1px, transparent 1px), linear-gradient(90deg, ${bg.color} 1px, transparent 1px)`
                  : `repeating-linear-gradient(135deg, ${bg.color} 0 1px, transparent 1px 6px)`,
            backgroundSize: bg.variant === 'dots' ? '6px 6px' : '8px 8px',
          }}
        />
      )}
      <span className="absolute left-1.5 top-1.5 h-[2px] w-4 rounded-full" style={{ background: theme.accent }} />
      <span className="absolute left-1.5 top-[9px] h-[1.5px] w-6 rounded-full opacity-35" style={{ background: theme.ink }} />
      <span className="absolute left-1.5 top-[14px] h-[1.5px] w-5 rounded-full opacity-20" style={{ background: theme.ink }} />
    </button>
  )
}
