"""PaddleOCR provider adapter."""

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


class PaddleOCRProvider(BaseOCRProvider):
    def __init__(self, metadata: Optional[ModelMetadata] = None):
        meta = metadata or ModelMetadata(
            name="paddleocr",
            type="ocr",
            version="2.x",
            provider="paddleocr",
            device_support=["cpu", "cuda"],
            description="PaddleOCR – high-accuracy multilingual OCR",
        )
        super().__init__(meta)
        self._ocr = None

    def load(self, device: DeviceType = DeviceType.AUTO) -> None:
        if self._loaded:
            return
        try:
            from paddleocr import PaddleOCR
            from Core.device.manager import get_device_manager

            dm = get_device_manager()
            use_gpu = False
            if device != DeviceType.CPU:
                backend = dm.get_current_device().backend.value
                use_gpu = backend in ("cuda", "rocm")

            lang = self._metadata.extra.get("lang", "en")
            self._ocr = PaddleOCR(use_angle_cls=True, lang=lang, use_gpu=use_gpu, show_log=False)
            self._loaded = True
            logger.info("PaddleOCR loaded (gpu=%s)", use_gpu)
        except ImportError as e:
            raise RuntimeError("paddleocr required. Install: pip install paddleocr paddlepaddle") from e

    def unload(self) -> None:
        self._ocr = None
        self._loaded = False

    def recognize(
        self,
        image_path: str | bytes,
        languages: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> OCRResult:
        if not self._loaded:
            self.load()
        assert self._ocr is not None

        import tempfile
        import os

        path = image_path
        tmp = None
        if isinstance(image_path, bytes):
            tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
            tmp.write(image_path)
            tmp.close()
            path = tmp.name

        try:
            raw = self._ocr.ocr(path, cls=True)
        finally:
            if tmp:
                os.unlink(tmp.name)

        texts = []
        boxes = []
        confidences = []
        if raw:
            for line in (raw[0] or []):
                if not line:
                    continue
                bbox, (text, conf) = line
                texts.append(text)
                confidences.append(float(conf))
                boxes.append({"text": text, "bbox": bbox, "confidence": float(conf)})

        avg = sum(confidences) / len(confidences) if confidences else 0.0
        return OCRResult(text="\n".join(texts), confidence=avg, boxes=boxes)
