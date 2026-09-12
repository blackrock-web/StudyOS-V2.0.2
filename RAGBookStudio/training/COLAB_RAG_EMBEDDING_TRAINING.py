# ============================================================================
# RAGBook Studio — Production RAG Embedding Training Pipeline
# Single-cell Google Colab script (paste entire file into one Colab cell)
# Offline-first · Modular · Config-driven · CUDA/CPU auto-detect
# ============================================================================
"""
Usage (Google Colab):
  1. Runtime → Change runtime type → GPU (T4/A100 preferred)
  2. Paste this entire file into a single cell and run
  3. Optional: mount Drive for checkpoints (auto-prompted)
"""

# ---------------------------------------------------------------------------
# 0. Install dependencies
# ---------------------------------------------------------------------------
import subprocess, sys

def _pip(*pkgs):
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", *pkgs])

print("📦 Installing dependencies...")
_pip(
    "sentence-transformers>=3.0.0",
    "datasets>=2.18.0",
    "transformers>=4.40.0",
    "accelerate>=0.29.0",
    "rank_bm25>=0.2.2",
    "pymupdf>=1.24.0",
    "pyyaml>=6.0",
    "tqdm>=4.66.0",
    "scikit-learn>=1.4.0",
    "matplotlib>=3.8.0",
    "seaborn>=0.13.0",
    "onnx>=1.15.0",
    "onnxruntime>=1.17.0",
    "tensorboard>=2.16.0",
)
print("✅ Dependencies ready\n")

# ---------------------------------------------------------------------------
# 1. Imports & environment
# ---------------------------------------------------------------------------
from __future__ import annotations

import gc
import hashlib
import json
import logging
import math
import os
import random
import re
import shutil
import time
import uuid
import warnings
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Sequence, Tuple

import numpy as np
import torch
import yaml
from tqdm.auto import tqdm

warnings.filterwarnings("ignore", category=FutureWarning)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("rag_train")

# ---------------------------------------------------------------------------
# 2. Device detection
# ---------------------------------------------------------------------------
def detect_device() -> str:
    if torch.cuda.is_available():
        name = torch.cuda.get_device_name(0)
        mem = torch.cuda.get_device_properties(0).total_memory / 1e9
        log.info(f"🚀 CUDA: {name} ({mem:.1f} GB)")
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        log.info("🍎 Apple Metal (MPS)")
        return "mps"
    log.info("💻 CPU fallback")
    return "cpu"


DEVICE = detect_device()
USE_FP16 = DEVICE == "cuda"
USE_BF16 = DEVICE == "cuda" and torch.cuda.is_bf16_supported()

# ---------------------------------------------------------------------------
# 3. Google Drive (optional checkpoints)
# ---------------------------------------------------------------------------
DRIVE_ROOT: Optional[Path] = None
try:
    from google.colab import drive  # type: ignore
    drive.mount("/content/drive", force_remount=False)
    DRIVE_ROOT = Path("/content/drive/MyDrive/RAGBook_Training")
    DRIVE_ROOT.mkdir(parents=True, exist_ok=True)
    log.info(f"📁 Drive mounted: {DRIVE_ROOT}")
except Exception:
    log.info("📁 Local mode (Drive not available)")

# ---------------------------------------------------------------------------
# 4. Paths & config
# ---------------------------------------------------------------------------
WORKDIR = Path("/content/rag_training") if Path("/content").exists() else Path("./rag_training")
if DRIVE_ROOT:
    WORKDIR = DRIVE_ROOT

DIRS = {
    "data": WORKDIR / "datasets",
    "chunks": WORKDIR / "chunks",
    "queries": WORKDIR / "synthetic_queries",
    "triplets": WORKDIR / "triplets",
    "checkpoints": WORKDIR / "checkpoints",
    "models": WORKDIR / "models",
    "logs": WORKDIR / "logs",
    "eval": WORKDIR / "evaluation",
    "export": WORKDIR / "export",
    "pdfs": WORKDIR / "pdfs",
}
for d in DIRS.values():
    d.mkdir(parents=True, exist_ok=True)


@dataclass
class TrainConfig:
    # Model
    base_model: str = "BAAI/bge-small-en-v1.5"
    # Alternatives: BAAI/bge-base-en-v1.5 | BAAI/bge-large-en-v1.5
    #               intfloat/e5-base-v2 | jinaai/jina-embeddings-v2-base-en

    # Chunking
    chunk_tokens: int = 256
    chunk_overlap_tokens: int = 32
    min_chunk_tokens: int = 32
    max_chunk_tokens: int = 512

    # Synthetic queries per chunk
    queries_per_chunk: int = 4

    # Negatives
    hard_negatives_per_query: int = 3
    bm25_negatives: int = 2
    embedding_negatives: int = 2

    # Training
    epochs: int = 3
    batch_size: int = 16
    grad_accum_steps: int = 2
    learning_rate: float = 2e-5
    warmup_ratio: float = 0.1
    weight_decay: float = 0.01
    max_seq_length: int = 512
    evaluation_steps: int = 100
    save_steps: int = 200
    early_stopping_patience: int = 3
    seed: int = 42

    # Data
    max_public_samples: int = 5000  # limit for Colab memory
    ncert_pdf_glob: str = "**/*.pdf"
    # Path to a folder containing one or more .zip files (each zip may hold many PDFs).
    # Examples (Colab):
    #   "/content/drive/MyDrive/NCERT_Zips"
    #   "/content/my_zips"
    # Leave empty to only use PDFs already under pdfs/ or public datasets.
    zip_folder: str = ""
    train_ratio: float = 0.85
    val_ratio: float = 0.10
    # test = remainder

    # Export
    export_onnx: bool = True
    model_name: str = "ragbook-bge-small-ncert"


