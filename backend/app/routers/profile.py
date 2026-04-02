from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models import User
from app.schemas import (
    AvatarIn,
    MessageOk,
    PasswordChangeIn,
    PasswordChangeOut,
    ProfileOut,
    ProfileUpdateIn,
    ProfileUpdateOut,
)
from app.security import hash_password, verify_password

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileOut)
async def get_profile(user: User = Depends(get_current_user)) -> ProfileOut:
    return ProfileOut(
        id=user.id,
        nickname=user.nickname,
        email=user.email,
        region_id=user.region_id,
        city_id=user.city_id,
        avatar=user.avatar,
        avatar_mime=user.avatar_mime,
        role_id=user.role_id,
        email_verified=user.email_verified,
    )


@router.put("", response_model=ProfileUpdateOut)
async def update_profile(
    body: ProfileUpdateIn,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProfileUpdateOut:
    if body.nickname is not None:
        user.nickname = body.nickname
    if body.region_id is not None:
        user.region_id = body.region_id
    if body.city_id is not None:
        user.city_id = body.city_id
    await session.commit()
    await session.refresh(user)
    return ProfileUpdateOut(
        id=user.id,
        nickname=user.nickname,
        region_id=user.region_id,
        city_id=user.city_id,
    )


@router.put("/avatar", response_model=MessageOk)
async def update_avatar(
    body: AvatarIn,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageOk:
    user.avatar = body.avatar
    user.avatar_mime = body.avatar_mime
    await session.commit()
    return MessageOk()


@router.put("/password", response_model=PasswordChangeOut)
async def change_password(
    body: PasswordChangeIn,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PasswordChangeOut:
    if not verify_password(body.current_password, user.hash_password):
        raise HTTPException(status_code=400, detail="Wrong current password")
    user.hash_password = hash_password(body.new_password)
    await session.commit()
    return PasswordChangeOut()
