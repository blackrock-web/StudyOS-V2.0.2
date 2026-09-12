import { useState, useEffect } from "react";
import { PDFTab } from "../types/pdf";
import { storageService } from "../services/storageService";

export function usePDFTabs() {
  const [tabs, setTabs] = useState<PDFTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");

  useEffect(() => {
    // Load tabs from storage on mount; rehydrate sourceUrl from pdfFiles store when missing
    (async () => {
      try {
        const savedTabs = await storageService.getTabs();
        if (savedTabs && savedTabs.length > 0) {
          const resumeReading = localStorage.getItem("studyos_pdf_resume_reading") === "true";
          const adjustedTabs = await Promise.all(
            savedTabs.map(async (t) => {
              let tab = t;
              if (!resumeReading) {
                tab = { ...tab, currentPage: 1, scrollPosition: 0 };
              }
              if (!tab.sourceUrl) {
                try {
                  const stored = await storageService.getPdfFile(tab.id);
                  if (stored?.dataUrl) {
                    tab = { ...tab, sourceUrl: stored.dataUrl };
                  }
                } catch {
                  /* ignore */
                }
              }
              return tab;
            })
          );
          setTabs(adjustedTabs);
          const pinned = adjustedTabs.find((t) => t.isPinned);
          setActiveTabId(pinned ? pinned.id : adjustedTabs[0]?.id || "");
        }
      } catch (err) {
        console.error("Failed to restore PDF tabs:", err);
      }
    })();
  }, []);

  const openTab = async (id: string, name: string, sourceUrl?: string) => {
    const resumeReading = localStorage.getItem("studyos_pdf_resume_reading") === "true";
    // Check if already open
    const exists = tabs.find((t) => t.id === id);
    if (exists) {
      const updates: Partial<PDFTab> = {};
      if (!resumeReading) {
        updates.currentPage = 1;
        updates.scrollPosition = 0;
      }
      if (sourceUrl && !exists.sourceUrl) {
        updates.sourceUrl = sourceUrl;
      }
      if (Object.keys(updates).length > 0) {
        await updateTabState(id, updates);
      }
      setActiveTabId(id);
      return;
    }

    const newTab: PDFTab = {
      id,
      name,
      currentPage: 1,
      zoom: 1.3, // Fit Width / standard zoom by default
      rotation: 0,
      scrollPosition: 0,
      bookmarks: [],
      sourceUrl,
    };

    const updated = [...tabs, newTab];
    setTabs(updated);
    setActiveTabId(id);
    await storageService.saveTab(newTab);
  };

  const closeTab = async (id: string) => {
    const updated = tabs.filter((t) => t.id !== id);
    setTabs(updated);
    await storageService.deleteTab(id);

    if (activeTabId === id) {
      if (updated.length > 0) {
        setActiveTabId(updated[updated.length - 1]?.id || "");
      } else {
        setActiveTabId("");
      }
    }
  };

  const updateTabState = async (id: string, updates: Partial<PDFTab>) => {
    const updated = tabs.map((t) => {
      if (t.id === id) {
        const result = { ...t, ...updates };
        storageService.saveTab(result);
        return result;
      }
      return t;
    });
    setTabs(updated);
  };

  const getActiveTab = () => {
    return tabs.find((t) => t.id === activeTabId) || null;
  };

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    openTab,
    closeTab,
    updateTabState,
    getActiveTab,
  };
}
