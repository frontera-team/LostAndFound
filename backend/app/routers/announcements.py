from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_current_admin, get_current_user, get_current_user_optional, get_db
from app.models import (
    Announcement,
    AnnouncementReply,
    Category,
    City,
    District,
    Region,
    User,
    announcement_categories_table,
)
from app.schemas import (
    AnnouncementCreateIn,
    AnnouncementCreateOut,
    AnnouncementDetailOut,
    AnnouncementItemOut,
    AnnouncementListOut,
    AnnouncementModerateResult,
    AnnouncementReplyCreateIn,
    AnnouncementReplyListOut,
    AnnouncementReplyOut,
    AnnouncementUpdateIn,
    AnnouncementUpdateOut,
    DeleteMessage,
)
router = APIRouter(prefix="/announcements", tags=["announcements"])


def _item_from_ann(
    a: Announcement,
    *,
    author_nickname: str | None = None,
    region_name: str | None = None,
    city_name: str | None = None,
    district_name: str | None = None,
    response_count: int | None = None,
) -> AnnouncementItemOut:
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
        author_nickname=author_nickname,
        region_name=region_name,
        city_name=city_name,
        district_name=district_name,
        ann_pic=a.ann_pic,
        ann_pic_mime=a.ann_pic_mime,
        status=a.status,
        publish_in_found=a.publish_in_found,
        response_count=response_count,
    )


@router.get("", response_model=AnnouncementListOut)
async def list_announcements(
    session: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    state: str = Query("searching", description="searching | found | moderation"),
    moderation_scope: str = Query(
        "mine",
        description="При state=moderation: mine — только мои pending/rejected; all — вся очередь pending (только admin, для панели)",
    ),
    ann_regions: int | None = None,
    ann_region_id: int | None = None,
    ann_city_id: int | None = None,
    ann_district_id: int | None = None,
    category_id: int | None = None,
    q: str | None = None,
    mine: bool = Query(False, description="Все мои объявления (любой статус); требуется авторизация"),
) -> AnnouncementListOut:
    if mine:
        if user is None:
            raise HTTPException(status_code=401, detail="Unauthorized")
    elif state not in ("searching", "found", "moderation"):
        raise HTTPException(
            status_code=422, detail="state must be searching, found or moderation"
        )
    rid = ann_region_id if ann_region_id is not None else ann_regions
    stmt = select(Announcement).options(
        selectinload(Announcement.categories),
        selectinload(Announcement.creator),
    )
    count_base = select(func.count()).select_from(Announcement)
    if mine:
        stmt = stmt.where(Announcement.user_creator_id == user.id)
        count_base = count_base.where(Announcement.user_creator_id == user.id)
    elif state == "moderation":
        if user is None:
            raise HTTPException(status_code=401, detail="Unauthorized")
        if moderation_scope not in ("mine", "all"):
            raise HTTPException(
                status_code=422, detail="moderation_scope must be mine or all"
            )
        if moderation_scope == "all":
            if user.role is None or user.role.role_name != "admin":
                raise HTTPException(status_code=403, detail="Admin only")
            stmt = stmt.where(Announcement.status == "pending")
            count_base = count_base.where(Announcement.status == "pending")
        else:
            # Вкладка «На модерации» на сайте: только мои ещё не опубликованные (и отклонённые).
            mod_filter = (Announcement.user_creator_id == user.id) & (
                Announcement.status.in_(("pending", "rejected"))
            )
            stmt = stmt.where(mod_filter)
            count_base = count_base.where(mod_filter)
    elif state == "searching":
        stmt = stmt.where(Announcement.status == "searching")
        count_base = count_base.where(Announcement.status == "searching")
    else:
        stmt = stmt.where(Announcement.status == "found")
        count_base = count_base.where(Announcement.status == "found")
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
    rows = list(r.scalars().all())
    if not rows:
        return AnnouncementListOut(total=total, items=[])

    reg_ids = {a.ann_region_id for a in rows}
    city_ids = {a.ann_city_id for a in rows}
    dist_ids = {a.ann_district_id for a in rows}
    reg_map = {
        x.id: x.region_name
        for x in (
            await session.execute(select(Region).where(Region.id.in_(reg_ids)))
        ).scalars().all()
    }
    city_map = {
        x.id: x.city_name
        for x in (
            await session.execute(select(City).where(City.id.in_(city_ids)))
        ).scalars().all()
    }
    dist_map = {
        x.id: x.district
        for x in (
            await session.execute(select(District).where(District.id.in_(dist_ids)))
        ).scalars().all()
    }

    count_map: dict[int, int] = {}
    if user is not None:
        ids_for_replies = [
            a.id
            for a in rows
            if a.user_creator_id == user.id and a.status in ("searching", "found")
        ]
        if ids_for_replies:
            rc = await session.execute(
                select(AnnouncementReply.announcement_id, func.count())
                .where(AnnouncementReply.announcement_id.in_(ids_for_replies))
                .group_by(AnnouncementReply.announcement_id)
            )
            count_map = {row[0]: int(row[1]) for row in rc.all()}

    items = [
        _item_from_ann(
            a,
            author_nickname=a.creator.nickname if a.creator else None,
            region_name=reg_map.get(a.ann_region_id),
            city_name=city_map.get(a.ann_city_id),
            district_name=dist_map.get(a.ann_district_id),
            response_count=(
                count_map.get(a.id, 0)
                if user is not None
                and a.user_creator_id == user.id
                and a.status in ("searching", "found")
                else None
            ),
        )
        for a in rows
    ]
    return AnnouncementListOut(total=total, items=items)


