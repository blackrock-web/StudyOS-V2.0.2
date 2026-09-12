import React, { useState, useMemo } from 'react';
import { Search, Filter, Tag, BookOpen, FileText, Video, HelpCircle, Layers, Award, CheckCircle, ChevronRight } from 'lucide-react';
import { contentEngine, ContentItem, ContentItemType } from '../../services/contentEngine';

interface ContentSearchWidgetProps {
  onSelectItem?: (item: ContentItem) => void;
  defaultTypeFilter?: ContentItemType | 'all';
  placeholder?: string;
  showCategoryTabs?: boolean;
}

export const ContentSearchWidget: React.FC<ContentSearchWidgetProps> = ({
  onSelectItem,
  defaultTypeFilter = 'all',
  placeholder = 'Search across all notes, flashcards, PYQs, PDFs & tests...',
  showCategoryTabs = true,
}) => {
  const [query, setQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<ContentItemType | 'all'>(defaultTypeFilter);
  const [selectedTag, setSelectedTag] = useState<string>('all');

  const allItems = useMemo(() => contentEngine.getAllItems(), []);

  // Collect all unique tags
  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    allItems.forEach((item) => {
      item.tags?.forEach((t) => tagsSet.add(t));
    });
    return Array.from(tagsSet);
  }, [allItems]);

  // Perform search
  const filteredResults = useMemo(() => {
    return contentEngine.searchContentItems(query, selectedType, selectedTag);
  }, [query, selectedType, selectedTag]);

  const getTypeIcon = (type: ContentItemType) => {
    switch (type) {
      case 'note':
        return <FileText className="w-4 h-4 text-purple-500" />;
      case 'flashcard':
        return <Layers className="w-4 h-4 text-amber-500" />;
      case 'pdf':
        return <BookOpen className="w-4 h-4 text-indigo-500" />;
      case 'pyq':
      case 'question_bank':
        return <HelpCircle className="w-4 h-4 text-emerald-500" />;
      case 'mock_test':
        return <Award className="w-4 h-4 text-rose-500" />;
      case 'video':
        return <Video className="w-4 h-4 text-cyan-500" />;
      default:
        return <FileText className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
      {/* Top Search Input Bar */}
      <div className="relative flex items-center">
        <Search className="w-5 h-5 absolute left-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-11 pr-4 py-3 bg-slate-50 text-slate-900 placeholder-slate-400 text-sm font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 px-2 py-1 text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Category Tabs & Tag Filter */}
      {showCategoryTabs && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Type Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
            {[
              { id: 'all', label: 'All Items' },
              { id: 'pyq', label: 'PYQs' },
              { id: 'question_bank', label: 'Question Banks' },
              { id: 'mock_test', label: 'Mock Tests' },
              { id: 'note', label: 'Notes' },
              { id: 'flashcard', label: 'Flashcards' },
              { id: 'pdf', label: 'PDFs' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedType(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg shrink-0 transition-all cursor-pointer ${
                  selectedType === tab.id
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tag Select */}
          {availableTags.length > 0 && (
            <div className="flex items-center gap-2 shrink-0 text-xs">
              <Tag className="w-3.5 h-3.5 text-purple-600" />
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 text-slate-700 rounded-lg border border-slate-200 font-bold cursor-pointer text-xs"
              >
                <option value="all">All Tags ({availableTags.length})</option>
                {availableTags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-1 border-t border-slate-100">
        <span>Showing {filteredResults.length} matching content item(s)</span>
        {query && <span>Query: "{query}"</span>}
      </div>

      {/* Search Results List */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {filteredResults.length > 0 ? (
          filteredResults.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectItem && onSelectItem(item)}
              className={`p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl hover:border-purple-300 transition-all flex items-start justify-between gap-3 ${
                onSelectItem ? 'cursor-pointer hover:shadow-2xs' : ''
              }`}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="p-2 rounded-lg bg-white border border-slate-200 shrink-0 mt-0.5 shadow-2xs">
                  {getTypeIcon(item.type)}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 truncate">
                      {item.title}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 uppercase shrink-0">
                      {item.type}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 font-mono text-[11px]">
                    {item.body}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] text-slate-500 font-medium">
                    {item.metadata.subject && (
                      <span className="font-bold text-purple-700">
                        {item.metadata.subject}
                      </span>
                    )}
                    {item.metadata.topic && (
                      <span>• {item.metadata.topic}</span>
                    )}
                    {item.metadata.year && (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                        {item.metadata.year}
                      </span>
                    )}
                    <span>
                      • v{item.versionHistory?.length || 1}
                    </span>
                  </div>
                </div>
              </div>

              {onSelectItem && (
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 self-center" />
              )}
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs font-medium">
            No matching content items found. Try adjusting your query or filter tab.
          </div>
        )}
      </div>
    </div>
  );
};
