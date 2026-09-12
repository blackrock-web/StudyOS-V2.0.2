import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Layers,
  ArrowRight,
  RefreshCw,
  Cpu,
  Trash2,
  Check,
  X,
  HelpCircle,
  ListTodo,
} from 'lucide-react';
import {
  aiScheduleService,
  NaturalLanguageExecutionResult,
  StructuredScheduleAction,
} from '../../services/aiScheduleService';
import { localModelManager } from '../../services/models/LocalModelManager';
import { db } from '../../services/db';

interface NaturalLanguageScheduleEditorProps {
  currentSubject?: string;
  currentExamId?: string;
  onScheduleApplied?: () => void;
  className?: string;
}

export const NaturalLanguageScheduleEditor: React.FC<NaturalLanguageScheduleEditorProps> = ({
  currentSubject,
  currentExamId,
  onScheduleApplied,
  className = '',
}) => {
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<NaturalLanguageExecutionResult | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    command: string;
    actions: StructuredScheduleAction[];
    summary: string;
  } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeModel = localModelManager.getActiveModel();

  const handleExecute = async (overrideCommand?: string, forceConfirm: boolean = false) => {
    const cmdToRun = overrideCommand || command;
    if (!cmdToRun.trim()) return;

    setIsProcessing(true);
    setSuccessMessage(null);

    try {
      const res = await aiScheduleService.parseAndExecuteNaturalLanguageCommand(cmdToRun, {
        subjectHint: currentSubject,
        examIdHint: currentExamId,
        forceConfirm,
      });

      setResult(res);

      if (res.requiresConfirmation && res.actions.length > 0) {
        setPendingConfirmation({
          command: cmdToRun,
          actions: res.actions,
          summary: res.confirmationSummary || 'Please confirm the requested changes.',
        });
      } else if (res.success) {
        setPendingConfirmation(null);
        setCommand('');
        setSuccessMessage(`✓ ${res.appliedChanges.join(' • ') || 'Schedule updated in database!'}`);
        if (onScheduleApplied) onScheduleApplied();
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (e: any) {
      console.error('Error executing NL command:', e);
      setResult({
        success: false,
        explanation: e.message || 'Failed to process command.',
        actions: [],
        appliedChanges: [],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmActions = async () => {
    if (!pendingConfirmation) return;
    await handleExecute(pendingConfirmation.command, true);
    setPendingConfirmation(null);
  };

  const handleCancelConfirmation = () => {
    setPendingConfirmation(null);
    setResult(null);
  };

  const exampleCommands = [
    `Schedule ${currentSubject || 'Operating Systems'} Process Scheduling tomorrow at 6 PM`,
    `Move my ${currentSubject || 'DBMS'} session to Saturday at 10 AM`,
    `Schedule revision for all remaining ${currentSubject || 'DBMS'} units over the next five days`,
    `Remove my ${currentSubject || 'Computer Networks'} revision session tomorrow`,
  ];

  return (
    <div
      className={`p-6 rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-xl space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Natural-Language Schedule Editor
            </h3>
            <p className="text-[11px] text-slate-400">
              Exam-aware semantic scheduling powered by local LLM & database synchronization
            </p>
          </div>
        </div>

        {/* Model badge */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono text-indigo-300">
          <Cpu className="w-3 h-3 text-indigo-400" />
          <span>{activeModel ? activeModel.name.split(' ')[0] : 'Local LLM'}</span>
        </div>
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleExecute();
        }}
        className="relative"
      >
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder={`e.g. "Schedule ${currentSubject || 'Operating Systems'} Process Scheduling tomorrow at 6 PM"...`}
          className="w-full px-4 py-3.5 pr-28 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-medium"
        />
        <button
          type="submit"
          disabled={isProcessing || !command.trim()}
          className="absolute right-2 top-2 bottom-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
        >
          {isProcessing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>{isProcessing ? 'Processing' : 'Execute'}</span>
        </button>
      </form>

      {/* Quick Example Pills */}
      <div className="space-y-1.5">
        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
          Quick Prompts:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {exampleCommands.map((ex, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setCommand(ex);
                handleExecute(ex);
              }}
              className="text-left px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-[11px] text-slate-300 transition-all cursor-pointer truncate max-w-full"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Pending Confirmation Modal / Callout */}
      {pendingConfirmation && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 space-y-3 animate-in fade-in">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <h4 className="font-bold text-amber-200">Confirmation Required Before Database Mutation</h4>
              <p className="text-amber-300/90 whitespace-pre-line font-mono text-[11px] leading-relaxed">
                {pendingConfirmation.summary}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <button
              type="button"
              onClick={handleConfirmActions}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirm & Apply Changes</span>
            </button>
            <button
              type="button"
              onClick={handleCancelConfirmation}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Ambiguity Prompt */}
      {result?.isAmbiguous && (
        <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 flex items-start space-x-2.5 text-xs text-indigo-200">
          <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-indigo-300">Ambiguity Detected:</span>
            <p>{result.clarificationPrompt}</p>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successMessage && (
        <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center space-x-2 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
    </div>
  );
};
