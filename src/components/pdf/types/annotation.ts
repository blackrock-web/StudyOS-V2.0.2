export interface PDFAnnotation {
  id: string;
  pdfId: string;
  page: number;
  type: "highlight" | "underline" | "strikethrough" | "drawing" | "rectangle" | "circle" | "arrow" | "sticky-note";
  color: string;
  text?: string;
  author?: string;
  coordinates?: { x: number; y: number; w: number; h: number };
  points?: { x: number; y: number }[]; // freehand points
  thickness?: number;
  opacity?: number;
  createdAt: string;
}
