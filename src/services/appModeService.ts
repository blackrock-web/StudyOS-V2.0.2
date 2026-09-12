import { pomodoroTimerService, PomodoroTimerState } from './pomodoroTimerService';
import { authService } from './auth';
import { auditLogger } from './auditLogger';
import { notificationService } from './notificationService';

export type NamedAppMode = 'none' | 'focus' | 'kiosk' | 'exam';

export interface AppModeState {
  activeMode: NamedAppMode;
  isBreakPaused: boolean;
  activatedAt?: string;
  allowlist: string[];
  autoScheduleWithPomodoro: boolean;
  autoMuteNotifications: boolean;
  scheduledMode: NamedAppMode;
  lastExitReason?: 'manual' | 'pomodoro_complete' | 'scheduled_end' | 'break_start';
}

export interface PlatformBlockabilityInfo {
  platform: string;
  blockable: string[];
  unblockable: string[];
}

export const PER_PLATFORM_BLOCKABILITY: Record<'windows' | 'macOS' | 'linux', PlatformBlockabilityInfo> = {
  windows: {
    platform: 'Windows 10 / 11',
    blockable: [
      'Alt + F4 (Window Close)',
      'F11 (Fullscreen Toggle)',
      'Escape key in-app',
      'Ctrl + W / Ctrl + Q (App / Tab Close)',
      'DevTools shortcuts (Ctrl + Shift + I / F12)',
      'Embedded browser navigation outside allowlist',
    ],
    unblockable: [
      'Ctrl + Alt + Del (Winlogon Security Screen)',
      'Alt + Tab (OS Task Switcher — kernel protected)',
      'Windows Key / Win + D (Minimize all to desktop)',
      'Task Manager force termination (taskkill / PID end)',
    ],
  },
  macOS: {
    platform: 'macOS (Ventura / Sonoma / Sequoia)',
    blockable: [
      'Cmd + Q (App Quit)',
      'Cmd + W (Window Close)',
      'Cmd + Shift + I (DevTools)',
      'Fullscreen escape button',
      'In-app webview link navigation outside allowlist',
    ],
    unblockable: [
      'Cmd + Tab (App Switcher — OS Dock level)',
      'Mission Control / Swipe gestures (3/4 finger trackpad swipe)',
      'Activity Monitor force quit (SIGKILL / SIGTERM)',
      'Control + Command + Q (Lock Screen)',
      'Cmd + Option + Esc (Force Quit Applications Dialog)',
    ],
  },
  linux: {
    platform: 'Linux (X11 & Wayland)',
    blockable: [
      'F11 / Alt + F4 (Window close/fullscreen where WM permits)',
      'Ctrl + Q / Ctrl + W',
      'In-app shortcut overrides',
      'Embedded webview link navigation outside allowlist',
    ],
    unblockable: [
      'Ctrl + Alt + F1..F6 (Virtual Console / TTY switch)',
      'Super / Meta key (Desktop Shell Menu)',
      'Alt + Tab (X11/Wayland Compositor hotkey)',
      'kill / pkill command from terminal / htop',
    ],
  },
};

const MODE_STORAGE_KEY = 'studyos_app_mode_config';

type ModeListener = (state: AppModeState) => void;

class AppModeService {
  private state: AppModeState = {
    activeMode: 'none',
    isBreakPaused: false,
    allowlist: ['pw.live', 'google.com', 'wikipedia.org', 'geeksforgeeks.org', 'youtube.com'],
    autoScheduleWithPomodoro: true,
    autoMuteNotifications: false,
    scheduledMode: 'focus',
  };

  private listeners: Set<ModeListener> = new Set();
  private unsubPomodoro?: () => void;

  constructor() {
    this.loadStateFromStorage();
    this.initPomodoroListener();
  }

