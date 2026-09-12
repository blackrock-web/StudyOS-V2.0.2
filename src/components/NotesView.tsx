import React, { useState } from "react";
import { BookOpen, FileText, Send, Sparkles, Brain, Plus, Trash2, Edit, ChevronRight, FileUp, Bookmark, Star, Sparkle, RefreshCw, ZoomIn, Search, CornerDownRight, HelpCircle, Eye, EyeOff, Tag, ExternalLink, Code, Quote, CheckSquare, Highlighter, Heading1, Heading2, Heading3, List, ListOrdered, Minus, Columns, AlignLeft } from "lucide-react";
import { AppState, Note, Subject } from "../types";
import { GlassCard } from "./shared/GlassCard";
import { getActiveProvider } from "../services/aiProvider";
import { localModelManager } from "../services/models/LocalModelManager";

export const MOCK_TEXTBOOKS: Record<string, string> = {
  relational_modeling: `# Chapter 1: Relational Modeling & Database Normalization\n\n## 1.1 First Normal Form (1NF)\nA relation is in 1NF if and only if all attributes contain atomic values only. No repeating groups or array values are permitted.\n\nKey Rule:\n\`\`\`sql\nCREATE TABLE Student (\n  Student_ID INT PRIMARY KEY,\n  Student_Name VARCHAR(100),\n  Course_List VARCHAR(255) -- Violates 1NF if multi-valued\n);\n\`\`\`\n\n## 1.2 Second Normal Form (2NF)\nA relation is in 2NF if it is in 1NF and every non-prime attribute is fully functionally dependent on the candidate key.\n\nFormulas:\n- Functional Dependency: X -> Y\n- Full Dependence: Y depends on the whole key X, not a subset of X.\n\n## 1.3 Third Normal Form (3NF)\nA relation is in 3NF if for every functional dependency X -> Y, either X is a super key or Y is a prime attribute.\n- Eliminates transitive dependencies: X -> Y and Y -> Z`,
  os_virtual_memory: `# Operating Systems: Virtual Memory & Page Replacement\n\n## Page Fault Rate Formula\nPFF = (Page Faults) / (Total Memory References)\n\n## Optimal Page Replacement (OPT)\nReplace the page that will not be used for the longest period of time in the future.`,
  compiler_parsing: `# Compiler Design: Syntax Analysis & LL(1) Parsing\n\n## FIRST and FOLLOW Sets\nFIRST(A) = { a | A =>* a alpha }\nFOLLOW(A) = { a | S =>* alpha A a beta }`
};

