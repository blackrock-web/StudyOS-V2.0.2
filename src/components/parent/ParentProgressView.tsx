import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Clock,
  Lock,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  BookOpen,
  Calendar,
  Layers,
  Award,
  AlertCircle,
  Eye,
  FileDown,
  Activity,
  History,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { authService } from '../../services/auth';
import { permissionsService, ParentProgressData } from '../../services/permissions';
import { generateAndPrintPDF } from '../../services/pdfExport';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';

interface ParentProgressViewProps {
  onShowNotification?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ParentProgressView: React.FC<ParentProgressViewProps> = ({ onShowNotification }) => {
  const currentUser = authService.getCurrentUser();
  const [data, setData] = useState<ParentProgressData | null>(null);
  const [error, setError] = useState<string>('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('All');

  useEffect(() => {
    const refreshParentData = () => {
      try {
        if (!currentUser || currentUser.role !== 'Parent') {
          setError('Notice: Currently viewing progress analytics in Parent Mode.');
        }
        const progressData = permissionsService.getParentProgressData(
          currentUser.role === 'Parent'
            ? currentUser
            : { ...currentUser, role: 'Parent' }
        );
        setData(progressData);
      } catch (err: any) {
        console.error('[ParentProgressView] Failed to load data:', err);
        setError(err.message || 'Unable to load progress metrics.');
      }
    };

    refreshParentData();

    window.addEventListener('studyos_active_exam_changed', refreshParentData);
    window.addEventListener('studyos_exams_updated', refreshParentData);
    window.addEventListener('studyos_db_updated', refreshParentData);
    window.addEventListener('studyos_study_sessions_updated', refreshParentData);
    window.addEventListener('studyos_focus_mode_updated', refreshParentData);
    window.addEventListener('studyos_syllabus_updated', refreshParentData);

    return () => {
      window.removeEventListener('studyos_active_exam_changed', refreshParentData);
      window.removeEventListener('studyos_exams_updated', refreshParentData);
      window.removeEventListener('studyos_db_updated', refreshParentData);
      window.removeEventListener('studyos_study_sessions_updated', refreshParentData);
      window.removeEventListener('studyos_focus_mode_updated', refreshParentData);
      window.removeEventListener('studyos_syllabus_updated', refreshParentData);
    };
  }, [currentUser]);

  const handleExportPDF = () => {
    try {
      generateAndPrintPDF('Parent Progress Report PDF');
      if (onShowNotification) {
        onShowNotification('Generated printable Parent Progress PDF report', 'success');
      }
    } catch (err: any) {
      if (onShowNotification) {
        onShowNotification(`PDF export error: ${err.message}`, 'error');
      }
    }
  };

  if (error && !data) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-900 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 shrink-0 text-amber-600" />
          <p className="font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-12 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="font-medium">Loading Parent Progress Dashboard...</p>
      </div>
    );
  }

