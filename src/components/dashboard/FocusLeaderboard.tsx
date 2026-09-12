import React, { useState } from 'react';
import { Trophy, Flame, Award, ShieldCheck, Crown, Users, Sparkles, TrendingUp, Star, Medal, CheckCircle2 } from 'lucide-react';
import { authService } from '../../services/auth';
import { db } from '../../services/db';
import { GlassCard } from '../shared/GlassCard';

export const FocusLeaderboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'achievements'>('leaderboard');
  const accounts = authService.getAccounts();
  const currentUser = authService.getCurrentUser();
  const activityLogs = db.getActivityLogs();

  // Compute total study hours logged today & overall
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLog = activityLogs.find((l) => l.date === todayStr);
  const todayMins = todayLog ? todayLog.studyMinutes : 0;

  const totalStudyMinsAllTime = activityLogs.reduce((acc, log) => acc + (log.studyMinutes || 0), 0);
  const totalStudyHours = (totalStudyMinsAllTime / 60).toFixed(1);

  // Find peak single-day focus minutes
  const maxSingleDayMins = activityLogs.reduce((max, log) => Math.max(max, log.studyMinutes || 0), 0);
  const maxSingleDayHours = (maxSingleDayMins / 60).toFixed(1);

  // Generate rankings for all local accounts
  const rankedAccounts = accounts
    .map((acc, index) => {
      // Scale dummy or logged values for offline multi-user gamification
      const studyMins = acc.accountId === currentUser.accountId ? totalStudyMinsAllTime : 1200 + index * 450;
      const streak = acc.accountId === currentUser.accountId ? currentUser.streakDays || 5 : 3 + index * 2;
      return {
        ...acc,
        studyMins,
        studyHours: (studyMins / 60).toFixed(1),
        streak,
        isCurrent: acc.accountId === currentUser.accountId,
      };
    })
    .sort((a, b) => b.studyMins - a.studyMins);

  const currentRankIndex = rankedAccounts.findIndex((a) => a.isCurrent) + 1;

  // Personal Achievements List
  const achievements = [
    {
      id: 'streak-7',
      title: '7-Day Focus Streak',
      desc: 'Maintained consistent study habits for 7 consecutive days',
      icon: Flame,
      unlocked: currentUser.streakDays >= 7,
      color: 'from-amber-500 to-orange-600',
    },
    {
      id: 'hours-50',
      title: '50-Hour Master Scholar',
      desc: 'Accumulated over 50 hours of deep focused learning',
      icon: Trophy,
      unlocked: totalStudyMinsAllTime >= 3000,
      color: 'from-purple-600 to-pink-600',
    },
    {
      id: 'peak-day',
      title: 'Marathon Flow State',
      desc: 'Logged over 6 hours of focused studying in a single day',
      icon: ZapIcon,
      unlocked: maxSingleDayMins >= 360,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'pyq-slayer',
      title: 'GATE Question Slayer',
      desc: 'Solved PYQs & revised SRS flashcards across multiple subjects',
      icon: Award,
      unlocked: true,
      color: 'from-indigo-600 to-blue-600',
    },
  ];

  return (
    <GlassCard className="p-5 space-y-4 font-sans select-none relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>Focus Leaderboard & Milestones</span>
              <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
                100% Offline
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Gamified local rankings & personal streak achievements
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-black">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              activeTab === 'leaderboard' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rankings
          </button>
          <button
            onClick={() => setActiveTab('achievements')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              activeTab === 'achievements' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Badges
          </button>
        </div>
      </div>

      {activeTab === 'leaderboard' ? (
        <div className="space-y-3">
          {/* Top Rank Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-amber-400 text-slate-950 font-black text-sm shadow-md">
                #{currentRankIndex}
              </div>
              <div>
                <div className="text-[10px] font-black uppercase text-amber-300 tracking-wider">Your Position</div>
                <div className="text-sm font-black">{currentUser.fullName} (@{currentUser.username})</div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-black text-amber-300 font-mono">{totalStudyHours} Hours</div>
              <div className="text-[10px] text-purple-200 font-bold flex items-center gap-1 justify-end">
                <Flame className="w-3 h-3 text-amber-400 fill-current" /> {currentUser.streakDays || 5}d Streak
              </div>
            </div>
          </div>

          {/* Account Rankings Table */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
            {rankedAccounts.map((account, idx) => {
              const rank = idx + 1;
              const isFirst = rank === 1;
              const isSecond = rank === 2;
              const isThird = rank === 3;

              return (
                <div
                  key={account.accountId}
                  className={`p-2.5 rounded-2xl border flex items-center justify-between text-xs transition-all ${
                    account.isCurrent
                      ? 'bg-purple-50/90 border-purple-300 ring-2 ring-purple-300/50 shadow-2xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        isFirst
                          ? 'bg-amber-400 text-amber-950 shadow-xs'
                          : isSecond
                          ? 'bg-slate-300 text-slate-900'
                          : isThird
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : `#${rank}`}
                    </div>

                    <div className="min-w-0">
                      <div className="font-extrabold text-slate-900 truncate flex items-center gap-1.5">
                        <span>{account.fullName}</span>
                        {account.isCurrent && (
                          <span className="text-[9px] font-black uppercase text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded-full">You</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium truncate">@{account.username}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-black text-slate-900">{account.studyHours} hrs</div>
                    <div className="text-[10px] font-bold text-amber-600 flex items-center justify-end gap-0.5">
                      <Flame className="w-2.5 h-2.5 fill-current" /> {account.streak}d Streak
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Badges & Achievements Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {achievements.map((item) => {
            const ItemIcon = item.icon;
            return (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border flex items-start space-x-3 transition-all ${
                  item.unlocked
                    ? 'bg-white border-purple-200 shadow-2xs'
                    : 'bg-slate-50/60 border-slate-200 opacity-60'
                }`}
              >
                <div
                  className={`p-2 rounded-xl text-white font-bold bg-gradient-to-tr ${item.color} shadow-xs shrink-0`}
                >
                  <ItemIcon className="w-4 h-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 truncate">{item.title}</h4>
                    {item.unlocked ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Locked</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium leading-snug mt-0.5 line-clamp-2">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
};

function ZapIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
