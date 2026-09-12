import { useEffect, useState } from 'react'
import { Puzzle, RefreshCw, Loader2 } from 'lucide-react'
import { pluginsApi } from '../services/api'

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await pluginsApi.list()
      setPlugins(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Plugin Manager</h1>
          <p className="text-slate-500 mt-1">Install, enable, and configure AI components without modifying core code</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-2" onClick={() => pluginsApi.discover().then(load)}>
            <RefreshCw className="w-4 h-4" /> Discover
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
      ) : plugins.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Puzzle className="w-12 h-12 mx-auto text-brand-300 mb-3" />
          <p className="text-slate-500 mb-2">No plugins found</p>
          <p className="text-sm text-slate-400">Place plugins under Plugins/ with an __init__.py that exposes register(registry)</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plugins.map((p) => (
            <div key={p.name} className="glass-card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
                <Puzzle className="w-5 h-5 text-brand-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">{p.name}</h3>
                <p className="text-sm text-slate-500">{p.description || 'No description'} · v{p.version}</p>
                {p.provides?.length > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">Provides: {p.provides.join(', ')}</p>
                )}
              </div>
              <button className="btn-secondary text-sm" onClick={() => pluginsApi.reload(p.name)}>
                Reload
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
