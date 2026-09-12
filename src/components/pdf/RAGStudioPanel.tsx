import React, { useState, useEffect, useMemo } from 'react';
import {
  Brain,
  Sparkles,
  Search,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Network,
  BookOpen,
  FileText,
  Zap,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Award,
  Hash,
  Database,
  HelpCircle,
  BarChart3,
  BookmarkPlus,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  ragEngineService,
  RAGParadigm,
  RAGChunk,
  RAGQueryResult,
  GraphRAGKnowledge,
} from './services/ragEngineService';
import { db } from '../../services/db';

interface RAGStudioPanelProps {
  activePdfName: string;
  currentPage: number;
  onNavigateToPage: (page: number) => void;
  onJumpToLocation?: (
    page: number,
    coordinates?: { x: number; y: number; w: number; h: number }
  ) => void;
  onTriggerNotification?: (
    title: string,
    message: string,
    type: 'info' | 'warning' | 'success' | 'alarm'
  ) => void;
  isCompact?: boolean;
}

export const RAGStudioPanel: React.FC<RAGStudioPanelProps> = ({
  activePdfName,
  currentPage,
  onNavigateToPage,
  onJumpToLocation,
  onTriggerNotification,
  isCompact = false,
}) => {
  const [paradigm, setParadigm] = useState<RAGParadigm>('advanced');
  const [query, setQuery] = useState<string>(
    "What is Dijkstra's algorithm time complexity and how does it compare to Bellman-Ford?"
  );
  const [alpha, setAlpha] = useState<number>(0.55); // 0.0 = BM25 sparse, 1.0 = Dense
  const [topK, setTopK] = useState<number>(4);
  const [useHyDE, setUseHyDE] = useState<boolean>(true);
  const [useDecomposition, setUseDecomposition] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<RAGQueryResult | null>(null);

  // Sub-views / tabs inside RAG Studio
  const [activeSubTab, setActiveSubTab] = useState<
    'answer' | 'chunks' | 'rerank' | 'triad' | 'graph' | 'transforms'
  >('answer');

  // GraphRAG state
  const [knowledgeGraph, setKnowledgeGraph] = useState<GraphRAGKnowledge | null>(null);
  const [selectedGraphNode, setSelectedGraphNode] = useState<string | null>(null);

  // All indexed chunks for the active document
  const [allDocChunks, setAllDocChunks] = useState<RAGChunk[]>([]);

  // Sample prompt chips for instant exploration
  const SAMPLE_PROMPTS = [
    "Dijkstra algorithm vs Bellman-Ford complexity & negative weights",
    "Eigenvalues and Matrix Trace properties",
    "Boyce-Codd Normal Form (BCNF) superkey condition",
    "TLB Effective Memory Access Time (EMAT) formula in paging",
  ];

  // Initialize or re-index on document change
  useEffect(() => {
    const defaultChunks = ragEngineService.chunkDocument(activePdfName || 'Active Study Document', []);
    setAllDocChunks(defaultChunks);
    const graph = ragEngineService.buildKnowledgeGraph(activePdfName || 'Active Study Document');
    setKnowledgeGraph(graph);
  }, [activePdfName]);

  // Run RAG query on mount or trigger
  const handleExecuteRAG = async (overrideQuery?: string) => {
    const q = overrideQuery || query;
    if (!q.trim()) return;

    setLoading(true);
    try {
      const res = await ragEngineService.executeRAG(q, activePdfName || 'Active Study Document', paradigm, {
        alpha,
        topK,
        useHyDE,
        useDecomposition,
      });
      setResult(res);
      if (onTriggerNotification) {
        onTriggerNotification(
          'RAG Execution Complete',
          `Executed ${paradigm.toUpperCase()} RAG in ${res.executionTimeMs}ms with ${res.triadMetrics.triadHarmonicScore}% Triad Score`,
          'success'
        );
      }
    } catch (err) {
      console.error('RAG Execution error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJump = (page: number, boundingBox?: any) => {
    if (onJumpToLocation) {
      onJumpToLocation(page, boundingBox);
    } else {
      onNavigateToPage(page);
    }
  };

  // Initial auto-run once
  useEffect(() => {
    handleExecuteRAG();
  }, [paradigm, activePdfName]);

  // Artifact Exporters
  const handleExportFlashcards = () => {
    if (!result || result.rerankedChunks.length === 0) return;
    const cards = ragEngineService.generateRAGFlashcards(result.rerankedChunks);
    cards.forEach((c) => {
      db.addFlashcard({
        id: 'fc-rag-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        front: c.front,
        back: c.back,
        subject: activePdfName || 'PDF Document',
        chapter: 'RAG Knowledge Synthesis',
        category: 'Flashcard',
        nextReviewDate: new Date().toISOString().split('T')[0] || '',
        intervalDays: 1,
        easeFactor: 2.5,
        repetitions: 0,
        confidence: 3,
      });
    });

    if (onTriggerNotification) {
      onTriggerNotification(
        'Flashcards Created',
        `Generated ${cards.length} grounded SRS flashcards from verified PDF chunks.`,
        'success'
      );
    }
  };

  const handleExportNote = () => {
    if (!result) return;
    const noteContent = `# RAG Knowledge Synthesis: ${result.query}
**Paradigm**: ${result.paradigm.toUpperCase()} | **Triad Score**: ${result.triadMetrics.triadHarmonicScore}%

## Verified Grounded Answer
${result.answer}

## Provenance & Citations
${result.rerankedChunks
  .map(
    (c) =>
      `- **Page ${c.pageNumber}, Chunk #${c.chunkIndex}** (Rerank Score: ${c.rerankScore}): "${c.text.substring(
        0,
        120
      )}..."`
  )
  .join('\n')}

