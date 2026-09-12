import React, { useState, useMemo } from 'react';
import {
  Database,
  Plus,
  Search,
  History,
  FileText,
  Layers,
  BookOpen,
  HelpCircle,
  Award,
  Video,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  RefreshCw,
  Tag,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import {
  contentEngine,
  ContentItem,
  ContentItemType,
} from '../../services/contentEngine';
import { db } from '../../services/db';
import { VersionHistoryModal } from './VersionHistoryModal';
import { ContentSearchWidget } from './ContentSearchWidget';
import { runContentEngineMigrationTests, MigrationTestResult } from '../../services/__tests__/contentEngine.test.ts';

interface ContentEngineViewProps {
  onShowNotification?: (msg: string, title?: string) => void;
}

export const ContentEngineView: React.FC<ContentEngineViewProps> = ({
  onShowNotification,
}) => {
  const [activeTab, setActiveTab] = useState<ContentItemType | 'all'>('pyq');
  const [selectedItemForHistory, setSelectedItemForHistory] = useState<ContentItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);

  // Migration Verification State
  const [migrationTestResult, setMigrationTestResult] = useState<MigrationTestResult | null>(null);
  const [showMigrationDrawer, setShowMigrationDrawer] = useState<boolean>(false);

  // Form states for Create/Edit
  const [formType, setFormType] = useState<ContentItemType>('pyq');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formBody, setFormBody] = useState<string>('');
  const [formTags, setFormTags] = useState<string>('');
  const [formSubject, setFormSubject] = useState<string>(() => db.getCurrentExamSubjects()[0] || 'General Studies');
  const [formTopic, setFormTopic] = useState<string>('');
  const [formYear, setFormYear] = useState<string>('GATE 2026');
  const [formMarks, setFormMarks] = useState<number>(2);
  const [formDifficulty, setFormDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [formQuestionType, setFormQuestionType] = useState<'MCQ' | 'MSQ' | 'NAT'>('MCQ');
  const [formOptions, setFormOptions] = useState<string>('A) Option 1\nB) Option 2\nC) Option 3\nD) Option 4');
  const [formCorrectAnswer, setFormCorrectAnswer] = useState<string>('A');
  const [formExplanation, setFormExplanation] = useState<string>('');
  const [formScore, setFormScore] = useState<number>(80);
  const [formTotalMarks, setFormTotalMarks] = useState<number>(100);

  // Refresh trigger
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const items = useMemo(() => {
    // Depend on refreshKey to re-fetch from contentEngine
    void refreshKey;
    if (activeTab === 'all') {
      return contentEngine.getAllItems();
    }
    return contentEngine.getItemsByType(activeTab);
  }, [activeTab, refreshKey]);

  const handleRunMigrationTest = () => {
    const result = runContentEngineMigrationTests();
    setMigrationTestResult(result);
    setShowMigrationDrawer(true);
    setRefreshKey((k) => k + 1);
    if (onShowNotification) {
      onShowNotification(
        result.passed
          ? 'Migration verification test PASSED! Counts & SRS fields matched.'
          : 'Migration verification test completed with warnings.',
        'Content Engine'
      );
    }
  };

  const handleOpenCreateModal = (type: ContentItemType = activeTab === 'all' ? 'pyq' : activeTab) => {
    setEditingItem(null);
    setFormType(type);
    setFormTitle('');
    setFormBody('');
    setFormTags('');
    setFormSubject(db.getCurrentExamSubjects()[0] || 'General Studies');
    setFormTopic('');
    setFormYear('GATE 2026');
    setFormMarks(2);
    setFormDifficulty('Medium');
    setFormQuestionType('MCQ');
    setFormOptions('A) Option 1\nB) Option 2\nC) Option 3\nD) Option 4');
    setFormCorrectAnswer('A');
    setFormExplanation('');
    setFormScore(80);
    setFormTotalMarks(100);
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (item: ContentItem) => {
    setEditingItem(item);
    setFormType(item.type);
    setFormTitle(item.title);
    setFormBody(item.body);
    setFormTags(item.tags?.join(', ') || '');
    setFormSubject(item.metadata.subject || 'Algorithms');
    setFormTopic(item.metadata.topic || '');
    setFormYear(item.metadata.year || 'GATE 2026');
    setFormMarks(item.metadata.marks || 2);
    setFormDifficulty(item.metadata.difficulty || 'Medium');
    setFormQuestionType(item.metadata.questionType || 'MCQ');
    setFormOptions(item.metadata.options?.join('\n') || '');
    setFormCorrectAnswer(item.metadata.correctAnswer || 'A');
    setFormExplanation(item.metadata.explanation || '');
    setFormScore(item.metadata.score || 80);
    setFormTotalMarks(item.metadata.totalMarks || 100);
    setShowCreateModal(true);
  };

  const handleSaveItem = () => {
    if (!formTitle.trim()) return;

    const parsedTags = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const parsedOptions = formOptions
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean);

    if (editingItem) {
      contentEngine.updateItem(
        editingItem.id,
        {
          title: formTitle,
          body: formBody,
          tags: parsedTags,
          metadata: {
            ...editingItem.metadata,
            subject: formSubject,
            topic: formTopic,
            year: formYear,
            marks: formMarks,
            difficulty: formDifficulty,
            questionType: formQuestionType,
            options: parsedOptions,
            correctAnswer: formCorrectAnswer,
            explanation: formExplanation,
            score: formScore,
            totalMarks: formTotalMarks,
          },
        },
        'User',
        'Updated via Content Engine UI'
      );
      if (onShowNotification) {
        onShowNotification(`Updated "${formTitle}" (Version history appended)`, 'Content Engine');
      }
    } else {
      contentEngine.createItem({
        type: formType,
        title: formTitle,
        body: formBody,
        tags: parsedTags,
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          subject: formSubject,
          topic: formTopic,
          year: formYear,
          marks: formMarks,
          difficulty: formDifficulty,
          questionType: formQuestionType,
          options: parsedOptions,
          correctAnswer: formCorrectAnswer,
          explanation: formExplanation,
          score: formScore,
          totalMarks: formTotalMarks,
        },
      });
      if (onShowNotification) {
        onShowNotification(`Created new ${formType.toUpperCase()}: "${formTitle}"`, 'Content Engine');
      }
    }

    setShowCreateModal(false);
    setRefreshKey((k) => k + 1);
  };

  const handleDeleteItem = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      contentEngine.deleteItem(id);
      setRefreshKey((k) => k + 1);
      if (onShowNotification) {
        onShowNotification(`Deleted "${title}"`, 'Content Engine');
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-indigo-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-purple-800/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-purple-400" />
            <h1 className="text-xl font-black tracking-tight">Canonical Content Engine</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/30 text-purple-200 border border-purple-400/30">
              Single Storage Layer
            </span>
          </div>
          <p className="text-xs text-purple-200/80 max-w-2xl">
            Unified storage and retrieval engine for PYQs, Question Banks, Mock Tests, Notes, Flashcards, and PDFs with non-destructive version history.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleRunMigrationTest}
            className="px-3.5 py-2 rounded-xl bg-purple-800/60 hover:bg-purple-700/80 text-purple-100 text-xs font-bold border border-purple-500/40 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 text-purple-300" />
            <span>Verify Migration</span>
          </button>

          <button
            onClick={() => handleOpenCreateModal()}
            className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>New Content Item</span>
          </button>
        </div>
      </div>

      {/* Migration Drawer Status */}
      {showMigrationDrawer && migrationTestResult && (
        <div className="bg-white border border-purple-200 rounded-2xl p-5 shadow-lg space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-purple-100 pb-3">
            <div className="flex items-center gap-2">
              {migrationTestResult.passed ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-500" />
              )}
              <h3 className="text-sm font-bold text-slate-900">
                Migration Verification Audit Report
              </h3>
            </div>
            <button
              onClick={() => setShowMigrationDrawer(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(migrationTestResult.countsAfter).map(([type, count]) => (
              <div
                key={type}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center"
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase">{type}</div>
                <div className="text-lg font-black text-slate-900 mt-0.5">
                  {count} <span className="text-[10px] text-emerald-500 font-normal">verified</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 p-3 rounded-xl text-emerald-400 font-mono text-[11px] space-y-1 max-h-36 overflow-y-auto">
            {migrationTestResult.testLogs.map((log, idx) => (
              <div key={idx}>{log}</div>
            ))}
          </div>
        </div>
      )}

      {/* Main Search Component */}
      <ContentSearchWidget
        onSelectItem={(item) => setSelectedItemForHistory(item)}
        placeholder="Search repository items by title, body content, subject, topic, or tags..."
      />

      {/* Filter Tabs & List View */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
          {[
            { id: 'pyq', label: 'PYQs & MCQs', icon: HelpCircle },
            { id: 'question_bank', label: 'Question Banks', icon: Database },
            { id: 'mock_test', label: 'Mock Tests', icon: Award },
            { id: 'note', label: 'Notes', icon: FileText },
            { id: 'flashcard', label: 'Flashcards', icon: Layers },
            { id: 'pdf', label: 'PDF Documents', icon: BookOpen },
            { id: 'all', label: 'All Content Items', icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Item Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-purple-300 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 uppercase">
                    {item.type}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock className="w-3 h-3 text-purple-500" />
                    <span>v{item.versionHistory?.length || 1}</span>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-slate-900 line-clamp-1">
                  {item.title}
                </h3>

                <p className="text-xs text-slate-600 line-clamp-3 font-mono text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {item.body}
                </p>

                {item.metadata.subject && (
                  <div className="text-[11px] font-semibold text-purple-600 flex items-center gap-1">
                    <span>Subject: {item.metadata.subject}</span>
                    {item.metadata.topic && <span>• {item.metadata.topic}</span>}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setSelectedItemForHistory(item)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="View Version History Snapshots"
                >
                  <History className="w-3.5 h-3.5 text-purple-500" />
                  <span>History ({item.versionHistory?.length || 1})</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditModal(item)}
                    className="p-1.5 text-slate-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 transition-all cursor-pointer"
                    title="Edit Item"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id, item.title)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                    title="Delete Item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Version History Modal */}
      {selectedItemForHistory && (
        <VersionHistoryModal
          item={selectedItemForHistory}
          onClose={() => setSelectedItemForHistory(null)}
          onVersionRestored={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-900">
              {editingItem ? `Edit Item (Appends to Version Array)` : `Create New ${formType.toUpperCase()}`}
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  disabled={!!editingItem}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value="pyq">PYQ / Question</option>
                  <option value="question_bank">Question Bank</option>
                  <option value="mock_test">Mock Test</option>
                  <option value="note">Note</option>
                  <option value="flashcard">Flashcard</option>
                  <option value="pdf">PDF Document</option>
                  <option value="book">Book</option>
                  <option value="video">Video</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. GATE CS 2026 Algorithms Recurrence MCQ"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Body Content / Question Text / Content Pointer
                </label>
                <textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  rows={4}
                  placeholder="Enter full content or question statement..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              {formType === 'pyq' && (
                <div className="space-y-3 bg-purple-50/50 p-3.5 rounded-xl border border-purple-100">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Subject</label>
                      <input
                        type="text"
                        value={formSubject}
                        onChange={(e) => setFormSubject(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Topic</label>
                      <input
                        type="text"
                        value={formTopic}
                        onChange={(e) => setFormTopic(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Options (One per line)</label>
                    <textarea
                      value={formOptions}
                      onChange={(e) => setFormOptions(e.target.value)}
                      rows={3}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Correct Answer</label>
                      <input
                        type="text"
                        value={formCorrectAnswer}
                        onChange={(e) => setFormCorrectAnswer(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Year / Exam</label>
                      <input
                        type="text"
                        value={formYear}
                        onChange={(e) => setFormYear(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="algorithms, gate, pyq, 2026"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md"
              >
                Save Content Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
