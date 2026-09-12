import React, { useState, useEffect, useRef } from 'react';
import {
  Award,
  Plus,
  Edit3,
  Archive,
  RotateCcw,
  Trash2,
  Copy,
  Calendar,
  Target,
  Clock,
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Layers,
  BarChart2,
  TrendingUp,
  Globe,
  ExternalLink,
  Zap,
  Check,
  X,
  FileText,
  ShieldAlert,
  Download,
  Upload,
  Database,
  Activity,
  ArrowLeft,
} from 'lucide-react';
import { db } from '../../services/db';
import {
  ExamItem,
  ExamCategory,
  ExamPriority,
  ExamStatus,
  PreparationLevel,
  ExamSubjectNode,
} from '../../types';
import { GlassCard } from '../shared/GlassCard';
import { TaskTemplateRepositoryModal } from '../planner/TaskTemplateRepositoryModal';

interface ExamManagerProps {
  onShowNotification: (msg: string, title?: string) => void;
  onNavigateToResourceLibrary?: (examId?: string) => void;
  onNavigate?: (view: string) => void;
}

const CATEGORY_OPTIONS: ExamCategory[] = [
  'Engineering',
  'Civil Services',
  'Higher Ed',
  'IT & Cloud',
  'Medical',
  'Management',
  'Custom',
];

const PRIORITY_OPTIONS: ExamPriority[] = ['Critical', 'High', 'Medium', 'Low'];
const PREP_LEVEL_OPTIONS: PreparationLevel[] = [
  'Not Started',
  'Basic',
  'Intermediate',
  'Advanced',
  'Exam Ready',
];

