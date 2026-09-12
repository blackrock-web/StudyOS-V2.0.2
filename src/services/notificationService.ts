/** Offline notification center + optional native desktop notifications
 * Single source of truth for all app notifications (bell panel + native).
 */

export type NotificationCategory =
  | 'system'
  | 'study'
  | 'exam'
  | 'pomodoro'
  | 'import'
  | 'security'
  | 'backup'
  | 'update'
  | 'goal'
  | 'lecture';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  createdAt: string;
  read: boolean;
  actionTab?: string;
}

const STORAGE_KEY = 'studyos_notifications_v1';
const MAX = 200;

import { safeDispatch } from './db';

function load(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppNotification[];
  } catch {
    /* ignore */
  }
  return [];
}

function save(list: AppNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

function emit() {
  safeDispatch(new Event('studyos_notifications_updated'));
}

/** Infer category from title/message when caller does not specify one */
export function inferNotificationCategory(
  title: string,
  message: string = ''
): NotificationCategory {
  const t = `${title} ${message}`.toLowerCase();
  if (/pomodoro|break|focus session|timer/.test(t)) return 'pomodoro';
  if (/import|imported|json|restored|database import/.test(t)) return 'import';
  if (/backup|export|exported|snapshot/.test(t)) return 'backup';
  if (/update|version|release/.test(t)) return 'update';
  if (/goal|milestone|target|completion|completed/.test(t) && /goal|milestone/.test(t))
    return 'goal';
  if (/lecture|planner|dpp|chapter/.test(t)) return 'lecture';
  if (/exam|mock|test series/.test(t)) return 'exam';
  if (/security|lock|password|auth/.test(t)) return 'security';
  if (/study|syllabus|flashcard|srs|note/.test(t)) return 'study';
  return 'system';
}

export const notificationService = {
  list(): AppNotification[] {
    return load();
  },

  unreadCount(): number {
    return load().filter((n) => !n.read).length;
  },

  add(
    title: string,
    message: string,
    opts?: {
      category?: NotificationCategory;
      actionTab?: string;
      native?: boolean;
    }
  ): AppNotification {
    const category =
      opts?.category || inferNotificationCategory(title, message);
    const item: AppNotification = {
      id: 'n-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      title,
      message,
      category,
      createdAt: new Date().toISOString(),
      read: false,
      actionTab: opts?.actionTab,
    };
    const list = [item, ...load()].slice(0, MAX);
    save(list);
    emit();

    // Native desktop / browser notification (also stored in bell panel)
    if (opts?.native !== false && typeof window !== 'undefined') {
      try {
        if (window.studyosDesktop?.showNotification) {
          window.studyosDesktop.showNotification(title, message);
        } else if ('Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification(title, { body: message, silent: false });
          } else if (Notification.permission === 'default') {
            Notification.requestPermission().then((perm) => {
              if (perm === 'granted') new Notification(title, { body: message });
            });
          }
        }
      } catch {
        /* ignore */
      }
    }
    return item;
  },

  markRead(id: string): void {
    const list = load().map((n) => (n.id === id ? { ...n, read: true } : n));
    save(list);
    emit();
  },

  markAllRead(): void {
    save(load().map((n) => ({ ...n, read: true })));
    emit();
  },

  /** Permanently remove all notifications from storage and UI */
  clearAll(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    save([]);
    emit();
  },

  remove(id: string): void {
    save(load().filter((n) => n.id !== id));
    emit();
  },
};
