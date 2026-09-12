import { useState } from "react";
import { PDFAnnotation } from "../types/annotation";

export function usePDFHistory(initialAnnotations: PDFAnnotation[] = []) {
  const [annotations, setAnnotations] = useState<PDFAnnotation[]>(initialAnnotations);
  const [undoStack, setUndoStack] = useState<PDFAnnotation[][]>([]);
  const [redoStack, setRedoStack] = useState<PDFAnnotation[][]>([]);

  const pushState = (newAnnotations: PDFAnnotation[]) => {
    setUndoStack((prev) => [...prev, annotations]);
    setRedoStack([]); // Clear redo
    setAnnotations(newAnnotations);
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    if (previous) {
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, annotations]);
      setAnnotations(previous);
    }
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    if (next) {
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev, annotations]);
      setAnnotations(next);
    }
  };

  return {
    annotations,
    setAnnotations,
    pushState,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0
  };
}
