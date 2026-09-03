export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="Partner Schools Hub">
      <img className="brand__mark" src="/assets/partner-schools-hub-mark.png" alt="" />
      {compact ? null : <span>Partner Schools Hub</span>}
    </div>
  )
}
