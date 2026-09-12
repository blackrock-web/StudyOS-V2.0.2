import React, { useState } from 'react';
import { Flame, Calendar, Trophy, Zap, Sparkles, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { db } from '../../services/db';
import { GlassCard } from '../shared/GlassCard';

export const StudyFlameHeatMap: React.FC = () => {
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    displayDate: string;
    mins: number;
    hours: string;
    score: number;
  } | null>(null);

  const activityLogs = db.getActivityLogs();

  // Generate last 30 days array
  const today = new Date();
  const last30Days = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date();
    d.setDate(today.getDate() - (29 - i));
    const isoDate = d.toISOString().split('T')[0];
    const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });

    // Lookup matching activity log or default
    const log = activityLogs.find((l) => l.date === isoDate);
    const mins = log ? log.studyMinutes : 0;
    const hours = (mins / 60).toFixed(1);
    const score = log ? log.productivityScore : mins > 0 ? 80 : 0;

    return {
      date: isoDate,
      displayDate,
      mins,
      hours,
      score,
      isToday: i === 29,
    };
  });

  // Calculate metrics
  const activeDaysCount = last30Days.filter((d) => d.mins > 0).length;
  const consistencyPercent = Math.round((activeDaysCount / 30) * 100);
  const totalMins30Days = last30Days.reduce((acc, d) => acc + d.mins, 0);
  const totalHours30Days = (totalMins30Days / 60).toFixed(1);
  const avgMinsPerDay = Math.round(totalMins30Days / 30);
  const avgHoursPerDay = (avgMinsPerDay / 60).toFixed(1);

  // Compute current streak
  let currentStreak = 0;
  for (let i = last30Days.length - 1; i >= 0; i--) {
    if (last30Days[i] && last30Days[i]!.mins > 0) {
      currentStreak++;
    } else if (i < last30Days.length - 1) {
      break;
    }
  }

  // Get Flame Intensity level & color
  const getFlameLevel = (mins: number) => {
    if (mins === 0) {
      return {
        bg: 'bg-slate-100/80 border-slate-200/80 text-slate-400',
        flameCount: 0,
        label: 'Rest Day (0m)',
      };
    }
    if (mins < 60) {
      return {
        bg: 'bg-orange-100 border-orange-200 text-orange-600',
        flameCount: 1,
        label: 'Light Focus (<1h)',
      };
    }
    if (mins < 120) {
      return {
        bg: 'bg-amber-200 border-amber-300 text-amber-800',
        flameCount: 2,
        label: 'Moderate Focus (1-2h)',
      };
    }
    if (mins < 240) {
      return {
        bg: 'bg-orange-500 border-orange-600 text-white shadow-xs',
        flameCount: 3,
        label: 'Deep Focus (2-4h)',
      };
    }
    return {
      bg: 'bg-gradient-to-tr from-orange-500 via-rose-500 to-pink-600 border-rose-400 text-white shadow-md shadow-rose-500/20 ring-2 ring-rose-300/50',
      flameCount: 4,
      label: 'Supercharged Focus (4h+)',
    };
  };

  return (
    <GlassCard className="p-5 space-y-4 font-sans select-none relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-orange-500 to-rose-600 text-white shadow-md shadow-orange-500/20">
            <Flame className="w-5 h-5 fill-current animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>30-Day Focus Consistency Heat-Map</span>
              <span className="text-[10px] font-extrabold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                {consistencyPercent}% Consistent
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Daily study intensity & habit formation tracking over the last 30 days
            </p>
          </div>
        </div>

        {/* Top Summary Chips */}
        <div className="flex items-center space-x-2 text-xs font-mono font-black">
          <div className="px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-600 fill-current" />
            <span>{currentStreak} Day Streak</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-600" />
            <span>{totalHours30Days} Total Hrs</span>
          </div>
        </div>
      </div>

      {/* Heat-Map Grid */}
      <div className="space-y-2">
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 lg:grid-cols-15 gap-2">
          {last30Days.map((day) => {
            const level = getFlameLevel(day.mins);
            return (
              <div
                key={day.date}
                onMouseEnter={() => setHoveredDay(day ? { ...day, date: day.date || '' } : null)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`relative aspect-square rounded-2xl border p-1.5 flex flex-col items-center justify-between cursor-pointer transition-all hover:scale-110 hover:z-20 ${level.bg}`}
              >
                {/* Date Header */}
                <span className="text-[9px] font-extrabold uppercase tracking-tighter truncate w-full text-center">
                  {day.displayDate.split(',')[0]}
                </span>

                {/* Flame Icon or Dot */}
                <div className="my-auto flex items-center justify-center">
                  {day.mins > 0 ? (
                    <Flame className="w-4 h-4 fill-current drop-shadow-xs" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  )}
                </div>

                {/* Hours or Day Number */}
                <span className="text-[9px] font-mono font-black text-center truncate w-full">
                  {day.mins > 0 ? `${day.hours}h` : day.displayDate.split(' ')[1]}
                </span>

                {day.isToday && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                )}
              </div>
            );
          })}
        </div>

        {/* Hovered Day Details or Legend */}
        <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          {hoveredDay ? (
            <div className="flex items-center space-x-3 text-slate-800 font-medium">
              <span className="font-black text-purple-900 bg-purple-100 px-2.5 py-1 rounded-xl border border-purple-200">
                📅 {hoveredDay.displayDate}
              </span>
              <span>
                Focus Time: <strong className="font-mono text-slate-900">{hoveredDay.hours} Hours</strong> ({hoveredDay.mins} mins)
              </span>
              <span>•</span>
              <span className="text-emerald-700 font-bold">Productivity: {hoveredDay.score}%</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-medium overflow-x-auto custom-scrollbar">
              <span className="font-bold text-slate-700 shrink-0">Flame Scale:</span>
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 shrink-0">0h Rest</span>
              <span className="px-2 py-0.5 rounded-lg bg-orange-100 border border-orange-200 text-orange-700 font-bold shrink-0">&lt;1h Light</span>
              <span className="px-2 py-0.5 rounded-lg bg-amber-200 border border-amber-300 text-amber-900 font-bold shrink-0">1-2h Solid</span>
              <span className="px-2 py-0.5 rounded-lg bg-orange-500 text-white font-bold shrink-0">2-4h Deep</span>
              <span className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-orange-500 to-rose-600 text-white font-black shrink-0">4h+ Flame</span>
            </div>
          )}

          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 ml-auto">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Avg {avgHoursPerDay} hrs / day over last 30 days</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};
