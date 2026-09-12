"""
Built-in chunking strategies.
"""

from __future__ import annotations

import re
import uuid
from typing import Any, Dict, List, Optional

from Interfaces.chunking import (
    BaseChunker,
    Chunk,
    ChunkingConfig,
    ChunkStrategy,
)


def _make_id() -> str:
    return str(uuid.uuid4())


class FixedSizeChunker(BaseChunker):
    """Simple fixed-size character / token-ish chunker with overlap."""

    def __init__(self):
        super().__init__(ChunkStrategy.FIXED)

    def chunk(
        self,
        text: str,
        config: ChunkingConfig,
        document_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Chunk]:
        document_metadata = document_metadata or {}
        chunks: List[Chunk] = []
        size = config.chunk_size
        overlap = config.chunk_overlap
        start = 0
        text_len = len(text)

        while start < text_len:
            end = min(start + size, text_len)
            # Prefer breaking at whitespace
            if end < text_len:
                space = text.rfind(" ", start, end)
                if space > start + size // 2:
                    end = space

            chunk_text = text[start:end].strip()
            if len(chunk_text) >= config.min_chunk_size:
                chunks.append(
                    Chunk(
                        id=_make_id(),
                        text=chunk_text,
                        page=document_metadata.get("page"),
                        chapter=document_metadata.get("chapter"),
                        heading=document_metadata.get("heading"),
                        file_id=document_metadata.get("file_id"),
                        workspace_id=document_metadata.get("workspace_id"),
                        strategy=self.strategy.value,
                        start_char=start,
                        end_char=end,
                        metadata={**document_metadata},
                    )
                )
            start = end - overlap if end < text_len else text_len

        return chunks


class ParagraphChunker(BaseChunker):
    def __init__(self):
        super().__init__(ChunkStrategy.PARAGRAPH)

    def chunk(
        self,
        text: str,
        config: ChunkingConfig,
        document_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Chunk]:
        document_metadata = document_metadata or {}
        paragraphs = re.split(r"\n\s*\n", text)
        chunks: List[Chunk] = []
        buffer = ""
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            if len(buffer) + len(para) + 1 <= config.chunk_size:
                buffer = f"{buffer}\n\n{para}".strip() if buffer else para
            else:
                if buffer and len(buffer) >= config.min_chunk_size:
                    chunks.append(self._make_chunk(buffer, document_metadata))
                buffer = para
        if buffer and len(buffer) >= config.min_chunk_size:
            chunks.append(self._make_chunk(buffer, document_metadata))
        return chunks

    def _make_chunk(self, text: str, meta: Dict[str, Any]) -> Chunk:
        return Chunk(
            id=_make_id(),
            text=text,
            page=meta.get("page"),
            chapter=meta.get("chapter"),
            heading=meta.get("heading"),
            file_id=meta.get("file_id"),
            workspace_id=meta.get("workspace_id"),
            strategy=self.strategy.value,
            metadata={**meta},
        )


class SentenceChunker(BaseChunker):
    def __init__(self):
        super().__init__(ChunkStrategy.SENTENCE)

    def chunk(
        self,
        text: str,
        config: ChunkingConfig,
        document_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Chunk]:
        document_metadata = document_metadata or {}
        # Simple sentence split
        sentences = re.split(r"(?<=[.!?])\s+", text)
        chunks: List[Chunk] = []
        buffer: List[str] = []
        current_len = 0

        for sent in sentences:
            sent = sent.strip()
            if not sent:
                continue
            if current_len + len(sent) + 1 > config.chunk_size and buffer:
                chunk_text = " ".join(buffer)
                if len(chunk_text) >= config.min_chunk_size:
                    chunks.append(
                        Chunk(
                            id=_make_id(),
                            text=chunk_text,
                            page=document_metadata.get("page"),
                            chapter=document_metadata.get("chapter"),
                            heading=document_metadata.get("heading"),
                            file_id=document_metadata.get("file_id"),
                            workspace_id=document_metadata.get("workspace_id"),
                            strategy=self.strategy.value,
                            metadata={**document_metadata},
                        )
                    )
                buffer = [sent]
                current_len = len(sent)
            else:
                buffer.append(sent)
                current_len += len(sent) + 1

        if buffer:
            chunk_text = " ".join(buffer)
            if len(chunk_text) >= config.min_chunk_size:
                chunks.append(
                    Chunk(
                        id=_make_id(),
                        text=chunk_text,
                        page=document_metadata.get("page"),
                        chapter=document_metadata.get("chapter"),
                        heading=document_metadata.get("heading"),
                        file_id=document_metadata.get("file_id"),
                        workspace_id=document_metadata.get("workspace_id"),
                        strategy=self.strategy.value,
                        metadata={**document_metadata},
                    )
                )
        return chunks


