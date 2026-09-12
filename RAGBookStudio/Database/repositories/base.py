"""
Abstract repository pattern – current implementation uses SQLite / file storage.
Swap to PostgreSQL by providing a new concrete repository; no other code changes required.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, Generic, List, Optional, TypeVar

T = TypeVar("T")


class BaseRepository(ABC, Generic[T]):
    @abstractmethod
    async def get(self, id: str) -> Optional[T]: ...

    @abstractmethod
    async def list(self, filters: Optional[Dict[str, Any]] = None, limit: int = 100) -> List[T]: ...

    @abstractmethod
    async def create(self, entity: T) -> T: ...

    @abstractmethod
    async def update(self, id: str, data: Dict[str, Any]) -> Optional[T]: ...

    @abstractmethod
    async def delete(self, id: str) -> bool: ...
