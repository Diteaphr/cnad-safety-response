from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.safety_response import SafetyResponse


class SafetyResponseRepository:
    def upsert(
        self,
        db: Session,
        *,
        event_id: uuid.UUID,
        user_id: uuid.UUID,
        status: str,
        comment: Optional[str],
        location: Optional[str],
    ) -> SafetyResponse:
        now = datetime.now(timezone.utc)
        new_id = uuid.uuid4()
        stmt = (
            insert(SafetyResponse)
            .values(
                response_id=new_id,
                event_id=event_id,
                user_id=user_id,
                status=status,
                comment=comment,
                location=location,
                responded_at=now,
            )
            .on_conflict_do_update(
                constraint="uq_safety_responses_event_user",
                set_={
                    "status": status,
                    "comment": comment,
                    "location": location,
                    "responded_at": now,
                },
            )
        )
        db.execute(stmt)
        row = self.get_by_event_and_user(db, event_id, user_id)
        if row is None:
            raise RuntimeError("Upsert did not produce a row")
        return row

    def get_by_event_and_user(
        self, db: Session, event_id: uuid.UUID, user_id: uuid.UUID
    ) -> Optional[SafetyResponse]:
        stmt = select(SafetyResponse).where(
            SafetyResponse.event_id == event_id,
            SafetyResponse.user_id == user_id,
        )
        return db.execute(stmt).scalar_one_or_none()

    def list_for_event(self, db: Session, event_id: uuid.UUID) -> list[SafetyResponse]:
        stmt = select(SafetyResponse).where(SafetyResponse.event_id == event_id)
        return list(db.scalars(stmt).all())

    def list_for_user(self, db: Session, user_id: uuid.UUID) -> list[SafetyResponse]:
        stmt = (
            select(SafetyResponse)
            .where(SafetyResponse.user_id == user_id)
            .order_by(SafetyResponse.responded_at.desc())
        )
        return list(db.scalars(stmt).all())

    def list_all(self, db: Session) -> list[SafetyResponse]:
        stmt = select(SafetyResponse)
        return list(db.scalars(stmt).all())

    def latest_for_users(
        self, db: Session, event_id: uuid.UUID, user_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, SafetyResponse]:
        """Return the latest SafetyResponse per user for the given event (one query)."""
        if not user_ids:
            return {}
        subq = (
            select(
                SafetyResponse.user_id,
                func.max(SafetyResponse.responded_at).label("max_at"),
            )
            .where(
                SafetyResponse.event_id == event_id,
                SafetyResponse.user_id.in_(user_ids),
            )
            .group_by(SafetyResponse.user_id)
            .subquery()
        )
        stmt = select(SafetyResponse).join(
            subq,
            (SafetyResponse.user_id == subq.c.user_id)
            & (SafetyResponse.responded_at == subq.c.max_at),
        )
        return {r.user_id: r for r in db.scalars(stmt).all()}

    def admin_kpi(self, db: Session, *, event_id: uuid.UUID) -> dict[str, int]:
        """Global KPI for all employees company-wide for the given event."""
        row = db.execute(
            text("""
                WITH employees AS (
                    SELECT u.user_id
                    FROM users u
                    INNER JOIN user_roles ur ON ur.user_id = u.user_id
                    INNER JOIN roles r ON r.role_id = ur.role_id
                    WHERE r.role_name = 'employee'
                ),
                latest AS (
                    SELECT DISTINCT ON (sr.user_id) sr.user_id, sr.status
                    FROM safety_responses sr
                    WHERE sr.event_id = :event_id
                      AND sr.user_id IN (SELECT user_id FROM employees)
                    ORDER BY sr.user_id, sr.responded_at DESC
                )
                SELECT
                    (SELECT COUNT(*) FROM employees)                              AS targeted,
                    COALESCE(SUM(CASE WHEN status = 'safe'      THEN 1 END), 0)  AS safe_count,
                    COALESCE(SUM(CASE WHEN status = 'need_help' THEN 1 END), 0)  AS need_help_count,
                    COUNT(*)                                                      AS responded
                FROM latest
            """),
            {"event_id": event_id},
        ).one()
        targeted = int(row.targeted)
        responded = int(row.responded)
        return {
            "safe": int(row.safe_count),
            "need_help": int(row.need_help_count),
            "responded": responded,
            "targeted": targeted,
            "pending": targeted - responded,
        }

    def admin_dept_stats(self, db: Session, *, event_id: uuid.UUID) -> list[dict]:
        """Per-department response breakdown for all employees company-wide."""
        rows = db.execute(
            text("""
                WITH employees AS (
                    SELECT u.user_id, ud.department_id
                    FROM users u
                    INNER JOIN user_roles ur ON ur.user_id = u.user_id
                    INNER JOIN roles r ON r.role_id = ur.role_id
                    INNER JOIN user_departments ud
                        ON ud.user_id = u.user_id AND ud.is_primary = true
                    WHERE r.role_name = 'employee'
                ),
                latest AS (
                    SELECT DISTINCT ON (sr.user_id) sr.user_id, sr.status
                    FROM safety_responses sr
                    WHERE sr.event_id = :event_id
                      AND sr.user_id IN (SELECT user_id FROM employees)
                    ORDER BY sr.user_id, sr.responded_at DESC
                )
                SELECT
                    d.department_name,
                    COUNT(e.user_id)                                              AS total,
                    COALESCE(SUM(CASE WHEN lr.status = 'safe'      THEN 1 END), 0) AS safe_count,
                    COALESCE(SUM(CASE WHEN lr.status = 'need_help' THEN 1 END), 0) AS need_help_count,
                    COUNT(e.user_id) - COUNT(lr.user_id)                          AS pending
                FROM employees e
                JOIN departments d ON d.department_id = e.department_id
                LEFT JOIN latest lr ON lr.user_id = e.user_id
                GROUP BY d.department_id, d.department_name
                ORDER BY d.department_name
            """),
            {"event_id": event_id},
        ).all()
        return [
            {
                "department": r.department_name,
                "safe": int(r.safe_count),
                "need_help": int(r.need_help_count),
                "pending": int(r.pending),
            }
            for r in rows
        ]

    def kpi_for_manager_subordinates(
        self, db: Session, *, event_id: uuid.UUID, manager_id: uuid.UUID
    ) -> dict[str, int]:
        """
        Return KPI counts for employees under manager_id: primary department in any subtree
        rooted at a department where departments.manager_id = manager_id (recursive by parent).
        """
        row = db.execute(
            text("""
                WITH RECURSIVE subdepts(department_id) AS (
                    SELECT department_id FROM departments WHERE manager_id = :manager_id
                    UNION ALL
                    SELECT d.department_id FROM departments d
                    INNER JOIN subdepts s ON d.parent_department_id = s.department_id
                ),
                employees AS (
                    SELECT u.user_id
                    FROM users u
                    INNER JOIN user_departments ud
                        ON ud.user_id = u.user_id AND ud.is_primary = true
                    INNER JOIN user_roles ur ON ur.user_id = u.user_id
                    INNER JOIN roles r ON r.role_id = ur.role_id
                    WHERE ud.department_id IN (SELECT department_id FROM subdepts)
                      AND r.role_name = 'employee'
                      AND u.user_id <> :manager_id
                ),
                latest AS (
                    SELECT DISTINCT ON (sr.user_id) sr.user_id, sr.status
                    FROM safety_responses sr
                    WHERE sr.event_id = :event_id
                      AND sr.user_id IN (SELECT user_id FROM employees)
                    ORDER BY sr.user_id, sr.responded_at DESC
                )
                SELECT
                    (SELECT COUNT(*) FROM employees)                              AS total,
                    COALESCE(SUM(CASE WHEN status = 'safe'      THEN 1 END), 0)  AS safe_count,
                    COALESCE(SUM(CASE WHEN status = 'need_help' THEN 1 END), 0)  AS need_help_count,
                    COUNT(*)                                                      AS responded
                FROM latest
            """),
            {"manager_id": manager_id, "event_id": event_id},
        ).one()
        total = int(row.total)
        responded = int(row.responded)
        return {
            "safe": int(row.safe_count),
            "need_help": int(row.need_help_count),
            "responded": responded,
            "total": total,
            "pending": total - responded,
        }
