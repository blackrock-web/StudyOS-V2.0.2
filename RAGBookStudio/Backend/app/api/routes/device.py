"""Device manager endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from Core.device.manager import get_device_manager

router = APIRouter()


class PreferenceBody(BaseModel):
    preference: str  # auto | cpu | gpu


@router.get("/")
async def get_device_info():
    dm = get_device_manager()
    return dm.get_display_info()


@router.post("/preference")
async def set_preference(body: PreferenceBody):
    dm = get_device_manager()
    try:
        dm.set_preference(body.preference)
        dm.refresh()
        return dm.get_display_info()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/refresh")
async def refresh_devices():
    dm = get_device_manager()
    dm.refresh()
    return dm.get_display_info()
