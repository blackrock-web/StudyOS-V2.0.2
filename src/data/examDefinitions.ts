import {
  SyllabusSubject,
  TaskItem,
  BookmarkItem,
  ResourceItem,
  ExamCategory,
} from '../types';
import {
  RAW_CS_SYLLABUS_DOC,
  RAW_DA_SYLLABUS_DOC,
} from './rawSyllabusData';
import {
  OFFICIAL_GATE_SYLLABUS,
  SUBJECT_REGISTRY,
  RegistrySubject,
} from './subjectRegistry';

export interface ExamDatesDefinition {
  examDate: string; // e.g. "2027-02-07"
  registrationStart?: string;
  registrationEnd?: string;
  admitCardDate?: string;
  resultDate?: string;
}

export interface ExamRevisionSettings {
  defaultIntervals: number[];
  dailyRevisionCapMinutes: number;
}

export interface ExamStudyGoals {
  dailyTargetHours: number;
  weeklyTargetHours: number;
  targetScore: string;
}

export interface ExamDefinition {
  examId: string;
  examName: string;
  category: ExamCategory;
  examDates: ExamDatesDefinition;
  subjects: SyllabusSubject[];
  topicTree: RegistrySubject[];
  plannerDefaults: TaskItem[];
  timetableTemplate: any[];
  revisionSettings: ExamRevisionSettings;
  studyGoals: ExamStudyGoals;
  analyticsDefaults: {
    targetHoursWeekly: number;
    targetScorePercent: number;
  };
  notesNamespace: string;
  flashcardsNamespace: string;
  mockTestNamespace: string;
  bookmarks: BookmarkItem[];
  resources: ResourceItem[];
  progress: {
    totalTopics: number;
    completedTopics: number;
    completionPercent: number;
  };
  metadata: {
    version: string;
    description: string;
    officialUrl?: string;
    isBuiltIn: boolean;
    isPlaceholder: boolean;
  };
}

// ---------------------------------------------------------
// 1. GATE 2027 CANONICAL DEFINITION
// ---------------------------------------------------------

function getGate2027TopicsCount(): number {
  let count = 0;
  [RAW_CS_SYLLABUS_DOC, RAW_DA_SYLLABUS_DOC].forEach((doc) => {
    (doc.sections || []).forEach((sec) => {
      (sec.subjects || []).forEach((sub) => {
        count += (sub.topics || []).length;
      });
    });
  });
  return count;
}

export const CANONICAL_GATE_2027: ExamDefinition = {
  examId: 'GATE2027',
  examName: 'GATE 2027 (CS & DA)',
  category: 'Engineering',
  examDates: {
    examDate: '2027-02-07',
    registrationStart: '2026-08-25',
    registrationEnd: '2026-09-30',
    admitCardDate: '2027-01-08',
    resultDate: '2027-03-19',
  },
  subjects: OFFICIAL_GATE_SYLLABUS,
  topicTree: SUBJECT_REGISTRY,
  plannerDefaults: [
    {
      id: 'gate-default-task-1',
      title: 'Study Data Structures & Algorithms - Core Principles',
      type: 'Lecture',
      subject: 'Data Structures & Algorithms',
      dueDate: '2026-08-01',
      timeSlot: 'Morning',
      priority: 'High',
      estimatedMinutes: 90,
      completed: false,
    },
    {
      id: 'gate-default-task-2',
      title: 'Solve Discrete Mathematics Practice Set (Logic)',
      type: 'DPP',
      subject: 'Discrete Mathematics',
      dueDate: '2026-08-01',
      timeSlot: 'Afternoon',
      priority: 'High',
      estimatedMinutes: 60,
      completed: false,
    },
    {
      id: 'gate-default-task-3',
      title: 'Operating Systems - CPU Scheduling & Concurrency',
      type: 'Revision',
      subject: 'Operating Systems',
      dueDate: '2026-08-01',
      timeSlot: 'Night',
      priority: 'Medium',
      estimatedMinutes: 45,
      completed: false,
    },
  ],
  timetableTemplate: [
    { time: '08:00 AM - 10:00 AM', subject: 'Core Computer Science', activity: 'Concept Learning' },
    { time: '10:30 AM - 12:00 PM', subject: 'Engineering Mathematics', activity: 'Problem Solving' },
    { time: '02:00 PM - 04:00 PM', subject: 'Data Science / Algorithms', activity: 'Practice & PYQs' },
    { time: '05:00 PM - 06:30 PM', subject: 'General Aptitude', activity: 'Speed Practice' },
    { time: '08:00 PM - 09:30 PM', subject: 'Revision / Flashcards', activity: 'Active Recall' },
  ],
  revisionSettings: {
    defaultIntervals: [1, 3, 7, 15, 30],
    dailyRevisionCapMinutes: 90,
  },
  studyGoals: {
    dailyTargetHours: 7,
    weeklyTargetHours: 48,
    targetScore: '85/100 (AIR < 50)',
  },
  analyticsDefaults: {
    targetHoursWeekly: 48,
    targetScorePercent: 85,
  },
  notesNamespace: 'notes/GATE2027',
  flashcardsNamespace: 'flashcards/GATE2027',
  mockTestNamespace: 'mocktests/GATE2027',
  bookmarks: [],
  resources: [],
  progress: {
    totalTopics: getGate2027TopicsCount(),
    completedTopics: 0,
    completionPercent: 0,
  },
  metadata: {
    version: '1.0.0',
    description: 'Official Graduate Aptitude Test in Engineering for CS & DA Papers',
    officialUrl: 'https://gate2027.iit.ac.in',
    isBuiltIn: true,
    isPlaceholder: false,
  },
};

