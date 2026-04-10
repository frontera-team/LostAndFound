import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.deps import get_current_user, get_current_user_optional, get_db
from app.models import OtpCode, RefreshToken, Role, User
from app.google_oauth import verify_google_id_token
from app.schemas import (
    ForgotPasswordIn,
    ForgotPasswordOut,
    GoogleAuthIn,
    GoogleClientIdOut,
    LoginIn,
    LogoutIn,
    MeOut,
    MessageOk,
    RefreshIn,
    RefreshOut,
    RegisterIn,
    RegisterOut,
    ResetPasswordIn,
    ResetPasswordOut,
    TokenOut,
    VerifyEmailIn,
    VerifyEmailOut,
)
from app.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token_value,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

OTP_TTL = timedelta(minutes=15)


async def _issue_otp(session: AsyncSession, email: str, purpose: str) -> str:
    code = f"{secrets.randbelow(900000) + 100000:06d}"
    await session.execute(delete(OtpCode).where(OtpCode.email == email, OtpCode.purpose == purpose))
    session.add(
        OtpCode(
            email=email,
            code=code,
            purpose=purpose,
            expires_at=datetime.now(timezone.utc) + OTP_TTL,
        )
    )
    return code


async def _consume_otp(session: AsyncSession, email: str, purpose: str, code: str) -> bool:
    r = await session.execute(
        select(OtpCode).where(OtpCode.email == email, OtpCode.purpose == purpose)
    )
    row = r.scalar_one_or_none()
    if row is None or row.code != code:
        return False
    if row.expires_at < datetime.now(timezone.utc):
        await session.delete(row)
        return False
    await session.delete(row)
    return True


async def _store_refresh(session: AsyncSession, user_id: int, raw: str) -> None:
    expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    session.add(
        RefreshToken(
            user_id=user_id,
            token_hash=hash_refresh_token(raw),
            expires_at=expires,
        )
    )


@router.post("/register", response_model=RegisterOut)
async def register(body: RegisterIn, session: AsyncSession = Depends(get_db)) -> RegisterOut:
    exists = await session.scalar(select(User.id).where(User.email == str(body.email)))
    if exists is not None:
        raise HTTPException(status_code=400, detail="Email already registered")
    role_user = await session.scalar(select(Role).where(Role.role_name == "user"))
    if role_user is None:
        raise HTTPException(status_code=500, detail="Roles not seeded")
    user = User(
        email=str(body.email),
        hash_password=hash_password(body.password),
        nickname=body.nickname,
        region_id=body.region_id,
        city_id=body.city_id,
        role_id=role_user.id,
        email_verified=False,
    )
    session.add(user)
    await session.flush()
    await _issue_otp(session, str(body.email), "verify")
    await session.commit()
    await session.refresh(user)
    return RegisterOut(
        id=user.id,
        email=user.email,
        nickname=user.nickname,
        email_verified=user.email_verified,
    )


@router.get("/google-client-id", response_model=GoogleClientIdOut)
async def google_client_id() -> GoogleClientIdOut:
    return GoogleClientIdOut(client_id=settings.google_oauth_client_id)


