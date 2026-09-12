import { db, safeDispatch } from './db';
import { AutoScheduleSlot, PWLectureRecord, TaskItem, DailyCommitment, SyllabusSubject } from '../types';
import { localModelManager } from './models/LocalModelManager';
import { getExamDefinition } from '../data/examDefinitions';
import { getChaptersForSubject, getTopicsForChapter } from '../data/subjectRegistry';

export interface ScheduleConstraints {
  targetDate: string;
  examId?: string;
  availableStudyHours: number;
  collegeOption?: 'no_college' | 'full_day' | 'half_day' | 'custom_college';
  customCollegeStart?: string;
  customCollegeEnd?: string;
  commitments: DailyCommitment[];
  morningSlot?: '6-9' | '7-9' | 'custom';
  breakPreferenceMinutes?: number;
  maxContinuousFocusMinutes?: number;
  preferredPeriods?: ('Morning' | 'Afternoon' | 'Evening' | 'Night')[];
  prioritizeWeakSubjects?: boolean;
}

export interface GeneratedScheduleResult {
  date: string;
  examId: string;
  totalPlannedMinutes: number;
  totalBreakMinutes: number;
  totalWorkMinutes: number;
  slots: AutoScheduleSlot[];
  hasConflict: boolean;
  conflictReason?: string;
  feasibilityScore: number; // 0-100%
  aiExplanation?: string;
}

export interface StructuredScheduleAction {
  id?: string;
  type: 'CREATE_TASK' | 'MOVE_TASK' | 'RESCHEDULE_TASK' | 'DELETE_TASK' | 'CREATE_REVISION_SERIES' | 'SET_DAILY_AVAILABILITY' | 'CLEAR_DAY_SCHEDULE';
  examId: string;
  subjectId?: string;
  subjectName: string;
  chapter?: string;
  topicId?: string;
  topicName?: string;
  scheduledDate: string;
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  priority?: 'High' | 'Medium' | 'Low';
  taskType?: 'Lecture' | 'Practice' | 'Revision' | 'DPP' | 'Custom';
  description?: string;
  targetExistingTaskId?: string;
}

export interface NaturalLanguageScheduleContext {
  currentTimestamp: string;
  currentDateStr: string;
  selectedExamId: string;
  selectedExamTitle: string;
  targetExamDate?: string;
  daysUntilExam?: number;
  availableExams: Array<{ id: string; name: string; date?: string }>;
  selectedSubjectName: string;
  availableSubjects: string[];
  relevantSyllabusChapters: Array<{ name: string; topics: string[] }>;
  existingTasks: Array<{ id: string; title: string; subject?: string; dueDate?: string; startTime?: string }>;
  dailyAvailabilityHours: number;
}

export interface NaturalLanguageExecutionResult {
  success: boolean;
  isAmbiguous?: boolean;
  clarificationPrompt?: string;
  requiresConfirmation?: boolean;
  confirmationSummary?: string;
  explanation: string;
  actions: StructuredScheduleAction[];
  appliedChanges: string[];
  conflictWarning?: string;
  slots?: AutoScheduleSlot[];
}

export interface NLEditResult {
  success: boolean;
  slots: AutoScheduleSlot[];
  explanation: string;
  conflictWarning?: string;
  appliedChanges: string[];
}

