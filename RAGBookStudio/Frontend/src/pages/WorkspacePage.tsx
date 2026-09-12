import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Upload, BookOpen, MessageSquare, FileText, Loader2, ArrowLeft, Layers, Eye, FileArchive,
} from 'lucide-react'
import { workspaceApi, pdfApi, tasksApi, Workspace, TaskInfo } from '../services/api'

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [ws, setWs] = useState<Workspace | null>(null)
  const [books, setBooks] = useState<any[]>([])
  const [tasks, setTasks] = useState<TaskInfo[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Accepts any mix of PDFs and/or a single .zip bundle, and auto-routes to
  // the right endpoint: one PDF -> /upload, many PDFs -> /upload/batch,
  // a .zip of PDFs -> /upload/zip (auto-extracted & processed server-side).
  const processFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (!files.length || !id) return
    setUploading(true)
    try {
      const zips = files.filter((f) => f.name.toLowerCase().endsWith('.zip'))
      const pdfs = files.filter((f) => f.name.toLowerCase().endsWith('.pdf'))

      for (const zip of zips) {
        setUploadNote(`Unpacking and processing ${zip.name}...`)
        const res: any = await pdfApi.uploadZip(id, zip)
        setUploadNote(`${zip.name}: ${res.data.processed}/${res.data.total} PDFs queued for indexing`)
      }
      if (pdfs.length === 1 && zips.length === 0) {
        setUploadNote(`Processing ${pdfs[0].name}...`)
        await pdfApi.upload(id, pdfs[0])
      } else if (pdfs.length > 1) {
        setUploadNote(`Processing ${pdfs.length} PDFs...`)
        await pdfApi.uploadBatch(id, pdfs)
      }
      await load()
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      setTimeout(() => setUploadNote(''), 4000)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const load = async () => {
    if (!id) return
    try {
      const [wsRes, booksRes, tasksRes] = await Promise.all([
        workspaceApi.get(id),
        pdfApi.list(id).catch(() => ({ data: [] })),
        tasksApi.list(id).catch(() => ({ data: [] })),
      ])
      setWs(wsRes.data)
      setBooks(booksRes.data.length ? booksRes.data : (wsRes.data.books || []))
      setTasks(tasksRes.data.filter((t: TaskInfo) => ['running', 'pending', 'paused'].includes(t.status)))
    } catch {
      navigate('/')
    }
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    if (!tasks.length) return
    const iv = setInterval(load, 2500)
    return () => clearInterval(iv)
  }, [tasks.length])

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files)
  }

  if (!ws) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
      </div>
    )
  }

  const statusColor = (s: string) => {
    if (s === 'indexed') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    if (s === 'indexing') return 'bg-amber-100 text-amber-700'
    if (s === 'error') return 'bg-red-100 text-red-700'
    return 'bg-slate-100 text-slate-600 dark:bg-slate-700'
  }

  return (
    <div
      className={`p-8 max-w-5xl mx-auto animate-fade-in relative ${isDragging ? 'ring-2 ring-brand-500 ring-offset-2 rounded-2xl' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <button className="btn-ghost flex items-center gap-2 mb-6 -ml-2" onClick={() => navigate('/')}>
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{ws.name}</h1>
          <p className="text-slate-500 mt-1">{ws.description || 'No description'}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/workspace/${id}/chat`} className="btn-primary flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Chat
          </Link>
          <button className="btn-secondary flex items-center gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload PDFs or .zip
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.zip" multiple className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {uploadNote && (
        <div className="glass-card px-4 py-2 mb-4 text-sm text-brand-700 dark:text-brand-300 flex items-center gap-2">
          {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {uploadNote}
        </div>
      )}

      {isDragging && (
        <div className="fixed inset-0 z-50 bg-brand-600/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="glass-card px-10 py-8 text-center border-2 border-dashed border-brand-500">
            <FileArchive className="w-10 h-10 mx-auto text-brand-600 mb-2" />
            <p className="text-lg font-semibold text-brand-700 dark:text-brand-300">Drop PDFs or a .zip to auto-process</p>
          </div>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="glass-card p-4 mb-6">
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Indexing Progress</h3>
          {tasks.map((t) => (
            <div key={t.id} className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span>{t.name}</span>
                <span>{t.progress.percent}%</span>
              </div>
              <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${t.progress.percent}%` }} />
              </div>
              <p className="text-xs text-slate-400">{t.progress.message}</p>
            </div>
          ))}
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-brand-600" />
          Books ({books.length})
        </h2>

        {!books.length ? (
          <div className="glass-card p-12 text-center border-2 border-dashed border-slate-300 dark:border-slate-600">
            <FileText className="w-12 h-12 mx-auto text-brand-300 mb-3" />
            <p className="text-slate-500 mb-1">No books uploaded yet</p>
            <p className="text-sm text-slate-400 mb-4">Drag &amp; drop PDFs, or a single .zip of many PDFs, anywhere on this page</p>
            <button className="btn-primary" onClick={() => fileRef.current?.click()}>Upload PDFs or .zip</button>
          </div>
        ) : (
          <div className="space-y-3">
            {books.map((book: any) => (
              <div key={book.file_id} className="glass-card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-800 dark:text-slate-100 truncate">{book.title || book.original_name}</h3>
                  <p className="text-sm text-slate-500">
                    {book.page_count} pages
                    {book.chunk_count ? ` · ${book.chunk_count} chunks` : ''}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(book.status || 'parsed')}`}>
                  {book.status || 'parsed'}
                </span>
                <button className="btn-ghost text-sm" title="Re-index"
                  onClick={() => pdfApi.index({ workspace_id: id!, file_id: book.file_id }).then(load)}>
                  <Layers className="w-4 h-4" />
                </button>
                <button className="btn-secondary text-sm flex items-center gap-1"
                  onClick={() => navigate(`/workspace/${id}/reader/${book.file_id}`)}>
                  <Eye className="w-4 h-4" /> Open
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
