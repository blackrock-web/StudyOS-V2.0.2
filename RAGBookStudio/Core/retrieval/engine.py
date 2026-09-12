"""
Retrieval engine – semantic, keyword, hybrid search with optional reranking.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from Interfaces.providers import DeviceType, RerankerProvider
from Interfaces.vectordb import SearchResult, VectorDBProvider

logger = logging.getLogger(__name__)


@dataclass
class RetrievalConfig:
    top_k: int = 5
    score_threshold: Optional[float] = None
    mode: str = "semantic"  # semantic | keyword | hybrid
    use_reranker: bool = False
    rerank_top_k: int = 20
    filters: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RetrievalResult:
    results: List[SearchResult]
    query: str
    mode: str
    reranked: bool = False


class RetrievalEngine:
    def __init__(
        self,
        vector_db: VectorDBProvider,
        embedder: Any = None,
        reranker: Optional[RerankerProvider] = None,
    ):
        self.vector_db = vector_db
        self.embedder = embedder
        self.reranker = reranker

    def retrieve(
        self,
        query: str,
        config: RetrievalConfig,
        query_embedding: Optional[List[float]] = None,
    ) -> RetrievalResult:
        if config.mode in ("semantic", "hybrid"):
            if query_embedding is None:
                if self.embedder is None:
                    raise RuntimeError("Embedder required for semantic retrieval")
                self.embedder.load(DeviceType.AUTO)
                query_embedding = self.embedder.generate_embeddings([query]).embeddings[0]

            fetch_k = config.rerank_top_k if config.use_reranker and self.reranker else config.top_k
            results = self.vector_db.search(
                query_embedding,
                top_k=fetch_k,
                filters=config.filters or None,
                score_threshold=config.score_threshold,
            )
        else:
            results = []

        # Keyword path can be added via BM25 / SQLite FTS later
        if config.mode == "keyword":
            results = self._keyword_search(query, config)

        if config.use_reranker and self.reranker and results:
            results = self._rerank(query, results, config.top_k)

        return RetrievalResult(
            results=results[: config.top_k],
            query=query,
            mode=config.mode,
            reranked=config.use_reranker and self.reranker is not None,
        )

    def _rerank(
        self,
        query: str,
        results: List[SearchResult],
        top_k: int,
    ) -> List[SearchResult]:
        assert self.reranker is not None
        docs = [r.text for r in results]
        ranked = self.reranker.rerank(query, docs, top_k=top_k)
        out: List[SearchResult] = []
        for item in ranked:
            original = results[item.index]
            out.append(
                SearchResult(
                    id=original.id,
                    score=item.score,
                    text=original.text,
                    metadata=original.metadata,
                )
            )
        return out

    def _keyword_search(self, query: str, config: RetrievalConfig) -> List[SearchResult]:
        # Placeholder – integrate SQLite FTS5 or similar
        logger.warning("Keyword search not fully implemented yet")
        return []