// ---------------------------------------------------------
// Helper for generating structured ExamDefinitions with real subject trees
// ---------------------------------------------------------

export interface RawSubjectConfig {
  name: string;
  weightagePercent?: number;
  chapters: {
    name: string;
    topics: string[];
  }[];
}

function buildStructuredExam(
  examId: string,
  examName: string,
  category: ExamCategory,
  examDate: string,
  description: string,
  targetScore: string,
  dailyHours: number,
  subjectConfigs: RawSubjectConfig[],
  officialUrl?: string
): ExamDefinition {
  let totalTopics = 0;

  const topicTree: RegistrySubject[] = subjectConfigs.map((sConfig, sIdx) => {
    const sId = `${examId.toLowerCase()}-subj-${sIdx + 1}`;
    return {
      id: sId,
      name: sConfig.name,
      course: 'BOTH',
      chapters: sConfig.chapters.map((cConfig, cIdx) => {
        const cId = `${sId}-chap-${cIdx + 1}`;
        return {
          id: cId,
          name: cConfig.name,
          topics: cConfig.topics.map((tName, tIdx) => {
            totalTopics += 1;
            return {
              id: `${cId}-top-${tIdx + 1}`,
              name: tName,
              subtopics: [],
            };
          }),
        };
      }),
    };
  });

  const subjects: SyllabusSubject[] = subjectConfigs.map((sConfig, sIdx) => {
    const sId = `${examId.toLowerCase()}-subj-${sIdx + 1}`;
    return {
      id: sId,
      name: sConfig.name,
      course: 'CS' as const,
      tier: 'TIER_1' as const,
      weightage: `${sConfig.weightagePercent || Math.round(100 / subjectConfigs.length)}%`,
      coreHours7Month: 40,
      idealHours: 50,
      priorityRank: sIdx + 1,
      prerequisites: 'Core Syllabus',
      topics: sConfig.chapters.flatMap((chap, cIdx) =>
        chap.topics.map((topName, tIdx) => ({
          id: `${sId}::${chap.name}::${topName}`,
          subjectId: sId,
          name: `${chap.name}: ${topName}`,
          course: 'CS' as const,
          tier: 'TIER_1' as const,
          approach: 'DEPTH' as const,
          weightagePercent: Math.round(100 / Math.max(1, totalTopics)),
          idealHours: 8,
          completedHours: 0,
          status: 'Not Started' as const,
          confidence: 3,
          difficulty: 'Medium' as const,
          notesCount: 0,
          questionsSolved: 0,
          revisionCount: 0,
          subtopics: [chap.name],
        }))
      ),
    };
  });

  const primarySubj = subjectConfigs[0]?.name || 'Core Fundamentals';
  const secondarySubj = subjectConfigs[1]?.name || primarySubj;
  const tertiarySubj = subjectConfigs[2]?.name || secondarySubj;

  const plannerDefaults: TaskItem[] = [
    {
      id: `${examId.toLowerCase()}-default-task-1`,
      title: `Concept Learning: ${primarySubj} Fundamentals`,
      type: 'Lecture',
      subject: primarySubj,
      chapter: subjectConfigs[0]?.chapters[0]?.name || 'Introduction',
      dueDate: new Date().toISOString().slice(0, 10),
      timeSlot: 'Morning',
      priority: 'High',
      estimatedMinutes: 90,
      completed: false,
    },
    {
      id: `${examId.toLowerCase()}-default-task-2`,
      title: `Intensive Practice & PYQs: ${secondarySubj}`,
      type: 'DPP',
      subject: secondarySubj,
      chapter: subjectConfigs[1]?.chapters[0]?.name || 'Core Practice',
      dueDate: new Date().toISOString().slice(0, 10),
      timeSlot: 'Afternoon',
      priority: 'High',
      estimatedMinutes: 60,
      completed: false,
    },
    {
      id: `${examId.toLowerCase()}-default-task-3`,
      title: `Active Recall & Revision: ${tertiarySubj}`,
      type: 'Revision',
      subject: tertiarySubj,
      chapter: subjectConfigs[2]?.chapters[0]?.name || 'Key Formulas',
      dueDate: new Date().toISOString().slice(0, 10),
      timeSlot: 'Night',
      priority: 'Medium',
      estimatedMinutes: 45,
      completed: false,
    },
  ];

  const timetableTemplate = [
    { time: '08:00 AM - 10:00 AM', subject: primarySubj, activity: 'Concept Learning & Notes' },
    { time: '10:30 AM - 12:30 PM', subject: secondarySubj, activity: 'Problem Solving & Drills' },
    { time: '02:00 PM - 04:00 PM', subject: tertiarySubj, activity: 'PYQs & Speed Practice' },
    { time: '05:00 PM - 06:30 PM', subject: primarySubj, activity: 'Answer Writing & Quizzes' },
    { time: '08:00 PM - 09:30 PM', subject: 'Daily Revision', activity: 'Flashcards & Summary' },
  ];

  return {
    examId,
    examName,
    category,
    examDates: {
      examDate,
    },
    subjects,
    topicTree,
    plannerDefaults,
    timetableTemplate,
    revisionSettings: {
      defaultIntervals: [1, 3, 7, 15, 30],
      dailyRevisionCapMinutes: 75,
    },
    studyGoals: {
      dailyTargetHours: dailyHours,
      weeklyTargetHours: dailyHours * 7,
      targetScore,
    },
    analyticsDefaults: {
      targetHoursWeekly: dailyHours * 7,
      targetScorePercent: 80,
    },
    notesNamespace: `notes/${examId}`,
    flashcardsNamespace: `flashcards/${examId}`,
    mockTestNamespace: `mocktests/${examId}`,
    bookmarks: [],
    resources: [],
    progress: {
      totalTopics,
      completedTopics: 0,
      completionPercent: 0,
    },
    metadata: {
      version: '1.0.0',
      description,
      officialUrl,
      isBuiltIn: true,
      isPlaceholder: false,
    },
  };
}

