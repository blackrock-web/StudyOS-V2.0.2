import React from 'react';
import { Bell, ShieldCheck, X } from 'lucide-react';

export interface ToastNotification {
  id: string;
  title?: string;
  message: string;
}

interface NotificationSystemProps {
  notifications: ToastNotification[];
  onDismiss: (id: string) => void;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({ notifications, onDismiss }) => {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2.5 max-w-sm pointer-events-auto">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className="bg-slate-900 border border-slate-700/80 shadow-2xl rounded-lg p-3.5 text-slate-100 flex items-start space-x-3 transition-all transform animate-in slide-in-from-bottom-3 duration-300"
        >
          <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span>{notif.title || 'StudyOS Desktop Notification'}</span>
              <span className="text-[10px] text-slate-400 font-normal">Now</span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-snug">{notif.message}</p>
            <div className="mt-2 text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Processed Locally (No Remote Cloud)
            </div>
          </div>
          <button
            onClick={() => onDismiss(notif.id)}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
