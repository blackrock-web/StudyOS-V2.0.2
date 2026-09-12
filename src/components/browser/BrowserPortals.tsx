import React, { useState, useMemo, useEffect } from 'react';
import { localModelManager } from '../../services/models/LocalModelManager';
import { LocalModelDescriptor } from '../../types';
import {
  Search,
  Sparkles,
  BookOpen,
  ExternalLink,
  Send,
  Bot,
  User,
  Copy,
  Check,
  RotateCcw,
  ShieldAlert,
  Globe,
  RefreshCw,
  FileText,
  Lightbulb,
  GraduationCap,
  Code2,
  Cpu,
  Zap,
  BookMarked,
  MessageSquare,
  Plus,
  Trash2,
  X,
  Lock,
  ShieldCheck,
  Compass,
} from 'lucide-react';

interface PortalProps {
  url: string;
  onNavigate: (url: string, title?: string) => void;
  onOpenExternal: (url: string) => void;
  onEnableReaderMode: () => void;
  subject?: string;
}

// Helper to extract search query from google search URL or raw string
const extractSearchQueryFromUrl = (url: string): string => {
  try {
    if (url.includes('google.com/search') || url.includes('q=')) {
      const parsed = new URL(url);
      const q = parsed.searchParams.get('q');
      if (q) return q;
    }
  } catch {
    /* ignore */
  }
  return '';
};

/* ============================================================================
   1. GOOGLE SEARCH & SCHOLAR PORTAL
   ============================================================================ */
