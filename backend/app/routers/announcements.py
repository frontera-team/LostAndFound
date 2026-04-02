from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_current_user, get_db
from app.models import Announcement, Category, User, announcement_categories_table
from app.schemas import (
    AnnouncementCreateIn,
    AnnouncementCreateOut,
    AnnouncementDetailOut,
    AnnouncementItemOut,
    AnnouncementListOut,
    AnnouncementUpdateIn,
    AnnouncementUpdateOut,
    DeleteMessage,
)
router = APIRouter(prefix="/announcements", tags=["announcements"])


def _item_from_ann(a: Announcement) -> AnnouncementItemOut:
    cids = [c.id for c in a.categories]
    return AnnouncementItemOut(
        id=a.id,
        ann_name=a.ann_name,
        ann_description=a.ann_description,
        ann_reward=a.ann_reward,
        ann_region_id=a.ann_region_id,
        ann_city_id=a.ann_city_id,
        ann_district_id=a.ann_district_id,
        user_creator_id=a.user_creator_id,
        category_ids=cids,
    )


@router.get("", response_model=AnnouncementListOut)
async def list_announcements(
    session: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    ann_regions: int | None = None,
    ann_region_id: int | None = None,
    ann_city_id: int | None = None,
    ann_district_id: int | None = None,
    category_id: int | None = None,
    q: str | None = None,
) -> AnnouncementListOut:
    rid = ann_region_id if ann_region_id is not None else ann_regions
    stmt = select(Announcement).options(selectinload(Announcement.categories))
    count_base = select(func.count()).select_from(Announcement)
    if rid is not None:
        stmt = stmt.where(Announcement.ann_region_id == rid)
        count_base = count_base.where(Announcement.ann_region_id == rid)
    if ann_city_id is not None:
        stmt = stmt.where(Announcement.ann_city_id == ann_city_id)
        count_base = count_base.where(Announcement.ann_city_id == ann_city_id)
    if ann_district_id is not None:
        stmt = stmt.where(Announcement.ann_district_id == ann_district_id)
        count_base = count_base.where(Announcement.ann_district_id == ann_district_id)
    if category_id is not None:
        cat_exists = exists(
            select(1)
            .select_from(announcement_categories_table)
            .where(
                announcement_categories_table.c.announcement_id == Announcement.id,
                announcement_categories_table.c.category_id == category_id,
            )
        )
        stmt = stmt.where(cat_exists)
        count_base = count_base.where(cat_exists)
    if q:
        term = f"%{q}%"
        cond = or_(Announcement.ann_name.ilike(term), Announcement.ann_description.ilike(term))
        stmt = stmt.where(cond)
        count_base = count_base.where(cond)
    total = int(await session.scalar(count_base) or 0)
    stmt = stmt.order_by(Announcement.id.desc()).offset((page - 1) * limit).limit(limit)
    r = await session.execute(stmt)
    items = [_item_from_ann(a) for a in r.scalars().all()]
    return AnnouncementListOut(total=total, items=items)


@router.get("/{announcement_id}", response_model=AnnouncementDetailOut)
async def get_announcement(
    announcement_id: int,
    session: AsyncSession = Depends(get_db),
) -> AnnouncementDetailOut:
    a = await session.get(Announcement, announcement_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Not found")
    return AnnouncementDetailOut(
        id=a.id,
        ann_name=a.ann_name,
        ann_description=a.ann_description,
        ann_reward=a.ann_reward,
    )


@router.post("", response_model=AnnouncementCreateOut)
async def create_announcement(
    body: AnnouncementCreateIn,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnnouncementCreateOut:
    try:
        region_id = body.resolved_region_id()
    except ValueError:
        raise HTTPException(status_code=422, detail="ann_region_id or ann_regions required")
    cats = (
        await session.execute(select(Category).where(Category.id.in_(body.category_ids)))
    ).scalars().all()
    if len(cats) != len(set(body.category_ids)):
        raise HTTPException(status_code=400, detail="Unknown category id")
    ann = Announcement(
        ann_name=body.ann_name,
        ann_description=body.ann_description,
        ann_reward=body.ann_reward,
        ann_region_id=region_id,
        ann_city_id=body.ann_city_id,
        ann_district_id=body.ann_district_id,
        user_creator_id=user.id,
        ann_pic=body.ann_pic,
        ann_pic_mime=body.ann_pic_mime,
    )
    ann.categories = list(cats)
    session.add(ann)
    await session.commit()
    await session.refresh(ann)
    return AnnouncementCreateOut(id=ann.id, ann_name=ann.ann_name)


async def _can_edit(session: AsyncSession, user: User, ann: Announcement) -> bool:
    if ann.user_creator_id == user.id:
        return True
    await session.refresh(user, ["role"])
    return user.role is not None and user.role.role_name == "admin"


@router.put("/{announcement_id}", response_model=AnnouncementUpdateOut)
async def update_announcement(
    announcement_id: int,
    body: AnnouncementUpdateIn,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnnouncementUpdateOut:
    a = await session.get(Announcement, announcement_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Not found")
    if not await _can_edit(session, user, a):
        raise HTTPException(status_code=403, detail="Forbidden")
    if body.ann_name is not None:
        a.ann_name = body.ann_name
    if body.ann_description is not None:
        a.ann_description = body.ann_description
    if body.ann_reward is not None:
        a.ann_reward = body.ann_reward
    await session.commit()
    await session.refresh(a)
    return AnnouncementUpdateOut(id=a.id, ann_name=a.ann_name, ann_reward=a.ann_reward)


@router.delete("/{announcement_id}", response_model=DeleteMessage)
async def delete_announcement(
    announcement_id: int,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DeleteMessage:
    a = await session.get(Announcement, announcement_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Not found")
    if not await _can_edit(session, user, a):
        raise HTTPException(status_code=403, detail="Forbidden")
    session.delete(a)
    await session.commit()
    return DeleteMessage(message="announcement_deleted")
