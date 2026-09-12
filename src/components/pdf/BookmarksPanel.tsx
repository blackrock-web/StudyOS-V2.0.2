import React from "react";
import { Bookmark, Trash2 } from "lucide-react";

interface BookmarksPanelProps {
  bookmarks: number[];
  onNavigateToPage: (page: number) => void;
  onToggleBookmark: (page: number) => void;
}

export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({
  bookmarks,
  onNavigateToPage,
  onToggleBookmark,
}) => {
  const sortedBookmarks = [...bookmarks].sort((a, b) => a - b);

  return (
    <div className="flex flex-col h-full bg-white text-slate-700">
      <div className="p-3 border-b border-slate-100">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Bookmarked Pages</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {sortedBookmarks.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No page bookmarks created yet. Bookmark key pages from the top toolbar to find them instantly!
          </div>
        ) : (
          sortedBookmarks.map((page) => (
            <div
              key={page}
              className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-purple-50/20 border border-slate-100 rounded-xl transition-all cursor-pointer group"
              onClick={() => onNavigateToPage(page)}
            >
              <div className="flex items-center gap-2">
                <Bookmark className="h-3.5 w-3.5 text-purple-600 fill-purple-200" />
                <span className="text-xs font-extrabold text-slate-700">Page {page}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBookmark(page);
                }}
                className="p-1 opacity-0 group-hover:opacity-100 hover:text-pink-600 rounded transition-all"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
