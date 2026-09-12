"""
llama.cpp based local LLM adapter (GGUF models).
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, AsyncIterator, List, Optional

from Interfaces.providers import (
    BaseLLMProvider,
    DeviceType,
    LLMMessage,
    LLMResponse,
    ModelMetadata,
)

logger = logging.getLogger(__name__)


class LlamaCppLLM(BaseLLMProvider):
    """
    Offline LLM provider using llama-cpp-python.
    Expects a GGUF file under the model directory or specified in metadata.extra['model_path'].
    """

    def __init__(self, metadata: ModelMetadata):
        super().__init__(metadata)
        self._llm = None
        self._model_path: Optional[str] = None

    def _resolve_model_path(self) -> str:
        if self._metadata.extra.get("model_path"):
            return self._metadata.extra["model_path"]
        if self._metadata.path:
            # Look for .gguf files
            p = Path(self._metadata.path)
            ggufs = list(p.glob("**/*.gguf"))
            if ggufs:
                return str(ggufs[0])
            # Also check weights/
            weights = p / "weights"
            if weights.exists():
                ggufs = list(weights.glob("**/*.gguf"))
                if ggufs:
                    return str(ggufs[0])
        raise FileNotFoundError(
            f"No GGUF model found for {self._metadata.name}. "
            "Place a .gguf file in the model directory or set extra.model_path."
        )

    def load(self, device: DeviceType = DeviceType.AUTO) -> None:
        if self._loaded:
            return
        try:
            from llama_cpp import Llama
            from Core.device.manager import get_device_manager

            self._model_path = self._resolve_model_path()
            dm = get_device_manager()
            n_gpu_layers = 0
            if device != DeviceType.CPU:
                # Heuristic: offload as many layers as possible when GPU is preferred
                preferred = dm.get_current_device()
                if preferred.backend.value in ("cuda", "rocm", "metal"):
                    n_gpu_layers = -1  # all layers

            logger.info(
                "Loading llama.cpp model %s (n_gpu_layers=%s)",
                self._model_path,
                n_gpu_layers,
            )
            self._llm = Llama(
                model_path=self._model_path,
                n_ctx=self._metadata.extra.get("n_ctx", 4096),
                n_gpu_layers=n_gpu_layers,
                verbose=False,
            )
            self._device = device
            self._loaded = True
        except Exception as e:
            logger.error("Failed to load llama.cpp model: %s", e)
            raise

    def unload(self) -> None:
        self._llm = None
        self._loaded = False

    def _messages_to_prompt(self, messages: List[LLMMessage]) -> str:
        """Simple chat template; real models may need specific templates."""
        parts = []
        for m in messages:
            role = m.role.upper()
            parts.append(f"{role}: {m.content}")
        parts.append("ASSISTANT:")
        return "\n".join(parts)

    def generate(
        self,
        messages: List[LLMMessage],
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stop: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        if not self._loaded or self._llm is None:
            self.load()
        assert self._llm is not None

        prompt = self._messages_to_prompt(messages)
        stop = stop or ["USER:", "SYSTEM:"]
        output = self._llm(
            prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            stop=stop,
            echo=False,
            **kwargs,
        )
        text = output["choices"][0]["text"].strip()
        usage = {
            "prompt_tokens": output.get("usage", {}).get("prompt_tokens", 0),
            "completion_tokens": output.get("usage", {}).get("completion_tokens", 0),
        }
        return LLMResponse(
            content=text,
            model=self._metadata.name,
            finish_reason=output["choices"][0].get("finish_reason"),
            usage=usage,
        )

    async def stream(
        self,
        messages: List[LLMMessage],
        max_tokens: int = 1024,
        temperature: float = 0.7,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        if not self._loaded or self._llm is None:
            self.load()
        assert self._llm is not None

        prompt = self._messages_to_prompt(messages)
        stream = self._llm(
            prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=True,
            echo=False,
            **kwargs,
        )
        for chunk in stream:
            text = chunk["choices"][0].get("text", "")
            if text:
                yield text
