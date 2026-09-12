"""
Vector Database adapter interface.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Protocol, runtime_checkable
from dataclasses import dataclass, field
from enum import Enum


@dataclass
class VectorDocument:
    id: str
    embedding: List[float]
    text: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SearchResult:
    id: str
    score: float
    text: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class VectorDBConfig:
    collection_name: str
    dimension: int
    metric: str = "cosine"  # cosine | euclidean | dot
    path: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class VectorDBProvider(Protocol):
    """Abstract vector store interface."""

    @property
    def name(self) -> str: ...

    def initialize(self, config: VectorDBConfig) -> None: ...
    def close(self) -> None: ...

    def add(
        self,
        documents: List[VectorDocument],
        batch_size: int = 100,
    ) -> List[str]: ...

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        score_threshold: Optional[float] = None,
    ) -> List[SearchResult]: ...

    def delete(self, ids: List[str]) -> None: ...
    def update(self, documents: List[VectorDocument]) -> None: ...
    def count(self, filters: Optional[Dict[str, Any]] = None) -> int: ...
    def get(self, ids: List[str]) -> List[VectorDocument]: ...
    def clear(self) -> None: ...


class BaseVectorDB(ABC):
    def __init__(self, name: str):
        self._name = name
        self._initialized = False
        self._config: Optional[VectorDBConfig] = None

    @property
    def name(self) -> str:
        return self._name

    @property
    def is_initialized(self) -> bool:
        return self._initialized

    @abstractmethod
    def initialize(self, config: VectorDBConfig) -> None: ...

    @abstractmethod
    def close(self) -> None: ...

    @abstractmethod
    def add(
        self,
        documents: List[VectorDocument],
        batch_size: int = 100,
    ) -> List[str]: ...

    @abstractmethod
    def search(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        score_threshold: Optional[float] = None,
    ) -> List[SearchResult]: ...

    @abstractmethod
    def delete(self, ids: List[str]) -> None: ...

    def update(self, documents: List[VectorDocument]) -> None:
        # Default: delete + add
        ids = [d.id for d in documents]
        self.delete(ids)
        self.add(documents)

    @abstractmethod
    def count(self, filters: Optional[Dict[str, Any]] = None) -> int: ...

    @abstractmethod
    def get(self, ids: List[str]) -> List[VectorDocument]: ...

    @abstractmethod
    def clear(self) -> None: ...
