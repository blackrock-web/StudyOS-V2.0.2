import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Send, Loader2,
  Copy, BookOpen, PanelRightClose, PanelRightOpen, Bug,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { pdfApi, chatApi, BookMeta, ChatResponse } from '../services/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  citations?: ChatResponse['citations']
  confidence?: number
  debug?: ChatResponse['debug']
}

export default function ReaderPage() {
  const { id, fileId } = useParams<{ id: string; fileId: string }>()
  const navigate = useNavigate()
  const [book, setBook] = useState<BookMeta | null>(null)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(120)
  const [showChat, setShowChat] = useState(true)
  const [showDebug, setShowDebug] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [chatId, setChatId] = useState<string>()
  const [highlightPage, setHighlightPage] = useState<number | null>(null)
  const [lastDebug, setLastDebug] = useState<ChatResponse['debug']>()
  const bottomRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!id || !fileId) return
    pdfApi.getMeta(id, fileId).then((r) => setBook(r.data)).catch(() => navigate(`/workspace/${id}`))
  }, [id, fileId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const totalPages = book?.page_count || 1

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return
    setPage(p)
    setHighlightPage(null)
  }

  const jumpToCitation = (p?: number) => {
    if (p) {
      setPage(p)
      setHighlightPage(p)
      setTimeout(() => setHighlightPage(null), 3000)
    }
  }

  const send = async () => {
    if (!input.trim() || !id || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: userMsg }])
    setLoading(true)
    try {
      const res = await chatApi.send({
        workspace_id: id,
        message: userMsg,
        chat_id: chatId,
        file_ids: fileId ? [fileId] : undefined,
        top_k: 5,
        include_debug: true,
      })
      setChatId(res.data.chat_id)
      setLastDebug(res.data.debug)
      setMessages((m) => [...m, {
        role: 'assistant',
        content: res.data.answer,
        citations: res.data.citations,
        confidence: res.data.confidence,
        debug: res.data.debug,
      }])
      // Auto-jump to top citation
      if (res.data.citations?.[0]?.page) {
        jumpToCitation(res.data.citations[0].page)
      }
    } catch (err: any) {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: `Error: ${err?.response?.data?.detail || err.message}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  const imgUrl = id && fileId ? pdfApi.pageImageUrl(id, fileId, page, zoom) : ''

  return (
    <div className="flex h-full">
      {/* PDF Pane */}
      <div className={`flex flex-col ${showChat ? 'w-1/2' : 'w-full'} border-r border-white/20 dark:border-white/10 transition-all`}>
        {/* Toolbar */}
        <div className="glass border-b border-white/30 dark:border-white/10 px-4 py-2 flex items-center gap-2 shrink-0">
          <button className="btn-ghost p-2" onClick={() => navigate(`/workspace/${id}`)}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <BookOpen className="w-4 h-4 text-brand-600" />
          <span className="font-medium text-sm truncate max-w-[200px]">{book?.title || '...'}</span>
          <div className="flex-1" />
          <button className="btn-ghost p-1.5" onClick={() => setZoom((z) => Math.max(60, z - 20))}><ZoomOut className="w-4 h-4" /></button>
          <span className="text-xs text-slate-500 w-12 text-center">{zoom}%</span>
          <button className="btn-ghost p-1.5" onClick={() => setZoom((z) => Math.min(200, z + 20))}><ZoomIn className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1" />
          <button className="btn-ghost p-1.5" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm tabular-nums">
            <input
              type="number"
              className="w-12 text-center bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-none"
              value={page}
              min={1}
              max={totalPages}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
            />
            / {totalPages}
          </span>
          <button className="btn-ghost p-1.5" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button className="btn-ghost p-1.5 ml-2" onClick={() => setShowChat(!showChat)} title="Toggle chat">
            {showChat ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
        </div>

        {/* Page image */}
        <div className={`flex-1 overflow-auto flex justify-center p-4 bg-slate-100/50 dark:bg-slate-900/50 ${highlightPage === page ? 'citation-highlight' : ''}`}>
          {book && (
            <img
              ref={imgRef}
              key={`${fileId}-${page}-${zoom}`}
              src={imgUrl}
              alt={`Page ${page}`}
              className="shadow-lg rounded max-w-full h-auto"
              style={{ maxHeight: '100%' }}
            />
          )}
        </div>

        {/* TOC sidebar mini */}
        {book?.toc && book.toc.length > 0 && (
          <div className="border-t border-white/20 dark:border-white/10 max-h-32 overflow-auto p-2 text-xs">
            {book.toc.slice(0, 20).map((t, i) => (
              <button
                key={i}
                className="block w-full text-left px-2 py-1 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded truncate"
                style={{ paddingLeft: `${t.level * 8 + 8}px` }}
                onClick={() => goToPage(t.page)}
              >
                {t.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat Pane */}
      {showChat && (
        <div className="w-1/2 flex flex-col">
          <div className="glass border-b border-white/30 dark:border-white/10 px-4 py-2 flex items-center gap-2 shrink-0">
            <span className="font-medium text-sm">RAG Chat</span>
            <div className="flex-1" />
            <button
              className={`btn-ghost p-1.5 ${showDebug ? 'text-brand-600' : ''}`}
              onClick={() => setShowDebug(!showDebug)}
              title="Retrieval debug"
            >
              <Bug className="w-4 h-4" />
            </button>
          </div>

          {/* Debug panel */}
          {showDebug && lastDebug && (
            <div className="bg-slate-900 text-slate-200 text-xs p-3 max-h-48 overflow-auto font-mono shrink-0">
              <p className="text-brand-300 mb-1">Retrieval Debug</p>
              <p>Embed: {lastDebug.embedding_model} (dim {lastDebug.embedding_dim})</p>
              <p>Timings: {JSON.stringify(lastDebug.timings_ms)}</p>
              <p className="mt-1 text-slate-400">Chunks ({lastDebug.chunks?.length}):</p>
              {lastDebug.chunks?.map((c: any, i: number) => (
                <div key={i} className="mt-1 border-t border-slate-700 pt-1">
                  <span className="text-green-400">score={c.score}</span> page={c.page}{' '}
                  <button className="text-brand-300 underline" onClick={() => jumpToCitation(c.page)}>jump</button>
                  <p className="text-slate-400 truncate">{c.text?.slice(0, 100)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">
                Ask questions about this book. Citations will jump to the source page.
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === 'user' ? 'bg-brand-600 text-white' : 'glass-card'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {msg.confidence != null && msg.role === 'assistant' && (
                    <p className="text-xs text-slate-400 mt-1">Confidence: {(msg.confidence * 100).toFixed(0)}%</p>
                  )}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-600/50 flex flex-wrap gap-1.5">
                      {msg.citations.map((c, j) => (
                        <button
                          key={j}
                          className="text-xs px-2 py-0.5 rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 border border-brand-100 dark:border-brand-800 hover:bg-brand-100"
                          onClick={() => jumpToCitation(c.page)}
                        >
                          p.{c.page ?? '?'} {c.score != null && `(${(c.score * 100).toFixed(0)}%)`}
                        </button>
                      ))}
                    </div>
                  )}
                  {msg.role === 'assistant' && (
                    <button className="btn-ghost p-1 mt-1" onClick={() => navigator.clipboard.writeText(msg.content)}>
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="glass-card px-4 py-2 flex items-center gap-2 text-slate-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Retrieving & generating...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-white/30 dark:border-white/10 glass shrink-0">
            <div className="flex gap-2">
              <input
                className="input-glass flex-1 text-sm"
                placeholder="Ask about this book..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                disabled={loading}
              />
              <button className="btn-primary px-3" onClick={send} disabled={loading || !input.trim()}>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