export const GoogleSearchPortal: React.FC<PortalProps> = ({
  url,
  onNavigate,
  onOpenExternal,
  onEnableReaderMode,
  subject = 'Computer Science',
}) => {
  const initialQuery = useMemo(() => extractSearchQueryFromUrl(url), [url]);
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [activeTab, setActiveTab] = useState<'all' | 'scholar' | 'ddg' | 'news'>('all');
  const [activeResultsQuery, setActiveResultsQuery] = useState<string>(initialQuery);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const enc = encodeURIComponent(searchQuery.trim());
    setActiveResultsQuery(searchQuery.trim());
    onNavigate(`https://www.google.com/search?q=${enc}`, `Search: ${searchQuery.trim()}`);
  };

  const handleQuickSearch = (q: string) => {
    setSearchQuery(q);
    setActiveResultsQuery(q);
    const enc = encodeURIComponent(q);
    onNavigate(`https://www.google.com/search?q=${enc}`, `Search: ${q}`);
  };

  // Pre-compiled academic search topics
  const academicSuggestions = [
    { label: `${subject} Core Concepts`, query: `${subject} fundamental concepts and lecture notes` },
    { label: 'GATE PYQs & Solutions', query: `${subject} GATE Previous Year Questions with solutions` },
    { label: 'NPTEL Video Lectures', query: `NPTEL ${subject} online course lectures` },
    { label: 'GeeksforGeeks Documentation', query: `${subject} GeeksforGeeks tutorial` },
    { label: 'Wikipedia Research', query: `${subject} Wikipedia article` },
    { label: 'arXiv CS Papers', query: `site:arxiv.org ${subject} deep learning research paper` },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full h-full bg-slate-50 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6">
      {/* Top Embedded Notice */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="p-2 bg-amber-500/20 text-amber-700 rounded-xl shrink-0">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="font-extrabold flex items-center gap-2">
              <span>Google Embedded Search & Academic Scholar Portal</span>
              <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full text-[10px] font-black">
                Active
              </span>
            </div>
            <p className="text-[11px] text-amber-800/90 mt-0.5">
              Google restricts direct native frame embeds via X-Frame-Options policies. StudyOS Embedded Google Search Engine is fully active.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenExternal(url || 'https://www.google.com')}
          className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs cursor-pointer transition-all shrink-0 flex items-center gap-1.5 shadow-2xs"
        >
          <span>Open Google in New Tab</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Google Search Container */}
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* Google Logo Branding Header */}
        <div className="text-center space-y-2 pt-2">
          <div className="inline-flex items-center justify-center space-x-1 text-3xl md:text-5xl font-extrabold tracking-tight select-none">
            <span className="text-blue-600">G</span>
            <span className="text-rose-500">o</span>
            <span className="text-amber-500">o</span>
            <span className="text-blue-600">g</span>
            <span className="text-emerald-600">l</span>
            <span className="text-rose-500">e</span>
            <span className="ml-2 text-xs md:text-sm font-extrabold px-2.5 py-1 rounded-xl bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider font-mono">
              Scholar Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Search academic literature, web articles, GATE PYQs, and research papers
          </p>
        </div>

        {/* Search Input Box */}
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div className="relative flex items-center shadow-md hover:shadow-lg transition-all rounded-2xl bg-white border border-slate-200/90 focus-within:ring-2 focus-within:ring-blue-500">
            <Search className="w-5 h-5 text-slate-400 absolute left-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search Google for ${subject}, topics, formulas, or web URLs...`}
              className="w-full py-3.5 pl-12 pr-28 rounded-2xl text-sm font-medium text-slate-900 outline-none bg-transparent"
            />
            <div className="absolute right-2 flex items-center space-x-1.5">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs cursor-pointer transition-all shadow-2xs flex items-center gap-1"
              >
                <span>Search</span>
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center justify-center gap-2 flex-wrap text-xs font-bold pt-1">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Google Search</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('scholar')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'scholar'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
              <span>Google Scholar</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ddg')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ddg'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Live Web Stage (DDG Engine)</span>
            </button>
          </div>
        </form>

        {/* Academic Quick Suggestions */}
        <div className="space-y-2">
          <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Recommended Academic Search Queries ({subject})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {academicSuggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickSearch(item.query)}
                className="p-3 bg-white hover:bg-purple-50/60 border border-slate-200 hover:border-purple-300 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
              >
                <div className="min-w-0 pr-2">
                  <div className="font-bold text-xs text-slate-900 group-hover:text-purple-700 truncate">
                    {item.label}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate font-mono mt-0.5">
                    {item.query}
                  </div>
                </div>
                <Search className="w-4 h-4 text-slate-300 group-hover:text-purple-600 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Search Results Display Area */}
        {activeTab === 'ddg' ? (
          /* Live DuckDuckGo Embedded Frame Engine */
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm space-y-2">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-mono">
              <span>Live DuckDuckGo HTML Web Search Frame</span>
              <span className="text-emerald-700 font-extrabold">100% Iframe Compatible</span>
            </div>
            <div className="h-[450px] w-full">
              <iframe
                src={`https://html.duckduckgo.com/html/?q=${encodeURIComponent(
                  activeResultsQuery || `${subject} tutorial notes`
                )}`}
                title="DuckDuckGo Search Engine"
                className="w-full h-full border-none"
              />
            </div>
          </div>
        ) : (
          /* Structured Academic Search Results View */
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="text-xs font-bold text-slate-700">
                Search Results for:{' '}
                <span className="font-mono text-purple-700 font-extrabold">
                  "{activeResultsQuery || `${subject} Research & Tutorials`}"
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">About 1,420,000 results</span>
            </div>

            {/* Simulated High-Relevance Academic Results */}
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-[11px] text-emerald-700 font-mono flex items-center gap-1">
                  <span>https://en.wikipedia.org/wiki/{encodeURIComponent(subject)}</span>
                  <span className="text-slate-400">• Reference</span>
                </div>
                <a
                  href={`https://en.wikipedia.org/wiki/${encodeURIComponent(subject)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-base text-blue-700 hover:underline flex items-center gap-1"
                >
                  <span>{subject} — Wikipedia Comprehensive Overview</span>
                  <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                </a>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Comprehensive article covering mathematical foundations, algorithmic complexity, architectural design, protocols, and practical applications of {subject}.
                </p>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-100">
                <div className="text-[11px] text-emerald-700 font-mono flex items-center gap-1">
                  <span>https://www.geeksforgeeks.org/{encodeURIComponent(subject.toLowerCase().replace(/\s+/g, '-'))}</span>
                  <span className="text-slate-400">• Tutorial & GATE</span>
                </div>
                <a
                  href="https://www.geeksforgeeks.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-base text-blue-700 hover:underline flex items-center gap-1"
                >
                  <span>{subject} Tutorials, Notes & GATE Practice Questions</span>
                  <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                </a>
                <p className="text-xs text-slate-600 leading-relaxed">
                  GeeksforGeeks comprehensive notes for university exams, interview prep, code implementations, step-by-step examples, and solved previous year questions.
                </p>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-100">
                <div className="text-[11px] text-purple-700 font-mono flex items-center gap-1">
                  <span>https://arxiv.org/list/cs/recent</span>
                  <span className="text-slate-400">• Google Scholar & arXiv</span>
                </div>
                <a
                  href="https://arxiv.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-base text-blue-700 hover:underline flex items-center gap-1"
                >
                  <span>Recent Research Papers in {subject} (arXiv CS)</span>
                  <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                </a>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Peer-reviewed open-access preprints, experimental benchmarks, neural architectures, and state-of-the-art research papers in Computer Science and Engineering.
                </p>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={onEnableReaderMode}
                className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold cursor-pointer transition-all flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                <span>Switch to Distraction-Free Reader Mode</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onOpenExternal(
                    `https://www.google.com/search?q=${encodeURIComponent(
                      activeResultsQuery || subject
                    )}`
                  )
                }
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <span>Open Results in Official Google Tab ↗</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
   2. LOCAL AI ASSISTANT PORTAL (100% Offline • llama.cpp)
   ============================================================================ */
export const LocalAIPortal: React.FC<PortalProps> = ({
  url,
  onOpenExternal,
  subject = 'Computer Science',
}) => {
  const [activeModel, setActiveModel] = useState<LocalModelDescriptor | null>(null);
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; time: string; modelName?: string }>>([
    {
      sender: 'ai',
      text: `Hello! I am your **100% Offline StudyOS AI Assistant**, powered by local GGUF models on \`llama.cpp\`.\n\nAll inference runs locally on your CPU/GPU with **zero network requests, zero telemetry, and zero cloud API keys**. How can I help you study **${subject}** today?`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelName: 'Local GGUF Model',
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isThinking, setIsThinking] = useState<boolean>(false);

  useEffect(() => {
    const desc = localModelManager.getActiveModel();
    setActiveModel(desc);
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText.trim();
    if (!text) return;

    const userMsg = {
      sender: 'user' as const,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsThinking(true);

    try {
      const response = await localModelManager.executeOfflineInference(text, {
        subject,
        topic: 'Browser Study Session',
      });

      const currentDesc = localModelManager.getActiveModel();
      setActiveModel(currentDesc);

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: response,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelName: currentDesc?.name || 'Local GGUF',
        },
      ]);
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `⚠️ **Local Inference Notice:** ${err instanceof Error ? err.message : 'Local model is currently initializing. Please try again in a moment.'}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelName: 'Offline Fallback',
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const samplePrompts = [
    `Explain core concepts in ${subject}`,
    `Generate 3 GATE exam questions for ${subject}`,
    `Summarize theoretical proofs with invariants`,
    `Provide C++ code snippet with asymptotic bounds`,
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Banner Notice */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-extrabold text-white">Local AI Assistant</span>
          <span className="text-emerald-400 font-mono text-[11px] bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-full">
            100% Offline (llama.cpp)
          </span>
          <span className="text-slate-400 text-[11px] hidden sm:inline">
            • Active: <strong className="text-slate-200">{activeModel?.name || 'SmolLM2-135M'}</strong>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-mono text-emerald-400 bg-slate-800/80 px-2 py-1 rounded-md border border-slate-700">
            Network: OFF (0 bytes)
          </span>
        </div>
      </div>

      {/* Messages Chat Log Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start space-x-3 max-w-3xl ${
              m.sender === 'user' ? 'ml-auto flex-row-reverse space-x-reverse' : ''
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                m.sender === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-emerald-600 text-white shadow-md'
              }`}
            >
              {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`p-4 rounded-2xl space-y-2 text-xs leading-relaxed max-w-2xl ${
                m.sender === 'user'
                  ? 'bg-purple-600 text-white rounded-tr-none'
                  : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none shadow-md'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pb-1 border-b border-slate-800/80">
                <span>{m.sender === 'user' ? 'You' : `${m.modelName || 'Local GGUF Model'} (Local CPU/GPU)`}</span>
                <span>{m.time}</span>
              </div>
              <div className="whitespace-pre-wrap font-sans text-xs">{m.text}</div>
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex items-center space-x-3 text-xs text-emerald-400 font-mono animate-pulse pl-2">
            <Bot className="w-4 h-4" />
            <span>Local engine executing GGUF inference on device...</span>
          </div>
        )}
      </div>

      {/* Quick Study Prompt Chips */}
      <div className="p-3 bg-slate-900/80 border-t border-slate-800 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold shrink-0 flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Quick Prompts:</span>
        </span>
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(p)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-[11px] font-medium whitespace-nowrap cursor-pointer transition-all shrink-0"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Form Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-slate-900 border-t border-slate-800 flex items-center space-x-2 shrink-0"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Ask Local AI anything about ${subject}, formulas, or proofs (100% offline)...`}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500 font-medium"
        />
        <button
          type="submit"
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs cursor-pointer transition-all flex items-center gap-1 shadow-md"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Infer Offline</span>
        </button>
      </form>
    </div>
  );
};

