import React, { useEffect, useRef, useState } from "react";
import { PDFCanvas } from "./PDFCanvas";
import { PDFTextLayer } from "./PDFTextLayer";
import { AnnotationLayer } from "./AnnotationLayer";
import { SelectionLayer } from "./SelectionLayer";
import { PDFAnnotation } from "./types/annotation";

interface PDFViewerProps {
  pdfDocument: any;
  numPages: number;
  zoom: number;
  rotation: number;
  activeTool: "pan" | "select" | "highlight" | "underline" | "strikethrough" | "drawing" | "rectangle" | "circle" | "arrow" | "eraser";
  activeColor: string;
  strokeThickness: number;
  strokeOpacity: number;
  annotations: PDFAnnotation[];
  currentPage: number;
  onPageVisible: (page: number) => void;
  onAddAnnotation: (ann: Omit<PDFAnnotation, "id" | "createdAt">) => void;
  onRemoveAnnotation: (id: string) => void;
  onSelectionComplete: (
    rect: { x: number; y: number; w: number; h: number; page: number },
    position: { x: number; y: number; pageX: number; pageY: number }
  ) => void;

  // Advanced search highlights
  searchQuery?: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  isRegex?: boolean;

  // Page snapping
  snapToPages?: boolean;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfDocument,
  numPages,
  zoom,
  rotation,
  activeTool,
  activeColor,
  strokeThickness,
  strokeOpacity,
  annotations,
  currentPage,
  onPageVisible,
  onAddAnnotation,
  onRemoveAnnotation,
  onSelectionComplete,
  searchQuery = "",
  caseSensitive = false,
  wholeWord = false,
  isRegex = false,
  snapToPages = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Keeps track of the aspect ratio for each page (defaults to standard letter size: 1.29)
  const [pageAspectRatios, setPageAspectRatios] = useState<{ [key: number]: number }>({});

  // Hand panning & Inertia States
  const [spacebarPressed, setSpacebarPressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const isPanningRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const startScrollTopRef = useRef(0);

  // Velocity tracking for inertial scrolling
  const lastMouseXRef = useRef(0);
  const lastMouseYRef = useRef(0);
  const lastMouseTimeRef = useRef(0);
  const velXRef = useRef(0);
  const velYRef = useRef(0);
  const inertiaFrameRef = useRef<number | null>(null);

  const startInertia = () => {
    if (inertiaFrameRef.current) cancelAnimationFrame(inertiaFrameRef.current);
    const glide = () => {
      if (!containerRef.current) return;
      containerRef.current.scrollLeft -= velXRef.current;
      containerRef.current.scrollTop -= velYRef.current;
      
      velXRef.current *= 0.94; // Decay velocity
      velYRef.current *= 0.94;

      if (Math.abs(velXRef.current) > 0.25 || Math.abs(velYRef.current) > 0.25) {
        inertiaFrameRef.current = requestAnimationFrame(glide);
      } else {
        inertiaFrameRef.current = null;
      }
    };
    inertiaFrameRef.current = requestAnimationFrame(glide);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const isMiddleButton = e.button === 1;
    const canPan = activeTool === "pan" || spacebarPressed || isMiddleButton;
    if (!canPan) return;

    e.preventDefault(); // Stop text selection/middle click auto scrolling
    if (inertiaFrameRef.current) cancelAnimationFrame(inertiaFrameRef.current);

    setIsPanning(true);
    isPanningRef.current = true;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    
    if (containerRef.current) {
      startScrollLeftRef.current = containerRef.current.scrollLeft;
      startScrollTopRef.current = containerRef.current.scrollTop;
    }

    lastMouseXRef.current = e.clientX;
    lastMouseYRef.current = e.clientY;
    lastMouseTimeRef.current = Date.now();
    velXRef.current = 0;
    velYRef.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current || !containerRef.current) return;
    e.preventDefault();

    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    containerRef.current.scrollLeft = startScrollLeftRef.current - dx;
    containerRef.current.scrollTop = startScrollTopRef.current - dy;

    // Track scroll flick velocity
    const now = Date.now();
    const dt = now - lastMouseTimeRef.current;
    if (dt > 10) {
      const instantaneousVelX = (e.clientX - lastMouseXRef.current) / (dt / 16.67);
      const instantaneousVelY = (e.clientY - lastMouseYRef.current) / (dt / 16.67);
      // Low pass filter to smooth out velocity spikes
      velXRef.current = velXRef.current * 0.45 + instantaneousVelX * 0.55;
      velYRef.current = velYRef.current * 0.45 + instantaneousVelY * 0.55;
    }

    lastMouseXRef.current = e.clientX;
    lastMouseYRef.current = e.clientY;
    lastMouseTimeRef.current = now;
  };

