import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Send, ArrowLeft, BookOpen, Copy, Loader2, Bug, AlertTriangle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { chatApi, pdfApi, ChatResponse } from '../services/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  citations?: ChatResponse['citations']
  confidence?: number
  debug?: ChatResponse['debug']
  model?: string
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [chatId, setChatId] = useState<string | undefined>()
  const [showDebug, setShowDebug] = useState(false)
  const [lastDebug, setLastDebug] = useState<ChatResponse['debug']>()
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null)
  const [indexedCount, setIndexedCount] = useState<number | null>(null)
  const [totalCount, setTotalCount] = useState<number>(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Poll indexing status so the input can't be used to fire a query that's
  // guaranteed to come back empty because the vector index isn't built yet
  // (this is what caused "No relevant context found" on a freshly uploaded,
  // still-indexing book).
  useEffect(() => {
    if (!id) return
    let stop = false
    const poll = async () => {
      try {
        const res = await pdfApi.list(id)
        if (stop) return
        const books = res.data || []
        setTotalCount(books.length)
        setIndexedCount(books.filter((b: any) => b.status === 'indexed').length)
      } catch {
        /* ignore transient errors */
      }
    }
    poll()
    const iv = setInterval(poll, 2000)
    return () => { stop = true; clearInterval(iv) }
  }, [id])

  const notReady = indexedCount === 0 && totalCount > 0
  const noBooks = totalCount === 0

  const send = async () => {
    if (!input.trim() || !id || loading || notReady || noBooks) return
    const userMsg = input.trim()
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: userMsg }])
    setLoading(true)
    try {
      const res = await chatApi.send({
        workspace_id: id,
        message: userMsg,
        chat_id: chatId,
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
        model: res.data.model,
      }])
    } catch (err: any) {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: `Error: ${err?.response?.data?.detail || err.message || 'Request failed'}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="glass border-b border-white/30 dark:border-white/10 px-6 py-3 flex items-center gap-3 shrink-0">
        <button className="btn-ghost p-2" onClick={() => navigate(`/workspace/${id}`)}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <BookOpen className="w-5 h-5 text-brand-600" />
        <h1 className="font-semibold text-slate-800 dark:text-slate-100">Chat with Books</h1>
        <div className="flex-1" />
        <button className={`btn-ghost p-2 ${showDebug ? 'text-brand-600' : ''}`} onClick={() => setShowDebug(!showDebug)}>
          <Bug className="w-4 h-4" />
        </button>
      </div>

      {showDebug && lastDebug && (
        <div className="bg-slate-900 text-slate-200 text-xs p-3 max-h-40 overflow-auto font-mono shrink-0">
          <p className="text-brand-300">Retrieval Debug · {lastDebug.embedding_model} · {JSON.stringify(lastDebug.timings_ms)}</p>
          {lastDebug.chunks?.slice(0, 5).map((c: any, i: number) => (
            <div key={i} className="mt-1 border-t border-slate-700 pt-1">
              <span className="text-green-400">score={c.score}</span> page={c.page} — {c.text?.slice(0, 80)}...
            </div>
          ))}
        </div>
      )}

      {(notReady || noBooks) && (
        <div className="px-4 pt-3 shrink-0">
          <div className="glass-card px-4 py-2 text-sm flex items-center gap-2 text-amber-700 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-900/20">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {noBooks
              ? 'No books in this workspace yet — upload a PDF first.'
              : 'Indexing in progress — the first embedding-model load can take a minute. Chat will unlock once at least one book is indexed.'}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-20 text-slate-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-brand-300" />
            <p className="text-lg">Ask anything about your books</p>
            <p className="text-sm mt-1">Answers include page citations and confidence scores</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
            <div className={`max-w-2xl rounded-2xl px-5 py-3 ${
              msg.role === 'user' ? 'bg-brand-600 text-white' : 'glass-card'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
              {msg.role === 'assistant' && (msg.confidence != null || msg.model) && (
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                  {msg.confidence != null && <span>Confidence: {(msg.confidence * 100).toFixed(0)}%</span>}
                  {msg.model && msg.model !== 'none' && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700">via {msg.model}</span>}
                  {msg.model === 'none' && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      no LLM installed — showing retrieved passages
                    </span>
                  )}
                </p>
              )}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-600/50">
                  <p className="text-xs font-medium text-slate-500 mb-2">Sources · tap to preview</p>
                  <div className="flex flex-wrap gap-2">
                    {msg.citations.map((c, j) => {
                      const key = `${i}-${j}`
                      const open = expandedCitation === key
                      return (
                        <button
                          key={j}
                          onClick={() => setExpandedCitation(open ? null : key)}
                          className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${
                            open
                              ? 'bg-brand-600 text-white border-brand-600'
                              : 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 border-brand-100 dark:border-brand-800 hover:bg-brand-100'
                          }`}
                        >
                          {c.title && <span className="truncate max-w-[80px]">{c.title}</span>}
                          Page {c.page ?? '?'}
                          {c.score != null && <span className={open ? 'text-brand-100' : 'text-brand-400'}>({(c.score * 100).toFixed(0)}%)</span>}
                        </button>
                      )
                    })}
                  </div>
                  {msg.citations.map((c, j) => {
                    const key = `${i}-${j}`
                    if (expandedCitation !== key) return null
                    return (
                      <div key={`preview-${j}`} className="mt-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 animate-slide-up">
                        <p className="font-medium mb-1">{c.title || 'Untitled'} · page {c.page ?? '?'}</p>
                        <p className="italic">"{(c as any).text_preview || 'No preview available'}"</p>
                      </div>
                    )
                  })}
                </div>
              )}
              {msg.role === 'assistant' && (
                <button className="btn-ghost p-1 mt-1" onClick={() => navigator.clipboard.writeText(msg.content)}>
                  <Copy className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="glass-card px-5 py-3 flex items-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Retrieving & generating...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-white/30 dark:border-white/10 glass shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input className="input-glass flex-1" placeholder={notReady || noBooks ? 'Waiting for indexing to finish...' : 'Ask a question about your books...'}
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()} disabled={loading || notReady || noBooks} />
          <button className="btn-primary px-4" onClick={send} disabled={loading || !input.trim() || notReady || noBooks}>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