CFG = TrainConfig()

# >>> SET YOUR ZIP FOLDER PATH HERE (folder that contains multiple .zip files) <<<
# CFG.zip_folder = "/content/drive/MyDrive/NCERT_Zips"
# CFG.zip_folder = "/content/my_zips"
# Leave as "" to skip ZIP ingestion and only use pdfs/ or public data.

random.seed(CFG.seed)
np.random.seed(CFG.seed)
torch.manual_seed(CFG.seed)

# Persist config
with open(DIRS["logs"] / "train_config.yaml", "w") as f:
    yaml.dump(asdict(CFG), f)
log.info(f"⚙️  Config saved · workdir={WORKDIR}")

# ---------------------------------------------------------------------------
# 5. Text utilities
# ---------------------------------------------------------------------------
_WS_RE = re.compile(r"[ \t]+")
_BLANK_RE = re.compile(r"\n{3,}")
_HEADING_RE = re.compile(
    r"^(?:"
    r"Chapter\s+\d+[.:)\s].*|"
    r"CHAPTER\s+\d+[.:)\s].*|"
    r"Unit\s+\d+[.:)\s].*|"
    r"Section\s+\d+[.:)\s].*|"
    r"#{1,3}\s+.+|"
    r"\d+\.\d*\s+[A-Z][A-Za-z0-9 ,\-–—:]{3,80}$|"
    r"[A-Z][A-Z0-9 ,\-–—]{4,60}$"
    r")$",
    re.MULTILINE,
)


def normalize_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _WS_RE.sub(" ", text)
    text = _BLANK_RE.sub("\n\n", text)
    return text.strip()


def approx_token_count(text: str) -> int:
    # ~1.3 words per token for English educational text
    return max(1, int(len(text.split()) / 0.75))


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


# ---------------------------------------------------------------------------
# 6. Chunk dataclass
# ---------------------------------------------------------------------------
@dataclass
class Chunk:
    chunk_id: str
    text: str
    subject: str = ""
    filename: str = ""
    page: int = 0
    chapter: str = ""
    section: str = ""
    chunk_index: int = 0
    token_count: int = 0
    source: str = "pdf"  # pdf | public

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ---------------------------------------------------------------------------
# 7. PDF processing — chapter / heading aware
# ---------------------------------------------------------------------------
def extract_pdf_pages(pdf_path: Path) -> List[Dict[str, Any]]:
    """Extract per-page text with basic structure signals."""
    import fitz  # PyMuPDF

    doc = fitz.open(str(pdf_path))
    pages = []
    for i in range(len(doc)):
        page = doc[i]
        text = page.get_text("text") or ""
        text = normalize_text(text)
        # Detect headings on this page
        headings = [m.group(0).strip() for m in _HEADING_RE.finditer(text)]
        pages.append({
            "page": i + 1,
            "text": text,
            "headings": headings,
            "char_count": len(text),
        })
    doc.close()
    return pages


