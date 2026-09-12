"""
Chunking strategy interfaces.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol, runtime_checkable


class ChunkStrategy(str, Enum):
    FIXED = "fixed"
    SEMANTIC = "semantic"
    CHAPTER = "chapter"
    PARAGRAPH = "paragraph"
    SENTENCE = "sentence"
    TABLE = "table"
    FORMULA = "formula"
    IMAGE_CAPTION = "image_caption"
    CUSTOM = "custom"


@dataclass
class Chunk:
    id: str
    text: str
    page: Optional[int] = None
    chapter: Optional[str] = None
    heading: Optional[str] = None
    file_id: Optional[str] = None
    workspace_id: Optional[str] = None
    strategy: str = "fixed"
    start_char: Optional[int] = None
    end_char: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ChunkingConfig:
    strategy: ChunkStrategy = ChunkStrategy.FIXED
    chunk_size: int = 512
    chunk_overlap: int = 64
    min_chunk_size: int = 50
    max_chunk_size: int = 2048
    separators: Optional[List[str]] = None
    preserve_tables: bool = True
    preserve_formulas: bool = True
    extra: Dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class ChunkerProvider(Protocol):
    """Chunk a document into smaller pieces with rich metadata."""

    @property
    def strategy(self) -> ChunkStrategy: ...

    def chunk(
        self,
        text: str,
        config: ChunkingConfig,
        document_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Chunk]: ...

    async def chunk_async(
        self,
        text: str,
        config: ChunkingConfig,
        document_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Chunk]: ...


class BaseChunker(ABC):
    def __init__(self, strategy: ChunkStrategy):
        self._strategy = strategy

    @property
    def strategy(self) -> ChunkStrategy:
        return self._strategy

    @abstractmethod
    def chunk(
        self,
        text: str,
        config: ChunkingConfig,
        document_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Chunk]: ...

    async def chunk_async(
        self,
        text: str,
        config: ChunkingConfig,
        document_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Chunk]:
        return self.chunk(text, config, document_metadata)
