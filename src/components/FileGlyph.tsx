import { File, FileImage, FileSpreadsheet, FileText, Presentation } from 'lucide-react'

export function FileGlyph({ mimeType, size = 24 }: { mimeType: string; size?: number }) {
  const props = { size, strokeWidth: 1.8, 'aria-hidden': true as const }
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return <span className="file-glyph file-glyph--green"><FileSpreadsheet {...props} /></span>
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return <span className="file-glyph file-glyph--orange"><Presentation {...props} /></span>
  if (mimeType.startsWith('image/')) return <span className="file-glyph file-glyph--purple"><FileImage {...props} /></span>
  if (mimeType === 'application/pdf') return <span className="file-glyph file-glyph--red"><FileText {...props} /></span>
  if (mimeType.includes('word')) return <span className="file-glyph file-glyph--blue"><FileText {...props} /></span>
  return <span className="file-glyph"><File {...props} /></span>
}