// ---------------------------------------------------------
// 2. EXAM DEFINITIONS: UPSC, SSC, JEE, NEET, CAT, BANKING, etc.
// ---------------------------------------------------------

export const UPSC_EXAM_DEFINITION = buildStructuredExam(
  'UPSC',
  'UPSC Civil Services 2027',
  'Civil Services',
  '2027-05-23',
  'Indian Administrative Service (IAS), IPS & Central Civil Services Examination',
  'AIR < 100 (1050+ Marks)',
  8,
  [
    {
      name: 'Indian Polity & Governance',
      weightagePercent: 18,
      chapters: [
        {
          name: 'Constitutional Framework',
          topics: ['Historical Background & Making', 'Preamble & Salient Features', 'Union & its Territory, Citizenship', 'Fundamental Rights (Art 12-35)', 'Directive Principles (DPSP) & Duties'],
        },
        {
          name: 'Union & State Government',
          topics: ['President, VP, Prime Minister & Cabinet', 'Parliament: Structure, Bills & Committees', 'Governor, Chief Minister & Council', 'State Legislature & Legislative Procedures'],
        },
        {
          name: 'Judiciary & Local Self-Gov',
          topics: ['Supreme Court & Judicial Review', 'High Courts & Subordinate Judiciary', '73rd & 74th Amendments (Panchayati Raj & Municipalities)', 'Tribunals & Alternative Dispute Resolution'],
        },
        {
          name: 'Constitutional & Statutory Bodies',
          topics: ['Election Commission & CAG', 'UPSC, SPSC & Finance Commission', 'NITI Aayog, NHRC & CVC', 'Statutory, Regulatory & Quasi-Judicial Bodies'],
        },
      ],
    },
    {
      name: 'Modern & World History',
      weightagePercent: 14,
      chapters: [
        {
          name: 'Indian National Movement (1857-1947)',
          topics: ['Revolt of 1857 & Early Resistance', 'Moderate & Extremist Phases of Congress', 'Gandhian Era & Mass Movements (NCM, CDM, Quit India)', 'Revolutionary Movement & INA', 'Partition & Transfer of Power'],
        },
        {
          name: 'Socio-Religious & Cultural History',
          topics: ['19th Century Reform Movements (Brahmo, Arya, Ramakrishna)', 'Art, Architecture, Sculpture & Cave Temples', 'Indian Classical Dances, Music & Paintings', 'Bhakti & Sufi Movements'],
        },
        {
          name: 'Ancient & Medieval India',
          topics: ['Indus Valley & Vedic Period', 'Mauryan & Gupta Empires', 'Delhi Sultanate & Vijayanagara Empire', 'Mughal Empire: Administration & Culture'],
        },
      ],
    },
    {
      name: 'Indian & Physical Geography',
      weightagePercent: 14,
      chapters: [
        {
          name: 'Physical Geography',
          topics: ['Geomorphology: Plate Tectonics, Earthquakes & Volcanoes', 'Climatology: Atmospheric Circulation, Jet Streams, Monsoons', 'Oceanography: Ocean Currents, Tides & Coral Reefs'],
        },
        {
          name: 'Indian Physiography & Resources',
          topics: ['Himalayas, Northern Plains & Peninsular Plateau', 'Drainage Systems: Himalayan vs Peninsular Rivers', 'Soils, Natural Vegetation & Mineral Resources', 'Agriculture: Cropping Patterns, Irrigation & Food Security'],
        },
        {
          name: 'Human & Economic Geography',
          topics: ['Population Dynamics & Urbanization', 'Industrial Locations & Infrastructure Networks', 'Regional Development & Planning in India'],
        },
      ],
    },
    {
      name: 'Indian Economy & Development',
      weightagePercent: 16,
      chapters: [
        {
          name: 'Macroeconomics & National Income',
          topics: ['GDP, GNP & Growth Indicators', 'Inflation Indices (CPI, WPI) & Price Stability', 'Poverty, Unemployment & Inclusive Growth', 'Sustainable Development Goals (SDGs)'],
        },
        {
          name: 'Banking & Fiscal Policy',
          topics: ['RBI Monetary Policy Tools & Banking Sector Reforms', 'Government Budgeting & Fiscal Deficits', 'Taxation Reforms (GST, Direct Tax Code)', 'Financial Markets: Capital & Money Markets'],
        },
        {
          name: 'External Sector & Agriculture',
          topics: ['Balance of Payments, Forex Reserves & Trade Policy', 'WTO, IMF, World Bank & Trade Agreements', 'Agriculture Subsidies, MSP & Farm Infrastructure', 'Public Distribution System & Buffer Stocks'],
        },
      ],
    },
    {
      name: 'Environment, Ecology & Biodiversity',
      weightagePercent: 14,
      chapters: [
        {
          name: 'Ecology & Biodiversity',
          topics: ['Ecosystem Dynamics & Food Webs', 'Biodiversity Hotspots & Protected Area Networks', 'Endangered Species (IUCN Red List)', 'Forest & Wildlife Conservation Acts'],
        },
        {
          name: 'Climate Change & Pollution',
          topics: ['Global Warming & UNFCCC Paris Agreement', 'Air, Water, Plastic & E-waste Pollution Regulations', 'Renewable Energy Transition & Solar Mission', 'Environmental Impact Assessment (EIA)'],
        },
      ],
    },
    {
      name: 'Ethics, Integrity & Aptitude (GS IV)',
      weightagePercent: 12,
      chapters: [
        {
          name: 'Ethics & Human Interface',
          topics: ['Essence, Determinants & Consequences of Ethics', 'Human Values: Lessons from Leaders & Reformers', 'Role of Family, Society & Educational Institutions'],
        },
        {
          name: 'Public Service Values & Case Studies',
          topics: ['Integrity, Impartiality, Non-partisanship & Empathy', 'Emotional Intelligence in Administration', 'Probity in Governance & RTI / Citizen Charters', 'Applied Ethical Dilemma Case Studies'],
        },
      ],
    },
    {
      name: 'CSAT - Paper II Aptitude',
      weightagePercent: 12,
      chapters: [
        {
          name: 'Comprehension & Reasoning',
          topics: ['Reading Comprehension: Inference & Main Idea', 'Logical Deduction, Syllogisms & Seating', 'Puzzles, Direction Sense & Blood Relations'],
        },
        {
          name: 'Basic Numeracy & Data Interpretation',
          topics: ['Number Systems, Percentages & Ratios', 'Permutation, Combination & Probability', 'Data Interpretation: Charts, Graphs & Tables'],
        },
      ],
    },
  ],
  'https://upsc.gov.in'
);

