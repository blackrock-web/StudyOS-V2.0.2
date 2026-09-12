export class PDFService {
  private pdfjsInstance: any = null;

  public async getPDFJS(): Promise<any> {
    if (typeof window === "undefined") return null;
    if (this.pdfjsInstance) return this.pdfjsInstance;
    if ((window as any).pdfjsLib) {
      this.pdfjsInstance = (window as any).pdfjsLib;
      return this.pdfjsInstance;
    }

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if ((window as any).pdfjsLib) {
          clearInterval(checkInterval);
          this.pdfjsInstance = (window as any).pdfjsLib;
          resolve(this.pdfjsInstance);
        }
      }, 50);

      // Timeout after 10s
      setTimeout(() => {
        clearInterval(checkInterval);
        if ((window as any).pdfjsLib) {
          this.pdfjsInstance = (window as any).pdfjsLib;
          resolve(this.pdfjsInstance);
        } else {
          reject(new Error("PDF.js library failed to load in a timely manner."));
        }
      }, 10000);
    });
  }

  public async loadDocument(source: string | ArrayBuffer | Uint8Array): Promise<unknown> {
    const pdfjs = await this.getPDFJS();
    if (!pdfjs) throw new Error("PDF.js is not loaded");

    const { withPdfParseTimeout, validatePdfDocument, PDF_SECURITY_LIMITS } = await import(
      '../../../services/pdfSecurity'
    );

    // Offline-only: accept data URL, blob URL, or ArrayBuffer — never remote /api paths
    let loadingTask: { promise: Promise<{ numPages: number }> };
    if (typeof source === "string") {
      if (source.startsWith("/api/")) {
        throw new Error("Remote PDF endpoints are disabled in offline StudyOS");
      }
      if (
        !source.startsWith("blob:") &&
        !source.startsWith("data:") &&
        !source.startsWith("file:") &&
        !source.startsWith("./") &&
        !source.startsWith("/")
      ) {
        throw new Error("Unsupported PDF source for offline mode");
      }
      loadingTask = pdfjs.getDocument({ url: source });
    } else {
      const bytes = source instanceof Uint8Array ? source.byteLength : (source as ArrayBuffer).byteLength;
      if (bytes > PDF_SECURITY_LIMITS.maxFileBytes) {
        throw new Error(`PDF exceeds max size (${PDF_SECURITY_LIMITS.maxFileBytes} bytes)`);
      }
      loadingTask = pdfjs.getDocument({ data: source });
    }

    const doc = await withPdfParseTimeout(loadingTask.promise);
    const guard = validatePdfDocument(doc);
    if (!guard.ok) throw new Error(guard.error || 'PDF rejected');
    return doc;
  }

  public async renderPage(
    page: any,
    canvas: HTMLCanvasElement,
    scale: number = 1.5,
    rotation: number = 0
  ): Promise<{ width: number; height: number }> {
    const viewport = page.getViewport({ scale, rotation });
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create 2D canvas context");

    // Adjust canvas resolution for high-DPI displays (retina)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewport.width * dpr;
    canvas.height = viewport.height * dpr;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    context.scale(dpr, dpr);

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
    return { width: viewport.width, height: viewport.height };
  }

  public async getPageText(page: any): Promise<any> {
    return page.getTextContent();
  }

  public async getPageOutline(pdfDocument: any): Promise<any[]> {
    try {
      const outline = await pdfDocument.getOutline();
      return outline || [];
    } catch (e) {
      console.warn("Could not load PDF outline:", e);
      return [];
    }
  }

  public async renderThumbnail(
    page: any,
    canvas: HTMLCanvasElement,
    widthLimit: number = 120
  ): Promise<void> {
    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = widthLimit / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
  }
}

export const pdfService = new PDFService();
