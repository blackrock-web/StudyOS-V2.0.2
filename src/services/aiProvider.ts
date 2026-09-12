/**
 * StudyOS AI Provider Layer
 * 
 * Defines one common interface (IAIProvider) that every AI-generation feature
 * in StudyOS calls through — no feature calls a specific provider directly.
 * 
 * Switching providers is a Settings change (aiProvider.setActiveProviderId),
 * requiring zero code changes in the consuming features.
 */

import { safeDispatch } from './db';
import { localModelManager } from './models/LocalModelManager';

// ============================================================================
// RESULT & OPTION INTERFACES
// ============================================================================

export interface NotesResult {
  id?: string;
  title: string;
  summary: string;
  keyPoints: string[];
  detailedContent: string;
  subject?: string;
  chapter?: string;
  tags?: string[];
}

export interface FlashcardResult {
  front: string;
  back: string;
  subject?: string;
  chapter?: string;
  category?: 'Flashcard' | 'Formula' | 'Short Note' | 'Concept';
  formula?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation?: string;
}

export interface QuizResult {
  title: string;
  subject?: string;
  questions: QuizQuestion[];
}

export interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
}

export interface MindMapResult {
  title: string;
  subject?: string;
  root: MindMapNode;
}

export interface FormulaSheetItem {
  title: string;
  formula: string;
  description?: string;
  variables?: string;
}

export interface FormulaSheetResult {
  title: string;
  subject?: string;
  items: FormulaSheetItem[];
}

export interface AIGenerateOptions {
  subject?: string;
  chapter?: string;
  topic?: string;
  targetLanguage?: string;
  customPrompt?: string;
  length?: 'short' | 'long';
  [key: string]: any;
}

export interface AIProviderMeta {
  id: string;
  name: string;
  description: string;
  type: 'zero-cost' | 'api' | 'local';
  isConfigured: boolean;
  isAvailable: boolean;
  comingSoon?: boolean;
}

export type AIGenerationType =
  | 'notes'
  | 'flashcards'
  | 'quiz'
  | 'summary'
  | 'mindmap'
  | 'formulasheet';

export interface AIReviewEventPayload {
  generationType: AIGenerationType;
  sourceText: string;
  providerId: string;
  options?: AIGenerateOptions;
  preparedPrompt?: string;
  parsedResult?: any;
}

// ============================================================================
// PLUGGABLE PROVIDER INTERFACE
// ============================================================================

export interface IAIProvider {
  id: string;
  name: string;
  meta: AIProviderMeta;

  generateNotes(sourceText: string, options?: AIGenerateOptions): Promise<NotesResult>;
  generateFlashcards(sourceText: string, options?: AIGenerateOptions): Promise<FlashcardResult[]>;
  generateQuiz(sourceText: string, options?: AIGenerateOptions): Promise<QuizResult>;
  generateSummary(sourceText: string, options?: { length?: 'short' | 'long'; subject?: string }): Promise<string>;
  generateMindMap(sourceText: string, options?: AIGenerateOptions): Promise<MindMapResult>;
  generateFormulaSheet(sourceText: string, options?: AIGenerateOptions): Promise<FormulaSheetResult>;
}

// ============================================================================
// ROBUST TEXT PARSERS (Universal Parsing Utilities)
// ============================================================================

