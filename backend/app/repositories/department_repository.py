from __future__ import annotations

import uuid

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.user_department import UserDepartment


class DepartmentRepository:
    def list_all(self, db: Session) -> list[Department]:
        stmt = select(Department).order_by(Department.department_name)
        return list(db.scalars(stmt).all())

    def get_by_id(self, db: Session, department_id: uuid.UUID) -> Department | None:
        return db.get(Department, department_id)

    def name_map(self, db: Session) -> dict[uuid.UUID, str]:
        rows = self.list_all(db)
        return {r.department_id: r.department_name for r in rows}

    def has_members(self, db: Session, department_id: uuid.UUID) -> bool:
        stmt = select(func.count()).select_from(UserDepartment).where(
            UserDepartment.department_id == department_id
        )
        return db.execute(stmt).scalar_one() > 0

    def has_sub_departments(self, db: Session, department_id: uuid.UUID) -> bool:
        stmt = select(func.count()).select_from(Department).where(
            Department.parent_department_id == department_id
        )
        return db.execute(stmt).scalar_one() > 0

    def create(
        self,
        db: Session,
        *,
        name: str,
        parent_id: uuid.UUID | None,
    ) -> Department:
        dept = Department(
            department_id=uuid.uuid4(),
            department_name=name,
            parent_department_id=parent_id,
        )
        db.add(dept)
        db.flush()
        return dept

    def update(
        self,
        db: Session,
        department_id: uuid.UUID,
        *,
        name: str,
        parent_id: uuid.UUID | None,
    ) -> Department:
        dept = db.get(Department, department_id)
        if dept is None:
            raise ValueError(f"Department {department_id} not found")
        dept.department_name = name
        dept.parent_department_id = parent_id
        db.flush()
        return dept

    def expand_subtree(
        self, db: Session, dept_ids: list[uuid.UUID]
    ) -> list[uuid.UUID]:
        """Return dept_ids plus all transitive child department IDs (recursive CTE)."""
        if not dept_ids:
            return []
        roots_literal = "{" + ",".join(str(d) for d in dept_ids) + "}"
        rows = db.execute(
            text("""
                WITH RECURSIVE subtree AS (
                    SELECT department_id FROM departments
                    WHERE department_id = ANY(CAST(:roots AS uuid[]))
                    UNION ALL
                    SELECT d.department_id FROM departments d
                    JOIN subtree s ON d.parent_department_id = s.department_id
                )
                SELECT department_id FROM subtree
            """),
            {"roots": roots_literal},
        ).all()
        return [row[0] for row in rows]

    def delete(self, db: Session, department_id: uuid.UUID) -> None:
        dept = db.get(Department, department_id)
        if dept is None:
            raise ValueError(f"Department {department_id} not found")
        db.delete(dept)
        db.flush()
