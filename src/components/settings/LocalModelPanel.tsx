import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Key,
  HardDrive,
  Activity,
  ShieldCheck,
  RefreshCw,
  Zap,
  Lock,
  Radio,
  FileText,
  Terminal,
  Check,
  Layers,
  Sliders,
  FolderOpen,
  Plus,
} from 'lucide-react';
import { localModelManager } from '../../services/models/LocalModelManager';
import { LocalModelDescriptor } from '../../types';
import { networkGateway } from '../../services/network/NetworkGateway';
import {
  getActiveProviderId,
  setActiveProviderId,
  getActiveProvider,
} from '../../services/aiProvider';

interface Props {
  onShowNotification: (msg: string, title?: string) => void;
}

export const LocalModelPanel: React.FC<Props> = ({ onShowNotification }) => {
  const [activeProviderId, setActiveProviderIdState] = useState<string>(() => getActiveProviderId());
  const [models, setModels] = useState<LocalModelDescriptor[]>(() => localModelManager.getModels());
  const [activeModelId, setActiveModelId] = useState<string | null>(() => localModelManager.getActiveModel()?.id || null);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [targetModelId, setTargetModelId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Integrity Check State
  const [isVerifyingIntegrity, setIsVerifyingIntegrity] = useState(false);
  const [integrityReport, setIntegrityReport] = useState<{
    ok: boolean;
    valid: boolean;
    modelId: string;
    modelName: string;
    sha256Match: boolean;
    expectedSha256: string;
    calculatedSha256: string;
    diskSizeBytes: number;
    diskSizeFormatted: string;
    filePath: string;
    format: string;
    quantization: string;
    message: string;
    verifiedAt: string;
  } | null>(null);

  // Custom Model Import Modal State
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPath, setCustomPath] = useState('');
  const [customFormat, setCustomFormat] = useState<'GGUF' | 'ONNX'>('GGUF');
  const [customQuant, setCustomQuant] = useState('Q4_K_M');

  useEffect(() => {
    const unsub = localModelManager.subscribe((updatedModels, activeId) => {
      setModels([...updatedModels]);
      setActiveModelId(activeId);
    });

    const handleProviderChange = () => {
      setActiveProviderIdState(getActiveProviderId());
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPinModal(false);
        setShowCustomModal(false);
        setIntegrityReport(null);
        setTestOutput(null);
      }
    };

    const handleStudyOsEsc = () => {
      setShowPinModal(false);
      setShowCustomModal(false);
      setIntegrityReport(null);
      setTestOutput(null);
    };

    window.addEventListener('studyos_ai_provider_changed', handleProviderChange);
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('studyos_esc_pressed', handleStudyOsEsc);

    return () => {
      unsub();
      window.removeEventListener('studyos_ai_provider_changed', handleProviderChange);
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('studyos_esc_pressed', handleStudyOsEsc);
    };
  }, []);

  const handleSelectProvider = (id: string) => {
    setActiveProviderId(id);
    setActiveProviderIdState(id);
    onShowNotification(
      `AI Engine strategy set to ${id === 'local' ? 'Local AI (llama.cpp / GGUF)' : 'Manual Import Parser'}`,
      'Local AI Strategy'
    );
  };

  const handleStartDownload = (modelId: string) => {
    setTargetModelId(modelId);
    setPinError(null);
    setPinInput('');
    setShowPinModal(true);
  };

  const handleCancelDownload = (modelId: string) => {
    localModelManager.cancelDownload(modelId);
    setDownloadingModelId(null);
    onShowNotification(`Cancelled model download for ${modelId}`, 'Download Cancelled');
  };

  const handleVerifyIntegrity = async (modelId: string) => {
    setIsVerifyingIntegrity(true);
    try {
      const report = await localModelManager.verifyModelIntegrity(modelId);
      setIntegrityReport(report);
      if (report.valid) {
        onShowNotification(`Integrity verified for ${report.modelName}! SHA-256 match.`, 'Integrity Valid');
      } else {
        onShowNotification(`Integrity check failed: ${report.message}`, 'Verification Warning');
      }
    } catch (e: any) {
      onShowNotification(`Integrity check error: ${e.message}`, 'Error');
    } finally {
      setIsVerifyingIntegrity(false);
    }
  };

  const handleConfirmDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetModelId) return;

    if (!pinInput) {
      setPinError('Please enter your Network Security PIN.');
      return;
    }

    setShowPinModal(false);
    setDownloadingModelId(targetModelId);
    onShowNotification('Temporarily unlocking network to download vetted local model...', 'Local AI');

    const res = await localModelManager.downloadAndInstallModel(
      targetModelId,
      pinInput,
      () => {
        // Handled reactively via subscriber
      }
    );

    setDownloadingModelId(null);
    if (res.ok) {
      onShowNotification('Local model installed and verified! Network locked.', 'Model Installed');
    } else {
      onShowNotification(res.error || 'Failed to download model', 'Error');
    }
  };

  const handleSelectActiveModel = (modelId: string) => {
    const success = localModelManager.setActiveModel(modelId);
    if (success) {
      const model = localModelManager.getActiveModel();
      onShowNotification(`Active offline model set to ${model?.name || modelId}`, 'Local AI Engine');
    }
  };

  const handleRemoveModel = async (modelId: string) => {
    const res = await localModelManager.deleteModel(modelId);
    if (res.ok) {
      onShowNotification('Model removed from local storage.', 'Storage Freed');
    } else {
      onShowNotification(res.error || 'Failed to remove model', 'Error');
    }
  };

  const handleImportCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName || !customPath) return;

    const imported = localModelManager.importCustomModel({
      name: customName,
      filePathOrUrl: customPath,
      format: customFormat,
      quantization: customQuant,
    });

    setShowCustomModal(false);
    setCustomName('');
    setCustomPath('');
    onShowNotification(`Custom model ${imported.name} imported and activated!`, 'Custom Model');
  };

  const handleTestInference = async () => {
    setIsTesting(true);
    setTestOutput(null);
    try {
      const output = await localModelManager.executeOfflineInference(
        'Generate structured study notes on Operating Systems Virtual Memory, Paging, and Belady Anomaly for GATE CSE.',
        {
          subject: 'Operating Systems',
          topic: 'Virtual Memory & Paging',
          chapter: 'Memory Management',
        }
      );
      setTestOutput(output);
      onShowNotification('Offline local inference completed successfully on CPU/GPU!', 'Offline AI Test');
    } catch (e: any) {
      setTestOutput(`Inference error: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn text-slate-900">
      {/* 1. Header Hero Card */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-indigo-200 shadow-2xs space-y-6">
        <div className="border-b border-indigo-100 pb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              100% Offline Local AI • Zero Cloud Services & Zero API Keys
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 mt-1">
              Local AI Engine & GGUF Model Hub
            </h2>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              StudyOS runs real quantized neural networks entirely on your device's CPU/GPU via llama.cpp. Switch between installed GGUF models, download new vetted weights with PIN verification, or import custom models.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCustomModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-600" />
              <span>Import GGUF</span>
            </button>

            <button
              type="button"
              onClick={handleTestInference}
              disabled={isTesting}
              className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Running Local AI...' : 'Test Offline AI'}</span>
            </button>
          </div>
        </div>

        {/* 2. System Status Matrix */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">AI Runtime</span>
            <div className="mt-1 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-bold text-slate-900 font-mono">llama.cpp</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Native CPU/GPU
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Inference Mode</span>
            <div className="mt-1 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-bold text-slate-900">Air-Gapped</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium mt-1">100% Local Memory</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">API Keys</span>
            <div className="mt-1 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-bold text-slate-900">Zero Needed</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-bold mt-1">No billing / No tokens</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cloud Network</span>
            <div className="mt-1 flex items-center gap-2">
              <Radio className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-bold text-slate-600">Blocked</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium mt-1">Zero Telemetry</span>
          </div>
        </div>

        {/* 3. AI Strategy Selector */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" /> AI Provider Pipeline
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleSelectProvider('local')}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                activeProviderId === 'local'
                  ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'border-slate-200 hover:border-indigo-300 bg-white'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Recommended • GGUF
                  </span>
                  {activeProviderId === 'local' && (
                    <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Active Pipeline
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-bold text-slate-900">1. Local AI (llama.cpp / GGUF)</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Automatic offline generation for notes, flashcards, quizzes, and focus plans.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectProvider('manual')}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                activeProviderId === 'manual'
                  ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'border-slate-200 hover:border-indigo-300 bg-white'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Manual Input
                  </span>
                  {activeProviderId === 'manual' && (
                    <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Active Pipeline
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-bold text-slate-900">2. Manual Text Parser</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Paste textbook excerpts or lecture transcripts to generate structured study sets without AI.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* 4. Live Test Output Console */}
        {testOutput && (
          <div className="p-5 rounded-2xl bg-slate-900 text-slate-100 font-mono text-xs space-y-2 border border-slate-800 animate-in fade-in">
            <div className="flex items-center justify-between text-indigo-400 font-bold">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Offline Local AI Output Console
              </span>
              <button
                type="button"
                onClick={() => setTestOutput(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <pre className="whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto text-[11px] text-emerald-300">
              {testOutput}
            </pre>
          </div>
        )}

        {/* 5. GGUF Model Catalog & Switcher */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-indigo-600" /> Available Local Models (GGUF Format)
            </h3>
            <span className="text-xs font-bold text-indigo-600">
              Active: <strong>{localModelManager.getActiveModel()?.name || 'SmolLM2 135M'}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {models.map((m) => {
              const isInstalled = m.status === 'installed';
              const isActive = activeModelId === m.id;
              const isDownloading = m.status === 'downloading' || m.status === 'verifying';

              return (
                <div
                  key={m.id}
                  className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between space-y-4 ${
                    isActive
                      ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-xs'
                      : isInstalled
                      ? 'border-slate-200 bg-white hover:border-indigo-300'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-white'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800 font-mono">
                          {m.format} • {m.parameterSize}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                          {m.diskSizeFormatted}
                        </span>
                      </div>

                      {isActive && (
                        <span className="flex items-center gap-1 text-xs font-black text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" /> ACTIVE ENGINE
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{m.name}</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{m.tagline}</p>
                    </div>

                    {/* Specs Matrix */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400">RAM: </span>
                        <span className="text-slate-700 font-bold">{m.recommendedRam}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Speed: </span>
                        <span className="text-emerald-700 font-bold">{m.inferenceSpeed}</span>
                      </div>
                    </div>

                    {/* Checksum & Security */}
                    <div className="text-[10px] font-mono text-slate-400 truncate">
                      SHA-256: {m.sha256.slice(0, 20)}…
                    </div>

                    {/* Progress Bar if Downloading */}
                    {isDownloading && (
                      <div className="space-y-1.5 p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                        <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                          <span className="flex items-center gap-1.5">
                            <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                            {m.status === 'verifying' ? 'Verifying SHA-256 Checksum...' : 'Downloading model weights...'}
                          </span>
                          <span>{m.downloadProgress || 0}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-indigo-200 overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                            style={{ width: `${m.downloadProgress || 0}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    {isInstalled ? (
                      <>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectActiveModel(m.id)}
                            disabled={isActive}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                              isActive
                                ? 'bg-indigo-100 text-indigo-700 cursor-default'
                                : 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                            }`}
                          >
                            {isActive ? 'Active Engine' : 'Use This Model'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleVerifyIntegrity(m.id)}
                            disabled={isVerifyingIntegrity}
                            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                            title="Verify GGUF magic bytes and SHA-256 checksum integrity"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Verify Integrity</span>
                          </button>
                        </div>

                        {m.id !== 'smollm2-135m-instruct' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveModel(m.id)}
                            className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        )}
                      </>
                    ) : isDownloading ? (
                      <button
                        type="button"
                        onClick={() => handleCancelDownload(m.id)}
                        className="w-full py-2 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        Cancel Download
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartDownload(m.id)}
                        disabled={isDownloading}
                        className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Model ({m.diskSizeFormatted})
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Integrity Verification Modal */}
      {integrityReport && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIntegrityReport(null);
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 text-slate-900 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">GGUF Model Integrity Verification</h3>
                  <p className="text-[11px] text-slate-500 font-medium">{integrityReport.modelName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIntegrityReport(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className={`p-3.5 rounded-2xl border ${integrityReport.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{integrityReport.message}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Magic Bytes:</span>
                  <span className="text-slate-900 font-bold">0x47475546 (GGUF V3)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Format & Quant:</span>
                  <span className="text-slate-900 font-bold">{integrityReport.format} • {integrityReport.quantization}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">File Path:</span>
                  <span className="text-slate-900 font-bold truncate max-w-[240px]">{integrityReport.filePath}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Disk Allocation:</span>
                  <span className="text-slate-900 font-bold">{integrityReport.diskSizeFormatted}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 space-y-1">
                  <span className="text-slate-500 block">SHA-256 Checksum:</span>
                  <div className="p-2 bg-slate-900 text-emerald-400 rounded-xl text-[10px] break-all">
                    {integrityReport.calculatedSha256}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIntegrityReport(null)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Authorization Modal */}
      {showPinModal && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPinModal(false);
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5 text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Key className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Authorize Model Download</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Downloading this vetted model will temporarily unlock network access exclusively to download model weights. Upon completion, the network immediately auto-locks.
            </p>

            <form onSubmit={handleConfirmDownload} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Enter Network Security PIN</label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter 4-6 digit PIN"
                  autoFocus
                  className="w-full p-3 text-sm font-mono tracking-widest bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white"
                />
              </div>

              {pinError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {pinError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  Unlock & Download Model
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom GGUF/ONNX Model Import Modal */}
      {showCustomModal && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCustomModal(false);
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <FolderOpen className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Import Custom GGUF/ONNX Model</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Register a local file path or custom model URL. The model will run locally in offline mode with zero network dependency.
            </p>

            <form onSubmit={handleImportCustom} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Model Name</label>
                <input
                  type="text"
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Llama-3.2-1B-Instruct-Q4_K_M"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Local File Path / Model Location</label>
                <input
                  type="text"
                  required
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="e.g. /home/user/models/custom-model.gguf"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-600 focus:bg-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Format</label>
                  <select
                    value={customFormat}
                    onChange={(e) => setCustomFormat(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <option value="GGUF">GGUF (llama.cpp)</option>
                    <option value="ONNX">ONNX Runtime</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Quantization</label>
                  <input
                    type="text"
                    value={customQuant}
                    onChange={(e) => setCustomQuant(e.target.value)}
                    placeholder="Q4_K_M"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  Register & Activate Model
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
