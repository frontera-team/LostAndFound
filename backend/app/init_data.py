from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import Base, async_session_maker, engine
from app.models import (
    Category,
    City,
    District,
    Region,
    Role,
    User,
)
from app.security import hash_password


async def create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def seed_reference_data(session: AsyncSession) -> None:
    r = await session.execute(select(Role).where(Role.role_name == "user"))
    if r.scalar_one_or_none() is None:
        session.add(Role(role_name="user"))
        session.add(Role(role_name="admin"))
        await session.flush()

    if await session.scalar(select(Region.id).limit(1)) is None:
        moscow = Region(region_name="Москва")
        spb = Region(region_name="Санкт-Петербург")
        session.add_all([moscow, spb])
        await session.flush()

        c1 = City(city_name="Москва", region_id=moscow.id)
        c2 = City(city_name="Санкт-Петербург", region_id=spb.id)
        session.add_all([c1, c2])
        await session.flush()

        session.add_all(
            [
                District(district="Центральный", city_id=c1.id),
                District(district="Северный", city_id=c1.id),
                District(district="Адмиралтейский", city_id=c2.id),
            ]
        )

        session.add_all(
            [
                Category(category_name="Документы"),
                Category(category_name="Электроника"),
                Category(category_name="Одежда"),
                Category(category_name="Прочее"),
            ]
        )


async def seed_admin_user(session: AsyncSession) -> None:
    email = settings.default_admin_email
    r = await session.execute(select(User).where(User.email == email))
    if r.scalar_one_or_none() is not None:
        return
    role_admin = await session.scalar(select(Role).where(Role.role_name == "admin"))
    if role_admin is None:
        return
    region = await session.scalar(select(Region).limit(1))
    city = await session.scalar(select(City).limit(1))
    if region is None or city is None:
        return
    session.add(
        User(
            email=email,
            hash_password=hash_password(settings.default_admin_password),
            nickname="admin",
            region_id=region.id,
            city_id=city.id,
            role_id=role_admin.id,
            email_verified=True,
        )
    )


async def run_seed() -> None:
    async with async_session_maker() as session:
        async with session.begin():
            await seed_reference_data(session)
            await seed_admin_user(session)
