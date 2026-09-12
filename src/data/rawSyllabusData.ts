import csSyllabusJson from './CS_GATE2027_Syllabus.json';
import daSyllabusJson from './DA_GATE2027_Syllabus.json';
import { getExamDefinition } from './examDefinitions';
import { safeDispatch } from '../services/db';

function getActiveExamId(): string {
  if (typeof window === 'undefined') return 'GATE2027';
  let id = localStorage.getItem('studyos_active_exam_id');
  if (!id || id === 'exam-gate-2027') id = 'GATE2027';
  return id;
}

export interface OfficialSyllabusTopicItem {
  id: string; // Unique deterministic ID
  paperCode: 'CS' | 'DA';
  sectionNo: number;
  sectionName: string; // Subject e.g. "Engineering Mathematics"
  subjectName: string; // Chapter e.g. "Discrete Mathematics"
  topicName: string;   // Topic text e.g. "Propositional and first order logic"
}

export interface OfficialSyllabusSubjectGroup {
  subject: string;
  topics: string[];
}

export interface OfficialSyllabusSectionDoc {
  section_no: number;
  section_name: string;
  subjects: OfficialSyllabusSubjectGroup[];
}

export interface OfficialSyllabusDoc {
  exam: string;
  organizing_institute: string;
  paper_code: 'CS' | 'DA';
  paper_name: string;
  sections: OfficialSyllabusSectionDoc[];
}

export const RAW_CS_SYLLABUS_DOC: OfficialSyllabusDoc = csSyllabusJson as unknown as OfficialSyllabusDoc;
export const RAW_DA_SYLLABUS_DOC: OfficialSyllabusDoc = daSyllabusJson as unknown as OfficialSyllabusDoc;

/** Helper to flatten all official topics for CS or DA or active exam */
export function getFlattenedOfficialTopics(paperFilter?: 'CS' | 'DA' | 'ALL'): OfficialSyllabusTopicItem[] {
  const activeExamId = getActiveExamId();

  if (activeExamId === 'GATE2027') {
    const docs: OfficialSyllabusDoc[] = [];
    if (!paperFilter || paperFilter === 'ALL' || paperFilter === 'CS') {
      docs.push(RAW_CS_SYLLABUS_DOC);
    }
    if (!paperFilter || paperFilter === 'ALL' || paperFilter === 'DA') {
      docs.push(RAW_DA_SYLLABUS_DOC);
    }

    const items: OfficialSyllabusTopicItem[] = [];

    docs.forEach((doc) => {
      (doc.sections || []).forEach((sec) => {
        (sec.subjects || []).forEach((sub) => {
          (sub.topics || []).forEach((topName) => {
            const id = `${doc.paper_code}::${sec.section_name}::${sub.subject}::${topName}`;
            items.push({
              id,
              paperCode: doc.paper_code,
              sectionNo: sec.section_no,
              sectionName: sec.section_name,
              subjectName: sub.subject,
              topicName: topName,
            });
          });
        });
      });
    });

    return items;
  }

  // Non-GATE active exam: flatten topicTree or subjects for active exam
  const examDef = getExamDefinition(activeExamId);
  const items: OfficialSyllabusTopicItem[] = [];

  if (examDef && examDef.topicTree) {
    examDef.topicTree.forEach((sec, sIdx) => {
      sec.chapters.forEach((chap) => {
        chap.topics.forEach((top) => {
          items.push({
            id: top.id,
            paperCode: 'CS',
            sectionNo: sIdx + 1,
            sectionName: sec.name,
            subjectName: chap.name,
            topicName: top.name,
          });
        });
      });
    });
  }

  return items;
}

/** Storage key for topic completion */
function getCompletedTopicsKey(): string {
  const activeExamId = getActiveExamId();
  return `studyos_completed_topics_${activeExamId}`;
}

export function getCompletedTopicIds(): Set<string> {
  const key = getCompletedTopicsKey();
  try {
    let raw = localStorage.getItem(key);
    if (!raw && getActiveExamId() === 'GATE2027') {
      raw = localStorage.getItem('gate2027_completed_topics_v2');
      if (raw) {
        localStorage.setItem(key, raw);
      }
    }
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set<string>(arr);
    }
  } catch (err) {
    console.error('Error reading completed topics from localStorage:', err);
  }
  return new Set<string>();
}

export function toggleCompletedTopic(topicId: string): boolean {
  const completed = getCompletedTopicIds();
  let isCompletedNow = false;
  if (completed.has(topicId)) {
    completed.delete(topicId);
    isCompletedNow = false;
  } else {
    completed.add(topicId);
    isCompletedNow = true;
  }
  const key = getCompletedTopicsKey();
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(completed)));
  } catch (e) {
    console.error('Error saving completed topics to localStorage:', e);
  }

  // Dispatch events so all active components re-render immediately
  safeDispatch(new Event('studyos_syllabus_updated'));
  safeDispatch(new Event('studyos_db_updated'));

  return isCompletedNow;
}

export function setTopicCompletionState(topicId: string, isCompleted: boolean): void {
  const completed = getCompletedTopicIds();
  if (isCompleted) {
    completed.add(topicId);
  } else {
    completed.delete(topicId);
  }
  const key = getCompletedTopicsKey();
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(completed)));
  } catch (e) {
    console.error('Error saving completed topics:', e);
  }

  safeDispatch(new Event('studyos_syllabus_updated'));
  safeDispatch(new Event('studyos_db_updated'));
}

/** Get completion metrics for CS, DA, and Combined */
export function getSyllabusProgressMetrics() {
  const allTopics = getFlattenedOfficialTopics('ALL');
  const completedSet = getCompletedTopicIds();

  const csTopics = allTopics.filter((t) => t.paperCode === 'CS');
  const daTopics = allTopics.filter((t) => t.paperCode === 'DA');

  const csCompleted = csTopics.filter((t) => completedSet.has(t.id)).length;
  const daCompleted = daTopics.filter((t) => completedSet.has(t.id)).length;
  const totalCompleted = allTopics.filter((t) => completedSet.has(t.id)).length;

  const csTotal = csTopics.length;
  const daTotal = daTopics.length;
  const combinedTotal = allTopics.length;

  const csPercent = csTotal > 0 ? Math.round((csCompleted / csTotal) * 100) : 0;
  const daPercent = daTotal > 0 ? Math.round((daCompleted / daTotal) * 100) : 0;
  const combinedPercent = combinedTotal > 0 ? Math.round((totalCompleted / combinedTotal) * 100) : 0;

  return {
    cs: {
      completed: csCompleted,
      total: csTotal,
      percent: csPercent,
    },
    da: {
      completed: daCompleted,
      total: daTotal,
      percent: daPercent,
    },
    combined: {
      completed: totalCompleted,
      total: combinedTotal,
      percent: combinedPercent,
    },
  };
}

