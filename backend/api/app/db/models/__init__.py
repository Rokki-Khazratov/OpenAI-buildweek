"""Import all ORM models so Alembic can discover metadata."""

from app.db.models.artifact import Artifact, ArtifactChunk, ArtifactPage, ArtifactProcessingJob
from app.db.models.attempt import Attempt, AttemptResponse, MockExam, MockQuestion
from app.db.models.audit import AuditEvent
from app.db.models.auth import RefreshToken
from app.db.models.classroom import ClassExam, Classroom
from app.db.models.exam import Exam
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMember

__all__ = [
    "Artifact",
    "ArtifactChunk",
    "ArtifactPage",
    "ArtifactProcessingJob",
    "Attempt",
    "AttemptResponse",
    "AuditEvent",
    "ClassExam",
    "Classroom",
    "Exam",
    "MockExam",
    "MockQuestion",
    "RefreshToken",
    "User",
    "Workspace",
    "WorkspaceMember",
]
