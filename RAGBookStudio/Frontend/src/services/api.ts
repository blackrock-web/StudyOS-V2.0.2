import axios from 'axios'

export const api = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
})

export interface Workspace {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
  books: Array<{
    file_id: string
    title: string
    page_count: number
    original_name: string
    tags?: string[]
    folder?: string
    status?: string
  }>
  chats: any[]
  settings: Record<string, any>
}

export interface BookMeta {
  file_id: string
  title: string
  original_name: string
  page_count: number
  status: string
  is_scanned?: boolean
  chunk_count?: number
  tags?: string[]
  folder?: string
  toc?: Array<{ level: number; title: string; page: number }>
  uploaded_at?: string
  author?: string
}

export interface DeviceInfo {
  preference: string
  backend: string
  name: string
  memory_total_mb?: number
  memory_free_mb?: number
  cpu_count: number
  total_ram_mb: number
  available_ram_mb: number
  all_devices: Array<{ backend: string; name: string; index: number }>
}

export interface ModelInfo {
  name: string
  type: string
  version: string
  provider: string
  device_support: string[]
  dimension?: number
  parameters?: string
  description: string
  enabled: boolean
  path?: string
  ready?: boolean
  using_custom_weights?: boolean
}

export interface TaskInfo {
  id: string
  name: string
  type: string
  status: string
  progress: { current: number; total: number; message: string; percent: number }
  workspace_id?: string
  file_id?: string
  created_at: string
  error?: string
}

export interface AnalyticsOverview {
  workspaces: number
  total_books: number
  total_chunks: number
  indexed: number
  pending_index: number
  errors: number
  storage_mb: number
  device: DeviceInfo
  models_total: number
  models_enabled: number
  active_tasks: number
}

export interface ChatResponse {
  chat_id: string
  answer: string
  citations: Array<{ page?: number; file_id?: string; title?: string; score?: number; text_preview?: string }>
  contexts: Array<any>
  confidence: number
  model: string
  debug?: {
    timings_ms: Record<string, number>
    chunks: Array<any>
    embedding_model?: string
    embedding_dim?: number
  }
}

export const workspaceApi = {
  list: () => api.get<Workspace[]>('/api/workspaces/'),
  create: (name: string, description = '') =>
    api.post<Workspace>('/api/workspaces/', { name, description }),
  get: (id: string) => api.get<Workspace>(`/api/workspaces/${id}`),
  update: (id: string, data: Partial<Workspace>) =>
    api.patch<Workspace>(`/api/workspaces/${id}`, data),
  delete: (id: string) => api.delete(`/api/workspaces/${id}`),
}

export const pdfApi = {
  upload: (workspaceId: string, file: File, opts?: { password?: string; tags?: string; folder?: string }) => {
    const form = new FormData()
    form.append('workspace_id', workspaceId)
    form.append('file', file)
    if (opts?.password) form.append('password', opts.password)
    if (opts?.tags) form.append('tags', opts.tags)
    if (opts?.folder) form.append('folder', opts.folder)
    return api.post('/api/pdf/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  uploadBatch: (workspaceId: string, files: File[]) => {
    const form = new FormData()
    form.append('workspace_id', workspaceId)
    files.forEach((f) => form.append('files', f))
    return api.post('/api/pdf/upload/batch', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  uploadZip: (workspaceId: string, zipFile: File) => {
    const form = new FormData()
    form.append('workspace_id', workspaceId)
    form.append('file', zipFile)
    return api.post('/api/pdf/upload/zip', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  list: (wsId: string) => api.get<BookMeta[]>(`/api/pdf/${wsId}`),
  index: (data: { workspace_id: string; file_id: string; strategy?: string; chunk_size?: number; ocr_provider?: string }) =>
    api.post('/api/pdf/index', data),
  getMeta: (wsId: string, fileId: string) => api.get<BookMeta>(`/api/pdf/${wsId}/${fileId}`),
  getPage: (wsId: string, fileId: string, page: number) =>
    api.get(`/api/pdf/${wsId}/${fileId}/page/${page}`),
  pageImageUrl: (wsId: string, fileId: string, page: number, dpi = 120) =>
    `/api/pdf/${wsId}/${fileId}/page/${page}/image?dpi=${dpi}`,
  delete: (wsId: string, fileId: string) => api.delete(`/api/pdf/${wsId}/${fileId}`),
}

export const chatApi = {
  send: (data: {
    workspace_id: string
    message: string
    chat_id?: string
    file_ids?: string[]
    top_k?: number
    stream?: boolean
    include_debug?: boolean
  }) => api.post<ChatResponse>('/api/chat/', data),
  get: (wsId: string, chatId: string) => api.get(`/api/chat/${wsId}/${chatId}`),
  list: (wsId: string) => api.get(`/api/chat/${wsId}`),
}

export const modelsApi = {
  list: (type?: string) => api.get<ModelInfo[]>('/api/models/', { params: { type } }),
  enable: (type: string, name: string) => api.post('/api/models/enable', { type, name }),
  disable: (type: string, name: string) => api.post('/api/models/disable', { type, name }),
  discover: () => api.post('/api/models/discover'),
}

export const deviceApi = {
  get: () => api.get<DeviceInfo>('/api/device/'),
  setPreference: (preference: string) => api.post('/api/device/preference', { preference }),
  refresh: () => api.post('/api/device/refresh'),
}

export const settingsApi = {
  get: () => api.get('/api/settings/'),
  update: (data: Record<string, any>) => api.patch('/api/settings/', data),
}

export const searchApi = {
  search: (q: string, workspaceId?: string) =>
    api.get('/api/search/', { params: { q, workspace_id: workspaceId } }),
}

export const tasksApi = {
  list: (workspaceId?: string, status?: string) =>
    api.get<TaskInfo[]>('/api/tasks/', { params: { workspace_id: workspaceId, status } }),
  get: (id: string) => api.get<TaskInfo>(`/api/tasks/${id}`),
  pause: (id: string) => api.post(`/api/tasks/${id}/pause`),
  resume: (id: string) => api.post(`/api/tasks/${id}/resume`),
  cancel: (id: string) => api.post(`/api/tasks/${id}/cancel`),
}

export const analyticsApi = {
  overview: () => api.get<AnalyticsOverview>('/api/analytics/overview'),
  activity: (limit = 20) => api.get('/api/analytics/activity', { params: { limit } }),
}

export const pluginsApi = {
  list: () => api.get('/api/plugins/'),
  reload: (name: string) => api.post(`/api/plugins/${name}/reload`),
  discover: () => api.post('/api/plugins/discover'),
}
