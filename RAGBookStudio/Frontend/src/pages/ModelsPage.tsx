import { useEffect, useState } from 'react'
import { Boxes, RefreshCw, Check, X, Cpu } from 'lucide-react'
import { modelsApi, ModelInfo } from '../services/api'

export default function ModelsPage() {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  const load = async () => {
    setLoading(true)
    try {
      const res = await modelsApi.list()
      setModels(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const toggle = async (m: ModelInfo) => {
    if (m.enabled) {
      await modelsApi.disable(m.type, m.name)
    } else {
      await modelsApi.enable(m.type, m.name)
    }
    load()
  }

  const discover = async () => {
    await modelsApi.discover()
    load()
  }

  const types = ['all', 'embedding', 'llm', 'ocr', 'reranker', 'vision', 'speech']
  const filtered = filter === 'all' ? models : models.filter((m) => m.type === filter)

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Model Manager</h1>
          <p className="text-slate-500 mt-1">Discover, enable, and switch AI models</p>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={discover}>
          <RefreshCw className="w-4 h-4" /> Rediscover
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {types.map((t) => (
          <button
            key={t}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === t
                ? 'bg-brand-600 text-white'
                : 'bg-white/60 text-slate-600 hover:bg-white/80'
            }`}
            onClick={() => setFilter(t)}
          >
            {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading models...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Boxes className="w-12 h-12 mx-auto text-brand-300 mb-3" />
          <p className="text-slate-500 mb-2">No models found</p>
          <p className="text-sm text-slate-400">
            Place models under Models/Embeddings, Models/LLMs, etc. with a metadata.json
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <div key={`${m.type}:${m.name}`} className="glass-card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center shrink-0">
                <Boxes className="w-5 h-5 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-slate-800">{m.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {m.type}
                  </span>
                  {m.enabled && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      enabled
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 truncate">
                  {m.provider} · v{m.version}
                  {m.dimension ? ` · dim ${m.dimension}` : ''}
                  {m.parameters ? ` · ${m.parameters}` : ''}
                </p>
                {m.description && (
                  <p className="text-xs text-slate-400 mt-0.5">{m.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Cpu className="w-3.5 h-3.5" />
                {m.device_support?.join(', ') || 'cpu'}
              </div>
              <button
                className={`p-2 rounded-lg transition-all ${
                  m.enabled
                    ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600'
                    : 'bg-slate-100 text-slate-500 hover:bg-brand-100 hover:text-brand-700'
                }`}
                onClick={() => toggle(m)}
                title={m.enabled ? 'Disable' : 'Enable'}
              >
                {m.enabled ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
