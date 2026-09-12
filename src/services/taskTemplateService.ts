import { TaskItem, TaskTemplate, TaskTemplateItem } from '../types';
import { db, safeDispatch } from './db';
import { syncService } from './syncService';

const CUSTOM_TEMPLATES_KEY = 'studyos_custom_task_templates';

export const DEFAULT_TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'tmpl-30-day-sprint',
    title: '30-Day Comprehensive Exam Sprint',
    category: 'Sprint',
    description: 'Structured 30-day intensive syllabus run with daily theory, DPP problem solving, and evening active recall.',
    durationDays: 30,
    iconName: 'Zap',
    badge: 'Popular',
    defaultTasks: [
      {
        title: 'Morning Theory & Lecture Deep Dive',
        type: 'Lecture',
        subjectPlaceholder: 'Primary Subject',
        timeSlot: 'Morning',
        priority: 'High',
        estimatedMinutes: 120,
        startTime: '08:30',
        endTime: '10:30',
        dayOffset: 0,
        recurring: 'Daily',
        description: 'Focus on core concepts, video lectures, and taking annotated notes.',
      },
      {
        title: 'Afternoon DPP & PYQ Problem Solving',
        type: 'DPP',
        subjectPlaceholder: 'Primary Subject',
        timeSlot: 'Afternoon',
        priority: 'High',
        estimatedMinutes: 120,
        startTime: '14:00',
        endTime: '16:00',
        dayOffset: 0,
        recurring: 'Daily',
        description: 'Solve 20-30 topic questions with strict exam timing and zero distractions.',
      },
      {
        title: 'Evening Active Recall & Formula Revision',
        type: 'Flashcards',
        subjectPlaceholder: 'Secondary Subject',
        timeSlot: 'Evening',
        priority: 'Medium',
        estimatedMinutes: 60,
        startTime: '19:30',
        endTime: '20:30',
        dayOffset: 0,
        recurring: 'Daily',
        description: 'Spaced repetition flashcards, formula book review, and mistake notebook updates.',
      },
    ],
  },
  {
    id: 'tmpl-daily-3-block',
    title: 'Daily 3-Block Focus Routine (7-Day Reusable)',
    category: 'Daily Routine',
    description: 'Perfect daily rhythm balancing conceptual learning, numerical practice, and memory consolidation.',
    durationDays: 7,
    iconName: 'Clock',
    badge: 'Balanced',
    defaultTasks: [
      {
        title: 'Block 1: High-Weightage Concept Lecture',
        type: 'Lecture',
        subjectPlaceholder: 'Subject A',
        timeSlot: 'Morning',
        priority: 'High',
        estimatedMinutes: 90,
        startTime: '07:00',
        endTime: '08:30',
        dayOffset: 0,
        description: 'Deep focus on fundamental theory and derivations.',
      },
      {
        title: 'Block 2: Problem Solving & PYQ Drilling',
        type: 'Practice',
        subjectPlaceholder: 'Subject B',
        timeSlot: 'Afternoon',
        priority: 'High',
        estimatedMinutes: 90,
        startTime: '15:00',
        endTime: '16:30',
        dayOffset: 0,
        description: 'Solve standard textbook and previous year exam questions.',
      },
      {
        title: 'Block 3: Rapid Revision & Flashcard Review',
        type: 'Revision',
        subjectPlaceholder: 'Subject A',
        timeSlot: 'Night',
        priority: 'Medium',
        estimatedMinutes: 60,
        startTime: '21:00',
        endTime: '22:00',
        dayOffset: 0,
        description: 'Consolidate everything learned today using active recall.',
      },
    ],
  },
  {
    id: 'tmpl-pyq-mastery',
    title: 'Intensive PYQ & Mock Test Circuit',
    category: 'Practice',
    description: 'High-yield past year question marathons with error notebook analysis and timed test simulations.',
    durationDays: 14,
    iconName: 'Target',
    badge: 'Exam Ready',
    defaultTasks: [
      {
        title: 'Timed PYQ Speed Run (30 Questions)',
        type: 'PYQs',
        subjectPlaceholder: 'Target Subject',
        timeSlot: 'Morning',
        priority: 'High',
        estimatedMinutes: 90,
        startTime: '09:00',
        endTime: '10:30',
        dayOffset: 0,
        description: 'Solve past 10 years chapter questions under strict countdown conditions.',
      },
      {
        title: 'Mistake Notebook & Error Remediation',
        type: 'Notes',
        subjectPlaceholder: 'Target Subject',
        timeSlot: 'Afternoon',
        priority: 'High',
        estimatedMinutes: 60,
        startTime: '14:30',
        endTime: '15:30',
        dayOffset: 0,
        description: 'Document wrong answers, identify conceptual traps, and write correction notes.',
      },
      {
        title: 'Formula & Key Derivation Check',
        type: 'Formula Revision',
        subjectPlaceholder: 'Target Subject',
        timeSlot: 'Night',
        priority: 'Medium',
        estimatedMinutes: 45,
        startTime: '20:30',
        endTime: '21:15',
        dayOffset: 0,
        description: 'Review high-weightage formulas and short tricks.',
      },
    ],
  },
  {
    id: 'tmpl-weak-area-sprint',
    title: 'Weak Area Recovery Sprint (14-Day)',
    category: 'Sprint',
    description: 'Targeted rebuilding of challenging subjects with diagnostic review, stepped problem solving, and confidence building.',
    durationDays: 14,
    iconName: 'TrendingUp',
    badge: 'Remediation',
    defaultTasks: [
      {
        title: 'Core Concept Rebuilding & Visualization',
        type: 'Lecture',
        subjectPlaceholder: 'Challenging Subject',
        timeSlot: 'Morning',
        priority: 'High',
        estimatedMinutes: 100,
        startTime: '08:00',
        endTime: '09:40',
        dayOffset: 0,
        description: 'Re-watch difficult segments, clarify doubts, and build visual diagrams.',
      },
      {
        title: 'Graded Difficulty Practice (Level 1 to 3)',
        type: 'Practice',
        subjectPlaceholder: 'Challenging Subject',
        timeSlot: 'Afternoon',
        priority: 'High',
        estimatedMinutes: 90,
        startTime: '15:00',
        endTime: '16:30',
        dayOffset: 0,
        description: 'Start with fundamental problems and incrementally advance to multi-concept problems.',
      },
      {
        title: 'SRS Concept & Doubt Resolution Log',
        type: 'Revision',
        subjectPlaceholder: 'Challenging Subject',
        timeSlot: 'Evening',
        priority: 'Medium',
        estimatedMinutes: 50,
        startTime: '19:00',
        endTime: '19:50',
        dayOffset: 0,
        description: 'Test recall of tricky definitions and resolve flagged doubts.',
      },
    ],
  },
  {
    id: 'tmpl-7-day-pre-exam',
    title: '7-Day Pre-Exam Final Polish',
    category: 'Exam Prep',
    description: 'Rapid final review blueprint: mistake logs, formula sheets, mock test strategy, and mindset conditioning.',
    durationDays: 7,
    iconName: 'Award',
    badge: 'Final Sprint',
    defaultTasks: [
      {
        title: 'Full-Length Mock Test Simulation',
        type: 'Mock',
        subjectPlaceholder: 'All Subjects',
        timeSlot: 'Morning',
        priority: 'High',
        estimatedMinutes: 180,
        startTime: '09:00',
        endTime: '12:00',
        dayOffset: 0,
        description: 'Simulate exact exam hall environment with real timer and rough sheet.',
      },
      {
        title: 'Detailed Mock Test Analysis & Mistake Log',
        type: 'Notes',
        subjectPlaceholder: 'All Subjects',
        timeSlot: 'Afternoon',
        priority: 'High',
        estimatedMinutes: 90,
        startTime: '14:30',
        endTime: '16:00',
        dayOffset: 0,
        description: 'Categorize errors into silly mistakes, calculation errors, or concept gaps.',
      },
      {
        title: 'Rapid Formula Sheet & Short Notes Read-through',
        type: 'Formula Revision',
        subjectPlaceholder: 'All Subjects',
        timeSlot: 'Night',
        priority: 'Medium',
        estimatedMinutes: 60,
        startTime: '20:00',
        endTime: '21:00',
        dayOffset: 0,
        description: 'Scan through handbook, high-yield constants, and standard values.',
      },
    ],
  },
];

