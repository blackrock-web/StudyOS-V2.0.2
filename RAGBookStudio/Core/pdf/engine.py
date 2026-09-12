"""
PDF Engine – extraction of text, images, tables, metadata, TOC, bookmarks.
Supports normal, scanned, multi-column, and password-protected PDFs.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class PDFPage:
    page_number: int  # 1-based
    width: float
    height: float
    text: str = ""
    images: List[Dict[str, Any]] = field(default_factory=list)
    tables: List[Dict[str, Any]] = field(default_factory=list)
    is_scanned: bool = False
    rotation: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PDFDocument:
    file_id: str
    path: str
    title: Optional[str] = None
    author: Optional[str] = None
    subject: Optional[str] = None
    keywords: Optional[str] = None
    creator: Optional[str] = None
    producer: Optional[str] = None
    page_count: int = 0
    pages: List[PDFPage] = field(default_factory=list)
    toc: List[Dict[str, Any]] = field(default_factory=list)
    bookmarks: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    is_encrypted: bool = False
    is_scanned: bool = False


class PDFEngine:
    """
    High-level PDF processing engine.
    Uses PyMuPDF (fitz) as the primary backend; falls back gracefully.
    OCR is delegated to an injected OCRProvider when a page is detected as scanned.
    """

    def __init__(self, ocr_provider: Any = None):
        self.ocr_provider = ocr_provider
        self._fitz = None
        try:
            import fitz  # PyMuPDF
            self._fitz = fitz
        except ImportError:
            logger.warning("PyMuPDF not installed. PDF parsing will be limited.")

    def _ensure_fitz(self):
        if self._fitz is None:
            raise RuntimeError(
                "PyMuPDF (fitz) is required for PDF processing. "
                "Install with: pip install pymupdf"
            )
        return self._fitz

    @staticmethod
    def compute_file_id(path: str | Path) -> str:
        path = Path(path)
        h = hashlib.sha256()
        h.update(path.name.encode("utf-8"))
        with open(path, "rb") as f:
            # Hash first 64 KB + file size for speed
            h.update(f.read(65536))
            h.update(str(path.stat().st_size).encode())
        return h.hexdigest()[:16]

    def open(
        self,
        path: str | Path,
        password: Optional[str] = None,
        extract_images: bool = True,
        extract_tables: bool = True,
        ocr_if_needed: bool = True,
        max_pages: Optional[int] = None,
    ) -> PDFDocument:
        fitz = self._ensure_fitz()
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(path)

        file_id = self.compute_file_id(path)
        doc = fitz.open(str(path))

        if doc.is_encrypted:
            if password is None:
                doc.close()
                raise PermissionError("PDF is password-protected and no password was provided")
            if not doc.authenticate(password):
                doc.close()
                raise PermissionError("Incorrect PDF password")

        meta = doc.metadata or {}
        pdf_doc = PDFDocument(
            file_id=file_id,
            path=str(path.resolve()),
            title=meta.get("title") or path.stem,
            author=meta.get("author"),
            subject=meta.get("subject"),
            keywords=meta.get("keywords"),
            creator=meta.get("creator"),
            producer=meta.get("producer"),
            page_count=len(doc),
            is_encrypted=doc.is_encrypted,
            toc=self._extract_toc(doc),
            bookmarks=self._extract_bookmarks(doc),
            metadata=dict(meta),
        )

        page_count = len(doc)
        if max_pages is not None:
            page_count = min(page_count, max_pages)

        scanned_count = 0
        for i in range(page_count):
            page = doc[i]
            pdf_page = self._process_page(
                page,
                page_number=i + 1,
                extract_images=extract_images,
                extract_tables=extract_tables,
                ocr_if_needed=ocr_if_needed,
            )
            if pdf_page.is_scanned:
                scanned_count += 1
            pdf_doc.pages.append(pdf_page)

        pdf_doc.is_scanned = scanned_count > page_count * 0.5  # majority rule
        doc.close()
        return pdf_doc

    def _process_page(
        self,
        page: Any,
        page_number: int,
        extract_images: bool,
        extract_tables: bool,
        ocr_if_needed: bool,
    ) -> PDFPage:
        rect = page.rect
        text = page.get_text("text") or ""
        is_scanned = len(text.strip()) < 30  # heuristic

        images: List[Dict[str, Any]] = []
        if extract_images:
            images = self._extract_images(page)

        tables: List[Dict[str, Any]] = []
        if extract_tables:
            tables = self._extract_tables(page)

        if is_scanned and ocr_if_needed and self.ocr_provider is not None:
            try:
                # Render page to image and OCR
                pix = page.get_pixmap(matrix=self._fitz.Matrix(2, 2))  # 2x zoom
                img_bytes = pix.tobytes("png")
                ocr_result = self.ocr_provider.recognize(img_bytes)
                text = ocr_result.text
                is_scanned = True
            except Exception as e:
                logger.warning("OCR failed on page %d: %s", page_number, e)

        return PDFPage(
            page_number=page_number,
            width=rect.width,
            height=rect.height,
            text=text,
            images=images,
            tables=tables,
            is_scanned=is_scanned,
            rotation=page.rotation,
        )

    def _extract_images(self, page: Any) -> List[Dict[str, Any]]:
        images = []
        try:
            for img_index, img in enumerate(page.get_images(full=True)):
                xref = img[0]
                images.append(
                    {
                        "index": img_index,
                        "xref": xref,
                        "width": img[2],
                        "height": img[3],
                    }
                )
        except Exception as e:
            logger.debug("Image extraction error: %s", e)
        return images

    def _extract_tables(self, page: Any) -> List[Dict[str, Any]]:
        """
        Basic table detection via PyMuPDF's find_tables (available in recent versions).
        Falls back to empty list if not supported.
        """
        tables = []
        try:
            if hasattr(page, "find_tables"):
                finder = page.find_tables()
                for t_idx, table in enumerate(finder.tables):
                    tables.append(
                        {
                            "index": t_idx,
                            "bbox": list(table.bbox) if hasattr(table, "bbox") else None,
                            "rows": table.extract() if hasattr(table, "extract") else [],
                        }
                    )
        except Exception as e:
            logger.debug("Table extraction error: %s", e)
        return tables

    def _extract_toc(self, doc: Any) -> List[Dict[str, Any]]:
        toc = []
        try:
            for item in doc.get_toc():
                # item = [level, title, page]
                if len(item) >= 3:
                    toc.append(
                        {
                            "level": item[0],
                            "title": item[1],
                            "page": item[2],
                        }
                    )
        except Exception:
            pass
        return toc

    def _extract_bookmarks(self, doc: Any) -> List[Dict[str, Any]]:
        # In PyMuPDF, TOC and bookmarks are largely the same
        return self._extract_toc(doc)

    def extract_text_only(self, path: str | Path, password: Optional[str] = None) -> str:
        """Fast path: concatenate all page text."""
        pdf = self.open(path, password=password, extract_images=False, extract_tables=False, ocr_if_needed=False)
        return "\n\n".join(p.text for p in pdf.pages)

    def get_page_image(
        self,
        path: str | Path,
        page_number: int,
        dpi: int = 150,
        password: Optional[str] = None,
    ) -> bytes:
        """Render a single page to PNG bytes."""
        fitz = self._ensure_fitz()
        doc = fitz.open(str(path))
        if doc.is_encrypted and password:
            doc.authenticate(password)
        page = doc[page_number - 1]
        zoom = dpi / 72
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        data = pix.tobytes("png")
        doc.close()
        return data
