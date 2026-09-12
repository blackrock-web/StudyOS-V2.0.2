"""
Device Manager – automatic detection of CUDA / ROCm / Metal / CPU.
"""

from __future__ import annotations

import logging
import platform
import subprocess
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class DeviceBackend(str, Enum):
    CUDA = "cuda"
    ROCM = "rocm"
    METAL = "metal"
    CPU = "cpu"


@dataclass
class DeviceInfo:
    backend: DeviceBackend
    name: str
    index: int = 0
    total_memory_mb: Optional[int] = None
    free_memory_mb: Optional[int] = None
    compute_capability: Optional[str] = None
    is_available: bool = True
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SystemResources:
    cpu_count: int
    cpu_threads: int
    total_ram_mb: int
    available_ram_mb: int
    devices: List[DeviceInfo] = field(default_factory=list)
    preferred_device: DeviceBackend = DeviceBackend.CPU


class DeviceManager:
    """
    Singleton-style device manager.
    Detects available accelerators and provides a consistent interface
    for the rest of the application.
    """

    _instance: Optional["DeviceManager"] = None

    def __new__(cls) -> "DeviceManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._user_preference: str = "auto"  # auto | cpu | gpu
        self._resources: Optional[SystemResources] = None
        self._initialized = True
        self.refresh()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def set_preference(self, preference: str) -> None:
        """Set user preference: 'auto', 'cpu', or 'gpu'."""
        preference = preference.lower().strip()
        if preference not in ("auto", "cpu", "gpu"):
            raise ValueError("preference must be one of: auto, cpu, gpu")
        self._user_preference = preference
        logger.info("Device preference set to: %s", preference)

    @property
    def preference(self) -> str:
        return self._user_preference

    def refresh(self) -> SystemResources:
        """Re-scan hardware and update internal state."""
        resources = SystemResources(
            cpu_count=self._get_cpu_count(),
            cpu_threads=self._get_cpu_threads(),
            total_ram_mb=self._get_total_ram_mb(),
            available_ram_mb=self._get_available_ram_mb(),
            devices=[],
        )

        # Detection order: CUDA > ROCm > Metal > CPU
        cuda_devices = self._detect_cuda()
        if cuda_devices:
            resources.devices.extend(cuda_devices)

        rocm_devices = self._detect_rocm()
        if rocm_devices:
            resources.devices.extend(rocm_devices)

        metal_devices = self._detect_metal()
        if metal_devices:
            resources.devices.extend(metal_devices)

        # Always add CPU as fallback
        resources.devices.append(
            DeviceInfo(
                backend=DeviceBackend.CPU,
                name=platform.processor() or "CPU",
                index=0,
                total_memory_mb=resources.total_ram_mb,
                free_memory_mb=resources.available_ram_mb,
            )
        )

        resources.preferred_device = self._resolve_preferred(resources)
        self._resources = resources
        logger.info(
            "Device scan complete. Preferred: %s | Devices: %s",
            resources.preferred_device.value,
            [d.name for d in resources.devices],
        )
        return resources

    @property
    def resources(self) -> SystemResources:
        if self._resources is None:
            self.refresh()
        assert self._resources is not None
        return self._resources

    def get_current_device(self) -> DeviceInfo:
        """Return the device that should be used right now."""
        resources = self.resources
        preferred = resources.preferred_device

        for dev in resources.devices:
            if dev.backend == preferred and dev.is_available:
                return dev

        # Fallback to CPU
        for dev in resources.devices:
            if dev.backend == DeviceBackend.CPU:
                return dev

        raise RuntimeError("No usable device found")

    def get_torch_device(self) -> str:
        """
        Return a string suitable for torch.device(...) or similar libraries.
        Examples: 'cuda:0', 'mps', 'cpu'
        """
        device = self.get_current_device()
        if device.backend == DeviceBackend.CUDA:
            return f"cuda:{device.index}"
        if device.backend == DeviceBackend.ROCM:
            return f"cuda:{device.index}"  # ROCm uses CUDA API surface
        if device.backend == DeviceBackend.METAL:
            return "mps"
        return "cpu"

    def get_display_info(self) -> Dict[str, Any]:
        """Human-readable summary for the UI."""
        device = self.get_current_device()
        return {
            "preference": self._user_preference,
            "backend": device.backend.value,
            "name": device.name,
            "memory_total_mb": device.total_memory_mb,
            "memory_free_mb": device.free_memory_mb,
            "cpu_count": self.resources.cpu_count,
            "cpu_threads": self.resources.cpu_threads,
            "total_ram_mb": self.resources.total_ram_mb,
            "available_ram_mb": self.resources.available_ram_mb,
            "all_devices": [
                {
                    "backend": d.backend.value,
                    "name": d.name,
                    "index": d.index,
                    "memory_mb": d.total_memory_mb,
                }
                for d in self.resources.devices
            ],
        }

    # ------------------------------------------------------------------
    # Detection helpers
    # ------------------------------------------------------------------

    def _resolve_preferred(self, resources: SystemResources) -> DeviceBackend:
        if self._user_preference == "cpu":
            return DeviceBackend.CPU

        if self._user_preference == "gpu":
            for backend in (DeviceBackend.CUDA, DeviceBackend.ROCM, DeviceBackend.METAL):
                if any(d.backend == backend and d.is_available for d in resources.devices):
                    return backend
            return DeviceBackend.CPU

        # auto
        for backend in (DeviceBackend.CUDA, DeviceBackend.ROCM, DeviceBackend.METAL):
            if any(d.backend == backend and d.is_available for d in resources.devices):
                return backend
        return DeviceBackend.CPU

    def _detect_cuda(self) -> List[DeviceInfo]:
        devices: List[DeviceInfo] = []
        try:
            import torch
            if torch.cuda.is_available() and not self._is_rocm():
                count = torch.cuda.device_count()
                for i in range(count):
                    props = torch.cuda.get_device_properties(i)
                    total = props.total_memory // (1024 * 1024)
                    free, _ = torch.cuda.mem_get_info(i) if hasattr(torch.cuda, "mem_get_info") else (0, 0)
                    devices.append(
                        DeviceInfo(
                            backend=DeviceBackend.CUDA,
                            name=props.name,
                            index=i,
                            total_memory_mb=total,
                            free_memory_mb=free // (1024 * 1024) if free else None,
                            compute_capability=f"{props.major}.{props.minor}",
                        )
                    )
        except Exception as e:
            logger.debug("CUDA detection failed: %s", e)
        return devices

    def _detect_rocm(self) -> List[DeviceInfo]:
        devices: List[DeviceInfo] = []
        if not self._is_rocm():
            return devices
        try:
            import torch
            if torch.cuda.is_available():
                count = torch.cuda.device_count()
                for i in range(count):
                    props = torch.cuda.get_device_properties(i)
                    total = props.total_memory // (1024 * 1024)
                    devices.append(
                        DeviceInfo(
                            backend=DeviceBackend.ROCM,
                            name=props.name,
                            index=i,
                            total_memory_mb=total,
                        )
                    )
        except Exception as e:
            logger.debug("ROCm detection failed: %s", e)
        return devices

    def _detect_metal(self) -> List[DeviceInfo]:
        devices: List[DeviceInfo] = []
        if platform.system() != "Darwin":
            return devices
        try:
            import torch
            if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                devices.append(
                    DeviceInfo(
                        backend=DeviceBackend.METAL,
                        name="Apple Metal",
                        index=0,
                    )
                )
        except Exception as e:
            logger.debug("Metal detection failed: %s", e)
        return devices

    @staticmethod
    def _is_rocm() -> bool:
        try:
            import torch
            return hasattr(torch.version, "hip") and torch.version.hip is not None
        except Exception:
            return False

    @staticmethod
    def _get_cpu_count() -> int:
        import os
        return os.cpu_count() or 1

    @staticmethod
    def _get_cpu_threads() -> int:
        import os
        return os.cpu_count() or 1

    @staticmethod
    def _get_total_ram_mb() -> int:
        try:
            import psutil
            return psutil.virtual_memory().total // (1024 * 1024)
        except Exception:
            return 0

    @staticmethod
    def _get_available_ram_mb() -> int:
        try:
            import psutil
            return psutil.virtual_memory().available // (1024 * 1024)
        except Exception:
            return 0


# Convenience singleton accessor
def get_device_manager() -> DeviceManager:
    return DeviceManager()
