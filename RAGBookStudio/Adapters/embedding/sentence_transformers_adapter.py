"""
Sentence-Transformers based EmbeddingProvider adapter.
Works with BGE, E5, Nomic, Jina, and any HF sentence-transformers model.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, List, Optional

from Interfaces.providers import (
    BaseEmbeddingProvider,
    DeviceType,
    EmbeddingResult,
    ModelMetadata,
)

logger = logging.getLogger(__name__)


class SentenceTransformersEmbedding(BaseEmbeddingProvider):
    """
    Adapter that wraps sentence-transformers.
    Model path / name is taken from metadata.path or metadata.extra['model_name'].
    """

    def __init__(self, metadata: ModelMetadata):
        super().__init__(metadata)
        self._model = None
        self._model_name = (
            metadata.extra.get("model_name")
            or metadata.name
            or "BAAI/bge-small-en-v1.5"
        )

        # If the user has dropped their own trained/fine-tuned checkpoint into
        # this model's weights/ folder (e.g. after training a custom BGE model
        # and exporting it with SentenceTransformer.save()), prefer that local
        # checkpoint over the hub name automatically. No config change needed.
        if metadata.path:
            local_weights = Path(metadata.path) / "weights"
            placeholder_names = {"readme.md", ".gitkeep", ".gitignore", ".ds_store"}
            has_real_weights = local_weights.exists() and any(
                p.name.lower() not in placeholder_names for p in local_weights.iterdir()
            )
            if has_real_weights:
                logger.info(
                    "Using locally-trained checkpoint for %s: %s",
                    metadata.name, local_weights,
                )
                self._model_name = str(local_weights)

    def load(self, device: DeviceType = DeviceType.AUTO) -> None:
        if self._loaded:
            return
        try:
            from sentence_transformers import SentenceTransformer
            from Core.device.manager import get_device_manager

            dm = get_device_manager()
            if device == DeviceType.AUTO:
                torch_device = dm.get_torch_device()
            elif device == DeviceType.CPU:
                torch_device = "cpu"
            else:
                torch_device = dm.get_torch_device()

            logger.info("Loading embedding model %s on %s", self._model_name, torch_device)
            self._model = SentenceTransformer(self._model_name, device=torch_device)
            self._device = device
            self._loaded = True
            # Update dimension from actual model
            if hasattr(self._model, "get_embedding_dimension"):
                dim = self._model.get_embedding_dimension()
                self._metadata.dimension = dim
            elif hasattr(self._model, "get_sentence_embedding_dimension"):
                dim = self._model.get_sentence_embedding_dimension()
                self._metadata.dimension = dim
        except Exception as e:
            logger.error("Failed to load embedding model: %s", e)
            raise

    def unload(self) -> None:
        self._model = None
        self._loaded = False
        try:
            import gc
            import torch
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass

    def generate_embeddings(
        self,
        texts: List[str],
        batch_size: int = 32,
        normalize: bool = True,
        **kwargs: Any,
    ) -> EmbeddingResult:
        if not self._loaded or self._model is None:
            self.load()
        assert self._model is not None

        embeddings = self._model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=normalize,
            show_progress_bar=False,
            convert_to_numpy=True,
            **kwargs,
        )
        emb_list = embeddings.tolist()
        dim = len(emb_list[0]) if emb_list else (self._metadata.dimension or 0)
        return EmbeddingResult(
            embeddings=emb_list,
            model=self._model_name,
            dimension=dim,
            usage={"tokens": sum(len(t.split()) for t in texts)},
        )
