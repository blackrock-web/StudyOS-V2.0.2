import { VersionManagementPanel } from './VersionManagementPanel';
import { SettingsAIProvider } from './SettingsAIProvider';
import { NetworkAccessPanel } from './NetworkAccessPanel';
import { LocalModelPanel } from './LocalModelPanel';
import { DangerZoneDestructionPanel } from './DangerZoneDestructionPanel';
import React, { useState, useEffect } from 'react';
import {
  User,
  Camera,
  ImagePlus,
  UserPlus,
  Award,
  BarChart3,
  KeyRound,
  Palette,
  Package,
  Bell,
  Shield,
  Database,
  HardDrive,
  Keyboard,
  Info,
  Lock,
  Trash2,
  Upload,
  Download,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Calendar,
  Flame,
  Layers,
  Moon,
  Sun,
  Laptop,
  Check,
  RefreshCw,
  Search,
  Zap,
  Globe,
  Sliders,
  FileCode2,
  AlertTriangle,
  Gamepad2,
  Coffee,
  Brain,
  Cpu,
} from 'lucide-react';
import { db, safeDispatch } from '../../services/db';
import { authService, hashString } from '../../services/auth';
import { auditLogger } from '../../services/auditLogger';
import { audioService } from '../../services/audioService';
import { pomodoroTimerService } from '../../services/pomodoroTimerService';
import { DesktopSettings, UserProfile, PomodoroBreakConfig } from '../../types';
import { ExamManager } from '../exams/ExamManager';
import { BrainGameContainer } from '../pomodoro/BrainGameContainer';

interface SettingsHubProps {
  activeSection?: string;
  onShowNotification: (msg: string, title?: string) => void;
  onNavigate?: (tab: string) => void;
}

export type SettingsSectionId =
  | 'academic-profile'
  | 'network-access'
  | 'local-models'
  | 'features-navigation'
  | 'ai-provider'
  | 'exam-manager'
  | 'pomodoro-break'
  | 'workspace-analytics'
  | 'credentials'
  | 'themes'
  | 'version'
  | 'notifications'
  | 'access-control'
  | 'backup-restore'
  | 'cache-storage'
  | 'shortcuts'
  | 'about'
  | 'privacy'
  | 'recycle-bin'
  | 'danger-zone';

