import { PDFTab } from "../types/pdf";
import { PDFAnnotation } from "../types/annotation";

const DB_NAME = "StudyOS_PDF_Workspace_DB";
const DB_VERSION = 2;

class StorageService {
  private db: IDBDatabase | null = null;

  private initDB(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains("tabs")) {
          db.createObjectStore("tabs", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("annotations")) {
          db.createObjectStore("annotations", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("recentFiles")) {
          db.createObjectStore("recentFiles", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("pdfFiles")) {
          db.createObjectStore("pdfFiles", { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // --- TABS STORAGE ---
  public async getTabs(): Promise<PDFTab[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("tabs", "readonly");
      const store = transaction.objectStore("tabs");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  public async saveTab(tab: PDFTab): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("tabs", "readwrite");
      const store = transaction.objectStore("tabs");
      const request = store.put(tab);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteTab(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("tabs", "readwrite");
      const store = transaction.objectStore("tabs");
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async clearTabs(): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("tabs", "readwrite");
      const store = transaction.objectStore("tabs");
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- ANNOTATIONS STORAGE ---
  public async getAnnotations(pdfId: string): Promise<PDFAnnotation[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("annotations", "readonly");
      const store = transaction.objectStore("annotations");
      const request = store.getAll();

      request.onsuccess = () => {
        const all = request.result || [];
        const filtered = all.filter((ann) => ann.pdfId === pdfId);
        resolve(filtered);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async saveAnnotation(annotation: PDFAnnotation): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("annotations", "readwrite");
      const store = transaction.objectStore("annotations");
      const request = store.put(annotation);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async saveAnnotations(annotations: PDFAnnotation[]): Promise<void> {
    if (annotations.length === 0) return;
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("annotations", "readwrite");
      const store = transaction.objectStore("annotations");
      
      let errorOccurred = false;
      annotations.forEach((ann) => {
        const req = store.put(ann);
        req.onerror = () => {
          errorOccurred = true;
        };
      });

      transaction.oncomplete = () => {
        if (errorOccurred) reject(new Error("Some annotations failed to save"));
        else resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  public async deleteAnnotation(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("annotations", "readwrite");
      const store = transaction.objectStore("annotations");
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteAnnotationsForPdf(pdfId: string): Promise<void> {
    const db = await this.initDB();
    const annotations = await this.getAnnotations(pdfId);
    if (annotations.length === 0) return;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction("annotations", "readwrite");
      const store = transaction.objectStore("annotations");
      annotations.forEach((ann) => {
        store.delete(ann.id);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // --- RECENT FILES ---
  public async getRecentFiles(): Promise<string[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("recentFiles", "readonly");
      const store = transaction.objectStore("recentFiles");
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        // Sort by timestamp if available or reverse order
        resolve(results.map((r) => r.name));
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async addRecentFile(name: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("recentFiles", "readwrite");
      const store = transaction.objectStore("recentFiles");
      const request = store.put({ id: name, name, timestamp: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- PDF FILE BINARY STORAGE (offline data URLs) ---
  public async savePdfFile(id: string, name: string, dataUrl: string, size?: number): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("pdfFiles", "readwrite");
      const store = transaction.objectStore("pdfFiles");
      const request = store.put({
        id,
        name,
        dataUrl,
        size: size ?? 0,
        uploadedAt: new Date().toISOString(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getPdfFile(id: string): Promise<{ id: string; name: string; dataUrl: string; size?: number } | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("pdfFiles", "readonly");
      const store = transaction.objectStore("pdfFiles");
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  public async listPdfFiles(): Promise<Array<{ id: string; name: string; dataUrl: string; size?: number; uploadedAt?: string }>> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("pdfFiles", "readonly");
      const store = transaction.objectStore("pdfFiles");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  public async deletePdfFile(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("pdfFiles", "readwrite");
      const store = transaction.objectStore("pdfFiles");
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const storageService = new StorageService();
