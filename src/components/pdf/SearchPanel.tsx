import React, { useState, useEffect } from "react";
import { SearchMatch } from "./services/searchService";
import { Search, Loader2, ChevronLeft, ChevronRight, History, Trash2, SlidersHorizontal } from "lucide-react";

interface SearchPanelProps {
  searchQuery?: string;
  searchResults?: SearchMatch[];
  isSearching?: boolean;
  caseSensitive?: boolean;
  setCaseSensitive?: (val: boolean) => void;
  wholeWord?: boolean;
  setWholeWord?: (val: boolean) => void;
  isRegex?: boolean;
  setIsRegex?: (val: boolean) => void;
  currentMatchIndex?: number;
  setCurrentMatchIndex?: (val: number) => void;
  searchHistory?: string[];
  onSearch?: (query: string) => void;
  onClearSearch?: () => void;
  onNextMatch?: () => void;
  onPrevMatch?: () => void;
  onNavigateToPage?: (page: number) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  searchQuery = "",
  searchResults = [],
  isSearching = false,
  caseSensitive = false,
  setCaseSensitive = () => {},
  wholeWord = false,
  setWholeWord = () => {},
  isRegex = false,
  setIsRegex = () => {},
  currentMatchIndex = -1,
  setCurrentMatchIndex = () => {},
  searchHistory = [],
  onSearch = () => {},
  onClearSearch = () => {},
  onNextMatch = () => {},
  onPrevMatch = () => {},
  onNavigateToPage = () => {},
}) => {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [showOptions, setShowOptions] = useState(false);

  // Sync from parent query (e.g. if cleared or selected from history)
  useEffect(() => {
    setLocalQuery(searchQuery || "");
  }, [searchQuery]);

  // Debounced instant search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery.trim() !== searchQuery) {
        onSearch(localQuery);
      } else if (!localQuery.trim() && searchQuery) {
        onClearSearch();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [localQuery, caseSensitive, wholeWord, isRegex]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(localQuery);
  };

  const handleResultClick = (match: SearchMatch, idx: number) => {
    setCurrentMatchIndex(idx);
    onNavigateToPage(match.page);
  };

  return (
    <div className="flex flex-col h-full bg-white text-slate-700">
      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Search Document Text</span>
        <button
          onClick={() => setShowOptions(!showOptions)}
          title="Toggle search options"
          className={`p-1 rounded-lg transition-colors cursor-pointer ${
            showOptions ? "bg-purple-50 text-purple-600" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-3 border-b border-slate-50 space-y-2">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200/60 rounded-xl focus-within:ring-1 focus-within:ring-purple-400">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search keywords..."
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              className="text-xs bg-transparent focus:outline-none w-full"
            />
            {localQuery && (
              <button
                type="button"
                onClick={() => {
                  setLocalQuery("");
                  onClearSearch();
                }}
                className="text-[10px] text-slate-400 hover:text-slate-600 font-bold pr-1"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {/* Search Options Panel */}
        {(showOptions || caseSensitive || wholeWord || isRegex) && (
          <div className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-100 p-2 rounded-xl animate-fadeIn">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Filters</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCaseSensitive(!caseSensitive)}
                title="Case Sensitive [Aa]"
                className={`px-2 py-0.5 text-[9px] font-black rounded border transition-colors cursor-pointer ${
                  caseSensitive
                    ? "bg-purple-100 text-purple-700 border-purple-200"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Aa
              </button>
              <button
                onClick={() => setWholeWord(!wholeWord)}
                title="Whole Words Only [W]"
                className={`px-2 py-0.5 text-[9px] font-black rounded border transition-colors cursor-pointer ${
                  wholeWord
                    ? "bg-purple-100 text-purple-700 border-purple-200"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                }`}
              >
                W
              </button>
              <button
                onClick={() => setIsRegex(!isRegex)}
                title="Regex Match [.*]"
                className={`px-2 py-0.5 text-[9px] font-black rounded border transition-colors cursor-pointer ${
                  isRegex
                    ? "bg-purple-100 text-purple-700 border-purple-200"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                }`}
              >
                .*
              </button>
            </div>
          </div>
        )}

        {/* Previous / Next Match Navigation Toolbar */}
        {(searchResults || []).length > 0 && (
          <div className="flex items-center justify-between bg-purple-50/40 border border-purple-100/50 p-2 rounded-xl animate-fadeIn">
            <div className="text-[10px] font-extrabold text-purple-950">
              Match <span className="text-purple-600 font-black">{(currentMatchIndex || 0) + 1}</span> of <span className="font-black">{(searchResults || []).length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onPrevMatch}
                title="Previous Match"
                className="p-1 rounded bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 shadow-xs cursor-pointer transition-colors"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <button
                onClick={onNextMatch}
                title="Next Match"
                className="p-1 rounded bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 shadow-xs cursor-pointer transition-colors"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isSearching ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
            <span className="text-xs font-semibold">Indexing document pages...</span>
          </div>
        ) : (searchResults || []).length === 0 ? (
          <div className="space-y-4">
            {/* If query is empty, show recent history */}
            {!localQuery && (searchHistory || []).length > 0 && (
              <div className="space-y-2 animate-fadeIn text-left">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <History className="h-3 w-3" /> Recent Searches
                </span>
                <div className="space-y-1">
                  {(searchHistory || []).map((histQuery, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setLocalQuery(histQuery);
                        onSearch(histQuery);
                      }}
                      className="w-full text-left py-1.5 px-2 text-[10px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-150 transition-all cursor-pointer truncate"
                    >
                      {histQuery}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center py-12 text-slate-400">
              {localQuery ? "No matches found for this query." : "Search words or phrases above to find all occurrences in the book."}
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-left">
            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">
              Occurrences ({(searchResults || []).length})
            </span>
            <div className="space-y-1.5">
              {(searchResults || []).map((match, idx) => {
                const isActive = idx === currentMatchIndex;
                return (
                  <div
                    key={idx}
                    onClick={() => handleResultClick(match, idx)}
                    className={`p-2 rounded-xl transition-all border cursor-pointer ${
                      isActive
                        ? "bg-purple-50/50 border-purple-200 shadow-xs"
                        : "bg-slate-50 border-transparent hover:border-slate-200"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1 shrink-0">
                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                        isActive ? "bg-purple-600 text-white" : "bg-purple-100/50 text-purple-700"
                      }`}>
                        Page {match.page}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-normal line-clamp-3 select-none">
                      {match.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