@router.post("/google", response_model=TokenOut)
async def auth_google(body: GoogleAuthIn, session: AsyncSession = Depends(get_db)) -> TokenOut:
    client_id = settings.google_oauth_client_id
    if not client_id:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")
    claims = await verify_google_id_token(body.id_token, client_id)
    email = str(claims.get("email", "")).strip()

    r = await session.execute(
        select(User).options(selectinload(User.role)).where(func.lower(User.email) == email.lower())
    )
    user = r.scalar_one_or_none()

    if user is None:
        if body.region_id is None or body.city_id is None:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "google_profile_required",
                    "message": "Укажите регион, город и никнейм на вкладке «Регистрация».",
                },
            )
        nick_src = (body.nickname or claims.get("name") or email.split("@")[0]).strip()
        if not nick_src:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "google_profile_required",
                    "message": "Укажите никнейм.",
                },
            )
        nickname = nick_src[:128]
        role_user = await session.scalar(select(Role).where(Role.role_name == "user"))
        if role_user is None:
            raise HTTPException(status_code=500, detail="Roles not seeded")
        user = User(
            email=email,
            hash_password=hash_password(secrets.token_urlsafe(48)),
            nickname=nickname,
            region_id=body.region_id,
            city_id=body.city_id,
            role_id=role_user.id,
            email_verified=True,
        )
        session.add(user)
        await session.flush()

    if user.is_blocked:
        raise HTTPException(status_code=403, detail="User is blocked")

    access = create_access_token(str(user.email), user.id, user.role_id)
    raw_refresh = new_refresh_token_value()
    await _store_refresh(session, user.id, raw_refresh)
    await session.commit()
    return TokenOut(access_token=access, refresh_token=raw_refresh, token_type="bearer")


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, session: AsyncSession = Depends(get_db)) -> TokenOut:
    r = await session.execute(
        select(User).options(selectinload(User.role)).where(User.email == str(body.email))
    )
    user = r.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.hash_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.is_blocked:
        raise HTTPException(status_code=403, detail="User is blocked")
    access = create_access_token(str(user.email), user.id, user.role_id)
    raw_refresh = new_refresh_token_value()
    await _store_refresh(session, user.id, raw_refresh)
    await session.commit()
    return TokenOut(access_token=access, refresh_token=raw_refresh, token_type="bearer")


@router.post("/refresh", response_model=RefreshOut)
async def refresh_token(body: RefreshIn, session: AsyncSession = Depends(get_db)) -> RefreshOut:
    th = hash_refresh_token(body.refresh_token)
    r = await session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == th)
    )
    row = r.scalar_one_or_none()
    if row is None or row.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = await session.get(User, row.user_id)
    if user is None or user.is_blocked:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    access = create_access_token(str(user.email), user.id, user.role_id)
    return RefreshOut(access_token=access)


@router.post("/logout", response_model=MessageOk)
async def logout(body: LogoutIn, session: AsyncSession = Depends(get_db)) -> MessageOk:
    th = hash_refresh_token(body.refresh_token)
    await session.execute(delete(RefreshToken).where(RefreshToken.token_hash == th))
    await session.commit()
    return MessageOk()


@router.get("/me", response_model=MeOut | None)
async def me(user: User | None = Depends(get_current_user_optional)) -> MeOut | None:
    if user is None:
        return None
    role_name = user.role.role_name if user.role else None
    return MeOut(
        id=user.id,
        email=user.email,
        nickname=user.nickname,
        region_id=user.region_id,
        city_id=user.city_id,
        role_id=user.role_id,
        role_name=role_name,
        email_verified=user.email_verified,
        avatar=user.avatar,
    )


@router.post("/verify-email", response_model=VerifyEmailOut)
async def verify_email(body: VerifyEmailIn, session: AsyncSession = Depends(get_db)) -> VerifyEmailOut:
    ok = await _consume_otp(session, str(body.email), "verify", body.code)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    r = await session.execute(select(User).where(User.email == str(body.email)))
    u = r.scalar_one_or_none()
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")
    u.email_verified = True
    await session.commit()
    return VerifyEmailOut()


@router.post("/forgot-password", response_model=ForgotPasswordOut)
async def forgot_password(body: ForgotPasswordIn, session: AsyncSession = Depends(get_db)) -> ForgotPasswordOut:
    r = await session.execute(select(User).where(User.email == str(body.email)))
    u = r.scalar_one_or_none()
    if u is not None:
        await _issue_otp(session, str(body.email), "reset")
    await session.commit()
    return ForgotPasswordOut()


@router.post("/reset-password", response_model=ResetPasswordOut)
async def reset_password(body: ResetPasswordIn, session: AsyncSession = Depends(get_db)) -> ResetPasswordOut:
    if body.new_password != body.new_password_confirm:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    ok = await _consume_otp(session, str(body.email), "reset", body.code)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    r = await session.execute(select(User).where(User.email == str(body.email)))
    u = r.scalar_one_or_none()
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")
    u.hash_password = hash_password(body.new_password)
    await session.execute(delete(RefreshToken).where(RefreshToken.user_id == u.id))
    await session.commit()
    return ResetPasswordOut()
