import type { TaskStatus } from '../types'

export function StatusSelect({ value, onChange, compact = false }: { value: TaskStatus; onChange: (status: TaskStatus) => void; compact?: boolean }) {
  return (
    <select className={`status-select status-select--${value}${compact ? ' is-compact' : ''}`} value={value} onChange={(event) => onChange(event.target.value as TaskStatus)} aria-label="Task status">
      <option value="to_do">To do</option>
      <option value="in_progress">In progress</option>
      <option value="done">Done</option>
    </select>
  )
}