export const SSC_EXAM_DEFINITION = buildStructuredExam(
  'SSC',
  'SSC CGL Tier I & II 2026',
  'Higher Ed',
  '2026-10-18',
  'Staff Selection Commission Combined Graduate Level Examination',
  '340+/390 in Tier-II',
  6,
  [
    {
      name: 'Quantitative Aptitude',
      weightagePercent: 30,
      chapters: [
        {
          name: 'Arithmetic Math',
          topics: ['Percentage, Profit, Loss & Discount', 'Simple & Compound Interest', 'Ratio, Proportion, Mixtures & Alligation', 'Time, Work, Pipes & Cisterns', 'Time, Speed, Distance, Trains & Boats', 'Averages & Partnership'],
        },
        {
          name: 'Advanced Mathematics',
          topics: ['Number System, Divisibility & Remainder Theorem', 'Algebra & Polynomial Identities', 'Geometry: Lines, Angles, Triangles, Circles', 'Mensuration: 2D Areas & 3D Volumes', 'Trigonometry & Heights and Distances', 'Coordinate Geometry Basics'],
        },
        {
          name: 'Data Interpretation',
          topics: ['Bar Graphs & Histograms', 'Pie Charts & Line Graphs', 'Tabular DI & Calculation Shortcuts'],
        },
      ],
    },
    {
      name: 'General Intelligence & Reasoning',
      weightagePercent: 25,
      chapters: [
        {
          name: 'Verbal Reasoning',
          topics: ['Analogies & Classification', 'Number, Letter & Symbol Series', 'Syllogism & Venn Diagrams', 'Coding-Decoding & Word Matrix', 'Blood Relations & Direction Sense', 'Statement & Conclusions / Assumptions'],
        },
        {
          name: 'Non-Verbal Reasoning',
          topics: ['Paper Folding & Cutting', 'Mirror & Water Images', 'Embedded Figures & Figure Completion', 'Dice, Cubes & Counting of Figures'],
        },
      ],
    },
    {
      name: 'English Language & Comprehension',
      weightagePercent: 25,
      chapters: [
        {
          name: 'Grammar & Usage',
          topics: ['Spotting the Error & Phrase Replacement', 'Sentence Improvement & Fill in the Blanks', 'Active & Passive Voice Transformations', 'Direct & Indirect Speech (Narration)'],
        },
        {
          name: 'Vocabulary & Reading',
          topics: ['Synonyms & Antonyms (High Frequency)', 'One Word Substitutions & Idioms/Phrases', 'Spellings & Misspelt Words', 'Reading Comprehension Passages', 'Cloze Test & Para Jumbles (PQRS)'],
        },
      ],
    },
    {
      name: 'General Awareness & Static GK',
      weightagePercent: 20,
      chapters: [
        {
          name: 'Indian History & Polity',
          topics: ['Ancient, Medieval & Modern Indian History', 'Indian Constitution, Articles, Amendments & President/PM', 'Parliament & Fundamental Rights'],
        },
        {
          name: 'Geography & General Science',
          topics: ['Physical, Indian & World Geography', 'Physics, Chemistry & Biology Basics (NCERT)', 'Indian Economy, Five Year Plans & Budget', 'Static GK: Dances, Festivals, Awards, Books & Sports', 'Current Affairs: National & International (Last 1 Year)'],
        },
      ],
    },
  ],
  'https://ssc.nic.in'
);

