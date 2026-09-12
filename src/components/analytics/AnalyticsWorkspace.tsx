/**
 * AnalyticsWorkspace — clean production Analytics UI
 * Uses only existing app theme (GlassCard, light surfaces, teal/blue accents).
 * All values start at zero until real activity is recorded.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Clock,
  Flame,
  Target,
  BookOpen,
  CheckCircle2,
  Activity,
  TrendingUp,
  ListTodo,
  Calendar,
  Settings2,
  Trash2,
  RefreshCw,
  Coffee,
  Layers,
  Globe,
  Zap,
} from 'lucide-react';
import { GlassCard } from '../shared/GlassCard';
import {
  analyticsService,
  AnalyticsSnapshot,
  AnalyticsEvent,
  DayRecord,
  WeeklyArchive,
  StoragePolicy,
} from '../../services/analyticsService';
import { syncService } from '../../services/syncService';
import { TaskHistoryRecord } from '../../types';

type TabId = 'overview' | 'study' | 'time' | 'tasks' | 'progress' | 'storage';

interface Props {
  onShowNotification?: (msg: string, title?: string) => void;
}

function fmtMins(m: number): string {
  if (!m || m <= 0) return '0m';
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
}

function fmtHours(h: number): string {
  if (!h || h <= 0) return '0h';
  return `${h}h`;
}

export const AnalyticsWorkspace: React.FC<Props> = ({ onShowNotification }) => {
  const [tab, setTab] = useState<TabId>('overview');
  const [snap, setSnap] = useState<AnalyticsSnapshot>(() => analyticsService.getSnapshot());
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [days, setDays] = useState<DayRecord[]>([]);
  const [weeks, setWeeks] = useState<WeeklyArchive[]>([]);
  const [subjects, setSubjects] = useState<{ subject: string; minutes: number }[]>([]);
  const [taskHistory, setTaskHistory] = useState<TaskHistoryRecord[]>([]);
  const [policy, setPolicy] = useState<StoragePolicy>('keep_all');
  const [selectedHeatmapDay, setSelectedHeatmapDay] = useState<DayRecord | null>(null);

  const refresh = useCallback(() => {
    analyticsService.ensureDayRollover();
    setSnap(analyticsService.getSnapshot());
    setEvents(analyticsService.getRecentEvents(50));
    setDays(analyticsService.getDayRecords(14));
    setWeeks(analyticsService.getWeeklyArchives());
    setSubjects(analyticsService.getSubjectMinutes(30));
    setTaskHistory(analyticsService.getTaskHistoryFromDb().slice(0, 40));
    setPolicy(analyticsService.getStore().storagePolicy);
  }, []);

  useEffect(() => {
    refresh();
    const unsubAnalytics = analyticsService.subscribe(refresh);
    const unsubSync = syncService.subscribe('*', () => refresh());
    return () => {
      unsubAnalytics();
      unsubSync();
    };
  }, [refresh]);

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'study', label: 'Study', icon: BookOpen },
    { id: 'time', label: 'Time', icon: Clock },
    { id: 'tasks', label: 'Tasks', icon: ListTodo },
    { id: 'progress', label: 'Progress', icon: TrendingUp },
    { id: 'storage', label: 'Storage', icon: Settings2 },
  ];

  const kpi = [
    { label: 'Study Hours', value: fmtHours(snap.studyHours), icon: Clock, color: 'text-blue-600 bg-blue-50' },
    { label: 'Focus Time', value: fmtHours(snap.focusHours), icon: Target, color: 'text-teal-600 bg-teal-50' },
    { label: 'Break Time', value: fmtHours(snap.breakHours), icon: Coffee, color: 'text-amber-600 bg-amber-50' },
    { label: 'Tasks Done', value: String(snap.completedTasks), icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Lectures', value: String(snap.completedLectures), icon: BookOpen, color: 'text-violet-600 bg-violet-50' },
    { label: 'Productivity', value: `${snap.productivityScore}%`, icon: Activity, color: 'text-rose-600 bg-rose-50' },
    { label: 'Streak', value: `${snap.studyStreak}d`, icon: Flame, color: 'text-orange-600 bg-orange-50' },
    { label: 'Learning', value: `${snap.learningProgress}%`, icon: Layers, color: 'text-indigo-600 bg-indigo-50' },
  ];

  const isEmpty =
    snap.studyHours === 0 &&
    snap.completedTasks === 0 &&
    snap.completedLectures === 0 &&
    snap.studyStreak === 0;

  // Compute top browser domains from events
  const browserEvents = events.filter(
    (e) =>
      e.details &&
      (e.details.domain ||
        e.details.action === 'BROWSER_STUDY_COMPLETED' ||
        e.details.action === 'BROWSER_FOCUS_STARTED')
  );

  const domainMap: Record<string, number> = {};
  browserEvents.forEach((e) => {
    const d = (e.details?.domain as string) || 'web-study';
    domainMap[d] = (domainMap[d] || 0) + (e.durationMinutes || 5);
  });
  const topDomains = Object.entries(domainMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-5 bg-transparent text-slate-900">
      {/* Header */}
      <GlassCard className="relative overflow-hidden bg-gradient-to-r from-blue-50/90 via-teal-50/70 to-emerald-50/80 !p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center text-white shadow-sm">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight">Smart Analytics Workspace</h1>
              <p className="text-[11px] text-slate-500 font-semibold">
                Real-time activity synchronization across Study Browser, Tasks, Timetable & Focus Timer
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              refresh();
              onShowNotification?.('Analytics refreshed in real-time', 'Smart Analytics');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:border-teal-300 cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-teal-600" /> Refresh Live
          </button>
        </div>
      </GlassCard>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-white/90 rounded-xl border border-slate-200 overflow-x-auto custom-scrollbar">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                active
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-purple-50 hover:text-purple-700'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-purple-600'}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {isEmpty && tab === 'overview' && (
        <GlassCard className="!p-6 text-center space-y-2">
          <Activity className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">No activity recorded yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Analytics starts clean. Start a Study Session in the Study Browser, complete a Task, or start the Focus Timer — metrics update automatically in real time.
          </p>
        </GlassCard>
      )}

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Daily Streak & 30-min Target Status Banner */}
          <GlassCard className="!p-4 bg-gradient-to-r from-orange-50/90 via-amber-50/70 to-teal-50/80 border-orange-200/70 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-sm">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black text-slate-900 tracking-tight">Daily Streak & Focus Target</h2>
                    <span className="text-[10px] font-black text-orange-700 bg-orange-100/90 px-2 py-0.5 rounded-full border border-orange-200">
                      {snap.studyStreak} Day{snap.studyStreak === 1 ? '' : 's'} Streak
                    </span>
                    {snap.longestStreak > snap.studyStreak && (
                      <span className="text-[10px] font-bold text-slate-500">
                        (Best: {snap.longestStreak}d)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                    {snap.todayStudyMinutes >= 30
                      ? '✓ Daily streak target achieved today (≥ 30 min verified focus).'
                      : `Complete ${Math.max(0, 30 - snap.todayStudyMinutes)} more minutes of verified study to qualify for today's streak.`}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-black text-slate-900">
                  {fmtMins(snap.todayStudyMinutes)} / 30m
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  {snap.todayStudyMinutes >= 30 ? 'Goal Completed' : `${Math.max(0, 30 - snap.todayStudyMinutes)}m remaining`}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-orange-100/80 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-orange-500 to-teal-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((snap.todayStudyMinutes / 30) * 100))}%` }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="p-2 rounded-xl bg-white/80 border border-slate-200/80">
                <div className="text-slate-400 font-bold uppercase text-[9px]">Focus Sessions</div>
                <div className="font-extrabold text-slate-800">{fmtMins(snap.todayFocusMinutes)}</div>
              </div>
              <div className="p-2 rounded-xl bg-white/80 border border-slate-200/80">
                <div className="text-slate-400 font-bold uppercase text-[9px]">Reading Time</div>
                <div className="font-extrabold text-slate-800">{fmtMins(snap.todayReadingMinutes)}</div>
              </div>
              <div className="p-2 rounded-xl bg-white/80 border border-slate-200/80">
                <div className="text-slate-400 font-bold uppercase text-[9px]">Daily Tasks</div>
                <div className="font-extrabold text-slate-800">{fmtMins(snap.todayTaskMinutes)}</div>
              </div>
              <div className="p-2 rounded-xl bg-white/80 border border-slate-200/80">
                <div className="text-slate-400 font-bold uppercase text-[9px]">Streak Rule</div>
                <div className="font-bold text-slate-700 text-[10px]">1-Day Grace Protection</div>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpi.map((k) => {
              const Icon = k.icon;
              return (
                <GlassCard key={k.label} className="!p-3 space-y-1">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${k.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-lg font-black text-slate-900">{k.value}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    {k.label}
                  </div>
                </GlassCard>
              );
            })}
          </div>

          {/* --- INTERACTIVE ACTIVITY HEATMAP (FOCUS SESSIONS VS BREAK TIME BY DAY AND WEEK) --- */}
          <GlassCard className="!p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  Interactive Focus vs. Break Activity Heatmap
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">
                  Compare focus session minutes against break time by day & week. Click any day bar to inspect.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-teal-500" /> Focus Time
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-amber-400" /> Break Time
                </span>
              </div>
            </div>

            {days.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No daily activity recorded yet.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-7 gap-1.5 md:gap-2">
                  {days.slice(0, 14).map((d) => {
                    const focusMins = d.focusMinutes || d.studyMinutes || 0;
                    const breakMins = d.breakMinutes || 0;
                    const total = focusMins + breakMins || 1;
                    const focusPct = Math.round((focusMins / total) * 100);
                    const isSelected = selectedHeatmapDay?.date === d.date;

                    return (
                      <div
                        key={d.date}
                        onClick={() => setSelectedHeatmapDay(d)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer text-center space-y-1.5 ${
                          isSelected
                            ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-500/20 shadow-xs'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="text-[10px] font-mono font-bold text-slate-600">
                          {d.date.slice(5)}
                        </div>
                        <div className="h-16 w-full bg-slate-100 rounded-lg overflow-hidden flex flex-col justify-end p-0.5">
                          {focusMins > 0 && (
                            <div
                              className="w-full bg-gradient-to-t from-teal-600 to-teal-400 rounded-xs transition-all"
                              style={{ height: `${Math.max(15, focusPct)}%` }}
                              title={`${d.date} Focus: ${fmtMins(focusMins)}`}
                            />
                          )}
                          {breakMins > 0 && (
                            <div
                              className="w-full bg-amber-400 rounded-xs mt-0.5 transition-all"
                              style={{ height: `${Math.max(15, 100 - focusPct)}%` }}
                              title={`${d.date} Break: ${fmtMins(breakMins)}`}
                            />
                          )}
                        </div>
                        <div className="text-[9px] font-extrabold text-teal-700">{fmtMins(focusMins)}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Day Inspector */}
                {selectedHeatmapDay && (
                  <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl flex flex-wrap items-center justify-between text-xs gap-3 animate-fadeIn">
                    <div className="space-y-0.5">
                      <span className="font-black text-purple-900 uppercase">
                        Day Details: {selectedHeatmapDay.date}
                      </span>
                      <div className="flex gap-3 text-slate-700">
                        <span>
                          Focus: <b>{fmtMins(selectedHeatmapDay.focusMinutes || selectedHeatmapDay.studyMinutes)}</b>
                        </span>
                        <span>
                          Break: <b>{fmtMins(selectedHeatmapDay.breakMinutes)}</b>
                        </span>
                        <span>
                          Tasks Done: <b>{selectedHeatmapDay.tasksCompleted}</b>
                        </span>
                        <span>
                          Prod Score: <b>{selectedHeatmapDay.productivityScore}%</b>
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedHeatmapDay(null)}
                      className="text-purple-700 hover:text-purple-900 font-bold text-[11px]"
                    >
                      Close ✕
                    </button>
                  </div>
                )}
              </div>
            )}
          </GlassCard>

          {/* Today vs Week Summary */}
          <div className="grid md:grid-cols-2 gap-4">
            <GlassCard className="!p-4 space-y-3">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">Today Summary</h3>
              <div className="space-y-2 text-xs">
                <Row label="Study Time" value={fmtMins(snap.todayStudyMinutes)} />
                <Row label="Focus Time" value={fmtMins(snap.todayFocusMinutes)} />
                <Row label="Break Time" value={fmtMins(snap.todayBreakMinutes)} />
                <Row label="Tasks Completed" value={String(snap.todayTasksCompleted)} />
                <Row label="Lectures Completed" value={String(snap.todayLecturesCompleted)} />
              </div>
            </GlassCard>

            <GlassCard className="!p-4 space-y-3">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">This Week Summary</h3>
              <div className="space-y-2 text-xs">
                <Row label="Weekly Study" value={fmtMins(snap.weekStudyMinutes)} />
                <Row label="Weekly Focus" value={fmtMins(snap.weekFocusMinutes)} />
                <Row label="Tasks Completed" value={String(snap.weekTasksCompleted)} />
                <Row label="Lectures Completed" value={String(snap.weekLecturesCompleted)} />
                <Row label="Avg Productivity" value={`${snap.weekProductivity}%`} />
              </div>
            </GlassCard>
          </div>

          {/* Browser Study History & Usage Statistics */}
          <GlassCard className="!p-4 space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-purple-600" />
              Browser Study History & Domain Usage Statistics
            </h3>
            {topDomains.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No web study domains recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {topDomains.map(([domain, mins]) => {
                  const maxMins = topDomains[0]?.[1] || 1;
                  const pct = Math.round((mins / maxMins) * 100);
                  return (
                    <div key={domain} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-slate-800">
                        <span>{domain}</span>
                        <span className="font-mono text-purple-700">{fmtMins(mins)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          {/* Recent Activity Event Stream */}
          <GlassCard className="!p-4 space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
              Recent Activity Events Stream
            </h3>
            {events.length === 0 ? (
              <p className="text-xs text-slate-400">No events logged yet.</p>
            ) : (
              <ul className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                {events.slice(0, 15).map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100"
                  >
                    <span className="font-bold text-slate-700 truncate">
                      {e.type.replace(/_/g, ' ')}
                      {e.topic ? ` · ${e.topic}` : e.subject ? ` · ${e.subject}` : ''}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {new Date(e.timestamp).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>
      )}

      {/* Study Tab */}
      {tab === 'study' && (
        <div className="space-y-4">
          <GlassCard className="!p-4 space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
              Subject Time Distribution (30 days)
            </h3>
            {subjects.length === 0 ? (
              <p className="text-xs text-slate-400">No subject activity yet.</p>
            ) : (
              <div className="space-y-2">
                {subjects.map((s) => {
                  const max = subjects[0]?.minutes || 1;
                  const pct = Math.round((s.minutes / max) * 100);
                  return (
                    <div key={s.subject} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-slate-700">{s.subject}</span>
                        <span className="font-mono text-slate-500">{fmtMins(s.minutes)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          <GlassCard className="!p-4 space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
              Daily Study History Table
            </h3>
            {days.length === 0 ? (
              <p className="text-xs text-slate-400">No days recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase text-slate-400 border-b border-slate-100">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Study</th>
                      <th className="py-2 pr-2">Focus</th>
                      <th className="py-2 pr-2">Break</th>
                      <th className="py-2 pr-2">Tasks</th>
                      <th className="py-2 pr-2">Lectures</th>
                      <th className="py-2">Prod. Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d) => (
                      <tr key={d.date} className="border-b border-slate-50">
                        <td className="py-2 pr-2 font-bold text-slate-700">{d.date}</td>
                        <td className="py-2 pr-2 font-mono">{fmtMins(d.studyMinutes)}</td>
                        <td className="py-2 pr-2 font-mono">{fmtMins(d.focusMinutes)}</td>
                        <td className="py-2 pr-2 font-mono">{fmtMins(d.breakMinutes)}</td>
                        <td className="py-2 pr-2">{d.tasksCompleted}</td>
                        <td className="py-2 pr-2">{d.lecturesCompleted}</td>
                        <td className="py-2 font-bold text-teal-700">{d.productivityScore}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Time Tab */}
      {tab === 'time' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <GlassCard className="!p-4 text-center">
              <Clock className="w-5 h-5 text-blue-600 mx-auto mb-1" />
              <div className="text-xl font-black">{fmtMins(snap.todayFocusMinutes)}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Today Focus</div>
            </GlassCard>
            <GlassCard className="!p-4 text-center">
              <Coffee className="w-5 h-5 text-amber-600 mx-auto mb-1" />
              <div className="text-xl font-black">{fmtMins(snap.todayBreakMinutes)}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Today Break</div>
            </GlassCard>
            <GlassCard className="!p-4 text-center">
              <Target className="w-5 h-5 text-teal-600 mx-auto mb-1" />
              <div className="text-xl font-black">
                {snap.todayFocusMinutes + snap.todayBreakMinutes > 0
                  ? `${Math.round(
                      (snap.todayFocusMinutes /
                        (snap.todayFocusMinutes + snap.todayBreakMinutes)) *
                        100
                    )}%`
                  : '0%'}
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Focus Ratio</div>
            </GlassCard>
          </div>

          <GlassCard className="!p-4 space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
              Live Session Timeline
            </h3>
            {events.filter((e) =>
              [
                'study_session',
                'focus_started',
                'focus_ended',
                'break_started',
                'task_started',
                'task_completed',
              ].includes(e.type)
            ).length === 0 ? (
              <p className="text-xs text-slate-400">No session timeline events yet.</p>
            ) : (
              <ul className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                {events
                  .filter((e) =>
                    [
                      'study_session',
                      'focus_started',
                      'focus_ended',
                      'break_started',
                      'task_started',
                      'task_completed',
                    ].includes(e.type)
                  )
                  .map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-2 text-xs px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <span className="font-bold text-slate-700">
                        {e.type.replace(/_/g, ' ')}
                        {e.durationMinutes ? ` · ${fmtMins(e.durationMinutes)}` : ''}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(e.timestamp).toLocaleTimeString()}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </GlassCard>
        </div>
      )}

      {/* Tasks Tab */}
      {tab === 'tasks' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <GlassCard className="!p-3 text-center">
              <div className="text-xl font-black text-emerald-600">{snap.completedTasks}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Completed</div>
            </GlassCard>
            <GlassCard className="!p-3 text-center">
              <div className="text-xl font-black text-slate-800">{snap.todayTasksCompleted}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Today</div>
            </GlassCard>
            <GlassCard className="!p-3 text-center">
              <div className="text-xl font-black text-teal-700">
                {snap.completedTasks + days.reduce((s, d) => s + d.tasksMissed, 0) > 0
                  ? `${Math.round(
                      (snap.completedTasks /
                        (snap.completedTasks + days.reduce((s, d) => s + d.tasksMissed, 0))) *
                        100
                    )}%`
                  : '0%'}
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Completion Rate</div>
            </GlassCard>
          </div>

          <GlassCard className="!p-4 space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
              Task Execution History & Productivity Scores
            </h3>
            {taskHistory.length === 0 ? (
              <p className="text-xs text-slate-400">No task history recorded.</p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar">
                {taskHistory.map((h) => (
                  <div
                    key={h.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-800">{h.taskName}</div>
                      <div className="text-[10px] text-slate-400">
                        {h.subject} • {h.date} • Focus: {h.activeStudyTimeMinutes}m
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800">
                        Score: {h.productivityScore}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Progress Tab */}
      {tab === 'progress' && (
        <div className="space-y-4">
          <GlassCard className="!p-4 space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
              Productivity Score Trend (Daily)
            </h3>
            {days.length === 0 ? (
              <p className="text-xs text-slate-400">No trend data yet.</p>
            ) : (
              <div className="flex items-end gap-1.5 h-32 pt-2">
                {[...days].reverse().map((d) => {
                  const score = d.productivityScore || 0;
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <span className="text-[9px] font-bold text-slate-600">{score}%</span>
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-purple-600 via-indigo-500 to-teal-400"
                        style={{ height: `${Math.max(10, score)}%` }}
                        title={`${d.date}: Productivity ${score}%`}
                      />
                      <span className="text-[8px] font-mono text-slate-400 truncate w-full text-center">
                        {d.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Storage Management Tab */}
      {tab === 'storage' && (
        <div className="space-y-4">
          <GlassCard className="!p-4 space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
              Storage Policy
            </h3>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'keep_all' as StoragePolicy, label: 'Keep all history' },
                  { id: 'archive_yearly' as StoragePolicy, label: 'Archive yearly' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    analyticsService.setStoragePolicy(p.id);
                    setPolicy(p.id);
                    onShowNotification?.(`Policy: ${p.label}`, 'Smart Analytics');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                    policy === p.id
                      ? 'bg-teal-50 border-teal-300 text-teal-800'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-teal-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Events: {analyticsService.getStore().events.length} · Days:{' '}
              {Object.keys(analyticsService.getStore().days).length} · Weekly Archives:{' '}
              {weeks.length}
            </p>
          </GlassCard>

          <GlassCard className="!p-4 space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide text-rose-700">
              Clear All Analytics Data
            </h3>
            <p className="text-xs text-slate-500">
              Resets Analytics to zero. Does not delete study tasks or notes in the main database.
            </p>
            <button
              onClick={() => {
                if (
                  typeof window !== 'undefined' &&
                  window.confirm('Clear all analytics data and start from zero?')
                ) {
                  analyticsService.resetAll();
                  refresh();
                  onShowNotification?.('Analytics reset to zero', 'Smart Analytics');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear all analytics data
            </button>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-slate-500 font-semibold">{label}</span>
    <span className="font-black text-slate-800 font-mono">{value}</span>
  </div>
);

export default AnalyticsWorkspace;
