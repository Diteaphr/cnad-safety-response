import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.role import Role
from app.models.user import User
from app.models.user_role import UserRole


class UserRepository:
    def list_all(self, db: Session) -> list[User]:
        stmt = (
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .order_by(User.name)
        )
        return list(db.scalars(stmt).unique().all())

    def get_by_id(self, db: Session, user_id: uuid.UUID) -> User | None:
        stmt = (
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .where(User.user_id == user_id)
        )
        return db.execute(stmt).unique().scalar_one_or_none()

    def get_by_email(self, db: Session, email: str) -> User | None:
        em = email.strip().lower()
        stmt = (
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .where(func.lower(User.email) == em)
        )
        return db.execute(stmt).unique().scalar_one_or_none()

    def list_subordinates(self, db: Session, manager_id: uuid.UUID) -> list[User]:
        stmt = (
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .where(User.manager_id == manager_id)
            .order_by(User.name)
        )
        return list(db.scalars(stmt).unique().all())

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
        manager_id: uuid.UUID | None,
    ) -> User:
        stmt = select(User).where(User.user_id == user_id)
        user = db.execute(stmt).scalar_one_or_none()
        if user is None:
            raise ValueError(f"User {user_id} not found")
        user.name = name
        user.phone = phone
        user.department_id = department_id
        user.manager_id = manager_id
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
