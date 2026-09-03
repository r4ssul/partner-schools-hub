import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function Panel({ title, icon: Icon, action, children, className = '' }: { title: string; icon: LucideIcon; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel__header">
        <div className="panel__title"><Icon size={21} strokeWidth={1.8} aria-hidden="true" /><h2>{title}</h2></div>
        {action ? <div className="panel__action">{action}</div> : null}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  )
}
