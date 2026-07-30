"""Notification collection model."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import Field

from app.models.base import MongoDocument, MongoId
from app.models.enums import NotificationChannel, NotificationStatus


class Notification(MongoDocument):
    business_id: UUID = Field(alias="businessId")
    recipient_user_id: MongoId = Field(alias="recipientUserId")
    channel: NotificationChannel
    status: NotificationStatus = NotificationStatus.PENDING
    title: str = Field(min_length=1, max_length=180)
    body: str = Field(min_length=1, max_length=4000)
    payload: dict[str, Any] = Field(default_factory=dict)
    scheduled_for: datetime | None = Field(default=None, alias="scheduledFor")
    sent_at: datetime | None = Field(default=None, alias="sentAt")
    read_at: datetime | None = Field(default=None, alias="readAt")