export function parseTextToNotes(text: string, options?: AIGenerateOptions): NotesResult {
  if (!text || !text.trim()) {
    return {
      title: options?.topic || options?.chapter || 'Untitled Note',
      summary: 'No content provided.',
      keyPoints: [],
      detailedContent: '',
      subject: options?.subject,
      chapter: options?.chapter,
    };
  }

  // Check for JSON response
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.title || parsed.detailedContent || parsed.keyPoints) {
        return {
          title: parsed.title || options?.topic || 'Generated Note',
          summary: parsed.summary || (parsed.keyPoints ? parsed.keyPoints.join(' ') : ''),
          keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
          detailedContent: parsed.detailedContent || parsed.content || text,
          subject: parsed.subject || options?.subject,
          chapter: parsed.chapter || options?.chapter,
        };
      }
    }
  } catch (e) {
    // Fall back to line-by-line parsing
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let title = options?.topic || options?.chapter || 'Study Note';
  const keyPoints: string[] = [];
  const contentLines: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith('# ')) {
      title = line.replace('# ', '').trim();
    } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      const pt = line.replace(/^[-*•]\s*/, '').trim();
      if (pt && keyPoints.length < 10) {
        keyPoints.push(pt);
      }
      contentLines.push(line);
    } else {
      contentLines.push(line);
    }
  });

  const detailedContent = contentLines.join('\n\n') || text;
  const summary = keyPoints.length > 0 ? keyPoints.slice(0, 3).join(' ') : lines.slice(0, 2).join(' ');

  return {
    title,
    summary,
    keyPoints,
    detailedContent,
    subject: options?.subject,
    chapter: options?.chapter,
  };
}

export function parseTextToFlashcards(text: string, options?: AIGenerateOptions): FlashcardResult[] {
  if (!text || !text.trim()) return [];

  // Try JSON parsing
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const list = Array.isArray(parsed) ? parsed : parsed.flashcards || parsed.cards;
      if (Array.isArray(list) && list.length > 0) {
        return list.map((item: any) => ({
          front: item.front || item.question || item.term || 'Front',
          back: item.back || item.answer || item.definition || 'Back',
          subject: options?.subject,
          chapter: options?.chapter,
          category: item.category || (item.formula ? 'Formula' : 'Flashcard'),
          formula: item.formula || '',
        }));
      }
    }
  } catch (e) {
    // Fall back to pattern matching
  }

  const flashcards: FlashcardResult[] = [];
  // Pattern 1: Q: ... A: ...
  const qaMatches = text.split(/(?=Q:|\bQuestion:|\bFront:|\bTerm:)/i);
  qaMatches.forEach((block) => {
    const frontMatch = block.match(/(?:Q|Question|Front|Term):\s*([^\n]+)/i);
    const backMatch = block.match(/(?:A|Answer|Back|Definition):\s*([\s\S]+?)(?=(?:Q:|Question:|Front:|Term:|$))/i);
    if (frontMatch && backMatch) {
      flashcards.push({
        front: frontMatch[1].trim(),
        back: backMatch[1].trim(),
        subject: options?.subject,
        chapter: options?.chapter,
        category: 'Flashcard',
      });
    }
  });

  if (flashcards.length > 0) return flashcards;

  // Pattern 2: Term - Definition or Question? Answer
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  lines.forEach((line) => {
    if (line.includes(' - ')) {
      const parts = line.split(' - ');
      if (parts[0] && parts[1]) {
        flashcards.push({
          front: parts[0].replace(/^[-*•0-9.]+\s*/, '').trim(),
          back: parts.slice(1).join(' - ').trim(),
          subject: options?.subject,
          chapter: options?.chapter,
          category: 'Flashcard',
        });
      }
    } else if (line.includes('? ')) {
      const parts = line.split('? ');
      if (parts[0] && parts[1]) {
        flashcards.push({
          front: parts[0].replace(/^[-*•0-9.]+\s*/, '').trim() + '?',
          back: parts.slice(1).join('? ').trim(),
          subject: options?.subject,
          chapter: options?.chapter,
          category: 'Flashcard',
        });
      }
    }
  });

  return flashcards;
}

