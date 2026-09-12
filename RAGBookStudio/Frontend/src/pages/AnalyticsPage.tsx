import { useEffect, useState } from 'react'
import { BarChart3, BookOpen, Layers, HardDrive, Boxes, Cpu, Activity } from 'lucide-react'
import { analyticsApi, AnalyticsOverview } from '../services/api'

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [activity, setActivity] = useState<any[]>([])

  useEffect(() => {
    analyticsApi.overview().then((r) => setOverview(r.data)).catch(console.error)
    analyticsApi.activity(30).then((r) => setActivity(r.data)).catch(console.error)
  }, [])

  const cards = overview ? [
    { label: 'Workspaces', value: overview.workspaces, icon: BarChart3 },
    { label: 'Total Books', value: overview.total_books, icon: BookOpen },
    { label: 'Total Chunks', value: overview.total_chunks, icon: Layers },
    { label: 'Indexed', value: overview.indexed, icon: Activity },
    { label: 'Pending', value: overview.pending_index, icon: Activity },
    { label: 'Errors', value: overview.errors, icon: Activity },
    { label: 'Storage (MB)', value: overview.storage_mb, icon: HardDrive },
    { label: 'Models Enabled', value: overview.models_enabled, icon: Boxes },
  ] : []

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">Analytics</h1>
      <p className="text-slate-500 mb-8">Indexed documents, chunks, storage, and system metrics</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="glass-card p-4">
            <c.icon className="w-5 h-5 text-brand-600 mb-2" />
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs text-slate-500">{c.label}</p>
          </div>
        ))}
      </div>

      {overview?.device && (
        <div className="glass-card p-5 mb-8">
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-brand-600" /> Device Metrics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-slate-500">Backend</span><p className="font-medium">{overview.device.backend.toUpperCase()}</p></div>
            <div><span className="text-slate-500">Device</span><p className="font-medium">{overview.device.name}</p></div>
            <div><span className="text-slate-500">RAM Free</span><p className="font-medium">{overview.device.available_ram_mb} MB</p></div>
            <div><span className="text-slate-500">CPUs</span><p className="font-medium">{overview.device.cpu_count}</p></div>
          </div>
        </div>
      )}

      <h2 className="font-semibold text-lg mb-4">Activity Log</h2>
      <div className="glass-card divide-y divide-slate-100 dark:divide-slate-700/50 max-h-96 overflow-auto">
        {activity.map((a, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3 text-sm">
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 capitalize">{a.type}</span>
            <span className="flex-1 truncate">{a.name}</span>
            <span className="text-xs text-slate-400 capitalize">{a.status}</span>
            <span className="text-xs text-slate-400">{a.created_at?.slice(0, 19)}</span>
          </div>
        ))}
        {activity.length === 0 && <p className="p-6 text-center text-slate-400">No activity yet</p>}
      </div>
    </div>
  )
}