  const handleMouseUp = () => {
    if (isPanningRef.current) {
      setIsPanning(false);
      isPanningRef.current = false;
      startInertia();
    }
  };

  const handleMouseLeave = () => {
    if (isPanningRef.current) {
      setIsPanning(false);
      isPanningRef.current = false;
      startInertia();
    }
  };

  // Keyboard navigation & spacebar hand tool detection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid firing hotkeys when user is focused on typing
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        setSpacebarPressed(true);
      } else if (e.code === "PageDown" || e.code === "KeyN") {
        e.preventDefault();
        if (currentPage < numPages) {
          onPageVisible(currentPage + 1);
        }
      } else if (e.code === "PageUp" || e.code === "KeyP") {
        e.preventDefault();
        if (currentPage > 1) {
          onPageVisible(currentPage - 1);
        }
      } else if (e.code === "ArrowDown") {
        if (containerRef.current) {
          e.preventDefault();
          containerRef.current.scrollTop += 60;
        }
      } else if (e.code === "ArrowUp") {
        if (containerRef.current) {
          e.preventDefault();
          containerRef.current.scrollTop -= 60;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpacebarPressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [currentPage, numPages, onPageVisible]);

  useEffect(() => {
    if (!pdfDocument) return;

    // Load first page's aspect ratio as a base default
    pdfDocument.getPage(1).then((page: any) => {
      const viewport = page.getViewport({ scale: 1 });
      const ratio = viewport.height / viewport.width;
      setPageAspectRatios((prev) => ({ ...prev, [1]: ratio }));
    }).catch((err: unknown) => {
      console.warn("Could not calculate first page aspect ratio:", err);
    });
  }, [pdfDocument]);

  // Set up intersection observer to detect active visible page and load pages lazily
  useEffect(() => {
    if (!pdfDocument || numPages === 0) return;

    const observerOptions = {
      root: containerRef.current,
      rootMargin: "350px 0px 350px 0px", // Trigger loading slightly before page scrolls into view
      threshold: 0.15,
    };

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        const pageNum = parseInt(entry.target.getAttribute("data-page-num") || "0");
        if (pageNum === 0) return;

        if (entry.isIntersecting) {
          // Track active page based on which is most visible
          if (entry.intersectionRatio > 0.45) {
            onPageVisible(pageNum);
          }
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, observerOptions);

    // Observe each page placeholder box
    const currentRefs = pageRefs.current;
    Object.keys(currentRefs).forEach((key) => {
      const el = currentRefs[parseInt(key)];
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [pdfDocument, numPages, onPageVisible]);

  // Handle programmatic scroll to page when page changes from outside
  const isSelfScrolling = useRef(false);
  const lastProgrammaticPage = useRef<number | null>(null);
  const snapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleContainerScroll = () => {
    if (!snapToPages || isPanningRef.current || isSelfScrolling.current) return;

    if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);

    snapTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      const currentScrollTop = containerRef.current.scrollTop;

      let closestPage = 1;
      let minDistance = Infinity;

      Object.entries(pageRefs.current).forEach(([pageNumStr, el]) => {
        if (!el) return;
        const pageNum = parseInt(pageNumStr, 10);
        const distance = Math.abs((el as HTMLDivElement).offsetTop - currentScrollTop - 32);
        if (distance < minDistance) {
          minDistance = distance;
          closestPage = pageNum;
        }
      });

      const targetEl = pageRefs.current[closestPage];
      if (targetEl && minDistance > 20) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 280);
  };

  useEffect(() => {
    if (containerRef.current) {
      const resumeReading = typeof window !== 'undefined' && localStorage.getItem("studyos_pdf_resume_reading") === "true";
      if (!resumeReading) {
        containerRef.current.scrollTop = 0;
        containerRef.current.scrollLeft = 0;
        lastProgrammaticPage.current = 1;
      }
    }
  }, [pdfDocument]);

  useEffect(() => {
    if (currentPage) {
      if (currentPage === 1 && containerRef.current) {
        const resumeReading = typeof window !== 'undefined' && localStorage.getItem("studyos_pdf_resume_reading") === "true";
        if (!resumeReading) {
          containerRef.current.scrollTop = 0;
          containerRef.current.scrollLeft = 0;
        } else {
          const pageEl = pageRefs.current[1];
          if (pageEl) pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        lastProgrammaticPage.current = 1;
      } else if (lastProgrammaticPage.current !== currentPage) {
        const pageEl = pageRefs.current[currentPage];
        if (pageEl && containerRef.current) {
          lastProgrammaticPage.current = currentPage;
          isSelfScrolling.current = true;
          pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
          setTimeout(() => {
            isSelfScrolling.current = false;
          }, 800);
        }
      }
    }
  }, [currentPage]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onScroll={handleContainerScroll}
      className={`flex-1 min-h-0 overflow-y-auto bg-slate-100 p-8 flex flex-col items-center gap-10 h-full relative pdf-viewer-container transition-all ${
        isPanning ? "cursor-grabbing" : (activeTool === "pan" || spacebarPressed) ? "cursor-grab" : "cursor-default"
      }`}
      style={{ scrollBehavior: isPanning ? "auto" : "smooth" }}
    >
      {numPages === 0 ? (
        <div className="flex items-center justify-center h-full text-slate-400 text-sm font-semibold">
          No document loaded. Select a PDF file to begin studying.
        </div>
      ) : (
        <div className="flex flex-col gap-8 max-w-full">
          {Array.from({ length: numPages }).map((_, index) => {
            const pageNum = index + 1;
            const ratio = pageAspectRatios[pageNum] || pageAspectRatios[1] || 1.414;
            
            // Standard letter width: ~612pt. Multiply by zoom factor.
            const standardWidth = 612;
            const baseWidth = standardWidth * zoom;
            const baseHeight = baseWidth * ratio;

            // Swapped dimension logic if rotated
            const isLandscape = rotation % 180 !== 0;
            const boxWidth = isLandscape ? baseHeight : baseWidth;
            const boxHeight = isLandscape ? baseWidth : baseHeight;

            return (
              <div
                key={pageNum}
                ref={(el) => {
                  pageRefs.current[pageNum] = el;
                }}
                data-page-num={pageNum}
                style={{
                  width: `${boxWidth}px`,
                  minHeight: `${boxHeight}px`,
                }}
                className="relative flex justify-center bg-white border border-slate-200/50 shadow-sm rounded-lg"
              >
                {/* Lazy-loaded actual page content */}
                <LazyPageContent
                  pdfDocument={pdfDocument}
                  pageNumber={pageNum}
                  zoom={zoom}
                  rotation={rotation}
                  activeTool={activeTool}
                  activeColor={activeColor}
                  strokeThickness={strokeThickness}
                  strokeOpacity={strokeOpacity}
                  annotations={annotations.filter((a) => a.page === pageNum)}
                  width={boxWidth}
                  height={boxHeight}
                  onAddAnnotation={onAddAnnotation}
                  onRemoveAnnotation={onRemoveAnnotation}
                  onSelectionComplete={onSelectionComplete}
                  onCalculateRatio={(newRatio) => {
                    setPageAspectRatios((prev) => ({ ...prev, [pageNum]: newRatio }));
                  }}
                  searchQuery={searchQuery}
                  caseSensitive={caseSensitive}
                  wholeWord={wholeWord}
                  isRegex={isRegex}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Component helper to handle single page fetch and layers
interface LazyPageContentProps {
  pdfDocument: any;
  pageNumber: number;
  zoom: number;
  rotation: number;
  activeTool: any;
  activeColor: string;
  strokeThickness: number;
  strokeOpacity: number;
  annotations: PDFAnnotation[];
  width: number;
  height: number;
  onAddAnnotation: (ann: Omit<PDFAnnotation, "id" | "createdAt">) => void;
  onRemoveAnnotation: (id: string) => void;
  onSelectionComplete: (
    rect: { x: number; y: number; w: number; h: number; page: number },
    position: { x: number; y: number; pageX: number; pageY: number }
  ) => void;
  onCalculateRatio: (ratio: number) => void;

  // Search parameters for text highlight layer
  searchQuery?: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  isRegex?: boolean;
}

const LazyPageContent: React.FC<LazyPageContentProps> = ({
  pdfDocument,
  pageNumber,
  zoom,
  rotation,
  activeTool,
  activeColor,
  strokeThickness,
  strokeOpacity,
  annotations,
  width,
  height,
  onAddAnnotation,
  onRemoveAnnotation,
  onSelectionComplete,
  onCalculateRatio,
  searchQuery,
  caseSensitive,
  wholeWord,
  isRegex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [viewport, setViewport] = useState<any>(null);

  // Lazy load with an intersection observer
  useEffect(() => {
    if (!pdfDocument) return;

    let active = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          pdfDocument.getPage(pageNumber).then((p: any) => {
            if (!active) return;
            setPage(p);
            
            // Calculate accurate aspect ratio
            const unscaledViewport = p.getViewport({ scale: 1 });
            const ratio = unscaledViewport.height / unscaledViewport.width;
            onCalculateRatio(ratio);
          }).catch((err: unknown) => {
            console.error(`Error loading page ${pageNumber}:`, err);
          });
          observer.disconnect();
        }
      },
      { rootMargin: "400px" }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [pdfDocument, pageNumber]);

  useEffect(() => {
    if (page) {
      const vp = page.getViewport({ scale: zoom, rotation });
      setViewport(vp);
    }
  }, [page, zoom, rotation]);

  return (
    <div
      ref={containerRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="relative flex items-center justify-center overflow-hidden rounded-lg select-text"
    >
      {!visible && (
        <div className="flex flex-col items-center justify-center gap-2">
          <span className="text-xs text-slate-400 font-semibold animate-pulse">Loading Page {pageNumber}...</span>
        </div>
      )}

      {page && viewport && (
        <div className="relative" style={{ width: `${viewport.width}px`, height: `${viewport.height}px` }}>
          {/* Main PDF Canvas */}
          <PDFCanvas
            page={page}
            scale={zoom}
            rotation={rotation}
          />

          {/* Transparent Native Browser Text Selection overlay */}
          {activeTool !== "drawing" && activeTool !== "eraser" && (
            <PDFTextLayer
              page={page}
              viewport={viewport}
              searchQuery={searchQuery}
              caseSensitive={caseSensitive}
              wholeWord={wholeWord}
              isRegex={isRegex}
            />
          )}

          {/* Interactive Annotation vector layer */}
          <AnnotationLayer
            width={viewport.width}
            height={viewport.height}
            pageNumber={pageNumber}
            annotations={annotations}
            activeTool={activeTool}
            activeColor={activeColor}
            strokeThickness={strokeThickness}
            strokeOpacity={strokeOpacity}
            onAddAnnotation={onAddAnnotation}
            onRemoveAnnotation={onRemoveAnnotation}
          />

          {/* Smart rectangular crop selection overlay layer */}
          <SelectionLayer
            width={viewport.width}
            height={viewport.height}
            pageNumber={pageNumber}
            isActive={activeTool === "select"}
            onSelectionComplete={onSelectionComplete}
          />
        </div>
      )}
    </div>
  );
};
