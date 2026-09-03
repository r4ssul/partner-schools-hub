import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function Modal({ open, title, description, onClose, children, size = 'md', className = '', busy = false }: { open: boolean; title: string; description?: string; onClose: () => void; children: ReactNode; size?: 'sm' | 'md' | 'lg'; className?: string; busy?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const closeCallback = useRef(onClose)
  const busyRef = useRef(busy)
  useEffect(() => { closeCallback.current = onClose; busyRef.current = busy }, [onClose, busy])
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const focusableSelector = '[autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]'
    const firstControl = dialog?.querySelector<HTMLElement>('[autofocus]')
      ?? dialog?.querySelector<HTMLElement>('input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled])')
      ?? closeRef.current
    firstControl?.focus()
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!busyRef.current) closeCallback.current() }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)].filter((element) => element.offsetParent !== null)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    const previousOverflow = document.body.style.overflow
    const root = document.getElementById('root')
    const previousInert = root?.inert ?? false
    if (root) root.inert = true
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = previousOverflow
      if (root) root.inert = previousInert
      if (previouslyFocused?.isConnected && previouslyFocused !== document.body && previouslyFocused !== document.documentElement) previouslyFocused.focus()
      else document.querySelector<HTMLElement>('[data-global-add-trigger]')?.focus()
    }
  }, [open])
  if (!open) return null
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <div ref={dialogRef} className={`modal modal--${size} ${className}`} role="dialog" aria-modal="true" aria-busy={busy} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
        <header className="modal__header">
          <div><h2 id={titleId}>{title}</h2>{description ? <p id={descriptionId}>{description}</p> : null}</div>
          <button ref={closeRef} className="icon-button" onClick={onClose} disabled={busy} aria-label="Close dialog"><X size={20} /></button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>, document.body
  )
}
