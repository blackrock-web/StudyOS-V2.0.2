import React, { useState } from 'react';
import {
  Settings,
  Database,
  Upload,
  Download,
  RotateCcw,
  ShieldCheck,
  Calendar,
  Moon,
  Sun,
  Keyboard,
  User,
  Sparkles,
  CheckCircle,
} from 'lucide-react';
import { db } from '../../services/db';
import { DesktopSettings } from '../../types';

interface SettingsBackupProps {
  onShowNotification: (msg: string, title?: string) => void;
}

export const SettingsBackup: React.FC<SettingsBackupProps> = ({ onShowNotification }) => {
  const [settings, setSettings] = useState<DesktopSettings>(db.getSettings());
  const [reanchorInput, setReanchorInput] = useState<string>(settings.reanchorStartDate);

  const handleSaveSettings = () => {
    db.setSettings(settings);
    onShowNotification('Desktop app preferences saved to local storage', 'Settings');
  };

  const handleReanchor = () => {
    db.updateReanchorStartDate(reanchorInput);
    setSettings(db.getSettings());
    onShowNotification(`All lecture dates shifted sequentially starting from ${reanchorInput}!`, 'Date Re-Anchoring');
  };

  const handleExportJSON = async () => {
    try {
      const { createSecureBackup } = await import('../../services/backupIntegrity');
      const jsonStr = db.exportDatabaseJSON();
      const envelope = await createSecureBackup(jsonStr, true);
      const blob = new Blob([envelope], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `StudyOS_Secure_Backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onShowNotification('Downloaded integrity-protected offline backup', 'Database Backup');
    } catch (err) {
      // Fallback to plain export
      const jsonStr = db.exportDatabaseJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `StudyOS_Full_Local_Database_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onShowNotification('Downloaded offline database JSON backup', 'Database Backup');
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      onShowNotification('Backup file exceeds 25 MB limit.', 'Restore Error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      try {
        const { verifyAndExtractBackup } = await import('../../services/backupIntegrity');
        const verified = await verifyAndExtractBackup(content);
        if (!verified.ok || !verified.json) {
          onShowNotification(verified.error || 'Backup integrity check failed.', 'Restore Error');
          return;
        }
        const success = db.importDatabaseJSON(verified.json);
        if (success) {
          setSettings(db.getSettings());
          onShowNotification('Local database restored and validated from backup.', 'Database Restore');
        } else {
          onShowNotification('Validated backup could not be applied.', 'Restore Error');
        }
      } catch {
        const success = db.importDatabaseJSON(content);
        if (success) {
          setSettings(db.getSettings());
          onShowNotification('Legacy backup restored.', 'Database Restore');
        } else {
          onShowNotification('Failed to parse backup JSON file format.', 'Restore Error');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-xl font-black text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-400" /> Desktop Settings & Offline Backup
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage local SQLite database backups, date re-anchoring start date, theme preferences, and shortcuts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        {/* Date Re-Anchoring Engine Settings */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Calendar className="w-4 h-4 text-emerald-400" /> Date Re-Anchoring Engine
          </h2>
          <p className="text-xs text-slate-400 leading-snug">
            Canonical PW dates are preserved. Enter your personal preparation start date (e.g. 23 July 2026) to shift the entire curriculum without altering lecture order or test dependencies.
          </p>

          <div className="space-y-2 text-xs">
            <label className="text-slate-300 font-semibold">Start Date:</label>
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={reanchorInput}
                onChange={(e) => setReanchorInput(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-white px-3 py-2 rounded-lg font-mono flex-1 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleReanchor}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shrink-0"
              >
                Apply Re-Anchor
              </button>
            </div>
          </div>
        </div>

        {/* Database Backup & Restore */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Database className="w-4 h-4 text-indigo-400" /> Local Database Backup & Restore
          </h2>
          <p className="text-xs text-slate-400 leading-snug">
            All data remains 100% local on your machine. Export full JSON database snapshots or restore existing backup files anytime.
          </p>

          <div className="flex items-center space-x-3 pt-2">
            <button
              onClick={handleExportJSON}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-md"
            >
              <Download className="w-4 h-4" /> Export Backup JSON
            </button>

            <label className="cursor-pointer px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5">
              <Upload className="w-4 h-4" />
              <span>Restore Backup</span>
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>
          </div>
        </div>

        {/* Desktop Preferences */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl md:col-span-2">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <User className="w-4 h-4 text-amber-400" /> Desktop Preferences & Profile
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-400 font-medium">Profile Name:</label>
              <input
                type="text"
                value={settings.activeProfile}
                onChange={(e) => setSettings({ ...settings, activeProfile: e.target.value })}
                className="w-full mt-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 font-medium">Weekly Goal Study Hours:</label>
              <input
                type="number"
                value={settings.weeklyGoalHours}
                onChange={(e) => setSettings({ ...settings, weeklyGoalHours: parseInt(e.target.value) || 48 })}
                className="w-full mt-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-800 pt-3">
            <button
              onClick={handleSaveSettings}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
