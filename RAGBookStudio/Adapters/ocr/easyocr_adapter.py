"""EasyOCR provider adapter."""

from __future__ import annotations

import logging
from typing import Any, List, Optional

from Interfaces.providers import (
    BaseOCRProvider,
    DeviceType,
    ModelMetadata,
    OCRResult,
)

logger = logging.getLogger(__name__)


class EasyOCRProvider(BaseOCRProvider):
    def __init__(self, metadata: Optional[ModelMetadata] = None):
        meta = metadata or ModelMetadata(
            name="easyocr",
            type="ocr",
            version="1.x",
            provider="easyocr",
            device_support=["cpu", "cuda"],
            description="EasyOCR – multi-language deep learning OCR",
        )
        super().__init__(meta)
        self._reader = None

    def load(self, device: DeviceType = DeviceType.AUTO) -> None:
        if self._loaded:
            return
        try:
            import easyocr
            from Core.device.manager import get_device_manager

            dm = get_device_manager()
            gpu = False
            if device != DeviceType.CPU:
                backend = dm.get_current_device().backend.value
                gpu = backend in ("cuda", "rocm")

            langs = self._metadata.extra.get("languages", ["en"])
            self._reader = easyocr.Reader(langs, gpu=gpu)
            self._loaded = True
            logger.info("EasyOCR loaded (gpu=%s)", gpu)
        except ImportError as e:
            raise RuntimeError("easyocr required. Install: pip install easyocr") from e

    def unload(self) -> None:
        self._reader = None
        self._loaded = False

    def recognize(
        self,
        image_path: str | bytes,
        languages: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> OCRResult:
        if not self._loaded:
            self.load()
        assert self._reader is not None

        import numpy as np
        from PIL import Image
        import io

        if isinstance(image_path, bytes):
            img = np.array(Image.open(io.BytesIO(image_path)))
        else:
            img = image_path

        results = self._reader.readtext(img)
        texts = []
        boxes = []
        confidences = []
        for bbox, text, conf in results:
            texts.append(text)
            confidences.append(float(conf))
            boxes.append({"text": text, "bbox": bbox, "confidence": float(conf)})

        avg = sum(confidences) / len(confidences) if confidences else 0.0
        return OCRResult(text="\n".join(texts), confidence=avg, boxes=boxes)
