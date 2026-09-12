import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Clock,
  BookOpen,
  Calendar,
  FileText,
  Layers,
  Award,
  BarChart3,
  Download,
  Settings,
  Search,
  Maximize2,
  Minimize2,
  Bell,
  Flame,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Sparkles,
  BookMarked,
  Brain,
  HelpCircle,
  FileSpreadsheet,
  FileEdit,
  Activity,
  TrendingUp,
  User,
  ShieldCheck,
  Database,
  Terminal,
  Palette,
  Globe,
  Wifi,
  Briefcase,
  KeyRound,
  HardDrive,
  Keyboard,
  Lock,
  Trash2,
  LogOut,
  FolderKanban,
  FolderTree,
  Target,
  Plus,
  Edit3,
  Sun,
  Moon,
  Eye,
  EyeOff,
  ShieldAlert,
} from 'lucide-react';
import { notificationService, AppNotification } from '../../services/notificationService';
import { db } from '../../services/db';
import { authService } from '../../services/auth';
import { UserProfile, ThemeScheduleConfig } from '../../types';
import { CommandPalette } from './CommandPalette';
import { CalculatorModal } from './CalculatorModal';
import { AuthOverlay } from '../auth/AuthOverlay';
import { PomodoroTimerWidget } from '../pomodoro/PomodoroTimerWidget';
import { OnboardingModal } from '../auth/OnboardingModal';
import { ScratchpadDrawer } from './ScratchpadDrawer';
import { GlobalFocusTimerBar } from '../focus/GlobalFocusTimerBar';
import { FocusSessionModal } from '../focus/FocusSessionModal';

interface DesktopFrameProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
  onShowNotification: (msg: string, title?: string) => void;
}

