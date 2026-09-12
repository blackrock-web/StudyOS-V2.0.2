import React, { useEffect, useRef, useState } from "react";
import { pdfService } from "./services/pdfService";
import { Bookmark, LayoutGrid } from "lucide-react";

interface PDFThumbnailPanelProps {
  pdfDocument: any;
  numPages: number;
  currentPage: number;
  bookmarks?: number[];
  onNavigateToPage: (page: number) => void;
}

export const PDFThumbnailPanel: React.FC<PDFThumbnailPanelProps> = ({
  pdfDocument,
  numPages,
  currentPage,
  bookmarks = [],
  onNavigateToPage,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(500);

  // Mouse Drag-to-Scroll state
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);

  useEffect(() => {
    if (listRef.current) {
      setClientHeight(listRef.current.clientHeight || 500);
      
      // Auto scroll active thumbnail into view on load/change
      const activeEl = listRef.current.querySelector(`[data-page-num="${currentPage}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [currentPage]);

  // Handle manual list scroll tracking
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Mouse drag-scroll handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!listRef.current) return;
    isDragging.current = true;
    listRef.current.style.cursor = "grabbing";
    startY.current = e.clientY;
    startScrollTop.current = listRef.current.scrollTop;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !listRef.current) return;
    e.preventDefault();
    const deltaY = e.clientY - startY.current;
    listRef.current.scrollTop = startScrollTop.current - deltaY;
  };

  const handleMouseUpOrLeave = () => {
    if (isDragging.current && listRef.current) {
      isDragging.current = false;
      listRef.current.style.cursor = "default";
    }
  };

  // Virtualization calculations
  const itemHeight = 150; // height + gap of each thumbnail block
  const totalHeight = numPages * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 3);
  const endIndex = Math.min(numPages - 1, Math.ceil((scrollTop + clientHeight) / itemHeight) + 3);

  const visiblePages = [];
  for (let i = startIndex; i <= endIndex; i++) {
    visiblePages.push(i + 1);
  }

  return (
    <div className="flex flex-col h-full bg-white text-slate-700 select-none">
      <div className="p-3 border-b border-slate-100 flex items-center justify-between shrink-0">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5 text-purple-600" /> Page Thumbnails
        </span>
        <span className="text-[9px] font-black px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
          {numPages} pgs
        </span>
      </div>

      <div
        ref={listRef}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className="flex-1 overflow-y-auto relative scrollbar-none scroll-smooth select-none"
      >
        <div style={{ height: `${totalHeight}px`, position: "relative", width: "100%" }}>
          {visiblePages.map((pageNum) => {
            const isActive = pageNum === currentPage;
            const isBookmarked = bookmarks.includes(pageNum);
            const topPosition = (pageNum - 1) * itemHeight;

            return (
              <div
                key={pageNum}
                data-page-num={pageNum}
                onClick={() => onNavigateToPage(pageNum)}
                style={{
                  position: "absolute",
                  top: `${topPosition}px`,
                  left: "50%",
                  transform: "translateX(-50%)",
                  height: `${itemHeight}px`,
                }}
                className={`group flex flex-col items-center py-2 px-3 rounded-2xl border transition-all cursor-pointer ${
                  isActive
                    ? "border-purple-600 bg-purple-50/10 shadow-sm"
                    : "border-transparent hover:bg-slate-50/60 hover:border-slate-200"
                }`}
              >
                {/* Thumbnail container */}
                <div className="relative hover:scale-[1.03] transition-transform duration-150 shadow-sm rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                  <ThumbnailItem
                    pdfDocument={pdfDocument}
                    pageNumber={pageNum}
                    isActive={isActive}
                  />

                  {/* Bookmark badge */}
                  {isBookmarked && (
                    <div className="absolute top-1 right-1 bg-purple-600 text-white p-1 rounded-full shadow-md animate-fadeIn z-10">
                      <Bookmark className="h-2.5 w-2.5 fill-white text-white" />
                    </div>
                  )}

                  {/* Hover page label overlay */}
                  <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-1">
                    <span className="text-[8px] bg-slate-900/85 text-white font-black px-1.5 py-0.5 rounded-full">
                      Preview p. {pageNum}
                    </span>
                  </div>
                </div>

                {/* Page Label */}
                <span className={`text-[10px] mt-1.5 font-bold tracking-tight ${
                  isActive ? "text-purple-700 font-black" : "text-slate-400"
                }`}>
                  Page {pageNum}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Subcomponent to load single page thumbnail lazily
const ThumbnailItem: React.FC<{ pdfDocument: any; pageNumber: number; isActive: boolean }> = ({
  pdfDocument,
  pageNumber,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!pdfDocument) return;

    let active = true;
    const renderThumb = async () => {
      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (!active) return;

        if (canvasRef.current) {
          await pdfService.renderThumbnail(page, canvasRef.current, 85);
          if (active) {
            setRendered(true);
          }
        }
      } catch (err) {
        console.error(`Error rendering thumbnail for page ${pageNumber}:`, err);
        if (active) {
          setError(true);
        }
      }
    };

    // Lazy load with an intersection observer
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          renderThumb();
          observer.disconnect();
        }
      },
      { rootMargin: "250px" }
    );

    if (canvasRef.current) {
      observer.observe(canvasRef.current);
    }

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [pdfDocument, pageNumber]);

  return (
    <div className="relative w-[85px] h-[110px] bg-white flex items-center justify-center">
      {!rendered && !error && (
        <span className="text-[9px] text-slate-400 font-bold animate-pulse">Loading...</span>
      )}
      {error && <span className="text-[9px] text-pink-500 font-bold">Error</span>}
      <canvas
        ref={canvasRef}
        className={`w-full h-full object-contain transition-opacity duration-150 ${
          rendered ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
};
