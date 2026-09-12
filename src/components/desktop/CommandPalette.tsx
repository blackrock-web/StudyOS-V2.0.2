import React, { useState, useEffect } from 'react';
import {
  Search,
  LayoutDashboard,
  Clock,
  BookOpen,
  Calendar,
  Globe,
  FileText,
  Layers,
  Award,
  BarChart3,
  Download,
  Settings,
  Flame,
  Lock,
  Maximize2,
  X,
  ArrowRight,
  Zap,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tabId: string) => void;
  onToggleFocusMode: () => void;
  onLockWorkspace: () => void;
  onExportBackup: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onToggleFocusMode,
  onLockWorkspace,
  onExportBackup,
}) => {
  const [query, setQuery] = useState<string>('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const handleStudyOsEsc = () => {
      onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('studyos_esc_pressed', handleStudyOsEsc);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('studyos_esc_pressed', handleStudyOsEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items = [
    { id: 'dashboard', title: 'Dashboard & Overview', category: 'Views', icon: LayoutDashboard },
    { id: 'analytics', title: 'Analytics Workspace', category: 'Views', icon: BarChart3 },
    { id: 'lectures', title: 'PW Lectures Planner & Database', category: 'Views', icon: Clock },
    { id: 'syllabus', title: 'Syllabus Tracker', category: 'Views', icon: BookOpen },
    { id: 'planner', title: 'Daily & Weekly Study Planner', category: 'Views', icon: Calendar },
    { id: 'pdf', title: 'PDF Knowledge Engine & Notes', category: 'Views', icon: FileText },
    { id: 'reports', title: 'Reports & Export Manager', category: 'Views', icon: Download },
    { id: 'settings', title: 'Settings & Database Backup', category: 'Views', icon: Settings },
    { id: 'settings-exam-manager', title: 'Exam Manager & Active Exam Workspaces (Settings)', category: 'Views', icon: Award },
    { id: 'action_focus', title: 'Toggle Zen Mode (Distraction-Free Full View)', category: 'Action', icon: Maximize2 },
    { id: 'action_lock', title: 'Lock Workspace Immediately', category: 'Action', icon: Lock },
    { id: 'action_export', title: 'Export Local SQLite Database Dump', category: 'Action', icon: Download },
  ];

  const filtered = items.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (item: typeof items[0]) => {
    onClose();
    if (item.id === 'action_focus') {
      onToggleFocusMode();
    } else if (item.id === 'action_lock') {
      onLockWorkspace();
    } else if (item.id === 'action_export') {
      onExportBackup();
    } else {
      onNavigate(item.id);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-950/60 backdrop-blur-sm p-4 font-sans select-none animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-purple-100 overflow-hidden flex flex-col max-h-[70vh]">
        {/* Search Bar */}
        <div className="p-3 border-b border-purple-100 flex items-center space-x-3 bg-purple-50/40">
          <Search className="w-5 h-5 text-purple-600 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search view (Ctrl + K)..."
            autoFocus
            className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-purple-100 text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="p-2 space-y-1 overflow-y-auto custom-scrollbar flex-1">
          {filtered.length > 0 ? (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold text-slate-800 hover:bg-purple-50 hover:text-purple-700 transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span>{item.title}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-[10px] text-slate-400 group-hover:text-purple-600">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 group-hover:bg-purple-100/80 font-mono">
                      {item.category}
                    </span>
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              No matching commands or views found.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-purple-600" /> StudyOS Command Launcher
          </span>
          <span className="font-mono text-slate-400">Press ESC to exit</span>
        </div>
      </div>
    </div>
  );
};
