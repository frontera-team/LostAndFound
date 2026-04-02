from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.models import Role
from app.schemas import RoleOut

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", response_model=list[RoleOut])
async def list_roles(session: AsyncSession = Depends(get_db)) -> list[RoleOut]:
    r = await session.execute(select(Role).order_by(Role.id))
    return list(r.scalars().all())
