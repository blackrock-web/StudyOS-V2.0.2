import { useState, useEffect } from "react";
import { PDFAnnotation } from "../types/annotation";
import { storageService } from "../services/storageService";

export function usePDFAnnotations(pdfId: string | null) {
  const [annotations, setAnnotations] = useState<PDFAnnotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTool, setActiveTool] = useState<"pan" | "select" | "highlight" | "underline" | "strikethrough" | "drawing" | "rectangle" | "circle" | "arrow" | "eraser">("pan");
  const [activeColor, setActiveColor] = useState("#a855f7"); // default purple
  const [strokeThickness, setStrokeThickness] = useState(3);
  const [strokeOpacity, setStrokeOpacity] = useState(0.8);

  useEffect(() => {
    if (!pdfId) {
      setAnnotations([]);
      return;
    }
    storageService.getAnnotations(pdfId).then((saved) => {
      setAnnotations(saved || []);
    });
  }, [pdfId]);

  const addAnnotation = async (ann: Omit<PDFAnnotation, "id" | "createdAt">) => {
    const newAnn: PDFAnnotation = {
      ...ann,
      id: `ann-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...annotations, newAnn];
    setAnnotations(updated);
    await storageService.saveAnnotation(newAnn);
    return newAnn;
  };

  const removeAnnotation = async (id: string) => {
    const updated = annotations.filter((a) => a.id !== id);
    setAnnotations(updated);
    await storageService.deleteAnnotation(id);
  };

  const clearAllAnnotations = async () => {
    if (!pdfId) return;
    setAnnotations([]);
    await storageService.deleteAnnotationsForPdf(pdfId);
  };

  const getAnnotationsForPage = (pageNumber: number) => {
    return annotations.filter((ann) => ann.page === pageNumber);
  };

  return {
    annotations,
    setAnnotations,
    addAnnotation,
    removeAnnotation,
    clearAllAnnotations,
    getAnnotationsForPage,
    isDrawing,
    setIsDrawing,
    activeTool,
    setActiveTool,
    activeColor,
    setActiveColor,
    strokeThickness,
    setStrokeThickness,
    strokeOpacity,
    setStrokeOpacity,
  };
}
