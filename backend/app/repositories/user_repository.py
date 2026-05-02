import uuid

from sqlalchemy import func, select
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