*Generated by StudyOS RAG Knowledge Engine from ${activePdfName}*`;

    db.saveScratchpadNote({
      id: 'note-rag-' + Date.now(),
      title: `RAG Analysis: ${result.query.substring(0, 45)}...`,
      content: noteContent,
      isPinned: false,
      tags: ['RAG', 'Verified', activePdfName],
    });

    if (onTriggerNotification) {
      onTriggerNotification(
        'Study Note Saved',
        `Saved comprehensive RAG synthesis to your Study Notes hub.`,
        'success'
      );
    }
  };

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 select-none overflow-hidden font-sans">
      {/* HEADER: RAG Book Architecture Branding */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-slate-900 tracking-tight">RAG Book Studio</span>
              <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 text-[10px] font-black rounded-md uppercase tracking-wider">
                v2.4
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Retrieval-Augmented Generation & Evaluation Suite
            </p>
          </div>
        </div>

        {result && (
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-2xs text-xs font-bold">
            <Award className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-slate-600">Triad:</span>
            <span className="text-purple-700 font-black">{result.triadMetrics.triadHarmonicScore}%</span>
          </div>
        )}
      </div>

      {/* RAG PARADIGM SELECTOR */}
      <div className="px-4 py-2 bg-white border-b border-slate-100 shrink-0">
        <div className="text-[10.5px] font-black uppercase text-slate-400 tracking-wider mb-1.5 flex items-center justify-between">
          <span>Architecture Paradigm</span>
          <span className="text-[10px] lowercase text-purple-600 font-semibold">
            {paradigm === 'advanced' && 'Hybrid BM25+Dense • Cross-Encoder Rerank'}
            {paradigm === 'naive' && 'Pure Dense Cosine Similarity'}
            {paradigm === 'modular' && 'Dynamic Routing • Decomposition'}
            {paradigm === 'self-reflective' && 'CRAG Gating • Critique Tokens'}
            {paradigm === 'graph-rag' && 'Entity-Relation Knowledge Graph'}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200/80 text-[11px] font-bold">
          {(
            [
              { id: 'naive', label: 'Naive' },
              { id: 'advanced', label: 'Advanced' },
              { id: 'modular', label: 'Modular' },
              { id: 'self-reflective', label: 'Self-RAG' },
              { id: 'graph-rag', label: 'GraphRAG' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setParadigm(item.id)}
              className={`py-1.5 px-1 rounded-lg text-center transition-all cursor-pointer truncate ${
                paradigm === item.id
                  ? 'bg-white text-purple-700 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* QUERY INPUT & CONTROLS */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/40 space-y-2.5 shrink-0">
        <div className="relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleExecuteRAG();
              }
            }}
            rows={2}
            placeholder="Ask a technical or formula question from this PDF..."
            className="w-full text-xs font-medium bg-white border border-slate-200 rounded-xl p-2.5 pr-20 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none shadow-2xs"
          />
          <button
            onClick={() => handleExecuteRAG()}
            disabled={loading}
            className="absolute right-2 bottom-2.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-black flex items-center gap-1 shadow-xs transition-all cursor-pointer"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Run</span>
              </>
            )}
          </button>
        </div>

        {/* SAMPLE PROMPT CHIPS */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          <span className="text-[10px] font-bold text-slate-400 shrink-0">Try:</span>
          {SAMPLE_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQuery(p);
                handleExecuteRAG(p);
              }}
              className="text-[10.5px] font-semibold bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 text-slate-600 px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer"
            >
              {p.split(' ')[0]} {p.split(' ')[1]}...
            </button>
          ))}
        </div>

        {/* ADVANCED HYPERPARAMETERS COLLAPSIBLE BAR */}
        <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
            <span className="flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-purple-600" />
              Hybrid Search & Retrieval Weights
            </span>
            <span className="text-[10px] text-purple-700 font-extrabold">
              {alpha === 0.5 ? 'Balanced 50/50' : alpha > 0.5 ? `Dense ${(alpha * 100).toFixed(0)}%` : `BM25 ${((1 - alpha) * 100).toFixed(0)}%`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 items-center text-xs">
            <div>
              <div className="flex justify-between text-[10px] text-slate-500 font-semibold mb-1">
                <span>BM25 Sparse</span>
                <span>Dense Cosine</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={alpha}
                onChange={(e) => setAlpha(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useHyDE}
                  onChange={(e) => setUseHyDE(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                HyDE
              </label>

              <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useDecomposition}
                  onChange={(e) => setUseDecomposition(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                Decompose
              </label>

              <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold">Top-K:</span>
                <select
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                  className="text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded px-1 py-0.5"
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={6}>6</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SUB-NAVIGATION TABS */}
      <div className="flex items-center gap-1 px-4 border-b border-slate-200 bg-slate-50 text-[11px] font-bold shrink-0">
        {[
          { id: 'answer', label: 'Grounded Answer', icon: ShieldCheck },
          { id: 'triad', label: 'RAG Triad (RAGAS)', icon: BarChart3 },
          { id: 'rerank', label: 'Re-Ranking Matrix', icon: Layers },
          { id: 'chunks', label: `Chunks (${allDocChunks.length})`, icon: Database },
          { id: 'transforms', label: 'Query Transforms', icon: Sparkles },
          { id: 'graph', label: 'GraphRAG', icon: Network },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-1.5 py-2 px-2.5 border-b-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-purple-600 text-purple-700 bg-white font-extrabold shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* MAIN VIEW CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* VIEW 1: GROUNDED ANSWER */}
        {activeSubTab === 'answer' && (
          <div className="space-y-4">
            {result ? (
              <>
                {/* CRITIQUE TOKENS (Self-RAG) */}
                {result.paradigm === 'self-reflective' && (
                  <div className="flex items-center gap-2 p-2 bg-purple-50/80 border border-purple-200 rounded-xl text-xs">
                    <span className="font-extrabold text-purple-900 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-purple-600" />
                      Self-RAG Critique:
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md">
                      [ISREL: {result.critiqueTokens.isRel}]
                    </span>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-black rounded-md">
                      [ISSUP: {result.critiqueTokens.isSup}]
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black rounded-md">
                      [ISUSE: {result.critiqueTokens.isUse}]
                    </span>
                  </div>
                )}

                {/* SYNTHESIZED ANSWER WITH GROUNDING */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-black text-slate-800">
                        Synthesized & Grounded Answer ({result.executionTimeMs}ms)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleExportFlashcards}
                        title="Export to SRS Flashcards"
                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-700 border border-slate-200 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-purple-600" />
                        <span>Flashcard</span>
                      </button>
                      <button
                        onClick={handleExportNote}
                        title="Save to Study Notes"
                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-700 border border-slate-200 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                      >
                        <BookmarkPlus className="w-3 h-3 text-purple-600" />
                        <span>Note</span>
                      </button>
                    </div>
                  </div>

                  {/* SENTENCE-LEVEL ATTRIBUTION VIEW */}
                  <div className="text-xs leading-relaxed space-y-2 font-medium text-slate-800">
                    {result.attributions.map((attr, idx) => (
                      <span
                        key={idx}
                        className={`inline-block mr-1 p-1 rounded-md transition-colors ${
                          attr.type === 'grounded'
                            ? 'bg-emerald-50 text-emerald-950 border border-emerald-200/60'
                            : attr.type === 'inferred'
                            ? 'bg-purple-50 text-purple-950 border border-purple-200/60'
                            : 'bg-slate-50 text-slate-700'
                        }`}
                      >
                        {attr.sentence}
                        {attr.pageNumbers && attr.pageNumbers.length > 0 && (
                          <button
                            onClick={() => {
                              const page = attr.pageNumbers[0] || 1;
                              const chunk = result.rerankedChunks.find((c) => c.pageNumber === page);
                              handleJump(page, chunk?.boundingBox);
                            }}
                            className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-white border border-slate-300 rounded text-[10px] font-extrabold text-purple-700 hover:bg-purple-600 hover:text-white transition-colors cursor-pointer"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            P.{attr.pageNumbers.join(', ')}
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  {/* PROVENANCE CHUNK CARDS */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Top Retrieved & Grounded Citations</span>
                      <span className="text-[10px] text-purple-600 font-bold lowercase">
                        click to jump & pulse page
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {result.rerankedChunks.map((chunk, cIdx) => (
                        <div
                          key={chunk.id}
                          onClick={() => handleJump(chunk.pageNumber, chunk.boundingBox)}
                          className="p-2.5 bg-slate-50 hover:bg-purple-50/50 border border-slate-200 hover:border-purple-300 rounded-xl transition-all cursor-pointer group"
                        >
                          <div className="flex items-center justify-between text-[11px] font-extrabold mb-1">
                            <span className="text-purple-800 flex items-center gap-1">
                              <Hash className="w-3 h-3 text-purple-500" />
                              Page {chunk.pageNumber} • Chunk #{chunk.chunkIndex}
                            </span>
                            <span className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.2 rounded font-mono text-slate-600">
                              Score: {chunk.rerankScore}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2 italic font-mono">
                            "{chunk.text}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <Brain className="w-8 h-8 mx-auto text-purple-300 animate-pulse" />
                <p className="text-xs font-bold">Enter a question and run the RAG Knowledge Engine.</p>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: RAG TRIAD & EVALUATION SUITE (RAGAS) */}
        {activeSubTab === 'triad' && result && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                    RAG Triad Assessment (RAGAS Framework)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Mathematical validation of Context Relevance, Faithfulness, and Answer Alignment
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-purple-700">
                    {result.triadMetrics.triadHarmonicScore}%
                  </div>
                  <div className="text-[10px] text-slate-400 font-extrabold uppercase">Harmonic Index</div>
                </div>
              </div>

              {/* THREE CORE PILLARS */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="text-[11px] font-black text-slate-700">Context Relevance</div>
                  <div className="text-lg font-black text-emerald-600">
                    {result.triadMetrics.contextRelevance}%
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{ width: `${result.triadMetrics.contextRelevance}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Information density of retrieved chunks relative to query.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="text-[11px] font-black text-slate-700">Grounded Faithfulness</div>
                  <div className="text-lg font-black text-purple-600">
                    {result.triadMetrics.faithfulness}%
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-purple-500 h-full rounded-full"
                      style={{ width: `${result.triadMetrics.faithfulness}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Ratio of answer claims strictly proven by PDF passages.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="text-[11px] font-black text-slate-700">Answer Relevance</div>
                  <div className="text-lg font-black text-blue-600">
                    {result.triadMetrics.answerRelevance}%
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full"
                      style={{ width: `${result.triadMetrics.answerRelevance}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Direct responsiveness to user query intent.
                  </p>
                </div>
              </div>

              {/* DIAGNOSTIC REMARKS */}
              <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl space-y-1.5">
                <div className="text-[11px] font-black uppercase text-purple-800">
                  Automated Pipeline Diagnostics
                </div>
                <div className="space-y-1">
                  {result.triadMetrics.evaluationRemarks.map((rem, i) => (
                    <div key={i} className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <span>{rem}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: CROSS-ENCODER RE-RANKING MATRIX */}
        {activeSubTab === 'rerank' && result && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                Cross-Encoder Re-Ranking & Score Matrix
              </h3>
              <span className="text-[10px] text-slate-400 font-bold">Top-K: {result.rerankedChunks.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-medium">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 text-[10px] font-black uppercase">
                    <th className="py-2 px-2">Final Rank</th>
                    <th className="py-2 px-2">Initial Rank</th>
                    <th className="py-2 px-2">Page / Chunk</th>
                    <th className="py-2 px-2">Rerank Score</th>
                    <th className="py-2 px-2">BM25 Sparse</th>
                    <th className="py-2 px-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rerankedChunks.map((chunk) => {
                    const delta = (chunk.initialRank || 1) - (chunk.finalRank || 1);
                    return (
                      <tr
                        key={chunk.id}
                        className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-2.5 px-2 font-black text-purple-700">#{chunk.finalRank}</td>
                        <td className="py-2.5 px-2 text-slate-500">
                          #{chunk.initialRank}{' '}
                          {delta !== 0 && (
                            <span
                              className={`text-[10px] font-bold ${
                                delta > 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              ({delta > 0 ? `+${delta}` : delta})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 font-extrabold text-slate-800">
                          Page {chunk.pageNumber} • C#{chunk.chunkIndex}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-purple-800 font-bold">
                          {chunk.rerankScore}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-slate-600">
                          {chunk.sparseScore?.toFixed(3) || '0.000'}
                        </td>
                        <td className="py-2.5 px-2">
                          <button
                            onClick={() => handleJump(chunk.pageNumber, chunk.boundingBox)}
                            className="px-2 py-0.5 bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white rounded text-[10px] font-extrabold transition-colors cursor-pointer"
                          >
                            Jump
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 4: DOCUMENT CHUNK INGESTION MATRIX */}
        {activeSubTab === 'chunks' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-black text-slate-800">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-purple-600" />
                Indexed Semantic Chunks for "{activePdfName || 'Document'}"
              </span>
              <span className="text-[10.5px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-bold">
                {allDocChunks.length} Chunks Active
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {allDocChunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 hover:border-purple-300 transition-all shadow-2xs"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-purple-600" />
                      Page {chunk.pageNumber} • Chunk #{chunk.chunkIndex}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                        {chunk.tokens} tokens
                      </span>
                      <button
                        onClick={() => onJumpToLocation(chunk.pageNumber, chunk.boundingBox)}
                        className="px-2 py-0.5 bg-purple-600 text-white rounded text-[10px] font-black hover:bg-purple-700 transition-colors cursor-pointer flex items-center gap-0.5"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        Jump
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                    "{chunk.text}"
                  </p>

                  {chunk.entities && chunk.entities.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {chunk.entities.map((ent, eIdx) => (
                        <span
                          key={eIdx}
                          className="px-1.5 py-0.2 bg-purple-50 text-purple-800 border border-purple-200 rounded text-[9.5px] font-bold"
                        >
                          {ent}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 5: PRE-RETRIEVAL QUERY TRANSFORMATIONS */}
        {activeSubTab === 'transforms' && result && (
          <div className="space-y-3">
            {/* HyDE Passages */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-xs">
              <div className="flex items-center justify-between text-xs font-black text-purple-900">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  HyDE (Hypothetical Document Embeddings)
                </span>
                <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-mono">
                  Zero-Shot Semantic Bridge
                </span>
              </div>
              <p className="text-xs text-slate-700 italic bg-purple-50/60 p-3 rounded-xl border border-purple-100 font-mono leading-relaxed">
                "{result.transformedQueries.hydePassage || ragEngineService.generateHyDE(query)}"
              </p>
            </div>

            {/* Sub-Queries */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-xs">
              <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                Atomic Sub-Query Decomposition
              </div>
              <div className="space-y-1.5">
                {ragEngineService.decomposeQuery(query).map((sub, i) => (
                  <div
                    key={i}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 flex items-center justify-between"
                  >
                    <span>{sub}</span>
                    <button
                      onClick={() => {
                        setQuery(sub);
                        handleExecuteRAG(sub);
                      }}
                      className="text-[10px] text-purple-600 font-bold hover:underline"
                    >
                      Run Sub-Query
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Step-Back Query */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-xs">
              <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                Step-Back Generalized Prompting
              </div>
              <p className="text-xs text-slate-700 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200 font-medium">
                "{ragEngineService.generateStepBackQuery(query)}"
              </p>
            </div>
          </div>
        )}

        {/* VIEW 6: GraphRAG KNOWLEDGE NETWORK */}
        {activeSubTab === 'graph' && knowledgeGraph && (
          <div className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Network className="w-4 h-4 text-purple-600" />
                    GraphRAG Concept & Entity Relations
                  </h3>
                  <p className="text-[10.5px] text-slate-500 font-medium">
                    Entity nodes extracted across document chapters
                  </p>
                </div>
                <span className="text-xs font-mono bg-purple-50 text-purple-800 px-2 py-0.5 rounded font-bold">
                  {knowledgeGraph.nodes.length} Nodes • {knowledgeGraph.edges.length} Edges
                </span>
              </div>

              {/* INTERACTIVE SVG GRAPH CANVAS */}
              <div className="h-64 bg-slate-50 border border-slate-200 rounded-xl relative overflow-hidden flex items-center justify-center">
                <svg className="w-full h-full">
                  {/* Edges */}
                  {knowledgeGraph.edges.map((edge, idx) => {
                    const srcIdx = knowledgeGraph.nodes.findIndex((n) => n.id === edge.source);
                    const tgtIdx = knowledgeGraph.nodes.findIndex((n) => n.id === edge.target);
                    const x1 = 50 + (srcIdx % 4) * 110;
                    const y1 = 40 + Math.floor(srcIdx / 4) * 80;
                    const x2 = 50 + (tgtIdx % 4) * 110;
                    const y2 = 40 + Math.floor(tgtIdx / 4) * 80;

                    return (
                      <line
                        key={idx}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#cbd5e1"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                    );
                  })}

                  {/* Nodes */}
                  {knowledgeGraph.nodes.map((node, idx) => {
                    const cx = 50 + (idx % 4) * 110;
                    const cy = 40 + Math.floor(idx / 4) * 80;
                    const isSelected = selectedGraphNode === node.id;

                    return (
                      <g
                        key={node.id}
                        onClick={() => {
                          setSelectedGraphNode(node.id);
                          setQuery(`Explain ${node.label} on Page ${node.pageNumber}`);
                          handleExecuteRAG(`Explain ${node.label} on Page ${node.pageNumber}`);
                        }}
                        className="cursor-pointer group"
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isSelected ? 14 : 10}
                          className={`${
                            node.type === 'algorithm'
                              ? 'fill-purple-600'
                              : node.type === 'formula'
                              ? 'fill-emerald-600'
                              : node.type === 'theorem'
                              ? 'fill-amber-600'
                              : 'fill-blue-600'
                          } transition-all`}
                        />
                        <text
                          x={cx}
                          y={cy + 18}
                          textAnchor="middle"
                          className="text-[9px] font-extrabold fill-slate-700 select-none"
                        >
                          {node.label.length > 12 ? node.label.substring(0, 10) + '..' : node.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* COMMUNITIES LIST */}
              <div className="space-y-2">
                <div className="text-[11px] font-black uppercase text-slate-400">
                  Concept Communities & Summaries
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {knowledgeGraph.communities.map((comm) => (
                    <div
                      key={comm.id}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1"
                    >
                      <div className="text-xs font-black text-purple-900">{comm.name}</div>
                      <p className="text-[10.5px] text-slate-600 leading-tight font-medium">
                        {comm.summary}
                      </p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {comm.keyEntities.map((ke, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.2 bg-white border border-slate-200 text-slate-700 text-[9px] font-bold rounded"
                          >
                            {ke}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
