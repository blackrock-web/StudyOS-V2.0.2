import React, { useState } from 'react';
import { X, Clock, Plus, Trash2, RotateCcw, Check, Sparkles, AlertCircle } from 'lucide-react';
import { RoutineSlotConfig, DEFAULT_ROUTINE_SLOTS, useExam } from '../../context/ExamContext';
import { GlassCard } from '../shared/GlassCard';

interface RoutineSlotEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowNotification?: (msg: string, title?: string) => void;
}

export const RoutineSlotEditorModal: React.FC<RoutineSlotEditorModalProps> = ({
  isOpen,
  onClose,
  onShowNotification,
}) => {
  const { routineSlots, updateRoutineSlots, resetRoutineSlots, activeExam } = useExam();
  const [slots, setSlots] = useState<RoutineSlotConfig[]>(() => JSON.parse(JSON.stringify(routineSlots)));

  if (!isOpen) return null;

  const handleUpdateSlot = (id: string, field: keyof RoutineSlotConfig, value: any) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleAddSlot = () => {
    const newSlot: RoutineSlotConfig = {
      id: `slot-custom-${Date.now()}`,
      name: 'New Custom Slot',
      startTime: '10:00',
      endTime: '12:00',
      color: 'indigo',
      focusType: 'General',
      description: 'Focused deep work study session',
    };
    setSlots((prev) => [...prev, newSlot]);
  };

  const handleDeleteSlot = (id: string) => {
    if (slots.length <= 1) {
      if (onShowNotification) onShowNotification('You must keep at least one routine slot.', 'Routine Slot Error');
      return;
    }
    setSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSave = () => {
    updateRoutineSlots(slots);
    if (onShowNotification) {
      onShowNotification(`Saved ${slots.length} routine time slots for ${activeExam?.title || 'exam'}!`, 'Routine Timetable Updated');
    }
    onClose();
  };

  const handleResetToDefault = () => {
    resetRoutineSlots();
    setSlots(DEFAULT_ROUTINE_SLOTS);
    if (onShowNotification) {
      onShowNotification('Routine slots reset to default standard schedule', 'Reset Complete');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-purple-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn text-slate-900">
        {/* Header */}
        <div className="p-5 border-b border-purple-100 flex items-center justify-between bg-gradient-to-r from-purple-50 via-white to-pink-50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-purple-600 text-white shadow-md">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>Edit Timetable Routine Slots</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                  {activeExam?.code || 'Active Exam'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Customize time intervals, slot labels, focus categories, and color tags.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Slot List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-[#FAF9FE]">
          {slots.map((slot, index) => {
            return (
              <div
                key={slot.id}
                className="p-4 rounded-2xl bg-white border border-purple-100 shadow-xs space-y-3 transition-all hover:border-purple-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 text-xs font-black flex items-center justify-center">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={slot.name}
                      onChange={(e) => handleUpdateSlot(slot.id, 'name', e.target.value)}
                      placeholder="Slot Name (e.g. Morning Focus)"
                      className="font-bold text-sm text-slate-900 px-2.5 py-1 rounded-xl border border-slate-200 focus:border-purple-500 focus:outline-hidden bg-slate-50/60 flex-1 max-w-xs"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <select
                      value={slot.color}
                      onChange={(e) => handleUpdateSlot(slot.id, 'color', e.target.value)}
                      className="text-xs font-bold px-2 py-1 rounded-xl border border-slate-200 bg-white text-slate-700 cursor-pointer"
                    >
                      <option value="amber">Amber</option>
                      <option value="orange">Orange</option>
                      <option value="sky">Sky Blue</option>
                      <option value="purple">Purple</option>
                      <option value="emerald">Emerald</option>
                      <option value="rose">Rose</option>
                      <option value="indigo">Indigo</option>
                    </select>

                    <button
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete Slot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) => handleUpdateSlot(slot.id, 'startTime', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-mono font-bold bg-white text-slate-800 focus:border-purple-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">End Time</label>
                    <input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) => handleUpdateSlot(slot.id, 'endTime', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-mono font-bold bg-white text-slate-800 focus:border-purple-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Primary Focus Type</label>
                    <select
                      value={slot.focusType}
                      onChange={(e) => handleUpdateSlot(slot.id, 'focusType', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-bold bg-white text-slate-800 cursor-pointer focus:border-purple-500 focus:outline-hidden"
                    >
                      <option value="Lecture">Lecture & Core Theory</option>
                      <option value="Practice">Problem Solving & DPP</option>
                      <option value="Revision">Revision & Flashcards</option>
                      <option value="Mock">Mock Test & Analysis</option>
                      <option value="General">General Deep Study</option>
                    </select>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={slot.description || ''}
                    onChange={(e) => handleUpdateSlot(slot.id, 'description', e.target.value)}
                    placeholder="Slot purpose note (e.g. High cognitive energy — Complex algorithmic topics)"
                    className="w-full text-[11px] text-slate-600 px-3 py-1.5 rounded-xl border border-slate-100 bg-slate-50 focus:border-purple-400 focus:outline-hidden"
                  />
                </div>
              </div>
            );
          })}

          <button
            onClick={handleAddSlot}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-purple-200 hover:border-purple-400 hover:bg-purple-50/50 text-purple-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Custom Routine Time Slot
          </button>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-purple-100 flex items-center justify-between bg-white">
          <button
            onClick={handleResetToDefault}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Default
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" /> Save Routine Slots
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
