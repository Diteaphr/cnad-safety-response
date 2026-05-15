from __future__ import annotations

import uuid

from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session, selectinload

from app.models.department import Department
from app.models.role import Role
from app.models.user import User
from app.models.user_department import UserDepartment
from app.models.user_role import UserRole


class UserRepository:
    def list_all(
        self, db: Session, limit: int | None = None, offset: int = 0
    ) -> list[User]:
        stmt = (
            select(User)
            .options(
                selectinload(User.user_roles).selectinload(UserRole.role),
                selectinload(User.notification_preference),
                selectinload(User.department_memberships),
            )
            .order_by(User.name)
            .offset(offset)
        )
        if limit is not None:
            stmt = stmt.limit(limit)
        return list(db.scalars(stmt).unique().all())

    def count_all(self, db: Session) -> int:
        return db.execute(select(func.count()).select_from(User)).scalar_one()

    def list_by_department(
        self, db: Session, department_id: uuid.UUID, limit: int | None = None, offset: int = 0
    ) -> list[User]:
        stmt = (
            select(User)
            .join(
                UserDepartment,
                (UserDepartment.user_id == User.user_id) & UserDepartment.is_primary.is_(True),
            )
            .where(UserDepartment.department_id == department_id)
            .options(
                selectinload(User.user_roles).selectinload(UserRole.role),
                selectinload(User.notification_preference),
                selectinload(User.department_memberships),
            )
            .order_by(User.name)
            .offset(offset)
        )
        if limit is not None:
            stmt = stmt.limit(limit)
        return list(db.scalars(stmt).unique().all())

    def count_by_department(self, db: Session, department_id: uuid.UUID) -> int:
        return db.execute(
            select(func.count())
            .select_from(UserDepartment)
            .where(
                UserDepartment.department_id == department_id,
                UserDepartment.is_primary.is_(True),
            )
        ).scalar_one()

    def get_by_id(self, db: Session, user_id: uuid.UUID) -> User | None:
        stmt = (
            select(User)
            .options(
                selectinload(User.user_roles).selectinload(UserRole.role),
                selectinload(User.notification_preference),
                selectinload(User.department_memberships),
            )
            .where(User.user_id == user_id)
        )
        return db.execute(stmt).unique().scalar_one_or_none()

    def get_by_email(self, db: Session, email: str) -> User | None:
        em = email.strip().lower()
        stmt = (
            select(User)
            .options(
                selectinload(User.user_roles).selectinload(UserRole.role),
                selectinload(User.notification_preference),
                selectinload(User.department_memberships),
            )
            .where(func.lower(User.email) == em)
        )
        return db.execute(stmt).unique().scalar_one_or_none()

    def get_primary_department_id(self, db: Session, user_id: uuid.UUID) -> uuid.UUID | None:
        stmt = (
            select(UserDepartment.department_id)
            .where(UserDepartment.user_id == user_id, UserDepartment.is_primary.is_(True))
            .limit(1)
        )
        return db.execute(stmt).scalar_one_or_none()

    def primary_department_map(
        self, db: Session, user_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, uuid.UUID | None]:
        if not user_ids:
            return {}
        stmt = select(UserDepartment.user_id, UserDepartment.department_id).where(
            UserDepartment.user_id.in_(user_ids),
            UserDepartment.is_primary.is_(True),
        )
        rows = db.execute(stmt).all()
        m = {uid: None for uid in user_ids}
        for uid, did in rows:
            m[uid] = did
        return m

    def derived_manager_id(self, db: Session, user_id: uuid.UUID) -> uuid.UUID | None:
        """Line manager: nearest department on primary-dept chain whose manager is set and not self."""
        dcur = self.get_primary_department_id(db, user_id)
        while dcur is not None:
            dept = db.get(Department, dcur)
            if dept is None:
                break
            mid = dept.manager_id
            if mid is not None and mid != user_id:
                return mid
            dcur = dept.parent_department_id
        return None

    def set_primary_department(
        self, db: Session, user_id: uuid.UUID, department_id: uuid.UUID | None
    ) -> None:
        db.execute(delete(UserDepartment).where(UserDepartment.user_id == user_id))
        db.flush()
        if department_id is not None:
            db.add(
                UserDepartment(
                    user_id=user_id,
                    department_id=department_id,
                    is_primary=True,
                )
            )
        db.flush()

    def list_subordinates(self, db: Session, manager_id: uuid.UUID) -> list[User]:
        """Primary-department members of any department where manager_id = this user (excludes self)."""
        stmt = (
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .join(
                UserDepartment,
                (UserDepartment.user_id == User.user_id) & (UserDepartment.is_primary.is_(True)),
            )
            .join(Department, Department.department_id == UserDepartment.department_id)
            .where(Department.manager_id == manager_id, User.user_id != manager_id)
            .order_by(User.name)
        )
        return list(db.scalars(stmt).unique().all())

    def list_all_subordinates(self, db: Session, manager_id: uuid.UUID) -> list[User]:
        """Users whose primary department lies in a subtree rooted at a department managed by manager_id."""
        rows = db.execute(
            text("""
                WITH RECURSIVE subdepts(department_id) AS (
                    SELECT department_id FROM departments WHERE manager_id = :mid
                    UNION ALL
                    SELECT d.department_id FROM departments d
                    INNER JOIN subdepts s ON d.parent_department_id = s.department_id
                )
                SELECT DISTINCT u.user_id
                FROM users u
                INNER JOIN user_departments ud
                    ON ud.user_id = u.user_id AND ud.is_primary = true
                WHERE ud.department_id IN (SELECT department_id FROM subdepts)
                  AND u.user_id <> :mid
            """),
            {"mid": manager_id},
        ).all()
        ids = [r[0] for r in rows]
        if not ids:
            return []
        stmt = (
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .where(User.user_id.in_(ids))
            .order_by(User.name)
        )
        return list(db.scalars(stmt).unique().all())

    def is_subordinate_of(
        self, db: Session, *, actor_id: uuid.UUID, target_id: uuid.UUID
    ) -> bool:
        """True if actor is the manager of target's primary dept or an ancestor dept (view_as chain)."""
        if actor_id == target_id:
            return False
        dcur = self.get_primary_department_id(db, target_id)
        while dcur is not None:
            dept = db.get(Department, dcur)
            if dept is None:
                break
            if dept.manager_id == actor_id:
                return True
            dcur = dept.parent_department_id
        return False

    def user_has_role(self, db: Session, user_id: uuid.UUID, role_name: str) -> bool:
        stmt = (
            select(UserRole.user_id)
            .join(Role, UserRole.role_id == Role.role_id)
            .where(UserRole.user_id == user_id, Role.role_name == role_name)
            .limit(1)
        )
        return db.execute(stmt).first() is not None

    def employee_no_exists(self, db: Session, employee_no: str) -> bool:
        stmt = select(User.user_id).where(User.employee_no == employee_no).limit(1)
        return db.execute(stmt).first() is not None

    def set_status(
        self,
        db: Session,
        user_id: uuid.UUID,
        *,
        status: str,
    ) -> None:
        stmt = select(User).where(User.user_id == user_id)
        user = db.execute(stmt).scalar_one_or_none()
        if user is None:
            raise ValueError(f"User {user_id} not found")
        user.status = status
        db.flush()

    def update_password(
        self,
        db: Session,
        user_id: uuid.UUID,
        *,
        new_hash: str,
    ) -> None:
        stmt = select(User).where(User.user_id == user_id)
        user = db.execute(stmt).scalar_one_or_none()
        if user is None:
            raise ValueError(f"User {user_id} not found")
        user.password_hash = new_hash
        db.flush()

    def update_profile(
        self,
        db: Session,
        user_id: uuid.UUID,
        *,
        name: str,
        phone: str | None,
    ) -> User:
        stmt = select(User).where(User.user_id == user_id)
        user = db.execute(stmt).scalar_one_or_none()
        if user is None:
            raise ValueError(f"User {user_id} not found")
        user.name = name
        user.phone = phone
        db.flush()
        return self.get_by_id(db, user_id)  # type: ignore[return-value]

    def update_user_admin(
        self,
        db: Session,
        user_id: uuid.UUID,
        *,
        name: str,
        phone: str | None,
        department_id: uuid.UUID | None,
    ) -> User:
        stmt = select(User).where(User.user_id == user_id)
        user = db.execute(stmt).scalar_one_or_none()
        if user is None:
            raise ValueError(f"User {user_id} not found")
        user.name = name
        user.phone = phone
        self.set_primary_department(db, user_id, department_id)
        db.flush()
        return self.get_by_id(db, user_id)  # type: ignore[return-value]

    def set_roles(
        self, db: Session, user_id: uuid.UUID, role_names: list[str]
    ) -> None:
        """Replace all roles for a user with the provided role_names list.

        Uses ORM-style deletes (not bulk DML) so the session identity map
        stays in sync and subsequent queries return fresh data.
        """
        existing = list(db.scalars(select(UserRole).where(UserRole.user_id == user_id)))
        for ur in existing:
            db.delete(ur)
        db.flush()
        for name in role_names:
            role_id = db.execute(
                select(Role.role_id).where(Role.role_name == name)
            ).scalar_one_or_none()
            if role_id is not None:
                db.add(UserRole(user_id=user_id, role_id=role_id))
        db.flush()