export function parseTextToQuiz(text: string, options?: AIGenerateOptions): QuizResult {
  const defaultResult: QuizResult = {
    title: options?.topic || options?.chapter ? `Quiz: ${options?.topic || options?.chapter}` : 'Practice Quiz',
    subject: options?.subject,
    questions: [],
  };

  if (!text || !text.trim()) return defaultResult;

  // Try JSON
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.questions)) {
        return {
          title: parsed.title || defaultResult.title,
          subject: parsed.subject || options?.subject,
          questions: parsed.questions.map((q: any, idx: number) => ({
            id: q.id || `q-${idx + 1}`,
            question: q.question || 'Question',
            options: Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswerIndex: typeof q.correctAnswerIndex === 'number' ? q.correctAnswerIndex : 0,
            explanation: q.explanation || '',
          })),
        };
      }
    }
  } catch (e) {
    // Pattern fallback
  }

  // Line pattern fallback
  const questions: QuizQuestion[] = [];
  const blocks = text.split(/(?=\b[0-9]+\.\s*|\bQ[0-9]+:\s*)/i);

  blocks.forEach((block, idx) => {
    const qMatch = block.match(/(?:\b[0-9]+\.|\bQ[0-9]+:)\s*([^\n]+)/i);
    if (!qMatch) return;

    const questionText = qMatch[1].trim();
    const optMatches = Array.from(block.matchAll(/(?:[A-D]\)|\b[A-D]\.|\b[a-d]\))\s*([^\n]+)/g));
    const opts = optMatches.map((m) => m[1].trim());

    const expMatch = block.match(/(?:Explanation|Answer|Correct):\s*([^\n]+)/i);
    let correctIdx = 0;
    if (expMatch) {
      const expText = expMatch[1].toUpperCase();
      if (expText.includes('B')) correctIdx = 1;
      else if (expText.includes('C')) correctIdx = 2;
      else if (expText.includes('D')) correctIdx = 3;
    }

    if (questionText && opts.length >= 2) {
      questions.push({
        id: `q-${idx + 1}`,
        question: questionText,
        options: opts.length >= 4 ? opts.slice(0, 4) : [...opts, ...Array(4 - opts.length).fill('Option')],
        correctAnswerIndex: correctIdx,
        explanation: expMatch ? expMatch[1].trim() : undefined,
      });
    }
  });

  return {
    ...defaultResult,
    questions,
  };
}

export function parseTextToSummary(text: string): string {
  if (!text) return '';
  return text.trim();
}

export function parseTextToMindMap(text: string, options?: AIGenerateOptions): MindMapResult {
  const rootLabel = options?.topic || options?.chapter || options?.subject || 'Main Concept';
  const root: MindMapNode = {
    id: 'root',
    label: rootLabel,
    children: [],
  };

  if (!text || !text.trim()) return { title: `Mind Map: ${rootLabel}`, subject: options?.subject, root };

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.root) {
        return {
          title: parsed.title || `Mind Map: ${rootLabel}`,
          subject: parsed.subject || options?.subject,
          root: parsed.root,
        };
      }
    }
  } catch (e) {
    // line parsing fallback
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const children: MindMapNode[] = [];

  lines.forEach((line, idx) => {
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ') || line.match(/^[0-9]+\./)) {
      const label = line.replace(/^[-*•0-9.]+\s*/, '').trim();
      if (label) {
        children.push({
          id: `node-${idx}`,
          label,
        });
      }
    }
  });

  if (children.length > 0) {
    root.children = children;
  }

  return {
    title: `Mind Map: ${rootLabel}`,
    subject: options?.subject,
    root,
  };
}

export function parseTextToFormulaSheet(text: string, options?: AIGenerateOptions): FormulaSheetResult {
  const defaultResult: FormulaSheetResult = {
    title: options?.topic || options?.subject ? `Formulas: ${options?.topic || options?.subject}` : 'Formula Sheet',
    subject: options?.subject,
    items: [],
  };

  if (!text || !text.trim()) return defaultResult;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.items)) {
        return {
          title: parsed.title || defaultResult.title,
          subject: parsed.subject || options?.subject,
          items: parsed.items,
        };
      }
    }
  } catch (e) {
    // line parsing
  }

  const items: FormulaSheetItem[] = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  lines.forEach((line) => {
    if (line.includes(':') || line.includes('=')) {
      const parts = line.split(/[:=]/);
      if (parts[0] && parts[1]) {
        items.push({
          title: parts[0].replace(/^[-*•0-9.]+\s*/, '').trim(),
          formula: parts.slice(1).join('=').trim(),
        });
      }
    }
  });

  return {
    ...defaultResult,
    items,
  };
}

