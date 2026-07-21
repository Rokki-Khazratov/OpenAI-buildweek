"""Import all ORM models so Alembic can discover metadata."""

from app.db.models.analytics import (
    AnalyticsShadowResult,
    AnalyticsSnapshot,
    CohortAnalyticsEvent,
    SkillObservationRecord,
    SkillTaxonomyEntry,
)
from app.db.models.artifact import Artifact, ArtifactChunk, ArtifactPage, ArtifactProcessingJob
from app.db.models.attempt import (
    Attempt,
    AttemptResponse,
    MockExam,
    MockQuestion,
    QuestionEvaluation,
)
from app.db.models.audit import AuditEvent
from app.db.models.auth import RefreshToken
from app.db.models.blueprint import ExamBlueprint
from app.db.models.classroom import ClassExam, ClassMember, Classroom
from app.db.models.exam import Exam
from app.db.models.library import LibraryClone, LibraryPublication
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMember

__all__ = [
    "AnalyticsShadowResult",
    "AnalyticsSnapshot",
    "Artifact",
    "ArtifactChunk",
    "ArtifactPage",
    "ArtifactProcessingJob",
    "Attempt",
    "AttemptResponse",
    "AuditEvent",
    "ClassExam",
    "ClassMember",
    "Classroom",
    "CohortAnalyticsEvent",
    "Exam",
    "ExamBlueprint",
    "LibraryClone",
    "LibraryPublication",
    "MockExam",
    "MockQuestion",
    "QuestionEvaluation",
    "RefreshToken",
    "SkillObservationRecord",
    "SkillTaxonomyEntry",
    "User",
    "Workspace",
    "WorkspaceMember",
]
