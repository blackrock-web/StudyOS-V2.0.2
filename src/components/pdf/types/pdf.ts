export interface PDFDocument {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedAt?: string;
  subject?: string;
  /** Offline data URL or blob URL for the PDF binary */
  sourceUrl?: string;
}

export interface PDFTab {
  id: string; // matches pdf id
  name: string;
  currentPage: number;
  zoom: number;
  rotation: number;
  scrollPosition: number;
  bookmarks: number[]; // page numbers
  isPinned?: boolean;
  /** Offline source used by pdf.js (data: or blob:) */
  sourceUrl?: string;
}