def detect_chapters(pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Assign chapter labels across pages using heading patterns."""
    current_chapter = "Introduction"
    current_section = ""
    enriched = []
    for p in pages:
        for h in p.get("headings", []):
            if re.match(r"(?i)^(chapter|unit)\s+\d+", h):
                current_chapter = h
                current_section = ""
            elif re.match(r"(?i)^section\s+\d+", h) or re.match(r"^\d+\.\d+", h):
                current_section = h
        enriched.append({
            **p,
            "chapter": current_chapter,
            "section": current_section,
        })
    return enriched


def semantic_chunk_page(
    page_text: str,
    page_meta: Dict[str, Any],
    cfg: TrainConfig,
    filename: str,
    subject: str,
    start_index: int = 0,
) -> List[Chunk]:
    """
    Heading-aware, paragraph-preserving, token-budget chunking
    with sentence-boundary soft breaks.
    """
    if not page_text.strip():
        return []

    # Split into paragraphs first
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", page_text) if p.strip()]
    chunks: List[Chunk] = []
    buffer: List[str] = []
    buffer_tokens = 0
    idx = start_index

    def flush():
        nonlocal idx, buffer, buffer_tokens
        if not buffer:
            return
        text = "\n\n".join(buffer).strip()
        tc = approx_token_count(text)
        if tc < cfg.min_chunk_tokens and chunks:
            # Merge tiny leftover into previous
            prev = chunks[-1]
            merged = prev.text + "\n\n" + text
            chunks[-1] = Chunk(
                chunk_id=prev.chunk_id,
                text=merged,
                subject=prev.subject,
                filename=prev.filename,
                page=prev.page,
                chapter=prev.chapter,
                section=prev.section,
                chunk_index=prev.chunk_index,
                token_count=approx_token_count(merged),
                source=prev.source,
            )
        else:
            chunks.append(Chunk(
                chunk_id=str(uuid.uuid4()),
                text=text,
                subject=subject,
                filename=filename,
                page=page_meta.get("page", 0),
                chapter=page_meta.get("chapter", ""),
                section=page_meta.get("section", ""),
                chunk_index=idx,
                token_count=tc,
                source="pdf",
            ))
            idx += 1
        buffer = []
        buffer_tokens = 0

    for para in paragraphs:
        # Check if paragraph is a heading — soft boundary
        is_heading = bool(_HEADING_RE.match(para.strip()))
        pt = approx_token_count(para)

        if is_heading and buffer:
            flush()

        if buffer_tokens + pt > cfg.chunk_tokens and buffer:
            flush()
            # Overlap: keep last sentence of previous chunk
            if chunks and cfg.chunk_overlap_tokens > 0:
                prev_sents = re.split(r"(?<=[.!?])\s+", chunks[-1].text)
                overlap_text = ""
                ot = 0
                for s in reversed(prev_sents):
                    st = approx_token_count(s)
                    if ot + st > cfg.chunk_overlap_tokens:
                        break
                    overlap_text = s + " " + overlap_text
                    ot += st
                if overlap_text.strip():
                    buffer = [overlap_text.strip()]
                    buffer_tokens = ot

        # Very long paragraph → sentence split
        if pt > cfg.max_chunk_tokens:
            sents = re.split(r"(?<=[.!?])\s+", para)
            for s in sents:
                st = approx_token_count(s)
                if buffer_tokens + st > cfg.chunk_tokens and buffer:
                    flush()
                buffer.append(s)
                buffer_tokens += st
        else:
            buffer.append(para)
            buffer_tokens += pt

    flush()
    return chunks


def process_pdf(pdf_path: Path, subject: str = "") -> List[Chunk]:
    log.info(f"📄 Processing {pdf_path.name}")
    pages = extract_pdf_pages(pdf_path)
    pages = detect_chapters(pages)
    subject = subject or pdf_path.parent.name or "general"
    all_chunks: List[Chunk] = []
    idx = 0
    for p in pages:
        page_chunks = semantic_chunk_page(
            p["text"], p, CFG, pdf_path.name, subject, start_index=idx
        )
        all_chunks.extend(page_chunks)
        idx += len(page_chunks)
    log.info(f"   → {len(all_chunks)} chunks from {len(pages)} pages")
    return all_chunks



# ---------------------------------------------------------------------------
# 7b. ZIP folder ingestion — extract all zips and collect PDFs
# ---------------------------------------------------------------------------
import zipfile


def extract_zip_file(zip_path: Path, dest_dir: Path) -> List[Path]:
    """Extract one ZIP; return list of extracted PDF paths."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    pdfs: List[Path] = []
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            # Safety: skip path-traversal entries
            for member in zf.namelist():
                if member.endswith("/") or ".." in member.split("/"):
                    continue
                zf.extract(member, dest_dir)
            for pdf in dest_dir.rglob("*.pdf"):
                pdfs.append(pdf)
            # Also case variants
            for pdf in dest_dir.rglob("*.PDF"):
                if pdf not in pdfs:
                    pdfs.append(pdf)
        log.info(f"   📦 {zip_path.name} → {len(pdfs)} PDF(s)")
    except zipfile.BadZipFile as e:
        log.error(f"Bad ZIP {zip_path}: {e}")
    except Exception as e:
        log.error(f"Failed to extract {zip_path}: {e}")
    return pdfs


def collect_pdfs_from_zip_folder(zip_folder: str | Path, extract_root: Path) -> List[Path]:
    """
    Scan a folder for .zip files, extract each into extract_root/<zip_stem>/,
    and return a flat list of all PDF paths found.
    Also picks up any loose PDFs already sitting in zip_folder.
    """
    zip_folder = Path(zip_folder)
    if not zip_folder.exists():
        log.warning(f"ZIP folder does not exist: {zip_folder}")
        return []

    extract_root.mkdir(parents=True, exist_ok=True)
    all_pdfs: List[Path] = []
    seen_hash: set = set()

    def _add(pdf: Path):
        try:
            h = hashlib.sha256(pdf.read_bytes()[:65536] + str(pdf.stat().st_size).encode()).hexdigest()
        except Exception:
            h = str(pdf)
        if h in seen_hash:
            return
        seen_hash.add(h)
        all_pdfs.append(pdf)

    # Loose PDFs in the folder itself
    for pdf in list(zip_folder.glob("*.pdf")) + list(zip_folder.glob("*.PDF")):
        _add(pdf)

    zips = sorted(list(zip_folder.glob("*.zip")) + list(zip_folder.glob("*.ZIP")))
    if not zips:
        log.warning(f"No .zip files found in {zip_folder}")
    else:
        log.info(f"📦 Found {len(zips)} ZIP file(s) in {zip_folder}")

    for zp in tqdm(zips, desc="Extracting ZIPs"):
        dest = extract_root / zp.stem
        # Resume-friendly: skip re-extract if already has PDFs
        existing = list(dest.rglob("*.pdf")) + list(dest.rglob("*.PDF"))
        if existing:
            log.info(f"   ♻️  Reusing extracted {zp.name} ({len(existing)} PDFs)")
            for p in existing:
                _add(p)
            continue
        extracted = extract_zip_file(zp, dest)
        for p in extracted:
            _add(p)

    log.info(f"📚 Total unique PDFs from ZIP folder: {len(all_pdfs)}")
    return all_pdfs


def process_pdf_list(pdf_paths: List[Path], default_subject: str = "") -> List[Chunk]:
    """Process an explicit list of PDF paths into chunks."""
    chunks: List[Chunk] = []
    for pdf in tqdm(pdf_paths, desc="PDFs"):
        try:
            subject = default_subject or pdf.parent.name or "general"
            chunks.extend(process_pdf(pdf, subject=subject))
        except Exception as e:
            log.error(f"Failed {pdf}: {e}")
    seen = set()
    unique = []
    for c in chunks:
        h = content_hash(c.text)
        if h not in seen:
            seen.add(h)
            unique.append(c)
    log.info(f"📚 {len(unique)} unique chunks (from {len(chunks)} raw)")
    return unique


def process_pdf_folder(folder: Path, subject: str = "") -> List[Chunk]:
    pdfs = list(folder.glob(CFG.ncert_pdf_glob))
    if not pdfs:
        log.warning(f"No PDFs under {folder}")
        return []
    chunks: List[Chunk] = []
    for pdf in tqdm(pdfs, desc="PDFs"):
        try:
            chunks.extend(process_pdf(pdf, subject=subject or folder.name))
        except Exception as e:
            log.error(f"Failed {pdf}: {e}")
    # Dedup by content hash
    seen = set()
    unique = []
    for c in chunks:
        h = content_hash(c.text)
        if h not in seen:
            seen.add(h)
            unique.append(c)
    log.info(f"📚 {len(unique)} unique chunks (from {len(chunks)} raw)")
    return unique


# ---------------------------------------------------------------------------
# 8. Public datasets (MS MARCO / NQ / SQuAD / SciQ / …)
# ---------------------------------------------------------------------------
def _load_hf_pairs(dataset_name: str, split: str, query_key: str, passage_key: str,
                   max_samples: int) -> List[Dict[str, str]]:
    from datasets import load_dataset
    try:
        ds = load_dataset(dataset_name, split=split, trust_remote_code=True)
    except Exception as e:
        log.warning(f"Could not load {dataset_name}: {e}")
        return []
    pairs = []
    for row in ds:
        q = row.get(query_key) or row.get("question") or row.get("query")
        p = row.get(passage_key) or row.get("context") or row.get("passage") or row.get("text")
        if not q or not p:
            continue
        if isinstance(p, list):
            p = " ".join(str(x) for x in p)
        q, p = str(q).strip(), str(p).strip()
        if len(q) < 5 or len(p) < 20:
            continue
        pairs.append({"query": normalize_text(q), "passage": normalize_text(p)})
        if len(pairs) >= max_samples:
            break
    log.info(f"   {dataset_name}: {len(pairs)} pairs")
    return pairs


def load_public_datasets(max_per_source: int = 1500) -> List[Dict[str, str]]:
    """Download & merge public query–passage pairs."""
    log.info("🌐 Loading public datasets...")
    all_pairs: List[Dict[str, str]] = []

    sources = [
        # (hf_id, split, query_key, passage_key)
        ("squad_v2", "train", "question", "context"),
        ("sciq", "train", "question", "support"),
        ("openbookqa", "train", "question_stem", "fact1"),  # may vary
    ]

    # Natural Questions (simplified)
    try:
        from datasets import load_dataset
        nq = load_dataset("google-research-datasets/nq_open", split="train")
        n = 0
        for row in nq:
            q = str(row.get("question", "")).strip()
            ans = row.get("answer") or []
            if isinstance(ans, list):
                ans = " ".join(str(a) for a in ans)
            ans = str(ans).strip()
            if len(q) > 5 and len(ans) > 10:
                all_pairs.append({"query": normalize_text(q), "passage": normalize_text(ans)})
                n += 1
            if n >= max_per_source:
                break
        log.info(f"   nq_open: {n} pairs")
    except Exception as e:
        log.warning(f"NQ skipped: {e}")

    for name, split, qk, pk in sources:
        try:
            pairs = _load_hf_pairs(name, split, qk, pk, max_per_source)
            all_pairs.extend(pairs)
        except Exception as e:
            log.warning(f"{name} skipped: {e}")

    # MS MARCO passage ranking (small sample via HF)
    try:
        from datasets import load_dataset
        ms = load_dataset("ms_marco", "v1.1", split="train")
        n = 0
        for row in ms:
            q = str(row.get("query", "")).strip()
            passages = row.get("passages") or {}
            is_sel = passages.get("is_selected") or []
            texts = passages.get("passage_text") or []
            for sel, txt in zip(is_sel, texts):
                if sel and txt:
                    all_pairs.append({
                        "query": normalize_text(q),
                        "passage": normalize_text(str(txt)),
                    })
                    n += 1
                    break
            if n >= max_per_source:
                break
        log.info(f"   ms_marco: {n} pairs")
    except Exception as e:
        log.warning(f"MS MARCO skipped: {e}")

    # Dedup
    seen = set()
    unique = []
    for p in all_pairs:
        h = content_hash(p["query"] + "||" + p["passage"][:200])
        if h not in seen:
            seen.add(h)
            unique.append(p)
    log.info(f"🌐 Public pairs total (deduped): {len(unique)}")
    return unique[: CFG.max_public_samples]


# ---------------------------------------------------------------------------
# 9. Synthetic query generation (template + light heuristics)
# ---------------------------------------------------------------------------
FACTUAL_TEMPLATES = [
    "What is {key}?",
    "Define {key}.",
    "Explain {key}.",
    "What are the main points about {key}?",
    "Summarize the concept of {key}.",
    "How does {key} work?",
    "Why is {key} important?",
    "Describe {key} in simple terms.",
    "What does the text say about {key}?",
    "Give an overview of {key}.",
]

EXAM_TEMPLATES = [
    "Write a short note on {key}.",
    "Discuss {key} with examples.",
    "Distinguish between related concepts involving {key}.",
    "State the significance of {key}.",
    "Answer: What do you understand by {key}?",
]


def _extract_keyphrases(text: str, k: int = 5) -> List[str]:
    """Lightweight keyphrase extraction via capitalized phrases & noun-ish tokens."""
    # Multi-word Capitalized
    caps = re.findall(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b", text)
    # Scientific / term-like
    terms = re.findall(r"\b([a-z]{4,}(?:\s+[a-z]{3,}){0,2})\b", text.lower())
    # Frequency
    from collections import Counter
    stop = {
        "that", "this", "with", "from", "have", "been", "were", "which", "their",
        "about", "would", "there", "other", "when", "what", "will", "more", "also",
        "into", "such", "only", "some", "than", "then", "them", "these", "could",
        "should", "after", "before", "between", "through", "during", "under",
    }
    terms = [t for t in terms if t.split()[0] not in stop and len(t) > 4]
    freq = Counter(terms)
    phrases = list(dict.fromkeys(caps))[:k]
    phrases += [w for w, _ in freq.most_common(k * 2) if w not in {p.lower() for p in phrases}]
    return phrases[:k] or ["this topic"]


def generate_queries_for_chunk(chunk: Chunk, n: int) -> List[str]:
    keys = _extract_keyphrases(chunk.text, k=max(3, n))
    queries = []
    templates = FACTUAL_TEMPLATES + EXAM_TEMPLATES
    # Chapter/section contextual queries
    if chunk.chapter:
        queries.append(f"What does {chunk.chapter} say about the main idea?")
    if chunk.section:
        queries.append(f"Explain the section: {chunk.section}")

    random.shuffle(templates)
    for i, tmpl in enumerate(templates):
        if len(queries) >= n:
            break
        key = keys[i % len(keys)]
        q = tmpl.format(key=key)
        if q not in queries:
            queries.append(q)

    # Keyword-style
    for key in keys[:2]:
        if len(queries) >= n:
            break
        queries.append(key)

    return queries[:n]


def build_synthetic_pairs(chunks: List[Chunk], queries_per_chunk: int) -> List[Dict[str, Any]]:
    log.info(f" synthetizing queries ({queries_per_chunk}/chunk)...")
    pairs = []
    for ch in tqdm(chunks, desc="Synthetic queries"):
        qs = generate_queries_for_chunk(ch, queries_per_chunk)
        for q in qs:
            pairs.append({
                "query": q,
                "positive": ch.text,
                "chunk_id": ch.chunk_id,
                "page": ch.page,
                "chapter": ch.chapter,
                "filename": ch.filename,
                "subject": ch.subject,
            })
    log.info(f"✨ {len(pairs)} synthetic query→passage pairs")
    return pairs


# ---------------------------------------------------------------------------
# 10. Hard negative mining
# ---------------------------------------------------------------------------
def mine_bm25_negatives(
    query: str,
    corpus: List[str],
    exclude_idx: int,
    k: int,
) -> List[int]:
    from rank_bm25 import BM25Okapi
    tokenized = [doc.lower().split() for doc in corpus]
    bm25 = BM25Okapi(tokenized)
    scores = bm25.get_scores(query.lower().split())
    ranked = np.argsort(scores)[::-1]
    neg = []
    for i in ranked:
        if int(i) == exclude_idx:
            continue
        neg.append(int(i))
        if len(neg) >= k:
            break
    return neg


def mine_embedding_negatives(
    query_emb: np.ndarray,
    corpus_embs: np.ndarray,
    exclude_idx: int,
    k: int,
    chapter_mask: Optional[np.ndarray] = None,
) -> List[int]:
    """Nearest neighbors that are NOT the positive; prefer different chapter."""
    # cosine similarity
    q = query_emb / (np.linalg.norm(query_emb) + 1e-9)
    C = corpus_embs / (np.linalg.norm(corpus_embs, axis=1, keepdims=True) + 1e-9)
    sims = C @ q
    sims[exclude_idx] = -1.0
    ranked = np.argsort(sims)[::-1]

    neg = []
    # Prefer cross-chapter first
    if chapter_mask is not None:
        for i in ranked:
            if not chapter_mask[i]:
                neg.append(int(i))
            if len(neg) >= k:
                return neg
    for i in ranked:
        if int(i) not in neg:
            neg.append(int(i))
        if len(neg) >= k:
            break
    return neg


def build_triplets(
    pairs: List[Dict[str, Any]],
    chunks: List[Chunk],
    cfg: TrainConfig,
    embedder_name: str = "BAAI/bge-small-en-v1.5",
) -> List[Dict[str, Any]]:
    """
    Build (anchor, positive, negatives[]) using BM25 + embedding hard negatives.
    """
    from sentence_transformers import SentenceTransformer

    log.info("⛏️  Hard-negative mining...")
    corpus_texts = [c.text for c in chunks]
    chunk_id_to_idx = {c.chunk_id: i for i, c in enumerate(chunks)}
    chapters = [c.chapter for c in chunks]

    # Embed corpus once
    model = SentenceTransformer(embedder_name, device=DEVICE)
    model.max_seq_length = cfg.max_seq_length
    corpus_embs = model.encode(
        corpus_texts,
        batch_size=64,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )

    triplets = []
    for pair in tqdm(pairs, desc="Triplets"):
        q = pair["query"]
        pos = pair["positive"]
        cid = pair.get("chunk_id")
        pos_idx = chunk_id_to_idx.get(cid, -1)
        if pos_idx < 0:
            # Find by text match fallback
            try:
                pos_idx = corpus_texts.index(pos)
            except ValueError:
                continue

        # BM25 negatives
        bm25_idx = mine_bm25_negatives(q, corpus_texts, pos_idx, cfg.bm25_negatives)

        # Embedding negatives (chapter-aware)
        q_emb = model.encode([q], convert_to_numpy=True, normalize_embeddings=True)[0]
        same_chapter = np.array([ch == chapters[pos_idx] for ch in chapters])
        emb_idx = mine_embedding_negatives(
            q_emb, corpus_embs, pos_idx, cfg.embedding_negatives,
            chapter_mask=same_chapter,
        )

        neg_indices = list(dict.fromkeys(bm25_idx + emb_idx))[: cfg.hard_negatives_per_query]
        negatives = [corpus_texts[i] for i in neg_indices if i != pos_idx]

        if not negatives:
            # Random fallback
            candidates = [i for i in range(len(corpus_texts)) if i != pos_idx]
            negatives = [corpus_texts[i] for i in random.sample(candidates, min(2, len(candidates)))]

        triplets.append({
            "query": q,
            "positive": pos,
            "negatives": negatives,
            "chunk_id": cid,
            "meta": {
                "page": pair.get("page"),
                "chapter": pair.get("chapter"),
                "filename": pair.get("filename"),
                "subject": pair.get("subject"),
            },
        })

    del model
    gc.collect()
    if DEVICE == "cuda":
        torch.cuda.empty_cache()

    log.info(f"🔗 {len(triplets)} triplets ready")
    return triplets


# ---------------------------------------------------------------------------
# 11. Train / val / test split
# ---------------------------------------------------------------------------
def split_triplets(
    triplets: List[Dict[str, Any]],
    train_r: float,
    val_r: float,
) -> Tuple[List, List, List]:
    random.shuffle(triplets)
    n = len(triplets)
    n_train = int(n * train_r)
    n_val = int(n * val_r)
    train = triplets[:n_train]
    val = triplets[n_train : n_train + n_val]
    test = triplets[n_train + n_val :]
    log.info(f"📊 Split → train={len(train)} val={len(val)} test={len(test)}")
    return train, val, test


# ---------------------------------------------------------------------------
# 12. Embedding training (SentenceTransformers)
# ---------------------------------------------------------------------------
def train_embedding_model(
    train_triplets: List[Dict[str, Any]],
    val_triplets: List[Dict[str, Any]],
    cfg: TrainConfig,
) -> Path:
    from sentence_transformers import (
        SentenceTransformer,
        SentenceTransformerTrainer,
        SentenceTransformerTrainingArguments,
        losses,
    )
    from sentence_transformers.training_args import BatchSamplers
    from datasets import Dataset

    log.info(f"🧠 Loading base model: {cfg.base_model}")
    model = SentenceTransformer(cfg.base_model, device=DEVICE)
    model.max_seq_length = cfg.max_seq_length

    # Build HF datasets — MultipleNegativesRankingLoss expects (anchor, positive)
    # Hard negatives are mixed into the batch via in-batch negatives + optional extra
    def to_rows(trips: List[Dict]) -> Dict[str, List]:
        anchors, positives = [], []
        for t in trips:
            anchors.append(t["query"])
            positives.append(t["positive"])
            # Also add hard negatives as additional anchors with random other positives
            # (in-batch negatives handle the rest)
        return {"anchor": anchors, "positive": positives}

    train_ds = Dataset.from_dict(to_rows(train_triplets))
    val_ds = Dataset.from_dict(to_rows(val_triplets)) if val_triplets else None

    loss = losses.MultipleNegativesRankingLoss(model)

    out_dir = DIRS["checkpoints"] / cfg.model_name
    out_dir.mkdir(parents=True, exist_ok=True)

    args = SentenceTransformerTrainingArguments(
        output_dir=str(out_dir),
        num_train_epochs=cfg.epochs,
        per_device_train_batch_size=cfg.batch_size,
        per_device_eval_batch_size=cfg.batch_size,
        gradient_accumulation_steps=cfg.grad_accum_steps,
        learning_rate=cfg.learning_rate,
        weight_decay=cfg.weight_decay,
        warmup_ratio=cfg.warmup_ratio,
        fp16=USE_FP16 and not USE_BF16,
        bf16=USE_BF16,
        eval_strategy="steps" if val_ds else "no",
        eval_steps=cfg.evaluation_steps if val_ds else None,
        save_strategy="steps",
        save_steps=cfg.save_steps,
        save_total_limit=3,
        logging_steps=20,
        logging_dir=str(DIRS["logs"] / "tb"),
        report_to=["tensorboard"],
        load_best_model_at_end=bool(val_ds),
        metric_for_best_model="eval_loss" if val_ds else None,
        greater_is_better=False,
        batch_sampler=BatchSamplers.NO_DUPLICATES,
        seed=cfg.seed,
        dataloader_drop_last=True,
    )

    trainer = SentenceTransformerTrainer(
        model=model,
        args=args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        loss=loss,
    )

    # Resume if checkpoint exists
    last_ckpt = None
    ckpts = sorted(out_dir.glob("checkpoint-*"), key=lambda p: int(p.name.split("-")[-1]))
    if ckpts:
        last_ckpt = str(ckpts[-1])
        log.info(f"♻️  Resuming from {last_ckpt}")

    log.info("🏋️  Training started...")
    trainer.train(resume_from_checkpoint=last_ckpt)

    final_path = DIRS["models"] / cfg.model_name
    model.save(str(final_path))
    log.info(f"💾 Model saved → {final_path}")
    return final_path


# ---------------------------------------------------------------------------
# 13. Evaluation — Recall@k, MRR, nDCG, latency
# ---------------------------------------------------------------------------
def evaluate_retrieval(
    model_path: Path,
    test_triplets: List[Dict[str, Any]],
    corpus_chunks: List[Chunk],
    ks: Sequence[int] = (1, 5, 10),
) -> Dict[str, float]:
    from sentence_transformers import SentenceTransformer

    log.info("📈 Evaluating retrieval...")
    model = SentenceTransformer(str(model_path), device=DEVICE)
    corpus = [c.text for c in corpus_chunks]
    corpus_ids = [c.chunk_id for c in corpus_chunks]

    corpus_embs = model.encode(
        corpus, batch_size=64, show_progress_bar=True,
        convert_to_numpy=True, normalize_embeddings=True,
    )

    recalls = {k: [] for k in ks}
    mrrs = []
    ndcgs = []
    latencies = []

    for t in tqdm(test_triplets, desc="Eval"):
        q = t["query"]
        pos = t["positive"]
        # Ground-truth index
        try:
            gt = corpus.index(pos)
        except ValueError:
            # fuzzy: match chunk_id
            cid = t.get("chunk_id")
            if cid and cid in corpus_ids:
                gt = corpus_ids.index(cid)
            else:
                continue

        t0 = time.perf_counter()
        q_emb = model.encode([q], convert_to_numpy=True, normalize_embeddings=True)[0]
        sims = corpus_embs @ q_emb
        ranked = np.argsort(sims)[::-1]
        latencies.append((time.perf_counter() - t0) * 1000)

        rank_of_gt = int(np.where(ranked == gt)[0][0]) + 1  # 1-based
        for k in ks:
            recalls[k].append(1.0 if rank_of_gt <= k else 0.0)
        mrrs.append(1.0 / rank_of_gt)

        # nDCG@10
        k_ndcg = 10
        dcg = 1.0 / math.log2(rank_of_gt + 1) if rank_of_gt <= k_ndcg else 0.0
        ndcgs.append(dcg)  # IDCG=1 for single relevant

    metrics = {
        **{f"Recall@{k}": float(np.mean(recalls[k])) for k in ks},
        "MRR": float(np.mean(mrrs)),
        "nDCG@10": float(np.mean(ndcgs)),
        "latency_ms_p50": float(np.percentile(latencies, 50)),
        "latency_ms_p95": float(np.percentile(latencies, 95)),
        "n_queries": len(mrrs),
    }

    # Save report
    report_path = DIRS["eval"] / "metrics.json"
    with open(report_path, "w") as f:
        json.dump(metrics, f, indent=2)
    log.info("📊 Metrics:")
    for k, v in metrics.items():
        log.info(f"   {k}: {v:.4f}" if isinstance(v, float) else f"   {k}: {v}")

    # Plot
    try:
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots(1, 2, figsize=(10, 4))
        recall_vals = [metrics[f"Recall@{k}"] for k in ks]
        ax[0].bar([f"R@{k}" for k in ks], recall_vals, color=["#a855f7", "#ec4899", "#f472b6"])
        ax[0].set_ylim(0, 1)
        ax[0].set_title("Recall@k")
        ax[1].bar(["MRR", "nDCG@10"], [metrics["MRR"], metrics["nDCG@10"]], color=["#9333ea", "#db2777"])
        ax[1].set_ylim(0, 1)
        ax[1].set_title("Ranking quality")
        plt.tight_layout()
        plt.savefig(DIRS["eval"] / "metrics_plot.png", dpi=120)
        plt.close()
        log.info(f"📈 Plot → {DIRS['eval'] / 'metrics_plot.png'}")
    except Exception as e:
        log.warning(f"Plot skipped: {e}")

    return metrics


# ---------------------------------------------------------------------------
# 14. Export — ST + HF + ONNX + metadata
# ---------------------------------------------------------------------------
def export_model(model_path: Path, cfg: TrainConfig, metrics: Dict[str, float]) -> Path:
    from sentence_transformers import SentenceTransformer

    export_dir = DIRS["export"] / cfg.model_name
    export_dir.mkdir(parents=True, exist_ok=True)

    model = SentenceTransformer(str(model_path), device="cpu")
    model.save(str(export_dir / "sentence_transformer"))
    log.info(f"📦 SentenceTransformer → {export_dir / 'sentence_transformer'}")

    # HuggingFace-style (underlying transformers model)
    try:
        hf_path = export_dir / "huggingface"
        model[0].auto_model.save_pretrained(str(hf_path))
        model[0].tokenizer.save_pretrained(str(hf_path))
        log.info(f"📦 HuggingFace → {hf_path}")
    except Exception as e:
        log.warning(f"HF export: {e}")

    # ONNX
    if cfg.export_onnx:
        try:
            import torch.onnx
            st_model = SentenceTransformer(str(model_path), device="cpu")
            transformer = st_model[0].auto_model
            tokenizer = st_model[0].tokenizer
            dummy = tokenizer(
                "Hello world", return_tensors="pt", padding="max_length",
                truncation=True, max_length=cfg.max_seq_length,
            )
            onnx_path = export_dir / "model.onnx"
            torch.onnx.export(
                transformer,
                (dummy["input_ids"], dummy["attention_mask"]),
                str(onnx_path),
                input_names=["input_ids", "attention_mask"],
                output_names=["last_hidden_state"],
                dynamic_axes={
                    "input_ids": {0: "batch", 1: "seq"},
                    "attention_mask": {0: "batch", 1: "seq"},
                    "last_hidden_state": {0: "batch", 1: "seq"},
                },
                opset_version=14,
            )
            log.info(f"📦 ONNX → {onnx_path}")
        except Exception as e:
            log.warning(f"ONNX export skipped: {e}")

    meta = {
        "model_name": cfg.model_name,
        "base_model": cfg.base_model,
        "config": asdict(cfg),
        "metrics": metrics,
        "exported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    with open(export_dir / "metadata.json", "w") as f:
        json.dump(meta, f, indent=2)

    log.info(f"✅ Export complete → {export_dir}")
    return export_dir


# ---------------------------------------------------------------------------
# 15. Persist helpers
# ---------------------------------------------------------------------------
def save_jsonl(path: Path, rows: List[Dict]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def load_jsonl(path: Path) -> List[Dict]:
    if not path.exists():
        return []
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            rows.append(json.loads(line))
    return rows


# ---------------------------------------------------------------------------
# 16. MAIN PIPELINE
# ---------------------------------------------------------------------------
def main():
    log.info("=" * 60)
    log.info("RAGBook · Production Embedding Training Pipeline")
    log.info("=" * 60)

    # ----- A. PDF / NCERT chunks (from ZIP folder and/or pdfs/) -----
    chunks_path = DIRS["chunks"] / "all_chunks.jsonl"
    if chunks_path.exists():
        raw = load_jsonl(chunks_path)
        chunks = [Chunk(**r) for r in raw]
        log.info(f"♻️  Loaded {len(chunks)} cached chunks")
    else:
        chunks = []
        pdf_paths: List[Path] = []

        # 1) ZIP folder path from config (set CFG.zip_folder before running)
        zip_folder = (CFG.zip_folder or "").strip()
        if zip_folder:
            log.info(f"📦 Using ZIP folder: {zip_folder}")
            extracted_root = DIRS["pdfs"] / "from_zips"
            pdf_paths.extend(collect_pdfs_from_zip_folder(zip_folder, extracted_root))
        else:
            log.info(
                "💡 Tip: set CFG.zip_folder = '/path/to/folder/with/zips' "
                "to auto-extract all ZIP files and use every PDF inside."
            )

        # 2) Any loose PDFs already under workdir/pdfs/
        pdf_root = DIRS["pdfs"]
        for pdf in list(pdf_root.rglob("*.pdf")) + list(pdf_root.rglob("*.PDF")):
            if pdf not in pdf_paths:
                pdf_paths.append(pdf)

        if pdf_paths:
            log.info(f"📄 Processing {len(pdf_paths)} PDF file(s)...")
            chunks = process_pdf_list(pdf_paths)
        else:
            log.warning(
                "⚠️  No PDFs found.\n"
                f"   • Set CFG.zip_folder to a folder containing .zip files, OR\n"
                f"   • Place PDFs under: {pdf_root}\n"
                "   Continuing with public datasets only..."
            )

        # Optional: also accept pre-extracted text dump
        text_dump = DIRS["data"] / "ncert_text.jsonl"
        if text_dump.exists():
            for row in load_jsonl(text_dump):
                chunks.append(Chunk(
                    chunk_id=str(uuid.uuid4()),
                    text=normalize_text(row["text"]),
                    subject=row.get("subject", ""),
                    filename=row.get("filename", ""),
                    page=row.get("page", 0),
                    chapter=row.get("chapter", ""),
                    section=row.get("section", ""),
                    chunk_index=row.get("chunk_index", 0),
                    token_count=approx_token_count(row["text"]),
                    source="pdf",
                ))

        if chunks:
            save_jsonl(chunks_path, [c.to_dict() for c in chunks])

    # ----- B. Public dataset pairs -----
    public_path = DIRS["data"] / "public_pairs.jsonl"
    if public_path.exists():
        public_pairs = load_jsonl(public_path)
        log.info(f"♻️  Loaded {len(public_pairs)} public pairs")
    else:
        public_pairs = load_public_datasets(max_per_source=1500)
        save_jsonl(public_path, public_pairs)

    # ----- C. Synthetic queries from PDF chunks -----
    pairs: List[Dict[str, Any]] = []
    if chunks:
        syn_path = DIRS["queries"] / "synthetic_pairs.jsonl"
        if syn_path.exists():
            pairs = load_jsonl(syn_path)
            log.info(f"♻️  Loaded {len(pairs)} synthetic pairs")
        else:
            pairs = build_synthetic_pairs(chunks, CFG.queries_per_chunk)
            save_jsonl(syn_path, pairs)

    # Merge public pairs as additional training signal
    for pp in public_pairs:
        pairs.append({
            "query": pp["query"],
            "positive": pp["passage"],
            "chunk_id": None,
            "page": None,
            "chapter": "",
            "filename": "public",
            "subject": "public",
        })

    if not pairs:
        raise RuntimeError(
            "No training pairs. Add PDFs under pdfs/ or ensure public datasets download."
        )

    # For negative mining we need a corpus — use PDF chunks + public passages
    if not chunks:
        # Build pseudo-chunks from public passages
        seen = set()
        for pp in public_pairs:
            h = content_hash(pp["passage"])
            if h in seen:
                continue
            seen.add(h)
            chunks.append(Chunk(
                chunk_id=str(uuid.uuid4()),
                text=pp["passage"],
                subject="public",
                filename="public",
                source="public",
                token_count=approx_token_count(pp["passage"]),
            ))

    # ----- D. Triplets -----
    trip_path = DIRS["triplets"] / "triplets.jsonl"
    if trip_path.exists():
        triplets = load_jsonl(trip_path)
        log.info(f"♻️  Loaded {len(triplets)} triplets")
    else:
        # Limit pairs for Colab memory if huge
        max_pairs = min(len(pairs), 8000)
        triplets = build_triplets(pairs[:max_pairs], chunks, CFG, embedder_name=CFG.base_model)
        save_jsonl(trip_path, triplets)

    train_t, val_t, test_t = split_triplets(triplets, CFG.train_ratio, CFG.val_ratio)

    # ----- E. Train -----
    model_path = train_embedding_model(train_t, val_t, CFG)

    # ----- F. Evaluate -----
    metrics = evaluate_retrieval(model_path, test_t if test_t else val_t, chunks)

    # ----- G. Export -----
    export_dir = export_model(model_path, CFG, metrics)

    log.info("=" * 60)
    log.info("✅ PIPELINE COMPLETE")
    log.info(f"   Model : {model_path}")
    log.info(f"   Export: {export_dir}")
    log.info(f"   Metrics: {DIRS['eval'] / 'metrics.json'}")
    log.info("=" * 60)
    log.info(
        "Next: copy the sentence_transformer folder into RAGBook Studio\n"
        "  Models/Embeddings/<name>/ and add metadata.json"
    )
    return model_path, metrics


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    model_path, metrics = main()
else:
    # When pasted into Colab as a cell, still run
    model_path, metrics = main()