class ChapterChunker(BaseChunker):
    """Split on common chapter / heading patterns."""

    HEADING_RE = re.compile(
        r"^(?:Chapter\s+\d+|CHAPTER\s+\d+|Section\s+\d+|#{1,3}\s+.+$|\d+\.\s+[A-Z].*$)",
        re.MULTILINE,
    )

    def __init__(self):
        super().__init__(ChunkStrategy.CHAPTER)

    def chunk(
        self,
        text: str,
        config: ChunkingConfig,
        document_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Chunk]:
        document_metadata = document_metadata or {}
        matches = list(self.HEADING_RE.finditer(text))
        if not matches:
            # Fallback to fixed
            return FixedSizeChunker().chunk(text, config, document_metadata)

        chunks: List[Chunk] = []
        for i, match in enumerate(matches):
            start = match.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            section = text[start:end].strip()
            heading = match.group(0).strip()
            if len(section) < config.min_chunk_size:
                continue
            # Further split large chapters
            if len(section) > config.max_chunk_size:
                sub_config = ChunkingConfig(
                    strategy=ChunkStrategy.PARAGRAPH,
                    chunk_size=config.chunk_size,
                    chunk_overlap=config.chunk_overlap,
                    min_chunk_size=config.min_chunk_size,
                )
                meta = {**document_metadata, "heading": heading, "chapter": heading}
                sub_chunks = ParagraphChunker().chunk(section, sub_config, meta)
                chunks.extend(sub_chunks)
            else:
                chunks.append(
                    Chunk(
                        id=_make_id(),
                        text=section,
                        page=document_metadata.get("page"),
                        chapter=heading,
                        heading=heading,
                        file_id=document_metadata.get("file_id"),
                        workspace_id=document_metadata.get("workspace_id"),
                        strategy=self.strategy.value,
                        metadata={**document_metadata, "heading": heading},
                    )
                )
        return chunks


class SemanticChunker(BaseChunker):
    """
    Placeholder for true semantic chunking (embedding-based boundaries).
    Currently falls back to paragraph + size limits.
    A full implementation would use an embedding model to detect topic shifts.
    """

    def __init__(self):
        super().__init__(ChunkStrategy.SEMANTIC)

    def chunk(
        self,
        text: str,
        config: ChunkingConfig,
        document_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Chunk]:
        # For v1 we use paragraph chunker; future versions will inject an embedder
        return ParagraphChunker().chunk(text, config, document_metadata)


# Registry of built-in chunkers
CHUNKER_REGISTRY: Dict[str, BaseChunker] = {
    ChunkStrategy.FIXED.value: FixedSizeChunker(),
    ChunkStrategy.PARAGRAPH.value: ParagraphChunker(),
    ChunkStrategy.SENTENCE.value: SentenceChunker(),
    ChunkStrategy.CHAPTER.value: ChapterChunker(),
    ChunkStrategy.SEMANTIC.value: SemanticChunker(),
}


def get_chunker(strategy: str | ChunkStrategy) -> BaseChunker:
    key = strategy.value if isinstance(strategy, ChunkStrategy) else strategy
    if key not in CHUNKER_REGISTRY:
        raise ValueError(f"Unknown chunking strategy: {key}")
    return CHUNKER_REGISTRY[key]