export const JEE_EXAM_DEFINITION = buildStructuredExam(
  'JEE',
  'JEE Main & Advanced 2027',
  'Engineering',
  '2027-04-15',
  'Joint Entrance Examination for Admissions into IITs, NITs and IIITs',
  '280+/300 (Main) | AIR < 500 (Adv)',
  8,
  [
    {
      name: 'Physics',
      weightagePercent: 33,
      chapters: [
        {
          name: 'Mechanics',
          topics: ['Kinematics 1D & 2D', 'Newton Laws of Motion & Friction', 'Work, Energy, Power & Circular Motion', 'Center of Mass, Momentum & Collisions', 'Rotational Dynamics & Moment of Inertia', 'Gravitation & Planetary Motion'],
        },
        {
          name: 'Electrodynamics',
          topics: ['Electrostatics: Field, Potential & Gauss Law', 'Capacitors & Dielectrics', 'Current Electricity & Circuit Theorems', 'Magnetic Effects of Current & Biot-Savart', 'Electromagnetic Induction & Faraday Law', 'Alternating Current & LC Oscillations'],
        },
        {
          name: 'Thermodynamics & Waves',
          topics: ['Thermal Expansion & Calorimetry', 'Kinetic Theory of Gases & Laws of Thermodynamics', 'Simple Harmonic Motion (SHM)', 'Wave Motion & Doppler Effect in Sound'],
        },
        {
          name: 'Optics & Modern Physics',
          topics: ['Ray Optics & Optical Instruments', 'Wave Optics: Interference & Diffraction', 'Photoelectric Effect & Dual Nature of Matter', 'Atomic Physics, Bohr Model & X-Rays', 'Nuclear Physics & Radioactivity', 'Semiconductor Devices & Logic Gates'],
        },
      ],
    },
    {
      name: 'Chemistry',
      weightagePercent: 33,
      chapters: [
        {
          name: 'Physical Chemistry',
          topics: ['Mole Concept & Stoichiometry', 'Atomic Structure & Quantum Numbers', 'Chemical Thermodynamics & Thermochemistry', 'Chemical Equilibrium & Ionic Equilibrium', 'Chemical Kinetics & Rate Laws', 'Electrochemistry & Galvanic Cells', 'Solutions & Colligative Properties', 'Solid State & Surface Chemistry'],
        },
        {
          name: 'Inorganic Chemistry',
          topics: ['Periodic Table & Periodic Properties', 'Chemical Bonding & Molecular Orbital Theory', 'Coordination Compounds & Crystal Field Theory', 'p-Block Elements (Groups 13 to 18)', 'd-Block & f-Block Transition Elements', 'Metallurgy & Principles of Extraction', 'Qualitative Salt Analysis'],
        },
        {
          name: 'Organic Chemistry',
          topics: ['General Organic Chemistry (GOC) & Isomerism', 'Hydrocarbons (Alkanes, Alkenes, Alkynes)', 'Haloalkanes & Haloarenes (SN1, SN2, E1, E2)', 'Alcohols, Phenols & Ethers', 'Aldehydes, Ketones & Carboxylic Acids', 'Amines, Diazonium Salts & Nitrogen Compounds', 'Biomolecules & Polymers in Action'],
        },
      ],
    },
    {
      name: 'Mathematics',
      weightagePercent: 34,
      chapters: [
        {
          name: 'Algebra',
          topics: ['Sets, Relations & Functions', 'Quadratic Equations & Expressions', 'Complex Numbers & De Moivre Theorem', 'Matrices & Determinants', 'Permutations & Combinations', 'Binomial Theorem & Mathematical Induction', 'Sequences & Series (AP, GP, HP, AGP)', 'Probability & Conditional Expectation'],
        },
        {
          name: 'Calculus',
          topics: ['Limits, Continuity & Differentiability', 'Application of Derivatives: Tangents, Maxima/Minima', 'Indefinite Integration & Standard Substitutions', 'Definite Integration & Properties', 'Area Under Curves & Bounded Regions', 'Differential Equations: First & Second Order'],
        },
        {
          name: 'Coordinate Geometry & Vectors',
          topics: ['Straight Lines & Pair of Straight Lines', 'Circles: Standard Equations & Tangents', 'Parabola, Ellipse & Hyperbola', 'Vectors: Dot, Cross & Scalar Triple Products', '3D Geometry: Lines & Planes in Space'],
        },
        {
          name: 'Trigonometry',
          topics: ['Trigonometric Ratios & Compound Angles', 'Trigonometric Equations & General Solutions', 'Inverse Trigonometric Functions (ITF)'],
        },
      ],
    },
  ],
  'https://jeemain.nta.nic.in'
);

