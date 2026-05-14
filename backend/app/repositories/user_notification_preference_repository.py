from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.user_notification_preference import UserNotificationPreference


class UserNotificationPreferenceRepository:
    def ensure_for_user(self, db: Session, user_id: uuid.UUID) -> UserNotificationPreference:
        row = db.get(UserNotificationPreference, user_id)
        if row is None:
            row = UserNotificationPreference(user_id=user_id)
            db.add(row)
            db.flush()
        return row

    def apply_partial(
        self,
        db: Session,
        user_id: uuid.UUID,
        *,
        push_master_enabled: bool | None = None,
        push_emergency_enabled: bool | None = None,
        push_reminder_enabled: bool | None = None,
        push_escalation_enabled: bool | None = None,
    ) -> UserNotificationPreference:
        row = self.ensure_for_user(db, user_id)
        if push_master_enabled is not None:
            row.push_master_enabled = push_master_enabled
        if push_emergency_enabled is not None:
            row.push_emergency_enabled = push_emergency_enabled
        if push_reminder_enabled is not None:
            row.push_reminder_enabled = push_reminder_enabled
        if push_escalation_enabled is not None:
            row.push_escalation_enabled = push_escalation_enabled
        row.updated_at = datetime.now(timezone.utc)
        db.flush()
        return row

    def row_to_api_dict(self, row: UserNotificationPreference) -> dict[str, bool]:
        return {
            "pushEnabled": row.push_master_enabled,
            "pushEmergencyEnabled": row.push_emergency_enabled,
            "pushReminderEnabled": row.push_reminder_enabled,
            "pushEscalationEnabled": row.push_escalation_enabled,
        }
