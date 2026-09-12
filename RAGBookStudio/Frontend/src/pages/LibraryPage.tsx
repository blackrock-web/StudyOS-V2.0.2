import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, BookOpen, Search, FolderOpen, Loader2, FileText, Layers, Tag,
} from 'lucide-react'
import { workspaceApi, pdfApi, Workspace, BookMeta } from '../services/api'

export default function LibraryPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWs, setSelectedWs] = useState<string>('')
  const [books, setBooks] = useState<BookMeta[]>([])
  const [filter, setFilter] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    workspaceApi.list().then((r) => {
      setWorkspaces(r.data)
      if (r.data.length && !selectedWs) setSelectedWs(r.data[0].id)
    })
  }, [])

  const loadBooks = useCallback(async () => {
    if (!selectedWs) return
    try {
      const res = await pdfApi.list(selectedWs)
      setBooks(res.data)
    } catch {
      // fallback to workspace books list
      const ws = await workspaceApi.get(selectedWs)
      setBooks((ws.data.books || []).map((b: any) => ({
        ...b, status: b.status || 'parsed',
      })))
    }
  }, [selectedWs])

  useEffect(() => { loadBooks() }, [loadBooks])

  const handleFiles = async (files: FileList | File[]) => {
    if (!selectedWs) return
    setUploading(true)
    try {
      const arr = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.pdf'))
      if (arr.length === 1) {
        await pdfApi.upload(selectedWs, arr[0])
      } else if (arr.length > 1) {
        await pdfApi.uploadBatch(selectedWs, arr)
      }
      await loadBooks()
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
  }

  const filtered = books.filter((b) => {
    const q = filter.toLowerCase()
    return !q || b.title?.toLowerCase().includes(q) || b.original_name?.toLowerCase().includes(q) ||
      b.tags?.some((t) => t.toLowerCase().includes(q))
  })

  const statusColor = (s: string) => {
    if (s === 'indexed') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    if (s === 'indexing') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    if (s === 'error') return 'bg-red-100 text-red-700'
    return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
  }

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">PDF Library</h1>
          <p className="text-slate-500 mt-1">Upload, organize, and index your study materials</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="input-glass w-auto"
            value={selectedWs}
            onChange={(e) => setSelectedWs(e.target.value)}
          >
            <option value="">Select workspace</option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <button className="btn-primary flex items-center gap-2" disabled={!selectedWs || uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload
          </button>
          <input ref={fileRef} type="file" accept=".pdf" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`glass-card p-8 mb-6 border-2 border-dashed text-center transition-all ${
          dragOver ? 'border-brand-400 bg-brand-50/50 dark:bg-brand-900/20' : 'border-transparent'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <Upload className="w-10 h-10 mx-auto text-brand-400 mb-2" />
        <p className="text-slate-600 dark:text-slate-300">Drag & drop PDF files here, or click Upload</p>
        <p className="text-xs text-slate-400 mt-1">Supports batch upload · Duplicate detection · Auto-indexing</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input className="input-glass pl-11" placeholder="Filter by title, tags..." value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {!selectedWs ? (
        <div className="text-center py-16 text-slate-400">Select a workspace to view books</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-brand-300 mb-3" />
          <p className="text-slate-500">No books yet — upload your first PDF</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((book) => (
            <div key={book.file_id} className="glass-card p-4 flex items-center gap-4 group">
              <div className="w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/workspace/${selectedWs}/reader/${book.file_id}`)}>
                <h3 className="font-medium text-slate-800 dark:text-slate-100 truncate">{book.title || book.original_name}</h3>
                <p className="text-sm text-slate-500">
                  {book.page_count} pages
                  {book.chunk_count ? ` · ${book.chunk_count} chunks` : ''}
                  {book.is_scanned ? ' · scanned' : ''}
                </p>
                {book.tags && book.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {book.tags.map((t) => (
                      <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300 flex items-center gap-0.5">
                        <Tag className="w-3 h-3" />{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(book.status)}`}>
                {book.status}
              </span>
              <button
                className="btn-ghost text-sm opacity-0 group-hover:opacity-100"
                onClick={() => pdfApi.index({ workspace_id: selectedWs, file_id: book.file_id }).then(loadBooks)}
              >
                <Layers className="w-4 h-4" />
              </button>
              <button
                className="btn-secondary text-sm"
                onClick={() => navigate(`/workspace/${selectedWs}/reader/${book.file_id}`)}
              >
                Open
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