async def _can_view_replies(session: AsyncSession, user: User, ann: Announcement) -> bool:
    if ann.user_creator_id == user.id:
        return True
    await session.refresh(user, ["role"])
    return user.role is not None and user.role.role_name == "admin"


@router.post("/{announcement_id}/replies", response_model=AnnouncementReplyOut)
async def create_announcement_reply(
    announcement_id: int,
    body: AnnouncementReplyCreateIn,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnnouncementReplyOut:
    a = await session.get(Announcement, announcement_id)
    if a is None or a.status != "searching":
        raise HTTPException(status_code=404, detail="Not found")
    if a.user_creator_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot reply to own announcement")
    msg = body.message.strip()
    if not msg:
        raise HTTPException(status_code=422, detail="Empty message")
    dup = await session.scalar(
        select(AnnouncementReply.id).where(
            AnnouncementReply.announcement_id == announcement_id,
            AnnouncementReply.user_id == user.id,
        )
    )
    if dup is not None:
        raise HTTPException(status_code=409, detail="Already replied")
    rep = AnnouncementReply(
        announcement_id=announcement_id, user_id=user.id, message=msg
    )
    session.add(rep)
    await session.commit()
    await session.refresh(rep)
    return AnnouncementReplyOut(
        id=rep.id,
        user_id=user.id,
        nickname=user.nickname,
        message=rep.message,
        created_at=rep.created_at,
    )


@router.get("/{announcement_id}/replies", response_model=AnnouncementReplyListOut)
async def list_announcement_replies(
    announcement_id: int,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnnouncementReplyListOut:
    a = await session.get(Announcement, announcement_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Not found")
    if not await _can_view_replies(session, user, a):
        raise HTTPException(status_code=403, detail="Forbidden")
    r = await session.execute(
        select(AnnouncementReply)
        .options(selectinload(AnnouncementReply.user))
        .where(AnnouncementReply.announcement_id == announcement_id)
        .order_by(AnnouncementReply.created_at.desc())
    )
    rows = r.scalars().all()
    out: list[AnnouncementReplyOut] = []
    for rep in rows:
        nick = rep.user.nickname if rep.user else "—"
        out.append(
            AnnouncementReplyOut(
                id=rep.id,
                user_id=rep.user_id,
                nickname=nick,
                message=rep.message,
                created_at=rep.created_at,
            )
        )
    return AnnouncementReplyListOut(items=out)


@router.get("/{announcement_id}", response_model=AnnouncementDetailOut)
async def get_announcement(
    announcement_id: int,
    session: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> AnnouncementDetailOut:
    a = await session.get(Announcement, announcement_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Not found")
    if a.status in ("pending", "rejected"):
        if user is None or a.user_creator_id != user.id:
            is_admin = (
                user is not None
                and user.role is not None
                and user.role.role_name == "admin"
            )
            if not is_admin:
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
        status="pending",
        publish_in_found=body.publish_in_found,
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
    await session.delete(a)
    await session.commit()
    return DeleteMessage(message="announcement_deleted")


@router.post("/{announcement_id}/approve", response_model=AnnouncementModerateResult)
async def approve_announcement(
    announcement_id: int,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> AnnouncementModerateResult:
    a = await session.get(Announcement, announcement_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Not found")
    if a.status != "pending":
        raise HTTPException(status_code=400, detail="Not pending")
    a.status = "found" if a.publish_in_found else "searching"
    await session.commit()
    await session.refresh(a)
    return AnnouncementModerateResult(id=a.id, status=a.status)


@router.post("/{announcement_id}/reject", response_model=AnnouncementModerateResult)
async def reject_announcement(
    announcement_id: int,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> AnnouncementModerateResult:
    a = await session.get(Announcement, announcement_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Not found")
    if a.status != "pending":
        raise HTTPException(status_code=400, detail="Not pending")
    a.status = "rejected"
    await session.commit()
    await session.refresh(a)
    return AnnouncementModerateResult(id=a.id, status=a.status)


@router.post("/{announcement_id}/mark-found", response_model=AnnouncementModerateResult)
async def mark_found_by_author(
    announcement_id: int,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnnouncementModerateResult:
    """Автор переводит объявление из «В поиске» в «Найдено»."""
    a = await session.get(Announcement, announcement_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Not found")
    if a.user_creator_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if a.status != "searching":
        raise HTTPException(
            status_code=400,
            detail="Only searching announcements can be marked as found",
        )
    a.status = "found"
    await session.commit()
    await session.refresh(a)
    return AnnouncementModerateResult(id=a.id, status=a.status)