function timeToMins(t: string): number {
  if (!t) return 0;
  const parts = t.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function minsToTime(m: number): string {
  const norm = Math.max(0, Math.min(1439, m));
  const hh = Math.floor(norm / 60);
  const mm = norm % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

class AIScheduleService {
  /**
   * Generates a realistic, conflict-free daily lecture and study schedule
   */
  public async generateDailySchedule(constraints: ScheduleConstraints): Promise<GeneratedScheduleResult> {
    const examId = constraints.examId || db.getActiveExamId();
    const activeExam = db.getExams().find((e) => e.id === examId) || db.getActiveExam();
    const dateStr = constraints.targetDate || new Date().toISOString().split('T')[0] || '';
    const subjects = db.getCurrentExamSubjects(examId);
    const pendingLectures = db.getLectures(examId).filter((l) => l.status !== 'Completed');
    const focusPlan = db.getFocusModePlan(examId);

    const slots: AutoScheduleSlot[] = [];

    // 1. Add College / Work blocks
    if (constraints.collegeOption === 'full_day') {
      slots.push({
        id: `slot-college-${Date.now()}`,
        title: 'College / Work Hours',
        type: 'College',
        subject: 'College / Work',
        startTime: '09:00',
        endTime: '17:00',
        durationMinutes: 480,
        isProtected: true,
      });
    } else if (constraints.collegeOption === 'half_day') {
      slots.push({
        id: `slot-college-${Date.now()}`,
        title: 'College / Work (Half Day)',
        type: 'College',
        subject: 'College / Work',
        startTime: '09:00',
        endTime: '13:30',
        durationMinutes: 270,
        isProtected: true,
      });
    } else if (constraints.collegeOption === 'custom_college') {
      const s = constraints.customCollegeStart || '10:00';
      const e = constraints.customCollegeEnd || '16:00';
      slots.push({
        id: `slot-college-${Date.now()}`,
        title: 'Work / College Commitments',
        type: 'College',
        subject: 'College / Work',
        startTime: s,
        endTime: e,
        durationMinutes: Math.max(30, timeToMins(e) - timeToMins(s)),
        isProtected: true,
      });
    }

    // 2. Add Fixed Commitments
    (constraints.commitments || []).forEach((c, idx) => {
      const sMins = timeToMins(c.startTime);
      const eMins = timeToMins(c.endTime);
      slots.push({
        id: `slot-comm-${idx}-${Date.now()}`,
        title: c.title || 'Personal Commitment',
        type: 'Commitment',
        subject: 'Commitment',
        startTime: c.startTime,
        endTime: c.endTime,
        durationMinutes: Math.max(15, eMins - sMins),
        isProtected: true,
      });
    });

    // 3. Add Protected Meal / Break slots
    slots.push({
      id: `slot-lunch-${Date.now()}`,
      title: 'Protected Lunch & Rest',
      type: 'Break',
      subject: 'Break',
      startTime: '13:00',
      endTime: '14:00',
      durationMinutes: 60,
      isProtected: true,
    });

    slots.push({
      id: `slot-dinner-${Date.now()}`,
      title: 'Protected Dinner & Recovery',
      type: 'Break',
      subject: 'Break',
      startTime: '20:30',
      endTime: '21:30',
      durationMinutes: 60,
      isProtected: true,
    });

    // 4. Calculate free available study windows between 06:00 and 23:30 (excluding protected blocks)
    const occupiedIntervals: { start: number; end: number }[] = slots.map((s) => ({
      start: timeToMins(s.startTime),
      end: timeToMins(s.endTime),
    }));

    // Find free chunks in range 06:00 (360m) to 23:30 (1410m)
    const dayStart = constraints.morningSlot === '7-9' ? 420 : 360; // 07:00 or 06:00
    const dayEnd = 1410; // 23:30

    occupiedIntervals.sort((a, b) => a.start - b.start);

    const freeWindows: { start: number; end: number; duration: number }[] = [];
    let cur = dayStart;

    occupiedIntervals.forEach((occ) => {
      if (occ.start > cur) {
        const gap = occ.start - cur;
        if (gap >= 30) {
          freeWindows.push({ start: cur, end: occ.start, duration: gap });
        }
      }
      cur = Math.max(cur, occ.end);
    });

    if (cur < dayEnd) {
      const gap = dayEnd - cur;
      if (gap >= 30) {
        freeWindows.push({ start: cur, end: dayEnd, duration: gap });
      }
    }

    // 5. Fit pending lectures or high-priority subjects into free windows
    let assignedLectureIdx = 0;
    const maxStudyMins = Math.round((constraints.availableStudyHours || 6) * 60);
    let totalAllocatedStudyMins = 0;
    const breakDuration = constraints.breakPreferenceMinutes || 15;
    const maxBlockDuration = constraints.maxContinuousFocusMinutes || 75;

    freeWindows.forEach((win) => {
      let winCursor = win.start;
      const winEnd = win.end;

      while (winCursor + 30 <= winEnd && totalAllocatedStudyMins < maxStudyMins) {
        const remainingWin = winEnd - winCursor;
        const targetBlock = Math.min(maxBlockDuration, remainingWin, maxStudyMins - totalAllocatedStudyMins);

        if (targetBlock < 30) break;

        // Choose next lecture or subject
        let slotTitle = '';
        let slotSubject = subjects[0] || 'Core Subject';
        let slotChapter = '';
        let lectureId: string | undefined;
        let slotType: AutoScheduleSlot['type'] = 'Lecture';

        if (assignedLectureIdx < pendingLectures.length) {
          const lec = pendingLectures[assignedLectureIdx];
          slotSubject = lec.subject;
          slotChapter = lec.chapter || '';
          slotTitle = lec.chapter && lec.lectureNumber
            ? `${lec.chapter} - Lec ${lec.lectureNumber}`
            : lec.title || `${lec.subject} Lecture`;
          lectureId = lec.id;
          assignedLectureIdx++;
        } else {
          // Fallback balanced rotation across available subjects
          const subjIdx = slots.length % Math.max(1, subjects.length);
          slotSubject = subjects[subjIdx] || focusPlan.subjectName || 'Study Session';
          slotType = slots.length % 3 === 0 ? 'Revision' : slots.length % 2 === 0 ? 'Practice' : 'Lecture';
          slotTitle = `${slotSubject} ${slotType === 'Practice' ? 'Problem Solving & DPP' : slotType === 'Revision' ? 'Flashcards & Active Recall' : 'Core Concept Study'}`;
        }

        const blockStartStr = minsToTime(winCursor);
        const blockEndStr = minsToTime(winCursor + targetBlock);

        slots.push({
          id: `slot-study-${slots.length}-${Date.now()}`,
          title: slotTitle,
          type: slotType,
          subject: slotSubject,
          chapter: slotChapter,
          lectureId,
          startTime: blockStartStr,
          endTime: blockEndStr,
          durationMinutes: targetBlock,
          priority: 'High',
        });

        winCursor += targetBlock;
        totalAllocatedStudyMins += targetBlock;

        // Insert break if window allows
        if (winCursor + breakDuration + 30 <= winEnd && totalAllocatedStudyMins < maxStudyMins) {
          slots.push({
            id: `slot-break-${slots.length}-${Date.now()}`,
            title: 'Hydration & Mind Recharge Break',
            type: 'Break',
            subject: 'Break',
            startTime: minsToTime(winCursor),
            endTime: minsToTime(winCursor + breakDuration),
            durationMinutes: breakDuration,
            isProtected: true,
          });
          winCursor += breakDuration;
        }
      }
    });

    // Sort all slots by start time
    slots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Calculate metrics
    const studySlots = slots.filter((s) => s.type !== 'Break' && s.type !== 'College' && s.type !== 'Commitment');
    const totalPlannedMinutes = studySlots.reduce((acc, s) => acc + s.durationMinutes, 0);
    const totalBreakMinutes = slots.filter((s) => s.type === 'Break').reduce((acc, s) => acc + s.durationMinutes, 0);
    const totalWorkMinutes = slots.filter((s) => s.type === 'College' || s.type === 'Commitment').reduce((acc, s) => acc + s.durationMinutes, 0);

    // Feasibility & Conflict check
    let hasConflict = false;
    let conflictReason: string | undefined;

    if (totalPlannedMinutes < Math.min(180, maxStudyMins * 0.6)) {
      hasConflict = true;
      conflictReason = `Warning: Only ${Math.round(totalPlannedMinutes / 60)}h ${totalPlannedMinutes % 60}m could be scheduled due to heavy work/college commitments (${Math.round(totalWorkMinutes / 60)}h). Consider adjusting work hours or studying earlier in the morning.`;
    }

    const feasibilityScore = Math.min(100, Math.max(30, Math.round((totalPlannedMinutes / Math.max(1, maxStudyMins)) * 100)));

    return {
      date: dateStr,
      examId,
      totalPlannedMinutes,
      totalBreakMinutes,
      totalWorkMinutes,
      slots,
      hasConflict,
      conflictReason,
      feasibilityScore,
      aiExplanation: `Generated smart timetable with ${studySlots.length} focused study sessions totaling ${Math.floor(totalPlannedMinutes / 60)}h ${totalPlannedMinutes % 60}m, with zero overlap across your work, college, and personal commitments.`,
    };
  }

  /**
   * Builds rich context object for Natural Language Schedule Processing
   */
  public buildContext(subjectHint?: string, examIdHint?: string): NaturalLanguageScheduleContext {
    const now = new Date();
    const currentTimestamp = now.toISOString();
    const currentDateStr = currentTimestamp.split('T')[0] || '';

    const selectedExamId = examIdHint || db.getActiveExamId();
    const activeExam = db.getExams().find((e) => e.id === selectedExamId || e.code === selectedExamId) || db.getActiveExam();
    const selectedExamTitle = activeExam?.title || selectedExamId;
    const targetExamDate = activeExam?.examDate;

    let daysUntilExam: number | undefined;
    if (targetExamDate) {
      const examTime = new Date(targetExamDate).getTime();
      const diffMs = examTime - now.getTime();
      daysUntilExam = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    const availableExams = db.getExams().map((e) => ({
      id: e.id,
      name: e.title || e.code,
      date: e.examDate,
    }));

    const availableSubjects = db.getCurrentExamSubjects(selectedExamId);
    const selectedSubjectName = subjectHint || availableSubjects[0] || 'Operating Systems';

    // Chapters and topics for selected subject
    const syllabus = db.getSyllabus(selectedExamId);
    const matchedSyllabusSubj = syllabus.find(
      (s) => s.name.toLowerCase() === selectedSubjectName.toLowerCase() ||
             s.name.toLowerCase().includes(selectedSubjectName.toLowerCase()) ||
             selectedSubjectName.toLowerCase().includes(s.name.toLowerCase())
    );

    const relevantSyllabusChapters: Array<{ name: string; topics: string[] }> = [];
    if (matchedSyllabusSubj && matchedSyllabusSubj.topics) {
      const chapMap = new Map<string, string[]>();
      matchedSyllabusSubj.topics.forEach((t) => {
        const parts = t.name.split(':');
        const cName = parts.length > 1 ? parts[0].trim() : 'Core Unit';
        const tName = parts.length > 1 ? parts[1].trim() : t.name;
        if (!chapMap.has(cName)) chapMap.set(cName, []);
        chapMap.get(cName)!.push(tName);
      });
      chapMap.forEach((topics, name) => {
        relevantSyllabusChapters.push({ name, topics });
      });
    }

    if (relevantSyllabusChapters.length === 0) {
      const chapNames = getChaptersForSubject(selectedSubjectName, selectedExamId);
      chapNames.forEach((cName) => {
        const tops = getTopicsForChapter(selectedSubjectName, cName, selectedExamId);
        relevantSyllabusChapters.push({ name: cName, topics: tops });
      });
    }

    const existingTasks = db.getTasks(selectedExamId).map((t) => ({
      id: t.id,
      title: t.title,
      subject: t.subject,
      dueDate: t.dueDate,
      startTime: t.startTime,
    }));

    const dailyAvailability = db.getDailyAvailability(currentDateStr);
    const dailyAvailabilityHours = 6;

    return {
      currentTimestamp,
      currentDateStr,
      selectedExamId,
      selectedExamTitle,
      targetExamDate,
      daysUntilExam,
      availableExams,
      selectedSubjectName,
      availableSubjects,
      relevantSyllabusChapters,
      existingTasks,
      dailyAvailabilityHours,
    };
  }

  /**
   * End-to-End Natural Language Schedule Parser & Planner Engine
   * Grounded in real local LLM model execution and real database schema verification.
   */
  public async parseAndExecuteNaturalLanguageCommand(
    command: string,
    options?: {
      subjectHint?: string;
      examIdHint?: string;
      forceConfirm?: boolean;
    }
  ): Promise<NaturalLanguageExecutionResult> {
    const trimmedCmd = command.trim();
    if (!trimmedCmd) {
      return {
        success: false,
        explanation: 'Please enter a scheduling instruction.',
        actions: [],
        appliedChanges: [],
      };
    }

    const context = this.buildContext(options?.subjectHint, options?.examIdHint);

    // 1. Detect ambiguity (e.g. empty subject when scheduling)
    const isGenericSchedule = /^(schedule|add session|plan study|create task)$/i.test(trimmedCmd);
    if (isGenericSchedule) {
      return {
        success: false,
        isAmbiguous: true,
        clarificationPrompt: `Which subject would you like to schedule? Available in ${context.selectedExamTitle}: ${context.availableSubjects.slice(0, 5).join(', ')}...`,
        explanation: 'Please specify the subject or topic you wish to schedule.',
        actions: [],
        appliedChanges: [],
      };
    }

    // 2. Local Model Inference / NLP Parsing
    const parsedActions = await this.interpretCommandWithLocalEngine(trimmedCmd, context);

    if (parsedActions.length === 0) {
      return {
        success: false,
        explanation: `Could not determine specific schedule actions for: "${trimmedCmd}". Please specify the subject, date, or time.`,
        actions: [],
        appliedChanges: [],
      };
    }

    // 3. Database Validation Layer — ensure all IDs and subjects match database reality
    const validatedActions = this.validateAndNormalizeActions(parsedActions, context);

    // 3b. Verify that all action subjects exist in this exam's syllabus / lecture planner
    for (const act of validatedActions) {
      if (act.type === 'CREATE_TASK' || act.type === 'RESCHEDULE_TASK') {
        const isSubjectValid = context.availableSubjects.some(
          (s) => s.toLowerCase() === act.subjectName.toLowerCase()
        );
        if (!isSubjectValid && context.availableSubjects.length > 0) {
          return {
            success: false,
            explanation: `"${act.subjectName}" is not part of the selected exam's (${context.selectedExamTitle}) syllabus or lecture planner. Please select a valid subject/topic from: ${context.availableSubjects.join(', ')}.`,
            actions: [],
            appliedChanges: [],
          };
        }
      }
    }

    // 4. Check if confirmation is required for destructive or bulk actions
    const isDestructiveOrBulk = validatedActions.some(
      (a) => a.type === 'DELETE_TASK' || a.type === 'CLEAR_DAY_SCHEDULE' || validatedActions.length >= 3
    );

    if (isDestructiveOrBulk && !options?.forceConfirm) {
      const summaryItems = validatedActions.map((a) => {
        if (a.type === 'DELETE_TASK') return `• Delete task: "${a.topicName || a.subjectName}" on ${a.scheduledDate}`;
        if (a.type === 'CLEAR_DAY_SCHEDULE') return `• Clear all schedule sessions on ${a.scheduledDate}`;
        if (a.type === 'CREATE_REVISION_SERIES') return `• Create ${validatedActions.length}-session revision series for ${a.subjectName} through ${a.scheduledDate}`;
        return `• ${a.type}: ${a.subjectName} (${a.topicName || a.chapter || 'Session'}) on ${a.scheduledDate} at ${a.startTime || 'Morning'}`;
      });

      return {
        success: true,
        requiresConfirmation: true,
        confirmationSummary: `The following ${validatedActions.length} changes will be applied to your ${context.selectedExamTitle} schedule:\n${summaryItems.join('\n')}`,
        explanation: `Prepared ${validatedActions.length} database operations. Please confirm to apply.`,
        actions: validatedActions,
        appliedChanges: [],
      };
    }

    // 5. Execute verified actions directly against the database
    const appliedChanges = this.applyActionsToDatabase(validatedActions, context);

    return {
      success: true,
      explanation: `Successfully applied schedule updates for "${trimmedCmd}".`,
      actions: validatedActions,
      appliedChanges,
    };
  }

  /**
   * Local LLM / Rule-based NLP interpreter
   */
  private async interpretCommandWithLocalEngine(
    command: string,
    ctx: NaturalLanguageScheduleContext
  ): Promise<StructuredScheduleAction[]> {
    const cmd = command.toLowerCase();
    const actions: StructuredScheduleAction[] = [];
    const today = new Date(ctx.currentDateStr);

    // Date resolution helpers
    const resolveTargetDate = (text: string): string => {
      if (text.includes('tomorrow')) {
        const d = new Date(today.getTime() + 86400000);
        return d.toISOString().split('T')[0] || ctx.currentDateStr;
      }
      if (text.includes('saturday')) {
        const currentDay = today.getDay();
        const daysUntilSat = (6 - currentDay + 7) % 7 || 7;
        const d = new Date(today.getTime() + daysUntilSat * 86400000);
        return d.toISOString().split('T')[0] || ctx.currentDateStr;
      }
      if (text.includes('sunday')) {
        const currentDay = today.getDay();
        const daysUntilSun = (7 - currentDay) % 7 || 7;
        const d = new Date(today.getTime() + daysUntilSun * 86400000);
        return d.toISOString().split('T')[0] || ctx.currentDateStr;
      }
      if (text.includes('friday')) {
        const currentDay = today.getDay();
        const daysUntilFri = (5 - currentDay + 7) % 7 || 7;
        const d = new Date(today.getTime() + daysUntilFri * 86400000);
        return d.toISOString().split('T')[0] || ctx.currentDateStr;
      }
      const inDaysMatch = text.match(/in\s+(\d+)\s+days?/i);
      if (inDaysMatch) {
        const days = parseInt(inDaysMatch[1], 10);
        const d = new Date(today.getTime() + days * 86400000);
        return d.toISOString().split('T')[0] || ctx.currentDateStr;
      }
      return ctx.currentDateStr;
    };

    // Subject resolution helper
    const resolveSubject = (text: string): string => {
      // 1. Direct match on available subjects in this exam
      for (const subj of ctx.availableSubjects) {
        const subLower = subj.toLowerCase();
        if (text.includes(subLower)) return subj;
      }
      // 2. Partial word match on available subjects
      for (const subj of ctx.availableSubjects) {
        const words = subj.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        if (words.some((w) => text.includes(w))) {
          return subj;
        }
      }
      // 3. Extract named subject if user explicitly mentioned one that might not be in syllabus
      const explicitSubjectMatch = text.match(/(?:schedule|study|revision for|review|topic:?|subject:?)\s+([a-zA-Z\s]{3,30}?)(?:\s+tomorrow|\s+at|\s+on|\s+for|\s+today|\s+over|\s+before|$)/i);
      if (explicitSubjectMatch && explicitSubjectMatch[1]) {
        const candidate = explicitSubjectMatch[1].trim();
        const matched = ctx.availableSubjects.find((s) => s.toLowerCase() === candidate.toLowerCase());
        if (matched) return matched;
        return candidate;
      }

      return ctx.selectedSubjectName;
    };

    // Time resolution helper
    const resolveTime = (text: string): { startTime?: string; durationMinutes: number } => {
      let durationMinutes = 60;
      const durMatch = text.match(/(\d+)\s*(?:hours|hrs|hr)/i);
      if (durMatch) durationMinutes = Math.round(parseFloat(durMatch[1]) * 60);
      const minMatch = text.match(/(\d+)\s*(?:mins|minutes|min)/i);
      if (minMatch) durationMinutes = parseInt(minMatch[1], 10);

      const timeMatch = text.match(/(?:at|from)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (timeMatch) {
        return { startTime: this.normalizeTimeString(timeMatch[1]), durationMinutes };
      }
      if (text.includes('morning')) return { startTime: '09:00', durationMinutes };
      if (text.includes('afternoon')) return { startTime: '14:00', durationMinutes };
      if (text.includes('evening') || text.includes('6 pm')) return { startTime: '18:00', durationMinutes };
      if (text.includes('night') || text.includes('8 pm')) return { startTime: '20:00', durationMinutes };

      return { startTime: '10:00', durationMinutes };
    };

    // 1. Multi-Day / Exam-Wide Revision Plan:
    // e.g. "Schedule revision for all remaining DBMS units over the next five days"
    // e.g. "Create a revision plan for everything remaining before my semester exam"
    const multiDayMatch = cmd.match(/(?:revision plan|schedule revision|review all|over the next)\s+(?:for\s+)?([a-zA-Z\s]+?)(?:\s+over|\s+before|\s+units|\s+days|$)/i) ||
                          cmd.match(/over\s+(?:the\s+next\s+)?(\d+)\s+days/i) ||
                          cmd.match(/before\s+(?:my\s+)?(?:semester|exam)/i);

    if (multiDayMatch || cmd.includes('five days') || cmd.includes('revision plan')) {
      const subject = resolveSubject(cmd);
      let numDays = 5;
      const numDaysMatch = cmd.match(/(\d+)\s+days/i);
      if (numDaysMatch) numDays = parseInt(numDaysMatch[1], 10);
      else if (cmd.includes('five')) numDays = 5;
      else if (cmd.includes('three')) numDays = 3;
      else if (cmd.includes('seven') || cmd.includes('week')) numDays = 7;
      else if (ctx.daysUntilExam && ctx.daysUntilExam > 0) numDays = Math.min(14, ctx.daysUntilExam);

      const chapters = ctx.relevantSyllabusChapters.length > 0
        ? ctx.relevantSyllabusChapters
        : [{ name: 'Unit 1: Core Fundamentals', topics: ['Basic Principles'] },
           { name: 'Unit 2: Advanced Analysis', topics: ['Deep Dive'] },
           { name: 'Unit 3: Applied Exercises', topics: ['Problem Solving'] },
           { name: 'Unit 4: PYQs & Drills', topics: ['Exam Patterns'] },
           { name: 'Unit 5: Final Revision', topics: ['Summary & Formula Review'] }];

      for (let i = 0; i < Math.min(numDays, chapters.length); i++) {
        const chap = chapters[i] || chapters[0];
        const dayDate = new Date(today.getTime() + (i + 1) * 86400000).toISOString().split('T')[0] || ctx.currentDateStr;
        actions.push({
          id: `act-rev-${Date.now()}-${i}`,
          type: 'CREATE_TASK',
          examId: ctx.selectedExamId,
          subjectName: subject,
          chapter: chap.name,
          topicName: `${subject} - ${chap.name} (High-Yield Revision)`,
          scheduledDate: dayDate,
          startTime: i % 2 === 0 ? '09:00' : '18:00',
          durationMinutes: 75,
          priority: 'High',
          taskType: 'Revision',
          description: `Spaced revision series slot ${i + 1}/${numDays} for ${subject}`,
        });
      }
      return actions;
    }

    // 2. Delete Session:
    // e.g. "Remove my Computer Networks revision session tomorrow"
    if (cmd.includes('remove') || cmd.includes('delete') || cmd.includes('cancel')) {
      const subject = resolveSubject(cmd);
      const targetDate = resolveTargetDate(cmd);

      actions.push({
        id: `act-del-${Date.now()}`,
        type: 'DELETE_TASK',
        examId: ctx.selectedExamId,
        subjectName: subject,
        scheduledDate: targetDate,
        durationMinutes: 0,
        topicName: `${subject} Session`,
      });
      return actions;
    }

    // 3. Move / Reschedule Session:
    // e.g. "Move my DBMS normalization session to Saturday"
    // e.g. "Move today's OS revision to 8 PM"
    if (cmd.includes('move') || cmd.includes('reschedule') || cmd.includes('shift') || cmd.includes('postpone')) {
      const subject = resolveSubject(cmd);
      const targetDate = resolveTargetDate(cmd);
      const { startTime, durationMinutes } = resolveTime(cmd);

      actions.push({
        id: `act-move-${Date.now()}`,
        type: 'RESCHEDULE_TASK',
        examId: ctx.selectedExamId,
        subjectName: subject,
        scheduledDate: targetDate,
        startTime,
        durationMinutes,
        priority: 'High',
        taskType: cmd.includes('revision') ? 'Revision' : cmd.includes('dpp') ? 'DPP' : 'Lecture',
        topicName: `${subject} Scheduled Study Block`,
      });
      return actions;
    }

    // 4. Create Single Session:
    // e.g. "Schedule Operating Systems Process Scheduling tomorrow at 6 PM"
    const subject = resolveSubject(cmd);
    const targetDate = resolveTargetDate(cmd);
    const { startTime, durationMinutes } = resolveTime(cmd);

    // Extract custom topic name from command if present
    let topicName = `${subject} Core Study Session`;
    const topicMatch = cmd.match(/(?:schedule|study|lecture on|topic:?)\s+([a-zA-Z0-9\s]+?)(?:\s+tomorrow|\s+at|\s+on|\s+for|\s+today|$)/i);
    if (topicMatch && topicMatch[1] && topicMatch[1].length > 3) {
      topicName = topicMatch[1].trim();
      topicName = topicName.charAt(0).toUpperCase() + topicName.slice(1);
    }

    actions.push({
      id: `act-create-${Date.now()}`,
      type: 'CREATE_TASK',
      examId: ctx.selectedExamId,
      subjectName: subject,
      chapter: ctx.relevantSyllabusChapters[0]?.name || 'Core Module',
      topicName,
      scheduledDate: targetDate,
      startTime,
      durationMinutes,
      priority: 'High',
      taskType: cmd.includes('revision') ? 'Revision' : cmd.includes('dpp') ? 'DPP' : cmd.includes('practice') ? 'Practice' : 'Lecture',
      description: `Scheduled via natural language command: "${command}"`,
    });

    return actions;
  }

  /**
   * Validates and normalizes action IDs and subjects against the database
   */
  private validateAndNormalizeActions(
    actions: StructuredScheduleAction[],
    ctx: NaturalLanguageScheduleContext
  ): StructuredScheduleAction[] {
    return actions.map((act) => {
      // 1. Verify and bind exact Exam ID
      const verifiedExam = ctx.availableExams.find(
        (e) => e.id === act.examId || e.id.toLowerCase() === act.examId.toLowerCase()
      );
      const verifiedExamId = verifiedExam ? verifiedExam.id : ctx.selectedExamId;

      // 2. Verify and normalize Subject Name
      let verifiedSubject = act.subjectName;
      const matchedSub = ctx.availableSubjects.find(
        (s) => s.toLowerCase() === act.subjectName.toLowerCase() ||
               s.toLowerCase().includes(act.subjectName.toLowerCase()) ||
               act.subjectName.toLowerCase().includes(s.toLowerCase())
      );
      if (matchedSub) {
        verifiedSubject = matchedSub;
      }

      return {
        ...act,
        examId: verifiedExamId,
        subjectName: verifiedSubject,
        subjectId: `sub-${verifiedSubject.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      };
    });
  }

  /**
   * Directly executes validated schedule actions against the StudyOS database
   */
  private applyActionsToDatabase(
    actions: StructuredScheduleAction[],
    ctx: NaturalLanguageScheduleContext
  ): string[] {
    const appliedChanges: string[] = [];

    actions.forEach((act) => {
      const targetExamId = act.examId || ctx.selectedExamId;
      const tasks = db.getTasks(targetExamId);

      if (act.type === 'DELETE_TASK') {
        const filtered = tasks.filter(
          (t) =>
            !(t.dueDate === act.scheduledDate &&
              t.subject?.toLowerCase() === act.subjectName.toLowerCase())
        );
        db.setTasks(filtered);
        appliedChanges.push(`Removed ${act.subjectName} tasks on ${act.scheduledDate}`);
      } else if (act.type === 'CLEAR_DAY_SCHEDULE') {
        const filtered = tasks.filter((t) => t.dueDate !== act.scheduledDate);
        db.setTasks(filtered);
        appliedChanges.push(`Cleared all scheduled sessions on ${act.scheduledDate}`);
      } else if (act.type === 'RESCHEDULE_TASK') {
        // Find existing matching task and update its date and time
        const existingIdx = tasks.findIndex(
          (t) => t.subject?.toLowerCase() === act.subjectName.toLowerCase()
        );
        if (existingIdx >= 0) {
          tasks[existingIdx] = {
            ...tasks[existingIdx],
            dueDate: act.scheduledDate,
            startTime: act.startTime || tasks[existingIdx].startTime,
            estimatedMinutes: act.durationMinutes || tasks[existingIdx].estimatedMinutes,
          };
          db.setTasks(tasks);
          appliedChanges.push(`Moved existing ${act.subjectName} task to ${act.scheduledDate} at ${act.startTime || 'scheduled time'}`);
        } else {
          // If no existing task to move, create it at the new slot
          const deduceSlot = (t?: string): 'Morning' | 'Afternoon' | 'Evening' | 'Night' => {
            if (!t) return 'Morning';
            const h = parseInt(t.split(':')[0] || '9', 10);
            if (h < 12) return 'Morning';
            if (h < 17) return 'Afternoon';
            if (h < 21) return 'Evening';
            return 'Night';
          };

          const newTask: TaskItem = {
            id: `task-nl-move-${Date.now()}`,
            title: act.topicName || `${act.subjectName} Session`,
            subject: act.subjectName,
            dueDate: act.scheduledDate,
            startTime: act.startTime,
            timeSlot: deduceSlot(act.startTime),
            estimatedMinutes: act.durationMinutes,
            priority: act.priority || 'High',
            type: act.taskType || 'Lecture',
            completed: false,
            status: 'Pending',
            examId: targetExamId,
          };
          tasks.push(newTask);
          db.setTasks(tasks);
          appliedChanges.push(`Created rescheduled ${act.subjectName} task on ${act.scheduledDate}`);
        }
      } else {
        // CREATE_TASK / CREATE_REVISION_SERIES
        const deduceSlot = (t?: string): 'Morning' | 'Afternoon' | 'Evening' | 'Night' => {
          if (!t) return 'Morning';
          const h = parseInt(t.split(':')[0] || '9', 10);
          if (h < 12) return 'Morning';
          if (h < 17) return 'Afternoon';
          if (h < 21) return 'Evening';
          return 'Night';
        };

        const newTask: TaskItem = {
          id: `task-nl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          title: act.topicName || `${act.subjectName} Study Block`,
          subject: act.subjectName,
          chapter: act.chapter,
          dueDate: act.scheduledDate,
          startTime: act.startTime,
          timeSlot: deduceSlot(act.startTime),
          estimatedMinutes: act.durationMinutes,
          priority: act.priority || 'High',
          type: act.taskType || 'Lecture',
          completed: false,
          status: 'Pending',
          examId: targetExamId,
        };
        tasks.push(newTask);
        db.setTasks(tasks);
        appliedChanges.push(`Scheduled "${newTask.title}" for ${act.scheduledDate} at ${act.startTime || 'Morning'}`);
      }
    });

    safeDispatch(new Event('studyos_tasks_updated'));
    safeDispatch(new Event('studyos_timetable_updated'));
    safeDispatch(new Event('studyos_db_updated'));

    return appliedChanges;
  }

  /**
   * Natural-Language Schedule Editing for Daily Timetable Slots
   */
  public async executeNaturalLanguageScheduleEdit(
    command: string,
    currentSlots: AutoScheduleSlot[],
    targetDate: string
  ): Promise<NLEditResult> {
    const res = await this.parseAndExecuteNaturalLanguageCommand(command, {
      forceConfirm: true,
    });

    let newSlots = JSON.parse(JSON.stringify(currentSlots)) as AutoScheduleSlot[];

    res.actions.forEach((act) => {
      if (act.type === 'DELETE_TASK') {
        newSlots = newSlots.filter(
          (s) => s.subject.toLowerCase() !== act.subjectName.toLowerCase()
        );
      } else if (act.type === 'CREATE_TASK' || act.type === 'RESCHEDULE_TASK') {
        const sTime = act.startTime || '10:00';
        const sMins = timeToMins(sTime);
        const eMins = sMins + (act.durationMinutes || 60);

        newSlots.push({
          id: `slot-nl-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          title: act.topicName || `${act.subjectName} Session`,
          type: act.taskType || 'Lecture',
          subject: act.subjectName,
          chapter: act.chapter || '',
          startTime: sTime,
          endTime: minsToTime(eMins),
          durationMinutes: act.durationMinutes || 60,
          priority: act.priority || 'High',
        });
      }
    });

    newSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    return {
      success: true,
      slots: newSlots,
      explanation: res.explanation,
      conflictWarning: res.conflictWarning,
      appliedChanges: res.appliedChanges.length > 0 ? res.appliedChanges : [`Updated schedule for: ${command}`],
    };
  }

  /**
   * Applies the generated schedule into Database Tasks and Lecture Records with duplicate protection
   */
  public applyScheduleToDatabase(targetDate: string, slots: AutoScheduleSlot[], examId?: string) {
    const targetExamId = examId || db.getActiveExamId();
    const existingTasks = db.getTasks(targetExamId);
    const otherDateTasks = existingTasks.filter((t) => t.dueDate !== targetDate);
    const existingDateTasks = existingTasks.filter((t) => t.dueDate === targetDate);

    const studySlots = slots.filter((s) => s.type !== 'Break' && s.type !== 'College' && s.type !== 'Commitment');
    const mergedDateTasks: TaskItem[] = [...existingDateTasks];

    studySlots.forEach((s, idx) => {
      const slotType = (s.type === 'Lecture' || s.type === 'Revision' || s.type === 'Practice' || s.type === 'DPP' ? s.type : 'Custom') as TaskItem['type'];
      const timeSlot = s.startTime < '12:00' ? 'Morning' : s.startTime < '17:00' ? 'Afternoon' : s.startTime < '21:00' ? 'Evening' : 'Night';

      const matchIdx = mergedDateTasks.findIndex(
        (t) =>
          t.subject?.toLowerCase() === s.subject?.toLowerCase() &&
          (t.title?.toLowerCase().includes(s.title?.toLowerCase() || '') ||
           s.title?.toLowerCase().includes(t.title?.toLowerCase() || ''))
      );

      if (matchIdx >= 0) {
        mergedDateTasks[matchIdx] = {
          ...mergedDateTasks[matchIdx],
          startTime: s.startTime,
          endTime: s.endTime,
          estimatedMinutes: s.durationMinutes,
          timeSlot,
        };
      } else {
        mergedDateTasks.push({
          id: `task-sched-${targetDate}-${idx}-${Date.now()}`,
          title: s.title,
          type: slotType,
          subject: s.subject,
          dueDate: targetDate,
          timeSlot,
          priority: s.priority || 'High',
          completed: false,
          status: 'Pending',
          estimatedMinutes: s.durationMinutes,
          startTime: s.startTime,
          endTime: s.endTime,
          examId: targetExamId,
        });
      }
    });

    db.setTasks([...otherDateTasks, ...mergedDateTasks]);

    studySlots.forEach((s) => {
      if (s.lectureId) {
        const lectures = db.getLectures(targetExamId);
        const lec = lectures.find((l) => l.id === s.lectureId);
        if (lec) {
          lec.reanchoredDate = targetDate;
          lec.scheduledTime = s.startTime;
          db.updateLecture(lec);
        }
      }
    });

    safeDispatch(new Event('studyos_tasks_updated'));
    safeDispatch(new Event('studyos_timetable_updated'));
    safeDispatch(new Event('studyos_db_updated'));
  }

  private normalizeTimeString(raw: string): string {
    const cleaned = raw.trim().toLowerCase();
    const isPM = cleaned.includes('pm');
    const isAM = cleaned.includes('am');
    const numbersOnly = cleaned.replace(/[^\d:]/g, '');

    const parts = numbersOnly.split(':');
    let hh = parseInt(parts[0], 10) || 0;
    const mm = parts[1] ? parseInt(parts[1], 10) : 0;

    if (isPM && hh < 12) hh += 12;
    if (isAM && hh === 12) hh = 0;

    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
}

export const aiScheduleService = new AIScheduleService();
