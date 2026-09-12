import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  Search,
  Filter,
  Check,
  X,
  Layers,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { GlassCard } from '../shared/GlassCard';
import {
  getFlattenedOfficialTopics,
  getCompletedTopicIds,
  toggleCompletedTopic,
  OfficialSyllabusTopicItem,
} from '../../data/rawSyllabusData';
import { CANONICAL_PW_LECTURES } from '../../data/canonicalData';
import { db } from '../../services/db';

import { getAllSubjectOptions } from '../../data/subjectRegistry';

interface UnifiedSyllabusCoverageProps {
  onShowNotification?: (msg: string, title?: string) => void;
  externalSubjectFilter?: string;
}

export interface UnifiedTopicRecord {
  id: string;
  paperCode: 'CS' | 'DA' | 'EXTRA';
  sectionName: string;
  subjectName: string;
  topicName: string;
  category: 'Completed' | 'Pending' | 'Missing' | 'Extra';
  matchingLecturesCount: number;
}

export const UnifiedSyllabusCoverage: React.FC<UnifiedSyllabusCoverageProps> = ({
  onShowNotification,
  externalSubjectFilter,
}) => {
  const [completedSet, setCompletedSet] = useState<Set<string>>(getCompletedTopicIds);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'Completed' | 'Pending' | 'Missing' | 'Extra'>('ALL');
  const [paperFilter, setPaperFilter] = useState<'ALL' | 'CS' | 'DA'>('ALL');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const subjectList = useMemo(() => {
    const subs = db.getCurrentExamSubjects();
    if (subs.length > 0) return subs;
    return getAllSubjectOptions();
  }, []);

  const activeSubjectFilter = externalSubjectFilter && externalSubjectFilter !== 'All' 
    ? externalSubjectFilter 
    : selectedSubjectFilter;

  const refreshState = useCallback(() => {
    setCompletedSet(getCompletedTopicIds());
  }, []);

  useEffect(() => {
    refreshState();
    const handleSync = () => refreshState();

    window.addEventListener('storage', handleSync);
    window.addEventListener('studyos_syllabus_updated', handleSync);
    window.addEventListener('studyos_db_updated', handleSync);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('studyos_syllabus_updated', handleSync);
      window.removeEventListener('studyos_db_updated', handleSync);
    };
  }, [refreshState]);

  // Helper function for strict, reliable subject matching
  const isSubjectMatch = (lecSub: string, offSub: string, offSec: string): boolean => {
    const normL = lecSub.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normS = offSub.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normSec = offSec.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!normL) return false;
    if (normL === normS || normL === normSec) return true;

    // Check specific domain matches
    if (normL.includes('algo') && (normS.includes('algo') || normSec.includes('algo'))) return true;
    if (normL.includes('network') && (normS.includes('network') || normSec.includes('network'))) return true;
    if ((normL.includes('dbms') || normL.includes('database')) && (normS.includes('db') || normS.includes('database') || normSec.includes('db'))) return true;
    if ((normL.includes('os') || normL.includes('operatingsystem')) && (normS.includes('os') || normS.includes('operatingsystem'))) return true;
    if (normL.includes('digitallogic') && (normS.includes('digitallogic') || normSec.includes('digitallogic'))) return true;
    if (normL.includes('discretemathematics') && (normS.includes('discrete') || normSec.includes('discrete'))) return true;
    if (normL.includes('linearalgebra') && (normS.includes('linearalgebra') || normSec.includes('linearalgebra'))) return true;
    if (normL.includes('calculus') && (normS.includes('calculus') || normSec.includes('calculus'))) return true;
    if ((normL.includes('probability') || normL.includes('statistics')) && (normS.includes('prob') || normS.includes('stat') || normSec.includes('math'))) return true;
    if (normL.includes('datastructure') && (normS.includes('datastructure') || normSec.includes('datastructure') || normS.includes('programming'))) return true;
    if (normL.includes('generalaptitude') && (normS.includes('aptitude') || normSec.includes('aptitude'))) return true;

    if (normL.length >= 5 && normS.length >= 5 && (normL.includes(normS) || normS.includes(normL))) return true;
    if (normL.length >= 5 && normSec.length >= 5 && (normL.includes(normSec) || normSec.includes(normL))) return true;

    return false;
  };

  // Helper function for topic/chapter matching
  const isTopicMatch = (lecChap: string, topicName: string): boolean => {
    const normC = lecChap.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normT = topicName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normC || !normT) return false;
    if (normC === normT) return true;
    if (normC.length >= 5 && normT.length >= 5 && (normC.includes(normT) || normT.includes(normC))) return true;
    return false;
  };

  // Generate unified comparison records
  const records = useMemo(() => {
    const allOfficialTopics = getFlattenedOfficialTopics('ALL');
    const lectures = db.getLectures();

    // Map official topics
    const officialRecords: UnifiedTopicRecord[] = allOfficialTopics.map((top) => {
      const isCompleted = completedSet.has(top.id);

      const matchingLecs = lectures.filter((lec) => {
        const subOk = isSubjectMatch(lec.subject || '', top.subjectName, top.sectionName);
        if (!subOk) return false;
        const chapOk = isTopicMatch(lec.chapter || '', top.topicName);
        return subOk || chapOk;
      });

      let category: UnifiedTopicRecord['category'] = 'Pending';
      if (isCompleted) {
        category = 'Completed';
      } else if (matchingLecs.length === 0) {
        category = 'Missing';
      } else {
        category = 'Pending';
      }

      return {
        id: top.id,
        paperCode: top.paperCode,
        sectionName: top.sectionName,
        subjectName: top.subjectName,
        topicName: top.topicName,
        category,
        matchingLecturesCount: matchingLecs.length,
      };
    });

    // Detect extra lectures outside official CS/DA syllabus
    const extraMap = new Map<string, { subject: string; chapter: string; count: number }>();

    lectures.forEach((lec) => {
      let matchesOfficial = false;
      for (const top of allOfficialTopics) {
        if (isSubjectMatch(lec.subject || '', top.subjectName, top.sectionName)) {
          matchesOfficial = true;
          break;
        }
      }

      if (!matchesOfficial) {
        const key = `${lec.subject}::${lec.chapter}`;
        if (!extraMap.has(key)) {
          extraMap.set(key, { subject: lec.subject, chapter: lec.chapter, count: 1 });
        } else {
          extraMap.get(key)!.count += 1;
        }
      }
    });

    const extraRecords: UnifiedTopicRecord[] = Array.from(extraMap.entries()).map(([key, item]) => ({
      id: `extra::${key}`,
      paperCode: 'EXTRA',
      sectionName: 'Supplemental / Bonus Content',
      subjectName: item.subject,
      topicName: `${item.chapter} (${item.count} PW Lectures)`,
      category: 'Extra',
      matchingLecturesCount: item.count,
    }));

    return [...officialRecords, ...extraRecords];
  }, [completedSet]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false;
      if (paperFilter !== 'ALL' && r.paperCode !== paperFilter && r.paperCode !== 'EXTRA') return false;

      if (activeSubjectFilter && activeSubjectFilter !== 'All') {
        const sf = activeSubjectFilter.toLowerCase();
        const matchesSub = r.subjectName.toLowerCase().includes(sf) || r.sectionName.toLowerCase().includes(sf);
        if (!matchesSub) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          r.sectionName.toLowerCase().includes(q) ||
          r.subjectName.toLowerCase().includes(q) ||
          r.topicName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, categoryFilter, paperFilter, activeSubjectFilter, searchQuery]);

  // Metrics summary
  const counts = useMemo(() => {
    const completed = records.filter((r) => r.category === 'Completed').length;
    const pending = records.filter((r) => r.category === 'Pending').length;
    const missing = records.filter((r) => r.category === 'Missing').length;
    const extra = records.filter((r) => r.category === 'Extra').length;
    const totalOfficial = completed + pending + missing;

    return {
      completed,
      pending,
      missing,
      extra,
      totalOfficial,
      completedPct: totalOfficial > 0 ? Math.round((completed / totalOfficial) * 100) : 0,
    };
  }, [records]);

  const handleToggleTopic = (id: string, name: string) => {
    if (id.startsWith('extra::')) return;
    const isDone = toggleCompletedTopic(id);
    refreshState();
    onShowNotification?.(
      `${isDone ? 'Marked Completed' : 'Unmarked'}: ${name}`,
      'Unified Coverage'
    );
  };

  return (
    <GlassCard className="p-6 bg-white space-y-6 shadow-md border border-purple-200/80 rounded-3xl">
      {/* HEADER TITLE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-purple-600 font-extrabold text-xs uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" />
            <span>Unified Syllabus & PW Lecture Coverage Engine</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Official Syllabus vs Lecture Planner Coverage
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time matrix comparing official syllabus, lecture planner coverage, and completed study progress.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">
            {counts.totalOfficial} Official Syllabus Topics Tracked
          </span>
        </div>
      </div>

      {/* 4 SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Completed */}
        <div
          onClick={() => setCategoryFilter('Completed')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            categoryFilter === 'Completed'
              ? 'bg-emerald-500 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300'
              : 'bg-emerald-50/80 hover:bg-emerald-100/80 border-emerald-200 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-black uppercase tracking-wider">Completed</span>
            <CheckCircle2 className={`w-4 h-4 ${categoryFilter === 'Completed' ? 'text-white' : 'text-emerald-600'}`} />
          </div>
          <div className="text-2xl font-black">{counts.completed}</div>
          <p className={`text-[11px] font-bold mt-1 ${categoryFilter === 'Completed' ? 'text-emerald-100' : 'text-emerald-700'}`}>
            {counts.completedPct}% of official syllabus
          </p>
        </div>

        {/* Pending */}
        <div
          onClick={() => setCategoryFilter('Pending')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            categoryFilter === 'Pending'
              ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-300'
              : 'bg-amber-50/80 hover:bg-amber-100/80 border-amber-200 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-black uppercase tracking-wider">Pending</span>
            <Clock className={`w-4 h-4 ${categoryFilter === 'Pending' ? 'text-white' : 'text-amber-600'}`} />
          </div>
          <div className="text-2xl font-black">{counts.pending}</div>
          <p className={`text-[11px] font-bold mt-1 ${categoryFilter === 'Pending' ? 'text-amber-100' : 'text-amber-700'}`}>
            Lectures mapped, in progress
          </p>
        </div>

        {/* Missing */}
        <div
          onClick={() => setCategoryFilter('Missing')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            categoryFilter === 'Missing'
              ? 'bg-rose-500 text-white border-rose-600 shadow-md ring-2 ring-rose-300'
              : 'bg-rose-50/80 hover:bg-rose-100/80 border-rose-200 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-black uppercase tracking-wider">Missing in Planner</span>
            <AlertTriangle className={`w-4 h-4 ${categoryFilter === 'Missing' ? 'text-white' : 'text-rose-600'}`} />
          </div>
          <div className="text-2xl font-black">{counts.missing}</div>
          <p className={`text-[11px] font-bold mt-1 ${categoryFilter === 'Missing' ? 'text-rose-100' : 'text-rose-700'}`}>
            Official topics needing plan
          </p>
        </div>

        {/* Extra */}
        <div
          onClick={() => setCategoryFilter('Extra')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            categoryFilter === 'Extra'
              ? 'bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-300'
              : 'bg-purple-50/80 hover:bg-purple-100/80 border-purple-200 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-black uppercase tracking-wider">Extra Content</span>
            <Sparkles className={`w-4 h-4 ${categoryFilter === 'Extra' ? 'text-white' : 'text-purple-600'}`} />
          </div>
          <div className="text-2xl font-black">{counts.extra}</div>
          <p className={`text-[11px] font-bold mt-1 ${categoryFilter === 'Extra' ? 'text-purple-100' : 'text-purple-700'}`}>
            Supplemental PW chapters
          </p>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar w-full sm:w-auto">
          <button
            onClick={() => setCategoryFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              categoryFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All Categories ({records.length})
          </button>
          <button
            onClick={() => setCategoryFilter('Completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              categoryFilter === 'Completed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
            }`}
          >
            Completed ({counts.completed})
          </button>
          <button
            onClick={() => setCategoryFilter('Pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              categoryFilter === 'Pending'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
            }`}
          >
            Pending ({counts.pending})
          </button>
          <button
            onClick={() => setCategoryFilter('Missing')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              categoryFilter === 'Missing'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
            }`}
          >
            Missing ({counts.missing})
          </button>
          <button
            onClick={() => setCategoryFilter('Extra')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              categoryFilter === 'Extra'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-purple-700 hover:bg-purple-50 border border-purple-200'
            }`}
          >
            Extra ({counts.extra})
          </button>
        </div>

        {/* Subject Filter & Search */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={activeSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 max-w-[180px] focus:outline-hidden focus:border-purple-500 cursor-pointer"
          >
            <option value="All">All Subjects</option>
            {subjectList.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter matrix..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* MATRIX LIST */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
        {filteredRecords.map((item) => {
          const isDone = item.category === 'Completed';

          return (
            <div
              key={item.id}
              onClick={() => handleToggleTopic(item.id, item.topicName)}
              className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-4 cursor-pointer ${
                item.category === 'Completed'
                  ? 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50'
                  : item.category === 'Pending'
                  ? 'bg-amber-50/30 border-amber-200/80 hover:bg-amber-50/60'
                  : item.category === 'Missing'
                  ? 'bg-rose-50/40 border-rose-200 hover:bg-rose-50'
                  : 'bg-purple-50/40 border-purple-200 hover:bg-purple-50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {item.paperCode !== 'EXTRA' ? (
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => {}}
                    className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                  />
                ) : (
                  <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        item.paperCode === 'CS'
                          ? 'bg-purple-100 text-purple-800'
                          : item.paperCode === 'DA'
                          ? 'bg-cyan-100 text-cyan-800'
                          : 'bg-purple-200 text-purple-900'
                      }`}
                    >
                      {item.paperCode}
                    </span>
                    <span className="text-xs font-extrabold text-slate-700">
                      {item.sectionName}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs font-semibold text-slate-500">
                      {item.subjectName}
                    </span>
                  </div>
                  <p className={`text-xs font-bold mt-1 ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    {item.topicName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {item.matchingLecturesCount > 0 && (
                  <span className="text-[11px] font-bold text-slate-500 hidden md:inline-block">
                    {item.matchingLecturesCount} Lectures Mapped
                  </span>
                )}

                <span
                  className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1.5 ${
                    item.category === 'Completed'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : item.category === 'Pending'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : item.category === 'Missing'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-purple-100 text-purple-800 border border-purple-300'
                  }`}
                >
                  {item.category === 'Completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  {item.category === 'Pending' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                  {item.category === 'Missing' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                  {item.category === 'Extra' && <Sparkles className="w-3.5 h-3.5 text-purple-600" />}
                  <span>{item.category === 'Missing' ? 'Missing in Planner' : item.category}</span>
                </span>
              </div>
            </div>
          );
        })}

        {filteredRecords.length === 0 && (
          <div className="p-8 text-center text-xs font-bold text-slate-400 border border-dashed border-slate-200 rounded-2xl">
            No topic records found matching your filters.
          </div>
        )}
      </div>
    </GlassCard>
  );
};
