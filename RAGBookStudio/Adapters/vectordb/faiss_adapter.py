"""
FAISS vector database adapter.
"""

from __future__ import annotations

import json
import logging
import pickle
from pathlib import Path
from typing import Any, Dict, List, Optional

from Interfaces.vectordb import (
    BaseVectorDB,
    SearchResult,
    VectorDBConfig,
    VectorDocument,
)

logger = logging.getLogger(__name__)


class FAISSVectorDB(BaseVectorDB):
    """
    Local FAISS index with sidecar metadata store (JSON / pickle).
    Suitable for offline desktop use.
    """

    def __init__(self):
        super().__init__("faiss")
        self._index = None
        self._id_map: Dict[int, str] = {}  # faiss internal id → document id
        self._rev_map: Dict[str, int] = {}  # document id → faiss internal id
        self._docs: Dict[str, VectorDocument] = {}
        self._next_id = 0
        self._dimension: int = 0
        self._path: Optional[Path] = None

    def initialize(self, config: VectorDBConfig) -> None:
        import faiss
        import numpy as np

        self._config = config
        self._dimension = config.dimension
        self._path = Path(config.path) if config.path else None

        if self._path and (self._path / "index.faiss").exists():
            self._load(self._path)
        else:
            metric = config.metric.lower()
            if metric == "cosine":
                # Use inner product on normalized vectors
                self._index = faiss.IndexFlatIP(config.dimension)
            elif metric == "euclidean":
                self._index = faiss.IndexFlatL2(config.dimension)
            else:
                self._index = faiss.IndexFlatIP(config.dimension)

            if self._path:
                self._path.mkdir(parents=True, exist_ok=True)

        self._initialized = True
        logger.info("FAISS index initialized (dim=%d, metric=%s)", config.dimension, config.metric)

    def close(self) -> None:
        if self._path and self._initialized:
            self._save(self._path)
        self._index = None
        self._initialized = False

    def add(self, documents: List[VectorDocument], batch_size: int = 100) -> List[str]:
        import numpy as np

        if not self._initialized or self._index is None:
            raise RuntimeError("FAISS index not initialized")

        ids = []
        vectors = []
        for doc in documents:
            if doc.id in self._rev_map:
                # Update existing
                self.delete([doc.id])
            faiss_id = self._next_id
            self._next_id += 1
            self._id_map[faiss_id] = doc.id
            self._rev_map[doc.id] = faiss_id
            self._docs[doc.id] = doc
            vectors.append(doc.embedding)
            ids.append(doc.id)

        if vectors:
            arr = np.array(vectors, dtype=np.float32)
            # Normalize for cosine if needed
            if self._config and self._config.metric == "cosine":
                faiss = __import__("faiss")
                faiss.normalize_L2(arr)
            self._index.add(arr)

        if self._path:
            self._save(self._path)
        return ids

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        score_threshold: Optional[float] = None,
    ) -> List[SearchResult]:
        import numpy as np

        if not self._initialized or self._index is None or self._index.ntotal == 0:
            return []

        q = np.array([query_embedding], dtype=np.float32)
        if self._config and self._config.metric == "cosine":
            faiss = __import__("faiss")
            faiss.normalize_L2(q)

        # Over-fetch if filters are present
        fetch_k = top_k * 5 if filters else top_k
        fetch_k = min(fetch_k, self._index.ntotal)
        scores, indices = self._index.search(q, fetch_k)

        results: List[SearchResult] = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            doc_id = self._id_map.get(int(idx))
            if doc_id is None:
                continue
            doc = self._docs.get(doc_id)
            if doc is None:
                continue
            if filters and not self._match_filters(doc.metadata, filters):
                continue
            if score_threshold is not None and float(score) < score_threshold:
                continue
            results.append(
                SearchResult(
                    id=doc_id,
                    score=float(score),
                    text=doc.text,
                    metadata=doc.metadata,
                )
            )
            if len(results) >= top_k:
                break
        return results

    def delete(self, ids: List[str]) -> None:
        # FAISS IndexFlat does not support removal efficiently.
        # We mark as deleted and rebuild periodically; for simplicity we rebuild.
        for doc_id in ids:
            if doc_id in self._rev_map:
                faiss_id = self._rev_map.pop(doc_id)
                self._id_map.pop(faiss_id, None)
                self._docs.pop(doc_id, None)
        self._rebuild()

    def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        if filters:
            return sum(1 for d in self._docs.values() if self._match_filters(d.metadata, filters))
        return len(self._docs)

    def get(self, ids: List[str]) -> List[VectorDocument]:
        return [self._docs[i] for i in ids if i in self._docs]

    def clear(self) -> None:
        if self._config:
            self.initialize(self._config)
        self._docs.clear()
        self._id_map.clear()
        self._rev_map.clear()
        self._next_id = 0

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _match_filters(self, metadata: Dict[str, Any], filters: Dict[str, Any]) -> bool:
        for k, v in filters.items():
            if metadata.get(k) != v:
                return False
        return True

    def _rebuild(self) -> None:
        if not self._config:
            return
        import faiss
        import numpy as np

        docs = list(self._docs.values())
        self._id_map.clear()
        self._rev_map.clear()
        self._next_id = 0

        metric = self._config.metric.lower()
        if metric == "cosine":
            self._index = faiss.IndexFlatIP(self._dimension)
        else:
            self._index = faiss.IndexFlatL2(self._dimension)

        if not docs:
            return

        vectors = []
        for doc in docs:
            faiss_id = self._next_id
            self._next_id += 1
            self._id_map[faiss_id] = doc.id
            self._rev_map[doc.id] = faiss_id
            vectors.append(doc.embedding)

        arr = np.array(vectors, dtype=np.float32)
        if metric == "cosine":
            faiss.normalize_L2(arr)
        self._index.add(arr)

    def _save(self, path: Path) -> None:
        import faiss
        path.mkdir(parents=True, exist_ok=True)
        if self._index is not None:
            faiss.write_index(self._index, str(path / "index.faiss"))
        with open(path / "meta.pkl", "wb") as f:
            pickle.dump(
                {
                    "id_map": self._id_map,
                    "rev_map": self._rev_map,
                    "docs": self._docs,
                    "next_id": self._next_id,
                    "dimension": self._dimension,
                },
                f,
            )

    def _load(self, path: Path) -> None:
        import faiss
        self._index = faiss.read_index(str(path / "index.faiss"))
        with open(path / "meta.pkl", "rb") as f:
            data = pickle.load(f)
        self._id_map = data["id_map"]
        self._rev_map = data["rev_map"]
        self._docs = data["docs"]
        self._next_id = data["next_id"]
        self._dimension = data["dimension"]
