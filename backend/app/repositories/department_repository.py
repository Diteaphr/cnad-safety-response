from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.department import Department


class DepartmentRepository:
    def list_all(self, db: Session) -> list[Department]:
        stmt = select(Department).order_by(Department.department_name)
        return list(db.scalars(stmt).all())

    def get_by_id(self, db: Session, department_id: uuid.UUID) -> Department | None:
        return db.get(Department, department_id)

    def name_map(self, db: Session) -> dict[uuid.UUID, str]:
        rows = self.list_all(db)
        return {r.department_id: r.department_name for r in rows}
