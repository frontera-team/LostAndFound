import base64
import os
from pathlib import Path

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import Base, async_session_maker, engine
from app.models import (
    Announcement,
    Category,
    City,
    District,
    Region,
    Role,
    User,
)
from app.security import hash_password

# Как в poteryashki_maket/server.js: anna|dima, title, description, reward, имя файла в uploads/
_DEMO_ROWS: list[tuple[str, str, str, int | None, str]] = [
    ("anna", "Потерян рюкзак", "Черный рюкзак с ноутбуком внутри и важными документами", 5000, "7178454836.jpg"),
    ("dima", "Пропали ключи от квартиры", "Связка из трех ключей с красным брелоком в виде сердца", None, "keys.jpg"),
    ("anna", "Найдена банковская карта", "Карта на имя Ирина С., найдена рядом с кассой супермаркета", None, "kredit_card.webp"),
    ("dima", "Потеряны очки в черной оправе", "Диоптрии минус 2, лежали в мягком сером футляре", 1500, "glasses.webp"),
    ("anna", "Утерян студенческий билет", "Студенческий билет МГТУ, может быть в синей папке с документами", None, "студак.webp"),
    ("dima", "Потерян серебряный браслет", "Тонкий серебряный браслет с маленькой подвеской-луной", 2500, "браслет.jpg"),
    ("anna", "Потеряна беспроводная наушник", "Белый правый наушник в силиконовом чехле, мог выпасть в транспорте", None, "наушники.webp"),
    ("dima", "Найдены детские варежки", "Красные варежки с узором снежинки, лежали на скамейке", None, "варежки.webp"),
    ("anna", "Потеряна флешка 64GB", 'Черная флешка с наклейкой "Курсовая", очень важные файлы', 2000, "флешка.webp"),
    ("dima", "Утерян зонт-трость", "Темно-синий зонт с деревянной ручкой, оставлен у входа", None, "зонт.webp"),
    ("anna", "Потерян фитнес-браслет", "Черный браслет Xiaomi с потертым ремешком", 1800, "фитнес_браслет.jpg"),
    ("dima", "Найдена папка с документами", "Синяя папка формата А4, внутри копии паспортных документов", None, "папка с документами.avif"),
    ("anna", "Пропала кошка в переноске", "Серая переноска с рыжим котом, потеряна при пересадке между автобусами", 7000, "кошка в переноске.jpg"),
    ("dima", "Потеряна спортивная сумка", "Черная сумка Adidas с формой и кроссовками 43 размера", 3000, "спортивная сумка.webp"),
]


def _seed_uploads_root() -> Path | None:
    raw = os.environ.get("SEED_UPLOADS_DIR", "").strip()
    if raw:
        p = Path(raw).expanduser().resolve()
        return p if p.is_dir() else None
    lost = Path(__file__).resolve().parents[2]
    guess = lost.parent / "poteryashki_maket" / "uploads"
    return guess if guess.is_dir() else None


