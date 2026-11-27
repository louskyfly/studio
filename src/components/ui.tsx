import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Loader2, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { useApp } from '../lib/store'

/* ------------------------------------------------------------------ */
/* Boutons                                                             */
/* ------------------------------------------------------------------ */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export const Button = ({
  variant = 'secondary',
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) => (
  <button className={cn('btn', `btn-${variant}`, className)} {...props}>
    {children}
  </button>
)

export const IconButton = ({
  label,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) => (
  <button className={cn('icon-btn', className)} aria-label={label} title={label} {...props}>
    {children}
  </button>
)

/* ------------------------------------------------------------------ */
/* Champs                                                              */
/* ------------------------------------------------------------------ */

export const Field = ({
  label,
  hint,
  children,
  className,
}: {
  label?: string
  hint?: string
  children: React.ReactNode
  className?: string
}) => (
  <div className={cn('field', className)}>
    {label && <span className="label">{label}</span>}
    {children}
    {hint && <span className="mt-1.5 text-[11.5px] leading-snug text-[var(--color-faint)]">{hint}</span>}
  </div>
)

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn('input', className)} {...props} />,
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn('textarea', className)} {...props} />,
)
Textarea.displayName = 'Textarea'

export const Select = ({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={cn('select', className)} {...props}>
    {children}
  </select>
)

export const Segmented = <T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  className?: string
}) => (
  <div className={cn('segmented', className)} role="tablist">
    {options.map((o) => (
      <button key={o.value} type="button" role="tab" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
        {o.label}
      </button>
    ))}
  </div>
)

export const Switch = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) => (
  <label className="flex cursor-pointer select-none items-center gap-2.5 text-[13px] text-[var(--color-ink-soft)]">
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[22px] w-[38px] rounded-full transition-colors duration-200',
        checked ? 'bg-[var(--color-accent)]' : 'bg-[#d5d1c8]',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
        )}
      />
    </button>
    {label}
  </label>
)

export const Badge = ({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'accent' | 'gold' | 'success' | 'danger'
  className?: string
}) => (
  <span
    className={cn(
      'chip',
      tone === 'accent' && 'chip-accent',
      tone === 'gold' && 'chip-gold',
      tone === 'success' && 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
      tone === 'danger' && 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
      className,
    )}
  >
    {children}
  </span>
)

export const Spinner = ({ size = 16, className }: { size?: number; className?: string }) => (
  <Loader2 size={size} className={cn('animate-spin', className)} />
)

export const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded-[5px] border border-[var(--color-line-strong)] bg-white px-1.5 py-0.5 font-sans text-[10.5px] font-medium text-[var(--color-muted)]">
    {children}
  </kbd>
)

/* ------------------------------------------------------------------ */
/* Menus                                                               */
/* ------------------------------------------------------------------ */

export const Menu = ({
  trigger,
  children,
  align = 'end',
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode
  children: (close: () => void) => React.ReactNode
  align?: 'start' | 'end'
  className?: string
}) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div className={cn('menu absolute z-50 top-[calc(100%+6px)]', align === 'end' ? 'right-0' : 'left-0', className)}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export const MenuItem = ({
  children,
  onClick,
  danger,
  icon,
  disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  danger?: boolean
  icon?: React.ReactNode
  disabled?: boolean
}) => (
  <button type="button" className={cn('menu-item', danger && 'danger')} onClick={onClick} disabled={disabled}>
    {icon && <span className="opacity-70">{icon}</span>}
    {children}
  </button>
)

/* ------------------------------------------------------------------ */
/* Modale                                                              */
/* ------------------------------------------------------------------ */

export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 520,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: React.ReactNode
  footer?: React.ReactNode
  width?: number
}) => {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.activeElement as HTMLElement | null
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-[#14161a]/25 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        className="relative w-full overflow-hidden rounded-t-[18px] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] animate-sheet sm:rounded-[16px]"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[15px] font-semibold tracking-[-0.01em]">
              {title}
            </h2>
            {description && <p className="mt-1 text-[12.5px] leading-snug text-[var(--color-muted)]">{description}</p>}
          </div>
          <IconButton label="Fermer" onClick={onClose} className="-mr-1 -mt-1">
            <X size={16} />
          </IconButton>
        </div>
        {children && <div className="px-5 pb-4">{children}</div>}
        {footer && <div className="flex items-center justify-end gap-2 border-t border-[var(--color-line)] bg-[#fbfaf7] px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = 'Supprimer',
  danger = true,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    width={440}
    footer={
      <>
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </Button>
      </>
    }
  >
    <p className="text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">{message}</p>
  </Modal>
)

/* ------------------------------------------------------------------ */
/* États vides, toasts                                                 */
/* ------------------------------------------------------------------ */

export const EmptyState = ({
  icon,
  title,
  message,
  action,
  compact,
}: {
  icon?: React.ReactNode
  title: string
  message?: string
  action?: React.ReactNode
  compact?: boolean
}) => (
  <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-10' : 'py-20')}>
    {icon && <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-full bg-[#efece5] text-[var(--color-muted)]">{icon}</div>}
    <h3 className="serif text-[17px] text-[var(--color-ink)]">{title}</h3>
    {message && <p className="mt-1.5 max-w-[360px] text-[13px] leading-relaxed text-[var(--color-muted)]">{message}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
)

export const ToastHost = () => {
  const toasts = useApp((s) => s.toasts)
  const dismiss = useApp((s) => s.dismissToast)
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[200] flex flex-col items-center gap-2 px-4 pb-[var(--safe-b)]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex w-full max-w-[440px] items-center gap-2.5 rounded-[11px] border px-3.5 py-2.5 text-[13px] shadow-[var(--shadow-md)] animate-fade-up',
            t.tone === 'error'
              ? 'border-[#e5c9c3] bg-[#fdf4f2] text-[#8a3226]'
              : t.tone === 'success'
                ? 'border-[#cfe2d6] bg-[#f4faf6] text-[#2a5f45]'
                : 'border-[var(--color-line-strong)] bg-white text-[var(--color-ink-soft)]',
          )}
        >
          {t.tone === 'success' ? <Check size={15} className="shrink-0" /> : null}
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button className="font-semibold underline underline-offset-2" onClick={t.action.run}>
              {t.action.label}
            </button>
          )}
          <button className="opacity-50 hover:opacity-100" onClick={() => dismiss(t.id)} aria-label="Fermer">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------ */
/* Barre de progression                                                */
/* ------------------------------------------------------------------ */

export const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-[#e6e2d9]', className)}>
    <div className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-500 ease-out" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
)

export const Tooltip = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <span className="group/tt relative inline-flex">
    {children}
    <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-[#23262b] px-2 py-1 text-[11px] text-white opacity-0 transition-opacity duration-150 group-hover/tt:opacity-100">
      {label}
    </span>
  </span>
)
