import { FileText, StickyNote } from 'lucide-react'

// Segmented control: print the document with its own branded header, or omit it
// so it sits neatly below a pre-printed letter-pad letterhead.
export function HeaderToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="no-print inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
      <button
        onClick={() => onChange(true)}
        title="Full page with company header"
        className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition ${value ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
      >
        <FileText className="h-4 w-4" /> With header
      </button>
      <button
        onClick={() => onChange(false)}
        title="Leave space at top for your pre-printed letter-pad"
        className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition ${!value ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
      >
        <StickyNote className="h-4 w-4" /> Letter-pad
      </button>
    </div>
  )
}
