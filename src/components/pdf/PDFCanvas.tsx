import React, { useEffect, useRef, useState } from "react";
import { pdfService } from "./services/pdfService";

interface PDFCanvasProps {
  page: any;
  scale: number;
  rotation: number;
  onRenderSuccess?: (width: number, height: number) => void;
}

export const PDFCanvas: React.FC<PDFCanvasProps> = ({
  page,
  scale,
  rotation,
  onRenderSuccess,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!page) return;

    let active = true;
    let currentRenderTask: any = null;

    const renderPage = async () => {
      if (!canvasRef.current) return;
      setRendering(true);
      setError(null);

      try {
        const viewport = page.getViewport({ scale, rotation });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not get 2D canvas context");

        // Set dimensions for high-DPI
        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        currentRenderTask = page.render(renderContext);
        await currentRenderTask.promise;

        if (active && onRenderSuccess) {
          onRenderSuccess(viewport.width, viewport.height);
        }
      } catch (err: any) {
        if (err?.name === "RenderingCancelledException") {
          console.log("Page rendering cancelled.");
        } else {
          console.error("Rendering error:", err);
          if (active) {
            setError(err.message || "Rendering failed");
          }
        }
      } finally {
        if (active) {
          setRendering(false);
        }
      }
    };

    renderPage();

    return () => {
      active = false;
      if (currentRenderTask) {
        currentRenderTask.cancel();
      }
    };
  }, [page, scale, rotation]);

  return (
    <div className="relative border border-slate-200/40 shadow-md bg-white rounded-lg overflow-hidden">
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-pink-50 text-pink-600 text-xs p-4">
          Failed to render page: {error}
        </div>
      )}
      <canvas ref={canvasRef} className="block select-none" />
    </div>
  );
};