// ============================================================================
// PROMPT BUILDER UTILITIES
// ============================================================================

export function buildAIPrompt(type: AIGenerationType, sourceText: string, options?: AIGenerateOptions): string {
  const subjectStr = options?.subject ? `Subject: ${options.subject}\n` : '';
  const chapterStr = options?.chapter ? `Chapter: ${options.chapter}\n` : '';
  const topicStr = options?.topic ? `Topic: ${options.topic}\n` : '';
  const langStr = options?.targetLanguage ? `Language: ${options.targetLanguage}\n` : '';

  let formatInstruction = '';
  switch (type) {
    case 'notes':
      formatInstruction = `Please format the output in Markdown with a Title (# ...), Key Points (- ...), and Detailed Study Notes.`;
      break;
    case 'flashcards':
      formatInstruction = `Please produce 5 to 10 flashcards in Q&A format or JSON array format [{ "front": "...", "back": "...", "category": "Flashcard" | "Formula" }].`;
      break;
    case 'quiz':
      formatInstruction = `Please produce a 5-question multiple choice quiz with question, options A-D, correct answer, and concise explanation.`;
      break;
    case 'summary':
      formatInstruction = `Please summarize the key takeaways in a ${options?.length || 'short'} format.`;
      break;
    case 'mindmap':
      formatInstruction = `Please outline a hierarchical concept mind map with main branches and sub-items.`;
      break;
    case 'formulasheet':
      formatInstruction = `Please list all key mathematical formulas, equations, definitions, and variable meanings.`;
      break;
  }

  return `Task: Generate ${type.toUpperCase()} from study source text.\n${subjectStr}${chapterStr}${topicStr}${langStr}\nInstruction: ${formatInstruction}\n\nSource Text:\n"""\n${sourceText}\n"""`;
}

// ============================================================================
// 1. LOCAL OFFLINE AI PROVIDER: LocalAIProvider (Default)
// Powered by local GGUF models & llama.cpp offline execution
// ============================================================================

export class LocalAIProvider implements IAIProvider {
  id = 'local';
  name = 'Local AI (llama.cpp / GGUF)';
  meta: AIProviderMeta = {
    id: 'local',
    name: 'Local AI (llama.cpp)',
    description: '100% offline, zero-cost, private inference using local GGUF models on CPU/GPU. Zero API keys, zero cloud dependency.',
    type: 'local',
    isConfigured: true,
    isAvailable: true,
  };

  async generateNotes(sourceText: string, options?: AIGenerateOptions): Promise<NotesResult> {
    const prompt = buildAIPrompt('notes', sourceText, options);
    const rawOutput = await localModelManager.executeOfflineInference(prompt, {
      subject: options?.subject,
      topic: options?.topic,
    });
    const parsed = parseTextToNotes(rawOutput + '\n\n' + sourceText, options);
    dispatchAIReviewEvent({
      generationType: 'notes',
      sourceText,
      providerId: this.id,
      options,
      preparedPrompt: prompt,
      parsedResult: parsed,
    });
    return parsed;
  }

  async generateFlashcards(sourceText: string, options?: AIGenerateOptions): Promise<FlashcardResult[]> {
    const prompt = buildAIPrompt('flashcards', sourceText, options);
    const rawOutput = await localModelManager.executeOfflineInference(prompt, {
      subject: options?.subject,
      topic: options?.topic,
    });
    const parsed = parseTextToFlashcards(rawOutput + '\n\n' + sourceText, options);
    dispatchAIReviewEvent({
      generationType: 'flashcards',
      sourceText,
      providerId: this.id,
      options,
      preparedPrompt: prompt,
      parsedResult: parsed,
    });
    return parsed;
  }

