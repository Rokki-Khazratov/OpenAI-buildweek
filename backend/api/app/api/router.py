"""Top-level API router."""

from fastapi import APIRouter

from app.api.routes.attempts import router as attempts_router
from app.api.routes.auth import router as auth_router
from app.api.routes.classes import router as classes_router
from app.api.routes.exams import router as exams_router
from app.api.routes.health import router as health_router
from app.api.routes.subjects import router as subjects_router
from app.api.routes.users import router as users_router
from app.api.routes.workspaces import router as workspaces_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(attempts_router, tags=["mocks", "attempts"])
api_router.include_router(users_router, tags=["users"])
api_router.include_router(subjects_router, tags=["subjects"])
api_router.include_router(exams_router, tags=["exams"])
api_router.include_router(classes_router, tags=["classes"])
api_router.include_router(workspaces_router, tags=["workspaces"])