  private loadStateFromStorage() {
    try {
      const raw = localStorage.getItem(MODE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.state = {
            ...this.state,
            autoScheduleWithPomodoro: parsed.autoScheduleWithPomodoro ?? true,
            autoMuteNotifications: parsed.autoMuteNotifications ?? false,
            scheduledMode: parsed.scheduledMode || 'focus',
            allowlist: Array.isArray(parsed.allowlist) && parsed.allowlist.length > 0
              ? parsed.allowlist
              : this.state.allowlist,
          };
        }
      }
    } catch {
      /* ignore */
    }
  }

  private saveStateToStorage() {
    try {
      localStorage.setItem(
        MODE_STORAGE_KEY,
        JSON.stringify({
          autoScheduleWithPomodoro: this.state.autoScheduleWithPomodoro,
          autoMuteNotifications: this.state.autoMuteNotifications,
          scheduledMode: this.state.scheduledMode,
          allowlist: this.state.allowlist,
        })
      );
    } catch {
      /* ignore */
    }
  }

  public getState(): AppModeState {
    return { ...this.state, allowlist: [...this.state.allowlist] };
  }

  public subscribe(listener: ModeListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const curr = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(curr);
      } catch {
        /* ignore */
      }
    });
  }

  public getActiveModeName(): string {
    if (this.state.isBreakPaused) {
      return `Rest Break (${this.getModeTitle(this.state.activeMode)} Paused)`;
    }
    switch (this.state.activeMode) {
      case 'focus':
        return 'Focus Mode Active (Always-on-Top)';
      case 'kiosk':
        return 'Kiosk Mode Enforced (Fullscreen)';
      case 'exam':
        return 'Exam Mode Enforced (Lockdown)';
      default:
        return 'Standard Mode';
    }
  }

  public getModeTitle(mode: NamedAppMode): string {
    switch (mode) {
      case 'focus':
        return 'Focus Mode';
      case 'kiosk':
        return 'Kiosk Mode';
      case 'exam':
        return 'Exam Mode';
      default:
        return 'Standard';
    }
  }

  /**
   * Activates one of the three named modes.
   */
  public async activateMode(
    mode: NamedAppMode,
    options?: { allowlist?: string[]; autoMute?: boolean }
  ): Promise<boolean> {
    if (mode === 'none') {
      return this.deactivateModeWithoutAuth();
    }

    if (options?.allowlist) {
      this.state.allowlist = options.allowlist.map((d) => d.trim().toLowerCase()).filter(Boolean);
    }
    if (options?.autoMute !== undefined) {
      this.state.autoMuteNotifications = options.autoMute;
    }

    this.state.activeMode = mode;
    this.state.isBreakPaused = false;
    this.state.activatedAt = new Date().toISOString();
    this.saveStateToStorage();

    await this.applyNativeMode(mode, false);

    auditLogger.log(
      'APP_MODE_ACTIVATED',
      `Activated ${this.getModeTitle(mode)} Assistance Layer`,
      'SECURITY'
    );

    notificationService.add(
      `${this.getModeTitle(mode)} Enabled`,
      `Activated focus assistance (${mode.toUpperCase()}). Application-level nudge active.`
    );

    this.notify();
    return true;
  }

  /**
   * Applies the native window properties depending on activeMode and break status.
   */
  private async applyNativeMode(mode: NamedAppMode, isBreak: boolean) {
    const desktop = typeof window !== 'undefined' ? (window as any).studyosDesktop : undefined;

    if (isBreak || mode === 'none') {
      if (desktop?.setAlwaysOnTop) await desktop.setAlwaysOnTop(false);
      if (desktop?.setKioskMode) await desktop.setKioskMode(false);
      if (desktop?.setExamMode) await desktop.setExamMode(false, []);
      return;
    }

    if (mode === 'focus') {
      if (desktop?.setAlwaysOnTop) await desktop.setAlwaysOnTop(true);
      if (desktop?.setKioskMode) await desktop.setKioskMode(false);
      if (desktop?.setExamMode) await desktop.setExamMode(false, []);
    } else if (mode === 'kiosk') {
      if (desktop?.setAlwaysOnTop) await desktop.setAlwaysOnTop(true);
      if (desktop?.setKioskMode) await desktop.setKioskMode(true);
      if (desktop?.setExamMode) await desktop.setExamMode(false, []);
    } else if (mode === 'exam') {
      if (desktop?.setAlwaysOnTop) await desktop.setAlwaysOnTop(true);
      if (desktop?.setExamMode) await desktop.setExamMode(true, this.state.allowlist);
    }
  }

  /**
   * Manual override: Requires PIN/password unlock to exit early.
   */
  public async deactivateModeWithAuth(pinOrPassword: string): Promise<{ success: boolean; message: string }> {
    if (this.state.activeMode === 'none') {
      return { success: true, message: 'No active mode to exit.' };
    }

    const verified = await authService.unlockWorkspace(pinOrPassword);
    if (!verified) {
      auditLogger.log('APP_MODE_UNLOCK_FAILED', 'Failed attempt to exit Focus/Kiosk/Exam mode with invalid PIN/password', 'WARNING');
      return { success: false, message: 'Incorrect PIN or password. Mode remains active.' };
    }

    const prev = this.state.activeMode;
    await this.deactivateModeWithoutAuth();
    this.state.lastExitReason = 'manual';

    auditLogger.log('APP_MODE_DEACTIVATED', `Manually unlocked and exited ${this.getModeTitle(prev)}`, 'SECURITY');
    notificationService.add('Mode Unlocked', `Successfully exited ${this.getModeTitle(prev)} via credential verification.`);

    return { success: true, message: `Exited ${this.getModeTitle(prev)} successfully.` };
  }

  /**
   * Internal deactivation without PIN check (used on schedule completion / system resets).
   */
  public async deactivateModeWithoutAuth(): Promise<boolean> {
    this.state.activeMode = 'none';
    this.state.isBreakPaused = false;
    this.state.activatedAt = undefined;

    await this.applyNativeMode('none', false);
    this.notify();
    return true;
  }

  /**
   * Auto-transition during Pomodoro Breaks:
   * Exit fullscreen/shortcut-blocking for break duration, then re-enter when break ends.
   */
  private initPomodoroListener() {
    this.unsubPomodoro = pomodoroTimerService.subscribe((pomo: PomodoroTimerState) => {
      if (!this.state.autoScheduleWithPomodoro) return;

      const isBreakTime =
        pomo.mode === 'break' ||
        pomo.mode === 'shortBreak' ||
        pomo.mode === 'longBreak' ||
        pomo.breakStopwatchActive ||
        pomo.sessionState === 'BREAK_RUNNING';

      // 1. Transition into Break Mode: Pause fullscreen / kiosk
      if (isBreakTime && this.state.activeMode !== 'none' && !this.state.isBreakPaused) {
        this.state.isBreakPaused = true;
        this.applyNativeMode(this.state.activeMode, true);
        notificationService.add(
          'Break Started — Mode Suspended',
          'Kiosk / Exam mode temporarily suspended for rest break duration.'
        );
        this.notify();
        return;
      }

      // 2. Transition back to Focus Session: Resume active mode
      if (!isBreakTime && pomo.sessionState === 'FOCUS_RUNNING' && this.state.isBreakPaused) {
        this.state.isBreakPaused = false;
        this.applyNativeMode(this.state.activeMode, false);
        notificationService.add(
          'Focus Resumed — Mode Restored',
          `Re-entered ${this.getModeTitle(this.state.activeMode)} for study session.`
        );
        this.notify();
        return;
      }

      // 3. Auto-start scheduled mode when Pomodoro focus timer starts from none
      if (
        !isBreakTime &&
        pomo.sessionState === 'FOCUS_RUNNING' &&
        this.state.activeMode === 'none' &&
        this.state.scheduledMode !== 'none'
      ) {
        this.activateMode(this.state.scheduledMode);
      }
    });
  }

  public updateConfig(config: {
    scheduledMode?: NamedAppMode;
    autoScheduleWithPomodoro?: boolean;
    autoMuteNotifications?: boolean;
    allowlist?: string[];
  }) {
    if (config.scheduledMode !== undefined) this.state.scheduledMode = config.scheduledMode;
    if (config.autoScheduleWithPomodoro !== undefined) this.state.autoScheduleWithPomodoro = config.autoScheduleWithPomodoro;
    if (config.autoMuteNotifications !== undefined) this.state.autoMuteNotifications = config.autoMuteNotifications;
    if (config.allowlist) this.state.allowlist = config.allowlist.map((d) => d.trim().toLowerCase()).filter(Boolean);
    this.saveStateToStorage();
    this.notify();
  }

  public destroy() {
    if (this.unsubPomodoro) {
      this.unsubPomodoro();
    }
  }
}

export const appModeService = new AppModeService();
