import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, BookOpen, MessageSquare, Trash2, FolderOpen, Cpu, HardDrive,
  Layers, Activity, Boxes, Loader2, CheckCircle2, AlertCircle, Clock,
} from 'lucide-react'
import { workspaceApi, analyticsApi, tasksApi, Workspace, AnalyticsOverview, TaskInfo } from '../services/api'

export default function Dashboard() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [tasks, setTasks] = useState<TaskInfo[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const navigate = useNavigate()

  const load = async () => {
    try {
      const [ws, ov, act, tsk] = await Promise.all([
        workspaceApi.list(),
        analyticsApi.overview().catch(() => null),
        analyticsApi.activity(10).catch(() => ({ data: [] })),
        tasksApi.list().catch(() => ({ data: [] })),
      ])
      setWorkspaces(ws.data)
      if (ov) setOverview(ov.data)
      setActivity(act.data || [])
      setTasks((tsk.data || []).filter((t: TaskInfo) => ['running', 'pending', 'paused'].includes(t.status)))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (tasks.length === 0) return
    const iv = setInterval(load, 3000)
    return () => clearInterval(iv)
  }, [tasks.length])

  const create = async () => {
    if (!name.trim()) return
    const res = await workspaceApi.create(name.trim(), description.trim())
    setShowCreate(false)
    setName('')
    setDescription('')
    navigate(`/workspace/${res.data.id}`)
  }

  const remove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this workspace and all its data?')) return
    await workspaceApi.delete(id)
    load()
  }

  const stats = [
    { label: 'Workspaces', value: overview?.workspaces ?? workspaces.length, icon: FolderOpen, color: 'text-brand-600 bg-brand-100' },
    { label: 'Books', value: overview?.total_books ?? 0, icon: BookOpen, color: 'text-blue-600 bg-blue-100' },
    { label: 'Chunks', value: overview?.total_chunks ?? 0, icon: Layers, color: 'text-emerald-600 bg-emerald-100' },
    { label: 'Indexed', value: overview?.indexed ?? 0, icon: CheckCircle2, color: 'text-green-600 bg-green-100' },
    { label: 'Models', value: overview?.models_enabled ?? 0, icon: Boxes, color: 'text-violet-600 bg-violet-100' },
    { label: 'Storage', value: `${overview?.storage_mb ?? 0} MB`, icon: HardDrive, color: 'text-amber-600 bg-amber-100' },
  ]

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
          <p className="text-slate-500 mt-1">RAG Study Platform overview</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Workspace
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="glass-card p-4">
            <div className={`w-9 h-9 rounded-lg ${s.color} flex items-center justify-center mb-2`}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Device + Active tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass-card p-5">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-brand-600" /> Device Status
          </h2>
          {overview?.device ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Backend</span>
                <span className="font-medium text-brand-700 dark:text-brand-300">{overview.device.backend.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Device</span>
                <span className="font-medium">{overview.device.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">RAM</span>
                <span>{overview.device.available_ram_mb} / {overview.device.total_ram_mb} MB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CPUs</span>
                <span>{overview.device.cpu_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Preference</span>
                <span className="capitalize">{overview.device.preference}</span>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Loading device info...</p>
          )}
        </div>

        <div className="glass-card p-5">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-brand-600" /> Indexing Queue
          </h2>
          {tasks.length === 0 ? (
            <p className="text-slate-400 text-sm">No active indexing tasks</p>
          ) : (
            <div className="space-y-3">
              {tasks.slice(0, 5).map((t) => (
                <div key={t.id} className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium truncate">{t.name}</span>
                    <span className="text-slate-500">{t.progress.percent}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-500"
                      style={{ width: `${t.progress.percent}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{t.progress.message || t.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="glass-card p-6 mb-6 animate-slide-up">
          <h2 className="font-semibold text-lg mb-4">Create Workspace</h2>
          <input className="input-glass mb-3" placeholder="Workspace name (e.g. Physics 101)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <input className="input-glass mb-4" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-primary" onClick={create}>Create</button>
            <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Workspaces */}
      <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Workspaces</h2>
      {loading ? (
        <div className="text-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : workspaces.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <FolderOpen className="w-16 h-16 mx-auto text-brand-300 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No workspaces yet</h2>
          <p className="text-slate-500 mb-6">Create a workspace to organize books by subject or project</p>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>Create Workspace</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {workspaces.map((ws) => (
            <div key={ws.id} className="glass-card p-5 cursor-pointer group" onClick={() => navigate(`/workspace/${ws.id}`)}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-brand-600" />
                </div>
                <button className="opacity-0 group-hover:opacity-100 btn-ghost p-1.5 text-red-400 hover:text-red-600" onClick={(e) => remove(ws.id, e)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1 truncate">{ws.name}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-4">{ws.description || 'No description'}</p>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{ws.books?.length || 0} books</span>
                <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" />{ws.chats?.length || 0} chats</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent activity */}
      {activity.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Recent Activity</h2>
          <div className="glass-card divide-y divide-slate-100 dark:divide-slate-700/50">
            {activity.slice(0, 8).map((a, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3 text-sm">
                {a.status === 'completed' || a.status === 'indexed' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : a.status === 'error' || a.status === 'failed' ? (
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span className="flex-1 truncate">{a.name}</span>
                <span className="text-xs text-slate-400 capitalize">{a.status || a.type}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
