import React from "react";
import { PDFTab } from "./types/pdf";
import { FileText, X, Pin } from "lucide-react";

interface PDFTabsProps {
  tabs: PDFTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onTogglePin?: (id: string) => void;
}

export const PDFTabs: React.FC<PDFTabsProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onTogglePin,
}) => {
  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center bg-slate-100 border-b border-slate-200 select-none overflow-x-auto scrollbar-none h-[38px]">
      <div className="flex items-center px-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-r border-slate-200 cursor-pointer transition-all shrink-0 h-[38px] ${
                isActive
                  ? "bg-white text-slate-800 border-t-2 border-t-purple-600 font-extrabold"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <FileText className={`h-3.5 w-3.5 ${isActive ? "text-purple-600" : "text-slate-400"}`} />
              <span className="max-w-[140px] truncate">{tab.name}</span>
              
              {onTogglePin && tab.isPinned && (
                <Pin className="h-2.5 w-2.5 text-purple-600 rotate-45 shrink-0" />
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0 ml-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
