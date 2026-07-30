"""Shared Pydantic primitives for MongoDB-backed documents."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field
from pydantic_core import core_schema


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


class MongoId(ObjectId):
    """BSON ObjectId with native Pydantic v2 validation and JSON support."""

    @classmethod
    def _validate(cls, value: ObjectId | str) -> ObjectId:
        """Accept BSON ObjectIds and their canonical 24-character string form."""
        if isinstance(value, ObjectId):
            return value
        if isinstance(value, str) and ObjectId.is_valid(value):
            return cls(value)
        raise ValueError("Invalid MongoDB ObjectId")

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler: Any
    ) -> core_schema.CoreSchema:
        """Provide validation and string serialization without arbitrary types."""
        return core_schema.no_info_after_validator_function(
            cls._validate,
            core_schema.union_schema(
                [core_schema.is_instance_schema(ObjectId), core_schema.str_schema()]
            ),
            serialization=core_schema.to_string_ser_schema(),
        )

    @classmethod
    def __get_pydantic_json_schema__(
        cls, core_schema_: core_schema.CoreSchema, handler: Any
    ) -> dict[str, Any]:
        """Expose ObjectIds as strings so FastAPI can build OpenAPI correctly."""
        return {"type": "string", "pattern": "^[0-9a-fA-F]{24}$"}


class SchemaModel(BaseModel):
    """Base configuration for API-facing Pydantic models."""

    model_config = ConfigDict(
        populate_by_name=True,
        extra="forbid",
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class MongoDocument(SchemaModel):
    """Common persisted fields for every top-level MongoDB collection."""

    id: MongoId = Field(default_factory=MongoId, alias="_id")
    public_id: UUID = Field(default_factory=uuid4, alias="publicId", description="Stable externally safe identifier")
    created_at: datetime = Field(default_factory=utc_now, alias="createdAt")
    updated_at: datetime = Field(default_factory=utc_now, alias="updatedAt")
    ai_metadata: dict[str, Any] = Field(default_factory=dict, alias="aiMetadata")
