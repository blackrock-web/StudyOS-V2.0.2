import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  Search,
  Sparkles,
  Layers,
  Award,
  BarChart3,
  Check,
  X,
  Filter,
  BookOpen,
} from 'lucide-react';
import { GlassCard } from '../shared/GlassCard';
import {
  RAW_CS_SYLLABUS_DOC,
  RAW_DA_SYLLABUS_DOC,
  OfficialSyllabusDoc,
  getCompletedTopicIds,
  toggleCompletedTopic,
  getSyllabusProgressMetrics,
} from '../../data/rawSyllabusData';
import { db } from '../../services/db';
import { CANONICAL_GATE_2027, getExamDefinition } from '../../data/examDefinitions';

interface SyllabusManagerProps {
  onShowNotification?: (msg: string, title?: string) => void;
}

export const SyllabusManager: React.FC<SyllabusManagerProps> = ({ onShowNotification }) => {
  const [activeExamId, setActiveExamId] = useState<string>(() => db.getActiveExamId());
  const [activeGatePaperFilter, setActiveGatePaperFilter] = useState<'CS' | 'DA' | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [completedTopicIds, setCompletedTopicIds] = useState<Set<string>>(getCompletedTopicIds);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  const isGate = activeExamId === CANONICAL_GATE_2027.examId;
  const activeExam = getExamDefinition(activeExamId);

  // Build a generic syllabus doc if active exam is not GATE and has topicTree
  const hasNonGateTopics = !isGate && !!(activeExam && activeExam.topicTree && activeExam.topicTree.length > 0);
  const nonGateDoc: OfficialSyllabusDoc | null = hasNonGateTopics && activeExam ? {
    exam: activeExam.examName,
    organizing_institute: activeExam.category || 'Official Syllabus',
    paper_code: 'CS',
    paper_name: activeExam.examName,
    sections: activeExam.topicTree.map((sec, sIdx) => ({
      section_no: sIdx + 1,
      section_name: sec.name,
      subjects: sec.chapters.map((chap) => ({
        subject: chap.name,
        topics: chap.topics.map((t) => ({ id: t.id, name: t.name })) as any,
      })),
    })),
  } : null;

  // Reload topic state & active exam ID on storage/custom events
  const refreshState = useCallback(() => {
    setActiveExamId(db.getActiveExamId());
    setCompletedTopicIds(getCompletedTopicIds());
  }, []);

  useEffect(() => {
    refreshState();
    const handleSync = () => refreshState();

    window.addEventListener('storage', handleSync);
    window.addEventListener('studyos_syllabus_updated', handleSync);
    window.addEventListener('studyos_db_updated', handleSync);
    window.addEventListener('studyos_active_exam_changed', handleSync);
    window.addEventListener('studyos_exams_updated', handleSync);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('studyos_syllabus_updated', handleSync);
      window.removeEventListener('studyos_db_updated', handleSync);
      window.removeEventListener('studyos_active_exam_changed', handleSync);
      window.removeEventListener('studyos_exams_updated', handleSync);
    };
  }, [refreshState]);

  // Expand all sections and chapters by default whenever active exam or syllabus doc changes
  useEffect(() => {
    const initialSecExp: Record<string, boolean> = {};
    const initialChapExp: Record<string, boolean> = {};
    const targetDocs = isGate ? [RAW_CS_SYLLABUS_DOC, RAW_DA_SYLLABUS_DOC] : (nonGateDoc ? [nonGateDoc] : []);

    targetDocs.forEach((doc) => {
      doc.sections.forEach((sec, sIdx) => {
        const secKey = `${doc.paper_code}-sec-${sIdx}`;
        initialSecExp[secKey] = true;
        sec.subjects.forEach((_, subIdx) => {
          initialChapExp[`${secKey}-sub-${subIdx}`] = true;
        });
      });
    });

    setExpandedSections(initialSecExp);
    setExpandedChapters(initialChapExp);
  }, [activeExamId, isGate]);

  const toggleSectionExpand = (secKey: string) => {
    setExpandedSections((prev) => {
      const current = prev[secKey] !== false;
      return { ...prev, [secKey]: !current };
    });
  };

  const toggleChapterExpand = (chapKey: string) => {
    setExpandedChapters((prev) => {
      const current = prev[chapKey] !== false;
      return { ...prev, [chapKey]: !current };
    });
  };

  const handleExpandAll = () => {
    const secExp: Record<string, boolean> = {};
    const chapExp: Record<string, boolean> = {};
    const targetDocs = isGate ? [RAW_CS_SYLLABUS_DOC, RAW_DA_SYLLABUS_DOC] : (nonGateDoc ? [nonGateDoc] : []);

    targetDocs.forEach((doc) => {
      doc.sections.forEach((sec, sIdx) => {
        const secKey = `${doc.paper_code}-sec-${sIdx}`;
        secExp[secKey] = true;
        sec.subjects.forEach((_, subIdx) => {
          chapExp[`${secKey}-sub-${subIdx}`] = true;
        });
      });
    });

    setExpandedSections(secExp);
    setExpandedChapters(chapExp);
    onShowNotification?.('Expanded entire syllabus hierarchy (Subjects → Chapters → Topics)', 'Syllabus View');
  };

  const handleCollapseAll = () => {
    const secExp: Record<string, boolean> = {};
    const chapExp: Record<string, boolean> = {};
    const targetDocs = isGate ? [RAW_CS_SYLLABUS_DOC, RAW_DA_SYLLABUS_DOC] : (nonGateDoc ? [nonGateDoc] : []);

    targetDocs.forEach((doc) => {
      doc.sections.forEach((sec, sIdx) => {
        const secKey = `${doc.paper_code}-sec-${sIdx}`;
        secExp[secKey] = false;
        sec.subjects.forEach((_, subIdx) => {
          chapExp[`${secKey}-sub-${subIdx}`] = false;
        });
      });
    });

    setExpandedSections(secExp);
    setExpandedChapters(chapExp);
    onShowNotification?.('Collapsed entire syllabus hierarchy', 'Syllabus View');
  };

  const handleTopicCheck = (topicId: string, topicName: string) => {
    const isNowCompleted = toggleCompletedTopic(topicId);
    refreshState();
    onShowNotification?.(
      `${isNowCompleted ? 'Completed' : 'Unmarked'}: ${topicName}`,
      'Syllabus Progress'
    );
  };

  const metrics = getSyllabusProgressMetrics();

  const renderSyllabusDoc = (doc: OfficialSyllabusDoc) => {
    const paperCode = doc.paper_code;
    if (isGate && activeGatePaperFilter !== 'ALL' && activeGatePaperFilter !== paperCode) return null;

    return (
      <div key={paperCode + doc.paper_name} className="space-y-4">
        <div className="flex items-center justify-between border-b border-purple-200/80 pb-2.5 pt-2">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wide text-white ${
              paperCode === 'CS' && isGate
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-xs'
                : paperCode === 'DA' && isGate
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 shadow-xs'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-xs'
            }`}>
              {isGate ? `GATE ${paperCode} 2027` : doc.paper_name}
            </span>
            <h2 className="text-base font-black text-slate-900 tracking-tight">{doc.paper_name}</h2>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {isGate ? `Organizing Institute: ${doc.organizing_institute}` : `${doc.organizing_institute}`}
          </span>
        </div>

        <div className="space-y-3">
          {doc.sections.map((sec, sIdx) => {
            const secKey = `${paperCode}-sec-${sIdx}`;
            const isExpanded = expandedSections[secKey] !== false;

            // Calculate section topic stats
            let secTotalTopics = 0;
            let secDoneTopics = 0;

            sec.subjects.forEach((sub) => {
              sub.topics.forEach((top: any) => {
                secTotalTopics++;
                const topId = typeof top === 'string'
                  ? `${paperCode}::${sec.section_name}::${sub.subject}::${top}`
                  : top.id;
                if (completedTopicIds.has(topId)) {
                  secDoneTopics++;
                }
              });
            });

            const secPct = secTotalTopics > 0 ? Math.round((secDoneTopics / secTotalTopics) * 100) : 0;

            // Search filter matching
            const matchesSearch =
              !searchQuery ||
              sec.section_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              sec.subjects.some((sub) =>
                sub.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                sub.topics.some((t: any) => {
                  const tName = typeof t === 'string' ? t : t.name;
                  return tName.toLowerCase().includes(searchQuery.toLowerCase());
                })
              );

            if (!matchesSearch) return null;

            return (
              <div
                key={secKey}
                className="bg-white/90 backdrop-blur-xs border border-purple-100 rounded-2xl shadow-xs overflow-hidden transition-all"
              >
                {/* Subject / Section Header */}
                <div
                  onClick={() => toggleSectionExpand(secKey)}
                  className="w-full px-5 py-3.5 flex items-center justify-between bg-slate-50/80 hover:bg-purple-50/60 cursor-pointer transition-colors border-b border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <button className="p-1 rounded-lg text-slate-400 hover:text-purple-600 transition-colors">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-purple-600" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <span className="text-xs font-extrabold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-md">
                          Section {sec.section_no}
                        </span>
                        <span>{sec.section_name}</span>
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                        {sec.subjects.length} Chapters • {secTotalTopics} Topics
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <span className="text-xs font-extrabold text-slate-700">
                        {secDoneTopics} / {secTotalTopics} Done
                      </span>
                      <div className="w-24 bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${secPct}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-xl text-xs font-black ${
                        secPct === 100
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : secPct > 0
                          ? 'bg-purple-100 text-purple-800 border border-purple-300'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {secPct}%
                    </span>
                  </div>
                </div>

                {/* Section Body: Subjects -> Topics */}
                {isExpanded && (
                  <div className="p-4 space-y-4 bg-white">
                    {sec.subjects.map((sub, subIdx) => {
                      const chapKey = `${secKey}-sub-${subIdx}`;
                      const isChapExpanded = expandedChapters[chapKey] !== false;

                      const filteredTopics = sub.topics.filter((t: any) => {
                        const tName = typeof t === 'string' ? t : t.name;
                        return (
                          !searchQuery ||
                          tName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          sub.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          sec.section_name.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                      });

                      if (filteredTopics.length === 0 && searchQuery) return null;

                      return (
                        <div
                          key={subIdx}
                          className="pl-2 border-l-2 border-purple-200/70 space-y-2 py-1"
                        >
                          <div
                            onClick={() => toggleChapterExpand(chapKey)}
                            className="flex items-center justify-between cursor-pointer group py-1 px-2 rounded-lg hover:bg-purple-50/50 transition-colors"
                          >
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                              <button className="text-slate-400 group-hover:text-purple-600 transition-colors">
                                {isChapExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-purple-600" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </button>
                              <Layers className="w-3.5 h-3.5 text-purple-600" />
                              <span>{sub.subject}</span>
                            </h4>

                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-purple-600">
                              {sub.topics.length} Topics {isChapExpanded ? '(Expanded)' : '(Collapsed)'}
                            </span>
                          </div>

                          {isChapExpanded && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-2 pt-1">
                              {filteredTopics.map((top: any) => {
                                const topicId = typeof top === 'string'
                                  ? `${paperCode}::${sec.section_name}::${sub.subject}::${top}`
                                  : top.id;
                                const topicName = typeof top === 'string' ? top : top.name;
                                const isDone = completedTopicIds.has(topicId);

                                return (
                                  <div
                                    key={topicId}
                                    onClick={() => handleTopicCheck(topicId, topicName)}
                                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                                      isDone
                                        ? 'bg-emerald-50/60 border-emerald-200 text-slate-800 shadow-2xs'
                                        : 'bg-slate-50/50 hover:bg-purple-50/40 border-slate-200/80 text-slate-700'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isDone}
                                      onChange={() => {}} // Handled by div onClick
                                      className="mt-0.5 w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p
                                        className={`text-xs font-bold leading-relaxed ${
                                          isDone ? 'line-through text-slate-500' : 'text-slate-800'
                                        }`}
                                      >
                                        {topicName}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1.5">
                                        <span
                                          className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                            isDone
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : 'bg-slate-200/70 text-slate-600'
                                          }`}
                                        >
                                          {isDone ? 'Completed' : 'Pending'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-20">
      {/* GATE-SPECIFIC PROGRESS CARDS ROW (ONLY FOR GATE EXAM) */}
      {isGate && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CS Progress Card */}
          <GlassCard className="p-5 border-l-4 border-l-purple-600 hover:shadow-lg transition-all bg-white">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase text-purple-700 bg-purple-100 px-2.5 py-1 rounded-lg">
                GATE CS 2027
              </span>
              <Award className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              CS Syllabus Coverage
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">{metrics.cs.percent}%</span>
              <span className="text-xs font-bold text-slate-500">
                ({metrics.cs.completed} / {metrics.cs.total} Topics)
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-600 to-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${metrics.cs.percent}%` }}
              />
            </div>
          </GlassCard>

          {/* DA Progress Card */}
          <GlassCard className="p-5 border-l-4 border-l-cyan-600 hover:shadow-lg transition-all bg-white">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase text-cyan-700 bg-cyan-100 px-2.5 py-1 rounded-lg">
                GATE DA 2027
              </span>
              <BarChart3 className="w-5 h-5 text-cyan-600" />
            </div>
            <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              DA Syllabus Coverage
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">{metrics.da.percent}%</span>
              <span className="text-xs font-bold text-slate-500">
                ({metrics.da.completed} / {metrics.da.total} Topics)
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${metrics.da.percent}%` }}
              />
            </div>
          </GlassCard>

          {/* Overall Combined Progress Card */}
          <GlassCard className="p-5 border-l-4 border-l-emerald-600 hover:shadow-lg transition-all bg-white">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                CS & DA Combined
              </span>
              <Sparkles className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Overall Combined Progress
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">{metrics.combined.percent}%</span>
              <span className="text-xs font-bold text-slate-500">
                ({metrics.combined.completed} / {metrics.combined.total} Topics)
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${metrics.combined.percent}%` }}
              />
            </div>
          </GlassCard>
        </div>
      )}

      {/* NON-GATE PROGRESS CARD */}
      {!isGate && nonGateDoc && (() => {
        let totalT = 0;
        let doneT = 0;
        nonGateDoc.sections.forEach((sec) => {
          sec.subjects.forEach((sub) => {
            sub.topics.forEach((top: any) => {
              totalT++;
              const topId = typeof top === 'string' ? `${nonGateDoc.paper_code}::${sec.section_name}::${sub.subject}::${top}` : top.id;
              if (completedTopicIds.has(topId)) doneT++;
            });
          });
        });
        const percent = totalT > 0 ? Math.round((doneT / totalT) * 100) : 0;
        return (
          <div className="grid grid-cols-1 gap-4">
            <GlassCard className="p-5 border-l-4 border-l-purple-600 hover:shadow-lg transition-all bg-white">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black uppercase text-purple-700 bg-purple-100 px-2.5 py-1 rounded-lg">
                  {activeExam?.examName || activeExamId}
                </span>
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                Syllabus Coverage
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-slate-900">{percent}%</span>
                <span className="text-xs font-bold text-slate-500">
                  ({doneT} / {totalT} Topics)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </GlassCard>
          </div>
        );
      })()}

      {/* FILTER & SEARCH BAR */}
      <GlassCard className="p-4 bg-white flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Paper Filter Tabs - ONLY FOR GATE */}
        {isGate && (
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveGatePaperFilter('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                activeGatePaperFilter === 'ALL'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Papers (CS + DA)
            </button>
            <button
              onClick={() => setActiveGatePaperFilter('CS')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                activeGatePaperFilter === 'CS'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              GATE CS Only
            </button>
            <button
              onClick={() => setActiveGatePaperFilter('DA')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                activeGatePaperFilter === 'DA'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              GATE DA Only
            </button>
          </div>
        )}

        {/* Expand/Collapse Buttons & Search Input (Visible in ALL exams) */}
        <div className={`flex items-center gap-2.5 w-full ${isGate ? 'md:w-auto' : 'md:w-full justify-between'}`}>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleExpandAll}
              className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-2xs"
            >
              Expand All
            </button>
            <button
              onClick={handleCollapseAll}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-2xs"
            >
              Collapse All
            </button>
          </div>

          <div className={`relative w-full ${isGate ? 'md:w-72' : 'md:w-80'}`}>
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search subjects, chapters, or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-purple-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </GlassCard>

      {/* SYLLABUS DOCS RENDER */}
      <div className="space-y-8">
        {isGate ? (
          <>
            {renderSyllabusDoc(RAW_CS_SYLLABUS_DOC)}
            {renderSyllabusDoc(RAW_DA_SYLLABUS_DOC)}
          </>
        ) : nonGateDoc ? (
          renderSyllabusDoc(nonGateDoc)
        ) : (
          <GlassCard className="p-12 text-center bg-white border border-purple-100 rounded-3xl">
            <BookOpen className="w-12 h-12 text-purple-300 mx-auto mb-3" />
            <h3 className="text-base font-extrabold text-slate-800">Syllabus not yet added for this exam</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              There are no predefined syllabus topics configured for {activeExam?.examName || activeExamId}. You can add custom topics or subjects in the Settings menu or Exam Manager.
            </p>
          </GlassCard>
        )}
      </div>
    </div>
  );
};

