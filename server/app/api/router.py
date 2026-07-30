from fastapi import APIRouter

from app.api.routes.health import router as health_router
from app.api.routes.auth import router as auth_router
from app.api.routes.customers import router as customers_router
from app.api.routes.inventory import router as inventory_router
from app.api.routes.inventory_management import router as inventory_management_router
from app.api.routes.transactions import router as transactions_router
from app.api.routes.voice import router as voice_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.reports import router as reports_router
from app.api.routes.settings import router as settings_router
from app.api.routes.agent import router as agent_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.suppliers import router as suppliers_router
from app.api.routes.daily_close import router as daily_close_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router, prefix="/api/v1")
api_router.include_router(customers_router, prefix="/api/v1")
api_router.include_router(inventory_router, prefix="/api/v1")
api_router.include_router(inventory_management_router, prefix="/api/v1")
api_router.include_router(transactions_router, prefix="/api/v1")
api_router.include_router(voice_router, prefix="/api/v1")
api_router.include_router(dashboard_router, prefix="/api/v1")
api_router.include_router(reports_router, prefix="/api/v1")
api_router.include_router(settings_router, prefix="/api/v1")
api_router.include_router(agent_router, prefix="/api/v1")
api_router.include_router(notifications_router, prefix="/api/v1")
api_router.include_router(suppliers_router, prefix="/api/v1")
api_router.include_router(daily_close_router, prefix="/api/v1")
