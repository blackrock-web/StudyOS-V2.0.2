import { useState } from "react";
import { PDFSelection } from "../types/selection";

export function usePDFSelection() {
  const [selection, setSelection] = useState<PDFSelection | null>(null);

  const clearSelection = () => {
    setSelection(null);
    if (typeof window !== "undefined") {
      const sel = window.getSelection();
      if (sel) sel.removeAllRanges();
    }
  };

  const updateSelection = (
    text: string,
    rect: { x: number; y: number; w: number; h: number; page: number } | null,
    position: { x: number; y: number; pageX: number; pageY: number } | null
  ) => {
    if (!text.trim() && !rect) {
      clearSelection();
      return;
    }
    setSelection({ text, rect, position });
  };

  return {
    selection,
    clearSelection,
    updateSelection,
  };
}
