import React, { useState, useEffect } from 'react';
import { Lock, Unlock, ShieldAlert, Eye, Coffee } from 'lucide-react';
import { appModeService, AppModeState } from '../../services/appModeService';

interface FocusModeBannerProps {
  onOpenManager: () => void;
}

export const FocusModeBanner: React.FC<FocusModeBannerProps> = ({ onOpenManager }) => {
  const [modeState, setModeState] = useState<AppModeState>(() => appModeService.getState());

  useEffect(() => {
    const unsub = appModeService.subscribe((s) => setModeState(s));
    return () => unsub();
  }, []);

  if (modeState.activeMode === 'none') return null;

  const modeTitle = appModeService.getModeTitle(modeState.activeMode);

  return (
    <div className="w-full bg-slate-900 text-white px-4 py-2 border-b border-purple-500/30 flex items-center justify-between text-xs font-medium animate-fadeIn z-40 shadow-lg">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          {modeState.activeMode === 'focus' && <Eye className="w-4 h-4 text-purple-400 animate-pulse" />}
          {modeState.activeMode === 'kiosk' && <Lock className="w-4 h-4 text-indigo-400 animate-pulse" />}
          {modeState.activeMode === 'exam' && <ShieldAlert className="w-4 h-4 text-emerald-400 animate-pulse" />}

          <span className="font-black text-slate-100 tracking-tight">{modeTitle} Active</span>
        </div>

        {modeState.isBreakPaused ? (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[10px] flex items-center space-x-1">
            <Coffee className="w-3 h-3" />
            <span>Rest Break — Fullscreen Temporarily Suspended</span>
          </span>
        ) : (
          <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 text-[10px] font-bold uppercase tracking-wider">
            {appModeService.getActiveModeName()}
          </span>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenManager}
          className="px-3 py-1 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white text-[11px] font-black transition-all flex items-center space-x-1 cursor-pointer border border-purple-400/30"
        >
          <Unlock className="w-3 h-3" />
          <span>Unlock / Settings</span>
        </button>
      </div>
    </div>
  );
};
