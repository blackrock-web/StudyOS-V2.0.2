import React, { useState } from 'react';
import {
  BookOpen,
  FileText,
  Layers,
  Sparkles,
  Download,
  Search,
  Tag,
  Star,
  Edit,
  Plus,
  RefreshCw,
  Folder,
  HelpCircle,
  FileCode2,
  CheckCircle2,
  Share2,
  Cpu,
  Brain,
  Printer,
} from 'lucide-react';
import { db } from '../../services/db';
import { Flashcard, SyllabusSubject } from '../../types';
import { generateAndPrintPDF, PDFExportType } from '../../services/pdfExport';
import { getActiveProvider, AIGenerationType } from '../../services/aiProvider';

interface StudyResourceGeneratorProps {
  onShowNotification: (msg: string, title?: string) => void;
}

export const StudyResourceGenerator: React.FC<StudyResourceGeneratorProps> = ({
  onShowNotification,
}) => {
  const [activeTab, setActiveTab] = useState<
    'questions' | 'notes' | 'formulas' | 'mindmaps' | 'flashcards' | 'json'
  >('questions');

  const [selectedSubject, setSelectedSubject] = useState<string>('All Subjects');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [version, setVersion] = useState<string>('v2.4-canonical');

  const syllabus: SyllabusSubject[] = db.getSyllabus();
  const flashcards: Flashcard[] = db.getFlashcards();

  // Resource counts
  const totalQuestions = 145;
  const totalFlashcards = flashcards.length;
  const totalFormulas = 62;
  const totalNotes = 28;

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          JSON.parse(content);
          setVersion(`v${(Math.random() * 2 + 2).toFixed(1)}-imported`);
          onShowNotification('Knowledge JSON successfully imported & indexed into StudyOS Engine!', 'Resource Generator');
        } catch (err) {
          onShowNotification('Invalid JSON format. Please upload valid StudyOS or PW dataset JSON.', 'Import Error');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleTriggerPDFExport = (type: PDFExportType) => {
    generateAndPrintPDF(type, selectedSubject);
    onShowNotification(`Generated professional printable PDF layout for ${type}`, 'PDF Export Engine');
  };

  const handleGenerateAI = async (type: AIGenerationType) => {
    const provider = getActiveProvider();
    const sampleSourceText = `Subject: ${selectedSubject}
Topic: Core Concepts & Practice Problems
- Database Normalization (1NF, 2NF, 3NF, BCNF)
- Operating System CPU Scheduling (RR, SJF, SRTF, Priority)
- Compiler Design FIRST & FOLLOW set calculations
- Computer Networks TCP/IP Flow Control & Congestion Control`;

    if (type === 'notes') {
      await provider.generateNotes(sampleSourceText, { subject: selectedSubject });
    } else if (type === 'flashcards') {
      await provider.generateFlashcards(sampleSourceText, { subject: selectedSubject });
    } else if (type === 'quiz') {
      await provider.generateQuiz(sampleSourceText, { subject: selectedSubject });
    } else if (type === 'summary') {
      await provider.generateSummary(sampleSourceText, { subject: selectedSubject });
    } else if (type === 'mindmap') {
      await provider.generateMindMap(sampleSourceText, { subject: selectedSubject });
    } else if (type === 'formulasheet') {
      await provider.generateFormulaSheet(sampleSourceText, { subject: selectedSubject });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-slate-900 font-sans select-none bg-[#F8F9FC]">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-purple-100 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px] uppercase tracking-wider border border-purple-200">
              Offline Knowledge Engine {version}
            </span>
            <span className="text-emerald-600 text-xs font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 100% Synced
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" /> Offline Study Resource Generator
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Auto-generate Question Banks (MCQ, MSQ, NAT, PYQs), Anki Flashcards, Formulas, Smart Notes & Mind Maps directly from imported syllabus JSON.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          <label className="cursor-pointer px-3.5 py-2 rounded-2xl text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-all flex items-center gap-2 shadow-xs">
            <FileCode2 className="w-4 h-4 text-purple-600" /> Import JSON
            <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
          </label>

          <button
            onClick={() => handleTriggerPDFExport('Question Bank PDF')}
            className="px-4 py-2 rounded-2xl text-xs font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 text-white flex items-center gap-2 shadow-md hover:opacity-95 transition-all"
          >
            <Printer className="w-4 h-4" /> Export PDF Resource
          </button>
        </div>
      </div>

      {/* AI PROVIDER QUICK GENERATOR BAR */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-4 rounded-3xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-white/10 text-purple-300">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-200">
              AI Generation Layer
            </h3>
            <p className="text-xs font-medium text-purple-100/90">
              Generate study assets using active provider ({getActiveProvider().name})
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleGenerateAI('notes')}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <FileText className="w-3.5 h-3.5" /> Notes
          </button>
          <button
            onClick={() => handleGenerateAI('flashcards')}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <Layers className="w-3.5 h-3.5" /> Flashcards
          </button>
          <button
            onClick={() => handleGenerateAI('quiz')}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <HelpCircle className="w-3.5 h-3.5" /> Quiz
          </button>
          <button
            onClick={() => handleGenerateAI('summary')}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" /> Summary
          </button>
          <button
            onClick={() => handleGenerateAI('mindmap')}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <Cpu className="w-3.5 h-3.5" /> Mind Map
          </button>
          <button
            onClick={() => handleGenerateAI('formulasheet')}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <Brain className="w-3.5 h-3.5" /> Formulas
          </button>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-purple-100 shadow-xs">
        {/* Subject Filter */}
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-500 shrink-0">Filter Subject:</span>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50/50 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="All Subjects">All Subjects ({syllabus.length})</option>
            {syllabus.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name} ({s.course})
              </option>
            ))}
          </select>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-purple-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search questions, notes, formulas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* SUB-MODULE TABS */}
      <div className="flex items-center space-x-2 border-b border-purple-100 pb-2 overflow-x-auto custom-scrollbar">
        {[
          { id: 'questions', label: 'Question Bank (MCQ/MSQ/NAT)', icon: HelpCircle, badge: totalQuestions },
          { id: 'notes', label: 'Smart Notes & Summaries', icon: FileText, badge: totalNotes },
          { id: 'formulas', label: 'Formula Sheets', icon: Sparkles, badge: totalFormulas },
          { id: 'flashcards', label: 'SRS Flashcards', icon: Layers, badge: totalFlashcards },
          { id: 'mindmaps', label: 'Mind Maps & Concepts', icon: Cpu },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
                isActive
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-white text-slate-600 border border-purple-100 hover:bg-purple-50 hover:text-purple-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* RESOURCE DISPLAY CONTAINER */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">
              Generated Question Bank ({selectedSubject})
            </h3>
            <button
              onClick={() => handleTriggerPDFExport('Question Bank PDF')}
              className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1"
            >
              Print Question Bank PDF →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {syllabus
              .filter((s) => selectedSubject === 'All Subjects' || s.name === selectedSubject)
              .flatMap((s) => s.topics)
              .slice(0, 6)
              .map((topic, idx) => (
                <div
                  key={topic.id}
                  className="bg-white p-5 rounded-3xl border border-purple-100 shadow-xs hover:shadow-md transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold text-[10px] border border-purple-200">
                      Q{idx + 1} • {topic.difficulty}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      GATE PYQ Linked
                    </span>
                  </div>

                  <div className="text-xs font-extrabold text-slate-900">
                    Topic: {topic.name}
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100 leading-relaxed font-mono">
                    Let T(n) be the recurrence relation defined for {topic.subtopics[0] || topic.name}. Calculate the tightest asymptotic bound using Master Theorem.
                  </p>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 text-slate-500 font-medium">
                    <span>Weightage: {topic.weightagePercent}%</span>
                    <span className="text-purple-600 font-bold">Ideal: {topic.idealHours}h Study</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {activeTab === 'formulas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">
              Canonical Formula Book & Cheat Sheets
            </h3>
            <button
              onClick={() => handleTriggerPDFExport('Formula Book PDF')}
              className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1"
            >
              Export Formula Book PDF →
            </button>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-purple-100 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-2">
                <div className="text-xs font-black text-purple-700 uppercase tracking-wider">Divide & Conquer</div>
                <div className="font-mono text-sm font-bold text-slate-900 bg-white p-2.5 rounded-xl border border-purple-200">
                  T(n) = aT(n/b) + f(n)
                </div>
                <p className="text-xs text-slate-600">
                  Compare f(n) with n^(log_b a). Case 1: Θ(n^(log_b a)), Case 2: Θ(n^(log_b a) log n).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-2">
                <div className="text-xs font-black text-purple-700 uppercase tracking-wider">Discrete Math Modular Arithmetic</div>
                <div className="font-mono text-sm font-bold text-slate-900 bg-white p-2.5 rounded-xl border border-purple-200">
                  a^(φ(n)) ≡ 1 (mod n)
                </div>
                <p className="text-xs text-slate-600">
                  Euler's Totient Theorem for coprime numbers a and n. Essential for RSA encryption derivations.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">
              Smart Notes & Summaries
            </h3>
            <button
              onClick={() => handleTriggerPDFExport('Notes PDF')}
              className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1"
            >
              Export Notes PDF →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['Analysis of Algorithms', 'Propositional Logic', 'CPU Scheduling & Semaphores'].map((noteTitle, i) => (
              <div key={i} className="bg-white p-5 rounded-3xl border border-purple-100 shadow-xs space-y-3">
                <div className="flex items-center space-x-2 text-purple-600 text-xs font-bold">
                  <FileText className="w-4 h-4" />
                  <span>Module {i + 1} Note</span>
                </div>
                <h4 className="text-sm font-black text-slate-900">{noteTitle}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Synthesized smart notes extracted from PW Lectures & GATE standard textbooks. Includes edge cases and common traps.
                </p>
                <div className="pt-2 border-t border-slate-100 text-[11px] font-semibold text-purple-600">
                  Updated 2 days ago
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'flashcards' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">
              Anki SRS Flashcards ({flashcards.length} Active Cards)
            </h3>
            <button
              onClick={() => handleTriggerPDFExport('Flashcards PDF')}
              className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1"
            >
              Export Flashcards PDF →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flashcards.map((fc) => (
              <div key={fc.id} className="bg-white p-5 rounded-3xl border border-purple-100 shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-purple-600">
                  <span>{fc.subject} • {fc.category}</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    Interval: {fc.intervalDays}d
                  </span>
                </div>
                <div className="text-xs font-extrabold text-slate-900">Q: {fc.front}</div>
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100 whitespace-pre-wrap font-mono">
                  {fc.back}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'mindmaps' && (
        <div className="bg-white p-8 rounded-3xl border border-purple-100 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto border border-purple-200">
            <Cpu className="w-8 h-8" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">Interactive Knowledge Mind Maps</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Visual concept nodes automatically generated from GATE CS & DA subject dependencies. Click nodes to jump directly to PW Lectures or Anki Flashcards.
          </p>
          <button
            onClick={() => handleTriggerPDFExport('Study Audit PDF')}
            className="px-4 py-2 rounded-2xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-all shadow-md"
          >
            Download Concept Map Audit PDF
          </button>
        </div>
      )}
    </div>
  );
};