export const NEET_EXAM_DEFINITION = buildStructuredExam(
  'NEET',
  'NEET UG 2027',
  'Medical',
  '2027-05-02',
  'National Eligibility cum Entrance Test for MBBS/BDS Admissions in India',
  '680+/720 (AIR < 1000)',
  8,
  [
    {
      name: 'Physics',
      weightagePercent: 25,
      chapters: [
        {
          name: 'Mechanics & Properties of Matter',
          topics: ['Units, Dimensions & Errors', 'Kinematics & Laws of Motion', 'Work, Energy, Power & Rotational Motion', 'Gravitation & Properties of Solids and Liquids'],
        },
        {
          name: 'Thermodynamics & Electromagnetism',
          topics: ['Thermodynamics & Kinetic Theory of Gases', 'Oscillations & Waves', 'Electrostatics & Current Electricity', 'Magnetism, EMI & AC Circuits'],
        },
        {
          name: 'Optics & Modern Physics',
          topics: ['Ray Optics & Wave Optics', 'Dual Nature of Radiation & Matter', 'Atoms & Nuclei', 'Electronic Devices (Semiconductors)'],
        },
      ],
    },
    {
      name: 'Chemistry',
      weightagePercent: 25,
      chapters: [
        {
          name: 'Physical & Inorganic Chemistry',
          topics: ['Some Basic Concepts of Chemistry', 'Structure of Atom & Periodic Classification', 'Chemical Bonding & Molecular Structure', 'Chemical Thermodynamics & Equilibrium', 'Redox Reactions & Electrochemistry', 'Coordination Compounds & p/d/f-Block Elements'],
        },
        {
          name: 'Organic Chemistry',
          topics: ['Organic Chemistry: Basic Principles & Techniques', 'Hydrocarbons & Haloalkanes', 'Alcohols, Phenols, Ethers & Carbonyl Compounds', 'Amines & Biomolecules (Carbohydrates, Proteins, Nucleic Acids)'],
        },
      ],
    },
    {
      name: 'Botany',
      weightagePercent: 25,
      chapters: [
        {
          name: 'Plant Diversity & Structure',
          topics: ['The Living World & Biological Classification', 'Plant Kingdom: Algae, Bryo, Pterido, Gymno & Angiosperms', 'Morphology & Anatomy of Flowering Plants', 'Cell: The Unit of Life & Cell Cycle/Division'],
        },
        {
          name: 'Plant Physiology & Genetics',
          topics: ['Photosynthesis in Higher Plants', 'Respiration in Plants & Plant Growth', 'Sexual Reproduction in Flowering Plants', 'Principles of Inheritance & Variation (Mendelian Genetics)', 'Molecular Basis of Inheritance (DNA/RNA)'],
        },
      ],
    },
    {
      name: 'Zoology',
      weightagePercent: 25,
      chapters: [
        {
          name: 'Animal Kingdom & Physiology',
          topics: ['Animal Kingdom: Invertebrates & Vertebrates', 'Structural Organisation in Animals (Tissues & Cockroach/Frog)', 'Human Breathing & Exchange of Gases', 'Body Fluids & Circulation', 'Excretory Products & Elimination', 'Locomotion & Movement', 'Neural Control & Chemical Coordination'],
        },
        {
          name: 'Reproduction, Evolution & Ecology',
          topics: ['Human Reproduction & Reproductive Health', 'Evolution: Origin of Life & Evidence', 'Human Health & Disease (Immunity, AIDS, Cancer)', 'Biotechnology: Principles & Applications', 'Organisms, Populations, Ecosystem & Biodiversity Conservation'],
        },
      ],
    },
  ],
  'https://neet.nta.nic.in'
);

export const CAT_EXAM_DEFINITION = buildStructuredExam(
  'CAT',
  'CAT Management Entrance 2026',
  'Management',
  '2026-11-29',
  'Common Admission Test for Admissions into Indian Institutes of Management (IIMs)',
  '99.5+ Percentile',
  6,
  [
    {
      name: 'Quantitative Aptitude (QA)',
      weightagePercent: 34,
      chapters: [
        {
          name: 'Arithmetic',
          topics: ['Percentages, Profit, Loss & Discount', 'Ratio, Proportion, Mixtures & Alligations', 'Time, Speed, Distance, Races & Escalators', 'Time, Work & Pipes', 'Averages & Weighted Averages'],
        },
        {
          name: 'Algebra & Numbers',
          topics: ['Linear & Quadratic Equations', 'Inequalities & Modulus Functions', 'Functions, Graphs & Maxima/Minima', 'Logarithms, Surds & Indices', 'Number Theory: Factors, Remainders & Base Systems'],
        },
        {
          name: 'Geometry & Modern Math',
          topics: ['Triangles, Circles & Polygons', 'Coordinate Geometry & Trigonometry', 'Mensuration 2D & 3D', 'Permutations & Combinations', 'Probability & Set Theory'],
        },
      ],
    },
    {
      name: 'Data Interpretation & Logical Reasoning (DILR)',
      weightagePercent: 33,
      chapters: [
        {
          name: 'Logical Reasoning',
          topics: ['Linear & Circular Arrangements', 'Matrix & Grid Arrangements', 'Puzzles, Blood Relations & Directions', 'Tournaments, Matches & Scheduling', 'Binary Logic, Truth-Tellers & Liars'],
        },
        {
          name: 'Data Interpretation',
          topics: ['Tables, Bar Charts & Pie Graphs', 'Radar, Bubble & Scatter Plots', 'Caselets & Reasoning-based DI', 'Set Theory & Venn Diagrams (3 & 4 Sets)'],
        },
      ],
    },
    {
      name: 'Verbal Ability & Reading Comprehension (VARC)',
      weightagePercent: 33,
      chapters: [
        {
          name: 'Reading Comprehension',
          topics: ['Philosophy & Sociology Passages', 'Economics, Business & Tech Passages', 'Science & Environment Passages', 'Inference, Author Tone & Critical Reasoning Questions'],
        },
        {
          name: 'Verbal Ability',
          topics: ['Para-Jumbles (TITA & MCQ)', 'Para-Summary & Core Argument', 'Odd Sentence Out', 'Para-Completion & Sentence Placement'],
        },
      ],
    },
  ],
  'https://iimcat.ac.in'
);

