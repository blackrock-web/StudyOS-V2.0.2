"""
Core provider interfaces for RAGBook Studio.
All AI components must implement these protocols / ABCs.
Custom models only need to implement the relevant interface.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, Dict, List, Optional, Protocol, runtime_checkable
from dataclasses import dataclass, field
from enum import Enum


class DeviceType(str, Enum):
    AUTO = "auto"
    CPU = "cpu"
    CUDA = "cuda"
    ROCM = "rocm"
    METAL = "metal"


@dataclass
class ModelMetadata:
    name: str
    type: str  # embedding | llm | ocr | vision | reranker | speech
    version: str
    provider: str
    device_support: List[str] = field(default_factory=lambda: ["cpu"])
    dimension: Optional[int] = None
    max_seq_length: Optional[int] = None
    parameters: Optional[str] = None
    description: str = ""
    path: Optional[str] = None
    enabled: bool = True
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EmbeddingResult:
    embeddings: List[List[float]]
    model: str
    dimension: int
    usage: Optional[Dict[str, int]] = None


@dataclass
class LLMMessage:
    role: str  # system | user | assistant
    content: str


@dataclass
class LLMResponse:
    content: str
    model: str
    finish_reason: Optional[str] = None
    usage: Optional[Dict[str, int]] = None
    citations: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class OCRResult:
    text: str
    confidence: float
    boxes: List[Dict[str, Any]] = field(default_factory=list)
    pages: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class RerankResult:
    index: int
    score: float
    document: str


@dataclass
class VisionResult:
    caption: str
    confidence: float
    tags: List[str] = field(default_factory=list)
    objects: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class SpeechResult:
    text: str
    confidence: float
    language: Optional[str] = None
    segments: List[Dict[str, Any]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Provider Interfaces
# ---------------------------------------------------------------------------

@runtime_checkable
class EmbeddingProvider(Protocol):
    """Generate dense vector embeddings for text."""

    @property
    def metadata(self) -> ModelMetadata: ...

    def load(self, device: DeviceType = DeviceType.AUTO) -> None: ...
    def unload(self) -> None: ...

    def generate_embeddings(
        self,
        texts: List[str],
        batch_size: int = 32,
        normalize: bool = True,
        **kwargs: Any,
    ) -> EmbeddingResult: ...

    async def generate_embeddings_async(
        self,
        texts: List[str],
        batch_size: int = 32,
        normalize: bool = True,
        **kwargs: Any,
    ) -> EmbeddingResult: ...


@runtime_checkable
class LLMProvider(Protocol):
    """Large Language Model generation interface."""

    @property
    def metadata(self) -> ModelMetadata: ...

    def load(self, device: DeviceType = DeviceType.AUTO) -> None: ...
    def unload(self) -> None: ...

    def generate(
        self,
        messages: List[LLMMessage],
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stop: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> LLMResponse: ...

    async def generate_async(
        self,
        messages: List[LLMMessage],
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stop: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> LLMResponse: ...

    async def stream(
        self,
        messages: List[LLMMessage],
        max_tokens: int = 1024,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> AsyncIterator[str]: ...


@runtime_checkable
class OCRProvider(Protocol):
    """Optical Character Recognition interface."""

    @property
    def metadata(self) -> ModelMetadata: ...

    def load(self, device: DeviceType = DeviceType.AUTO) -> None: ...
    def unload(self) -> None: ...

    def recognize(
        self,
        image_path: str | bytes,
        languages: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> OCRResult: ...

    async def recognize_async(
        self,
        image_path: str | bytes,
        languages: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> OCRResult: ...


@runtime_checkable
class RerankerProvider(Protocol):
    """Cross-encoder / reranker interface."""

    @property
    def metadata(self) -> ModelMetadata: ...

    def load(self, device: DeviceType = DeviceType.AUTO) -> None: ...
    def unload(self) -> None: ...

    def rerank(
        self,
        query: str,
        documents: List[str],
        top_k: Optional[int] = None,
        **kwargs: Any,
    ) -> List[RerankResult]: ...

    async def rerank_async(
        self,
        query: str,
        documents: List[str],
        top_k: Optional[int] = None,
        **kwargs: Any,
    ) -> List[RerankResult]: ...


@runtime_checkable
class VisionProvider(Protocol):
    """Image captioning / vision understanding."""

    @property
    def metadata(self) -> ModelMetadata: ...

    def load(self, device: DeviceType = DeviceType.AUTO) -> None: ...
    def unload(self) -> None: ...

    def caption(
        self,
        image_path: str | bytes,
        **kwargs: Any,
    ) -> VisionResult: ...

    async def caption_async(
        self,
        image_path: str | bytes,
        **kwargs: Any,
    ) -> VisionResult: ...


@runtime_checkable
class SpeechProvider(Protocol):
    """Speech-to-text interface."""

    @property
    def metadata(self) -> ModelMetadata: ...

    def load(self, device: DeviceType = DeviceType.AUTO) -> None: ...
    def unload(self) -> None: ...

    def transcribe(
        self,
        audio_path: str | bytes,
        language: Optional[str] = None,
        **kwargs: Any,
    ) -> SpeechResult: ...

    async def transcribe_async(
        self,
        audio_path: str | bytes,
        language: Optional[str] = None,
        **kwargs: Any,
    ) -> SpeechResult: ...


# ---------------------------------------------------------------------------
# Abstract Base Classes (for inheritance-style plugins)
# ---------------------------------------------------------------------------

class BaseEmbeddingProvider(ABC):
    def __init__(self, metadata: ModelMetadata):
        self._metadata = metadata
        self._loaded = False
        self._device: DeviceType = DeviceType.CPU

    @property
    def metadata(self) -> ModelMetadata:
        return self._metadata

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @abstractmethod
    def load(self, device: DeviceType = DeviceType.AUTO) -> None: ...

    @abstractmethod
    def unload(self) -> None: ...

    @abstractmethod
    def generate_embeddings(
        self,
        texts: List[str],
        batch_size: int = 32,
        normalize: bool = True,
        **kwargs: Any,
    ) -> EmbeddingResult: ...

    async def generate_embeddings_async(
        self,
        texts: List[str],
        batch_size: int = 32,
        normalize: bool = True,
        **kwargs: Any,
    ) -> EmbeddingResult:
        # Default sync wrapper; override for true async
        return self.generate_embeddings(texts, batch_size, normalize, **kwargs)


class BaseLLMProvider(ABC):
    def __init__(self, metadata: ModelMetadata):
        self._metadata = metadata
        self._loaded = False
        self._device: DeviceType = DeviceType.CPU

    @property
    def metadata(self) -> ModelMetadata:
        return self._metadata

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @abstractmethod
    def load(self, device: DeviceType = DeviceType.AUTO) -> None: ...

    @abstractmethod
    def unload(self) -> None: ...

    @abstractmethod
    def generate(
        self,
        messages: List[LLMMessage],
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stop: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> LLMResponse: ...

    async def generate_async(
        self,
        messages: List[LLMMessage],
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stop: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        return self.generate(messages, max_tokens, temperature, top_p, stop, **kwargs)

    @abstractmethod
    async def stream(
        self,
        messages: List[LLMMessage],
        max_tokens: int = 1024,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> AsyncIterator[str]: ...


class BaseOCRProvider(ABC):
    def __init__(self, metadata: ModelMetadata):
        self._metadata = metadata
        self._loaded = False

    @property
    def metadata(self) -> ModelMetadata:
        return self._metadata

    @abstractmethod
    def load(self, device: DeviceType = DeviceType.AUTO) -> None: ...

    @abstractmethod
    def unload(self) -> None: ...

    @abstractmethod
    def recognize(
        self,
        image_path: str | bytes,
        languages: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> OCRResult: ...

    async def recognize_async(
        self,
        image_path: str | bytes,
        languages: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> OCRResult:
        return self.recognize(image_path, languages, **kwargs)


class BaseRerankerProvider(ABC):
    def __init__(self, metadata: ModelMetadata):
        self._metadata = metadata
        self._loaded = False

    @property
    def metadata(self) -> ModelMetadata:
        return self._metadata

    @abstractmethod
    def load(self, device: DeviceType = DeviceType.AUTO) -> None: ...

    @abstractmethod
    def unload(self) -> None: ...

    @abstractmethod
    def rerank(
        self,
        query: str,
        documents: List[str],
        top_k: Optional[int] = None,
        **kwargs: Any,
    ) -> List[RerankResult]: ...

    async def rerank_async(
        self,
        query: str,
        documents: List[str],
        top_k: Optional[int] = None,
        **kwargs: Any,
    ) -> List[RerankResult]:
        return self.rerank(query, documents, top_k, **kwargs)


class BaseVisionProvider(ABC):
    def __init__(self, metadata: ModelMetadata):
        self._metadata = metadata
        self._loaded = False

    @property
    def metadata(self) -> ModelMetadata:
        return self._metadata

    @abstractmethod
    def load(self, device: DeviceType = DeviceType.AUTO) -> None: ...

    @abstractmethod
    def unload(self) -> None: ...

    @abstractmethod
    def caption(
        self,
        image_path: str | bytes,
        **kwargs: Any,
    ) -> VisionResult: ...

    async def caption_async(
        self,
        image_path: str | bytes,
        **kwargs: Any,
    ) -> VisionResult:
        return self.caption(image_path, **kwargs)


class BaseSpeechProvider(ABC):
    def __init__(self, metadata: ModelMetadata):
        self._metadata = metadata
        self._loaded = False

    @property
    def metadata(self) -> ModelMetadata:
        return self._metadata

    @abstractmethod
    def load(self, device: DeviceType = DeviceType.AUTO) -> None: ...

    @abstractmethod
    def unload(self) -> None: ...

    @abstractmethod
    def transcribe(
        self,
        audio_path: str | bytes,
        language: Optional[str] = None,
        **kwargs: Any,
    ) -> SpeechResult: ...

    async def transcribe_async(
        self,
        audio_path: str | bytes,
        language: Optional[str] = None,
        **kwargs: Any,
    ) -> SpeechResult:
        return self.transcribe(audio_path, language, **kwargs)
