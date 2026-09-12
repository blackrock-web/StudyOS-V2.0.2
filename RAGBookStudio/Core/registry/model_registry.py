"""
Model Registry – discovers, loads, and manages installed models.
Models live under Models/{Embeddings,LLMs,OCR,Vision,Rerankers,Speech}/
Each model directory contains metadata.json + optional weights/ config/
"""

from __future__ import annotations

import importlib.util
import json
import logging
import sys
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Type

from Interfaces.providers import (
    BaseEmbeddingProvider,
    BaseLLMProvider,
    BaseOCRProvider,
    BaseRerankerProvider,
    BaseSpeechProvider,
    BaseVisionProvider,
    ModelMetadata,
)

logger = logging.getLogger(__name__)

# Map type string → base class
PROVIDER_BASES: Dict[str, Type] = {
    "embedding": BaseEmbeddingProvider,
    "llm": BaseLLMProvider,
    "ocr": BaseOCRProvider,
    "reranker": BaseRerankerProvider,
    "vision": BaseVisionProvider,
    "speech": BaseSpeechProvider,
}


class ModelRegistry:
    """
    Discovers models from the Models/ directory tree and from Plugins/.
    Provides lookup, enable/disable, and instantiation helpers.
    """

    def __init__(self, models_root: Optional[Path] = None, plugins_root: Optional[Path] = None):
        root = Path(__file__).resolve().parents[2]  # project root
        self.models_root = models_root or (root / "Models")
        self.plugins_root = plugins_root or (root / "Plugins")
        self._registry: Dict[str, ModelMetadata] = {}  # key = "{type}:{name}"
        self._providers: Dict[str, Any] = {}  # instantiated providers
        self._enabled: Dict[str, bool] = {}

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    def discover(self) -> List[ModelMetadata]:
        """Scan Models/ and Plugins/ and populate the registry."""
        self._registry.clear()
        discovered: List[ModelMetadata] = []

        for type_dir in ("Embeddings", "LLMs", "OCR", "Vision", "Rerankers", "Speech"):
            type_path = self.models_root / type_dir
            if not type_path.exists():
                continue
            model_type = type_dir.lower().rstrip("s")  # Embeddings → embedding
            if model_type == "llms":
                model_type = "llm"
            if model_type == "rerankers":
                model_type = "reranker"

            for model_dir in type_path.iterdir():
                if not model_dir.is_dir():
                    continue
                self._prepare_weights(model_dir)
                meta = self._load_metadata(model_dir, model_type)
                if meta:
                    self._auto_ready_check(meta, model_dir)
                    key = f"{meta.type}:{meta.name}"
                    self._registry[key] = meta
                    self._enabled[key] = meta.enabled
                    discovered.append(meta)
                    logger.info(
                        "Discovered model: %s (enabled=%s, ready=%s)",
                        key, meta.enabled, meta.extra.get("ready"),
                    )

        # Plugins can also register models
        self._discover_plugins()

        return discovered

    def _load_metadata(self, model_dir: Path, default_type: str) -> Optional[ModelMetadata]:
        meta_file = model_dir / "metadata.json"
        if not meta_file.exists():
            logger.warning("No metadata.json in %s", model_dir)
            return None
        try:
            data = json.loads(meta_file.read_text(encoding="utf-8"))
            return ModelMetadata(
                name=data.get("name", model_dir.name),
                type=data.get("type", default_type),
                version=data.get("version", "0.0.0"),
                provider=data.get("provider", "unknown"),
                device_support=data.get("device_support", ["cpu"]),
                dimension=data.get("dimension"),
                max_seq_length=data.get("max_seq_length"),
                parameters=data.get("parameters"),
                description=data.get("description", ""),
                path=str(model_dir),
                enabled=data.get("enabled", True),
                extra=data.get("extra", {}),
            )
        except Exception as e:
            logger.error("Failed to parse metadata for %s: %s", model_dir, e)
            return None

    def _prepare_weights(self, model_dir: Path) -> None:
        """
        Zero-config model install: if the user drops a .zip of trained weights
        (e.g. a fine-tuned BGE checkpoint or a GGUF LLM) into a model's
        weights/ folder, extract it automatically so the model becomes usable
        on the next scan without any manual unzip step.
        """
        weights_dir = model_dir / "weights"
        if not weights_dir.exists():
            return
        for zpath in list(weights_dir.glob("*.zip")):
            try:
                logger.info("Auto-extracting dropped weights archive: %s", zpath)
                with zipfile.ZipFile(zpath) as zf:
                    zf.extractall(weights_dir)
                zpath.unlink()
            except Exception as e:
                logger.error("Failed to auto-extract %s: %s", zpath, e)

    _PLACEHOLDER_FILENAMES = {"readme.md", ".gitkeep", ".gitignore", ".ds_store"}

    def _has_real_weight_files(self, weights_dir: Path) -> bool:
        """True only if weights/ contains something other than our own
        placeholder/instruction files (so a fresh checkout with just a
        README.md in weights/ correctly reports 'not ready')."""
        if not weights_dir.exists():
            return False
        for item in weights_dir.iterdir():
            if item.name.lower() not in self._PLACEHOLDER_FILENAMES:
                return True
        return False

    def _auto_ready_check(self, meta: ModelMetadata, model_dir: Path) -> None:
        """
        Populate meta.extra['ready'] and, for models flagged with
        extra.auto_enable, flip enabled=True the moment real weights are
        detected on disk (a dropped GGUF file or a populated weights/ dir
        for a sentence-transformers checkpoint). This is what makes the
        Models/ placeholders "paste your files in and it just works".
        """
        weights_dir = model_dir / "weights"
        ready = False

        if meta.type == "llm" and meta.provider in ("llama.cpp", "llamacpp", "gguf"):
            ready = bool(list(model_dir.glob("**/*.gguf")))
        elif meta.type == "embedding" and meta.provider in (
            "sentence-transformers", "bge", "e5", "nomic", "jina",
        ):
            has_local_weights = self._has_real_weight_files(weights_dir)
            # Also "ready" if it's configured to pull from the HF hub.
            ready = has_local_weights or bool(meta.extra.get("model_name"))
            meta.extra["using_custom_weights"] = has_local_weights
        else:
            ready = True  # no special weight-drop convention for this type

        meta.extra["ready"] = ready
        if ready and meta.extra.get("auto_enable"):
            meta.enabled = True

    def _discover_plugins(self) -> None:
        """Import any Python packages under Plugins/ that expose register()."""
        if not self.plugins_root.exists():
            return
        for plugin_dir in self.plugins_root.iterdir():
            if not plugin_dir.is_dir():
                continue
            init_file = plugin_dir / "__init__.py"
            if not init_file.exists():
                continue
            try:
                spec = importlib.util.spec_from_file_location(
                    f"plugins.{plugin_dir.name}", init_file
                )
                if spec is None or spec.loader is None:
                    continue
                module = importlib.util.module_from_spec(spec)
                sys.modules[spec.name] = module
                spec.loader.exec_module(module)
                if hasattr(module, "register"):
                    module.register(self)
                    logger.info("Loaded plugin: %s", plugin_dir.name)
            except Exception as e:
                logger.error("Failed to load plugin %s: %s", plugin_dir.name, e)

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------

    def list_models(self, model_type: Optional[str] = None, enabled_only: bool = False) -> List[ModelMetadata]:
        results = []
        for key, meta in self._registry.items():
            if model_type and meta.type != model_type:
                continue
            if enabled_only and not self._enabled.get(key, True):
                continue
            results.append(meta)
        return results

    def get_metadata(self, model_type: str, name: str) -> Optional[ModelMetadata]:
        return self._registry.get(f"{model_type}:{name}")

    def is_enabled(self, model_type: str, name: str) -> bool:
        return self._enabled.get(f"{model_type}:{name}", False)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def enable(self, model_type: str, name: str) -> None:
        key = f"{model_type}:{name}"
        if key not in self._registry:
            raise KeyError(f"Model not found: {key}")
        self._enabled[key] = True
        self._registry[key].enabled = True
        self._persist_enabled(key, True)

    def disable(self, model_type: str, name: str) -> None:
        key = f"{model_type}:{name}"
        if key not in self._registry:
            raise KeyError(f"Model not found: {key}")
        self._enabled[key] = False
        self._registry[key].enabled = False
        # Unload if currently loaded
        if key in self._providers:
            try:
                self._providers[key].unload()
            except Exception:
                pass
            del self._providers[key]
        self._persist_enabled(key, False)

    def _persist_enabled(self, key: str, enabled: bool) -> None:
        meta = self._registry.get(key)
        if not meta or not meta.path:
            return
        meta_file = Path(meta.path) / "metadata.json"
        if not meta_file.exists():
            return
        try:
            data = json.loads(meta_file.read_text(encoding="utf-8"))
            data["enabled"] = enabled
            meta_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except Exception as e:
            logger.warning("Could not persist enabled state for %s: %s", key, e)

    # ------------------------------------------------------------------
    # Instantiation
    # ------------------------------------------------------------------

    def get_provider(self, model_type: str, name: str, force_reload: bool = False) -> Any:
        """
        Return an instantiated provider for the given model.
        Loads the model.py (or entry point) from the model directory.
        """
        key = f"{model_type}:{name}"
        if not force_reload and key in self._providers:
            return self._providers[key]

        meta = self._registry.get(key)
        if not meta:
            raise KeyError(f"Model not found: {key}")
        if not self._enabled.get(key, True):
            raise RuntimeError(f"Model is disabled: {key}")

        provider = self._instantiate(meta)
        self._providers[key] = provider
        return provider

    def _instantiate(self, meta: ModelMetadata) -> Any:
        """Load model.py from the model directory and instantiate the provider class."""
        if not meta.path:
            raise RuntimeError(f"No path for model {meta.name}")

        model_py = Path(meta.path) / "model.py"
        if not model_py.exists():
            # Fallback: try common adapter based on provider name
            return self._fallback_adapter(meta)

        spec = importlib.util.spec_from_file_location(
            f"models.{meta.type}.{meta.name}", model_py
        )
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Cannot load model.py for {meta.name}")

        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)

        # Convention: class named after the model or "Provider"
        cls = None
        for attr_name in (meta.name, f"{meta.name}Provider", "Provider", "Model"):
            if hasattr(module, attr_name):
                cls = getattr(module, attr_name)
                break
        if cls is None:
            # Take the first class that subclasses a known base
            for attr in dir(module):
                obj = getattr(module, attr)
                if isinstance(obj, type) and any(
                    issubclass(obj, base) for base in PROVIDER_BASES.values() if base is not object
                ):
                    cls = obj
                    break
        if cls is None:
            raise RuntimeError(f"No suitable provider class found in {model_py}")

        return cls(meta)

    def _fallback_adapter(self, meta: ModelMetadata) -> Any:
        """
        When a model directory has no model.py, try to use a built-in adapter
        based on the provider field (e.g. 'sentence-transformers').
        """
        from Adapters.embedding.sentence_transformers_adapter import SentenceTransformersEmbedding
        from Adapters.llm.llama_cpp_adapter import LlamaCppLLM

        if meta.type == "embedding" and meta.provider in (
            "sentence-transformers",
            "bge",
            "e5",
            "nomic",
            "jina",
        ):
            return SentenceTransformersEmbedding(meta)
        if meta.type == "llm" and meta.provider in ("llama.cpp", "llamacpp", "gguf"):
            return LlamaCppLLM(meta)

        raise RuntimeError(
            f"No model.py and no built-in adapter for provider '{meta.provider}' "
            f"(type={meta.type})"
        )

    def unload_all(self) -> None:
        for key, provider in list(self._providers.items()):
            try:
                provider.unload()
            except Exception as e:
                logger.warning("Error unloading %s: %s", key, e)
        self._providers.clear()

    def register_external(self, metadata: ModelMetadata, provider: Any) -> None:
        """Allow plugins to register a fully constructed provider."""
        key = f"{metadata.type}:{metadata.name}"
        self._registry[key] = metadata
        self._enabled[key] = metadata.enabled
        self._providers[key] = provider
        logger.info("Externally registered model: %s", key)


# Global registry instance (lazy)
_registry: Optional[ModelRegistry] = None


def get_model_registry() -> ModelRegistry:
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
        _registry.discover()
    return _registry