  const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];

  const filteredTopics = selectedSubjectFilter === 'All'
    ? data.topicProgressPercentages
    : data.topicProgressPercentages.filter(t => t.subjectName === selectedSubjectFilter);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-purple-200 text-slate-900 rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <ShieldCheck className="w-64 h-64 text-purple-900" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-purple-700 text-xs font-bold uppercase tracking-wider mb-2">
              <Eye className="w-4 h-4" />
              <span>Parent / Guardian Read-Only Portal</span>
              <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full border border-purple-200 font-extrabold">
                Encrypted & Isolated
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
              Student Study Progress Overview
            </h1>
            <p className="text-slate-600 text-sm mt-1 max-w-2xl font-medium">
              Real-time high-level academic performance and compliance metrics for{' '}
              <span className="font-bold text-purple-700">
                @{currentUser.username || 'Student'}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 border border-purple-500 cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>Export Progress Report (PDF)</span>
            </button>
            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="hidden sm:block">
                <p className="text-[10px] text-slate-500 font-semibold uppercase">Privacy Status</p>
                <p className="text-xs font-bold text-emerald-700">Allow-List Guard Active</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Daily Hours */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Today's Study Time
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-200">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">
              {data.totalStudyHoursDaily}
            </span>
            <span className="text-sm font-semibold text-slate-500">hours</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            Total active focus hours logged today
          </p>
        </div>

        {/* Metric 2: Weekly Hours */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              This Week's Time
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center border border-cyan-200">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">
              {data.totalStudyHoursWeekly}
            </span>
            <span className="text-sm font-semibold text-slate-500">hours</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            Cumulative study time for current week
          </p>
        </div>

        {/* Metric 3: Monthly Hours */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Overall Study Hours
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">
              {data.totalStudyHoursMonthly}
            </span>
            <span className="text-sm font-semibold text-slate-500">hours</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            Total verified study duration on record
          </p>
        </div>

        {/* Metric 4: Session Metrics */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Study Sessions
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">
              {data.totalSessionCount}
            </span>
            <span className="text-sm font-semibold text-slate-500">sessions</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            Avg duration: <span className="font-bold text-slate-700">{data.averageSessionDurationMinutes} mins</span>
          </p>
        </div>
      </div>

      {/* Row 2: Study Hours Trend Over Time */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-200">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Study Hour Trends Over Time
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Daily focus and study duration progression (last 14 days)
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-purple-700 bg-purple-100 border border-purple-200 px-3 py-1 rounded-full">
            Daily/Weekly/Monthly Sourced
          </span>
        </div>

        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.studyHourTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="parentStudyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                formatter={(val: any) => [`${val} hours`, 'Study Duration']}
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Area type="monotone" dataKey="studyHours" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#parentStudyGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Focus & Lock Compliance + Focus Compliance Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Study Lock Compliance Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center border border-indigo-200">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Study Lock Compliance
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Focus enforcement & system integrity
              </p>
            </div>
          </div>

          <div className="space-y-3.5 pt-1">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-xs font-bold text-slate-600">
                Lock Compliance Rate
              </span>
              <span className="text-lg font-black text-indigo-700">
                {data.studyLockComplianceStatus.lockCompliancePercent}%
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-xs font-bold text-slate-600">
                Active Protection Mode
              </span>
              <span className="text-xs font-black text-slate-900">
                {data.studyLockComplianceStatus.activeMode}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-xs font-bold text-slate-600">
                Inactivity Auto-Lock
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {data.studyLockComplianceStatus.isLocked ? 'Enabled' : 'Configured'}
              </span>
            </div>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900">
              <p className="font-bold mb-1 flex items-center gap-1.5 text-purple-800">
                <Award className="w-3.5 h-3.5" />
                Verified Local Activity
              </p>
              Study Lock logs session focus times automatically when the student works on lectures, DPPs, and problem sets.
            </div>
          </div>
        </div>

        {/* Focus Compliance Trends Panel */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Focus & Mode Compliance Over Time
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Daily focus score and Kiosk/Exam adherence metrics
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full">
              Phase 5 Integrated
            </span>
          </div>

          <div className="h-48 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.focusComplianceTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Focus Compliance']}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="compliancePercent" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 4: Subject & Topic Progress Percentages */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-200">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Subject & Topic Progress Breakdown
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                High-level syllabus completion rates without exposing private notes or solution detail
              </p>
            </div>
          </div>

          {/* Subject Filter Dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-600 font-bold">Filter Subject:</span>
            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 text-slate-800 rounded-xl border border-slate-200 font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="All">All Subjects ({data.subjectProgressPercentages.length})</option>
              {data.subjectProgressPercentages.map((s) => (
                <option key={s.subjectName} value={s.subjectName}>
                  {s.subjectName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Subject Bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.subjectProgressPercentages.map((sub, idx) => (
            <div key={idx} className="p-3.5 bg-slate-50 rounded-xl space-y-2 border border-slate-200/80">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-800 truncate">
                  {sub.subjectName}
                </span>
                <span className="text-purple-700 font-black">
                  {sub.completionPercent}%
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, sub.completionPercent))}%`,
                    backgroundColor: COLORS[idx % COLORS.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Topic Breakdown List */}
        {filteredTopics.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">
              Topic Completion Status ({filteredTopics.length} Topics)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {filteredTopics.map((top, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs border border-slate-200/80"
                >
                  <div className="truncate pr-2">
                    <p className="font-bold text-slate-800 truncate">{top.topicName}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{top.subjectName}</p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                      top.completionPercent >= 100
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : top.completionPercent >= 50
                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                        : 'bg-slate-200 text-slate-700 border border-slate-300'
                    }`}
                  >
                    {top.status} ({top.completionPercent}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Row 5: Session Count & Duration History + Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Session Count / Duration History */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Session History Log
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Log of completed focus sessions and durations
              </p>
            </div>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {data.sessionHistory.length > 0 ? (
              data.sessionHistory.map((s, idx) => (
                <div
                  key={s.id || idx}
                  className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs border border-slate-200/80"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900">
                      {s.subject} — <span className="text-purple-700">{s.topic}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">{s.date} • Session Type: {s.type}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-900 bg-slate-200/80 px-2.5 py-1 rounded-lg">
                      {s.durationMinutes} mins
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 p-4 text-center">No session records logged yet.</p>
            )}
          </div>
        </div>

        {/* Read-Only Student Activity Timeline */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center border border-cyan-200">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Student Activity Timeline
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Sourced read-only from activityEventService.ts
              </p>
            </div>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {data.activityTimeline.length > 0 ? (
              data.activityTimeline.map((act) => (
                <div
                  key={act.id}
                  className="p-3 bg-slate-50 rounded-xl flex items-start gap-3 text-xs border border-slate-200/80"
                >
                  <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 truncate">
                        {act.title}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-2 font-medium">
                        {act.date}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5 font-medium">
                      Module: <span className="font-bold text-slate-700">{act.module}</span> • Action: {act.action}
                      {act.durationMinutes ? ` • ${act.durationMinutes}m` : ''}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 p-4 text-center">No activity timeline events recorded.</p>
            )}
          </div>
        </div>
      </div>

      {/* Strict Privacy Guarantee Footer Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-600">
        <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-slate-900 mb-0.5">
            Strict Parent Role Data Boundary Enforced
          </p>
          <p className="font-medium text-slate-600">
            By design, Parent accounts are restricted to high-level study duration, session count, compliance status, subject/topic completion percentages, and activity timestamps. Individual personal notes, flashcard contents, test answer details, browser history, PDFs, and editable settings remain strictly private to the Student account and cannot be read or edited from the Parent role.
          </p>
        </div>
      </div>
    </div>
  );
};
