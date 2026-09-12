import React, { useState } from 'react';
import { History, RotateCcw, X, Clock, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { contentEngine, ContentItem, ContentItemVersion } from '../../services/contentEngine';

interface VersionHistoryModalProps {
  item: ContentItem | null;
  onClose: () => void;
  onVersionRestored?: (updatedItem: ContentItem) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  item,
  onClose,
  onVersionRestored,
}) => {
  const [selectedVersion, setSelectedVersion] = useState<ContentItemVersion | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');

  if (!item) return null;

  const versions = [...(item.versionHistory || [])].reverse();

  const handleRestore = (verNum: number) => {
    try {
      setIsRestoring(true);
      const restored = contentEngine.restoreVersion(item.id, verNum, 'User');
      setMessage(`Successfully restored Version ${verNum}!`);
      if (onVersionRestored) {
        onVersionRestored(restored);
      }
      setTimeout(() => {
        setMessage('');
        setIsRestoring(false);
      }, 2000);
    } catch (err: any) {
      console.error('Failed to restore version:', err);
      setMessage(`Error: ${err.message}`);
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-200">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                Version History
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                  {item.type.toUpperCase()}
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium truncate max-w-md">
                {item.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {message && (
          <div className="mx-6 mt-4 p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="font-semibold">{message}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Version List Timeline */}
          <div className="md:col-span-1 space-y-2 border-r border-slate-200 pr-4 max-h-[50vh] overflow-y-auto">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              All Snapshots ({versions.length})
            </p>
            {versions.map((ver) => {
              const isSelected = selectedVersion?.version === ver.version || (!selectedVersion && ver.version === item.versionHistory.length);
              return (
                <button
                  key={ver.version}
                  onClick={() => setSelectedVersion(ver)}
                  className={`w-full text-left p-3 rounded-xl border transition-all text-xs cursor-pointer flex flex-col gap-1 ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50 text-purple-950 font-bold shadow-2xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-slate-900">
                      <Clock className="w-3.5 h-3.5 text-purple-600" />
                      Version {ver.version}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {ver.updatedAt ? new Date(ver.updatedAt).toLocaleDateString() : 'Initial'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 truncate font-medium">
                    {ver.changeSummary || 'Content Update'}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Selected Version Detail View */}
          <div className="md:col-span-2 space-y-4">
            {(() => {
              const activeVer = selectedVersion || versions[0];
              if (!activeVer) {
                return <p className="text-xs text-slate-400">No version selected.</p>;
              }

              const isLatest = activeVer.version === item.versionHistory.length;

              return (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">
                        Snapshot v{activeVer.version}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                        <User className="w-3.5 h-3.5 text-purple-600" />
                        Updated by {activeVer.updatedBy || 'System'} • {activeVer.updatedAt ? new Date(activeVer.updatedAt).toLocaleString() : ''}
                      </p>
                    </div>

                    {!isLatest && (
                      <button
                        onClick={() => handleRestore(activeVer.version)}
                        disabled={isRestoring}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore Version {activeVer.version}</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase">
                      Title Snapshot
                    </label>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900">
                      {activeVer.title}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase">
                      Body / Content Snapshot
                    </label>
                    <div className="p-4 bg-slate-50 rounded-xl text-xs font-mono text-slate-800 whitespace-pre-wrap max-h-60 overflow-y-auto border border-slate-200">
                      {activeVer.body || '(Empty content body)'}
                    </div>
                  </div>

                  {activeVer.tags && activeVer.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {activeVer.tags.map((t, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-purple-50 text-purple-800 text-[10px] font-bold rounded-full border border-purple-200"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
};
