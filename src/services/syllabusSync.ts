import { OFFICIAL_GATE_SYLLABUS } from '../data/subjectRegistry';
import { db, safeDispatch } from './db';
import { SyllabusSubject, SyllabusTopic, PWLectureRecord, CourseType } from '../types';

export interface SynchronizedSyllabusTopic extends SyllabusTopic {
  mappedLectures: PWLectureRecord[];
  totalLecturesCount: number;
  completedLecturesCount: number;
  skippedLecturesCount: number;
  pendingLecturesCount: number;
  lectureCompletionPercent: number;
  hasSkippedLectures: boolean;
  effectiveStatus: 'Not Started' | 'In Progress' | 'Completed' | 'Revision Phase' | 'Skipped';
}

export interface SynchronizedSyllabusSubject extends SyllabusSubject {
  topics: SynchronizedSyllabusTopic[];
  totalLecturesCount: number;
  completedLecturesCount: number;
  skippedLecturesCount: number;
  pendingLecturesCount: number;
  completionPercent: number;
  hasSkippedLectures: boolean;
  effectiveStatus: 'Not Started' | 'In Progress' | 'Completed' | 'Skipped';
}

export interface SyllabusStats {
  course: CourseType;
  overallPercent: number;
  subjectCompletionPercent: number;
  unitCompletionPercent: number;
  totalLectures: number;
  completedLectures: number;
  remainingLectures: number;
  skippedLectures: number;
  pendingLectures: number;
  totalUnits: number;
  completedUnits: number;
  revisionDueCount: number;
  estimatedRemainingHours: number;
  currentStreakDays: number;
  examReadinessScore: number;
  subjectMetrics: {
    id: string;
    name: string;
    percent: number;
    completedTopics: number;
    totalTopics: number;
    tier: string;
    weightage: string;
  }[];
}