  async generateQuiz(sourceText: string, options?: AIGenerateOptions): Promise<QuizResult> {
    const prompt = buildAIPrompt('quiz', sourceText, options);
    const rawOutput = await localModelManager.executeOfflineInference(prompt, {
      subject: options?.subject,
      topic: options?.topic,
    });
    const parsed = parseTextToQuiz(rawOutput + '\n\n' + sourceText, options);
    dispatchAIReviewEvent({
      generationType: 'quiz',
      sourceText,
      providerId: this.id,
      options,
      preparedPrompt: prompt,
      parsedResult: parsed,
    });
    return parsed;
  }

  async generateSummary(sourceText: string, options?: { length?: 'short' | 'long'; subject?: string }): Promise<string> {
    const prompt = buildAIPrompt('summary', sourceText, options);
    const rawOutput = await localModelManager.executeOfflineInference(prompt, {
      subject: options?.subject,
    });
    const parsed = parseTextToSummary(rawOutput || sourceText);
    dispatchAIReviewEvent({
      generationType: 'summary',
      sourceText,
      providerId: this.id,
      options,
      preparedPrompt: prompt,
      parsedResult: parsed,
    });
    return parsed;
  }

  async generateMindMap(sourceText: string, options?: AIGenerateOptions): Promise<MindMapResult> {
    const prompt = buildAIPrompt('mindmap', sourceText, options);
    const rawOutput = await localModelManager.executeOfflineInference(prompt, {
      subject: options?.subject,
      topic: options?.topic,
    });
    const parsed = parseTextToMindMap(rawOutput + '\n\n' + sourceText, options);
    dispatchAIReviewEvent({
      generationType: 'mindmap',
      sourceText,
      providerId: this.id,
      options,
      preparedPrompt: prompt,
      parsedResult: parsed,
    });
    return parsed;
  }

  async generateFormulaSheet(sourceText: string, options?: AIGenerateOptions): Promise<FormulaSheetResult> {
    const prompt = buildAIPrompt('formulasheet', sourceText, options);
    const rawOutput = await localModelManager.executeOfflineInference(prompt, {
      subject: options?.subject,
      topic: options?.topic,
    });
    const parsed = parseTextToFormulaSheet(rawOutput + '\n\n' + sourceText, options);
    dispatchAIReviewEvent({
      generationType: 'formulasheet',
      sourceText,
      providerId: this.id,
      options,
      preparedPrompt: prompt,
      parsedResult: parsed,
    });
    return parsed;
  }
}

// ============================================================================
// 2. OFFLINE MANUAL IMPORT PROVIDER: ManualImportProvider
// ============================================================================

export class ManualImportProvider implements IAIProvider {
  id = 'manual';
  name = 'Manual Import (Zero-Cost / Paste)';
  meta: AIProviderMeta = {
    id: 'manual',
    name: 'Manual Import',
    description: 'Paste structured study notes, textbook excerpts, or offline revision text. 100% offline, zero-cost, no API key.',
    type: 'zero-cost',
    isConfigured: true,
    isAvailable: true,
  };

  async generateNotes(sourceText: string, options?: AIGenerateOptions): Promise<NotesResult> {
    dispatchAIReviewEvent({
      generationType: 'notes',
      sourceText,
      providerId: this.id,
      options,
      preparedPrompt: buildAIPrompt('notes', sourceText, options),
      parsedResult: parseTextToNotes(sourceText, options),
    });
    return parseTextToNotes(sourceText, options);
  }

  async generateFlashcards(sourceText: string, options?: AIGenerateOptions): Promise<FlashcardResult[]> {
    const res = parseTextToFlashcards(sourceText, options);
    dispatchAIReviewEvent({
      generationType: 'flashcards',
      sourceText,
      providerId: this.id,
      options,
      preparedPrompt: buildAIPrompt('flashcards', sourceText, options),
      parsedResult: res,
    });
    return res;
  }

