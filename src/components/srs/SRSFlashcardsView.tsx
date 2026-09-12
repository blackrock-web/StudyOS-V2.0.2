import React, { useState } from 'react';
import {
  Layers,
  RotateCw,
  Sparkles,
  CheckCircle,
  XCircle,
  Plus,
  HelpCircle,
  Zap,
  Filter,
} from 'lucide-react';
import { db } from '../../services/db';
import { reviewFlashcard } from '../../services/srsEngine';
import { Flashcard } from '../../types';
import { GlassCard } from '../shared/GlassCard';

interface SRSFlashcardsViewProps {
  onShowNotification: (msg: string, title?: string) => void;
}

export const SRSFlashcardsView: React.FC<SRSFlashcardsViewProps> = ({
  onShowNotification,
}) => {
  const [cards, setFlashcards] = useState<Flashcard[]>(db.getFlashcards());
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredCards = cards.filter((c) => selectedCategory === 'ALL' || c.category === selectedCategory);
  const activeCard = filteredCards[activeCardIndex] || filteredCards[0];

  const handleRating = (confidence: number) => {
    if (!activeCard) return;

    const updatedCard = reviewFlashcard(activeCard, confidence);
    db.updateFlashcard(updatedCard);
    setFlashcards(db.getFlashcards());
    setIsFlipped(false);

    if (activeCardIndex < filteredCards.length - 1) {
      setActiveCardIndex(activeCardIndex + 1);
    } else {
      setActiveCardIndex(0);
    }

    onShowNotification(
      `Reviewed card! Next SRS interval: ${updatedCard.intervalDays} Days (${updatedCard.nextReviewDate})`,
      'SRS Engine'
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-[#1e1b4b] font-sans select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-100 pb-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
            <Layers className="w-5 h-5 text-purple-600" /> Spaced Repetition (SRS) Flashcards
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Automated scheduling with 1d, 3d, 7d, 15d, 30d, 60d, 90d intervals based on memory retention performance.
          </p>
        </div>

        {/* Filter dropdown */}
        <div className="flex items-center space-x-2 shrink-0">
          <Filter className="w-4 h-4 text-purple-600" />
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setActiveCardIndex(0);
              setIsFlipped(false);
            }}
            className="bg-white border border-purple-200/80 text-xs font-bold text-slate-800 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
          >
            <option value="ALL">All Decks ({cards.length})</option>
            <option value="Flashcard">Flashcards</option>
            <option value="Formula">Formula Sheets</option>
            <option value="Concept">Key Concepts</option>
            <option value="Short Note">Short Notes</option>
          </select>
        </div>
      </div>

      {/* Main Flashcard Interactive Stage */}
      {filteredCards.length > 0 && activeCard ? (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Card Indicator */}
          <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
            <span className="font-bold">
              Card {activeCardIndex + 1} of {filteredCards.length}
            </span>
            <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-black border border-purple-200">
              Interval: {activeCard.intervalDays} Days
            </span>
          </div>

          {/* Flip Card Stage */}
          <GlassCard
            onClick={() => setIsFlipped(!isFlipped)}
            className="cursor-pointer min-h-[280px] p-8 flex flex-col justify-between shadow-lg hover:shadow-xl transition-all relative overflow-hidden group border-purple-200/80 hover:border-purple-300"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 font-extrabold border-b border-purple-100 pb-3">
              <span title={`${activeCard.subject} • ${activeCard.chapter}`}>{activeCard.subject} • {activeCard.chapter}</span>
              <span className="text-purple-600 font-black">{isFlipped ? 'BACK (ANSWER)' : 'FRONT (QUESTION)'}</span>
            </div>

            <div className="my-6 text-center space-y-3">
              <div className="text-lg md:text-xl font-black text-slate-900 leading-relaxed tracking-tight">
                {isFlipped ? activeCard.back : activeCard.front}
              </div>
              {isFlipped && activeCard.formula && (
                <div className="p-3 rounded-xl bg-purple-50/80 border border-purple-200/80 font-mono text-xs text-purple-700 font-extrabold inline-block">
                  Formula: {activeCard.formula}
                </div>
              )}
            </div>

            <div className="text-center text-xs text-slate-500 font-bold flex items-center justify-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5 text-purple-600 group-hover:rotate-180 transition-transform duration-500" />
              <span>Click card to flip</span>
            </div>
          </GlassCard>

          {/* Rating Buttons */}
          {isFlipped && (
            <div className="grid grid-cols-3 gap-4 pt-2">
              <button
                onClick={() => handleRating(1)}
                className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-black text-xs shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-center gap-1"
              >
                <span>Hard / Forgot</span>
                <span className="text-[10px] text-rose-600 font-mono font-extrabold">Repeat Day 1</span>
              </button>

              <button
                onClick={() => handleRating(3)}
                className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 font-black text-xs shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-center gap-1"
              >
                <span>Good / Recalled</span>
                <span className="text-[10px] text-amber-600 font-mono font-extrabold">+1 SRS Interval</span>
              </button>

              <button
                onClick={() => handleRating(5)}
                className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-black text-xs shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-center gap-1"
              >
                <span>Easy / Mastered</span>
                <span className="text-[10px] text-emerald-600 font-mono font-extrabold">+2 SRS Intervals</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <GlassCard className="text-center py-12 text-slate-500 text-xs font-bold">No cards found in this deck.</GlassCard>
      )}
    </div>
  );
};