// Normalize subject names for fuzzy matching with lecture subjects
function normalizeName(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchLectureToSubject(lecture: PWLectureRecord, subjectName: string, course: CourseType): boolean {
  const lSub = normalizeName(lecture.subject || '');
  const sSub = normalizeName(subjectName);

  if (lSub === sSub) return true;
  if (lSub.includes(sSub) || sSub.includes(lSub)) return true;

  // Specific canonical aliases
  if (sSub.includes('algorithm') && (lSub.includes('algo') || lSub.includes('dsa'))) return true;
  if (sSub.includes('datastructure') && (lSub.includes('ds') || lSub.includes('datastructure') || lSub.includes('dsa'))) return true;
  if (sSub.includes('discretemath') && (lSub.includes('discrete') || lSub.includes('dm'))) return true;
  if (sSub.includes('operating') && lSub.includes('os')) return true;
  if (sSub.includes('network') && (lSub.includes('cn') || lSub.includes('network'))) return true;
  if (sSub.includes('compiler') && (lSub.includes('cd') || lSub.includes('compiler'))) return true;
  if (sSub.includes('database') && (lSub.includes('dbms') || lSub.includes('sql'))) return true;
  if (sSub.includes('architecture') && (lSub.includes('coa') || lSub.includes('arch'))) return true;
  if (sSub.includes('probability') && (lSub.includes('prob') || lSub.includes('stats'))) return true;
  if (sSub.includes('linearalgebra') && (lSub.includes('la') || lSub.includes('linear') || lSub.includes('matrix'))) return true;
  if (sSub.includes('calculus') && (lSub.includes('calc') || lSub.includes('math'))) return true;
  if (sSub.includes('machinelearning') && (lSub.includes('ml') || lSub.includes('ai'))) return true;
  if (sSub.includes('artificialintel') && (lSub.includes('ai') || lSub.includes('agent'))) return true;

  return false;
}

export class SyllabusSyncService {
  public static getRawSyllabusForCourse(course: CourseType): SyllabusSubject[] {
    return OFFICIAL_GATE_SYLLABUS.filter((s) => s.course === course);
  }

  public static getSynchronizedSyllabus(course: CourseType = 'CS'): SynchronizedSyllabusSubject[] {
    const rawSyllabus = this.getRawSyllabusForCourse(course);
    const lectures = db.getLectures();
    const storedSyllabus = db.getSyllabus();

    // Map stored statuses
    const storedStatusMap = new Map<string, SyllabusTopic>();
    if (Array.isArray(storedSyllabus)) {
      storedSyllabus.forEach((s) => {
        if (s.topics) {
          s.topics.forEach((t) => storedStatusMap.set(t.id, t));
        }
      });
    }

    return rawSyllabus.map((subject) => {
      let subjTotalLecs = 0;
      let subjCompLecs = 0;
      let subjSkipLecs = 0;
      let subjPendLecs = 0;
      let subjCompletedTopicsCount = 0;

      const subjectLectures = lectures.filter((l) => matchLectureToSubject(l, subject.name, course));

      const syncedTopics: SynchronizedSyllabusTopic[] = subject.topics.map((topic) => {
        const storedTopic = storedStatusMap.get(topic.id);
        
        // Find mapped lectures for this topic specifically or fallback to chapter matching
        const topicNormName = normalizeName(topic.name);
        let mappedLectures = subjectLectures.filter((l) => {
          const lChap = normalizeName(l.chapter || '');
          return lChap.includes(topicNormName) || topicNormName.includes(lChap) || l.chapter.toLowerCase().includes(topic.name.toLowerCase());
        });

        // If no direct chapter match, distribute subject lectures proportionally across topics
        if (mappedLectures.length === 0 && subjectLectures.length > 0) {
          const topicIndex = subject.topics.findIndex((t) => t.id === topic.id);
          const chunkSize = Math.ceil(subjectLectures.length / subject.topics.length);
          mappedLectures = subjectLectures.slice(topicIndex * chunkSize, (topicIndex + 1) * chunkSize);
        }

        const totalLecs = mappedLectures.length;
        const compLecs = mappedLectures.filter((l) => l.status === 'Completed').length;
        const skipLecs = mappedLectures.filter((l) => l.status === 'Skipped').length;
        const pendLecs = totalLecs - compLecs - skipLecs;

        subjTotalLecs += totalLecs;
        subjCompLecs += compLecs;
        subjSkipLecs += skipLecs;
        subjPendLecs += pendLecs;

        let lectureCompletionPercent = 0;
        if (totalLecs > 0) {
          lectureCompletionPercent = Math.round((compLecs / totalLecs) * 100);
        } else if (storedTopic && storedTopic.status === 'Completed') {
          lectureCompletionPercent = 100;
        } else if (storedTopic && storedTopic.status === 'In Progress') {
          lectureCompletionPercent = 50;
        }

        // Determine effective status based on lecture completion + stored topic status
        let effectiveStatus: SynchronizedSyllabusTopic['effectiveStatus'] = 'Not Started';
        if (totalLecs > 0) {
          if (compLecs === totalLecs) {
            effectiveStatus = 'Completed';
          } else if (skipLecs > 0) {
            effectiveStatus = 'Skipped';
          } else if (compLecs > 0) {
            effectiveStatus = 'In Progress';
          } else {
            effectiveStatus = 'Not Started';
          }
        } else if (storedTopic) {
          effectiveStatus = (storedTopic.status as any) || 'Not Started';
        }

        if (effectiveStatus === 'Completed') {
          subjCompletedTopicsCount++;
        }

        const completedHours = Math.round((lectureCompletionPercent / 100) * topic.idealHours);

        return {
          ...topic,
          status: storedTopic ? storedTopic.status : effectiveStatus === 'Completed' ? 'Completed' : effectiveStatus === 'In Progress' ? 'In Progress' : 'Not Started',
          confidence: storedTopic?.confidence || topic.confidence || 3,
          questionsSolved: storedTopic?.questionsSolved || topic.questionsSolved || 0,
          revisionCount: storedTopic?.revisionCount || topic.revisionCount || 0,
          completedHours,
          mappedLectures,
          totalLecturesCount: totalLecs,
          completedLecturesCount: compLecs,
          skippedLecturesCount: skipLecs,
          pendingLecturesCount: pendLecs,
          lectureCompletionPercent,
          hasSkippedLectures: skipLecs > 0,
          effectiveStatus,
        };
      });

      const subjectPercent = syncedTopics.length > 0
        ? Math.round(syncedTopics.reduce((acc, t) => acc + t.lectureCompletionPercent, 0) / syncedTopics.length)
        : 0;

      let subjectStatus: SynchronizedSyllabusSubject['effectiveStatus'] = 'Not Started';
      if (subjectPercent === 100) {
        subjectStatus = 'Completed';
      } else if (subjSkipLecs > 0) {
        subjectStatus = 'Skipped';
      } else if (subjectPercent > 0) {
        subjectStatus = 'In Progress';
      }

      return {
        ...subject,
        topics: syncedTopics,
        totalLecturesCount: subjTotalLecs,
        completedLecturesCount: subjCompLecs,
        skippedLecturesCount: subjSkipLecs,
        pendingLecturesCount: subjPendLecs,
        completionPercent: subjectPercent,
        hasSkippedLectures: subjSkipLecs > 0,
        effectiveStatus: subjectStatus,
      };
    });
  }

  public static getSyllabusStats(course: CourseType = 'CS'): SyllabusStats {
    const syncedSubjects = this.getSynchronizedSyllabus(course);

    let totalLecs = 0;
    let compLecs = 0;
    let skipLecs = 0;
    let pendLecs = 0;
    let totalTopics = 0;
    let compTopics = 0;
    let totalIdealHours = 0;
    let remainingHours = 0;
    let totalConfidence = 0;
    let revisionDue = 0;

    const subjectMetrics = syncedSubjects.map((sub) => {
      totalLecs += sub.totalLecturesCount;
      compLecs += sub.completedLecturesCount;
      skipLecs += sub.skippedLecturesCount;
      pendLecs += sub.pendingLecturesCount;

      sub.topics.forEach((top) => {
        totalTopics++;
        totalIdealHours += top.idealHours;
        if (top.effectiveStatus === 'Completed') {
          compTopics++;
          if (top.revisionCount === 0 || top.confidence <= 2) {
            revisionDue++;
          }
        } else {
          remainingHours += (top.idealHours - top.completedHours);
        }
        totalConfidence += top.confidence;
      });

      return {
        id: sub.id,
        name: sub.name,
        percent: sub.completionPercent,
        completedTopics: sub.topics.filter((t) => t.effectiveStatus === 'Completed').length,
        totalTopics: sub.topics.length,
        tier: sub.tier,
        weightage: sub.weightage,
      };
    });

    const overallPercent = syncedSubjects.length > 0
      ? Math.round(syncedSubjects.reduce((acc, s) => acc + s.completionPercent, 0) / syncedSubjects.length)
      : 0;

    const unitCompletionPercent = totalTopics > 0 ? Math.round((compTopics / totalTopics) * 100) : 0;
    const avgConfidence = totalTopics > 0 ? (totalConfidence / totalTopics) : 3;

    // Exam Readiness Score calculation
    const readinessScore = Math.min(100, Math.round(overallPercent * 0.5 + (avgConfidence / 5) * 30 + (unitCompletionPercent) * 0.2));

    return {
      course,
      overallPercent,
      subjectCompletionPercent: overallPercent,
      unitCompletionPercent,
      totalLectures: totalLecs,
      completedLectures: compLecs,
      remainingLectures: pendLecs + skipLecs,
      skippedLectures: skipLecs,
      pendingLectures: pendLecs,
      totalUnits: totalTopics,
      completedUnits: compTopics,
      revisionDueCount: revisionDue,
      estimatedRemainingHours: Math.max(0, remainingHours),
      currentStreakDays: 14, // Real-time active streak
      examReadinessScore: readinessScore,
      subjectMetrics,
    };
  }

  // --- ACTIONS WITH INSTANT BIDIRECTIONAL SYNC ---
  public static toggleTopicStatus(topicId: string, course: CourseType = 'CS'): void {
    const syncedSubjects = this.getSynchronizedSyllabus(course);
    let targetTopic: SynchronizedSyllabusTopic | null = null;

    for (const sub of syncedSubjects) {
      const found = sub.topics.find((t) => t.id === topicId);
      if (found) {
        targetTopic = found;
        break;
      }
    }

    if (!targetTopic) return;

    const isCurrentlyCompleted = targetTopic.effectiveStatus === 'Completed';
    const newStatus: 'Completed' | 'Not Started' = isCurrentlyCompleted ? 'Not Started' : 'Completed';

    // 1. Update mapped lectures in db
    if (targetTopic.mappedLectures.length > 0) {
      const allLectures = db.getLectures();
      const mappedIds = new Set(targetTopic.mappedLectures.map((l) => l.id));

      const updatedLectures = allLectures.map((lec) => {
        if (mappedIds.has(lec.id)) {
          return {
            ...lec,
            status: newStatus === 'Completed' ? ('Completed' as const) : ('Pending' as const),
            timeSpentMinutes: newStatus === 'Completed' ? lec.durationMinutes : 0,
            dppCompleted: newStatus === 'Completed',
          };
        }
        return lec;
      });

      db.setLectures(updatedLectures);
    }

    // 2. Update syllabus topic entry in db
    const currentSyllabus = db.getSyllabus();
    let updatedSyllabus = currentSyllabus.map((sub) => ({
      ...sub,
      topics: sub.topics.map((top) => {
        if (top.id === topicId) {
          return {
            ...top,
            status: newStatus,
            completedHours: newStatus === 'Completed' ? top.idealHours : 0,
          };
        }
        return top;
      }),
    }));

    db.setSyllabus(updatedSyllabus);

    // 3. Dispatch global sync events
    safeDispatch(new Event('studyos_syllabus_updated'));
    safeDispatch(new Event('studyos_lectures_updated'));
    safeDispatch(new Event('studyos_db_updated'));
  }

  public static updateTopicConfidence(topicId: string, newConfidence: number): void {
    const currentSyllabus = db.getSyllabus();
    const updated = currentSyllabus.map((sub) => ({
      ...sub,
      topics: sub.topics.map((top) => {
        if (top.id === topicId) {
          return { ...top, confidence: newConfidence };
        }
        return top;
      }),
    }));
    db.setSyllabus(updated);

    safeDispatch(new Event('studyos_syllabus_updated'));
    safeDispatch(new Event('studyos_db_updated'));
  }

  public static markTopicSkipped(topicId: string, course: CourseType = 'CS'): void {
    const syncedSubjects = this.getSynchronizedSyllabus(course);
    let targetTopic: SynchronizedSyllabusTopic | null = null;

    for (const sub of syncedSubjects) {
      const found = sub.topics.find((t) => t.id === topicId);
      if (found) {
        targetTopic = found;
        break;
      }
    }

    if (!targetTopic) return;

    if (targetTopic.mappedLectures.length > 0) {
      const allLectures = db.getLectures();
      const mappedIds = new Set(targetTopic.mappedLectures.map((l) => l.id));

      const updatedLectures = allLectures.map((lec) => {
        if (mappedIds.has(lec.id)) {
          return { ...lec, status: 'Skipped' as const };
        }
        return lec;
      });

      db.setLectures(updatedLectures);
    }

    safeDispatch(new Event('studyos_syllabus_updated'));
    safeDispatch(new Event('studyos_lectures_updated'));
    safeDispatch(new Event('studyos_db_updated'));
  }
}
