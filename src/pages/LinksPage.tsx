import { ExternalLink, Link2, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'
import type { EntityKind } from '../types'

interface OutletActions { openCreate: (kind: EntityKind) => void }

export default function LinksPage() {
  const { data, archiveItem } = useWorkspace()
  const { openCreate } = useOutletContext<OutletActions>()
  const [query, setQuery] = useState('')
  const links = useMemo(() => data.links.filter((link) => !link.deletedAt && `${link.title} ${link.description} ${link.category}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.category.localeCompare(b.category)), [data.links, query])
  const categories = [...new Set(links.map((link) => link.category))]
  return (
    <div className="page feature-page">
      <div className="page-heading"><div><h1>Quick links</h1><p>A curated directory of the resources your team uses most.</p></div><button className="button button--primary" onClick={() => openCreate('link')}><Plus size={18} /> Add link</button></div>
      <div className="links-toolbar"><label className="search-field search-field--wide"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search links and categories" aria-label="Search quick links" /></label></div>
      <div className="link-category-grid">{categories.length ? categories.map((category) => <section className="content-surface link-category" key={category}><header><h2>{category}</h2><span>{links.filter((link) => link.category === category).length} links</span></header><div>{links.filter((link) => link.category === category).map((link) => <article className="link-card" key={link.id}><span className="link-card__icon"><Link2 size={20} /></span><div><a href={link.url} target="_blank" rel="noreferrer">{link.title}<ExternalLink size={14} /></a><p>{link.description}</p><small>{new URL(link.url).hostname}</small></div><button className="icon-button" onClick={() => void archiveItem('link', link.id)} aria-label={`Move ${link.title} to trash`}><Trash2 size={17} /></button></article>)}</div></section>) : <section className="content-surface empty-state empty-state--page"><Link2 size={36} /><h2>No quick links yet</h2><p>Add the first trusted resource for the team.</p><button className="button button--primary" onClick={() => openCreate('link')}><Plus size={18} /> Add link</button></section>}</div>
    </div>
  )
}
