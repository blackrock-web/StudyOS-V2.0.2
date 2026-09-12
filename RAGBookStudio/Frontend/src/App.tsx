import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import LibraryPage from './pages/LibraryPage'
import WorkspacePage from './pages/WorkspacePage'
import ReaderPage from './pages/ReaderPage'
import ChatPage from './pages/ChatPage'
import ModelsPage from './pages/ModelsPage'
import SettingsPage from './pages/SettingsPage'
import SearchPage from './pages/SearchPage'
import AnalyticsPage from './pages/AnalyticsPage'
import PluginsPage from './pages/PluginsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="workspace/:id" element={<WorkspacePage />} />
        <Route path="workspace/:id/reader/:fileId" element={<ReaderPage />} />
        <Route path="workspace/:id/chat" element={<ChatPage />} />
        <Route path="models" element={<ModelsPage />} />
        <Route path="plugins" element={<PluginsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
