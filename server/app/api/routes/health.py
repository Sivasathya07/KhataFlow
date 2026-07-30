from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.database.mongo import check_database

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Return the service health status."""
    return {"status": "healthy"}


@router.get("/health/ready")
async def readiness_check() -> JSONResponse:
    """Report database readiness without leaking Atlas configuration."""
    ready = check_database()
    return JSONResponse(status_code=status.HTTP_200_OK if ready else status.HTTP_503_SERVICE_UNAVAILABLE, content={"status": "ready" if ready else "degraded", "database": "connected" if ready else "unavailable"})
