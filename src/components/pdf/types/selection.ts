export interface PDFSelection {
  text: string;
  rect: { x: number; y: number; w: number; h: number; page: number } | null;
  position: { x: number; y: number; pageX: number; pageY: number } | null;
}