export const BANKING_EXAM_DEFINITION = buildStructuredExam(
  'Banking',
  'IBPS PO & SBI PO 2026',
  'Higher Ed',
  '2026-11-05',
  'Probationary Officer Examination for State Bank of India & Public Sector Banks',
  'Final Selection (Cutoff + 25 Marks)',
  6,
  [
    {
      name: 'Quantitative Aptitude',
      weightagePercent: 25,
      chapters: [
        {
          name: 'Data Interpretation & Calculations',
          topics: ['Tabular, Bar, Line & Pie DI', 'Caselet DI & Missing Data DI', 'Approximation & Simplification', 'Quadratic Equations & Inequalities', 'Missing & Wrong Number Series'],
        },
        {
          name: 'Arithmetic Word Problems',
          topics: ['Profit & Loss, SI & CI', 'Time & Work, Pipes & Cisterns', 'Time, Speed, Distance & Boats', 'Partnership, Ages & Ratio/Proportion', 'Mensuration & Probability Basics'],
        },
      ],
    },
    {
      name: 'Reasoning Ability',
      weightagePercent: 25,
      chapters: [
        {
          name: 'Puzzles & Seating',
          topics: ['Floor, Flat & Box Puzzles', 'Linear & Circular Seating Arrangement', 'Parallel Rows & Unknown Number of Persons', 'Month, Day, Year & Age Scheduling Puzzles'],
        },
        {
          name: 'Analytical & Miscellaneous',
          topics: ['Syllogism (Only A Few, Reverse)', 'Inequalities (Coded & Direct)', 'Coding-Decoding (New Pattern & Machine Input-Output)', 'Blood Relations & Direction Sense', 'Critical Reasoning: Cause-Effect, Course of Action'],
        },
      ],
    },
    {
      name: 'English Language',
      weightagePercent: 20,
      chapters: [
        {
          name: 'Grammar & Comprehension',
          topics: ['Reading Comprehension & Theme Detection', 'Cloze Test & Fillers (Single/Double)', 'Error Spotting & Sentence Improvement', 'Para Jumbles & Word Swap', 'Idioms, Phrases & Vocabulary in Context'],
        },
      ],
    },
    {
      name: 'General & Banking Awareness',
      weightagePercent: 20,
      chapters: [
        {
          name: 'Banking & Financial Awareness',
          topics: ['RBI Structure, Monetary Policy & Rates (Repo, Reverse Repo)', 'Banking Regulations, Basel III Norms & NPA Management', 'Financial Markets: Money Market, Capital Market & SEBI', 'Payment Systems: UPI, NEFT, RTGS, IMPS & Digital Rupee', 'Union Budget, Economic Survey & Government Schemes'],
        },
        {
          name: 'Current Affairs & Static GK',
          topics: ['National & International News (Last 6 Months)', 'Banking & Economy Current Affairs', 'Headquarters, Dams, National Parks & Wildlife Sanctuaries'],
        },
      ],
    },
    {
      name: 'Computer Aptitude',
      weightagePercent: 10,
      chapters: [
        {
          name: 'Computer Concepts',
          topics: ['Hardware, Software & OS Concepts', 'Networking, Protocols & Internet Security', 'DBMS, SQL Basics & Cloud Concepts', 'Shortcuts, Microsoft Office & File Extensions'],
        },
      ],
    },
  ],
  'https://ibps.in'
);

export const GRE_EXAM_DEFINITION = buildStructuredExam(
  'GRE',
  'GRE General Test',
  'Higher Ed',
  '2026-12-15',
  'Graduate Record Examination for Global Masters & PhD Admissions',
  '330+/340 (Q168, V162, AWA 5.0)',
  5,
  [
    {
      name: 'Verbal Reasoning',
      weightagePercent: 40,
      chapters: [
        {
          name: 'Vocabulary & Context',
          topics: ['Text Completion: 1-Blank, 2-Blank & 3-Blank Questions', 'Sentence Equivalence & Synonym Precision', 'High-Frequency GRE Vocabulary Words in Context'],
        },
        {
          name: 'Reading Comprehension',
          topics: ['Short & Long Reading Comprehension Passages', 'Author Purpose, Tone & Primary Argument', 'Inference, Structure & Function of Sentences', 'Critical Reasoning: Strengthen, Weaken & Assumption Questions'],
        },
      ],
    },
    {
      name: 'Quantitative Reasoning',
      weightagePercent: 40,
      chapters: [
        {
          name: 'Arithmetic & Algebra',
          topics: ['Number Properties, Fractions, Decimals & Percentages', 'Ratios, Proportions & Word Problems', 'Linear Equations, Inequalities & Quadratic Functions', 'Exponents, Roots & Sequences'],
        },
        {
          name: 'Geometry & Data Analysis',
          topics: ['Lines, Angles, Triangles & Quadrilaterals', 'Circles, 3D Solids & Coordinate Geometry', 'Descriptive Statistics: Mean, Median, Mode, SD & Normal Distribution', 'Permutations, Combinations & Probability', 'Data Interpretation Graphs & Multi-Source Tables'],
        },
      ],
    },
    {
      name: 'Analytical Writing (AWA)',
      weightagePercent: 20,
      chapters: [
        {
          name: 'Analyze an Issue Task',
          topics: ['Issue Essay Structure & Brainstorming', 'Formulating Persuasive Arguments & Nuanced Counterarguments', 'Cohesion, Transitions & Lexical Sophistication'],
        },
      ],
    },
  ],
  'https://ets.org/gre'
);

export const IELTS_EXAM_DEFINITION = buildStructuredExam(
  'IELTS',
  'IELTS Academic',
  'Higher Ed',
  '2026-12-20',
  'International English Language Testing System for Higher Education',
  'Band 8.0+ (L8.5, R8.5, W7.5, S8.0)',
  4,
  [
    {
      name: 'Listening Section',
      weightagePercent: 25,
      chapters: [
        {
          name: 'Listening Tasks',
          topics: ['Section 1: Social Context Conversations & Form Filling', 'Section 2: Monologue on Everyday Topic & Map Labeling', 'Section 3: Academic Discussion & Multiple Choice', 'Section 4: Academic Lecture & Note Completion'],
        },
      ],
    },
    {
      name: 'Reading Section',
      weightagePercent: 25,
      chapters: [
        {
          name: 'Academic Reading',
          topics: ['Passage 1: Descriptive & Factual Analysis', 'Passage 2: Discursive & Analytical Texts', 'Passage 3: Complex Theoretical Argumentation', 'Question Types: True/False/Not Given, Heading Matching, Summary Completion'],
        },
      ],
    },
    {
      name: 'Writing Section',
      weightagePercent: 25,
      chapters: [
        {
          name: 'Academic Writing',
          topics: ['Task 1: Describing Graphs, Charts, Maps & Process Diagrams (150 words)', 'Task 2: Discursive Essay (Opinion, Discussion, Problem-Solution) (250 words)', 'Grammar Range, Lexical Resource, Coherence & Task Achievement'],
        },
      ],
    },
    {
      name: 'Speaking Section',
      weightagePercent: 25,
      chapters: [
        {
          name: 'Interview & Monologue',
          topics: ['Part 1: Introduction & Familiar Everyday Questions', 'Part 2: Long Turn Cue Card Topic (2-minute talk with notes)', 'Part 3: In-depth Two-way Abstract Discussion', 'Fluency, Pronunciation, Lexical Range & Grammatical Accuracy'],
        },
      ],
    },
  ],
  'https://ielts.org'
);

