import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  Trash2,
  X,
  BookOpen,
  ArrowRight,
  Target,
  Zap,
  Award,
  Filter,
  Check,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { TaskTemplate, TaskTemplateItem, TaskItem } from '../../types';
import {
  taskTemplateService,
  DEFAULT_TASK_TEMPLATES,
} from '../../services/taskTemplateService';
import { db } from '../../services/db';

interface TaskTemplateRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowNotification: (msg: string, title?: string) => void;
  targetExamId?: string;
}

export const TaskTemplateRepositoryModal: React.FC<TaskTemplateRepositoryModalProps> = ({
  isOpen,
  onClose,
  onShowNotification,
  targetExamId,
}) => {
  const currentExamId = targetExamId || db.getActiveExamId();
  const activeExam = db.getExams().find((e) => e.id === currentExamId);
  const examSubjects = db.getCurrentExamSubjects(currentExamId);

  const [templates, setTemplates] = useState<TaskTemplate[]>(() => taskTemplateService.getTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(DEFAULT_TASK_TEMPLATES[0].id);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [subjectMapping, setSubjectMapping] = useState<Record<string, string>>({});
  const [selectedTaskIndices, setSelectedTaskIndices] = useState<number[]>([]);
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);

  // Custom template form state
  const [customTitle, setCustomTitle] = useState('');
  const [customCategory, setCustomCategory] = useState<TaskTemplate['category']>('Custom');
  const [customDescription, setCustomDescription] = useState('');
  const [customDuration, setCustomDuration] = useState(7);
  const [customTasks, setCustomTasks] = useState<TaskTemplateItem[]>([
    {
      title: 'Morning Theory & Revision Block',
      type: 'Lecture',
      subjectPlaceholder: 'Primary Subject',
      timeSlot: 'Morning',
      priority: 'High',
      estimatedMinutes: 90,
      startTime: '08:00',
      endTime: '09:30',
      dayOffset: 0,
      recurring: 'Daily',
      description: 'Review core topics and solve representative practice problems.',
    },
  ]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  useEffect(() => {
    const refresh = () => setTemplates(taskTemplateService.getTemplates());
    window.addEventListener('studyos_task_templates_updated', refresh);
    return () => window.removeEventListener('studyos_task_templates_updated', refresh);
  }, []);

  // Initialize selected tasks and subject mappings when template changes
  useEffect(() => {
    if (selectedTemplate) {
      setSelectedTaskIndices(selectedTemplate.defaultTasks.map((_, i) => i));

      // Extract unique placeholders
      const placeholders = Array.from(
        new Set(selectedTemplate.defaultTasks.map((t) => t.subjectPlaceholder).filter(Boolean))
      ) as string[];

      const initialMap: Record<string, string> = {};
      placeholders.forEach((ph, idx) => {
        initialMap[ph] = examSubjects[idx % examSubjects.length] || examSubjects[0] || 'General Studies';
      });
      setSubjectMapping(initialMap);
    }
  }, [selectedTemplateId, currentExamId, examSubjects.length]);

  if (!isOpen) return null;

  const categories = ['All', 'Sprint', 'Daily Routine', 'Practice', 'Revision', 'Exam Prep', 'Custom'];
  const filteredTemplates = templates.filter((t) => {
    if (categoryFilter === 'All') return true;
    return t.category === categoryFilter;
  });

  const handleImport = () => {
    if (!selectedTemplate) return;

    try {
      const result = taskTemplateService.instantiateTemplateIntoExam(selectedTemplate.id, {
        targetExamId: currentExamId,
        startDate,
        subjectMapping,
        selectedTaskIndices:
          selectedTaskIndices.length === selectedTemplate.defaultTasks.length ? undefined : selectedTaskIndices,
      });

      onShowNotification(
        `Successfully imported ${result.count} tasks from "${selectedTemplate.title}" into ${activeExam?.title || 'active exam'}!`,
        'Template Imported'
      );
      onClose();
    } catch (err: any) {
      onShowNotification(err.message || 'Failed to import template', 'Error');
    }
  };

  const handleSaveCustomTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) {
      alert('Please provide a template title');
      return;
    }

    const newTemplate: TaskTemplate = {
      id: `tmpl-custom-${Date.now()}`,
      title: customTitle.trim(),
      category: customCategory,
      description: customDescription.trim() || 'Custom user created study template.',
      durationDays: Number(customDuration) || 7,
      defaultTasks: customTasks,
      isCustom: true,
      badge: 'Custom',
    };

    taskTemplateService.saveCustomTemplate(newTemplate);
    setTemplates(taskTemplateService.getTemplates());
    setSelectedTemplateId(newTemplate.id);
    setIsCreatingCustom(false);
    onShowNotification(`Created custom template "${newTemplate.title}"`, 'Template Saved');
  };

  const addCustomTaskRow = () => {
    setCustomTasks([
      ...customTasks,
      {
        title: 'New Study Task',
        type: 'Practice',
        subjectPlaceholder: 'Target Subject',
        timeSlot: 'Afternoon',
        priority: 'Medium',
        estimatedMinutes: 60,
        startTime: '14:00',
        endTime: '15:00',
        dayOffset: 0,
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-purple-50 via-indigo-50 to-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">Task Template Repository</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                  Reusable & Universal
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Import proven study blueprints directly into <strong className="text-purple-900">{activeExam?.title || 'active workspace'}</strong> as independent tasks.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {!isCreatingCustom ? (
              <button
                onClick={() => setIsCreatingCustom(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Template</span>
              </button>
            ) : (
              <button
                onClick={() => setIsCreatingCustom(false)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Browse Repository</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {isCreatingCustom ? (
          /* Custom Template Builder */
          <form onSubmit={handleSaveCustomTemplate} className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Template Title *</label>
                <input
                  type="text"
                  required
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g., Weekend 10-Hour Deep Work Marathon"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden bg-white"
                >
                  <option value="Sprint">Sprint</option>
                  <option value="Daily Routine">Daily Routine</option>
                  <option value="Practice">Practice</option>
                  <option value="Revision">Revision</option>
                  <option value="Exam Prep">Exam Prep</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Brief note describing purpose and schedule strategy..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Days)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={customDuration}
                  onChange={(e) => setCustomDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Template Tasks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Template Tasks Routine</h3>
                <button
                  type="button"
                  onClick={addCustomTaskRow}
                  className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Task Block
                </button>
              </div>

              <div className="space-y-2">
                {customTasks.map((task, idx) => (
                  <div key={idx} className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex flex-wrap items-center gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="Task Title"
                      value={task.title}
                      onChange={(e) => {
                        const copy = [...customTasks];
                        copy[idx].title = e.target.value;
                        setCustomTasks(copy);
                      }}
                      className="flex-1 min-w-[150px] px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-medium"
                    />

                    <select
                      value={task.type}
                      onChange={(e) => {
                        const copy = [...customTasks];
                        copy[idx].type = e.target.value as any;
                        setCustomTasks(copy);
                      }}
                      className="px-2 py-1.5 border border-slate-200 rounded-lg bg-white font-medium"
                    >
                      <option value="Lecture">Lecture</option>
                      <option value="Practice">Practice</option>
                      <option value="DPP">DPP</option>
                      <option value="Revision">Revision</option>
                      <option value="Flashcards">Flashcards</option>
                      <option value="Notes">Notes</option>
                      <option value="Mock">Mock Test</option>
                      <option value="Formula Revision">Formula</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Placeholder Subject"
                      value={task.subjectPlaceholder || ''}
                      onChange={(e) => {
                        const copy = [...customTasks];
                        copy[idx].subjectPlaceholder = e.target.value;
                        setCustomTasks(copy);
                      }}
                      className="w-32 px-2 py-1.5 border border-slate-200 rounded-lg bg-white font-medium"
                    />

                    <input
                      type="time"
                      value={task.startTime || '08:00'}
                      onChange={(e) => {
                        const copy = [...customTasks];
                        copy[idx].startTime = e.target.value;
                        setCustomTasks(copy);
                      }}
                      className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                    />

                    <input
                      type="number"
                      placeholder="Mins"
                      value={task.estimatedMinutes}
                      onChange={(e) => {
                        const copy = [...customTasks];
                        copy[idx].estimatedMinutes = Number(e.target.value);
                        setCustomTasks(copy);
                      }}
                      className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg bg-white font-medium"
                    />

                    {customTasks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCustomTasks(customTasks.filter((_, i) => i !== idx))}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreatingCustom(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 transition-all cursor-pointer"
              >
                Save Template to Repository
              </button>
            </div>
          </form>
        ) : (
          /* Template Browser & Importer */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left Column: Template List */}
            <div className="w-full md:w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
              {/* Category Pills */}
              <div className="p-3 border-b border-slate-100 overflow-x-auto flex gap-1.5 custom-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
                      categoryFilter === cat
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Template Items */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {filteredTemplates.map((tmpl) => {
                  const isSelected = tmpl.id === selectedTemplateId;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => setSelectedTemplateId(tmpl.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'bg-white border-purple-400 shadow-md ring-2 ring-purple-400/20'
                          : 'bg-white border-slate-200 hover:border-purple-200 hover:bg-purple-50/20 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                          {tmpl.category}
                        </span>
                        {tmpl.badge && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            {tmpl.badge}
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-black text-slate-900 line-clamp-1 mb-1">{tmpl.title}</h4>
                      <p className="text-[11px] text-slate-500 font-medium line-clamp-2 mb-2">
                        {tmpl.description}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold pt-1 border-t border-slate-100">
                        <span>{tmpl.durationDays} Days Duration</span>
                        <span>{tmpl.defaultTasks.length} Tasks/day</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Template Preview & Configuration */}
            {selectedTemplate && (
              <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
                {/* Title & Metadata */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                      {selectedTemplate.category} Template
                    </span>
                    {selectedTemplate.isCustom && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete custom template "${selectedTemplate.title}"?`)) {
                            taskTemplateService.deleteCustomTemplate(selectedTemplate.id);
                            setTemplates(taskTemplateService.getTemplates());
                            setSelectedTemplateId(DEFAULT_TASK_TEMPLATES[0].id);
                          }
                        }}
                        className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 font-bold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Template
                      </button>
                    )}
                  </div>
                  <h3 className="text-base font-black text-slate-900 mt-2">{selectedTemplate.title}</h3>
                  <p className="text-xs text-slate-600 font-medium mt-1">{selectedTemplate.description}</p>
                </div>

                {/* Import Configuration: Date & Subject Mapping */}
                <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-3">
                  <h4 className="text-xs font-black text-purple-950 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-purple-600" />
                    Configure Workspace Import Settings
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Start Date in {activeExam?.title || 'Active Workspace'}
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Active Destination Exam
                      </label>
                      <div className="px-3 py-1.5 bg-purple-100/70 border border-purple-200 rounded-xl text-xs font-bold text-purple-900 flex items-center justify-between">
                        <span className="truncate">{activeExam?.title || 'Selected Exam'}</span>
                        <span className="text-[10px] text-purple-700 font-extrabold bg-purple-200 px-1.5 py-0.5 rounded">
                          {activeExam?.category || 'General'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Subject Placeholders Mapping */}
                  {Object.keys(subjectMapping).length > 0 && (
                    <div className="pt-2 border-t border-purple-100 space-y-2">
                      <div className="text-[11px] font-bold text-slate-700">Subject Mapping for this Exam:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.entries(subjectMapping).map(([ph, mappedSubject]) => (
                          <div key={ph} className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-600 w-28 truncate shrink-0">{ph}:</span>
                            <select
                              value={mappedSubject}
                              onChange={(e) =>
                                setSubjectMapping({
                                  ...subjectMapping,
                                  [ph]: e.target.value,
                                })
                              }
                              className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden"
                            >
                              {examSubjects.map((sub) => (
                                <option key={sub} value={sub}>
                                  {sub}
                                </option>
                              ))}
                              {!examSubjects.includes(mappedSubject) && (
                                <option value={mappedSubject}>{mappedSubject}</option>
                              )}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tasks Preview */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Tasks to Generate ({selectedTemplate.defaultTasks.length} per day × {selectedTemplate.durationDays} days)
                    </h4>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Total: {selectedTemplate.defaultTasks.length * selectedTemplate.durationDays} exam tasks
                    </span>
                  </div>

                  <div className="space-y-2">
                    {selectedTemplate.defaultTasks.map((t, idx) => {
                      const isChecked = selectedTaskIndices.includes(idx);
                      const mappedSub =
                        (t.subjectPlaceholder && subjectMapping[t.subjectPlaceholder]) ||
                        t.subjectPlaceholder ||
                        'Subject';

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (isChecked) {
                              setSelectedTaskIndices(selectedTaskIndices.filter((i) => i !== idx));
                            } else {
                              setSelectedTaskIndices([...selectedTaskIndices, idx]);
                            }
                          }}
                          className={`p-3 rounded-2xl border transition-all flex items-start space-x-3 cursor-pointer ${
                            isChecked
                              ? 'bg-slate-50 border-slate-200 hover:border-purple-300'
                              : 'bg-slate-100/50 border-slate-200/60 opacity-60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-xs text-slate-900">{t.title}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                                {t.type}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                                {mappedSub}
                              </span>
                            </div>
                            {t.description && (
                              <p className="text-[11px] text-slate-500 font-medium mt-0.5">{t.description}</p>
                            )}
                          </div>

                          <div className="text-right text-[11px] font-mono font-bold text-slate-500 shrink-0">
                            <div>{t.startTime} - {t.endTime}</div>
                            <div className="text-slate-400">{t.estimatedMinutes} mins</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-500 font-medium">
                    Importing creates independent tasks tagged with <strong>{activeExam?.title}</strong>.
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={handleImport}
                      disabled={selectedTaskIndices.length === 0}
                      className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-black shadow-md shadow-purple-500/20 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Import into {activeExam?.title || 'Exam'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
