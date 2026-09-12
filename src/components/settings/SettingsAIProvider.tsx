import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Cpu,
  Shield,
  Zap,
  Lock,
  HardDrive,
  Check,
  AlertCircle,
  Radio,
  FileText,
  Activity,
  Terminal,
} from 'lucide-react';
import {
  getActiveProviderId,
  setActiveProviderId,
  getActiveProvider,
} from '../../services/aiProvider';
import { localModelManager } from '../../services/models/LocalModelManager';
import { LocalModelDescriptor } from '../../types';
import { GlassCard } from '../shared/GlassCard';

interface SettingsAIProviderProps {
  onShowNotification: (msg: string, title?: string) => void;
}

export const SettingsAIProvider: React.FC<SettingsAIProviderProps> = ({ onShowNotification }) => {
  const [activeId, setActiveId] = useState<string>(() => getActiveProviderId());
  const [models, setModels] = useState<LocalModelDescriptor[]>(() => localModelManager.getModels());
  const [activeModelId, setActiveModelId] = useState<string | null>(() => localModelManager.getActiveModel()?.id || null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    const unsub = localModelManager.subscribe((updatedModels, activeId) => {
      setModels([...updatedModels]);
      setActiveModelId(activeId);
    });

    const handleProviderChange = () => {
      setActiveId(getActiveProviderId());
    };

    window.addEventListener('studyos_ai_provider_changed', handleProviderChange);
    return () => {
      unsub();
      window.removeEventListener('studyos_ai_provider_changed', handleProviderChange);
    };
  }, []);

  const handleSelectProvider = (id: string) => {
    setActiveProviderId(id);
    setActiveId(id);
    onShowNotification(
      `AI Engine set to ${id === 'local' ? 'Local AI (llama.cpp / GGUF)' : 'Manual Import'}`,
      'Local Engine'
    );
  };

  const handleSelectModel = (modelId: string) => {
    const success = localModelManager.setActiveModel(modelId);
    if (success) {
      const model = localModelManager.getActiveModel();
      onShowNotification(`Active local model set to ${model?.name || modelId}`, 'Local AI Engine');
    }
  };

  const handleTestLocalInference = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const provider = getActiveProvider();
      const samplePrompt = 'GATE Computer Science: Explain the Time Complexity of QuickSort average vs worst case.';
      const output = await localModelManager.executeOfflineInference(samplePrompt, {
        subject: 'Algorithms & Data Structures',
        topic: 'QuickSort Complexity',
      });
      setTestResult(output);
      onShowNotification('Local inference executed successfully on CPU/GPU!', 'Offline AI Test');
    } catch (e: any) {
      setTestResult(`Error executing local inference: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const activeModel = localModelManager.getActiveModel();

  return (
    <div className="space-y-6">
      {/* Top Banner: 100% Offline Local AI */}
      <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="flex items-start justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              100% Local Inference • Zero Cloud Dependencies
            </div>
            <h2 className="text-xl font-bold tracking-tight">Local AI Engine & GGUF Model Runtime</h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              StudyOS runs AI inference entirely on your local machine using embedded GGUF models and llama.cpp. No cloud services, external APIs, paid keys, or remote telemetry.
            </p>
          </div>
          <button
            onClick={handleTestLocalInference}
            disabled={isTesting}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/40 flex items-center gap-2 transition-all shrink-0 active:scale-95 cursor-pointer"
          >
            {isTesting ? (
              <>
                <Activity className="w-4 h-4 animate-spin" />
                Running Local Inference...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-emerald-200" />
                Test Local Inference
              </>
            )}
          </button>
        </div>
      </div>

      {/* System Status Matrix */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">AI Engine</span>
          <div className="mt-2 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-bold text-slate-800 font-mono">llama.cpp</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Native CPU / GPU
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Inference Mode</span>
          <div className="mt-2 flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-bold text-slate-800">Local / Offline</span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium mt-1">Air-gapped memory</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">API Keys</span>
          <div className="mt-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-bold text-slate-800">Not Required</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold mt-1">Zero external auth</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cloud AI / Telemetry</span>
          <div className="mt-2 flex items-center gap-2">
            <Radio className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-bold text-slate-600">Disabled</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1">Internet: OFF for inference</span>
        </div>
      </div>

      {/* Provider Selector Section */}
      <GlassCard className="p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-600" />
            Active Local Provider Strategy
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Select the offline pipeline used across StudyOS when generating notes, quizzes, flashcards, and mind maps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Local AI Provider */}
          <div
            onClick={() => handleSelectProvider('local')}
            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              activeId === 'local'
                ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-md'
                : 'border-slate-200 hover:border-indigo-300 bg-white'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Recommended • Local GGUF
                </span>
                {activeId === 'local' ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-indigo-600">
                    <CheckCircle2 className="w-4 h-4" /> Active
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-400">Click to Select</span>
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">1. Local AI (llama.cpp / GGUF)</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Executes inference locally via on-device quantized models. Generates complete study artifacts with zero latency dependencies and absolute data privacy.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Engine: llama.cpp</span>
              <span className="text-emerald-600 font-semibold">100% Offline</span>
            </div>
          </div>

          {/* Manual Import Provider */}
          <div
            onClick={() => handleSelectProvider('manual')}
            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              activeId === 'manual'
                ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-md'
                : 'border-slate-200 hover:border-indigo-300 bg-white'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Manual Input
                </span>
                {activeId === 'manual' ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-indigo-600">
                    <CheckCircle2 className="w-4 h-4" /> Active
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-400">Click to Select</span>
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">2. Manual Text Parser</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Import text from offline textbooks, research papers, or local notes. StudyOS automatically formats and parses it into cards, formulas, and quizzes.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Cost: $0.00</span>
              <span className="text-slate-600 font-semibold">Deterministic</span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Installed Local GGUF Models Catalog */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-indigo-600" />
              Installed Local Models (GGUF Format)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Available models vetted for offline reasoning, GATE exam syllabus coverage, and rapid token generation.
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full">
            llama.cpp Ready
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {models.map((model) => {
            const isCurrentActive = activeModelId === model.id;
            return (
              <div
                key={model.id}
                onClick={() => handleSelectModel(model.id)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  isCurrentActive
                    ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/20 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{model.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {model.quantization}
                      </span>
                    </div>
                    {isCurrentActive ? (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Selected
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium hover:text-slate-600">
                        Select
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{model.tagline}</p>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-[10px] text-slate-600 font-mono">
                  <div>
                    <span className="text-slate-400 block text-[9px]">RAM</span>
                    <span className="font-semibold">{model.recommendedRam}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">SPEED</span>
                    <span className="font-semibold text-emerald-600">{model.inferenceSpeed}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">SIZE</span>
                    <span className="font-semibold">{model.diskSizeFormatted}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Live Test Console Output */}
      {testResult && (
        <GlassCard className="p-5 space-y-2 border-emerald-200 bg-emerald-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-600" />
              Verified Local Output Console
            </span>
            <span className="text-[10px] font-mono text-emerald-700 font-bold px-2 py-0.5 bg-emerald-100 rounded-md">
              0 bytes cloud transmitted
            </span>
          </div>
          <pre className="p-3 bg-slate-900 text-emerald-300 font-mono text-xs rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {testResult}
          </pre>
        </GlassCard>
      )}

      {/* Zero Telemetry & Privacy Notice */}
      <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 text-xs flex items-center gap-3">
        <Lock className="w-4 h-4 text-slate-500 shrink-0" />
        <span>
          <strong>Zero Telemetry & Local Air-Gap Guarantee:</strong> StudyOS contains no analytics tracking, cloud inference proxies, or data logging. All study prompts, notes, and student materials remain exclusively inside your local storage.
        </span>
      </div>
    </div>
  );
};