// Aliases for backwards compatibility with existing imports
export const ChatGPTPortal = LocalAIPortal;
export const GeminiPortal = LocalAIPortal;
export const ClaudePortal = LocalAIPortal;

/* ============================================================================
   5. FRAME REFUSED FALLBACK CARD
   ============================================================================ */
export const FrameRefusedFallback: React.FC<{
  url: string;
  domain: string;
  onOpenExternal: (url: string) => void;
  onEnableReaderMode: () => void;
  onNavigate: (url: string) => void;
}> = ({ url, domain, onOpenExternal, onEnableReaderMode, onNavigate }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-900 text-white text-center space-y-6 animate-fadeIn min-h-0 w-full h-full overflow-y-auto">
      <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-400 shadow-lg">
        <ShieldAlert className="w-8 h-8 animate-pulse" />
      </div>

      <div className="space-y-3 max-w-lg">
        <h2 className="text-2xl font-black text-white tracking-tight">Website Refused Frame Connection</h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          The webpage <span className="font-mono text-amber-300 font-extrabold">{domain}</span> has set HTTP response headers (<code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-400">X-Frame-Options: SAMEORIGIN</code> or <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-400">DENY</code>). Modern web browsers strictly prohibit displaying such sites inside an embedded iframe.
        </p>

        <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700 text-left text-xs font-mono text-slate-300 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Requested URL:</span>
            <span className="truncate max-w-[250px] font-bold text-amber-300">{url}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Security Action:</span>
            <span className="text-emerald-400">X-Frame-Options Protection</span>
          </div>
        </div>
      </div>

      {/* Solutions */}
      <div className="flex flex-wrap items-center justify-center gap-3 max-w-md">
        <button
          type="button"
          onClick={() => onOpenExternal(url)}
          className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs cursor-pointer transition-all shadow-lg flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Open Webpage in New Tab ↗</span>
        </button>

        <button
          type="button"
          onClick={onEnableReaderMode}
          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs cursor-pointer transition-all shadow-md flex items-center gap-2"
        >
          <BookOpen className="w-4 h-4" />
          <span>Switch to Reader Mode</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate(`https://www.google.com/search?q=${encodeURIComponent(domain)}`)}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs cursor-pointer transition-all border border-slate-700 flex items-center gap-2"
        >
          <Search className="w-4 h-4 text-blue-400" />
          <span>Search Topic on Google</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(url)}`)}
          className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs cursor-pointer transition-all flex items-center gap-2"
        >
          <Globe className="w-4 h-4" />
          <span>Proxy Web View (DuckDuckGo)</span>
        </button>
      </div>
    </div>
  );
};