  async generateQuiz(sourceText: string, options?: AIGenerateOptions): Promise<QuizResult> {
    const res = parseTextToQuiz(sourceText, options);
    dispatchAIReviewEvent({
      generationType: 'quiz',
      sourceText,
      providerId: this.id,
      options,
      preparedPrompt: buildAIPrompt('quiz', sourceText, options),
      parsedResult: res,
    });
    return res;
  }

  async generateSummary(sourceText: string, options?: { length?: 'short' | 'long'; subject?: string }): Promise<string> {
    const res = parseTextToSummary(sourceText);
    dispatchAIReviewEvent({
      generationType: 'summary',
      sourceText,
      providerId: this.id,
      options,
      preparedPrompt: buildAIPrompt('summary', sourceText, options),
      parsedResult: res,
    });
    return res;
  }

  async generateMindMap(sourceText: string, options?: AIGenerateOptions): Promise<MindMapResult> {
    const res = parseTextToMindMap(sourceText, options);
    dispatchAIReviewEvent({
      generationType: 'mindmap',
      sourceText,
      providerId: this.id,
      options,
      preparedPrompt: buildAIPrompt('mindmap', sourceText, options),
      parsedResult: res,
    });
    return res;
  }

  async generateFormulaSheet(sourceText: string, options?: AIGenerateOptions): Promise<FormulaSheetResult> {
    const res = parseTextToFormulaSheet(sourceText, options);
    dispatchAIReviewEvent({
      generationType: 'formulasheet',
      sourceText,
      providerId: this.id,
      options,
      preparedPrompt: buildAIPrompt('formulasheet', sourceText, options),
      parsedResult: res,
    });
    return res;
  }
}

// ============================================================================
// PROVIDER REGISTRY & MANAGER
// ============================================================================

class AIProviderRegistry {
  private providers: Map<string, IAIProvider> = new Map();
  private activeProviderId = 'local';

  constructor() {
    // Register 100% offline, zero-cloud providers
    this.register(new LocalAIProvider());
    this.register(new ManualImportProvider());

    // Restore saved provider from storage if valid
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('studyos_active_ai_provider');
        if (saved && (saved === 'local' || saved === 'manual')) {
          this.activeProviderId = saved;
        } else {
          this.activeProviderId = 'local';
        }
      } catch (e) {
        this.activeProviderId = 'local';
      }
    }
  }

  register(provider: IAIProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): IAIProvider | undefined {
    return this.providers.get(id);
  }

  getActiveProviderId(): string {
    return this.activeProviderId;
  }

  setActiveProviderId(id: string): void {
    const provider = this.providers.get(id);
    if (!provider) {
      console.warn(`Provider ${id} not found, defaulting to local.`);
      this.activeProviderId = 'local';
      return;
    }
    this.activeProviderId = id;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('studyos_active_ai_provider', id);
        safeDispatch(new CustomEvent('studyos_ai_provider_changed', { detail: { providerId: id } }));
      } catch (e) {
        console.error('Failed to save active AI provider:', e);
      }
    }
  }

  getActiveProvider(): IAIProvider {
    return this.providers.get(this.activeProviderId) || this.providers.get('local')!;
  }

  getAllProviders(): AIProviderMeta[] {
    return Array.from(this.providers.values()).map((p) => p.meta);
  }
}

// Global Singleton Instance
export const aiProviderRegistry = new AIProviderRegistry();

// Exported standard helper functions
export function getActiveProvider(): IAIProvider {
  return aiProviderRegistry.getActiveProvider();
}

export function getActiveProviderId(): string {
  return aiProviderRegistry.getActiveProviderId();
}

export function setActiveProviderId(id: string): void {
  aiProviderRegistry.setActiveProviderId(id);
}

export function getAllProviders(): AIProviderMeta[] {
  return aiProviderRegistry.getAllProviders();
}

export function dispatchAIReviewEvent(payload: AIReviewEventPayload): void {
  safeDispatch(new CustomEvent('studyos_trigger_ai_review', { detail: payload }));
}
