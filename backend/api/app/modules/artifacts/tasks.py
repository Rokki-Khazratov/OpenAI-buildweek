"""Thin Dramatiq task boundary for durable artifact jobs."""

import asyncio
import socket
from uuid import UUID

import dramatiq
from dramatiq.brokers.redis import RedisBroker

from app.core.config import get_settings
from app.db.session import Database
from app.integrations.storage import S3Storage
from app.modules.artifacts.processor import (
    TransientProcessingError,
    process_job,
    record_transient_failure,
)

settings = get_settings()
broker = RedisBroker(url=settings.redis_url)  # type: ignore[no-untyped-call]
dramatiq.set_broker(broker)


def should_retry(retries_so_far: int, exception: Exception) -> bool:
    return retries_so_far < 3 and isinstance(exception, TransientProcessingError)


async def run_job(job_id: UUID) -> None:
    database = Database(settings.database_url, echo=settings.database_echo)
    storage = S3Storage(settings)
    try:
        try:
            async with database.session() as session:
                async with session.begin():
                    await process_job(
                        session,
                        storage,
                        settings,
                        job_id,
                        worker_id=socket.gethostname(),
                    )
        except TransientProcessingError as exc:
            async with database.session() as session:
                async with session.begin():
                    await record_transient_failure(session, job_id, exc)
            raise
    finally:
        await database.dispose()


@dramatiq.actor(
    queue_name="artifact_ingest",
    retry_when=should_retry,
    min_backoff=1000,
    max_backoff=30000,
)
def ingest_artifact(job_id: str) -> None:
    asyncio.run(run_job(UUID(job_id)))


def dispatch_job(job_id: UUID) -> None:
    ingest_artifact.send(str(job_id))
