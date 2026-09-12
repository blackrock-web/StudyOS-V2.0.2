import { useState, useEffect } from "react";
import { pdfService } from "../services/pdfService";

/**
 * Load a PDF from an offline-capable source.
 * Prefer data:/blob: URLs stored on the tab; fall back to filename only when it is already a valid local URL.
 */
export function usePDFDocument(source: string | null) {
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [outline, setOutline] = useState<any[]>([]);

  useEffect(() => {
    if (!source) {
      setPdfDocument(null);
      setNumPages(0);
      setOutline([]);
      setError(null);
      return;
    }

    // Reject bare filenames that are not loadable offline (prevents silent failure)
    const isLoadable =
      source.startsWith("data:") ||
      source.startsWith("blob:") ||
      source.startsWith("file:") ||
      source.startsWith("./") ||
      source.startsWith("/") ||
      source.startsWith("http://") ||
      source.startsWith("https://");

    if (!isLoadable) {
      setPdfDocument(null);
      setNumPages(0);
      setOutline([]);
      setError(
        "PDF binary is not available offline. Please re-select the file from your device."
      );
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    pdfService
      .loadDocument(source)
      .then((doc: any) => {
        if (cancelled) return;
        setPdfDocument(doc);
        setNumPages(doc.numPages);
        pdfService.getPageOutline(doc).then((out) => {
          if (!cancelled) setOutline(out || []);
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load PDF:", err);
        setError(`Failed to load PDF document: ${err.message || err}`);
        setPdfDocument(null);
        setNumPages(0);
        setOutline([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [source]);

  return {
    pdfDocument,
    loading,
    error,
    numPages,
    outline,
  };
}
