import { useState } from 'react'
import { Search, FileText, MessageSquare, BookOpen } from 'lucide-react'
import { searchApi } from '../services/api'

interface Result {
  type: string
  id: string
  title: string
  snippet: string
  score: number
  metadata: Record<string, any>
}

const typeIcons: Record<string, any> = {
  book: BookOpen,
  chunk: FileText,
  chat: MessageSquare,
  note: FileText,
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await searchApi.search(query.trim())
      setResults(res.data)
    } catch (e) {
      console.error(e)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Search</h1>
      <p className="text-slate-500 mb-8">Search across books, chunks, chats, and notes</p>

      <div className="flex gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            className="input-glass pl-11"
            placeholder="Search everything..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
        </div>
        <button className="btn-primary" onClick={search} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div className="space-y-3">
        {results.map((r, i) => {
          const Icon = typeIcons[r.type] || FileText
          return (
            <div key={i} className="glass-card p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-brand-600" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-medium text-slate-800">{r.title}</h3>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                    {r.type}
                  </span>
                </div>
                <p className="text-sm text-slate-500 line-clamp-2">{r.snippet}</p>
              </div>
            </div>
          )
        })}
        {!loading && results.length === 0 && query && (
          <p className="text-center text-slate-400 py-10">No results found</p>
        )}
      </div>
    </div>
  )
}
