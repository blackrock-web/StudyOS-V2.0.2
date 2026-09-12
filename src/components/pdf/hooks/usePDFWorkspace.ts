import { useState, useEffect, useCallback } from "react";
import { PDFDocument } from "../types/pdf";
import { storageService } from "../services/storageService";

function formatSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function usePDFWorkspace() {
  const [localFiles, setLocalFiles] = useState<PDFDocument[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [errorFiles, setErrorFiles] = useState<string | null>(null);

  const scanWorkspaceFiles = useCallback(async () => {
    setLoadingFiles(true);
    setErrorFiles(null);
    try {
      const files = await storageService.listPdfFiles();
      setLocalFiles(
        files.map((f) => ({
          id: f.id,
          name: f.name,
          size: formatSize(f.size),
          type: "pdf",
          uploadedAt: f.uploadedAt,
          sourceUrl: f.dataUrl,
        }))
      );
    } catch (err: unknown) {
      console.error("Error scanning workspace files:", err);
      setErrorFiles(err instanceof Error ? err.message : "Failed to scan workspace files.");
      setLocalFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    scanWorkspaceFiles();
  }, [scanWorkspaceFiles]);

  return {
    localFiles,
    loadingFiles,
    errorFiles,
    scanWorkspaceFiles,
  };
}
