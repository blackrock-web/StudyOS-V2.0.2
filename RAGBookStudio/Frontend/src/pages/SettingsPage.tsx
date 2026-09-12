import { useEffect, useState } from 'react'
import { Cpu, Palette, Database, Layers, Search } from 'lucide-react'
import { settingsApi, deviceApi, DeviceInfo } from '../services/api'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    settingsApi.get().then((r) => setSettings(r.data))
    deviceApi.get().then((r) => setDevice(r.data))
  }, [])

  const update = async (key: string, value: any) => {
    setSaving(true)
    try {
      const res = await settingsApi.update({ [key]: value })
      setSettings(res.data)
      if (key === 'device_preference') {
        const d = await deviceApi.get()
        setDevice(d.data)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">Settings</h1>
      <p className="text-slate-500 mb-8">Embeddings, vector DB, OCR, retrieval, chunking, and device configuration</p>

      <section className="glass-card p-6 mb-6">
        <h2 className="font-semibold text-lg flex items-center gap-2 mb-4">
          <Cpu className="w-5 h-5 text-brand-600" /> Device
        </h2>
        {device && (
          <div className="mb-4 p-3 rounded-xl bg-brand-50 dark:bg-brand-900/30 border border-brand-100 dark:border-brand-800">
            <p className="text-sm font-medium text-brand-800 dark:text-brand-200">
              Current: {device.backend.toUpperCase()} — {device.name}
            </p>
            <p className="text-xs text-brand-600 dark:text-brand-400 mt-1">
              RAM: {device.available_ram_mb} / {device.total_ram_mb} MB · CPUs: {device.cpu_count}
            </p>
          </div>
        )}
        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Preference</label>
        <div className="flex gap-2">
          {['auto', 'cpu', 'gpu'].map((p) => (
            <button key={p}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                settings.device_preference === p ? 'bg-brand-600 text-white' : 'bg-white/60 dark:bg-slate-700 text-slate-600 dark:text-slate-200'
              }`}
              onClick={() => update('device_preference', p)}
            >{p.charAt(0).toUpperCase() + p.slice(1)}</button>
          ))}
        </div>
      </section>

      <section className="glass-card p-6 mb-6">
        <h2 className="font-semibold text-lg flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-brand-600" /> Appearance
        </h2>
        <div className="flex gap-2">
          {['light', 'dark'].map((t) => (
            <button key={t}
              className={`px-4 py-2 rounded-xl text-sm font-medium ${
                settings.theme === t ? 'bg-brand-600 text-white' : 'bg-white/60 dark:bg-slate-700'
              }`}
              onClick={() => update('theme', t)}
            >{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
      </section>

      <section className="glass-card p-6 mb-6">
        <h2 className="font-semibold text-lg flex items-center gap-2 mb-4">
          <Layers className="w-5 h-5 text-brand-600" /> Chunking
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Strategy</label>
            <select className="input-glass" value={settings.chunk_strategy || 'paragraph'}
              onChange={(e) => update('chunk_strategy', e.target.value)}>
              <option value="fixed">Fixed</option>
              <option value="paragraph">Paragraph</option>
              <option value="sentence">Sentence</option>
              <option value="chapter">Chapter</option>
              <option value="semantic">Semantic</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Chunk Size</label>
            <input type="number" className="input-glass" value={settings.chunk_size || 512}
              onChange={(e) => update('chunk_size', parseInt(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Overlap</label>
            <input type="number" className="input-glass" value={settings.chunk_overlap || 64}
              onChange={(e) => update('chunk_overlap', parseInt(e.target.value))} />
          </div>
        </div>
      </section>

      <section className="glass-card p-6 mb-6">
        <h2 className="font-semibold text-lg flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-brand-600" /> Retrieval & Providers
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Top-K</label>
            <input type="number" className="input-glass" value={settings.top_k || 5}
              onChange={(e) => update('top_k', parseInt(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Temperature</label>
            <input type="number" step="0.1" min="0" max="2" className="input-glass" value={settings.temperature || 0.7}
              onChange={(e) => update('temperature', parseFloat(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Vector DB</label>
            <select className="input-glass" value={settings.default_vector_db || 'faiss'}
              onChange={(e) => update('default_vector_db', e.target.value)}>
              <option value="faiss">FAISS</option>
              <option value="chroma">Chroma</option>
              <option value="qdrant">Qdrant</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">OCR Provider</label>
            <select className="input-glass" value={settings.default_ocr_provider || ''}
              onChange={(e) => update('default_ocr_provider', e.target.value || null)}>
              <option value="">None</option>
              <option value="tesseract">Tesseract</option>
              <option value="easyocr">EasyOCR</option>
              <option value="paddleocr">PaddleOCR</option>
            </select>
          </div>
        </div>
      </section>

      <section className="glass-card p-6 mb-6">
        <h2 className="font-semibold text-lg flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-brand-600" /> Default Models
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Embedding Model</label>
            <input className="input-glass" placeholder="bge-small-en-v1.5" value={settings.default_embedding_model || ''}
              onChange={(e) => update('default_embedding_model', e.target.value || null)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">LLM</label>
            <input className="input-glass" placeholder="Model name from registry" value={settings.default_llm_model || ''}
              onChange={(e) => update('default_llm_model', e.target.value || null)} />
          </div>
        </div>
      </section>

      {saving && <p className="text-sm text-brand-600 text-center">Saving...</p>}
    </div>
  )
}
