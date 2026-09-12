import { useState, useEffect } from "react";
import { searchService, SearchMatch, SearchOptions } from "../services/searchService";

export function usePDFSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  
  // Advanced Toggles
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  
  // Navigation index of active search match
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  
  // Search History
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("studyos_search_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save search history
  useEffect(() => {
    try {
      localStorage.setItem("studyos_search_history", JSON.stringify(searchHistory));
    } catch (e) {
      console.warn("Could not save search history to localStorage", e);
    }
  }, [searchHistory]);

  const executeSearch = async (pdfDocument: any, query: string, customOptions?: Partial<SearchOptions>) => {
    setSearchQuery(query);
    setCurrentMatchIndex(-1);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const finalOptions: SearchOptions = {
      caseSensitive: customOptions?.caseSensitive ?? caseSensitive,
      wholeWord: customOptions?.wholeWord ?? wholeWord,
      isRegex: customOptions?.isRegex ?? isRegex,
    };

    setIsSearching(true);
    try {
      const matches = await searchService.searchDocument(pdfDocument, query, finalOptions);
      setSearchResults(matches);
      if (matches.length > 0) {
        setCurrentMatchIndex(0);
      }
      
      // Update history (avoid duplicates and keep max 7 items)
      setSearchHistory(prev => {
        const filtered = prev.filter(q => q !== query);
        return [query, ...filtered].slice(0, 7);
      });
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setCurrentMatchIndex(-1);
  };

  const nextMatch = () => {
    if (searchResults.length === 0) return -1;
    const nextIdx = (currentMatchIndex + 1) % searchResults.length;
    setCurrentMatchIndex(nextIdx);
    return nextIdx;
  };

  const prevMatch = () => {
    if (searchResults.length === 0) return -1;
    const prevIdx = (currentMatchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentMatchIndex(prevIdx);
    return prevIdx;
  };

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    isSearching,
    searchOpen,
    setSearchOpen,
    caseSensitive,
    setCaseSensitive,
    wholeWord,
    setWholeWord,
    isRegex,
    setIsRegex,
    currentMatchIndex,
    setCurrentMatchIndex,
    searchHistory,
    setSearchHistory,
    executeSearch,
    clearSearch,
    nextMatch,
    prevMatch,
  };
}
