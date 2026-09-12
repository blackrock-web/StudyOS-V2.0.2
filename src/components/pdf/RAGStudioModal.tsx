import React from 'react';
import { X, Sparkles, Brain, BookOpen, Layers, Maximize2 } from 'lucide-react';
import { RAGStudioPanel } from './RAGStudioPanel';

interface RAGStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePdfName: string;
  currentPage: number;
  onNavigateToPage: (page: number) => void;
  onJumpToLocation: (
    page: number,
    coordinates?: { x: number; y: number; w: number; h: number }
  ) => void;
  onTriggerNotification?: (
    title: string,
    message: string,
    type: 'info' | 'warning' | 'success' | 'alarm'
  ) => void;
}

export const RAGStudioModal: React.FC<RAGStudioModalProps> = ({
  isOpen,
  onClose,
  activePdfName,
  currentPage,
  onNavigateToPage,
  onJumpToLocation,
  onTriggerNotification,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 sm:p-6 animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp">
        {/* Top bar with close */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">
                  RAG Book Knowledge Studio
                </h2>
                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-black rounded-full uppercase tracking-wider">
                  Retrieval & Evaluation Suite
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Active Document: <span className="font-bold text-slate-700">{activePdfName || 'Study Material'}</span> • Current Page: <span className="font-bold text-purple-700">{currentPage}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Close RAG Studio"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Panel Body */}
        <div className="flex-1 overflow-hidden">
          <RAGStudioPanel
            activePdfName={activePdfName}
            currentPage={currentPage}
            onNavigateToPage={onNavigateToPage}
            onJumpToLocation={onJumpToLocation}
            onTriggerNotification={onTriggerNotification}
          />
        </div>
      </div>
    </div>
  );
};
