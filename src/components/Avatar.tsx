import type { Member } from '../types'

export function Avatar({ member, size = 'md' }: { member: Pick<Member, 'name' | 'color'>; size?: 'sm' | 'md' | 'lg' }) {
  const initials = member.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return <span className={`avatar avatar--${size}`} style={{ '--avatar-color': member.color } as React.CSSProperties} aria-label={member.name}>{initials}</span>
}
