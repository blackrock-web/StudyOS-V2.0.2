import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, MessageSquare, Boxes, Settings, Search,
  Cpu, Puzzle, BarChart3, Moon, Sun, Library,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { useTheme } from '../../stores/theme'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/library', icon: Library, label: 'Library' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/models', icon: Boxes, label: 'Models' },
  { to: '/plugins', icon: Puzzle, label: 'Plugins' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout() {
  const [device, setDevice] = useState<{ name: string; backend: string } | null>(null)
  const { theme, toggle } = useTheme()

  useEffect(() => {
    api.get('/api/device/').then((r) => {
      setDevice({ name: r.data.name, backend: r.data.backend })
    }).catch(() => {})
  }, [])

  return (
    <div className="flex h-screen overflow-hidden page-bg">
      <aside className="w-64 glass-sidebar flex flex-col shrink-0 z-20">
        <div className="p-5 border-b border-white/20 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-gradient shadow-pink-glow flex items-center justify-center shadow-lg">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-800 dark:text-slate-100">RAGBook</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Study Platform</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `sidebar-item ${isActive ? 'sidebar-item-active' : ''}`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/20 dark:border-white/10 space-y-2">
          <button className="btn-ghost w-full flex items-center gap-2 text-sm" onClick={toggle}>
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
          <div className="glass p-3 flex items-center gap-2 text-sm">
            <Cpu className="w-4 h-4 text-brand-600" />
            <div className="min-w-0">
              <p className="font-medium text-slate-700 dark:text-slate-200 truncate">
                {device?.backend?.toUpperCase() || '...'}
              </p>
              <p className="text-xs text-slate-500 truncate">{device?.name || 'Detecting'}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
