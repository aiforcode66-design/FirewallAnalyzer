"""Routers initialization."""

from app.routers.auth import router as auth_router
from app.routers.devices import router as device_router, vendor_router
from app.routers.dashboard import router as dashboard_router

from app.routers.analyzer import router as analyzer_router
from app.routers.changes import router as change_router
from app.routers.rules import router as rules_router
from .migration import router as migration_router
from app.routers.reports import router as reports_router
from app.routers.tuner import router as tuner_router
from app.routers.traffic import router as traffic_router

__all__ = [
    "auth_router",
    "device_router",
    "vendor_router",
    "dashboard_router",
    "analyzer_router",
    "change_router",
    "rules_router",
    "migration_router",
    "reports_router",
    "tuner_router",
    "traffic_router"
]