export const TOEFL_EXAM_DEFINITION = buildStructuredExam(
  'TOEFL',
  'TOEFL iBT',
  'Higher Ed',
  '2026-12-22',
  'Test of English as a Foreign Language for University Admissions',
  '110+/120 (R28, L28, S27, W27)',
  4,
  [
    {
      name: 'Reading Section',
      weightagePercent: 25,
      chapters: [
        {
          name: 'Academic Passages',
          topics: ['Factual Information & Negative Factual Questions', 'Inference, Rhetorical Purpose & Vocabulary in Context', 'Sentence Simplification & Insert Text Questions', 'Prose Summary & Classification Tables'],
        },
      ],
    },
    {
      name: 'Listening Section',
      weightagePercent: 25,
      chapters: [
        {
          name: 'Conversations & Lectures',
          topics: ['Campus Service Conversations', 'Academic Classroom Lectures & Discussions', 'Gist-Content & Gist-Purpose Questions', 'Understanding Speaker Attitude & Function'],
        },
      ],
    },
    {
      name: 'Speaking Section',
      weightagePercent: 25,
      chapters: [
        {
          name: 'Integrated & Independent Speaking',
          topics: ['Question 1: Independent Opinion Task', 'Questions 2-4: Integrated Reading/Listening/Speaking Tasks', 'Delivery, Language Use & Topic Development'],
        },
      ],
    },
    {
      name: 'Writing Section',
      weightagePercent: 25,
      chapters: [
        {
          name: 'Writing for an Academic Discussion',
          topics: ['Integrated Writing: Synthesizing Reading & Lecture (20 mins)', 'Writing for an Academic Discussion: Online Forum Response (10 mins)', 'Clarity, Synthesis, Synthesis Accuracy & Coherence'],
        },
      ],
    },
  ],
  'https://ets.org/toefl'
);

export const CUSTOM_EXAM_DEFINITION = buildStructuredExam(
  'CUSTOM',
  'Custom Exam Workspace',
  'Custom',
  '2027-01-01',
  'Personalized study and competitive exam preparation workspace',
  'Target Score 85%',
  5,
  [
    {
      name: 'Core Module 1',
      weightagePercent: 40,
      chapters: [
        {
          name: 'Foundations & Core Principles',
          topics: ['Fundamental Concepts & Definitions', 'Theoretical Framework & Methods', 'Applied Problem Solving & Analysis'],
        },
      ],
    },
    {
      name: 'Core Module 2',
      weightagePercent: 40,
      chapters: [
        {
          name: 'Advanced Topics & Practice',
          topics: ['In-depth Topics & Case Studies', 'Practice Sets & Problem Drills', 'Exam Strategy & Speed Optimization'],
        },
      ],
    },
    {
      name: 'Practice & Revision',
      weightagePercent: 20,
      chapters: [
        {
          name: 'Recall & Diagnostics',
          topics: ['Flashcards & Spaced Repetition', 'Mock Tests & Mistake Notebook Analysis', 'Final Summary & Formula Book Review'],
        },
      ],
    },
  ]
);

// ---------------------------------------------------------
// 3. BUILT-IN EXAMS ARRAY
// ---------------------------------------------------------

export const BUILTIN_EXAMS: ExamDefinition[] = [
  CANONICAL_GATE_2027,
  UPSC_EXAM_DEFINITION,
  SSC_EXAM_DEFINITION,
  JEE_EXAM_DEFINITION,
  NEET_EXAM_DEFINITION,
  CAT_EXAM_DEFINITION,
  BANKING_EXAM_DEFINITION,
  GRE_EXAM_DEFINITION,
  IELTS_EXAM_DEFINITION,
  TOEFL_EXAM_DEFINITION,
  CUSTOM_EXAM_DEFINITION,
];

export function getExamDefinition(examId: string): ExamDefinition {
  const normalized = (examId || '').trim().toUpperCase();
  if (normalized === 'GATE' || normalized === 'GATE2027' || normalized === 'EXAM-GATE-2027') {
    return CANONICAL_GATE_2027;
  }
  const found = BUILTIN_EXAMS.find(
    (e) => e.examId.toUpperCase() === normalized || e.examId.toUpperCase() === (examId || '').trim().toUpperCase()
  );
  if (found) return found;

  // Fallback to custom exam
  return buildStructuredExam(
    examId,
    examId,
    'Custom',
    '2027-01-01',
    'Custom Exam Workspace',
    'Target Score',
    5,
    [
      {
        name: 'General Studies',
        chapters: [{ name: 'Core Concepts', topics: ['Fundamentals & Theory', 'Practice & Problem Solving'] }],
      },
    ]
  );
}
