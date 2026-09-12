"""Tesseract OCR provider adapter."""

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


class TesseractOCR(BaseOCRProvider):
    def __init__(self, metadata: Optional[ModelMetadata] = None):
        meta = metadata or ModelMetadata(
            name="tesseract",
            type="ocr",
            version="5.x",
            provider="tesseract",
            device_support=["cpu"],
            description="Tesseract OCR engine",
        )
        super().__init__(meta)
        self._pytesseract = None

    def load(self, device: DeviceType = DeviceType.AUTO) -> None:
        if self._loaded:
            return
        try:
            import pytesseract
            from PIL import Image
            self._pytesseract = pytesseract
            self._Image = Image
            self._loaded = True
            logger.info("Tesseract OCR loaded")
        except ImportError as e:
            raise RuntimeError(
                "pytesseract and Pillow required. Install: pip install pytesseract pillow. "
                "Also install the tesseract binary on your system."
            ) from e

    def unload(self) -> None:
        self._pytesseract = None
        self._loaded = False

    def recognize(
        self,
        image_path: str | bytes,
        languages: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> OCRResult:
        if not self._loaded:
            self.load()
        assert self._pytesseract is not None

        lang = "+".join(languages) if languages else "eng"
        if isinstance(image_path, bytes):
            import io
            img = self._Image.open(io.BytesIO(image_path))
        else:
            img = self._Image.open(image_path)

        data = self._pytesseract.image_to_data(img, lang=lang, output_type=self._pytesseract.Output.DICT)
        text = self._pytesseract.image_to_string(img, lang=lang)

        boxes = []
        confidences = []
        n = len(data.get("text", []))
        for i in range(n):
            conf = float(data["conf"][i])
            if conf < 0:
                continue
            confidences.append(conf)
            boxes.append({
                "text": data["text"][i],
                "left": data["left"][i],
                "top": data["top"][i],
                "width": data["width"][i],
                "height": data["height"][i],
                "confidence": conf,
            })

        avg_conf = sum(confidences) / len(confidences) / 100.0 if confidences else 0.0
        return OCRResult(text=text.strip(), confidence=avg_conf, boxes=boxes)