const COLOR_OPTIONS = [
  { id: 'purple', label: 'Purple', bg: 'bg-purple-500', text: 'text-purple-700', border: 'border-purple-300', ring: 'ring-purple-500' },
  { id: 'cyan', label: 'Cyan', bg: 'bg-cyan-500', text: 'text-cyan-700', border: 'border-cyan-300', ring: 'ring-cyan-500' },
  { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-300', ring: 'ring-emerald-500' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-300', ring: 'ring-amber-500' },
  { id: 'rose', label: 'Rose', bg: 'bg-rose-500', text: 'text-rose-700', border: 'border-rose-300', ring: 'ring-rose-500' },
  { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-500', text: 'text-indigo-700', border: 'border-indigo-300', ring: 'ring-indigo-500' },
];

export const ExamManager: React.FC<ExamManagerProps> = ({
  onShowNotification,
  onNavigate,
}) => {
  const [exams, setExams] = useState<ExamItem[]>(db.getExams());
  const [activeExamId, setActiveExamId] = useState<string>(db.getActiveExamId());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('Active');

  // Modal State for Adding/Editing Exam
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingExam, setEditingExam] = useState<Partial<ExamItem> | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);

  // Deletion Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<ExamItem | null>(null);

  const refreshData = () => {
    setExams(db.getExams());
    setActiveExamId(db.getActiveExamId());
  };

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formCategory, setFormCategory] = useState<ExamCategory>('Engineering');
  const [formPriority, setFormPriority] = useState<ExamPriority>('High');
  const [formTargetScore, setFormTargetScore] = useState('');
  const [formExamDate, setFormExamDate] = useState('');
  const [formRegDeadline, setFormRegDeadline] = useState('');
  const [formAdmitCardDate, setFormAdmitCardDate] = useState('');
  const [formResultDate, setFormResultDate] = useState('');
  const [formColor, setFormColor] = useState('purple');
  const [formPrepLevel, setFormPrepLevel] = useState<PreparationLevel>('Intermediate');
  const [formTargetDailyHours, setFormTargetDailyHours] = useState<number>(4);
  const [formOfficialUrl, setFormOfficialUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formSubjectsText, setFormSubjectsText] = useState('');

  // File Upload Ref for JSON Import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recent Activity Feed State
  const [activities, setActivities] = useState<{ id: string; text: string; time: string; type: 'switch' | 'create' | 'edit' | 'import' | 'export' | 'delete' }[]>([
    { id: 'act-1', text: 'Active workspace set to "GATE Module" (GATE-2027)', time: 'Just now', type: 'switch' },
    { id: 'act-2', text: 'Synchronized workspace databases across StudyOS', time: '5m ago', type: 'edit' },
    { id: 'act-3', text: 'Exam workspace configuration updated', time: '12m ago', type: 'edit' },
  ]);

  const logActivity = (text: string, type: 'switch' | 'create' | 'edit' | 'import' | 'export' | 'delete') => {
    setActivities((prev) => [
      { id: `act-${Date.now()}`, text, time: 'Just now', type },
      ...prev.slice(0, 9),
    ]);
  };

  // JSON Export Handler
  const handleExportJSON = (examId?: string) => {
    const allExams = db.getExams();
    const exportData = examId
      ? {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          exam: allExams.find((e) => e.id === examId) || null,
          resources: db.getResources().filter((r) => r.examId === examId),
        }
      : {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          activeExamId: db.getActiveExamId(),
          exams: allExams,
          resources: db.getResources(),
        };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = examId ? `studyos_exam_${examId}_export.json` : `studyos_exams_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const title = examId ? `Exam Workspace (${examId})` : 'All Exam Workspaces';
    onShowNotification(`JSON export generated successfully for ${title}!`, 'Export JSON');
    logActivity(`Exported JSON snapshot for ${title}`, 'export');
  };

  // JSON Import Handler
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (parsed.exam && parsed.exam.id) {
          db.addExam(parsed.exam);
          if (Array.isArray(parsed.resources)) {
            parsed.resources.forEach((r: any) => db.addResource(r));
          }
          onShowNotification(`Imported exam workspace "${parsed.exam.title}"!`, 'Import Success');
          logActivity(`Imported exam workspace "${parsed.exam.title}"`, 'import');
        } else if (Array.isArray(parsed.exams)) {
          parsed.exams.forEach((exam: ExamItem) => db.addExam(exam));
          if (Array.isArray(parsed.resources)) {
            parsed.resources.forEach((r: any) => db.addResource(r));
          }
          onShowNotification(`Imported ${parsed.exams.length} exam workspaces from JSON!`, 'Import Success');
          logActivity(`Imported ${parsed.exams.length} exam workspaces from JSON backup`, 'import');
        } else {
          onShowNotification('Invalid JSON format: missing exam schema.', 'Import Failed');
        }
        refreshData();
      } catch (err) {
        onShowNotification('Failed to parse JSON file. Please check syntax.', 'Import Error');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    refreshData();
    const handleExamUpdate = () => refreshData();
    const handleActiveChange = () => setActiveExamId(db.getActiveExamId());

    window.addEventListener('studyos_exams_updated', handleExamUpdate);
    window.addEventListener('studyos_active_exam_changed', handleActiveChange);

    return () => {
      window.removeEventListener('studyos_exams_updated', handleExamUpdate);
      window.removeEventListener('studyos_active_exam_changed', handleActiveChange);
    };
  }, []);

  const handleSetActiveWorkspace = (examId: string, examTitle: string) => {
    db.setActiveExamId(examId);
    setActiveExamId(examId);
    onShowNotification(`Active Workspace Context switched to "${examTitle}"!`, 'Exam Workspace');
    logActivity(`Switched active workspace to "${examTitle}"`, 'switch');
  };

  const handleOpenCreateModal = () => {
    setEditingExam(null);
    setFormTitle('');
    setFormCode('');
    setFormCategory('Engineering');
    setFormPriority('High');
    setFormTargetScore('85/100');
    setFormExamDate(new Date(Date.now() + 180 * 84600000).toISOString().split('T')[0] || '');
    setFormRegDeadline('');
    setFormAdmitCardDate('');
    setFormResultDate('');
    setFormColor('purple');
    setFormPrepLevel('Intermediate');
    setFormTargetDailyHours(4);
    setFormOfficialUrl('');
    setFormNotes('');
    setFormSubjectsText('Algorithms & Data Structures, Operating Systems, Computer Networks, Discrete Mathematics');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (exam: ExamItem) => {
    setEditingExam(exam);
    setFormTitle(exam.title);
    setFormCode(exam.code);
    setFormCategory(exam.category);
    setFormPriority(exam.priority);
    setFormTargetScore(exam.targetScore || '');
    setFormExamDate(exam.examDate || '');
    setFormRegDeadline(exam.registrationDeadline || '');
    setFormAdmitCardDate(exam.admitCardDate || '');
    setFormResultDate(exam.resultDate || '');
    setFormColor(exam.color || 'purple');
    setFormPrepLevel(exam.preparationLevel || 'Intermediate');
    setFormTargetDailyHours(exam.targetDailyHours || 4);
    setFormOfficialUrl(exam.officialWebsiteUrl || '');
    setFormNotes(exam.notes || '');
    setFormSubjectsText(exam.subjects ? exam.subjects.map((s) => s.name).join(', ') : '');
    setIsModalOpen(true);
  };

  const handleSaveExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      onShowNotification('Exam Title is required.', 'Validation Error');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0] || '';

    // Build subject nodes from comma-separated input if edited
    const subjectNames = formSubjectsText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const subjectsList: ExamSubjectNode[] = subjectNames.map((name, idx) => ({
      id: `subj-${idx}-${Date.now()}`,
      name,
      weightagePercent: Math.round(100 / Math.max(1, subjectNames.length)),
      chapters: [
        {
          id: `chap-${idx}-1`,
          name: `${name} Fundamentals`,
          completed: false,
          topics: [
            { id: `top-${idx}-1`, name: 'Core Concepts & Definitions', status: 'In Progress', confidence: 3 },
            { id: `top-${idx}-2`, name: 'Standard PYQs & Problems', status: 'Not Started', confidence: 2 },
          ],
        },
      ],
    }));

    if (editingExam && editingExam.id) {
      const updated: ExamItem = {
        ...(editingExam as ExamItem),
        title: formTitle,
        code: formCode || formTitle.substring(0, 8).toUpperCase(),
        category: formCategory,
        priority: formPriority,
        targetScore: formTargetScore,
        examDate: formExamDate,
        registrationDeadline: formRegDeadline || undefined,
        admitCardDate: formAdmitCardDate || undefined,
        resultDate: formResultDate || undefined,
        color: formColor,
        preparationLevel: formPrepLevel,
        targetDailyHours: formTargetDailyHours,
        officialWebsiteUrl: formOfficialUrl || undefined,
        notes: formNotes,
        subjects: subjectsList.length > 0 ? subjectsList : (editingExam.subjects || []),
        updatedDate: todayStr,
      };

      db.updateExam(updated);
      onShowNotification(`Exam "${formTitle}" updated successfully!`, 'Exam Manager');
    } else {
      const newExam: ExamItem = {
        id: `exam-${Date.now()}`,
        title: formTitle,
        code: formCode || formTitle.substring(0, 8).toUpperCase(),
        category: formCategory,
        priority: formPriority,
        targetScore: formTargetScore,
        examDate: formExamDate,
        registrationDeadline: formRegDeadline || undefined,
        admitCardDate: formAdmitCardDate || undefined,
        resultDate: formResultDate || undefined,
        color: formColor,
        status: 'Active',
        readinessPercent: 25,
        preparationLevel: formPrepLevel,
        targetDailyHours: formTargetDailyHours,
        officialWebsiteUrl: formOfficialUrl || undefined,
        notes: formNotes,
        subjects: subjectsList,
        createdDate: todayStr,
        updatedDate: todayStr,
      };

      db.addExam(newExam);
      onShowNotification(`New exam "${formTitle}" created and added to workspaces!`, 'Exam Manager');
    }

    setIsModalOpen(false);
    refreshData();
  };

  const handleToggleArchive = (exam: ExamItem) => {
    if (exam.status === 'Archived') {
      db.restoreExam(exam.id);
      onShowNotification(`Exam "${exam.title}" restored to Active status.`, 'Exam Manager');
    } else {
      db.archiveExam(exam.id);
      onShowNotification(`Exam "${exam.title}" moved to Archived status.`, 'Exam Manager');
    }
    refreshData();
  };

  const handleDuplicateExam = (exam: ExamItem) => {
    const copy = db.duplicateExam(exam.id);
    if (copy) {
      onShowNotification(`Duplicated "${exam.title}" as "${copy.title}".`, 'Exam Manager');
      refreshData();
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    const title = deleteTarget.title;
    // Optimistic remove first so UI never keeps a deleted row
    setExams((prev) => prev.filter((e) => e.id !== id));
    setDeleteTarget(null);
    try {
      db.deleteExam(id);
      setActiveExamId(db.getActiveExamId());
      onShowNotification(`Exam "${title}" and all associated workspace data permanently deleted.`, 'Exam Manager');
    } catch (e) {
      console.error(e);
      refreshData();
      onShowNotification('Delete hit a storage error — list refreshed from database.', 'Exam Manager');
    }
    refreshData();
  };

  // Filter exams based on search, status, and category
  const filteredExams = exams.filter((exam) => {
    const matchesSearch =
      exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exam.notes && exam.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'All'
        ? true
        : statusFilter === 'Archived'
        ? exam.status === 'Archived'
        : statusFilter === 'Active'
        ? exam.status === 'Active'
        : exam.status === statusFilter;

    const matchesCategory = categoryFilter === 'All' || exam.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const activeExam = exams.find((e) => e.id === activeExamId) || exams[0];

  return (
    <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar p-4 md:p-6 space-y-6 font-sans select-none text-slate-800">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-3xl shadow-xl border border-purple-500/20">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
            <Award className="w-3.5 h-3.5 text-purple-300" />
            <span>Profile Settings → Exam Manager</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Competitive Exam Workspaces (CRUD)
          </h1>
          <p className="text-xs text-purple-200/80 font-medium max-w-2xl">
            Create, manage, archive, and isolate unlimited competitive exams. Each exam operates in a 100% independent workspace with its own syllabus, planners, flashcards, mock tests, and analytics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              if (onNavigate) {
                onNavigate('settings');
              } else if (typeof window !== 'undefined' && window.history) {
                window.history.back();
              }
            }}
            className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 rounded-2xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold border border-white/30 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Return to Settings"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Settings</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportJSON}
            accept=".json"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all cursor-pointer"
            title="Import Exam Workspace JSON Backup"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import JSON</span>
          </button>

          <button
            onClick={() => handleExportJSON()}
            className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all cursor-pointer"
            title="Export Full JSON Backup"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Backup</span>
          </button>

          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 rounded-2xl bg-purple-600/90 hover:bg-purple-600 text-white text-xs font-black border border-purple-400/40 transition-all cursor-pointer shadow-md shadow-purple-900/30"
            title="Open Task Template Repository & Import into Active Exam"
          >
            <Layers className="w-3.5 h-3.5 text-purple-200" />
            <span>Task Templates</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white text-xs font-extrabold shadow-lg shadow-purple-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Exam</span>
          </button>
        </div>
      </div>

      {/* Active Workspace Status Banner */}
      {activeExam && (
        <GlassCard className="p-4 bg-gradient-to-r from-purple-50 via-white to-indigo-50 border-purple-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-2xl bg-purple-600 text-white shadow-md shadow-purple-600/20 shrink-0">
                <Zap className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-600 text-white">
                    Active Workspace Context
                  </span>
                  <span className="text-xs font-bold text-slate-500">{activeExam.code}</span>
                </div>
                <h3 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
                  {activeExam.title}
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-extrabold text-slate-700 bg-white/80 p-2.5 rounded-2xl border border-purple-100">
              <div className="flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span>Exam Date: <strong className="text-purple-700 font-mono">{activeExam.examDate}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Target className="w-4 h-4 text-purple-600" />
                <span>Target Score: <strong className="text-purple-700 font-mono">{activeExam.targetScore}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-purple-600" />
                <span>Daily Target: <strong className="text-purple-700 font-mono">{activeExam.targetDailyHours}h/day</strong></span>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Controls: Search, Status Filter, Category Filter */}
      <GlassCard className="p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exams by title, code, or notes..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl overflow-x-auto text-xs font-bold text-slate-600 shrink-0">
            {['Active', 'Upcoming', 'Archived', 'Completed', 'All'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === st
                    ? 'bg-white text-purple-700 shadow-xs font-extrabold'
                    : 'hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center space-x-2 shrink-0">
            <Filter className="w-4 h-4 text-purple-600" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-purple-500"
            >
              <option value="All">All Categories</option>
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Exam Cards Grid */}
      <div className="flex flex-col gap-3">
        {filteredExams.length > 0 ? (
          filteredExams.map((exam) => {
            const isActive = exam.id === activeExamId;

            // Calculate days remaining
            const daysLeft = Math.ceil(
              (new Date(exam.examDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            );

            return (
              <div
                key={exam.id}
                className={`relative rounded-3xl border transition-all duration-300 flex flex-col justify-between overflow-hidden bg-white ${
                  isActive
                    ? 'border-purple-500 ring-2 ring-purple-500/30 shadow-xl shadow-purple-500/10'
                    : 'border-slate-200 hover:border-purple-300 shadow-md hover:shadow-lg'
                }`}
              >
                {/* Top Accent Color Strip */}
                <div className={`h-2.5 w-full ${exam.color === 'cyan' ? 'bg-cyan-500' : exam.color === 'emerald' ? 'bg-emerald-500' : exam.color === 'amber' ? 'bg-amber-500' : exam.color === 'rose' ? 'bg-rose-500' : exam.color === 'indigo' ? 'bg-indigo-500' : 'bg-purple-600'}`} />

                <div className="p-5 space-y-4 flex-1">
                  {/* Badges Bar */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                      {isActive ? (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-600 text-white shadow-xs">
                          <Check className="w-3 h-3" />
                          <span>Active Workspace</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {exam.status}
                        </span>
                      )}

                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                        {exam.category}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                        exam.priority === 'Critical'
                          ? 'bg-rose-100 text-rose-800'
                          : exam.priority === 'High'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {exam.priority}
                    </span>
                  </div>

                  {/* Title & Code */}
                  <div>
                    <div className="text-[10px] font-mono font-black text-purple-600">{exam.code}</div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight leading-snug">
                      {exam.title}
                    </h2>
                  </div>

                  {/* Readiness Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-extrabold">
                      <span className="text-slate-500">Readiness Score:</span>
                      <span className="text-purple-700 font-mono">{exam.readinessPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 h-full rounded-full transition-all"
                        style={{ width: `${exam.readinessPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-semibold pt-2 border-t border-slate-100">
                    <div className="bg-slate-50 p-2 rounded-xl">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Exam Date</div>
                      <div className="font-mono text-slate-800 font-black truncate">{exam.examDate}</div>
                      <div className={`text-[10px] font-bold ${daysLeft > 0 ? 'text-purple-600' : 'text-rose-600'}`}>
                        {daysLeft > 0 ? `${daysLeft} Days Remaining` : 'Exam Passed'}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2 rounded-xl">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Target Score</div>
                      <div className="font-mono text-slate-800 font-black truncate">{exam.targetScore}</div>
                      <div className="text-[10px] text-slate-500 font-bold">{exam.targetDailyHours}h Daily Commitment</div>
                    </div>
                  </div>

                  {/* Notes Preview if available */}
                  {exam.notes && (
                    <p className="text-xs text-slate-500 font-medium line-clamp-2 bg-purple-50/50 p-2 rounded-xl border border-purple-100/60 italic">
                      "{exam.notes}"
                    </p>
                  )}
                </div>

                {/* Footer Action Bar */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  {!isActive ? (
                    <button
                      onClick={() => handleSetActiveWorkspace(exam.id, exam.title)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold flex items-center justify-center space-x-1.5 shadow-xs transition-all"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Switch Workspace</span>
                    </button>
                  ) : (
                    <div className="flex-1 py-1.5 px-3 rounded-xl bg-purple-100 text-purple-800 text-xs font-black flex items-center justify-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                      <span>Active Workspace</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => handleDuplicateExam(exam)}
                      className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-purple-50 text-slate-600 hover:text-purple-700 transition-all"
                      title="Duplicate Exam Workspace"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(exam)}
                      className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-purple-50 text-slate-600 hover:text-purple-700 transition-all"
                      title="Edit Exam"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleToggleArchive(exam)}
                      className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-amber-50 text-slate-600 hover:text-amber-700 transition-all"
                      title={exam.status === 'Archived' ? 'Restore Exam' : 'Archive Exam'}
                    >
                      {exam.status === 'Archived' ? (
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Archive className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={() => setDeleteTarget(exam)}
                      className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-all"
                      title="Delete Exam & Purge Data"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
            <Award className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-black text-slate-800">No Competitive Exams Found</h3>
            <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
              No exams matched your search query or selected filters. Add a new exam to get started with a dedicated workspace.
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-extrabold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Exam</span>
            </button>
          </div>
        )}
      </div>

      {/* Storage Usage & Recent Activity Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Storage Footprint Analysis */}
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-purple-600" />
              <h3 className="text-sm font-black text-slate-900">Storage Usage & Data Footprint</h3>
            </div>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
              Isolated Workspaces
            </span>
          </div>

          <p className="text-xs text-slate-500 font-medium">
            Each exam maintains an isolated database partition for syllabus, flashcards, mock tests, and PDFs.
          </p>

          <div className="space-y-3 pt-1">
            {exams.slice(0, 4).map((ex) => {
              const subjCount = ex.subjects ? ex.subjects.length : 0;
              const estSizeKB = Math.round(15 + subjCount * 8 + (ex.attachmentsCount || 0) * 12);

              return (
                <div key={ex.id} className="space-y-1 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-800">{ex.title} ({ex.code})</span>
                    <span className="text-purple-600 font-mono">{estSizeKB} KB</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-purple-600 h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.max(15, (estSizeKB / 150) * 100))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                    <span>{subjCount} Subjects • {ex.attachmentsCount || 0} Attachments</span>
                    <button
                      onClick={() => handleExportJSON(ex.id)}
                      className="text-purple-600 hover:underline font-bold flex items-center gap-1"
                    >
                      <Download className="w-2.5 h-2.5" /> Export JSON
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Recent Activity Log */}
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-900">Recent Workspace Activity</h3>
            </div>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
              Live Audit Log
            </span>
          </div>

          <div className="space-y-2.5">
            {activities.map((act) => (
              <div key={act.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-start justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${act.type === 'switch' ? 'bg-purple-600' : act.type === 'create' ? 'bg-emerald-500' : act.type === 'export' ? 'bg-cyan-500' : 'bg-indigo-500'}`} />
                  <span className="font-semibold text-slate-800">{act.text}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono font-bold shrink-0">{act.time}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-purple-100 w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-purple-900 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-purple-300" />
                <h2 className="text-base font-black tracking-tight">
                  {editingExam ? 'Edit Exam Workspace' : 'Add New Competitive Exam'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-purple-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveExam} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">Exam Title *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. GATE Computer Science 2027"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Code */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">Code / Acronym</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. GATE-CS-2027"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ExamCategory)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-purple-500"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">Priority Level</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as ExamPriority)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-purple-500"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Exam Date */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">Exam Date *</label>
                  <input
                    type="date"
                    required
                    value={formExamDate}
                    onChange={(e) => setFormExamDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Target Score */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">Target Score / Rank</label>
                  <input
                    type="text"
                    value={formTargetScore}
                    onChange={(e) => setFormTargetScore(e.target.value)}
                    placeholder="e.g. 85/100 or AIR < 100"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Daily Target Hours */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">Daily Target Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="18"
                    value={formTargetDailyHours}
                    onChange={(e) => setFormTargetDailyHours(parseFloat(e.target.value) || 4)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Preparation Level */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">Preparation Level</label>
                  <select
                    value={formPrepLevel}
                    onChange={(e) => setFormPrepLevel(e.target.value as PreparationLevel)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-purple-500"
                  >
                    {PREP_LEVEL_OPTIONS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Registration Deadline */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">Registration Deadline</label>
                  <input
                    type="date"
                    value={formRegDeadline}
                    onChange={(e) => setFormRegDeadline(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Official Website */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">Official Website URL</label>
                  <input
                    type="url"
                    value={formOfficialUrl}
                    onChange={(e) => setFormOfficialUrl(e.target.value)}
                    placeholder="https://gate2027.iit.ac.in"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1.5">Theme Color</label>
                <div className="flex items-center space-x-3">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setFormColor(c.id)}
                      className={`w-7 h-7 rounded-full ${c.bg} transition-all flex items-center justify-center ${
                        formColor === c.id ? `ring-2 ${c.ring} ring-offset-2 scale-110` : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {formColor === c.id && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subjects List Input */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                  Subjects List (Comma Separated)
                </label>
                <input
                  type="text"
                  value={formSubjectsText}
                  onChange={(e) => setFormSubjectsText(e.target.value)}
                  placeholder="Algorithms, Operating Systems, Computer Networks, Discrete Math"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Strategy Notes */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1">Strategy & Preparation Notes</label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Notes regarding syllabus weightage, important chapters, or daily strategy..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-purple-500 custom-scrollbar"
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold shadow-sm"
                >
                  {editingExam ? 'Save Changes' : 'Create Exam Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CONFIRMATION MODAL FOR DELETION & DATA PURGE --- */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-rose-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 rounded-2xl bg-rose-100 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Delete Exam Workspace?</h3>
                <p className="text-xs font-bold text-rose-600">Permanent Data Purge Confirmation</p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-900 font-medium space-y-2">
              <p>
                Permanently delete <strong>"{deleteTarget.title}"</strong> ({deleteTarget.code}) and its entire local workspace?
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-rose-800">
                <li>Syllabus progress for this exam</li>
                <li>Lecture planner progress</li>
                <li>Notes &amp; Scratch Pad</li>
                <li>Flashcards &amp; revision data</li>
                <li>Analytics, Pomodoro history &amp; goals</li>
                <li>Mock tests, MCQs, mistakes &amp; PDFs</li>
              </ul>
              <p className="font-bold text-rose-700">
                Other exams are not affected. This cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-md shadow-rose-600/20"
              >
                Confirm Delete & Purge Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Task Template Repository Modal */}
      <TaskTemplateRepositoryModal
        isOpen={isTemplateModalOpen}
        onClose={() => {
          setIsTemplateModalOpen(false);
          refreshData();
        }}
        onShowNotification={onShowNotification}
        targetExamId={activeExamId}
      />
    </div>
  );
};