class TaskTemplateService {
  public getTemplates(): TaskTemplate[] {
    const custom = this.getCustomTemplates();
    return [...DEFAULT_TASK_TEMPLATES, ...custom];
  }

  public getCustomTemplates(): TaskTemplate[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public saveCustomTemplate(template: TaskTemplate): void {
    const list = this.getCustomTemplates().filter((t) => t.id !== template.id);
    list.unshift({ ...template, isCustom: true });
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(list));
      }
      safeDispatch(new Event('studyos_task_templates_updated'));
    } catch (e) {
      console.warn('[TaskTemplateService] failed to save custom template', e);
    }
  }

  public deleteCustomTemplate(id: string): void {
    const list = this.getCustomTemplates().filter((t) => t.id !== id);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(list));
      }
      safeDispatch(new Event('studyos_task_templates_updated'));
    } catch {
      /* ignore */
    }
  }

  /**
   * Instantiates a template into independent, exam-scoped TaskItem records
   */
  public instantiateTemplateIntoExam(
    templateId: string,
    options: {
      targetExamId?: string;
      startDate: string;
      subjectMapping?: Record<string, string>;
      selectedTaskIndices?: number[];
    }
  ): { count: number; tasks: TaskItem[] } {
    const targetExamId = options.targetExamId || db.getActiveExamId();
    const template = this.getTemplates().find((t) => t.id === templateId);
    if (!template) {
      throw new Error(`Template "${templateId}" not found`);
    }

    const baseDate = new Date(options.startDate || new Date().toISOString().split('T')[0]);
    const examSubjects = db.getCurrentExamSubjects(targetExamId);
    const defaultSubject = examSubjects[0] || 'General Studies';

    const tasksToInstantiate = options.selectedTaskIndices
      ? template.defaultTasks.filter((_, idx) => options.selectedTaskIndices!.includes(idx))
      : template.defaultTasks;

    const createdTasks: TaskItem[] = [];
    const nowIso = new Date().toISOString();

    // Generate tasks spanning the template duration
    const daysToGenerate = Math.max(1, Math.min(30, template.durationDays || 1));

    for (let day = 0; day < daysToGenerate; day++) {
      const taskDate = new Date(baseDate.getTime() + day * 86400000);
      const dateStr = taskDate.toISOString().split('T')[0];

      tasksToInstantiate.forEach((tmplItem, itemIdx) => {
        // Resolve subject
        let resolvedSubject = defaultSubject;
        if (tmplItem.subjectPlaceholder && options.subjectMapping?.[tmplItem.subjectPlaceholder]) {
          resolvedSubject = options.subjectMapping[tmplItem.subjectPlaceholder];
        } else if (tmplItem.subjectPlaceholder && examSubjects.length > 0) {
          // Auto-distribute across exam subjects
          resolvedSubject = examSubjects[(day + itemIdx) % examSubjects.length] || defaultSubject;
        }

        const task: TaskItem = {
          id: `task-tmpl-${Date.now()}-${day}-${itemIdx}-${Math.random().toString(36).slice(2, 6)}`,
          title: tmplItem.title,
          type: tmplItem.type,
          subject: resolvedSubject,
          description: tmplItem.description || `Generated from ${template.title}`,
          dueDate: dateStr,
          timeSlot: tmplItem.timeSlot,
          priority: tmplItem.priority,
          estimatedMinutes: tmplItem.estimatedMinutes,
          timeSpentMinutes: 0,
          completed: false,
          status: 'Pending',
          startTime: tmplItem.startTime,
          endTime: tmplItem.endTime,
          recurring: tmplItem.recurring || 'None',
          examId: targetExamId,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        createdTasks.push(task);
      });
    }

    // Persist into active exam workspace tasks
    const existingTasks = db.getTasks();
    db.setTasks([...createdTasks, ...existingTasks]);

    // Emit event notifications
    safeDispatch(new Event('studyos_tasks_updated'));
    safeDispatch(new Event('studyos_timetable_updated'));
    safeDispatch(new Event('studyos_db_updated'));

    return { count: createdTasks.length, tasks: createdTasks };
  }
}

export const taskTemplateService = new TaskTemplateService();
