"""
Example plugin that registers a custom chunker strategy.
Plugins are auto-discovered from the Plugins/ directory.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def register(registry) -> None:
    """
    Called by ModelRegistry during discovery.
    Can register models, chunkers, exporters, etc.
    """
    logger.info("Example plugin loaded – no extra models registered in this demo")
    # Example of registering an external model:
    # from Interfaces.providers import ModelMetadata
    # meta = ModelMetadata(name="my-custom", type="embedding", ...)
    # registry.register_external(meta, MyProviderInstance)
