import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Layers,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
  AlertCircle,
  BarChart3,
  Bookmark,
  Check,
  ChevronRight,
  Code,
  FileCode2,
  HelpCircle,
  PenTool,
  Trash2,
  X,
} from 'lucide-react';
import { db } from '../../services/db';
import { QuestionMCQ, MockTestRecord, GeneratedTestSeries, MistakeEntry } from '../../types';
import { GlassCard } from '../shared/GlassCard';
import { getAllSubjectOptions } from '../../data/subjectRegistry';
import { TestTakingSession } from './TestTakingSession';
import { TestResultView } from './TestResultView';
import { TestGeneratorModal } from './TestGeneratorModal';
import { QuestionImportWorkspace } from './QuestionImportWorkspace';

interface PracticeHubProps {
  onShowNotification: (msg: string, title?: string) => void;
  onNavigate?: (tab: string) => void;
}

export const PracticeHub: React.FC<PracticeHubProps> = ({ onShowNotification, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'tests' | 'questions' | 'import' | 'generator' | 'mistakes'>('tests');

  // Question bank and tests from db
  const [questions, setQuestions] = useState<QuestionMCQ[]>(() => db.getMCQs());
  const [mockTests, setMockTests] = useState<MockTestRecord[]>(() => db.getMockTests());
  const [customSeries, setCustomSeries] = useState<GeneratedTestSeries[]>(() => db.getTestSeries());
  const [mistakes, setMistakes] = useState<MistakeEntry[]>(() => db.getMistakes());

  // Active Test Taking Session
  const [activeTestToTake, setActiveTestToTake] = useState<{
    id: string;
    title: string;
    durationMinutes: number;
    negativeMarking: boolean;
    questions: QuestionMCQ[];
  } | null>(null);

  // Test Results View State
  const [completedTestResult, setCompletedTestResult] = useState<{
    testId: string;
    testTitle: string;
    questions: QuestionMCQ[];
    userAnswers: Record<string, string>;
    durationMinutes: number;
    timeSpentSeconds: number;
    score: number;
    totalMarks: number;
    correctCount: number;
    incorrectCount: number;
    unansweredCount: number;
    accuracy: number;
  } | null>(null);

  // Show Generator Modal
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);

  // Filter states for questions tab
  const [questionSearch, setQuestionSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [availableSubjects, setAvailableSubjects] = useState<string[]>(() => db.getCurrentExamSubjects());

  // Synchronization with db events
  useEffect(() => {
    const refreshData = () => {
      setQuestions(db.getMCQs());
      setMockTests(db.getMockTests());
      setCustomSeries(db.getTestSeries());
      setMistakes(db.getMistakes());
      setAvailableSubjects(db.getCurrentExamSubjects());
    };

    window.addEventListener('studyos_mcqs_updated', refreshData);
    window.addEventListener('studyos_test_series_updated', refreshData);
    window.addEventListener('studyos_mock_tests_updated', refreshData);
    window.addEventListener('studyos_active_exam_changed', refreshData);
    window.addEventListener('studyos_exams_updated', refreshData);
    window.addEventListener('studyos_syllabus_updated', refreshData);
    window.addEventListener('studyos_db_updated', refreshData);
    window.addEventListener('storage', refreshData);

    return () => {
      window.removeEventListener('studyos_mcqs_updated', refreshData);
      window.removeEventListener('studyos_test_series_updated', refreshData);
      window.removeEventListener('studyos_mock_tests_updated', refreshData);
      window.removeEventListener('studyos_active_exam_changed', refreshData);
      window.removeEventListener('studyos_exams_updated', refreshData);
      window.removeEventListener('studyos_syllabus_updated', refreshData);
      window.removeEventListener('studyos_db_updated', refreshData);
      window.removeEventListener('storage', refreshData);
    };
  }, []);

  // Filtered Questions list
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const qText = q.questionText || q.question || '';
      const matchSearch =
        !questionSearch ||
        qText.toLowerCase().includes(questionSearch.toLowerCase()) ||
        q.subject.toLowerCase().includes(questionSearch.toLowerCase()) ||
        (q.topic && q.topic.toLowerCase().includes(questionSearch.toLowerCase()));

      const matchSubject = selectedSubject === 'All' || q.subject === selectedSubject;
      const matchDiff = selectedDifficulty === 'All' || q.difficulty === selectedDifficulty;
      const matchType = selectedType === 'All' || q.type === selectedType;

      return matchSearch && matchSubject && matchDiff && matchType;
    });
  }, [questions, questionSearch, selectedSubject, selectedDifficulty, selectedType]);

  // Start test handler
  const handleStartCustomTest = (series: GeneratedTestSeries) => {
    setActiveTestToTake({
      id: series.id,
      title: series.title,
      durationMinutes: series.durationMinutes || 60,
      negativeMarking: series.negativeMarking !== false,
      questions: series.questions.length > 0 ? series.questions : questions.slice(0, 10),
    });
  };

  const handleStartMockTest = (mock: MockTestRecord) => {
    const mockTitle = mock.title || mock.testName || 'Official Mock Test';
    const mockQs = questions.filter((q) => q.subject.includes(mockTitle.split(' ')[0] || '') || questions.length < 10)
      .slice(0, mock.totalQuestions || 15);
    const fallbackQs = mockQs.length > 0 ? mockQs : questions.slice(0, 15);

    setActiveTestToTake({
      id: mock.id,
      title: mockTitle,
      durationMinutes: mock.durationMinutes || 60,
      negativeMarking: true,
      questions: fallbackQs,
    });
  };

  const handleTestFinish = (result: any) => {
    // Save result to db mock tests
    const mockRecord: MockTestRecord = {
      id: `attempt-${Date.now()}`,
      testName: result.testTitle,
      title: result.testTitle,
      testDate: new Date().toISOString().split('T')[0] || '',
      date: new Date().toISOString().split('T')[0] || '',
      score: result.score,
      totalMarks: result.totalMarks,
      accuracyPercent: result.accuracy,
      durationMinutes: result.durationMinutes,
      completed: true,
    };
    db.addMockTest(mockRecord);

    // If it was a custom test series, update its status
    const series = customSeries.find((s) => s.id === result.testId);
    if (series) {
      db.updateTestSeries({
        ...series,
        completed: true,
        lastAttemptScore: result.score,
        lastAttemptDate: new Date().toISOString().split('T')[0],
      });
    }

    setActiveTestToTake(null);
    setCompletedTestResult(result);
  };

  // If in active test taking mode
  if (activeTestToTake) {
    return (
      <TestTakingSession
        test={activeTestToTake}
        onCancel={() => {
          if (window.confirm('Are you sure you want to exit this test session? Your current progress will not be saved.')) {
            setActiveTestToTake(null);
          }
        }}
        onFinish={handleTestFinish}
        onShowNotification={onShowNotification}
      />
    );
  }

  // If viewing test results
  if (completedTestResult) {
    return (
      <TestResultView
        result={completedTestResult}
        onBackToHub={() => setCompletedTestResult(null)}
        onRetakeTest={() => {
          const testToRetake = {
            id: completedTestResult.testId,
            title: completedTestResult.testTitle,
            durationMinutes: completedTestResult.durationMinutes,
            negativeMarking: true,
            questions: completedTestResult.questions,
          };
          setCompletedTestResult(null);
          setActiveTestToTake(testToRetake);
        }}
        onShowNotification={onShowNotification}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header & Tabs */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-indigo-600 text-white font-black shadow-lg shadow-purple-500/20">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Practice & Test Series Engine</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-700">
                  {questions.length} Questions
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Full-featured question bank, JSON/PDF extraction pipeline, custom test series generator, and timed exam simulation.
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('import')}
              className="px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Upload className="w-4 h-4" />
              <span>Import Questions</span>
            </button>
            <button
              onClick={() => setShowGeneratorModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:opacity-95 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-purple-500/25 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Test Series</span>
            </button>
          </div>
        </div>

        {/* Primary Sub-Tabs */}
        <div className="flex items-center gap-2 border-b border-purple-100/80 pt-2 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('tests')}
            className={`px-4 py-2.5 border-b-2 text-xs font-black flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'tests'
                ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-xl'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Play className="w-4 h-4" />
            <span>Test Series & Mocks</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-200 text-purple-900 font-extrabold">
              {customSeries.length + mockTests.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-2.5 border-b-2 text-xs font-black flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'questions'
                ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-xl'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Question Bank & PYQs</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 font-extrabold">
              {questions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2.5 border-b-2 text-xs font-black flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'import'
                ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-xl'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>JSON & PDF Ingestion Pipeline</span>
          </button>

          <button
            onClick={() => setActiveTab('mistakes')}
            className={`px-4 py-2.5 border-b-2 text-xs font-black flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'mistakes'
                ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-xl'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Mistake Notebook</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 font-extrabold">
              {mistakes.length}
            </span>
          </button>
        </div>
      </GlassCard>

      {/* 2. TAB CONTENT: TEST SERIES & MOCKS */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          {/* Custom Generated Test Series */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Custom Generated Test Series</span>
                <span className="text-xs font-bold text-slate-400 font-mono">({customSeries.length})</span>
              </h3>
              <button
                onClick={() => setShowGeneratorModal(true)}
                className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Generate New Test
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customSeries.map((series) => (
                <GlassCard key={series.id} className="p-5 space-y-4 hover:border-purple-300 transition-all flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-100">
                        {series.subject}
                      </span>
                      {series.completed ? (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Attempted
                        </span>
                      ) : (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Ready
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-black text-slate-900 leading-tight">{series.title}</h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Topics: {series.topics && series.topics.length > 0 ? series.topics.join(', ') : 'All Syllabus'}
                    </p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="font-mono font-black text-slate-800">{series.totalQuestions}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Questions</div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="font-mono font-black text-slate-800">{series.durationMinutes}m</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Duration</div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="font-mono font-black text-purple-700">
                          {series.lastAttemptScore !== undefined ? `${series.lastAttemptScore}` : `${series.totalMarks} M`}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">
                          {series.lastAttemptScore !== undefined ? 'Score' : 'Marks'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartCustomTest(series)}
                        className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/20 transition-all cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>{series.completed ? 'Re-take Test' : 'Start Test Now'}</span>
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete test series "${series.title}"?`)) {
                            db.deleteTestSeries(series.id);
                            setCustomSeries(db.getTestSeries());
                            onShowNotification('Test series deleted', 'Practice');
                          }
                        }}
                        className="p-2.5 rounded-xl bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete Test Series"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              ))}

              {customSeries.length === 0 && (
                <div className="col-span-full p-8 text-center bg-white border border-dashed border-purple-200 rounded-3xl space-y-3">
                  <Sparkles className="w-8 h-8 text-purple-400 mx-auto" />
                  <h4 className="text-sm font-black text-slate-800">No Custom Test Series Generated Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Use our test generator to build custom subject tests, topic quizzes, or full mock exams from your question bank.
                  </p>
                  <button
                    onClick={() => setShowGeneratorModal(true)}
                    className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-md hover:bg-purple-700 transition-all cursor-pointer"
                  >
                    Generate First Test Series
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Standard Mock Tests */}
          <div className="space-y-3 pt-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" />
              <span>Full Length & Sectional Mock Exams</span>
              <span className="text-xs font-bold text-slate-400 font-mono">({mockTests.length})</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mockTests.map((mock) => (
                <GlassCard key={mock.id} className="p-5 space-y-4 hover:border-indigo-300 transition-all flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                        Official Pattern
                      </span>
                      {mock.completed ? (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Score: {mock.score}/{mock.totalMarks}
                        </span>
                      ) : (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          Unattempted
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-black text-slate-900 leading-tight">{mock.title || mock.testName}</h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Date: {mock.date || mock.testDate} • Standard negative marking (-0.33 / -0.66)
                    </p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="font-mono font-black text-slate-800">{mock.totalQuestions || 65}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Questions</div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="font-mono font-black text-slate-800">{mock.durationMinutes || 180}m</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Time Limit</div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="font-mono font-black text-indigo-700">{mock.totalMarks || 100} M</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Total Marks</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartMockTest(mock)}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{mock.completed ? 'Re-attempt Mock Test' : 'Start Mock Exam'}</span>
                    </button>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB CONTENT: QUESTION BANK & PYQS */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <GlassCard className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search questions, topics, code snippets..."
                value={questionSearch}
                onChange={(e) => setQuestionSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              {questionSearch && (
                <button onClick={() => setQuestionSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 text-xs"
              >
                <option value="All">All Subjects</option>
                {availableSubjects.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 text-xs"
              >
                <option value="All">All Difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 text-xs"
              >
                <option value="All">All Types (MCQ/MSQ/NAT)</option>
                <option value="MCQ">MCQ (Single Select)</option>
                <option value="MSQ">MSQ (Multi Select)</option>
                <option value="NAT">NAT (Numerical)</option>
              </select>
            </div>
          </GlassCard>

          {/* Questions Grid / List */}
          <div className="space-y-3">
            {filteredQuestions.map((q, idx) => (
              <GlassCard key={q.id} className="p-5 space-y-3 hover:border-purple-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md font-mono">
                      Q{idx + 1}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {q.subject}
                    </span>
                    {q.topic && (
                      <span className="text-[10px] font-bold text-slate-500">
                        • {q.topic}
                      </span>
                    )}
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                      q.difficulty === 'Hard' ? 'bg-rose-100 text-rose-700' : q.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {q.difficulty}
                    </span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono">
                      {q.marks || 1} Mark{(q.marks || 1) > 1 ? 's' : ''}
                    </span>
                    {q.year && (
                      <span className="text-[10px] font-mono text-purple-600 font-bold">
                        [GATE {q.year}]
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      if (window.confirm('Delete this question from question bank?')) {
                        db.deleteMCQ(q.id);
                        setQuestions(db.getMCQs());
                        onShowNotification('Question removed', 'Question Bank');
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete Question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Question Text */}
                <p className="text-xs font-bold text-slate-900 leading-relaxed whitespace-pre-wrap">
                  {q.questionText || q.question}
                </p>

                {/* Options Grid */}
                {q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    {q.options.map((opt, oIdx) => {
                      const optLabel = String.fromCharCode(65 + oIdx);
                      const isCorrect = q.correctAnswer === optLabel || q.correctAnswer === opt;
                      return (
                        <div
                          key={oIdx}
                          className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                            isCorrect
                              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 font-bold'
                              : 'bg-slate-50/60 border-slate-200 text-slate-700'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                            isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {optLabel}
                          </span>
                          <span className="flex-1">{opt}</span>
                          {isCorrect && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Explanation */}
                {q.explanation && (
                  <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 text-xs text-purple-950 space-y-1">
                    <span className="font-extrabold uppercase text-[10px] text-purple-700 block">Explanation & Solution:</span>
                    <p className="text-[11px] font-medium leading-relaxed">{q.explanation}</p>
                  </div>
                )}
              </GlassCard>
            ))}

            {filteredQuestions.length === 0 && (
              <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-2">
                <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="text-sm font-black text-slate-800">No Questions Match Your Filter</h4>
                <p className="text-xs text-slate-500">Try adjusting your search keywords or subject filter.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TAB CONTENT: JSON & PDF EXTRACTION PIPELINE */}
      {activeTab === 'import' && (
        <QuestionImportWorkspace
          onQuestionsImported={(newQs) => {
            newQs.forEach((q) => db.addMCQ(q));
            setQuestions(db.getMCQs());
            onShowNotification(`Successfully added ${newQs.length} questions to Question Bank!`, 'Import Completed');
            setActiveTab('questions');
          }}
          onShowNotification={onShowNotification}
        />
      )}

      {/* 5. TAB CONTENT: MISTAKE NOTEBOOK */}
      {activeTab === 'mistakes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">Mistake & Error Notebook</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Catalog of questions answered incorrectly during practice tests. Review conceptual flaws and formula traps.
              </p>
            </div>
            {mistakes.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Clear all mistake notebook entries?')) {
                    db.setMistakes([]);
                    setMistakes([]);
                    onShowNotification('Mistake notebook cleared', 'Mistakes');
                  }
                }}
                className="text-xs text-rose-600 hover:underline font-bold cursor-pointer"
              >
                Clear All Mistakes
              </button>
            )}
          </div>

          <div className="space-y-3">
            {mistakes.map((m, idx) => (
              <GlassCard key={m.id || idx} className="p-5 space-y-3 border-l-4 border-l-rose-500">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                      {m.subject}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">• {m.topic || 'General'}</span>
                    <span className="text-[10px] font-mono text-slate-400">Date: {m.date || m.dateAdded || 'Recorded'}</span>
                  </div>
                  <button
                    onClick={() => {
                      db.deleteMistake(m.id);
                      setMistakes(db.getMistakes());
                      onShowNotification('Mistake entry removed', 'Mistake Notebook');
                    }}
                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs font-bold text-slate-900 leading-relaxed">
                  {m.question || m.questionTitle || m.questionStatement}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
                    <span className="text-[10px] font-extrabold uppercase block text-rose-600">Your Chosen Answer:</span>
                    <span className="font-black">{m.userChoice || m.wrongAnswerGiven || 'Incorrect Selection'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                    <span className="text-[10px] font-extrabold uppercase block text-emerald-600">Correct Answer:</span>
                    <span className="font-black">{m.correctChoice || m.correctAnswer}</span>
                  </div>
                </div>

                {(m.reason || m.errorReason || m.solutionExplanation) && (
                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-amber-800 block">Root Cause / Conceptual Flaw:</span>
                    <p className="text-[11px] font-medium leading-relaxed">{m.reason || m.errorReason || m.solutionExplanation}</p>
                  </div>
                )}
              </GlassCard>
            ))}

            {mistakes.length === 0 && (
              <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-black text-slate-800">Clean Mistake Notebook</h4>
                <p className="text-xs text-slate-500">
                  Any question you get wrong in mock tests or practice tests will automatically appear here for revision.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Test Generator Modal */}
      {showGeneratorModal && (
        <TestGeneratorModal
          questions={questions}
          onClose={() => setShowGeneratorModal(false)}
          onGenerated={(newSeries) => {
            db.addTestSeries(newSeries);
            setCustomSeries(db.getTestSeries());
            setShowGeneratorModal(false);
            onShowNotification(`Generated test series "${newSeries.title}" with ${newSeries.totalQuestions} questions!`, 'Test Created');
            setActiveTab('tests');
          }}
          onShowNotification={onShowNotification}
        />
      )}
    </div>
  );
};
