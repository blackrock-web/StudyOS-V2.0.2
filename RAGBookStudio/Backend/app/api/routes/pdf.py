"""PDF upload, parsing, indexing, page rendering endpoints."""

from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
import uuid
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from Core.pdf.engine import PDFEngine
from Workers.task_queue import get_task_queue

router = APIRouter()

STORAGE_ROOT = Path(__file__).resolve().parents[4] / "Storage" / "workspaces"


class IndexRequest(BaseModel):
    workspace_id: str
    file_id: str
    strategy: str = "paragraph"
    chunk_size: int = 512
    chunk_overlap: int = 64
    embedding_model: Optional[str] = None
    ocr_provider: Optional[str] = None


class BatchIndexRequest(BaseModel):
    workspace_id: str
    file_ids: List[str]
    strategy: str = "paragraph"
    chunk_size: int = 512


def _content_hash(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _ingest_pdf_from_path(workspace_id: str, ws_path: Path, original_name: str, src: Path) -> Dict[str, Any]:
    """
    Move an already-saved PDF (from a batch upload or an extracted zip) into
    the workspace's books/ folder, parse it, persist metadata, and queue it
    for automatic indexing. Shared by /upload/batch and /upload/zip so both
    "many files" and "one zip of many files" behave identically.
    """
    books_dir = ws_path / "books"
    books_dir.mkdir(exist_ok=True)

    file_id = str(uuid.uuid4())
    dest = books_dir / f"{file_id}.pdf"
    shutil.move(str(src), str(dest))

    content_hash = _content_hash(dest)
    for existing in books_dir.glob("*.json"):
        if existing.name.endswith(".chunks.json"):
            continue
        try:
            em = json.loads(existing.read_text(encoding="utf-8"))
            if em.get("content_hash") == content_hash:
                dest.unlink(missing_ok=True)
                return {"file_id": em["file_id"], "title": em.get("title"), "duplicate": True, "filename": original_name}
        except Exception:
            continue

    engine = PDFEngine()
    try:
        pdf_doc = engine.open(dest, extract_images=False, extract_tables=False, ocr_if_needed=False)
    except Exception as e:
        dest.unlink(missing_ok=True)
        return {"error": str(e), "filename": original_name}

    meta = {
        "file_id": file_id, "original_name": original_name, "path": str(dest),
        "title": pdf_doc.title, "page_count": pdf_doc.page_count,
        "is_scanned": pdf_doc.is_scanned, "toc": pdf_doc.toc,
        "uploaded_at": datetime.utcnow().isoformat() + "Z", "status": "parsed",
        "content_hash": content_hash, "tags": [], "folder": "", "chunk_count": 0,
    }
    (books_dir / f"{file_id}.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    ws_meta_path = ws_path / "workspace.json"
    ws_meta = json.loads(ws_meta_path.read_text(encoding="utf-8"))
    ws_meta.setdefault("books", []).append({
        "file_id": file_id, "title": pdf_doc.title, "page_count": pdf_doc.page_count,
        "original_name": original_name, "tags": [], "folder": "", "status": "parsed",
    })
    ws_meta["updated_at"] = datetime.utcnow().isoformat() + "Z"
    ws_meta_path.write_text(json.dumps(ws_meta, indent=2), encoding="utf-8")

    task = get_task_queue().submit(
        name=f"Index {pdf_doc.title or file_id[:8]}",
        task_type="index", workspace_id=workspace_id, file_id=file_id,
        meta={"strategy": "paragraph", "chunk_size": 512, "chunk_overlap": 64},
    )
    return {
        "file_id": file_id, "title": pdf_doc.title, "page_count": pdf_doc.page_count,
        "duplicate": False, "task_id": task.id, "filename": original_name,
    }


@router.post("/upload/zip")
async def upload_zip(
    workspace_id: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Drop a single .zip containing multiple PDFs (e.g. a whole book set) and
    have every PDF inside it parsed, indexed, and made searchable
    automatically — no need to select each file individually.
    """
    ws_path = STORAGE_ROOT / workspace_id
    if not ws_path.exists():
        raise HTTPException(status_code=404, detail="Workspace not found")
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Expected a .zip file")

    results: List[Dict[str, Any]] = []
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        zip_path = tmp_path / "upload.zip"
        with zip_path.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        try:
            with zipfile.ZipFile(zip_path) as zf:
                names = [
                    n for n in zf.namelist()
                    if n.lower().endswith(".pdf") and not n.startswith("__MACOSX")
                ]
                if not names:
                    raise HTTPException(status_code=400, detail="Zip contains no PDF files")
                extract_dir = tmp_path / "extracted"
                extract_dir.mkdir()
                for n in names:
                    zf.extract(n, extract_dir)
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Not a valid zip archive")

        for n in names:
            src = extract_dir / n
            if not src.exists() or not src.is_file():
                results.append({"error": "not found after extraction", "filename": n})
                continue
            results.append(_ingest_pdf_from_path(workspace_id, ws_path, Path(n).name, src))

    processed = sum(1 for r in results if not r.get("error"))
    return {"results": results, "processed": processed, "total": len(results)}


@router.post("/upload")
async def upload_pdf(
    workspace_id: str = Form(...),
    password: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    folder: Optional[str] = Form(None),
    file: UploadFile = File(...),
):
    ws_path = STORAGE_ROOT / workspace_id
    if not ws_path.exists():
        raise HTTPException(status_code=404, detail="Workspace not found")

    books_dir = ws_path / "books"
    books_dir.mkdir(exist_ok=True)

    # Temp save for hash check
    file_id = str(uuid.uuid4())
    dest = books_dir / f"{file_id}.pdf"
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    content_hash = _content_hash(dest)

    # Duplicate detection
    for existing in books_dir.glob("*.json"):
        if existing.name.endswith(".chunks.json"):
            continue
        try:
            em = json.loads(existing.read_text(encoding="utf-8"))
            if em.get("content_hash") == content_hash:
                dest.unlink(missing_ok=True)
                return {
                    "file_id": em["file_id"],
                    "title": em.get("title"),
                    "page_count": em.get("page_count"),
                    "duplicate": True,
                    "message": "Duplicate detected – returning existing book",
                }
        except Exception:
            continue

    engine = PDFEngine()
    try:
        pdf_doc = engine.open(dest, password=password, extract_images=False, extract_tables=True, ocr_if_needed=False)
    except PermissionError as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {e}")

    tag_list = [t.strip() for t in (tags or "").split(",") if t.strip()]
    meta = {
        "file_id": file_id,
        "original_name": file.filename,
        "path": str(dest),
        "title": pdf_doc.title,
        "author": pdf_doc.author,
        "page_count": pdf_doc.page_count,
        "is_scanned": pdf_doc.is_scanned,
        "toc": pdf_doc.toc,
        "uploaded_at": datetime.utcnow().isoformat() + "Z",
        "status": "parsed",
        "content_hash": content_hash,
        "tags": tag_list,
        "folder": folder or "",
        "chunk_count": 0,
    }
    (books_dir / f"{file_id}.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    ws_meta_path = ws_path / "workspace.json"
    ws_meta = json.loads(ws_meta_path.read_text(encoding="utf-8"))
    ws_meta.setdefault("books", []).append({
        "file_id": file_id,
        "title": pdf_doc.title,
        "page_count": pdf_doc.page_count,
        "original_name": file.filename,
        "tags": tag_list,
        "folder": folder or "",
        "status": "parsed",
    })
    ws_meta["updated_at"] = datetime.utcnow().isoformat() + "Z"
    ws_meta_path.write_text(json.dumps(ws_meta, indent=2), encoding="utf-8")

    # Auto-submit indexing
    queue = get_task_queue()
    task = queue.submit(
        name=f"Index {pdf_doc.title or file_id[:8]}",
        task_type="index",
        workspace_id=workspace_id,
        file_id=file_id,
        meta={"strategy": "paragraph", "chunk_size": 512, "chunk_overlap": 64},
    )

    return {
        "file_id": file_id,
        "title": pdf_doc.title,
        "page_count": pdf_doc.page_count,
        "is_scanned": pdf_doc.is_scanned,
        "toc": pdf_doc.toc[:30],
        "duplicate": False,
        "task_id": task.id,
        "tags": tag_list,
    }


@router.post("/upload/batch")
async def upload_batch(
    workspace_id: str = Form(...),
    files: List[UploadFile] = File(...),
):
    results = []
    for file in files:
        # Reuse single upload logic via internal call pattern
        ws_path = STORAGE_ROOT / workspace_id
        if not ws_path.exists():
            raise HTTPException(status_code=404, detail="Workspace not found")
        books_dir = ws_path / "books"
        books_dir.mkdir(exist_ok=True)
        file_id = str(uuid.uuid4())
        dest = books_dir / f"{file_id}.pdf"
        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)
        content_hash = _content_hash(dest)
        dup = False
        for existing in books_dir.glob("*.json"):
            if existing.name.endswith(".chunks.json"):
                continue
            try:
                em = json.loads(existing.read_text(encoding="utf-8"))
                if em.get("content_hash") == content_hash:
                    dest.unlink(missing_ok=True)
                    results.append({"file_id": em["file_id"], "title": em.get("title"), "duplicate": True})
                    dup = True
                    break
            except Exception:
                continue
        if dup:
            continue
        engine = PDFEngine()
        try:
            pdf_doc = engine.open(dest, extract_images=False, extract_tables=False, ocr_if_needed=False)
        except Exception as e:
            dest.unlink(missing_ok=True)
            results.append({"error": str(e), "filename": file.filename})
            continue
        meta = {
            "file_id": file_id, "original_name": file.filename, "path": str(dest),
            "title": pdf_doc.title, "page_count": pdf_doc.page_count,
            "is_scanned": pdf_doc.is_scanned, "toc": pdf_doc.toc,
            "uploaded_at": datetime.utcnow().isoformat() + "Z", "status": "parsed",
            "content_hash": content_hash, "tags": [], "folder": "", "chunk_count": 0,
        }
        (books_dir / f"{file_id}.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
        ws_meta_path = ws_path / "workspace.json"
        ws_meta = json.loads(ws_meta_path.read_text(encoding="utf-8"))
        ws_meta.setdefault("books", []).append({
            "file_id": file_id, "title": pdf_doc.title, "page_count": pdf_doc.page_count,
            "original_name": file.filename, "tags": [], "folder": "", "status": "parsed",
        })
        ws_meta["updated_at"] = datetime.utcnow().isoformat() + "Z"
        ws_meta_path.write_text(json.dumps(ws_meta, indent=2), encoding="utf-8")
        task = get_task_queue().submit(
            name=f"Index {pdf_doc.title or file_id[:8]}",
            task_type="index", workspace_id=workspace_id, file_id=file_id,
            meta={"strategy": "paragraph", "chunk_size": 512},
        )
        results.append({
            "file_id": file_id, "title": pdf_doc.title, "page_count": pdf_doc.page_count,
            "duplicate": False, "task_id": task.id,
        })
    return {"results": results}


@router.post("/index")
async def index_book(body: IndexRequest):
    ws_path = STORAGE_ROOT / body.workspace_id
    meta_path = ws_path / "books" / f"{body.file_id}.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Book not found")
    queue = get_task_queue()
    task = queue.submit(
        name=f"Index {body.file_id[:8]}",
        task_type="reindex",
        workspace_id=body.workspace_id,
        file_id=body.file_id,
        meta={
            "strategy": body.strategy,
            "chunk_size": body.chunk_size,
            "chunk_overlap": body.chunk_overlap,
            "embedding_model": body.embedding_model,
            "ocr_provider": body.ocr_provider,
        },
    )
    return task.to_dict()


@router.post("/index/batch")
async def index_batch(body: BatchIndexRequest):
    queue = get_task_queue()
    tasks = []
    for fid in body.file_ids:
        task = queue.submit(
            name=f"Index {fid[:8]}",
            task_type="reindex",
            workspace_id=body.workspace_id,
            file_id=fid,
            meta={"strategy": body.strategy, "chunk_size": body.chunk_size},
        )
        tasks.append(task.to_dict())
    return {"tasks": tasks}


@router.get("/{workspace_id}")
async def list_books(workspace_id: str):
    books_dir = STORAGE_ROOT / workspace_id / "books"
    if not books_dir.exists():
        return []
    books = []
    for f in books_dir.glob("*.json"):
        if f.name.endswith(".chunks.json"):
            continue
        try:
            books.append(json.loads(f.read_text(encoding="utf-8")))
        except Exception:
            continue
    books.sort(key=lambda b: b.get("uploaded_at") or "", reverse=True)
    return books


@router.get("/{workspace_id}/{file_id}")
async def get_pdf_meta(workspace_id: str, file_id: str):
    meta_path = STORAGE_ROOT / workspace_id / "books" / f"{file_id}.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Book not found")
    return json.loads(meta_path.read_text(encoding="utf-8"))


@router.get("/{workspace_id}/{file_id}/page/{page_number}")
async def get_page_text(workspace_id: str, file_id: str, page_number: int):
    meta_path = STORAGE_ROOT / workspace_id / "books" / f"{file_id}.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Book not found")
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    engine = PDFEngine()
    pdf = engine.open(meta["path"], extract_images=False, extract_tables=False, ocr_if_needed=False)
    if page_number < 1 or page_number > len(pdf.pages):
        raise HTTPException(status_code=400, detail="Invalid page number")
    page = pdf.pages[page_number - 1]
    return {
        "page_number": page.page_number,
        "text": page.text,
        "width": page.width,
        "height": page.height,
        "is_scanned": page.is_scanned,
    }


@router.get("/{workspace_id}/{file_id}/page/{page_number}/image")
async def get_page_image(workspace_id: str, file_id: str, page_number: int, dpi: int = 120):
    meta_path = STORAGE_ROOT / workspace_id / "books" / f"{file_id}.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Book not found")
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    engine = PDFEngine()
    try:
        data = engine.get_page_image(meta["path"], page_number, dpi=dpi)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return Response(content=data, media_type="image/png")


@router.delete("/{workspace_id}/{file_id}")
async def delete_book(workspace_id: str, file_id: str):
    books_dir = STORAGE_ROOT / workspace_id / "books"
    for pattern in [f"{file_id}.pdf", f"{file_id}.json", f"{file_id}.chunks.json"]:
        p = books_dir / pattern
        p.unlink(missing_ok=True)
    vec_dir = STORAGE_ROOT / workspace_id / "vectors" / file_id
    if vec_dir.exists():
        shutil.rmtree(vec_dir)
    # Update workspace meta
    ws_meta_path = STORAGE_ROOT / workspace_id / "workspace.json"
    if ws_meta_path.exists():
        ws = json.loads(ws_meta_path.read_text(encoding="utf-8"))
        ws["books"] = [b for b in ws.get("books", []) if b.get("file_id") != file_id]
        ws_meta_path.write_text(json.dumps(ws, indent=2), encoding="utf-8")
    return {"status": "deleted", "file_id": file_id}


@router.patch("/{workspace_id}/{file_id}")
async def update_book_meta(workspace_id: str, file_id: str, tags: Optional[str] = None, folder: Optional[str] = None, title: Optional[str] = None):
    meta_path = STORAGE_ROOT / workspace_id / "books" / f"{file_id}.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Book not found")
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    if tags is not None:
        meta["tags"] = [t.strip() for t in tags.split(",") if t.strip()]
    if folder is not None:
        meta["folder"] = folder
    if title is not None:
        meta["title"] = title
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta
