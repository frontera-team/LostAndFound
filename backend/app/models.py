from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

announcement_categories_table = Table(
    "announcement_categories",
    Base.metadata,
    Column(
        "announcement_id",
        ForeignKey("announcements.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "category_id",
        ForeignKey("categories.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)

    users: Mapped[list["User"]] = relationship(back_populates="role")


class Region(Base):
    __tablename__ = "regions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    region_name: Mapped[str] = mapped_column(String(255), nullable=False)

    cities: Mapped[list["City"]] = relationship(back_populates="region")


class City(Base):
    __tablename__ = "cities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    city_name: Mapped[str] = mapped_column(String(255), nullable=False)
    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"), nullable=False)

    region: Mapped["Region"] = relationship(back_populates="cities")
    districts: Mapped[list["District"]] = relationship(back_populates="city")


class District(Base):
    __tablename__ = "districts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    district: Mapped[str] = mapped_column(String(255), nullable=False)
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id"), nullable=False)

    city: Mapped["City"] = relationship(back_populates="districts")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category_name: Mapped[str] = mapped_column(String(255), nullable=False)

    announcements: Mapped[list["Announcement"]] = relationship(
        secondary=announcement_categories_table, back_populates="categories"
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    hash_password: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[str] = mapped_column(String(128), nullable=False)
    region_id: Mapped[int | None] = mapped_column(ForeignKey("regions.id"), nullable=True)
    city_id: Mapped[int | None] = mapped_column(ForeignKey("cities.id"), nullable=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    avatar: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_mime: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)

    role: Mapped["Role"] = relationship(back_populates="users")
    announcements: Mapped[list["Announcement"]] = relationship(back_populates="creator")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class OtpCode(Base):
    __tablename__ = "otp_codes"
    __table_args__ = (UniqueConstraint("email", "purpose", name="uq_otp_email_purpose"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(16), nullable=False)
    purpose: Mapped[str] = mapped_column(String(32), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ann_name: Mapped[str] = mapped_column(String(512), nullable=False)
    ann_description: Mapped[str] = mapped_column(Text, nullable=False)
    ann_reward: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ann_region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"), nullable=False)
    ann_city_id: Mapped[int] = mapped_column(ForeignKey("cities.id"), nullable=False)
    ann_district_id: Mapped[int] = mapped_column(ForeignKey("districts.id"), nullable=False)
    user_creator_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    ann_pic: Mapped[str | None] = mapped_column(Text, nullable=True)
    ann_pic_mime: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # pending → на модерации; после одобрения: searching или found
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    publish_in_found: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    creator: Mapped["User"] = relationship(back_populates="announcements")
    categories: Mapped[list["Category"]] = relationship(
        secondary=announcement_categories_table, back_populates="announcements"
    )
    replies: Mapped[list["AnnouncementReply"]] = relationship(
        back_populates="announcement", cascade="all, delete-orphan"
    )
    reports: Mapped[list["AnnouncementReport"]] = relationship(
        back_populates="announcement", cascade="all, delete-orphan"
    )


class AnnouncementReport(Base):
    __tablename__ = "announcement_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    announcement_id: Mapped[int] = mapped_column(
        ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reporter_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    # open — ждёт разбора; resolved — обработана админом
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    announcement: Mapped["Announcement"] = relationship(back_populates="reports")
    reporter: Mapped["User"] = relationship()


class AnnouncementReply(Base):
    __tablename__ = "announcement_replies"
    __table_args__ = (
        UniqueConstraint("announcement_id", "user_id", name="uq_announcement_reply_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    announcement_id: Mapped[int] = mapped_column(
        ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    announcement: Mapped["Announcement"] = relationship(back_populates="replies")
    user: Mapped["User"] = relationship()
