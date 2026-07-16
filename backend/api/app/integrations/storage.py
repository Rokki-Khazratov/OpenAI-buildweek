"""Private S3-compatible object-storage boundary."""

from dataclasses import dataclass
from typing import Protocol

import boto3
from botocore.client import BaseClient
from botocore.config import Config

from app.core.config import Settings


@dataclass(frozen=True, slots=True)
class ObjectMetadata:
    size_bytes: int
    content_type: str
    etag: str
    sha256: str | None


class StorageProtocol(Protocol):
    def presign_put(self, key: str, content_type: str, expires: int) -> str: ...
    def presign_get(self, key: str, expires: int) -> str: ...
    def head(self, key: str) -> ObjectMetadata: ...
    def get_bytes(self, key: str) -> bytes: ...
    def delete(self, key: str) -> None: ...


class S3Storage:
    def __init__(self, settings: Settings) -> None:
        credentials = {
            "aws_access_key_id": settings.storage_access_key.get_secret_value(),
            "aws_secret_access_key": settings.storage_secret_key.get_secret_value(),
            "region_name": settings.storage_region,
            "config": Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        }
        self.bucket = settings.storage_bucket
        self.client: BaseClient = boto3.client(
            "s3", endpoint_url=settings.storage_endpoint_url, **credentials
        )
        self.public_client: BaseClient = boto3.client(
            "s3", endpoint_url=settings.storage_public_endpoint_url, **credentials
        )

    def presign_put(self, key: str, content_type: str, expires: int) -> str:
        return str(
            self.public_client.generate_presigned_url(
                "put_object",
                Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type},
                ExpiresIn=expires,
            )
        )

    def presign_get(self, key: str, expires: int) -> str:
        return str(
            self.public_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires,
            )
        )

    def head(self, key: str) -> ObjectMetadata:
        item = self.client.head_object(Bucket=self.bucket, Key=key)
        metadata = item.get("Metadata", {})
        return ObjectMetadata(
            size_bytes=int(item["ContentLength"]),
            content_type=str(item.get("ContentType", "application/octet-stream")),
            etag=str(item.get("ETag", "")).strip('"'),
            sha256=metadata.get("sha256"),
        )

    def get_bytes(self, key: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        return bytes(response["Body"].read())

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)