export const DesktopFrame: React.FC<DesktopFrameProps> = ({
  activeTab,
  setActiveTab,
  children,
  onShowNotification,
}) => {
  const [user, setUser] = useState<UserProfile>(authService.getCurrentUser());
  const [activeExam, setActiveExam] = useState(db.getActiveExam());
  const [isLocked, setIsLocked] = useState<boolean>(authService.isWorkspaceLocked());
  const [showOnboarding, setShowOnboarding] = useState<boolean>(!user.isOnboarded);
  const [zenMode, setZenMode] = useState<boolean>(false);
  const [showScratchpadDrawer, setShowScratchpadDrawer] = useState<boolean>(false);
  const [showThemeScheduler, setShowThemeScheduler] = useState<boolean>(false);
      const [themeSchedule, setThemeSchedule] = useState<ThemeScheduleConfig>(() => {
    return db.getSettings().themeScheduleConfig || { mode: 'auto', nightStartHour: 19, dayStartHour: 7 };
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  const computeThemeMode = (config: ThemeScheduleConfig): boolean => {
    const currentHour = new Date().getHours();
    if (config.mode === 'dark') return true;
    if (config.mode === 'light') return false;
    if (config.mode === 'system') {
      return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    // Auto Schedule: Dark during nightStartHour to dayStartHour
    const night = config.nightStartHour ?? 19;
    const day = config.dayStartHour ?? 7;
    if (night > day) {
      return currentHour >= night || currentHour < day;
    } else {
      return currentHour >= night && currentHour < day;
    }
  };

  useEffect(() => {
    const evaluateTheme = () => {
      const activeDark = computeThemeMode(themeSchedule);
      setIsDarkMode(activeDark);
    };
    evaluateTheme();
    const interval = setInterval(evaluateTheme, 30000); // Re-evaluate every 30s
    return () => clearInterval(interval);
  }, [themeSchedule]);

  // Apply persisted visual theme (Default / Ocean Blue)
  useEffect(() => {
    const applyTheme = () => {
      const th = db.getSettings().theme || 'light';
      document.documentElement.setAttribute('data-theme', th === 'ocean' ? 'ocean' : 'light');
      document.documentElement.classList.toggle('dark', th === 'dark');
      document.documentElement.classList.toggle('theme-ocean', th === 'ocean');
    };
    applyTheme();
    window.addEventListener('studyos_theme_changed', applyTheme);
    window.addEventListener('studyos_db_updated', applyTheme);
    return () => {
      window.removeEventListener('studyos_theme_changed', applyTheme);
      window.removeEventListener('studyos_db_updated', applyTheme);
    };
  }, [])

  useEffect(() => {
    const refresh = () => setNotifItems(notificationService.list());
    refresh();
    window.addEventListener('studyos_notifications_updated', refresh);
    return () => window.removeEventListener('studyos_notifications_updated', refresh);
  }, []);

  const updateThemeConfig = (newConfig: ThemeScheduleConfig) => {
    setThemeSchedule(newConfig);
    const settings = db.getSettings();
    db.setSettings({
      ...settings,
      themeScheduleConfig: newConfig,
    });
    setIsDarkMode(computeThemeMode(newConfig));
  };
  const [showNotifCenter, setShowNotifCenter] = useState(false);
  const [notifItems, setNotifItems] = useState<AppNotification[]>(() => notificationService.list());
  const [showAvatarMenu, setShowAvatarMenu] = useState<boolean>(false);
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [showCalculator, setShowCalculator] = useState<boolean>(false);
  const [showPomodoroModal, setShowPomodoroModal] = useState<boolean>(false);
  const [showFocusSessionModal, setShowFocusSessionModal] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [desktopSettings, setDesktopSettings] = useState(() => db.getSettings());

  useEffect(() => {
    const handleSettingsUpdate = () => {
      const updated = db.getSettings();
      setDesktopSettings(updated);
      if (updated.showStudyBrowser === false && activeTab === 'study-browser') {
        setActiveTab('dashboard');
      }
    };
    window.addEventListener('studyos_settings_updated', handleSettingsUpdate);
    window.addEventListener('studyos_db_updated', handleSettingsUpdate);
    window.addEventListener('storage', handleSettingsUpdate);
    return () => {
      window.removeEventListener('studyos_settings_updated', handleSettingsUpdate);
      window.removeEventListener('studyos_db_updated', handleSettingsUpdate);
      window.removeEventListener('storage', handleSettingsUpdate);
    };
  }, [activeTab, setActiveTab]);

  useEffect(() => {
    const handleExamChange = () => {
      setActiveExam(db.getActiveExam());
    };
    window.addEventListener('studyos_active_exam_changed', handleExamChange);
    window.addEventListener('studyos_exams_updated', handleExamChange);
    return () => {
      window.removeEventListener('studyos_active_exam_changed', handleExamChange);
      window.removeEventListener('studyos_exams_updated', handleExamChange);
    };
  }, []);

  // Clock synchronization
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setCurrentDate(
        now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Global Keydown listener: Escape & Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAvatarMenu(false);
        setShowNotifCenter(false);
        setShowCommandPalette(false);
        setShowCalculator(false);
        setShowPomodoroModal(false);
        setShowScratchpadDrawer(false);
        setShowFocusSessionModal(false);
        setShowThemeScheduler(false);
        window.dispatchEvent(new CustomEvent('studyos_esc_pressed'));
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Inactivity Auto-Lock Detector
  useEffect(() => {
    let lastActivity = Date.now();
    const handleActivity = () => {
      lastActivity = Date.now();
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, handleActivity));

    const checkInterval = setInterval(() => {
      const settings = db.getSettings();
      const lockMins = settings.inactivityAutoLockMins ?? 15;
      if (lockMins > 0 && !isLocked) {
        const idleMs = Date.now() - lastActivity;
        if (idleMs > lockMins * 60 * 1000) {
          authService.lockWorkspace();
          setIsLocked(true);
        }
      }
    }, 10000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      clearInterval(checkInterval);
    };
  }, [isLocked]);

  const [showExamSelector, setShowExamSelector] = useState<boolean>(false);
  const exams = db.getExams();

  const isParentRole = user.role === 'Parent';

  useEffect(() => {
    if (isParentRole && activeTab !== 'parent-progress') {
      setActiveTab('parent-progress');
    }
  }, [isParentRole, activeTab, setActiveTab]);

  // Primary Main Modules
  const primaryModules = isParentRole
    ? [
        {
          id: 'parent-progress',
          label: 'Student Progress',
          icon: BarChart3,
          defaultTab: 'parent-progress',
          matchTabs: ['parent-progress', 'progress'],
          subTabs: [{ id: 'parent-progress', label: 'Progress Metrics', icon: BarChart3 }],
        },
      ]
    : [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          defaultTab: 'dashboard',
          matchTabs: ['dashboard', 'analytics'],
          subTabs: [
            { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp },
          ],
        },
    {
      id: 'study-hub',
      label: 'Study Hub',
      icon: BookOpen,
      defaultTab: 'study-hub',
      matchTabs: ['study-hub', 'study-hub-dashboard', 'practice-tests', 'practice', 'test-series', 'pdf', 'notes', 'scratchpad', 'srs', 'formula', 'files', 'knowledge-graph', 'subjects', 'syllabus', 'content-engine', 'question-bank', 'pyq', 'mock-tests'],
      subTabs: [
        { id: 'study-hub', label: 'Study Hub Overview', icon: BookOpen, badge: 'AI Hub' },
        { id: 'content-engine', label: 'Content Engine & PYQs', icon: Database, badge: 'Repository' },
        { id: 'subjects', label: 'Subject Hierarchy', icon: FolderTree },
        { id: 'notes', label: 'Smart Notes', icon: Brain },
        { id: 'scratchpad', label: 'Scratch Pad Manager', icon: FileEdit, badge: 'Saved' },
        { id: 'formula', label: 'Formula Book', icon: Sparkles },
        { id: 'pdf', label: 'PDF Knowledge Engine', icon: FileText, badge: 'Snip' },
      ],
    },
    {
      id: 'planner-group',
      label: 'Planner',
      icon: Calendar,
      defaultTab: 'planner-hub',
      matchTabs: ['lectures', 'planner-hub', 'planner', 'weekly-planner', 'tasks', 'calendar', 'revision-schedule'],
      subTabs: [
        { id: 'planner-hub', label: 'Planner Hub', icon: Calendar, badge: 'Merged' },
        { id: 'lectures', label: 'Lecture Planner', icon: Clock, badge: db.isGateActive(activeExam?.id) ? 'PW' : undefined },
      ],
    },
    ...(desktopSettings.showStudyBrowser !== false
      ? [
          {
            id: 'study-browser',
            label: 'Study Browser',
            icon: Globe,
            defaultTab: 'study-browser',
            matchTabs: ['study-browser'],
            subTabs: [
              { id: 'study-browser', label: 'Study Browser', icon: Globe, badge: 'Web' },
            ],
          },
        ]
      : []),
  ];

  // Active primary module based on activeTab
  const activePrimaryModule =
    primaryModules.find((mod) =>
      mod.matchTabs.some((tab) => activeTab.startsWith(tab) || activeTab === tab)
    ) || primaryModules[0];

  if (isLocked) {
    return (
      <AuthOverlay
        modeInitial="lock"
        onAuthenticated={(authedUser) => {
          setUser(authedUser);
          setIsLocked(false);
          setShowOnboarding(!authedUser.isOnboarded);
          db.initDB();
          onShowNotification(`Welcome, ${authedUser.fullName}! Workspace active.`, 'StudyOS');
        }}
      />
    );
  }

  return (
    <div className={`h-screen w-screen flex flex-col font-sans select-none overflow-hidden transition-colors duration-500 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#fdf2f8] text-[#1e1b4b]'}`}>
      {/* Floating Exit Zen Mode Button when Zen Mode is Active */}
      {zenMode && (
        <div className="fixed top-4 right-6 z-[100] animate-fadeIn">
          <button
            onClick={() => {
              setZenMode(false);
              onShowNotification('Zen Mode Deactivated: Navigation & Sidebar Restored', 'Zen Mode');
            }}
            className="px-4 py-2 rounded-2xl bg-slate-900/90 text-white border border-purple-500/50 hover:bg-purple-600 shadow-2xl text-xs font-black flex items-center gap-2 cursor-pointer transition-all backdrop-blur-md"
            title="Exit Zen Mode (Restore Sidebar & Header)"
          >
            <Eye className="w-4 h-4 text-purple-400 animate-pulse" />
            <span>Zen Mode Active • Exit</span>
          </button>
        </div>
      )}

      {/* --- TOP NAVIGATION BAR (72px height) - Hidden in Zen Mode --- */}
      {!zenMode && (
        <header className={`h-[72px] px-6 flex items-center justify-between border-b transition-colors duration-300 shrink-0 relative z-40 shadow-xs ${isDarkMode ? 'border-purple-900/50 bg-slate-900/90 text-white' : 'border-pink-100/60 bg-white/80 backdrop-blur-md'}`}>
          {/* Left: Brand Badge & Command Palette Search */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] flex items-center justify-center text-white shadow-md shadow-pink-500/20 font-black text-lg">
                A
              </div>
              <div>
                <div className={`font-black text-base tracking-tight flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  AManager
                </div>
              </div>
            </div>

            {/* Active Exam Workspace Selector */}
            <div className="relative">
              <button
                onClick={() => setShowExamSelector(!showExamSelector)}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-black hover:bg-purple-100 transition-all shadow-xs cursor-pointer"
                title="Switch Exam Workspace"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Award className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="max-w-[130px] truncate">{activeExam?.title || 'GATE 2027'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              </button>

              {showExamSelector && (
                <div className="absolute top-10 left-0 w-72 p-2 rounded-2xl bg-white/95 backdrop-blur-md border border-purple-200 shadow-2xl space-y-1 z-50 animate-fadeIn text-xs">
                  <div className="px-3 py-2 border-b border-purple-100 font-black text-slate-900 flex items-center justify-between">
                    <span className="text-xs text-purple-900">Switch Exam Workspace</span>
                    <button onClick={() => setShowExamSelector(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
                  </div>

                  <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1 py-1">
                    {exams.map((exam) => (
                      <button
                        key={exam.id}
                        onClick={() => {
                          db.setActiveExamId(exam.id);
                          setActiveExam(exam);
                          setShowExamSelector(false);
                          onShowNotification(`Active workspace switched to ${exam.title}`, 'Exam Workspace');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                          exam.id === activeExam?.id
                            ? 'bg-purple-100 text-purple-900 font-extrabold border border-purple-200'
                            : 'hover:bg-purple-50 text-slate-700'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{exam.title}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{exam.category} • Readiness: {exam.readinessPercent}%</div>
                        </div>
                        {exam.id === activeExam?.id && (
                          <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 ml-2" />
                        )}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setShowExamSelector(false);
                      setActiveTab('exam-manager');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 font-extrabold flex items-center gap-2 border border-purple-200 transition-all text-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-purple-600" /> + Manage or Add Exam Workspace
                  </button>
                </div>
              )}
            </div>

            {/* Global Search Bar */}
            <button
              onClick={() => setShowCommandPalette(true)}
              className="hidden sm:flex items-center space-x-3 px-4 py-2 rounded-2xl bg-[#F8F9FC] border border-[#ECECF5] text-slate-400 text-xs hover:border-purple-300 hover:bg-purple-50/50 transition-all w-64 lg:w-96 shadow-xs group"
            >
              <Search className="w-4 h-4 text-purple-600 shrink-0 group-hover:scale-110 transition-transform" />
              <span className="flex-1 text-left font-medium text-slate-500 truncate">Search modules, syllabus, lectures, PYQs...</span>
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 rounded bg-white text-[10px] font-mono font-bold text-slate-500 border border-slate-200 shadow-2xs">
                Ctrl K
              </kbd>
            </button>
            <button
              onClick={() => setShowCommandPalette(true)}
              className="flex sm:hidden items-center justify-center p-2.5 rounded-2xl bg-[#F8F9FC] border border-[#ECECF5] text-purple-600 hover:border-purple-300 hover:bg-purple-50/50 transition-all shadow-xs"
              title="Search (Ctrl K)"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Right Tools: Scratchpad, Theme, Focus Mode, Pomodoro, Notifications, Clock, Profile */}
          <div className="flex items-center space-x-2.5">
            {/* Scratchpad Drawer Button */}
            <button
              onClick={() => setShowScratchpadDrawer(true)}
              className="p-2 rounded-2xl bg-white border border-[#ECECF5] text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-all flex items-center space-x-1.5 text-xs font-bold cursor-pointer"
              title="Open Session Scratchpad"
            >
              <Edit3 className="w-4 h-4 text-purple-600" />
              <span className="hidden md:inline">Scratchpad</span>
            </button>

            {/* Theme Scheduler Toggle */}
            <div className="relative">
              <button
                onClick={() => setShowThemeScheduler(!showThemeScheduler)}
                className={`p-2 rounded-2xl border transition-all flex items-center space-x-1 text-xs font-bold cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-900 text-amber-300 border-purple-500/50'
                    : 'bg-white border-[#ECECF5] text-slate-700 hover:bg-amber-50 hover:text-amber-700'
                }`}
                title="Theme Scheduler Settings"
              >
                {isDarkMode ? <Moon className="w-4 h-4 text-amber-300" /> : <Sun className="w-4 h-4 text-amber-500" />}
              </button>

              {showThemeScheduler && (
                <div className="absolute top-11 right-0 w-72 p-3 rounded-2xl bg-white/95 backdrop-blur-md border border-purple-200 shadow-2xl space-y-2 z-50 animate-fadeIn text-xs text-slate-800">
                  <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                    <span className="font-black text-slate-900 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-purple-600" /> Theme Schedule Mode
                    </span>
                    <button onClick={() => setShowThemeScheduler(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      onClick={() => updateThemeConfig({ ...themeSchedule, mode: 'auto' })}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        themeSchedule.mode === 'auto'
                          ? 'bg-purple-100 text-purple-900 font-black border-purple-300'
                          : 'bg-slate-50 border-slate-200 hover:bg-purple-50'
                      }`}
                    >
                      <div className="font-extrabold text-[11px]">Auto Schedule</div>
                      <div className="text-[9px] text-slate-500">Night {themeSchedule.nightStartHour}:00 - Day {themeSchedule.dayStartHour}:00</div>
                    </button>

                    <button
                      onClick={() => updateThemeConfig({ ...themeSchedule, mode: 'light' })}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        themeSchedule.mode === 'light'
                          ? 'bg-purple-100 text-purple-900 font-black border-purple-300'
                          : 'bg-slate-50 border-slate-200 hover:bg-purple-50'
                      }`}
                    >
                      <div className="font-extrabold text-[11px]">Always Light</div>
                      <div className="text-[9px] text-slate-500">Daytime glass</div>
                    </button>

                    <button
                      onClick={() => updateThemeConfig({ ...themeSchedule, mode: 'dark' })}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        themeSchedule.mode === 'dark'
                          ? 'bg-purple-100 text-purple-900 font-black border-purple-300'
                          : 'bg-slate-50 border-slate-200 hover:bg-purple-50'
                      }`}
                    >
                      <div className="font-extrabold text-[11px]">Always Dark</div>
                      <div className="text-[9px] text-slate-500">Night canvas</div>
                    </button>

                    <button
                      onClick={() => updateThemeConfig({ ...themeSchedule, mode: 'system' })}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        themeSchedule.mode === 'system'
                          ? 'bg-purple-100 text-purple-900 font-black border-purple-300'
                          : 'bg-slate-50 border-slate-200 hover:bg-purple-50'
                      }`}
                    >
                      <div className="font-extrabold text-[11px]">System Match</div>
                      <div className="text-[9px] text-slate-500">OS preference</div>
                    </button>
                  </div>

                  {/* Custom Hours Config */}
                  <div className="pt-2 border-t border-purple-100 space-y-1 text-[11px]">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Auto Schedule Hours (24h)</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[9px] text-slate-500 block">Night Start (24h)</label>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={themeSchedule.nightStartHour}
                          onChange={(e) => updateThemeConfig({ ...themeSchedule, nightStartHour: parseInt(e.target.value) || 19 })}
                          className="w-full px-2 py-1 rounded-lg border border-purple-200 text-xs font-bold bg-slate-50 text-slate-900"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] text-slate-500 block">Day Start (24h)</label>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={themeSchedule.dayStartHour}
                          onChange={(e) => updateThemeConfig({ ...themeSchedule, dayStartHour: parseInt(e.target.value) || 7 })}
                          className="w-full px-2 py-1 rounded-lg border border-purple-200 text-xs font-bold bg-slate-50 text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Zen Mode Toggle */}
            <button
              onClick={() => {
                setZenMode(true);
                onShowNotification('Zen Mode Activated: Distraction-Free Full-Screen Study', 'Zen Mode');
              }}
              className="p-2 rounded-2xl bg-white border border-[#ECECF5] text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-all flex items-center space-x-1.5 text-xs font-bold cursor-pointer"
              title="Activate Zen Mode (Hide Sidebar & Header)"
            >
              <EyeOff className="w-4 h-4 text-purple-600" />
              <span className="hidden sm:inline">Zen Mode</span>
            </button>

            {/* Pomodoro Timer Modal Trigger */}
            <button
              onClick={() => setShowPomodoroModal(!showPomodoroModal)}
              className="p-2 rounded-2xl bg-white border border-[#ECECF5] text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-all flex items-center space-x-1.5 text-xs font-bold cursor-pointer"
              title="Pomodoro Study Timer"
            >
              <Flame className="w-4 h-4 text-purple-600" />
              <span className="hidden md:inline">Pomodoro</span>
            </button>

            {/* Clock & Date */}
            <div className="hidden xl:flex flex-col text-right pl-2 border-l border-slate-200">
              <span className={`font-mono text-xs font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{currentTime}</span>
              <span className="text-[10px] text-slate-400 font-medium">{currentDate}</span>
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => setShowNotifCenter((v) => !v)}
              className="p-2 rounded-2xl bg-white border border-[#ECECF5] text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition-all relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {notifItems.filter((n) => !n.read).length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white">
                  {notifItems.filter((n) => !n.read).length}
                </span>
              )}
            </button>

            {/* Header Avatar Trigger */}
            <button
              onClick={() => setShowAvatarMenu(!showAvatarMenu)}
              className="flex items-center space-x-2 pl-2 border-l border-slate-200 group cursor-pointer"
              title="Open Account Menu"
            >
              <div className="relative">
                <img
                  src={user.avatarUrl}
                  alt={user.fullName}
                  className="w-9 h-9 rounded-full object-cover border-2 border-purple-500 group-hover:ring-2 group-hover:ring-purple-600/30 transition-all shadow-xs"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
              </div>
            </button>
          </div>
        </header>
      )}

      {/* Persistent Global Focus Timer Bar */}
      <GlobalFocusTimerBar onOpenFullModal={() => setShowFocusSessionModal(true)} />

      {/* --- DESKTOP BODY: REFACTORED CLEAN SIDEBAR + WORKSPACE --- */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* REFACTORED SIDEBAR (240px width, Flat Primary Modules Only) - Hidden in Zen Mode */}
        {!zenMode && (
          <aside
            className={`w-[240px] border-r border-[#ECECF5] ${isDarkMode ? 'bg-slate-900/90 border-purple-900/40 text-slate-100' : 'bg-white'} flex flex-col shrink-0 transition-all duration-300 z-20 relative`}
          >
            <div className="flex-1 p-2 space-y-1.5 overflow-y-auto custom-scrollbar">
              {primaryModules.map((mod) => {
                const ModIcon = mod.icon;
                const isSelected = activePrimaryModule?.id === mod.id;

                return (
                  <button
                    key={mod.id}
                    onClick={() => setActiveTab(mod.defaultTab)}
                    className={`w-full flex items-center justify-start px-3 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] text-white shadow-md shadow-pink-500/20'
                        : 'text-slate-700 hover:bg-purple-50 hover:text-purple-700'
                    }`}
                  >
                    <ModIcon
                      className={`w-5 h-5 shrink-0 ${isSelected ? 'text-white' : 'text-purple-600'}`}
                    />
                    <span className="ml-2.5 font-extrabold">{mod.label}</span>
                  </button>
                );
              })}
            </div>

          {/* BOTTOM-LEFT SIDEBAR PROFILE AVATAR ENTRY POINT */}
          <div className="p-2 border-t border-[#ECECF5] bg-slate-50/80 relative">
            {/* Popover Menu Triggered by Profile Avatar */}
            {showAvatarMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowAvatarMenu(false)}
                />
                <div className="absolute bottom-16 left-2 w-64 p-2 rounded-2xl bg-white/95 backdrop-blur-md border border-purple-200 shadow-2xl space-y-1 animate-fadeIn z-50 text-xs">
                <div className="px-3 py-2 border-b border-purple-100 font-black text-slate-900 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">{user.fullName}</div>
                    <div className="text-[10px] text-purple-700 font-extrabold uppercase tracking-wider">
                      Role: {user.role || 'Administrator'}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAvatarMenu(false)}
                    className="text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✕
                  </button>
                </div>

                <button
                  onClick={() => {
                    setShowAvatarMenu(false);
                    setActiveTab('settings');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-purple-50 text-slate-700 font-bold flex items-center gap-2 transition-all"
                >
                  <User className="w-4 h-4 text-purple-600" /> Account Profile
                </button>

                <button
                  onClick={() => {
                    setShowAvatarMenu(false);
                    setActiveTab('exam-manager');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-purple-50 text-slate-700 font-bold flex items-center gap-2 transition-all"
                >
                  <Award className="w-4 h-4 text-purple-600" /> Exam Manager & Workspaces
                </button>

                {user.role === 'Student' && (
                  <button
                    onClick={() => {
                      setShowAvatarMenu(false);
                      setActiveTab('settings');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-purple-50 text-slate-700 font-bold flex items-center gap-2 transition-all"
                  >
                    <Settings className="w-4 h-4 text-purple-600" /> Settings Hub
                  </button>
                )}

                {/* Account Switcher Options */}
                <div className="py-1 border-t border-purple-100">
                  <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Switch Offline Account
                  </div>
                  {authService.getAccounts().map((acc) => (
                    <button
                      key={acc.accountId}
                      onClick={() => {
                        authService.switchAccount(acc.accountId);
                        setUser(authService.getCurrentUser());
                        setShowAvatarMenu(false);
                        db.initDB();
                        onShowNotification(`Switched to account @${acc.username}`, 'Multi-Account');
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center justify-between transition-all ${
                        acc.accountId === user.accountId
                          ? 'bg-purple-100 text-purple-800 font-bold'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span className="truncate">@{acc.username} ({acc.role || 'Admin'})</span>
                      {acc.accountId === user.accountId && <span className="text-[10px] text-emerald-600 font-black">Active</span>}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setShowAvatarMenu(false);
                    authService.lockWorkspace();
                    setIsLocked(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-amber-50 text-amber-800 font-bold flex items-center gap-2 transition-all border-t border-purple-100 pt-2"
                >
                  <Lock className="w-4 h-4 text-amber-600" /> Lock App (PIN/Pass)
                </button>

                <button
                  onClick={() => {
                    setShowAvatarMenu(false);
                    authService.logout();
                    setIsLocked(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-700 font-bold flex items-center gap-2 transition-all"
                >
                  <LogOut className="w-4 h-4 text-rose-600" /> Logout Account
                </button>
              </div>
              </>
            )}

            <button
              onClick={() => {
                setShowAvatarMenu((prev) => !prev);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setShowAvatarMenu((prev) => !prev);
              }}
              className="w-full text-left p-2 rounded-2xl bg-white border border-[#ECECF5] hover:border-purple-300 hover:shadow-xs transition-all flex items-center space-x-2.5 group cursor-pointer"
              title="Profile menu — Settings, Exam Manager, Lock"
            >
              <div className="relative shrink-0">
                <img
                  src={user.avatarUrl}
                  alt={user.fullName}
                  className="w-8 h-8 rounded-full object-cover border-2 border-purple-500"
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-xs font-extrabold text-slate-900 truncate group-hover:text-purple-700">
                  {user.fullName}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold mt-0.5">
                  <span className="text-amber-600 flex items-center gap-0.5">
                    <Flame className="w-3 h-3 text-amber-500" /> {user.streakDays}d Streak
                  </span>
                  <span className="text-emerald-600 font-semibold">Online</span>
                </div>
              </div>
            </button>
          </div>
        </aside>
        )}

        {/* MAIN WORKSPACE STAGE */}
        <main className="flex-1 flex flex-col overflow-hidden relative bg-[#F8F9FC]">
          {/* Dashboard top navbar: Overview | Analytics — sole Analytics entry point */}
          {!zenMode && activePrimaryModule?.id === 'dashboard' && (
              <div
                className={`h-11 px-4 flex items-center gap-1.5 border-b shrink-0 z-20 ${
                  isDarkMode
                    ? 'border-purple-900/40 bg-slate-900/80'
                    : 'border-pink-100/60 bg-white/90 backdrop-blur-sm'
                }`}
              >
                {(activePrimaryModule.subTabs || []).map((tab) => {
                  const TabIcon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] text-white shadow-sm shadow-pink-500/20'
                          : isDarkMode
                          ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          : 'text-slate-600 hover:bg-purple-50 hover:text-purple-700'
                      }`}
                      title={tab.label}
                    >
                      <TabIcon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-purple-600'}`} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

          {/* Floating Pomodoro Widget Overlay */}
          {showPomodoroModal && (
            <div className="absolute top-4 right-6 z-40 w-80 shadow-2xl animate-fadeIn">
              <PomodoroTimerWidget
                activeTab={activeTab}
                onSessionComplete={(msg, mins) => {
                  onShowNotification(`${msg} (+${mins} mins logged)`, 'Pomodoro Study Engine');
                }}
              />
            </div>
          )}

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
            {children}
          </div>
        </main>
      </div>

      {/* --- AUXILIARY MODALS & DRAWERS --- */}
      
      

      
      {showNotifCenter && (
        <>
          <div
            className="fixed inset-0 z-[215]"
            onClick={() => setShowNotifCenter(false)}
          />
          <div className="fixed top-16 right-4 z-[220] w-96 max-h-[70vh] flex flex-col rounded-2xl bg-white border border-slate-200 shadow-2xl animate-fadeIn">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="text-sm font-black text-slate-900">Notifications</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-[10px] font-bold text-teal-700 cursor-pointer"
                onClick={() => {
                  notificationService.markAllRead();
                  setNotifItems(notificationService.list());
                }}
              >
                Read all
              </button>
              <button
                type="button"
                className="text-[10px] font-bold text-rose-600 cursor-pointer"
                onClick={() => {
                  notificationService.clearAll();
                  setNotifItems([]);
                }}
              >
                Clear all
              </button>
              <button type="button" className="text-slate-400 font-bold cursor-pointer" onClick={() => setShowNotifCenter(false)}>✕</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {notifItems.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No notifications</p>
            ) : (
              notifItems.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    notificationService.markRead(n.id);
                    setNotifItems(notificationService.list());
                    if (n.actionTab) setActiveTab(n.actionTab);
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    n.read ? 'bg-white border-slate-100' : 'bg-teal-50/80 border-teal-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-black text-slate-900">{n.title}</div>
                    <span className="text-[9px] text-slate-400 font-mono shrink-0">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">{n.message}</p>
                  <span className="text-[9px] font-bold uppercase text-slate-400">{n.category}</span>
                </button>
              ))
            )}
          </div>
        </div>
        </>
      )}

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={(tab) => {
          if (tab === 'settings-exam-manager' || tab === 'exam-manager') {
            setActiveTab('exam-manager');
            return;
          }
          if (tab === 'settings' || tab.startsWith('settings-')) {
            setActiveTab(tab === 'settings' ? 'settings' : tab);
            return;
          }
          setActiveTab(tab);
        }}
        onToggleFocusMode={() => setZenMode(!zenMode)}
        onLockWorkspace={() => {
          authService.lockWorkspace();
          setIsLocked(true);
        }}
        onExportBackup={() => {
          const dump = db.exportDatabaseJSON();
          const blob = new Blob([dump], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `StudyOS_Backup_${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          onShowNotification('Offline Database Export Downloaded', 'Backup');
        }}
      />

      <CalculatorModal
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
      />

      {(showOnboarding || !user.isOnboarded) && (
        <OnboardingModal
          onComplete={() => {
            setShowOnboarding(false);
            setUser(authService.getCurrentUser());
          }}
          onShowNotification={onShowNotification}
        />
      )}

      <ScratchpadDrawer
        isOpen={showScratchpadDrawer}
        onClose={() => setShowScratchpadDrawer(false)}
        activeExamTitle={activeExam?.title}
        onShowNotification={onShowNotification}
      />

      <FocusSessionModal
        isOpen={showFocusSessionModal}
        onClose={() => setShowFocusSessionModal(false)}
      />

      <GlobalFocusTimerBar
        onOpenLauncher={() => setShowFocusSessionModal(true)}
      />
    </div>
  );
};

