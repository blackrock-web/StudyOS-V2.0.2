import React, { useState, useEffect } from 'react';
import { Sparkles, Flame, CheckCircle2, Clock, X, BookOpen, Award, Tag, HeartHandshake } from 'lucide-react';
import { db, safeDispatch } from '../../services/db';
import { GlassCard } from '../shared/GlassCard';

interface PostSessionReflectionModalProps {
  durationMins: number;
  onClose: () => void;
  onShowNotification?: (msg: string, title?: string) => void;
}

export const PostSessionReflectionModal: React.FC<PostSessionReflectionModalProps> = ({
  durationMins,
  onClose,
  onShowNotification,
}) => {
  const [reflectionNote, setReflectionNote] = useState('');
  const [focusRating, setFocusRating] = useState<'Peak Flow' | 'High Focus' | 'Moderate' | 'Low Focus'>('Peak Flow');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Key Concepts']);
  const [subjectTitle, setSubjectTitle] = useState('Core CS Topic');

  const COMMON_TAGS = ['Problem Solving', 'Formula Practice', 'PYQs Solved', 'Deep Reading', 'SRS Flashcards', 'Revision'];

  useEffect(() => {
    const syllabus = db.getSyllabus();
    if (syllabus.length > 0 && syllabus[0]) {
      setSubjectTitle(syllabus[0].name || 'General Focus');
    }
  }, []);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSaveReflection = () => {
    // 1. Log study activity to db
    db.logStudyMinutes('studyMinutes', durationMins);
    db.logStudyMinutes('lectureMinutes', Math.round(durationMins * 0.7));

    // 2. Dispatch custom event for updates
    safeDispatch(new CustomEvent('studyos_db_updated'));
    safeDispatch(new CustomEvent('studyos_tasks_updated'));

    if (onShowNotification) {
      onShowNotification(`Logged +${durationMins}m session with reflection: "${reflectionNote || 'Completed focus session'}"`, 'Post-Session Reflection');
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn select-none">
      <div className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-lg w-full overflow-hidden flex flex-col font-sans">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-2 text-purple-200 text-xs font-black uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>Session Complete • Post-Study Reflection</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">Great Work Today!</h2>
          <p className="text-xs text-purple-100 font-medium mt-1">
            You completed <span className="font-bold underline">{durationMins} Focused Minutes</span>. Take 20 seconds to anchor what you learned.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh] custom-scrollbar">
          {/* Focused Minutes Badge & Subject */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-100 flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-purple-600 text-white font-bold">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase text-purple-600">Focused Duration</div>
                <div className="text-base font-black text-slate-900 font-mono">{durationMins} Minutes</div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-pink-50 border border-pink-100 flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-pink-600 text-white font-bold">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase text-pink-600">Active Workspace</div>
                <div className="text-xs font-black text-slate-900 truncate max-w-[120px]">{subjectTitle}</div>
              </div>
            </div>
          </div>

          {/* Reflection Note Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>What did you accomplish or learn during this session?</span>
              <span className="text-[10px] font-medium text-slate-400">Quick Note</span>
            </label>
            <textarea
              rows={3}
              value={reflectionNote}
              onChange={(e) => setReflectionNote(e.target.value)}
              placeholder="e.g., Mastered Dijkstra's Algorithm edge cases, completed 5 GATE PYQs, revised memory management formulas..."
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none bg-slate-50/50"
            />
          </div>

          {/* Focus Rating Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 block">Focus & Energy Rating</label>
            <div className="grid grid-cols-4 gap-2 text-[11px] font-extrabold">
              {[
                { label: 'Peak Flow', icon: '🔥', color: 'border-purple-500 bg-purple-50 text-purple-700' },
                { label: 'High Focus', icon: '🧠', color: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
                { label: 'Moderate', icon: '⚡', color: 'border-amber-500 bg-amber-50 text-amber-700' },
                { label: 'Low Focus', icon: '😴', color: 'border-slate-300 bg-slate-50 text-slate-600' },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => setFocusRating(item.label as any)}
                  className={`py-2 px-2 rounded-2xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    focusRating === item.label ? `${item.color} shadow-sm ring-2 ring-purple-300 font-black` : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-[10px]">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Key Topics / Tags */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-purple-600" />
              <span>Activity Tags</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {isSelected ? '✓ ' : ''}{tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
          >
            Skip for Now
          </button>

          <button
            onClick={handleSaveReflection}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 text-white font-black text-xs shadow-md shadow-purple-500/20 flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Save Reflection & Log Session</span>
          </button>
        </div>
      </div>
    </div>
  );
};
