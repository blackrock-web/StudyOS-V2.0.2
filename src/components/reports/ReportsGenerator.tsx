import React, { useState } from 'react';
import {
  Download,
  FileText,
  Printer,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  BarChart3,
  Brain,
  Award,
} from 'lucide-react';
import { db } from '../../services/db';
import { generateAndPrintPDF, PDFExportType } from '../../services/pdfExport';
import { GlassCard } from '../shared/GlassCard';

interface ReportsGeneratorProps {
  onShowNotification: (msg: string, title?: string) => void;
}

export const ReportsGenerator: React.FC<ReportsGeneratorProps> = ({ onShowNotification }) => {
  const [selectedReport, setSelectedReport] = useState<PDFExportType>('Reports PDF');

  const handleExportPDF = (type: PDFExportType) => {
    generateAndPrintPDF(type);
    onShowNotification(`Generated professional printable PDF layout for ${type}`, 'Standardized PDF Engine');
  };

  const reportTypesList: { type: PDFExportType; label: string; desc: string; icon: any }[] = [
    { type: 'Reports PDF', label: 'Study Audit PDF', desc: 'Complete academic record & PW lecture progress', icon: FileText },
    { type: 'Question Bank PDF', label: 'Question Bank PDF', desc: 'MCQ, MSQ, NAT & PYQ topic-wise collections', icon: Brain },
    { type: 'Flashcards PDF', label: 'Flashcards PDF', desc: 'Double-sided printable Anki SRS flashcards', icon: Award },
    { type: 'Formula Book PDF', label: 'Formula Book PDF', desc: 'High-yield formulas & quick-reference cheat sheet', icon: CheckCircle2 },
    { type: 'Planner PDF', label: 'Planner PDF', desc: 'Re-anchored daily study schedule & task calendar', icon: Calendar },
    { type: 'Analytics PDF', label: 'Analytics PDF', desc: 'Study hours breakdown & mock test performance', icon: BarChart3 },
    { type: 'Study Audit PDF', label: 'Official GATE Audit PDF', desc: 'Comprehensive GATE 2027 readiness verification', icon: ShieldCheck },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-[#1e1b4b] font-sans select-none">
      {/* Header */}
      <GlassCard className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5">
        <div>
          <div className="text-[10px] uppercase font-mono tracking-widest text-purple-600 font-black">
            Standardized Single Format Export Engine
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-0.5 flex items-center gap-2">
            <Printer className="w-6 h-6 text-purple-600" /> Printable PDF Reports & Study Audits
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Generate printable PDF reports with cover page, table of contents, headers/footers, and subject-wise formatting.
          </p>
        </div>

        <button
          onClick={() => handleExportPDF(selectedReport)}
          className="px-4 py-2.5 rounded-2xl text-xs font-black bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] text-white flex items-center gap-2 shadow-md hover:opacity-95 transition-all shrink-0"
        >
          <Printer className="w-4 h-4" /> Export {selectedReport}
        </button>
      </GlassCard>

      {/* PDF Export Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypesList.map((item) => {
          const Icon = item.icon;
          const isSelected = selectedReport === item.type;
          return (
            <GlassCard
              key={item.type}
              onClick={() => setSelectedReport(item.type)}
              className={`p-5 cursor-pointer transition-all space-y-3 ${
                isSelected
                  ? 'bg-gradient-to-br from-purple-100/80 to-pink-50/80 border-purple-300 ring-2 ring-purple-500/20 shadow-md -translate-y-0.5'
                  : 'hover:border-purple-200 hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`p-2.5 rounded-2xl ${isSelected ? 'bg-gradient-to-tr from-[#8b5cf6] to-[#ec4899] text-white' : 'bg-purple-50 text-purple-600'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                  PDF Format
                </span>
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">{item.label}</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">{item.desc}</p>
              </div>

              <div className="pt-2 border-t border-purple-100 flex items-center justify-between text-xs font-black text-purple-700">
                <span>Printable A4 Layout</span>
                <span className="flex items-center gap-1 hover:underline">Generate →</span>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Report Preview Document Card */}
      <GlassCard className="p-6 space-y-6 shadow-sm max-w-3xl mx-auto">
        <div className="flex items-center justify-between border-b border-purple-100 pb-4">
          <div>
            <div className="text-[10px] uppercase font-mono tracking-widest text-purple-600 font-extrabold">
              StudyOS Desktop Official Printable PDF
            </div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">{selectedReport}</h2>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono">
            <div>Date: {new Date().toLocaleDateString()}</div>
            <div className="text-emerald-600 font-extrabold">100% Offline Record</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100">
            <div className="text-[10px] text-slate-500 font-bold">PW Lectures Done</div>
            <div className="text-base font-black text-purple-700 mt-0.5">42 / 48 Lectures</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100">
            <div className="text-[10px] text-slate-500 font-bold">Questions Solved</div>
            <div className="text-base font-black text-emerald-600 mt-0.5">340 Questions</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100">
            <div className="text-[10px] text-slate-500 font-bold">Average Mock Score</div>
            <div className="text-base font-black text-pink-600 mt-0.5">115 / 160 Marks</div>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <h3 className="font-extrabold text-slate-900 border-b border-purple-100 pb-2">
            Tensorix Phase 1 & 2 Completion Audit
          </h3>
          <p className="text-slate-600 leading-relaxed font-medium">
            All First Contact topics on track for completion before Week 20. Re-anchored study schedule active. Single export standard: PDF format with printable cover page, page numbers, and headers.
          </p>
        </div>
      </GlassCard>
    </div>
  );
};
