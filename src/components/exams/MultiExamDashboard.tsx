import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Clock,
  TrendingUp,
  Award,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  PieChart,
  Layers,
  Flame,
  Filter,
  ExternalLink,
  BookOpen,
  Edit,
} from 'lucide-react';
import { db } from '../../services/db';
import { ExamItem, ExamPriority } from '../../types';
import { GlassCard } from '../shared/GlassCard';

interface MultiExamDashboardProps {
  onNavigate: (tab: string) => void;
  onShowNotification: (msg: string, title?: string) => void;
}

export const MultiExamDashboard: React.FC<MultiExamDashboardProps> = ({
  onNavigate,
  onShowNotification,
}) => {
  const [exams, setExams] = useState<ExamItem[]>(db.getExams());
  const [selectedExamId, setSelectedExamId] = useState<string>('ALL_COMBINED');

  useEffect(() => {
    const handleUpdate = () => setExams(db.getExams());
    window.addEventListener('studyos_exams_updated', handleUpdate);
    return () => window.removeEventListener('studyos_exams_updated', handleUpdate);
  }, []);

  // Selected Exam for detailed analytics
  const selectedExam = selectedExamId !== 'ALL_COMBINED' ? exams.find((e) => e.id === selectedExamId) : null;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar font-sans select-none text-[#1e1b4b]">
      {/* Top Banner Header */}
      <GlassCard className="relative overflow-hidden bg-gradient-to-r from-purple-100/90 via-pink-50/70 to-white/90 border-purple-200/80 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] flex items-center justify-center text-white font-black text-2xl shadow-md shadow-pink-500/20">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-purple-600">EXAM CENTER PLATFORM</div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Exam Center Dashboard</h1>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Multi-exam readiness analytics, SRS progress, and subject performance metrics
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => onNavigate('exam-manager')}
            className="px-4 py-2.5 rounded-2xl bg-white border border-purple-200 text-purple-700 font-extrabold text-xs hover:bg-purple-50 transition-all shadow-xs flex items-center gap-1.5"
          >
            <Award className="w-4 h-4 text-purple-600" /> Exam Manager CRUD ({exams.length})
          </button>
        </div>
      </GlassCard>

      {/* EXAM ANALYTICS SELECTOR DROPDOWN (Shifted Top Division after SRS & Distribution) */}
      <GlassCard className="space-y-4 p-6 bg-gradient-to-br from-white/95 via-purple-50/50 to-white/95 border-purple-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-purple-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-purple-600 text-white shadow-md shadow-purple-500/20">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">Exam Analytics Inspector</h2>
              <p className="text-xs text-slate-500 font-medium">Select an exam from the dropdown menu to inspect its dedicated breakdown</p>
            </div>
          </div>

          {/* DROPDOWN MENU */}
          <div className="flex items-center space-x-2 bg-white p-2 rounded-2xl border border-purple-200 shadow-xs w-full md:w-auto">
            <Filter className="w-4 h-4 text-purple-600 shrink-0 ml-1" />
            <span className="text-xs font-extrabold text-slate-600 shrink-0">Inspect Exam:</span>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="bg-purple-50 text-purple-900 font-black text-xs p-2 rounded-xl border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400 w-full md:w-64"
            >
              <option value="ALL_COMBINED">🌟 All Exams (Aggregated Analytics)</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  🎯 {exam.title} ({exam.code}) - {exam.readinessPercent}% Ready
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* DETAILED ANALYTICS CARD FOR SELECTED EXAM */}
        {selectedExam ? (
          <div className="space-y-6 pt-2">
            {/* Selected Exam Header Card */}
            <div className="p-5 rounded-2xl bg-white border border-purple-100 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    {selectedExam.code}
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {selectedExam.category}
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                    {selectedExam.priority} Priority
                  </span>
                </div>
                <h3 className="text-xl font-black text-slate-900">{selectedExam.title}</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {selectedExam.notes || 'No custom study notes added for this exam.'}
                </p>
              </div>

              {/* Readiness Metric */}
              <div className="p-4 rounded-xl bg-purple-50/80 border border-purple-100 text-center flex flex-col justify-center">
                <div className="text-[10px] font-extrabold uppercase text-slate-500">Syllabus Readiness</div>
                <div className="text-3xl font-black text-purple-700 my-1 font-mono">{selectedExam.readinessPercent}%</div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-pink-600 h-full rounded-full"
                    style={{ width: `${selectedExam.readinessPercent}%` }}
                  />
                </div>
              </div>

              {/* Timeline Countdown */}
              <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-100 text-center flex flex-col justify-center">
                <div className="text-[10px] font-extrabold uppercase text-slate-500">Days Remaining</div>
                <div className="text-3xl font-black text-rose-600 my-1 font-mono">
                  {Math.max(0, Math.ceil((new Date(selectedExam.examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
                </div>
                <div className="text-[11px] font-bold text-slate-600">Exam Date: {selectedExam.examDate}</div>
              </div>
            </div>

            {/* Key Schedule & Target Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold">
              <div className="p-3.5 bg-white border border-purple-100 rounded-2xl">
                <div className="text-[10px] text-slate-400 font-extrabold uppercase">Target Score</div>
                <div className="text-base font-black text-slate-900 mt-1">{selectedExam.targetScore}</div>
              </div>
              <div className="p-3.5 bg-white border border-purple-100 rounded-2xl">
                <div className="text-[10px] text-slate-400 font-extrabold uppercase">Daily Recommended</div>
                <div className="text-base font-black text-purple-700 mt-1 font-mono">{selectedExam.targetDailyHours} Hours</div>
              </div>
              <div className="p-3.5 bg-white border border-purple-100 rounded-2xl">
                <div className="text-[10px] text-slate-400 font-extrabold uppercase">Registration Deadline</div>
                <div className="text-base font-black text-slate-900 mt-1">{selectedExam.registrationDeadline || selectedExam.registrationEndDate || 'TBA'}</div>
              </div>
              <div className="p-3.5 bg-white border border-purple-100 rounded-2xl">
                <div className="text-[10px] text-slate-400 font-extrabold uppercase">Admit Card Date</div>
                <div className="text-base font-black text-slate-900 mt-1">{selectedExam.admitCardDate || 'TBA'}</div>
              </div>
            </div>

            {/* Subjects Breakdown */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center justify-between">
                <span>Syllabus Subject Structure ({selectedExam.subjects.length} Subjects)</span>
                <button
                  onClick={() => onNavigate('exam-manager')}
                  className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1"
                >
                  Edit Subjects in Exam Manager <Edit className="w-3.5 h-3.5" />
                </button>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedExam.subjects.map((sub) => {
                  const completedChapters = sub.chapters.filter((c) => c.completed).length;
                  const percent = sub.chapters.length > 0 ? Math.round((completedChapters / sub.chapters.length) * 100) : 0;

                  return (
                    <div key={sub.id} className="p-4 bg-white border border-purple-100 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900 text-xs">{sub.name}</span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                          Weight: {sub.weightagePercent}%
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span>Chapters: {completedChapters}/{sub.chapters.length} Completed</span>
                        <span className="font-mono font-bold text-purple-700">{percent}%</span>
                      </div>

                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-purple-600 h-full rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* COMBINED OVERVIEW ANALYTICS */
          <div className="p-4 bg-white border border-purple-100 rounded-2xl text-center space-y-3">
            <Sparkles className="w-8 h-8 text-purple-600 mx-auto" />
            <h3 className="text-sm font-black text-slate-800">Combined Multi-Exam Portfolio Analytics</h3>
            <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
              You are viewing the aggregated portfolio overview across {exams.length} configured exams. Use the dropdown above to drill down into specific exam analytics.
            </p>
          </div>
        )}
      </GlassCard>

      {/* COMPARATIVE EXAMS GRID */}
      <div className="space-y-3">
        <h2 className="text-base font-black text-slate-900 flex items-center gap-2 tracking-tight">
          <Award className="w-5 h-5 text-purple-600" /> All Active & Configured Exams ({exams.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam) => {
            const daysLeft = Math.max(
              0,
              Math.ceil((new Date(exam.examDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            );

            return (
              <GlassCard key={exam.id} className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                      {exam.code}
                    </span>
                    <h3 className="text-base font-black text-slate-900 tracking-tight mt-1">{exam.title}</h3>
                    <p className="text-xs text-slate-500 font-medium">Category: {exam.category}</p>
                  </div>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      exam.status === 'Active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {exam.status}
                  </span>
                </div>

                {/* Readiness Circular / Bar Tracker */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-black text-slate-700">
                    <span>Syllabus Readiness</span>
                    <span className="text-purple-700 font-mono">{exam.readinessPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] h-full rounded-full transition-all duration-300"
                      style={{ width: `${exam.readinessPercent}%` }}
                    />
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-purple-50/60 p-3 rounded-2xl border border-purple-100">
                  <div>
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Exam Date</span>
                    <span className="font-bold text-slate-800">{exam.examDate}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Countdown</span>
                    <span className="font-black text-rose-600">{daysLeft} Days</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Target Score</span>
                    <span className="font-bold text-purple-700">{exam.targetScore}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Priority</span>
                    <span className="font-bold text-slate-800">{exam.priority}</span>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setSelectedExamId(exam.id);
                    }}
                    className="text-xs font-extrabold text-purple-600 hover:underline flex items-center gap-1"
                  >
                    Inspect Analytics <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onNavigate('exam-manager')}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800"
                  >
                    CRUD Edit
                  </button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </div>
  );
};
