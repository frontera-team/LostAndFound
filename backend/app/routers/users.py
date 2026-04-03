from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_current_admin, get_current_user, get_db
from app.models import Announcement, Role, User
from app.security import hash_password
from app.schemas import (
    AnnouncementItemOut,
    AnnouncementListOut,
    DeleteMessage,
    UserAdminItem,
    UserAdminListOut,
    UserBlockPatchIn,
    UserBlockPatchOut,
    UserCreateIn,
    UserCreateOut,
    UserPublicOut,
    UserRolePatchIn,
    UserRolePatchOut,
    UserUpdateIn,
    UserUpdateOut,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserCreateOut)
async def create_user(
    body: UserCreateIn,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> UserCreateOut:
    exists = await session.scalar(select(User.id).where(User.email == str(body.email)))
    if exists is not None:
        raise HTTPException(status_code=400, detail="Email already registered")
    role_user = await session.scalar(select(Role).where(Role.role_name == "user"))
    if role_user is None:
        raise HTTPException(status_code=500, detail="Roles not seeded")
    u = User(
        email=str(body.email),
        hash_password=hash_password(body.password),
        nickname=body.nickname,
        region_id=body.region_id,
        city_id=body.city_id,
        role_id=role_user.id,
        email_verified=True,
    )
    session.add(u)
    await session.commit()
    await session.refresh(u)
    return UserCreateOut(id=u.id, email=u.email, nickname=u.nickname)


@router.get("", response_model=UserAdminListOut)
async def list_users_admin(
    session: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    nickname: str | None = None,
    email: str | None = None,
) -> UserAdminListOut:
    base = select(User)
    count_stmt = select(func.count()).select_from(User)
    if nickname:
        base = base.where(User.nickname.ilike(f"%{nickname}%"))
        count_stmt = count_stmt.where(User.nickname.ilike(f"%{nickname}%"))
    if email:
        base = base.where(User.email.ilike(f"%{email}%"))
        count_stmt = count_stmt.where(User.email.ilike(f"%{email}%"))
    total = int(await session.scalar(count_stmt) or 0)
    r = await session.execute(
        base.order_by(User.id).offset((page - 1) * limit).limit(limit)
    )
    users = r.scalars().all()
    items = [
        UserAdminItem(
            id=u.id,
            nickname=u.nickname,
            email=u.email,
            region_id=u.region_id,
            city_id=u.city_id,
            role_id=u.role_id,
            is_blocked=u.is_blocked,
        )
        for u in users
    ]
    return UserAdminListOut(total=total, items=items)


@router.patch("/{user_id}/block", response_model=UserBlockPatchOut)
async def patch_user_block(
    user_id: int,
    body: UserBlockPatchIn,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> UserBlockPatchOut:
    r = await session.execute(
        select(User).options(selectinload(User.role)).where(User.id == user_id)
    )
    u = r.scalar_one_or_none()
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")
    if u.role is not None and u.role.role_name == "admin":
        raise HTTPException(status_code=400, detail="Cannot change block status for admin")
    u.is_blocked = body.is_blocked
    await session.commit()
    return UserBlockPatchOut(id=u.id, is_blocked=u.is_blocked)


@router.patch("/{user_id}/role", response_model=UserRolePatchOut)
async def patch_user_role(
    user_id: int,
    body: UserRolePatchIn,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> UserRolePatchOut:
    u = await session.get(User, user_id)
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")
    role = await session.get(Role, body.role_id)
    if role is None:
        raise HTTPException(status_code=400, detail="Invalid role_id")
    u.role_id = body.role_id
    await session.commit()
    return UserRolePatchOut(id=u.id, role_id=u.role_id)


@router.get("/{user_id}/announcements", response_model=AnnouncementListOut)
async def user_announcements(
    user_id: int,
    session: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> AnnouncementListOut:
    u = await session.get(User, user_id)
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")
    count_stmt = select(func.count()).select_from(Announcement).where(
        Announcement.user_creator_id == user_id
    )
    total = int(await session.scalar(count_stmt) or 0)
    r = await session.execute(
        select(Announcement)
        .options(selectinload(Announcement.categories))
        .where(Announcement.user_creator_id == user_id)
        .order_by(Announcement.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = r.scalars().all()

    def to_item(a: Announcement) -> AnnouncementItemOut:
        return AnnouncementItemOut(
            id=a.id,
            ann_name=a.ann_name,
            ann_description=a.ann_description,
            ann_reward=a.ann_reward,
            ann_region_id=a.ann_region_id,
            ann_city_id=a.ann_city_id,
            ann_district_id=a.ann_district_id,
            user_creator_id=a.user_creator_id,
            category_ids=[c.id for c in a.categories],
            status=a.status,
            publish_in_found=a.publish_in_found,
            response_count=None,
        )

    return AnnouncementListOut(total=total, items=[to_item(a) for a in rows])


@router.get("/{user_id}", response_model=UserPublicOut)
async def get_user(
    user_id: int,
    session: AsyncSession = Depends(get_db),
) -> UserPublicOut:
    u = await session.get(User, user_id)
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")
    return UserPublicOut(
        id=u.id,
        nickname=u.nickname,
        email=u.email,
        region_id=u.region_id,
        city_id=u.city_id,
        role_id=u.role_id,
    )


@router.put("/{user_id}", response_model=UserUpdateOut)
async def update_user(
    user_id: int,
    body: UserUpdateIn,
    session: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> UserUpdateOut:
    u = await session.get(User, user_id)
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")
    is_admin = current.role is not None and current.role.role_name == "admin"
    if u.id != current.id and not is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    if body.nickname is not None:
        u.nickname = body.nickname
    if body.region_id is not None:
        u.region_id = body.region_id
    if body.city_id is not None:
        u.city_id = body.city_id
    await session.commit()
    await session.refresh(u)
    return UserUpdateOut(
        id=u.id, nickname=u.nickname, region_id=u.region_id, city_id=u.city_id
    )


@router.delete("/{user_id}", response_model=DeleteMessage)
async def delete_user(
    user_id: int,
    session: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> DeleteMessage:
    u = await session.get(User, user_id)
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")
    await session.delete(u)
    await session.commit()
    return DeleteMessage(message="user_deleted")
