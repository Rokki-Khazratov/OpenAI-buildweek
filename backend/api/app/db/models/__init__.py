"""Import all ORM models so Alembic can discover metadata."""

from app.db.models.audit import AuditEvent
from app.db.models.auth import RefreshToken
from app.db.models.classroom import ClassExam, Classroom
from app.db.models.exam import Exam
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMember

__all__ = [
    "AuditEvent",
    "ClassExam",
    "Classroom",
    "Exam",
    "RefreshToken",
    "User",
    "Workspace",
    "WorkspaceMember",
]