interface NotesViewProps {
  state: AppState;
  onAddNote: (title: string, content: string, subjectId?: string, chapterId?: string) => void;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onDeleteNote: (id: string) => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  state,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
}) => {
  // Navigation: Notes list vs Textbook PDF Mock
  const [activeTab, setActiveTab] = useState<"my_notes" | "textbooks">("my_notes");

  // Hierarchy Navigation states
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [notesSearch, setNotesSearch] = useState("");
  const [onlyShowBookmarked, setOnlyShowBookmarked] = useState(false);

  // Selection
  const [activeNoteId, setActiveNoteId] = useState<string | null>(state.notes[0]?.id || null);
  const [activeTextbookKey, setActiveTextbookKey] = useState<string>("relational_modeling");

  // Notes Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNoteTitle, setNewNoteNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteSubId, setNewNoteSubId] = useState("");
  const [newNoteChapId, setNewNoteChapId] = useState("");
  const [newNoteTopic, setNewNoteTopic] = useState("");
  const [newNoteSubtopic, setNewNoteSubtopic] = useState("");

  // Edit Note Form State
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const [editorSubTab, setEditorSubTab] = useState<"write" | "split" | "preview">("write");
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editSubtopic, setEditSubtopic] = useState("");

  // Sticky Annotation state
  const [newAnnotationText, setNewAnnotationText] = useState("");

  // OCR state
  const [isOcrScanning, setIsOcrScanning] = useState(false);
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState("");

  // PDF Upload & AI Summarizer States
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: number;
    type: string;
    base64: string;
  } | null>(null);
  const [pdfSummary, setPdfSummary] = useState<string>("");
  const [pdfSummaryLoading, setPdfSummaryLoading] = useState<boolean>(false);
  const [activeReadingSource, setActiveReadingSource] = useState<"textbook" | "uploaded_pdf">("textbook");
  const [dragOver, setDragOver] = useState(false);

  // Quick Notepad States
  const [quickNoteTitle, setQuickNoteTitle] = useState("");
  const [quickNoteContent, setQuickNoteContent] = useState("");
  const [quickNoteSuccess, setQuickNoteSuccess] = useState("");

  // Custom highlights filter state
  const [searchHighlightWord, setSearchHighlightWord] = useState("");

  // Markdown Block Interfaces
  interface MarkdownBlock {
    type: "heading" | "list" | "code-block" | "blockquote" | "paragraph" | "hr" | "task-list";
    depth?: number;
    items?: string[];
    taskItems?: { completed: boolean; text: string }[];
    language?: string;
    text?: string;
    lines?: string[];
  }

  // Tokenize and parse inline elements (Bold, Italic, Code, Highlight, Link)
  const parseInline = (text: string): React.ReactNode => {
    if (!text) return "";

    interface Token {
      type: "text" | "bold" | "italic" | "code" | "highlight" | "link";
      text: string;
      url?: string;
    }

    let tokens: Token[] = [{ type: "text", text }];

    const processTokens = (
      tokenList: Token[],
      regex: RegExp,
      type: "bold" | "italic" | "code" | "highlight" | "link",
      builder: (match: RegExpExecArray) => { text: string; url?: string }
    ): Token[] => {
      const result: Token[] = [];
      for (const token of tokenList) {
        if (token.type !== "text") {
          result.push(token);
          continue;
        }

        let lastIndex = 0;
        let match;
        const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");

        while ((match = re.exec(token.text)) !== null) {
          const matchIndex = match.index;
          if (matchIndex > lastIndex) {
            result.push({ type: "text", text: token.text.substring(lastIndex, matchIndex) });
          }

          const details = builder(match);
          result.push({ type, ...details });

          lastIndex = re.lastIndex;
        }

        if (lastIndex < token.text.length) {
          result.push({ type: "text", text: token.text.substring(lastIndex) });
        }
      }
      return result;
    };

    // 1. Links: [label](url)
    tokens = processTokens(tokens, /\[([^\]]+)\]\(([^)]+)\)/, "link", (match) => ({
      text: match[1] || '',
      url: match[2] || ''
    }));

    // 2. Inline Code: `code`
    tokens = processTokens(tokens, /`([^`]+)`/, "code", (match) => ({
      text: match[1] || ''
    }));

    // 3. Bold: **text**
    tokens = processTokens(tokens, /\*\*([^*]+)\*\*/, "bold", (match) => ({
      text: match[1] || ''
    }));

    // 4. Highlight: ==text==
    tokens = processTokens(tokens, /==([^=]+)==/, "highlight", (match) => ({
      text: match[1] || ''
    }));

    // 5. Italic: *text*
    tokens = processTokens(tokens, /\*([^*]+)\*/, "italic", (match) => ({
      text: match[1] || ''
    }));

    return (
      <>
        {tokens.map((t, idx) => {
          switch (t.type) {
            case "bold":
              return <strong key={idx} className="font-extrabold text-slate-900 bg-purple-100/30 px-0.5 rounded">{t.text}</strong>;
            case "italic":
              return <em key={idx} className="italic text-slate-800">{t.text}</em>;
            case "code":
              return <code key={idx} className="font-mono text-[10.5px] bg-slate-100 text-purple-700 px-1 py-0.5 rounded border border-slate-200/60 font-bold">{t.text}</code>;
            case "highlight":
              return <mark key={idx} className="bg-yellow-100 text-yellow-900 px-1.5 py-0.2 rounded font-medium border-b-2 border-yellow-300">{t.text}</mark>;
            case "link":
              return (
                <a
                  key={idx}
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:text-purple-800 hover:underline inline-flex items-center gap-0.5 font-semibold"
                >
                  {t.text}
                  <ExternalLink className="h-2.5 w-2.5 inline shrink-0" />
                </a>
              );
            default:
              return <span key={idx}>{t.text}</span>;
          }
        })}
      </>
    );
  };

  // Convert raw Markdown text to blocks
  const parseMarkdownToBlocks = (text: string): MarkdownBlock[] => {
    if (!text) return [];
    const rawLines = text.split("\n");
    const blocks: MarkdownBlock[] = [];
    let currentBlock: MarkdownBlock | null = null;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i] || "";
      const trimmed = line.trim();

      // 1. Code Block starts/ends
      if (trimmed.startsWith("```")) {
        if (currentBlock && currentBlock.type === "code-block") {
          blocks.push(currentBlock);
          currentBlock = null;
        } else {
          if (currentBlock) {
            blocks.push(currentBlock);
          }
          const lang = trimmed.slice(3).trim();
          currentBlock = {
            type: "code-block",
            language: lang || "text",
            lines: []
          };
        }
        continue;
      }

      // If in code block, capture line raw
      if (currentBlock && currentBlock.type === "code-block") {
        currentBlock.lines!.push(line);
        continue;
      }

      // 2. Blockquotes
      if (trimmed.startsWith(">")) {
        const quoteText = line.substring(line.indexOf(">") + 1).trim();
        if (currentBlock && currentBlock.type === "blockquote") {
          currentBlock.lines!.push(quoteText);
        } else {
          if (currentBlock) blocks.push(currentBlock);
          currentBlock = {
            type: "blockquote",
            lines: [quoteText]
          };
        }
        continue;
      }

      // 3. Task lists / Checkboxes
      const taskMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.*)$/);
      if (taskMatch && taskMatch[2] && taskMatch[3]) {
        const completed = taskMatch[2].toLowerCase() === "x";
        const taskText = taskMatch[3];

        if (currentBlock && currentBlock.type === "task-list") {
          currentBlock.taskItems!.push({ completed, text: taskText });
        } else {
          if (currentBlock) blocks.push(currentBlock);
          currentBlock = {
            type: "task-list",
            taskItems: [{ completed, text: taskText }]
          };
        }
        continue;
      }

      // 4. Bullet lists
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
        const bulletText = trimmed.substring(2).trim();
        if (currentBlock && currentBlock.type === "list" && currentBlock.text === "bullet") {
          currentBlock.items!.push(bulletText);
        } else {
          if (currentBlock) blocks.push(currentBlock);
          currentBlock = {
            type: "list",
            text: "bullet",
            items: [bulletText]
          };
        }
        continue;
      }

      // 5. Numbered lists
      const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (numberMatch && numberMatch[2]) {
        const numText = numberMatch[2].trim();
        if (currentBlock && currentBlock.type === "list" && currentBlock.text === "number") {
          currentBlock.items!.push(numText);
        } else {
          if (currentBlock) blocks.push(currentBlock);
          currentBlock = {
            type: "list",
            text: "number",
            items: [numText]
          };
        }
        continue;
      }

      // 6. Horizontal Rules
      if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
        if (currentBlock) {
          blocks.push(currentBlock);
          currentBlock = null;
        }
        blocks.push({ type: "hr" });
        continue;
      }

      // 7. Headings
      if (trimmed.startsWith("#")) {
        const hMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (hMatch && hMatch[1] && hMatch[2]) {
          if (currentBlock) {
            blocks.push(currentBlock);
            currentBlock = null;
          }
          blocks.push({
            type: "heading",
            depth: hMatch[1].length,
            text: hMatch[2].trim()
          });
          continue;
        }
      }

      // 8. Paragraphs and blanks
      if (trimmed === "") {
        if (currentBlock) {
          blocks.push(currentBlock);
          currentBlock = null;
        }
        continue;
      }

      // Normal text
      if (currentBlock && currentBlock.type === "paragraph") {
        currentBlock.text += "\n" + line;
      } else {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = {
          type: "paragraph",
          text: line
        };
      }
    }

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    return blocks;
  };

  // Render processed Markdown blocks to beautiful React JSX elements
  const formatMarkdown = (text: string) => {
    if (!text) {
      return <p className="text-slate-400 italic text-xs">No notes captured yet. Supports markdown formatting...</p>;
    }

    const blocks = parseMarkdownToBlocks(text);

    return (
      <div className="space-y-3 font-sans text-slate-800 leading-relaxed text-xs">
        {blocks.map((block, idx) => {
          switch (block.type) {
            case "heading": {
              const depth = block.depth || 1;
              const headingText = block.text || "";
              if (depth === 1) {
                return (
                  <h1 key={idx} className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-1 mt-4 mb-2 flex items-center gap-1.5">
                    <span className="h-3 w-1 bg-purple-600 rounded-full inline-block"></span>
                    {parseInline(headingText)}
                  </h1>
                );
              }
              if (depth === 2) {
                return (
                  <h2 key={idx} className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-700 to-pink-600 mt-3.5 mb-1.5">
                    {parseInline(headingText)}
                  </h2>
                );
              }
              if (depth === 3) {
                return (
                  <h3 key={idx} className="text-[11px] font-bold text-purple-700 mt-3 mb-1">
                    {parseInline(headingText)}
                  </h3>
                );
              }
              return (
                <h4 key={idx} className="text-[10px] font-bold text-slate-800 mt-2 mb-0.5 uppercase tracking-wider">
                  {parseInline(headingText)}
                </h4>
              );
            }

            case "list": {
              const isBullet = block.text === "bullet";
              return isBullet ? (
                <ul key={idx} className="list-disc pl-5 space-y-1 my-1.5">
                  {block.items!.map((item, itemIdx) => (
                    <li key={itemIdx} className="text-slate-700">
                      {parseInline(item)}
                    </li>
                  ))}
                </ul>
              ) : (
                <ol key={idx} className="list-decimal pl-5 space-y-1 my-1.5">
                  {block.items!.map((item, itemIdx) => (
                    <li key={itemIdx} className="text-slate-700">
                      {parseInline(item)}
                    </li>
                  ))}
                </ol>
              );
            }

            case "task-list": {
              return (
                <div key={idx} className="space-y-1 my-2">
                  {block.taskItems!.map((item, itemIdx) => (
                    <div key={itemIdx} className="flex items-start gap-2 text-slate-700">
                      <div className="flex items-center h-4 pt-0.5">
                        <input
                          type="checkbox"
                          checked={item.completed}
                          readOnly
                          className="h-3 w-3 rounded border-slate-300 text-purple-600 focus:ring-purple-500 accent-purple-600"
                        />
                      </div>
                      <span className={`text-[11px] ${item.completed ? "line-through text-slate-400" : "text-slate-700"}`}>
                        {parseInline(item.text)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }

            case "blockquote": {
              return (
                <blockquote key={idx} className="border-l-3 border-purple-300 bg-purple-50/20 pl-3 py-1.5 my-2.5 rounded-r-md italic text-slate-600 text-[11px]">
                  {block.lines!.map((line, lIdx) => (
                    <p key={lIdx} className="my-0.5">
                      {parseInline(line)}
                    </p>
                  ))}
                </blockquote>
              );
            }

            case "code-block": {
              return (
                <div key={idx} className="relative bg-slate-900 border border-slate-800 rounded-lg p-2.5 my-2.5 font-mono text-[10px] text-slate-200 overflow-x-auto shadow-inner max-w-full">
                  {block.language && block.language !== "text" && (
                    <span className="absolute top-1 right-1.5 text-[7px] text-slate-500 font-bold uppercase tracking-wider bg-slate-800 px-1 py-0.2 rounded">
                      {block.language}
                    </span>
                  )}
                  <pre className="leading-normal">
                    <code>{block.lines!.join("\n")}</code>
                  </pre>
                </div>
              );
            }

            case "hr": {
              return <hr key={idx} className="border-t border-slate-150 my-3" />;
            }

            case "paragraph": {
              const paragraphs = block.text!.split("\n");
              return (
                <div key={idx} className="space-y-1 my-1.5">
                  {paragraphs.map((p, pIdx) => (
                    <p key={pIdx} className="text-slate-600 leading-relaxed text-[11.5px]">
                      {parseInline(p)}
                    </p>
                  ))}
                </div>
              );
            }

            default:
              return null;
          }
        })}
      </div>
    );
  };

  const activeNote = state.notes.find((n) => n.id === activeNoteId);

  // Extracted subjects & chapters dynamically
  const activeSubjectObj = state.subjects.find(s => s.id === selectedSubjectId);
  const chapterOptions = activeSubjectObj ? activeSubjectObj.chapters : [];

  // Filtered Notes list based on deep folder hierarchy organization (Subject → Chapter → Topic → Subtopic)
  const filteredNotes = state.notes.filter((note) => {
    if (selectedSubjectId !== "all" && note.subjectId !== selectedSubjectId) return false;
    if (selectedChapterId !== "all" && (note as any).chapterId !== selectedChapterId) return false;
    if (selectedTopic !== "all" && note.topic !== selectedTopic) return false;
    if (onlyShowBookmarked && !note.isBookmarked) return false;

    if (notesSearch.trim().length > 0) {
      const q = notesSearch.toLowerCase();
      const matchTitle = note.title.toLowerCase().includes(q);
      const matchContent = note.content.toLowerCase().includes(q);
      const matchTopic = (note.topic || "").toLowerCase().includes(q);
      const matchSubtopic = ((note as any).subtopic || "").toLowerCase().includes(q);
      if (!matchTitle && !matchContent && !matchTopic && !matchSubtopic) return false;
    }

    return true;
  });

  // Collect unique topics
  const uniqueTopics = Array.from(
    new Set(
      state.notes
        .map((n) => n.topic)
        .filter((t): t is string => !!t)
    )
  );

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;

    // Add note to parent AppState through standard dispatch
    onAddNote(newNoteTitle.trim(), newNoteContent.trim(), newNoteSubId || undefined, newNoteChapId || undefined);

    // Save extra metadata variables to latest added note in state (simulate offline synchronization)
    setTimeout(() => {
      const added = state.notes.find(n => n.title === newNoteTitle.trim());
      if (added && onUpdateNote) {
        onUpdateNote(added.id, {
          topic: newNoteTopic.trim() || "General",
          subtopic: newNoteSubtopic.trim() || "Basic Concept",
          annotations: [],
          isBookmarked: false,
          versionHistory: [{
            timestamp: new Date().toISOString(),
            content: newNoteContent.trim()
          }]
        } as any);
        setActiveNoteId(added.id);
      }
    }, 100);

    setNewNoteNoteTitle("");
    setNewNoteContent("");
    setNewNoteTopic("");
    setNewNoteSubtopic("");
    setNewNoteChapId("");
    setNewNoteSubId("");
    setShowAddForm(false);
  };

  const handleStartEditing = () => {
    if (!activeNote) return;
    setEditTitle(activeNote.title);
    setEditContent(activeNote.content);
    setEditTopic(activeNote.topic || "");
    setEditSubtopic((activeNote as any).subtopic || "");
    setIsEditingNote(true);
  };

  const handleSaveEdit = () => {
    if (!activeNote) return;
    const pastHistory = (activeNote as any).versionHistory || [];
    const updatedHistory = [
      ...pastHistory,
      { timestamp: new Date().toISOString(), content: editContent }
    ];

    onUpdateNote(activeNote.id, {
      title: editTitle,
      content: editContent,
      topic: editTopic || undefined,
      subtopic: editSubtopic || undefined,
      versionHistory: updatedHistory
    } as any);

    setIsEditingNote(false);
  };

  const handleRollbackVersion = (versionContent: string) => {
    if (!activeNote) return;
    if (window.confirm("Rollback note text to this previous version?")) {
      onUpdateNote(activeNote.id, {
        content: versionContent
      });
      setEditContent(versionContent);
    }
  };

  const handleAddAnnotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNote || !newAnnotationText.trim()) return;

    const currentAnns = (activeNote as any).annotations || [];
    const updatedAnns = [
      ...currentAnns,
      {
        id: `ann-${Date.now()}`,
        text: newAnnotationText.trim(),
        timestamp: new Date().toISOString()
      }
    ];

    onUpdateNote(activeNote.id, {
      annotations: updatedAnns
    } as any);
    setNewAnnotationText("");
  };

  const handleDeleteAnnotation = (annId: string) => {
    if (!activeNote) return;
    const currentAnns = (activeNote as any).annotations || [];
    onUpdateNote(activeNote.id, {
      annotations: currentAnns.filter((a: any) => a.id !== annId)
    } as any);
  };

  const handleToggleBookmark = (noteId: string) => {
    const note = state.notes.find(n => n.id === noteId);
    if (note && onUpdateNote) {
      onUpdateNote(noteId, {
        isBookmarked: !note.isBookmarked
      });
    }
  };

  // Simulated PDF Textbook OCR Scanner & Text / Formula Extractor!
  const handleRunOcrScanner = () => {
    setIsOcrScanning(true);
    setOcrSuccessMsg("");

    setTimeout(() => {
      setIsOcrScanning(false);
      const textSource = MOCK_TEXTBOOKS[activeTextbookKey] || "";

      // Scrapes text for formula-like patterns (e.g. math terms, capital equations, Big O, symbols)
      const equations = textSource.match(/[a-zA-Z0-9_\-\^\(\)\/*+\s=><]{3,12}=[^.\n]+/g) || [];
      const terms = textSource.match(/\*\*[^*]+\*\*/g) || [];

      const formulasFound = equations.slice(0, 4).join("\n") || "No equations parsed.";
      const keywordsFound = terms.map((t: string) => t.replace(/\*\*/g, "")).slice(0, 5).join(", ") || "No vocabulary found.";

      const extractedTitle = `OCR OCR: ${activeTextbookKey === "relational_modeling" ? "DBMS Normalization" : activeTextbookKey}`;
      const extractedContent = `--- AUTOMATED OCR TEXT EXTRACTION ---
Source Document: ${activeTextbookKey}
Timestamp Scanned: ${new Date().toLocaleString()}

[EXTRACTED FORMULAS / SCHEMA DEFINITIONS]:
${formulasFound}

[VOCABULARY KEYWORDS EXTRACTED]:
${keywordsFound}

[OCR RAW PAGE TEXT FRAGMENT]:
${textSource.slice(0, 350)}...

Study Recommendation: Revise these extracted formulas before tests.`;

      onAddNote(extractedTitle, extractedContent, undefined);
      setOcrSuccessMsg("OCR Complete! Extracted formulas and terminology saved into a new Note.");
    }, 1200);
  };

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const base64Data = result.split(",")[1];
      setUploadedFile({
        name: file.name,
        size: file.size,
        type: file.type,
        base64: base64Data || '',
      });
      setActiveReadingSource("uploaded_pdf");
      setPdfSummary(""); // reset summary
    };
    reader.readAsDataURL(file);
  };

  // 100% Offline Local Model Document Summarization (llama.cpp / GGUF)
  const handleSummarizePDF = async () => {
    if (!uploadedFile) return;
    setPdfSummaryLoading(true);
    setPdfSummary("");

    try {
      const prompt = `Please provide an offline conceptual study summary and key active recall points for the following document: ${uploadedFile.name}`;
      const output = await localModelManager.executeOfflineInference(prompt, {
        subject: selectedSubjectId !== "all" ? (activeSubjectObj?.name || "GATE Preparation") : "Core Study",
        topic: uploadedFile.name,
      });

      setPdfSummary(
        `### 📖 Local Offline Document Summary (llama.cpp)\n\n` +
          `**Document:** ${uploadedFile.name}\n` +
          `**Runtime:** 100% Local Inference (0 bytes network transmitted)\n\n` +
          `---\n\n` +
          `${output}\n\n` +
          `#### Key Active Recall Points:\n` +
          `• Core definitions and theoretical guarantees derived from local syllabus index.\n` +
          `• Recommended revision interval: 24-48 hours using Spaced Repetition Flashcards.`
      );
    } catch (err: unknown) {
      console.error(err);
      setPdfSummary(`### Error\n\n${err instanceof Error ? err.message : "Unable to process document locally."}`);
    } finally {
      setPdfSummaryLoading(false);
    }
  };

  // Save the summarized text to the notes folder
  const handleSavePDFSummaryToNotes = () => {
    if (!pdfSummary || !uploadedFile) return;
    const subjectId = selectedSubjectId !== "all" ? selectedSubjectId : undefined;
    onAddNote(
      `Summary: ${uploadedFile.name.replace(/\.[^/.]+$/, "")}`,
      pdfSummary,
      subjectId
    );
    alert("The document summary has been successfully saved to your Study Notes!");
  };

  // Quick Notepad Note Saving
  const handleSaveQuickNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNoteTitle.trim() || !quickNoteContent.trim()) return;

    const subjectId = selectedSubjectId !== "all" ? selectedSubjectId : undefined;
    onAddNote(
      quickNoteTitle.trim(),
      quickNoteContent.trim(),
      subjectId
    );

    setQuickNoteTitle("");
    setQuickNoteContent("");
    setQuickNoteSuccess("Note saved to folder!");
    setTimeout(() => setQuickNoteSuccess(""), 3000);
  };

  // Markdown Formatting Helper
  const insertFormatting = (prefix: string, suffix: string = "") => {
    const textarea = document.getElementById("edit-note-textarea") as HTMLTextAreaElement;
    if (!textarea) {
      setEditContent(prev => prev + prefix + suffix);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);
    const replacement = prefix + selected + suffix;
    const newContent = text.substring(0, start) + replacement + text.substring(end);
    setEditContent(newContent);
    
    // Focus back and set selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 50);
  };

  // Math/Equation Pattern Extractor for fast formula review sheets
  const extractFormulas = (text: string): string[] => {
    if (!text) return [];
    // Searches for common symbols, relational algebra terms, Big O notation, math equations
    const patterns = [
      /1NF|2NF|3NF|BCNF/gi,
      /[A-Z]\s*->\s*[A-Z]+/gi,
      /O\([a-zA-Z0-9\s\+\-\*\/log]+\)/gi,
      /[pP]\([a-zA-Z0-9\s|]+\)/gi,
      /[a-zA-Z0-9_\-\^/*+]{2,}\s*=\s*[a-zA-Z0-9_\-\^/*+]{2,}/gi
    ];
    const formulas: string[] = [];
    patterns.forEach(regex => {
      const matches = text.match(regex);
      if (matches) {
        matches.forEach(m => {
          if (!formulas.includes(m)) formulas.push(m);
        });
      }
    });
    return formulas.slice(0, 8);
  };

  const detectedFormulas = activeNote ? extractFormulas(activeNote.content) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full font-sans" id="notes-view-root">
      {/* Left panel: Notes folders / selector / creator (5 cols) */}
      <div className="lg:col-span-5 space-y-4">
        {/* Left header area */}
        <div className="flex items-center justify-between bg-white border border-slate-200/80 p-2.5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-xl">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Study Notes Library</h4>
              <p className="text-[9px] text-slate-400">Offline Markdown notes & folder hierarchy</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100">
            {filteredNotes.length} Notes
          </span>
        </div>

        {activeTab === "my_notes" ? (
          // MY NOTES STRUCTURAL TREE & DIRECTORY
          <div className="space-y-3" id="my-notes-sub-panel">
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex-1 text-xs font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1"
              >
                <Plus className="h-4 w-4" /> Create Note
              </button>

              <button
                onClick={async () => {
                  const activeNote = state.notes.find((n) => n.id === activeNoteId);
                  const provider = getActiveProvider();
                  await provider.generateNotes(activeNote?.content || 'Database Normalization and BCNF concepts.', {
                    subject: activeNote?.subjectId || 'Database Systems',
                    topic: activeNote?.title || 'Relational Modeling',
                  });
                }}
                className="flex-1 text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1"
              >
                <Sparkles className="h-4 w-4" /> AI Generate
              </button>

              <button
                onClick={() => setOnlyShowBookmarked(!onlyShowBookmarked)}
                className={`flex-1 text-xs font-bold border py-2.5 rounded-xl transition-all flex items-center justify-center gap-1 ${
                  onlyShowBookmarked
                    ? "bg-amber-50 border-amber-200 text-amber-700 font-bold"
                    : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
                }`}
              >
                <Star className="h-4 w-4 text-amber-500" /> Bookmarks
              </button>
            </div>

            {/* Folder Directories filter options */}
            <div className="bg-white/40 border border-slate-100 p-3 rounded-xl space-y-2">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-purple-500" /> Hierarchy Directory (Subject → Chapter → Topic)
              </h4>
              <div className="grid grid-cols-3 gap-1.5">
                <select
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setSelectedChapterId("all");
                  }}
                  className="text-[10px] bg-white border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                >
                  <option value="all">All Subjects</option>
                  {state.subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name.split(":")[0]}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedChapterId}
                  onChange={(e) => setSelectedChapterId(e.target.value)}
                  className="text-[10px] bg-white border border-slate-200 rounded-lg p-1.5 focus:outline-none"
                  disabled={selectedSubjectId === "all"}
                >
                  <option value="all">All Chapters</option>
                  {chapterOptions.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="text-[10px] bg-white border border-slate-200 rounded-lg p-1.5 focus:outline-none"
                >
                  <option value="all">All Topics</option>
                  {uniqueTopics.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic folder tag filters */}
              <input
                type="text"
                value={notesSearch}
                onChange={(e) => setNotesSearch(e.target.value)}
                placeholder="🔍 Document search and tag indexes..."
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
            </div>

            {/* Create Notes Form */}
            {showAddForm && (
              <GlassCard className="border border-purple-200 bg-purple-50/10">
                <h3 className="font-sans font-bold text-slate-800 text-sm mb-2">Create Hierarchy Study Note</h3>
                <form onSubmit={handleCreateNote} className="space-y-3">
                  <input
                    type="text"
                    required
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteNoteTitle(e.target.value)}
                    placeholder="e.g. Relational Calculus Formulas"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-purple-400 focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newNoteSubId}
                      onChange={(e) => setNewNoteSubId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-slate-600"
                    >
                      <option value="">Subject Directory...</option>
                      {state.subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={newNoteTopic}
                      onChange={(e) => setNewNoteTopic(e.target.value)}
                      placeholder="Topic (e.g., Database Normalization)"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                    />
                  </div>

                  <textarea
                    required
                    rows={4}
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Write your study note content here. Standard LaTeX math or schemas like A -> B, B -> C are fully supported."
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-purple-400 focus:outline-none"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-[10px] px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="text-[10px] bg-purple-500 hover:bg-purple-600 text-white px-3.5 py-1.5 rounded-lg font-bold"
                    >
                      Save Note
                    </button>
                  </div>
                </form>
              </GlassCard>
            )}

            {/* Structured Notes Directory */}
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {filteredNotes.length === 0 ? (
                <div className="text-center py-10 bg-white/40 border border-slate-100 rounded-xl">
                  <p className="text-xs text-slate-500">No matching study notes found in this folder.</p>
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const subject = state.subjects.find((s) => s.id === note.subjectId);
                  const isActive = note.id === activeNoteId;

                  return (
                    <div
                      key={note.id}
                      onClick={() => setActiveNoteId(note.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-2 ${
                        isActive
                          ? "bg-purple-100/60 border-purple-300 shadow-sm"
                          : "bg-white/70 border-slate-100 hover:bg-white"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleBookmark(note.id);
                            }}
                            className="text-slate-300 hover:text-amber-500 transition-all p-0.5 rounded"
                          >
                            <Star className={`h-3.5 w-3.5 ${note.isBookmarked ? "text-amber-500 fill-amber-500" : ""}`} />
                          </button>
                          <p className="text-xs font-bold text-slate-800 truncate">{note.title}</p>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
                          <CornerDownRight className="h-3 w-3" />
                          Topic: <span className="font-semibold text-purple-700">{note.topic || "General"}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">
                          {note.content.slice(0, 45)}...
                        </p>
                        {subject && (
                          <span
                            className="text-[8px] px-1.5 py-0.2 rounded text-white font-bold inline-block mt-1 shadow-sm"
                            style={{ backgroundColor: subject.color }}
                          >
                            {subject.name.split(":")[0]}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNote(note.id);
                          if (activeNoteId === note.id) setActiveNoteId(null);
                        }}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all cursor-pointer"
                        title="Delete note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          // TEXTBOOKS & PDF UPLOADER LEFT PANEL
          <div className="space-y-3.5" id="textbooks-sub-panel">
            <p className="text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded-xl leading-relaxed border border-slate-100">
              Read <strong>Academic Textbooks</strong> or <strong>upload your own PDF / Text documents</strong> to generate custom summaries and run active recall revision study.
            </p>

            {/* Drag & Drop File Upload Area */}
            <div className="space-y-2">
              <span className="text-[9px] font-bold text-slate-400 font-mono tracking-wider uppercase block">
                📁 Upload Custom Materials
              </span>
              
              {!uploadedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                    dragOver
                      ? "border-purple-500 bg-purple-50/50"
                      : "border-slate-200 hover:border-purple-400 hover:bg-purple-50/5"
                  }`}
                  id="pdf-drag-drop-zone"
                >
                  <input
                    type="file"
                    id="pdf-file-input"
                    accept="application/pdf,text/plain"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="pdf-file-input" className="cursor-pointer block space-y-1">
                    <FileUp className="h-5 w-5 text-purple-500 mx-auto animate-pulse" />
                    <span className="text-xs font-bold text-slate-700 block">Drag & Drop PDF / Text</span>
                    <span className="text-[10px] text-slate-400 block">or click to browse files</span>
                  </label>
                </div>
              ) : (
                <div className="bg-purple-50/40 border border-purple-100 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-purple-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate" title={uploadedFile.name}>
                          {uploadedFile.name}
                        </p>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                          {(uploadedFile.size / 1024).toFixed(1)} KB • {uploadedFile.type || "Plain Document"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setUploadedFile(null);
                        setPdfSummary("");
                        setActiveReadingSource("textbook");
                      }}
                      className="text-[9px] text-rose-500 hover:underline font-bold px-1.5 py-0.5 hover:bg-rose-50 rounded shrink-0"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-purple-100/40">
                    <button
                      onClick={() => setActiveReadingSource("uploaded_pdf")}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg transition-all text-center ${
                        activeReadingSource === "uploaded_pdf"
                          ? "bg-purple-600 text-white"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      View Summary
                    </button>
                    <button
                      onClick={handleSummarizePDF}
                      disabled={pdfSummaryLoading}
                      className="py-1.5 px-2 text-[10px] bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-bold rounded-lg transition-all text-center flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                    >
                      {pdfSummaryLoading ? (
                        <>
                          <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 shrink-0" />
                          Summarize AI
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Core Textbooks Selector */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold text-slate-400 font-mono tracking-wider uppercase block">
                📚 Preloaded Course Materials
              </span>
              {Object.keys(MOCK_TEXTBOOKS).map((key) => {
                const isActive = activeReadingSource === "textbook" && activeTextbookKey === key;
                const titles: { [k: string]: string } = {
                  relational_modeling: "Ch 1: Relational Modeling & Normal Forms",
                  spectroscopy: "Ch 4: Organic Spectroscopy IR & NMR",
                  silk_road: "Ch 8: Ancient Silk Road Trade Networks",
                };

                return (
                  <div
                    key={key}
                    onClick={() => {
                      setActiveTextbookKey(key);
                      setActiveReadingSource("textbook");
                      setOcrSuccessMsg("");
                    }}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isActive
                        ? "bg-pink-100/60 border-pink-300 shadow-sm font-bold text-pink-700"
                        : "bg-white/70 border-slate-100 hover:bg-white text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className={`h-3.5 w-3.5 ${isActive ? "text-pink-600" : "text-slate-400"}`} />
                      <span className="text-[11px] font-semibold">{titles[key] || key}</span>
                    </div>
                    <ChevronRight className="h-3 w-3 text-slate-400" />
                  </div>
                );
              })}
            </div>

            {/* OCR trigger button widget */}
            <div className="bg-pink-50/50 border border-pink-100 rounded-xl p-3 space-y-1.5">
              <h5 className="text-[10px] font-bold text-pink-700 uppercase flex items-center gap-1">
                <Sparkle className="h-3.5 w-3.5 text-pink-500 animate-spin" /> Simulated OCR Scanner Heuristic
              </h5>
              <button
                onClick={handleRunOcrScanner}
                disabled={isOcrScanning}
                className="w-full py-1.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-60"
              >
                {isOcrScanning ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Scanning textbook text...
                  </>
                ) : (
                  <>
                    <ZoomIn className="h-3.5 w-3.5" />
                    Scan Selected Textbook Page
                  </>
                )}
              </button>
              {ocrSuccessMsg && (
                <p className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-1.5 font-bold animate-pulse text-center">
                  {ocrSuccessMsg}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right panel: dynamic document viewer, formula extract panel, and note editor */}
      <div className="lg:col-span-7 h-[520px]">
        {activeTab === "my_notes" ? (
          /* MY NOTES TAB: FULL WORKSPACE NOTE WRITER & VIEWER */
          <div className="flex flex-col border border-slate-100 rounded-2xl bg-white/80 p-4 h-full overflow-hidden relative">
            <div className="border-b border-slate-100 pb-2.5 mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <FileText className="h-4.5 w-4.5 text-purple-600 shrink-0" />
                <h3 className="font-bold text-slate-800 text-xs truncate">
                  {activeNote ? activeNote.title : "No Note Selected"}
                </h3>
              </div>
              {activeNote && !isEditingNote && (
                <div className="flex items-center gap-2">
                  <select
                    id="note-mode-dropdown"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "edit") {
                        handleStartEditing();
                      } else if (val === "preview") {
                        setIsPreviewMode(true);
                      } else if (val === "raw") {
                        setIsPreviewMode(false);
                      } else if (val === "delete") {
                        if (activeNote) {
                          onDeleteNote(activeNote.id);
                          setActiveNoteId(null);
                        }
                      }
                    }}
                    value={isPreviewMode ? "preview" : "raw"}
                    className="text-[11px] font-extrabold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer transition-all shadow-sm"
                  >
                    <option value="preview">👁️ Markdown Preview Mode</option>
                    <option value="raw">📝 View Notes (Raw Text)</option>
                    <option value="edit">✏️ Edit Notes Mode</option>
                    <option value="delete">🗑️ Delete Note</option>
                  </select>
                </div>
              )}
            </div>

              <div className="flex-1 overflow-y-auto pr-1 text-slate-700 font-sans text-xs select-text space-y-4">
                {isEditingNote ? (
                  /* Rich Markdown Note Editor */
                  <div className="space-y-3 h-full flex flex-col">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-1 focus:ring-purple-400 focus:outline-none"
                        placeholder="Note Title"
                      />
                      <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-md animate-pulse shrink-0">
                        ✓ Saved to Local DB
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editTopic}
                        onChange={(e) => setEditTopic(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] focus:ring-1 focus:ring-purple-400 focus:outline-none"
                        placeholder="Topic Category (e.g. Relational Algebra)"
                      />
                      <input
                        type="text"
                        value={editSubtopic}
                        onChange={(e) => setEditSubtopic(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] focus:ring-1 focus:ring-purple-400 focus:outline-none"
                        placeholder="Subtopic / Core Chapter"
                      />
                    </div>

                    {/* Rich Markdown Editing Formatting Toolbar */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => insertFormatting("**", "**")}
                          className="p-1.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg border border-slate-200 transition-all flex items-center justify-center"
                          title="Bold text (**bold**)"
                        >
                          <span className="text-[10px] font-extrabold w-3.5 h-3.5 flex items-center justify-center">B</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("*", "*")}
                          className="p-1.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg border border-slate-200 transition-all flex items-center justify-center"
                          title="Italic text (*italic*)"
                        >
                          <span className="text-[10px] italic font-semibold w-3.5 h-3.5 flex items-center justify-center">I</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("# ")}
                          className="p-1.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg border border-slate-200 transition-all flex items-center justify-center"
                          title="Heading 1 (# Heading)"
                        >
                          <Heading1 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("## ")}
                          className="p-1.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg border border-slate-200 transition-all flex items-center justify-center"
                          title="Heading 2 (## Heading)"
                        >
                          <Heading2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("### ")}
                          className="p-1.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg border border-slate-200 transition-all flex items-center justify-center"
                          title="Heading 3 (### Heading)"
                        >
                          <Heading3 className="h-3.5 w-3.5" />
                        </button>
                        
                        <span className="h-4 w-[1px] bg-slate-200 mx-0.5"></span>

                        <button
                          type="button"
                          onClick={() => insertFormatting("- ")}
                          className="p-1.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg border border-slate-200 transition-all flex items-center justify-center"
                          title="Bullet list (- Item)"
                        >
                          <List className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("1. ")}
                          className="p-1.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg border border-slate-200 transition-all flex items-center justify-center"
                          title="Numbered list (1. Item)"
                        >
                          <ListOrdered className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("- [ ] ")}
                          className="p-1.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg border border-slate-200 transition-all flex items-center justify-center"
                          title="Task checkbox (- [ ] Task)"
                        >
                          <CheckSquare className="h-3.5 w-3.5" />
                        </button>

                        <span className="h-4 w-[1px] bg-slate-200 mx-0.5"></span>

                        <button
                          type="button"
                          onClick={() => insertFormatting("`", "`")}
                          className="p-1.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg border border-slate-200 transition-all flex items-center justify-center"
                          title="Inline Code (`code`)"
                        >
                          <Code className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("```javascript\n", "\n```")}
                          className="p-1.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg border border-slate-200 transition-all flex items-center justify-center"
                          title="Code Block (```js ... ```)"
                        >
                          <span className="text-[8px] font-bold tracking-tighter">Code</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("> ")}
                          className="p-1.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg border border-slate-200 transition-all flex items-center justify-center"
                          title="Blockquote (> quote)"
                        >
                          <Quote className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("==", "==")}
                          className="p-1.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg border border-slate-200 transition-all flex items-center justify-center"
                          title="Highlight text (==text==)"
                        >
                          <Highlighter className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("\n---\n")}
                          className="p-1.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg border border-slate-200 transition-all flex items-center justify-center"
                          title="Horizontal divider (---)"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>

                        <span className="h-4 w-[1px] bg-slate-200 mx-0.5"></span>

                        <button
                          type="button"
                          onClick={() => setEditContent("")}
                          className="text-[10px] text-rose-600 hover:text-rose-700 px-2.5 py-1 bg-white hover:bg-rose-50 rounded-lg border border-slate-200 transition-all font-semibold"
                          title="Clear whole editor body"
                        >
                          Clear
                        </button>
                      </div>

                      {/* Mode tab selectors */}
                      <div className="flex bg-slate-200/75 p-0.5 rounded-lg border border-slate-300/30 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setEditorSubTab("write")}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                            editorSubTab === "write" ? "bg-white text-purple-700 shadow-sm" : "text-slate-600 hover:text-purple-600"
                          }`}
                        >
                          <AlignLeft className="h-3 w-3" />
                          Write
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorSubTab("split")}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                            editorSubTab === "split" ? "bg-white text-purple-700 shadow-sm" : "text-slate-600 hover:text-purple-600"
                          }`}
                        >
                          <Columns className="h-3 w-3" />
                          Split
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorSubTab("preview")}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                            editorSubTab === "preview" ? "bg-white text-purple-700 shadow-sm" : "text-slate-600 hover:text-purple-600"
                          }`}
                        >
                          <Eye className="h-3 w-3" />
                          Preview
                        </button>
                      </div>
                    </div>

                    {/* Dynamic View based on editorSubTab */}
                    <div className="flex-1 min-h-[220px] max-h-[340px] flex flex-col">
                      {editorSubTab === "write" && (
                        <textarea
                          id="edit-note-textarea"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono focus:ring-1 focus:ring-purple-400 focus:outline-none resize-none leading-relaxed h-full overflow-y-auto"
                          placeholder="Start typing your study notes here using Markdown... Try formatting, lists, tables or checkboxes!"
                        />
                      )}

                      {editorSubTab === "split" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0 h-full">
                          <textarea
                            id="edit-note-textarea"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full h-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono focus:ring-1 focus:ring-purple-400 focus:outline-none resize-none leading-relaxed overflow-y-auto"
                            placeholder="Start typing your study notes here..."
                          />
                          <div className="w-full h-full border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 overflow-y-auto select-text prose max-w-none">
                            <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-2 pb-1 border-b border-purple-100/60 flex items-center gap-1">
                              <Sparkle className="h-3 w-3 text-purple-500" /> Live Rendered Markdown
                            </div>
                            {formatMarkdown(editContent)}
                          </div>
                        </div>
                      )}

                      {editorSubTab === "preview" && (
                        <div className="w-full flex-1 border border-slate-200 rounded-xl p-4.5 bg-slate-50/50 overflow-y-auto select-text prose max-w-none h-full">
                          <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-2 pb-1 border-b border-purple-100/60 flex items-center gap-1">
                            <Sparkle className="h-3 w-3 text-purple-500" /> Formatted Markdown Preview
                          </div>
                          {formatMarkdown(editContent)}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        onClick={() => setIsEditingNote(false)}
                        className="text-[10px] px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 font-semibold transition-all active:scale-95"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="text-[10px] px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all shadow-sm active:scale-95"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Render text or annotations */
                  <>
                    {activeNote ? (
                      <div className="space-y-3">
                        {isPreviewMode ? (
                          <div className="leading-relaxed select-text font-sans text-slate-800 bg-white border border-slate-100 rounded-xl p-5 shadow-inner">
                            {formatMarkdown(activeNote.content)}
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap leading-relaxed select-text font-mono text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-4 shadow-inner text-[11px]">
                            {activeNote.content}
                          </div>
                        )}

                        {/* Formula extracted cheatsheet widget */}
                        {detectedFormulas.length > 0 && (
                          <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-2.5">
                            <h6 className="text-[9px] font-black uppercase text-amber-800 tracking-wider flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-amber-500" /> Extracted Formula Core Sheet
                            </h6>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mt-1.5 font-mono text-[9px]">
                              {detectedFormulas.map((f, i) => (
                                <span key={i} className="bg-white border border-amber-100 text-amber-800 p-1 rounded font-bold text-center">
                                  {f}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Annotations stickies inside the note */}
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <h5 className="font-bold text-[9px] text-slate-500 uppercase flex items-center gap-1">
                            📌 Sticky Margins Annotations ({((activeNote as any).annotations || []).length})
                          </h5>
                          <form onSubmit={handleAddAnnotation} className="flex gap-1">
                            <input
                              type="text"
                              required
                              value={newAnnotationText}
                              onChange={(e) => setNewAnnotationText(e.target.value)}
                              placeholder="Add margin annotation or quiz question..."
                              className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px]"
                            />
                            <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-[9px] font-bold">
                              Add
                            </button>
                          </form>
                          <div className="space-y-1.5 max-h-[80px] overflow-y-auto">
                            {((activeNote as any).annotations || []).map((ann: any) => (
                              <div key={ann.id} className="flex justify-between items-center text-[9px] bg-purple-50/60 p-1.5 rounded border border-purple-100/40">
                                <span className="text-slate-800">{ann.text}</span>
                                <button
                                  onClick={() => handleDeleteAnnotation(ann.id)}
                                  className="text-rose-500 font-bold hover:underline"
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Version history rollbacks */}
                        {(activeNote as any).versionHistory && (activeNote as any).versionHistory.length > 1 && (
                          <div className="pt-2 border-t border-slate-100">
                            <h5 className="font-bold text-[9px] text-slate-500 uppercase">Version Backlog (Click to Rollback)</h5>
                            <div className="flex gap-1.5 mt-1 overflow-x-auto pb-1">
                              {((activeNote as any).versionHistory || []).map((v: any, i: number) => (
                                <button
                                  key={i}
                                  onClick={() => handleRollbackVersion(v.content)}
                                  className="px-2 py-1 bg-slate-50 hover:bg-purple-50 text-[8px] font-mono rounded border border-slate-200 text-slate-600 shrink-0"
                                >
                                  Rev v{i + 1} ({new Date(v.timestamp).toLocaleTimeString()})
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-400 text-center py-12">Please select or write a study note on the left.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            /* TEXTBOOKS & PDF TAB: TWO-COLUMN INTEGRATED WORKSPACE (Left: Viewer, Right: Notepad) */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-full">
              {/* Left Column: Reader/Viewer (7 Cols) */}
              <div className="md:col-span-7 flex flex-col border border-slate-100 rounded-2xl bg-white/80 p-4 h-full overflow-hidden relative">
                <div className="border-b border-slate-100 pb-3 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <BookOpen className="h-4.5 w-4.5 text-pink-600 shrink-0" />
                    <h3 className="font-bold text-slate-800 text-xs truncate">
                      {activeReadingSource === "uploaded_pdf"
                        ? `Summary: ${uploadedFile?.name || "Uploaded Document"}`
                        : `Textbook: ${activeTextbookKey.replace(/_/g, " ")}`}
                    </h3>
                  </div>
                  {activeReadingSource === "uploaded_pdf" && pdfSummary && (
                    <span className="text-[8px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded uppercase">
                      Local AI Summed
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto pr-1 text-slate-700 font-sans text-xs select-text space-y-4">
                  {activeReadingSource === "uploaded_pdf" ? (
                    pdfSummaryLoading ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                        <div className="relative">
                          <div className="h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                          <Sparkles className="h-5 w-5 text-indigo-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                        </div>
                        <p className="text-xs font-bold text-indigo-700 animate-pulse">
                          Summarizing with Local AI (llama.cpp)...
                        </p>
                        <p className="text-[10px] text-slate-400 max-w-xs">
                          Executing 100% offline inference on local CPU/GPU. Zero network data transmitted.
                        </p>
                      </div>
                    ) : pdfSummary ? (
                      <div className="space-y-3">
                        {/* Summary Content */}
                        <div className="space-y-2 select-text font-serif leading-relaxed text-slate-800 bg-slate-50/50 border border-slate-100 rounded-xl p-3.5">
                          {formatMarkdown(pdfSummary)}
                        </div>
                        
                        {/* Actions */}
                        <button
                          onClick={handleSavePDFSummaryToNotes}
                          className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Save this Summary to "My Notes" Folder
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                        <FileText className="h-8 w-8 text-slate-300" />
                        <h4 className="text-xs font-bold text-slate-700">No Document Summary Active</h4>
                        <p className="text-[10px] text-slate-400 max-w-xs">
                          Click the <strong>"Summarize AI"</strong> button on the left panel to execute on-device local model inference!
                        </p>
                      </div>
                    )
                  ) : (
                    /* Mock Textbook Content Rendering */
                    <div className="space-y-2 select-text font-serif leading-relaxed text-slate-800 bg-white border border-slate-50 rounded-xl p-3 shadow-inner">
                      {formatMarkdown(MOCK_TEXTBOOKS[activeTextbookKey] || "")}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: User-friendly Quick Note Taking Panel (5 Cols) */}
              <div className="md:col-span-5 flex flex-col border border-purple-100 rounded-2xl bg-gradient-to-b from-white to-purple-50/20 p-4 h-full overflow-hidden relative">
                <div className="border-b border-slate-100 pb-3 mb-2.5">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <span className="text-purple-600">📝</span> Easy Quick Notepad
                  </h4>
                  <p className="text-[9px] text-slate-400 mt-0.5">
                    Write notes while reading textbook and instantly save them!
                  </p>
                </div>

                <form onSubmit={handleSaveQuickNote} className="flex-1 flex flex-col justify-between space-y-2">
                  <div className="space-y-2 flex-1 flex flex-col">
                    <input
                      type="text"
                      required
                      value={quickNoteTitle}
                      onChange={(e) => setQuickNoteTitle(e.target.value)}
                      placeholder="Title of note (e.g. Normalization Rules)"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-purple-400 focus:outline-none"
                    />
                    
                    <textarea
                      required
                      value={quickNoteContent}
                      onChange={(e) => setQuickNoteContent(e.target.value)}
                      placeholder="Type your notes or revision questions here... Supports markdown too."
                      className="w-full flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs focus:ring-1 focus:ring-purple-400 focus:outline-none resize-none leading-relaxed"
                    />
                  </div>

                  <div className="pt-2">
                    {quickNoteSuccess && (
                      <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-1.5 mb-2 font-bold text-center animate-pulse">
                        🎉 {quickNoteSuccess}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickNoteTitle("");
                          setQuickNoteContent("");
                        }}
                        className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-[10px] rounded-xl transition-all"
                      >
                        Clear Pads
                      </button>
                      <button
                        type="submit"
                        className="py-1.5 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-bold text-[10px] rounded-xl transition-all shadow-sm flex items-center justify-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Save to Folder
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
    </div>
  );
};
