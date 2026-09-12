import { create } from 'zustand'

interface ThemeState {
  theme: 'light' | 'dark'
  setTheme: (t: 'light' | 'dark') => void
  toggle: () => void
}

const stored = (typeof localStorage !== 'undefined' && localStorage.getItem('ragbook-theme')) as 'light' | 'dark' | null

export const useTheme = create<ThemeState>((set, get) => ({
  theme: stored || 'light',
  setTheme: (t) => {
    localStorage.setItem('ragbook-theme', t)
    document.documentElement.classList.toggle('dark', t === 'dark')
    set({ theme: t })
  },
  toggle: () => {
    const next = get().theme === 'light' ? 'dark' : 'light'
    get().setTheme(next)
  },
}))

// Apply on load
if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('dark', (stored || 'light') === 'dark')
}