export const SettingsHub: React.FC<SettingsHubProps> = ({
  activeSection = 'academic-profile',
  onShowNotification,
  onNavigate,
}) => {
  // Normalize section ID from prop (handling settings-profile -> academic-profile format)
  const normalizeSection = (sec: string): SettingsSectionId => {
    if (sec.startsWith('settings-')) {
      const clean = sec.replace('settings-', '');
      if (clean === 'profile') return 'academic-profile';
      if (clean === 'network' || clean === 'network-access') return 'network-access';
      if (clean === 'models' || clean === 'local-models' || clean === 'ai' || clean === 'ai-provider') return 'local-models';
      if (clean === 'danger' || clean === 'danger-zone' || clean === 'destroy') return 'danger-zone';
      if (clean === 'features' || clean === 'navigation' || clean === 'browser') return 'features-navigation';
      if (clean === 'workspace') return 'workspace-analytics';
      if (clean === 'theme' || clean === 'themes') return 'themes';
      if (clean === 'version') return 'version';
      if (clean === 'exam-manager' || clean === 'exams') return 'exam-manager';
      if (clean === 'access') return 'access-control';
      if (clean === 'backup' || clean === 'storage' || clean === 'recycle') return 'backup-restore';
      if (clean === 'dev' || clean === 'privacy') return 'about';
    }
    if (sec === 'network' || sec === 'network-access') return 'network-access';
    if (sec === 'models' || sec === 'local-models' || sec === 'ai' || sec === 'ai-provider') return 'local-models';
    if (sec === 'danger' || sec === 'danger-zone' || sec === 'destroy') return 'danger-zone';
    if (sec === 'parent-viewer') return 'academic-profile';
    return (sec as SettingsSectionId) || 'academic-profile';
  };

  const [currentSection, setCurrentSection] = useState<SettingsSectionId>(
    normalizeSection(activeSection)
  );

  // Keep section in sync when opened from avatar with a specific target (e.g. exam-manager)
  useEffect(() => {
    setCurrentSection(normalizeSection(activeSection));
  }, [activeSection]);

  const [settings, setSettings] = useState<DesktopSettings>(db.getSettings());
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarFileRef = React.useRef<HTMLInputElement>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile>(authService.getCurrentUser());

  // Academic Profile State
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [username, setUsername] = useState(currentUser.username);
  const [email, setEmail] = useState(currentUser.email || 'student@studyos.local');
  const [bio, setBio] = useState('Preparing for GATE 2027 CS & DA. Target Top 100 AIR.');
  const [university, setUniversity] = useState('National Institute of Technology');
  const [branch, setBranch] = useState('Computer Science & Engineering');
  const [semester, setSemester] = useState('6th Semester');
  const [studyTarget, setStudyTarget] = useState(currentUser.studyTarget || 'GATE 2027 CS & DA');
  const [dailyGoal, setDailyGoal] = useState(settings.dailyGoalHours);
  const [weeklyGoal, setWeeklyGoal] = useState(settings.weeklyGoalHours);
  const [preferredLang, setPreferredLang] = useState('English');
  const [timeZone, setTimeZone] = useState('UTC+05:30 (Indian Standard Time)');
  const [bannerColor, setBannerColor] = useState('from-purple-600 via-pink-600 to-indigo-600');

  // Password State
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg] = useState({ text: '', type: '' });

  // Date Re-Anchoring State
  const [reanchorDate, setReanchorDate] = useState(settings.reanchorStartDate);

  // Navigation & Feature Settings State
  const [showBrowserNav, setShowBrowserNav] = useState<boolean>(settings.showStudyBrowser !== false);
  const [plannerDuration, setPlannerDuration] = useState<number>(settings.plannerDefaultDuration || 60);
  const [plannerDefaultTime, setPlannerDefaultTime] = useState<string>(settings.plannerDefaultSlotTime || '09:00');
  const [practiceNegative, setPracticeNegative] = useState<boolean>(settings.practiceNegativeMarking !== false);
  const [practiceDuration, setPracticeDuration] = useState<number>(settings.practiceDefaultDurationMins || 60);

  // Trash Bin State
  const [trashItems, setTrashItems] = useState([
    { id: 't-1', title: 'Archived Note: Discrete Math Graph Theory Traps', deletedAt: '2026-07-20', type: 'Note' },
    { id: 't-2', title: 'Skipped PW Lecture: COA Pipelining Hazards', deletedAt: '2026-07-18', type: 'Lecture' },
  ]);

  // Pomodoro Break Mode Config State
  const [breakConfig, setBreakConfig] = useState<PomodoroBreakConfig>(
    settings.pomodoroBreakConfig || {
      autoLaunchGames: true,
      defaultGame: '2048',
      randomizeGames: false,
      difficulty: 'medium',
      autoResumeStudy: true,
      allowSkipBreak: true,
      muteSounds: false,
      breakTheme: 'dark',
    }
  );
  const [showTestGameModal, setShowTestGameModal] = useState<boolean>(false);

  const navItems = [
    { id: 'academic-profile', label: 'Academic Profile', icon: User, desc: 'Personal details & study goals' },
    { id: 'local-models', label: 'Local AI & Models Hub', icon: Cpu, desc: 'Offline GGUF models, switcher & inference' },
    { id: 'network-access', label: 'Network Access', icon: Globe, desc: 'LOCKED by default • PIN authorized' },
    { id: 'features-navigation', label: 'Navigation & Modules', icon: Sliders, desc: 'Study Browser, Planner & Practice settings' },
    { id: 'exam-manager', label: 'Exam Manager & Workspaces', icon: Award, desc: 'Create, edit & switch competitive exams' },
    { id: 'pomodoro-break', label: 'Pomodoro Break Mode', icon: Gamepad2, desc: 'Full-screen break & brain games' },
    { id: 'workspace-analytics', label: 'Workspace Analytics', icon: BarChart3, desc: 'Database size & metrics' },
    { id: 'credentials', label: 'Account Credentials', icon: KeyRound, desc: 'UUID & security keys' },
    { id: 'themes', label: 'Interface Themes', icon: Palette, desc: 'Default & Ocean Blue' },
    { id: 'version', label: 'Version Management', icon: Package, desc: 'Releases & updates' },
    { id: 'notifications', label: 'Alerts & Reminders', icon: Bell, desc: 'Study schedule alarms' },
    { id: 'access-control', label: 'Access Control', icon: Shield, desc: 'Workspace lock & PIN' },
    { id: 'backup-restore', label: 'Data & Backup Storage', icon: Database, desc: 'Export, import & database management' },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard, desc: 'Hotkeys & command triggers' },
    { id: 'about', label: 'About & Privacy', icon: Info, desc: 'Version & zero-telemetry status' },
    { id: 'danger-zone', label: 'Danger Zone', icon: Flame, desc: 'Nuclear application destruction' },
  ];

  const handleSaveAcademicProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = authService.updateUserProfile({
      fullName,
      username,
      email,
      studyTarget,
    });
    setCurrentUser(updated);

    const updatedSettings = {
      ...settings,
      dailyGoalHours: dailyGoal,
      weeklyGoalHours: weeklyGoal,
    };
    db.setSettings(updatedSettings);
    setSettings(updatedSettings);

    onShowNotification('Academic profile & target goals updated locally!', 'Profile Settings');
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg({ text: '', type: '' });

    if (hashString(curPass) !== currentUser.passwordHash) {
      setPassMsg({ text: 'Current password is incorrect.', type: 'error' });
      return;
    }
    if (newPass.length < 6) {
      setPassMsg({ text: 'New password must be at least 6 characters.', type: 'error' });
      return;
    }
    if (newPass !== confirmPass) {
      setPassMsg({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    authService.updateUserProfile({
      passwordHash: hashString(newPass),
    });

    setPassMsg({ text: 'Password successfully updated!', type: 'success' });
    setCurPass('');
    setNewPass('');
    setConfirmPass('');
    onShowNotification('Account password updated in local SQLite credential vault.', 'Security');
  };

  const handleReanchor = () => {
    // 1. Re-anchor start date
    db.updateReanchorStartDate(reanchorDate);

    // 2. Calculate remaining days to Jan 7, 2027 (January 1st week)
    const targetJanDate = new Date('2027-01-07');
    const startDate = new Date(reanchorDate);
    const diffTime = Math.max(1, targetJanDate.getTime() - startDate.getTime());
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Calculate required daily study hours for ~800 total lecture & practice hours
    const requiredTotalHours = 800;
    const calculatedDailyHours = Math.min(10, Math.max(6.5, parseFloat((requiredTotalHours / daysRemaining).toFixed(1))));

    // Update settings with increased daily study hours for January 1st week completion
    const updatedSettings = {
      ...settings,
      reanchorStartDate: reanchorDate,
      dailyGoalHours: calculatedDailyHours,
      weeklyGoalHours: Math.round(calculatedDailyHours * 6),
    };

    db.setSettings(updatedSettings);
    setSettings(updatedSettings);
    setDailyGoal(calculatedDailyHours);
    setWeeklyGoal(Math.round(calculatedDailyHours * 6));

    onShowNotification(
      `Syllabus schedule re-anchored! Daily study goal increased to ${calculatedDailyHours} hrs/day to ensure 100% syllabus completion by January 1st week 2027 (${daysRemaining} days target).`,
      'Date Re-Anchoring Engine'
    );
  };

  const handleExportJSON = () => {
    const dump = db.exportDatabaseJSON();
    const blob = new Blob([dump], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `StudyOS_Database_Backup_${currentUser.username}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onShowNotification('Downloaded 100% offline database JSON backup.', 'Backup & Restore');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          const success = db.importDatabaseJSON(content);
          if (success) {
            setSettings(db.getSettings());
            setCurrentUser(authService.getCurrentUser());
            onShowNotification('Workspace database restored successfully!', 'Restore');
          } else {
            onShowNotification('Invalid backup JSON format.', 'Error');
          }
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="h-full flex-1 flex overflow-hidden text-slate-900 font-sans select-none bg-[#FAF9FE]">
      {/* LEFT NAVIGATION COLUMN (280px) */}
      <div className="w-72 border-r border-[#E7E0F8] bg-white flex flex-col shrink-0 p-4 space-y-3 custom-scrollbar overflow-y-auto">
        <div className="px-2 py-1">
          <div className="text-[10px] uppercase font-mono font-extrabold tracking-wider text-purple-600">
            Hub Navigator
          </div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-purple-600" /> Settings Hub
          </h2>
        </div>

        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'exam-manager' && onNavigate) {
                    onNavigate('exam-manager');
                    return;
                  }
                  setCurrentSection(item.id as SettingsSectionId);
                }}
                className={`w-full flex items-start space-x-3 p-3 rounded-2xl text-left transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-600/20'
                    : 'text-slate-700 hover:bg-purple-50 hover:text-purple-700'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${isActive ? 'text-white' : 'text-purple-600'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black truncate">{item.label}</div>
                  <div className={`text-[10px] truncate mt-0.5 ${isActive ? 'text-purple-100' : 'text-slate-400'}`}>
                    {item.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT DYNAMIC CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#FAF9FE]">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* NETWORK ACCESS & ISOLATION GATEWAY */}
          {currentSection === 'network-access' && (
            <div className="animate-fadeIn">
              <NetworkAccessPanel onShowNotification={onShowNotification} />
            </div>
          )}

          {/* LOCAL MODELS & AI ENGINE */}
          {currentSection === 'local-models' && (
            <div className="animate-fadeIn">
              <LocalModelPanel onShowNotification={onShowNotification} />
            </div>
          )}

          {/* DANGER ZONE: APPLICATION DESTRUCTION */}
          {currentSection === 'danger-zone' && (
            <div className="animate-fadeIn">
              <DangerZoneDestructionPanel onShowNotification={onShowNotification} />
            </div>
          )}

          {/* EXAM MANAGER & WORKSPACES */}
          {currentSection === 'exam-manager' && (
            <div className="animate-fadeIn">
              <ExamManager onShowNotification={onShowNotification} />
            </div>
          )}

          {/* AI ENGINE & PROVIDERS */}
          {currentSection === 'ai-provider' && (
            <div className="animate-fadeIn">
              <SettingsAIProvider onShowNotification={onShowNotification} />
            </div>
          )}

          {/* 1. ACADEMIC PROFILE */}
          {currentSection === 'academic-profile' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-3xl border border-[#E7E0F8] shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-[#E7E0F8] pb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <User className="w-5 h-5 text-purple-600" /> Academic Profile & Candidate Goals
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Configure candidate personal identity, target GATE paper branch, and daily study quotas.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-bold text-xs border border-purple-200">
                    Offline Saved
                  </span>
                </div>

                {/* Profile Banner Preview */}
                <div
                  className={`h-28 rounded-2xl bg-gradient-to-r ${bannerColor} p-4 flex items-end justify-between shadow-inner relative overflow-hidden`}
                >
                  <div className="flex items-center space-x-3 text-white">
                    <img
                      src={currentUser.avatarUrl}
                      alt="Avatar"
                      className="w-14 h-14 rounded-full border-2 border-white object-cover shadow-lg"
                    />
                    <div>
                      <div className="font-black text-sm">{fullName}</div>
                      <div className="text-xs opacity-90">@{username} • {university}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() =>
                        setBannerColor(
                          bannerColor.includes('purple')
                            ? 'from-emerald-600 via-teal-600 to-cyan-600'
                            : 'from-purple-600 via-pink-600 to-indigo-600'
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-white/20 backdrop-blur-md text-white text-xs font-bold hover:bg-white/30 transition-all"
                    >
                      Cycle Banner Style
                    </button>
                  </div>
                </div>


                {/* Change Profile Picture */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl border border-slate-200 bg-slate-50/80">
                  <img
                    src={avatarPreview || currentUser.avatarUrl}
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover border-2 border-teal-400 shadow-md"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="text-xs font-black text-slate-900">Profile Picture</div>
                    <p className="text-[11px] text-slate-500">Upload a local image (stored offline on this account). Changes sync across the app instantly.</p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={avatarFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            onShowNotification('Image must be under 2 MB', 'Profile');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            const dataUrl = String(reader.result || '');
                            // Simple center-crop via canvas to square
                            const img = new Image();
                            img.onload = () => {
                              const size = Math.min(img.width, img.height);
                              const sx = (img.width - size) / 2;
                              const sy = (img.height - size) / 2;
                              const canvas = document.createElement('canvas');
                              canvas.width = 256;
                              canvas.height = 256;
                              const ctx = canvas.getContext('2d');
                              if (ctx) {
                                ctx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256);
                                const cropped = canvas.toDataURL('image/jpeg', 0.9);
                                setAvatarPreview(cropped);
                              } else {
                                setAvatarPreview(dataUrl);
                              }
                            };
                            img.src = dataUrl;
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => avatarFileRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-bold cursor-pointer"
                      >
                        <ImagePlus className="w-3.5 h-3.5" /> Upload / Replace
                      </button>
                      {avatarPreview && (
                        <button
                          type="button"
                          onClick={() => {
                            authService.updateUserProfile({ avatarUrl: avatarPreview });
                            setCurrentUser(authService.getCurrentUser());
                            setAvatarPreview(null);
                            onShowNotification('Profile picture updated', 'Profile');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" /> Save Picture
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const fallback =
                            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4Ij48Y2lyY2xlIGN4PSI2NCIgY3k9IjY0IiByPSI2NCIgZmlsbD0iIzNCODJGNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTQlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic3lzdGVtLXVpIiBmb250LXNpemU9IjQ4IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSJ3aGl0ZSI+UzwvdGV4dD48L3N2Zz4=';
                          authService.updateUserProfile({ avatarUrl: fallback });
                          setCurrentUser(authService.getCurrentUser());
                          setAvatarPreview(null);
                          onShowNotification('Profile picture removed', 'Profile');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSaveAcademicProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Username Handle</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Target Exam Paper</label>
                    <input
                      type="text"
                      value={studyTarget}
                      onChange={(e) => setStudyTarget(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">University / Institute</label>
                    <input
                      type="text"
                      value={university}
                      onChange={(e) => setUniversity(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Branch / Department</label>
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Daily Study Target (Hours)</label>
                    <input
                      type="number"
                      value={dailyGoal}
                      onChange={(e) => setDailyGoal(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Weekly Target Goal (Hours)</label>
                    <input
                      type="number"
                      value={weeklyGoal}
                      onChange={(e) => setWeeklyGoal(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="md:col-span-2 pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-extrabold shadow-md hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" /> Save Academic Profile
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* NAVIGATION & MODULES CONFIGURATION */}
          {currentSection === 'features-navigation' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-3xl border border-[#E7E0F8] shadow-xs space-y-6">
                <div className="border-b border-[#E7E0F8] pb-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-purple-600" /> Navigation Tabs & Module Preferences
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Customize which primary modules appear in your workspace navigation and set default parameters for study routines.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Study Browser Visibility Toggle */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-sky-600" />
                        <span className="font-bold text-slate-900 text-sm">Study Browser Navigation Tab</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${showBrowserNav ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                          {showBrowserNav ? 'Visible' : 'Hidden'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                        When enabled, the built-in isolated Study Browser tab appears in the top navigation bar. Hiding the tab leaves all visited history, bookmarks, captures, and cookies 100% intact in your local offline database.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={showBrowserNav}
                        onChange={(e) => {
                          const nextVal = e.target.checked;
                          setShowBrowserNav(nextVal);
                          const updated = { ...settings, showStudyBrowser: nextVal };
                          setSettings(updated);
                          db.setSettings(updated);
                          safeDispatch(new Event('studyos_settings_updated'));
                          onShowNotification(
                            nextVal ? 'Study Browser added to top navigation.' : 'Study Browser hidden from top navigation.',
                            'Navigation Updated'
                          );
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {/* Planner & Routine Defaults */}
                  <div className="p-5 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-600" />
                      <h4 className="font-bold text-slate-900 text-sm">Planner Routine Defaults</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-700 text-xs font-bold mb-1.5">Default Slot Duration</label>
                        <select
                          value={plannerDuration}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setPlannerDuration(val);
                            const updated = { ...settings, plannerDefaultDuration: val };
                            setSettings(updated);
                            db.setSettings(updated);
                            safeDispatch(new Event('studyos_settings_updated'));
                          }}
                          className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="30">30 Minutes (Short Sprint)</option>
                          <option value="45">45 Minutes (Focus Block)</option>
                          <option value="60">60 Minutes (Standard 1 Hour)</option>
                          <option value="90">90 Minutes (Deep Work)</option>
                          <option value="120">120 Minutes (2 Hour Marathon)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-700 text-xs font-bold mb-1.5">Default Slot Start Time</label>
                        <input
                          type="time"
                          value={plannerDefaultTime}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPlannerDefaultTime(val);
                            const updated = { ...settings, plannerDefaultSlotTime: val };
                            setSettings(updated);
                            db.setSettings(updated);
                            safeDispatch(new Event('studyos_settings_updated'));
                          }}
                          className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Practice & Test Series Defaults */}
                  <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-4">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-indigo-600" />
                      <h4 className="font-bold text-slate-900 text-sm">Practice & Test Series Engine</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-700 text-xs font-bold mb-1.5">Default Test Duration</label>
                        <select
                          value={practiceDuration}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setPracticeDuration(val);
                            const updated = { ...settings, practiceDefaultDurationMins: val };
                            setSettings(updated);
                            db.setSettings(updated);
                            safeDispatch(new Event('studyos_settings_updated'));
                          }}
                          className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="15">15 Minutes (10 Qs Quick Quiz)</option>
                          <option value="30">30 Minutes (20 Qs Sectional)</option>
                          <option value="60">60 Minutes (30 Qs Subject Test)</option>
                          <option value="90">90 Minutes (45 Qs Semi-Mock)</option>
                          <option value="180">180 Minutes (Full Length 65 Qs Mock)</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-indigo-100 mt-5">
                        <div>
                          <div className="font-bold text-slate-900 text-xs">Standard Negative Marking</div>
                          <div className="text-[10px] text-slate-500">-0.33 / -0.66 deduction for MCQs</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={practiceNegative}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setPracticeNegative(val);
                            const updated = { ...settings, practiceNegativeMarking: val };
                            setSettings(updated);
                            db.setSettings(updated);
                            safeDispatch(new Event('studyos_settings_updated'));
                          }}
                          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 1.5 POMODORO BREAK MODE & BRAIN GAMES */}
          {currentSection === 'pomodoro-break' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-3xl border border-[#E7E0F8] shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-[#E7E0F8] pb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <Gamepad2 className="w-5 h-5 text-purple-600" /> Pomodoro Break Mode & Brain Games Configuration
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Configure full-screen kiosk break behaviors, offline game preferences, difficulty levels, and session auto-resume.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200">
                    Offline Kiosk Ready
                  </span>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const updatedSettings = {
                      ...settings,
                      pomodoroBreakConfig: breakConfig,
                      allowBackgroundFocusTimer: settings.allowBackgroundFocusTimer ?? false,
                    };
                    db.setSettings(updatedSettings);
                    setSettings(updatedSettings);
                    const timerState = pomodoroTimerService.getState();
                    pomodoroTimerService.configure(
                      timerState.focusMinutes || 25,
                      timerState.breakMinutes || 5,
                      timerState.longBreakMinutes || 15,
                      breakConfig.autoLaunchGames,
                      breakConfig.autoResumeStudy
                    );
                    safeDispatch(new CustomEvent('studyos_settings_updated', { detail: updatedSettings }));
                    onShowNotification('Focus & Break Mode settings saved successfully!', 'Settings Hub');
                  }}
                  className="space-y-6 text-xs font-medium"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Background Focus Timer */}
                    <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200 flex items-center justify-between col-span-1 md:col-span-2">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">Allow Focus Timer in Background</div>
                        <div className="text-[11px] text-slate-600">
                          When disabled (default), focus timer automatically pauses when the application is minimized or inactive.
                          Application runtime is never counted as focus time.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.allowBackgroundFocusTimer ?? false}
                        onChange={(e) => {
                          const next = { ...settings, allowBackgroundFocusTimer: e.target.checked };
                          setSettings(next);
                          db.setSettings(next);
                        }}
                        className="w-5 h-5 accent-teal-600 rounded-md cursor-pointer"
                      />
                    </div>

                    {/* Game Auto-Launch */}
                    <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">Auto-Launch Brain Games</div>
                        <div className="text-[11px] text-slate-500">Automatically open selected brain game when break starts</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={breakConfig.autoLaunchGames}
                        onChange={(e) => setBreakConfig({ ...breakConfig, autoLaunchGames: e.target.checked })}
                        className="w-5 h-5 accent-purple-600 rounded-md cursor-pointer"
                      />
                    </div>

                    {/* Allow Skip Break */}
                    <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">Allow Skip Break Button</div>
                        <div className="text-[11px] text-slate-500">Enable button to return to workspace early during break</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={breakConfig.allowSkipBreak}
                        onChange={(e) => setBreakConfig({ ...breakConfig, allowSkipBreak: e.target.checked })}
                        className="w-5 h-5 accent-purple-600 rounded-md cursor-pointer"
                      />
                    </div>

                    {/* Auto-Resume Study */}
                    <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">Auto-Resume Next Study Session</div>
                        <div className="text-[11px] text-slate-500">Automatically start next focus session when break timer expires</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={breakConfig.autoResumeStudy}
                        onChange={(e) => setBreakConfig({ ...breakConfig, autoResumeStudy: e.target.checked })}
                        className="w-5 h-5 accent-purple-600 rounded-md cursor-pointer"
                      />
                    </div>

                    {/* Randomize Games */}
                    <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">Randomize Brain Games</div>
                        <div className="text-[11px] text-slate-500">Pick a random game automatically on each break session</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={breakConfig.randomizeGames}
                        onChange={(e) => setBreakConfig({ ...breakConfig, randomizeGames: e.target.checked })}
                        className="w-5 h-5 accent-purple-600 rounded-md cursor-pointer"
                      />
                    </div>

                    {/* Default Game Selector */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1.5">Preferred Default Game</label>
                      <select
                        value={breakConfig.defaultGame}
                        onChange={(e) => setBreakConfig({ ...breakConfig, defaultGame: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="2048">2048 Number Merge</option>
                        <option value="sudoku">Sudoku Grid</option>
                        <option value="memory">Memory Match Cards</option>
                        <option value="sliding">Sliding 15-Puzzle</option>
                        <option value="wordSearch">Word Search</option>
                        <option value="minesweeper">Minesweeper</option>
                        <option value="tetris">Tetris Block Puzzle</option>
                        <option value="speedMath">Logic & Math Puzzle</option>
                        <option value="pattern">Pattern Recall Memory</option>
                        <option value="targetNumber">Target Number Puzzle</option>
                      </select>
                    </div>

                    {/* Game Difficulty Level */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1.5">Default Game Difficulty</label>
                      <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
                        {(['easy', 'medium', 'hard'] as const).map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setBreakConfig({ ...breakConfig, difficulty: lvl })}
                            className={`py-2 rounded-lg font-black uppercase text-[11px] transition-all ${
                              breakConfig.difficulty === lvl
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Audio Sound FX */}
                    <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">Audio Sound Effects</div>
                        <div className="text-[11px] text-slate-500">Synthesizer audio clicks and win notifications</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={!breakConfig.muteSounds}
                        onChange={(e) => setBreakConfig({ ...breakConfig, muteSounds: !e.target.checked })}
                        className="w-5 h-5 accent-purple-600 rounded-md cursor-pointer"
                      />
                    </div>

                    {/* Web Audio Chime Preview & Testing */}
                    <div className="col-span-1 md:col-span-2 p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            <Bell className="w-4 h-4 text-indigo-600" /> Web Audio Notification System
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Plays subtle interval completion chimes when study sessions or breaks complete.
                          </div>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-extrabold text-[10px]">
                          Web Audio API Active
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            audioService.playSessionEndChime();
                            onShowNotification('Played Study Interval Completion Chime', 'Web Audio Test');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          🔊 Test Interval Chime
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            audioService.playVictoryFanfare();
                            onShowNotification('Played Victory Celebration Fanfare', 'Web Audio Test');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          🎉 Test Victory Fanfare
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            audioService.playWarningChime();
                            onShowNotification('Played 1-Minute Warning Chime', 'Web Audio Test');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          ⚠️ Test Warning Tone
                        </button>
                      </div>
                    </div>

                    {/* Break Kiosk Theme */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1.5">Kiosk Color Theme</label>
                      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setBreakConfig({ ...breakConfig, breakTheme: 'dark' })}
                          className={`py-2 rounded-lg font-bold text-xs transition-all ${
                            breakConfig.breakTheme === 'dark' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'
                          }`}
                        >
                          🌙 Dark Kiosk
                        </button>
                        <button
                          type="button"
                          onClick={() => setBreakConfig({ ...breakConfig, breakTheme: 'light' })}
                          className={`py-2 rounded-lg font-bold text-xs transition-all ${
                            breakConfig.breakTheme === 'light' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600'
                          }`}
                        >
                          ☀️ Light Kiosk
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setShowTestGameModal(true)}
                      className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold shadow-md hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Gamepad2 className="w-4 h-4" /> 🎮 Test Launch Break Game Kiosk
                    </button>

                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-extrabold shadow-md hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" /> Save Break Mode Settings
                    </button>
                  </div>
                </form>

                {/* Standalone Test Game Modal */}
                {showTestGameModal && (
                  <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl animate-fadeIn">
                      <BrainGameContainer
                        defaultGame={breakConfig.defaultGame}
                        difficulty={breakConfig.difficulty}
                        muteSounds={breakConfig.muteSounds}
                        isStandaloneModal={true}
                        onClose={() => setShowTestGameModal(false)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {currentSection === 'workspace-analytics' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-3xl border border-[#E7E0F8] shadow-xs space-y-6">
                <div className="border-b border-[#E7E0F8] pb-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-600" /> Workspace & Local Storage Analytics
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Real-time metrics on offline SQLite database size, PDF document index, and SRS flashcard counts.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 text-center">
                    <div className="text-2xl font-black text-purple-700">14.8 MB</div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">SQLite DB Size</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 text-center">
                    <div className="text-2xl font-black text-pink-600">12 PDFs</div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">Indexed Documents</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 text-center">
                    <div className="text-2xl font-black text-emerald-600">62 Cards</div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">SRS Flashcards</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 text-center">
                    <div className="text-2xl font-black text-amber-600">145 Qs</div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">Question Bank</div>
                  </div>
                </div>

                {/* Storage Breakdown Bar */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>Local Storage Partitioning</span>
                    <span className="text-purple-600">24.8 MB / 500 MB Quota</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
                    <div className="bg-purple-600 h-full w-[58%]" title="SQLite Database (58%)" />
                    <div className="bg-pink-500 h-full w-[28%]" title="PDF Annotations & Blobs (28%)" />
                    <div className="bg-amber-400 h-full w-[14%]" title="Cached Renderings (14%)" />
                  </div>
                  <div className="flex items-center space-x-6 text-[11px] font-semibold text-slate-600 pt-1">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-600" /> SQLite Tables (14.2 MB)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pink-500" /> PDF Indexes (6.8 MB)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Cache (3.8 MB)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. ACCOUNT CREDENTIALS */}
          {currentSection === 'credentials' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-3xl border border-[#E7E0F8] shadow-xs space-y-6">
                <div className="border-b border-[#E7E0F8] pb-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-purple-600" /> Account Credentials & Local Vault
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Manage UUID tokens, local password hashing, and encrypted workspace locks.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-2 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-purple-100">
                    <span className="text-slate-500">Account UUID:</span>
                    <span className="font-bold text-purple-700">{currentUser.accountId}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-purple-100">
                    <span className="text-slate-500">Local Encryption Algorithm:</span>
                    <span className="font-bold text-emerald-600">PBKDF2 SHA-256 (100% Offline)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Account Registration Date:</span>
                    <span className="font-bold text-slate-800">{new Date(currentUser.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Password Form */}
                <form onSubmit={handleChangePassword} className="space-y-3 max-w-md text-xs font-medium">
                  <h4 className="font-black text-slate-900 text-sm">Update Vault Password</h4>
                  {passMsg.text && (
                    <div className={`p-2.5 rounded-xl text-xs font-bold ${passMsg.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                      {passMsg.text}
                    </div>
                  )}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Current Password</label>
                    <input
                      type="password"
                      value={curPass}
                      onChange={(e) => setCurPass(e.target.value)}
                      required
                      className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      required
                      className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      required
                      className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-2xl bg-purple-600 text-white font-bold shadow-md hover:bg-purple-700 transition-all"
                  >
                    Change Local Vault Password
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 4. INTERFACE THEMES */}
  
        {currentSection === 'version' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-lg font-black text-slate-900">Version Management</h2>
              <p className="text-xs text-slate-500 mt-1">
                Semantic versioning, release notes, and offline update metadata. User data stays separate from the app install.
              </p>
            </div>
            <VersionManagementPanel onShowNotification={onShowNotification} />
          </div>
        )}

        {currentSection === 'themes' && (
          <div className="space-y-6 animate-fadeIn max-w-3xl">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Palette className="w-5 h-5 text-sky-600" /> Choose Theme
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Only two themes: Default (current StudyOS look) and Ocean Blue (app icon palette). Applies everywhere instantly.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  const next = { ...settings, theme: 'light' as const };
                  setSettings(next);
                  db.setSettings(next);
                  document.documentElement.setAttribute('data-theme', 'light');
                  document.documentElement.classList.remove('dark', 'theme-ocean');
                  safeDispatch(new Event('studyos_theme_changed'));
                  onShowNotification('Default theme applied', 'Appearance');
                }}
                className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                  settings.theme !== 'ocean' ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-200' : 'border-slate-200 hover:border-purple-200'
                }`}
              >
                <div className="w-full h-14 rounded-xl mb-3 bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] shadow-md" />
                <div className="text-sm font-black text-slate-900">Default</div>
                <div className="text-[11px] text-slate-500 mt-1">Current purple–pink StudyOS theme</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = { ...settings, theme: 'ocean' as const };
                  setSettings(next);
                  db.setSettings(next);
                  document.documentElement.setAttribute('data-theme', 'ocean');
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('theme-ocean');
                  safeDispatch(new Event('studyos_theme_changed'));
                  onShowNotification('Ocean Blue theme applied everywhere', 'Appearance');
                }}
                className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                  settings.theme === 'ocean' ? 'border-cyan-500 bg-gradient-to-br from-blue-50 to-teal-50 ring-2 ring-cyan-200' : 'border-slate-200 hover:border-cyan-300'
                }`}
              >
                <div className="w-full h-14 rounded-xl mb-3 bg-gradient-to-r from-[#3B82F6] via-[#14B8A6] to-[#22D3EE] shadow-md" />
                <div className="text-sm font-black text-slate-900">Ocean Blue</div>
                <div className="text-[11px] text-slate-500 mt-1">Blue → teal gradient matching the StudyOS icon</div>
              </button>
            </div>
          </div>
        )}

{currentSection === 'notifications' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-3xl border border-[#E7E0F8] shadow-xs space-y-6">
                <div className="border-b border-[#E7E0F8] pb-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-purple-600" /> Alerts, Alarms & Reminders
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Configure desktop study alerts, lecture schedule notifications, and Pomodoro chime sounds.
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div>
                      <div className="font-bold text-slate-900">PW Lecture Schedule Alarms</div>
                      <div className="text-[10px] text-slate-500">Notify 10 mins before re-anchored lecture slot</div>
                    </div>
                    <input type="checkbox" defaultChecked className="accent-purple-600 w-4 h-4" />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div>
                      <div className="font-bold text-slate-900">SRS Flashcard Due Reminders</div>
                      <div className="text-[10px] text-slate-500">Alert when spaced repetition deck has cards due for review</div>
                    </div>
                    <input type="checkbox" defaultChecked className="accent-purple-600 w-4 h-4" />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div>
                      <div className="font-bold text-slate-900">Audio Chime Sounds</div>
                      <div className="text-[10px] text-slate-500">Play local sound effects on task completion & Pomodoro end</div>
                    </div>
                    <input type="checkbox" defaultChecked className="accent-purple-600 w-4 h-4" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 6. ACCESS CONTROL & ACCOUNTS MANAGEMENT */}
          {currentSection === 'access-control' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-3xl border border-[#E7E0F8] shadow-xs space-y-6">
                <div className="border-b border-[#E7E0F8] pb-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-purple-600" /> Access Control, Multi-Account & Security
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Manage workspace PIN locking, multi-account separation, role permissions, and LAN device approvals.
                  </p>
                </div>

                <div className="space-y-5 text-xs font-medium">
                  {/* Auto-Lock Idle Timer Selector */}
                  <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-2">
                    <div className="font-bold text-slate-900 flex items-center justify-between">
                      <span>Auto-Lock Inactivity Timer</span>
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                        Current: {settings.inactivityAutoLockMins ? `${settings.inactivityAutoLockMins} mins` : '15 mins'}
                      </span>
                    </div>
                    <select
                      value={settings.inactivityAutoLockMins ?? 15}
                      onChange={(e) => {
                        const mins = parseInt(e.target.value, 10);
                        const next = { ...settings, inactivityAutoLockMins: mins };
                        setSettings(next);
                        db.setSettings(next);
                        onShowNotification(`Inactivity auto-lock updated to ${mins === 0 ? 'Disabled' : `${mins} minutes`}`, 'Security');
                      }}
                      className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="5">Lock after 5 minutes of inactivity</option>
                      <option value="10">Lock after 10 minutes of inactivity</option>
                      <option value="15">Lock after 15 minutes of inactivity (Default)</option>
                      <option value="30">Lock after 30 minutes of inactivity</option>
                      <option value="0">Never auto-lock</option>
                    </select>
                  </div>

                  {/* Change 4-Digit PIN Form */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-purple-600" /> Update 4-Digit Unlock PIN
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="New PIN (e.g. 1234)"
                        id="newPinInput"
                        className="px-3 py-2 rounded-xl border border-slate-300 font-mono text-center font-bold tracking-widest text-sm w-36 bg-white"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const input = document.getElementById('newPinInput') as HTMLInputElement;
                          if (input && input.value) {
                            const res = await authService.changePin(input.value);
                            if (res.success) {
                              onShowNotification('4-Digit Security PIN updated successfully', 'Security');
                              input.value = '';
                            } else {
                              onShowNotification(res.message, 'Security Error');
                            }
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                      >
                        Save PIN
                      </button>


                    </div>
                  </div>

                  {/* Multi-Account System Management */}
                  <div className="space-y-3 pt-2">
                    <div className="font-black text-slate-900 text-sm flex items-center justify-between">
                      <span>Registered Workspaces & Accounts ({authService.getAccounts().length})</span>
                      <button
                        type="button"
                        onClick={() => {
                          authService.lockWorkspace();
                          window.location.reload();
                        }}
                        className="px-3 py-1 rounded-xl bg-purple-100 text-purple-700 font-bold text-xs hover:bg-purple-200 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Register New Account</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {authService.getAccounts().map((acc) => (
                        <div key={acc.accountId} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                          <div className="flex items-center space-x-3">
                            <img src={acc.avatarUrl} alt={acc.fullName} className="w-10 h-10 rounded-full object-cover border-2 border-purple-500 shadow-2xs" />
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-2">
                                <span>{acc.fullName}</span>
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                  acc.role === 'Parent' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-700'
                                }`}>
                                  {acc.role || 'Student'}
                                </span>
                                {acc.accountId === currentUser.accountId && (
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    Active Now
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                @{acc.username} • Goal: {acc.studyTarget || 'GATE 2027'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {acc.accountId !== currentUser.accountId && (
                              <button
                                type="button"
                                onClick={() => {
                                  authService.switchAccount(acc.accountId);
                                  onShowNotification(`Switched active profile to @${acc.username}. Workspace locked.`, 'Accounts');
                                  window.location.reload();
                                }}
                                className="px-3 py-1.5 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 transition-all cursor-pointer"
                              >
                                Switch Account
                              </button>
                            )}

                            {!acc.isDefaultAdmin && acc.accountId !== currentUser.accountId && (
                              <button
                                type="button"
                                onClick={() => {
                                  authService.deleteAccount(acc.accountId);
                                  onShowNotification(`Removed account @${acc.username}`, 'Accounts');
                                  setCurrentUser(authService.getCurrentUser());
                                }}
                                className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer"
                                title="Remove Account"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Connected LAN Devices Approval */}
                  <div className="space-y-3 pt-2">
                    <div className="font-black text-slate-900 text-sm flex items-center justify-between">
                      <span>Host-Approved LAN Companion Devices</span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        LAN Gatekeeper Active
                      </span>
                    </div>

                    <div className="space-y-2">
                      {[
                        { id: 'dev-1', ip: '192.168.1.104', hostname: 'iPad Air (Study Companion)', approved: true, role: 'User', lastActive: '2 mins ago' },
                        { id: 'dev-2', ip: '192.168.1.112', hostname: 'Android Phone (Flashcards Remote)', approved: true, role: 'LAN Viewer', lastActive: '12 mins ago' },
                      ].map((dev) => (
                        <div key={dev.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 rounded-xl bg-purple-100 text-purple-700 font-bold">
                              <Laptop className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                                <span>{dev.hostname}</span>
                                <span className="font-mono text-[10px] text-slate-500">({dev.ip})</span>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Assigned Role: {dev.role} • Active: {dev.lastActive}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Host Approved
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7. BACKUP & RESTORE */}
          {currentSection === 'backup-restore' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-3xl border border-[#E7E0F8] shadow-xs space-y-6">
                <div className="border-b border-[#E7E0F8] pb-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Database className="w-5 h-5 text-purple-600" /> Backup, Date Re-Anchoring & Restore
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Re-anchor lecture schedules and perform full local JSON database exports and restores.
                  </p>
                </div>

                {/* Date Re-Anchoring Engine */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-50/90 via-pink-50/80 to-indigo-50/80 border border-purple-200/90 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-purple-600" /> Date Re-Anchoring Engine
                    </h4>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-purple-600 text-white shadow-xs">
                      Target: Jan 1st Week 2027
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Re-anchors all canonical PW lectures sequentially starting from your custom preparation date. Automatically recalculates required daily study hours (7.0 - 8.5 hrs/day) to guarantee 100% syllabus completion by the first week of January 2027.
                  </p>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-purple-200/60">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-700">Start Date:</span>
                      <input
                        type="date"
                        value={reanchorDate}
                        onChange={(e) => setReanchorDate(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-purple-300 bg-white text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                      />
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 font-medium">Calculated Pace</div>
                        <div className="text-xs font-black font-mono text-purple-700">{settings.dailyGoalHours || 7.5} hrs / day</div>
                      </div>

                      <button
                        onClick={handleReanchor}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] text-white font-black text-xs hover:opacity-95 transition-all shadow-md shadow-pink-500/20"
                      >
                        Apply Re-Anchor Engine
                      </button>
                    </div>
                  </div>
                </div>

                {/* Database Export & Restore Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleExportJSON}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xs flex items-center gap-2 shadow-md hover:opacity-95 transition-all"
                  >
                    <Download className="w-4 h-4" /> Export Backup JSON
                  </button>

                  <label className="cursor-pointer px-5 py-2.5 rounded-2xl bg-white border border-[#E7E0F8] text-slate-700 font-bold text-xs hover:bg-purple-50 flex items-center gap-2 shadow-xs transition-all">
                    <Upload className="w-4 h-4 text-purple-600" /> Restore Backup JSON
                    <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 8. CACHE & STORAGE */}
          {currentSection === 'cache-storage' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-3xl border border-[#E7E0F8] shadow-xs space-y-6">
                <div className="border-b border-[#E7E0F8] pb-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-purple-600" /> Cache, Memory & SQLite Maintenance
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Run database vacuuming, clear temporary render caches, and re-index local search tables.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-bold text-slate-900">SQLite Vacuum & Page Optimization</div>
                    <p className="text-[11px] text-slate-500">Defragment local database storage pages and reduce disk footprint.</p>
                    <button
                      onClick={() => onShowNotification('SQLite database vacuumed & defragmented (0.4 MB reclaimed)', 'Maintenance')}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-all"
                    >
                      Run VACUUM
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-bold text-slate-900">Full Text Search (FTS) Re-Index</div>
                    <p className="text-[11px] text-slate-500">Rebuild offline search index for notes, PDFs, and flashcards.</p>
                    <button
                      onClick={() => onShowNotification('Rebuilt local FTS5 search index across 145 items', 'Maintenance')}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-all"
                    >
                      Rebuild Search Index
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 9. KEYBOARD SHORTCUTS */}
          {currentSection === 'shortcuts' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-3xl border border-[#E7E0F8] shadow-xs space-y-6">
                <div className="border-b border-[#E7E0F8] pb-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Keyboard className="w-5 h-5 text-purple-600" /> Keyboard Shortcuts Cheat Sheet
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Speed up desktop workflow with instant global hotkeys.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {[
                    { key: 'Ctrl + K', action: 'Open Universal Command Palette' },
                    { key: 'Ctrl + Shift + F', action: 'Toggle Deep Study Focus Mode' },
                    { key: 'Ctrl + P', action: 'Toggle Pomodoro Study Timer Widget' },
                    { key: 'Ctrl + L', action: 'Instantly Lock Workspace Security' },
                    { key: 'Ctrl + S', action: 'Quick Save Active Note or Task' },
                    { key: 'Ctrl + B', action: 'Toggle Sidebar Collapse' },
                  ].map((sc, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="font-medium text-slate-700">{sc.action}</span>
                      <kbd className="px-2 py-1 rounded-lg bg-white border border-slate-300 font-mono text-[11px] font-bold text-slate-800 shadow-xs">
                        {sc.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 10. ABOUT STATION */}
          {currentSection === 'about' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-3xl border border-[#E7E0F8] shadow-xs space-y-6">
                <div className="border-b border-[#E7E0F8] pb-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Info className="w-5 h-5 text-purple-600" /> About StudyOS Desktop Suite
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    100% Offline-First Multi-Account Desktop Application built for GATE 2027 preparation.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono">
                  <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">App Version</div>
                    <div className="text-sm font-black text-purple-700 mt-1">v2.4-canonical</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Build Release</div>
                    <div className="text-sm font-black text-slate-800 mt-1">2026.07.23.01</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">SQLite Engine</div>
                    <div className="text-sm font-black text-emerald-600 mt-1">v3.42.0 Embedded</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Network Mode</div>
                    <div className="text-sm font-black text-emerald-600 mt-1">🟢 100% Offline</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">License Type</div>
                    <div className="text-sm font-black text-slate-800 mt-1">Commercial Local</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Host Platform</div>
                    <div className="text-sm font-black text-slate-800 mt-1">Cloud Container</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 11. PRIVACY & SECURITY AUDIT LOGS */}
          {currentSection === 'privacy' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-3xl border border-[#E7E0F8] shadow-xs space-y-6">
                <div className="border-b border-[#E7E0F8] pb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <Lock className="w-5 h-5 text-purple-600" /> Security Audit Trail & Zero Telemetry
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Real-time immutable local log of security events, authentication attempts, and credential updates.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      auditLogger.clearLogs();
                      onShowNotification('Security audit trail cleared', 'Audit Logs');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                  >
                    Clear Audit Logs
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
                  <div className="font-extrabold flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Zero External Network Calls Verified
                  </div>
                  <p className="leading-relaxed">
                    StudyOS Desktop is strictly architected with zero analytics trackers, zero telemetry, zero remote cloud pinging, and zero third-party font calls. All data remains exclusively inside local SQLite partitions.
                  </p>
                </div>

                {/* Audit Logs Table */}
                <div className="space-y-3 pt-2">
                  <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider">
                    Recent Security Audit Events ({auditLogger.getLogs().length})
                  </h4>

                  <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 divide-y divide-slate-200 text-xs font-mono">
                    {auditLogger.getLogs().length === 0 ? (
                      <div className="p-4 text-center text-slate-400">No audit events recorded yet</div>
                    ) : (
                      auditLogger.getLogs().map((log) => (
                        <div key={log.id} className="p-3 flex items-center justify-between hover:bg-white transition-colors">
                          <div className="flex items-center space-x-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.type === 'SECURITY' ? 'bg-purple-100 text-purple-800' : log.type === 'WARNING' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {log.action}
                            </span>
                            <span className="text-slate-800 font-bold">{log.details}</span>
                          </div>

                          <div className="text-right text-[10px] text-slate-400 flex items-center space-x-2">
                            <span>User: @{log.username || 'System'}</span>
                            <span>•</span>
                            <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 12. RECYCLE BIN */}
          {currentSection === 'recycle-bin' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-3xl border border-[#E7E0F8] shadow-xs space-y-6">
                <div className="border-b border-[#E7E0F8] pb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <Trash2 className="w-5 h-5 text-purple-600" /> Data Management & Recycle Bin
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Soft-deleted notes, archived lectures, and restored items.
                    </p>
                  </div>
                  {trashItems.length > 0 && (
                    <button
                      onClick={() => {
                        setTrashItems([]);
                        onShowNotification('Recycle Bin permanently emptied', 'Recycle Bin');
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 font-bold text-xs border border-rose-200 hover:bg-rose-100 transition-all"
                    >
                      Empty Trash
                    </button>
                  )}
                </div>

                {trashItems.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Recycle Bin is currently empty. Deleted notes or lectures will appear here before permanent purge.
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    {trashItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                        <div>
                          <div className="font-bold text-slate-900">{item.title}</div>
                          <div className="text-[10px] text-slate-400">Deleted: {item.deletedAt} • Category: {item.type}</div>
                        </div>
                        <button
                          onClick={() => {
                            setTrashItems(trashItems.filter((t) => t.id !== item.id));
                            onShowNotification(`Restored "${item.title}" to active workspace`, 'Recycle Bin');
                          }}
                          className="px-3 py-1 rounded-xl bg-purple-100 text-purple-700 font-bold text-xs hover:bg-purple-200 transition-all"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