def _guess_mime(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if lower.endswith(".webp"):
        return "image/webp"
    if lower.endswith(".avif"):
        return "image/avif"
    if lower.endswith(".png"):
        return "image/png"
    return "application/octet-stream"


def _load_seed_image(uploads_root: Path, filename: str) -> tuple[str | None, str | None]:
    path = uploads_root / filename
    if not path.is_file():
        return None, None
    data = path.read_bytes()
    if not data:
        return None, None
    b64 = base64.standard_b64encode(data).decode("ascii")
    return b64, _guess_mime(filename)


def _demo_pick_category(title: str, desc: str, cat_by_name: dict[str, Category]) -> Category:
    t = f"{title} {desc}".lower()
    if any(w in t for w in ("документ", "билет", "папк", "паспорт", "студен", "банковск")):
        return cat_by_name["Документы"]
    if any(w in t for w in ("наушник", "флешк", "xiaomi", "фитнес")):
        return cat_by_name["Электроника"]
    if any(w in t for w in ("рукзак", "варежк", "очк", "серебр", "сумк", "кошк", "зонт", "спортивн", "переноск")):
        return cat_by_name["Одежда"]
    return cat_by_name["Прочее"]


async def ensure_announcement_moderation_columns() -> None:
    """Для уже существующей PostgreSQL-БД без полей модерации."""
    dsn = (settings.database_url or "").lower()
    if "postgresql" not in dsn:
        return
    stmts = [
        "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'searching'",
        "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS publish_in_found BOOLEAN NOT NULL DEFAULT false",
    ]
    async with engine.begin() as conn:
        for s in stmts:
            await conn.execute(text(s))


async def create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await ensure_announcement_moderation_columns()


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


async def seed_demo_users_and_announcements(session: AsyncSession) -> None:
    """Тестовые пользователи и объявления из макета (только если таблица объявлений пустая)."""
    existing = await session.scalar(select(func.count()).select_from(Announcement))
    if existing and existing > 0:
        return

    role_user = await session.scalar(select(Role).where(Role.role_name == "user"))
    moscow_reg = await session.scalar(select(Region).where(Region.region_name == "Москва"))
    spb_reg = await session.scalar(select(Region).where(Region.region_name == "Санкт-Петербург"))
    if role_user is None or moscow_reg is None or spb_reg is None:
        return

    moscow_city = await session.scalar(
        select(City).where(City.region_id == moscow_reg.id, City.city_name == "Москва")
    )
    spb_city = await session.scalar(
        select(City).where(City.region_id == spb_reg.id, City.city_name == "Санкт-Петербург")
    )
    if moscow_city is None or spb_city is None:
        return

    moscow_district = await session.scalar(
        select(District).where(District.city_id == moscow_city.id).order_by(District.id).limit(1)
    )
    spb_district = await session.scalar(
        select(District).where(District.city_id == spb_city.id).order_by(District.id).limit(1)
    )
    if moscow_district is None or spb_district is None:
        return

    anna = await session.scalar(select(User).where(User.email == "anna@example.com"))
    if anna is None:
        anna = User(
            email="anna@example.com",
            hash_password=hash_password("anna123"),
            nickname="Анна",
            region_id=spb_reg.id,
            city_id=spb_city.id,
            role_id=role_user.id,
            email_verified=True,
        )
        session.add(anna)
        await session.flush()

    dima = await session.scalar(select(User).where(User.email == "dima@example.com"))
    if dima is None:
        dima = User(
            email="dima@example.com",
            hash_password=hash_password("dima123"),
            nickname="Дмитрий",
            region_id=moscow_reg.id,
            city_id=moscow_city.id,
            role_id=role_user.id,
            email_verified=True,
        )
        session.add(dima)
        await session.flush()

    cats = (await session.execute(select(Category))).scalars().all()
    if len(cats) < 4:
        return
    cat_by_name = {c.category_name: c for c in cats}

    creators = {"anna": anna, "dima": dima}
    uploads_root = _seed_uploads_root()

    for who, title, desc, reward, image_file in _DEMO_ROWS:
        u = creators[who]
        reg_id = u.region_id
        city_id = u.city_id
        dist = await session.scalar(
            select(District).where(District.city_id == city_id).order_by(District.id).limit(1)
        )
        if dist is None or reg_id is None or city_id is None:
            continue
        cat = _demo_pick_category(title, desc, cat_by_name)
        pic_b64, pic_mime = (None, None)
        if uploads_root is not None:
            pic_b64, pic_mime = _load_seed_image(uploads_root, image_file)
        ann = Announcement(
            ann_name=title,
            ann_description=desc,
            ann_reward=reward,
            ann_region_id=reg_id,
            ann_city_id=city_id,
            ann_district_id=dist.id,
            user_creator_id=u.id,
            ann_pic=pic_b64,
            ann_pic_mime=pic_mime,
            status="searching",
            publish_in_found=False,
        )
        ann.categories = [cat]
        session.add(ann)


async def backfill_demo_announcement_images(session: AsyncSession) -> None:
    """Подставить фото из uploads для демо-объявлений с пустым ann_pic (уже существующая БД)."""
    uploads_root = _seed_uploads_root()
    if uploads_root is None:
        return

    for _who, title, _desc, _reward, image_file in _DEMO_ROWS:
        ann = await session.scalar(
            select(Announcement)
            .where(Announcement.ann_name == title, Announcement.ann_pic.is_(None))
            .order_by(Announcement.id)
            .limit(1)
        )
        if ann is None:
            continue
        b64, mime = _load_seed_image(uploads_root, image_file)
        if b64 and mime:
            ann.ann_pic = b64
            ann.ann_pic_mime = mime


async def run_seed() -> None:
    async with async_session_maker() as session:
        async with session.begin():
            await seed_reference_data(session)
            await seed_admin_user(session)
            await seed_demo_users_and_announcements(session)
            await backfill_demo_announcement_images(session)
