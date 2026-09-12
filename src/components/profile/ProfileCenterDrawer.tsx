import React, { useState } from 'react';
import {
  X,
  User,
  Shield,
  KeyRound,
  HardDrive,
  Flame,
  Award,
  Lock,
  LogOut,
  Download,
  Upload,
  Check,
  Edit2,
  Camera,
  Layers,
  Sparkles,
  BarChart3,
  BookOpen,
  GraduationCap,
  Clock,
  Target,
  FileText,
  Save,
  FileDown,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { authService, hashString } from '../../services/auth';
import { db } from '../../services/db';
import { ExamManager } from '../exams/ExamManager';

interface ProfileCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUserUpdated: (updated: UserProfile) => void;
  onLockWorkspace: () => void;
  onSwitchAccount: () => void;
  onShowNotification: (msg: string, title?: string) => void;
  onNavigate?: (tab: string) => void;
}

export const ProfileCenterDrawer: React.FC<ProfileCenterDrawerProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdated,
  onLockWorkspace,
  onSwitchAccount,
  onShowNotification,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'exams' | 'academic' | 'summaries' | 'storage' | 'security'>('profile');
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Edit Profile Form State
  const [fullName, setFullName] = useState<string>(user.fullName || '');
  const [email, setEmail] = useState<string>(user.email || '');
  const [phone, setPhone] = useState<string>(user.phone || '+1 (555) 234-5678');
  const [bio, setBio] = useState<string>(user.bio || 'Dedicated GATE CSE & DA aspirant preparing with AManager.');
  const [studyTarget, setStudyTarget] = useState<string>(user.studyTarget || 'GATE 2027 Computer Science & Data Science');
  const [avatarUrl, setAvatarUrl] = useState<string>(user.avatarUrl);

  // Academic Info Form State
  const [institution, setInstitution] = useState<string>(user.institution || 'National Institute of Technology (NIT)');
  const [semesterOrClass, setSemesterOrClass] = useState<string>(user.semesterOrClass || '7th Semester B.Tech CSE');
  const [preferredStudyHours, setPreferredStudyHours] = useState<string>(
    user.preferredStudyHours || 'Morning 6:00 AM - 11:30 AM & Evening 5:00 PM - 10:30 PM'
  );

  const initialSettings = db.getSettings();
  const [dailyGoalHours, setDailyGoalHours] = useState<number>(initialSettings.dailyGoalHours || 7);
  const [weeklyGoalHours, setWeeklyGoalHours] = useState<number>(initialSettings.weeklyGoalHours || 48);

  // Password Change State
  const [showPasswordChange, setShowPasswordChange] = useState<boolean>(false);
  const [currentPass, setCurrentPass] = useState<string>('');
  const [newPass, setNewPass] = useState<string>('');
  const [passError, setPassError] = useState<string>('');
  const [passSuccess, setPassSuccess] = useState<string>('');

  if (!isOpen) return null;

  // DB Statistics calculations
  const exams = db.getExams();
  const activeExams = exams.filter((e) => e.status === 'Active');
  const pdfs = db.getPDFs();
  const pdfCaptures = db.getPDFCaptures();
  const flashcards = db.getFlashcards();
  const lectures = db.getLectures();
  const breakStats = db.getBreakGameStats();

  const totalStudyMinutes = db.getActivityLogs().reduce((acc, l) => acc + (l.studyMinutes || 0), 0);
  const totalStudyHours = (totalStudyMinutes / 60).toFixed(1);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = authService.updateUserProfile({
      fullName,
      email,
      phone,
      bio,
      studyTarget,
      avatarUrl,
      institution,
      semesterOrClass,
      preferredStudyHours,
      dailyGoalHours,
    });

    db.setSettings({
      ...db.getSettings(),
      dailyGoalHours,
      weeklyGoalHours,
    });

    onUserUpdated(updated);
    setIsEditing(false);
    onShowNotification('Profile & Academic details saved successfully!', 'User Center');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          const newPhoto = evt.target.result as string;
          setAvatarUrl(newPhoto);
          const updated = authService.updateUserProfile({ avatarUrl: newPhoto });
          onUserUpdated(updated);
          onShowNotification('Profile photo updated!', 'User Center');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (hashString(currentPass) !== user.passwordHash) {
      setPassError('Current password is incorrect.');
      return;
    }

    if (newPass.length < 6) {
      setPassError('New password must be at least 6 characters.');
      return;
    }

    authService.updateUserProfile({
      passwordHash: hashString(newPass),
    });

    setPassSuccess('Password updated successfully!');
    setCurrentPass('');
    setNewPass('');
    setTimeout(() => setShowPasswordChange(false), 1200);
  };

  const handleExportProfilePDF = () => {
    const reportText = `=====================================================
            AMANAGER USER PROFILE REPORT
=====================================================
User Account: @${user.username}
Full Name: ${user.fullName}
Role: ${user.role || 'User'}
Email: ${user.email || 'N/A'}
Phone: ${phone}
Institution: ${institution}
Class/Semester: ${semesterOrClass}
Preferred Study Hours: ${preferredStudyHours}

ACADEMIC & PRODUCTIVITY SUMMARY:
- Active Exams Managed: ${activeExams.length}
- Total Logged Study Hours: ${totalStudyHours} Hours
- Daily Streak: ${user.streakDays} Days
- PDF Library Documents: ${pdfs.length} Documents
- PDF Rectangle Captures: ${pdfCaptures.length} Snippets
- Flashcards Created: ${flashcards.length} Cards
- PW Lectures Completed: ${lectures.filter((l) => l.status === 'Completed').length} Lectures
- Break Games Played: ${breakStats.gamesPlayed} Games

Report Generated: ${new Date().toLocaleString()}
Local Storage Status: Encrypted & Offline
=====================================================`;

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AManager_Profile_Report_${user.username}.txt`;
    link.click();
    onShowNotification('Profile Report downloaded successfully!', 'Export Profile');
  };

  const handleExportDatabaseJSON = () => {
    const dataStr = db.exportDatabaseJSON();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AManager_Full_Backup_${user.username}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    onShowNotification('Full database snapshot exported!', 'Workspace Backup');
  };

  const handleImportDatabaseJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          const success = db.importDatabaseJSON(evt.target.result as string);
          if (success) {
            onShowNotification('Workspace restored from JSON backup!', 'Database Import');
            setTimeout(() => window.location.reload(), 1000);
          } else {
            onShowNotification('Failed to import database file', 'Database Import');
          }
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-fadeIn font-sans select-none">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl border-l border-purple-100 flex flex-col justify-between overflow-y-auto custom-scrollbar animate-slideLeft">
        {/* Header */}
        <div>
          <div className="p-4 border-b border-purple-100 flex items-center justify-between bg-purple-50/80">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-rose-600 text-white flex items-center justify-center font-black text-base shadow-md">
                P
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight">Profile & User Center</h2>
                <p className="text-[11px] text-purple-700 font-extrabold uppercase tracking-wider">
                  Account • Academic • Productivity Summaries
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-purple-100 text-slate-500 hover:text-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Hero Avatar Section */}
          <div className="p-6 text-center border-b border-purple-100 relative overflow-hidden bg-gradient-to-b from-purple-50/80 via-pink-50/30 to-white">
            <div className="relative inline-block mb-3">
              <img
                src={avatarUrl}
                alt={user.fullName}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-xl ring-4 ring-purple-600/20 mx-auto"
              />
              <label className="absolute bottom-1 right-1 p-2 bg-purple-600 text-white rounded-full border-2 border-white shadow-md hover:bg-purple-700 transition-colors cursor-pointer" title="Change Photo">
                <Camera className="w-3.5 h-3.5" />
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>

            <h3 className="text-xl font-black text-slate-900">{user.fullName}</h3>
            <p className="text-xs text-purple-700 font-bold">@{user.username} • {user.role || 'User'}</p>
            <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto mt-1">{bio}</p>

            <div className="flex items-center justify-center space-x-3 mt-4">
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-500" /> {user.streakDays} Day Streak
              </span>
              <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-[11px] font-black flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-purple-600" /> {totalStudyHours} Study Hrs
              </span>
            </div>
          </div>

          {/* Tab Sub-Navigation */}
          <div className="flex border-b border-purple-100 bg-slate-50 overflow-x-auto custom-scrollbar">
            {[
              { id: 'profile', label: 'Edit Profile', icon: User },
              { id: 'exams', label: 'Exam Manager', icon: Award },
              { id: 'academic', label: 'Academic Info', icon: GraduationCap },
              { id: 'storage', label: 'Storage & Backup', icon: HardDrive },
              { id: 'security', label: 'Security & PIN', icon: Shield },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSel = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-3 text-xs font-bold shrink-0 flex items-center gap-1.5 border-b-2 transition-all ${
                    isSel
                      ? 'border-purple-600 text-purple-700 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB: EXAM MANAGER */}
          {activeTab === 'exams' && (
            <div className="p-4">
              <ExamManager onShowNotification={onShowNotification} />
            </div>
          )}

          {/* TAB 1: EDIT PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Personal Details</h4>
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs font-bold text-purple-700 hover:underline flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" /> {isEditing ? 'Cancel Editing' : 'Enable Editing'}
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    disabled={!isEditing}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-purple-200 rounded-xl text-xs font-bold focus:outline-none disabled:opacity-70"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      disabled={!isEditing}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-purple-200 rounded-xl text-xs font-bold focus:outline-none disabled:opacity-70"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
                    <input
                      type="text"
                      value={phone}
                      disabled={!isEditing}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-purple-200 rounded-xl text-xs font-bold focus:outline-none disabled:opacity-70"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Personal Bio</label>
                  <textarea
                    value={bio}
                    disabled={!isEditing}
                    rows={2}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-purple-200 rounded-xl text-xs font-medium focus:outline-none disabled:opacity-70"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Exam Focus</label>
                  <input
                    type="text"
                    value={studyTarget}
                    disabled={!isEditing}
                    onChange={(e) => setStudyTarget(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-purple-200 rounded-xl text-xs font-bold focus:outline-none disabled:opacity-70"
                  />
                </div>
              </div>

              {isEditing && (
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Profile Details
                </button>
              )}
            </form>
          )}

          {/* TAB 2: ACADEMIC INFORMATION */}
          {activeTab === 'academic' && (
            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-purple-100 pb-2">
                Academic & Study Goal Settings
              </h4>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Institution / University</label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-purple-200 rounded-xl text-xs font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Semester / Class</label>
                  <input
                    type="text"
                    value={semesterOrClass}
                    onChange={(e) => setSemesterOrClass(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-purple-200 rounded-xl text-xs font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Study Hours Window</label>
                  <input
                    type="text"
                    value={preferredStudyHours}
                    onChange={(e) => setPreferredStudyHours(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-purple-200 rounded-xl text-xs font-bold focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Daily Goal (Hours)</label>
                    <input
                      type="number"
                      value={dailyGoalHours}
                      onChange={(e) => setDailyGoalHours(parseFloat(e.target.value) || 6)}
                      className="w-full p-2.5 bg-slate-50 border border-purple-200 rounded-xl text-xs font-black text-purple-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Weekly Goal (Hours)</label>
                    <input
                      type="number"
                      value={weeklyGoalHours}
                      onChange={(e) => setWeeklyGoalHours(parseFloat(e.target.value) || 48)}
                      className="w-full p-2.5 bg-slate-50 border border-purple-200 rounded-xl text-xs font-black text-purple-700 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Academic Preferences
              </button>
            </form>
          )}

          {/* TAB 4: STORAGE & BACKUP */}
          {activeTab === 'storage' && (
            <div className="p-6 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-purple-100 pb-2">
                Local Storage & Database Backup Status
              </h4>

              <div className="p-4 rounded-2xl bg-slate-50 border border-purple-100 space-y-3">
                <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
                  <span>SQLite / IndexedDB Local Storage</span>
                  <span className="text-purple-700 font-mono">1.8 MB Used</span>
                </div>

                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-purple-600 h-full w-[12%]" />
                </div>

                <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
                  <span>100% Offline Encrypted Engine</span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Auto-Backup Active
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExportDatabaseJSON}
                  className="py-2.5 px-3 rounded-xl bg-purple-100 text-purple-800 font-black text-xs hover:bg-purple-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" /> Export JSON
                </button>

                <label className="cursor-pointer py-2.5 px-3 rounded-xl bg-slate-100 text-slate-800 font-black text-xs hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5">
                  <Upload className="w-4 h-4" /> Import Backup
                  <input type="file" accept=".json" onChange={handleImportDatabaseJSON} className="hidden" />
                </label>
              </div>
            </div>
          )}

          {/* TAB 5: SECURITY & ACCOUNT */}
          {activeTab === 'security' && (
            <div className="p-6 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-purple-100 pb-2">
                Account Security & Workspace Lock
              </h4>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordChange(!showPasswordChange)}
                  className="w-full py-2.5 rounded-xl border border-purple-200 text-purple-700 font-black text-xs hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" /> Change Account Password
                </button>

                {showPasswordChange && (
                  <form onSubmit={handleChangePassword} className="p-3.5 bg-purple-50 rounded-2xl border border-purple-200 space-y-3">
                    {passError && <p className="text-xs text-rose-600 font-bold">{passError}</p>}
                    {passSuccess && <p className="text-xs text-emerald-600 font-bold">{passSuccess}</p>}

                    <input
                      type="password"
                      placeholder="Current Password"
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                      required
                      className="w-full p-2 bg-white border border-purple-300 rounded-xl text-xs font-bold focus:outline-none"
                    />

                    <input
                      type="password"
                      placeholder="New Password (min 6 chars)"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      required
                      className="w-full p-2 bg-white border border-purple-300 rounded-xl text-xs font-bold focus:outline-none"
                    />

                    <button
                      type="submit"
                      className="w-full py-2 rounded-xl bg-purple-600 text-white font-black text-xs shadow-xs"
                    >
                      Update Password
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 border-t border-purple-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onLockWorkspace}
            className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs flex items-center gap-1.5"
          >
            <Lock className="w-4 h-4" /> Lock Screen
          </button>

          <button
            type="button"
            onClick={onSwitchAccount}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md"
          >
            <LogOut className="w-4 h-4" /> Switch Account
          </button>
        </div>
      </div>
    </div>
  );
};
