from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_admin, get_db
from app.models import Category, City, District, Region
from app.schemas import (
    CategoryOut,
    CityOut,
    DistrictOut,
    MessageOk,
    RegionCreateIn,
    RegionOut,
    RegionPatchIn,
)

router = APIRouter(tags=["geo"])


@router.get("/regions", response_model=list[RegionOut])
async def list_regions(session: AsyncSession = Depends(get_db)) -> list[RegionOut]:
    r = await session.execute(select(Region).order_by(Region.id))
    return list(r.scalars().all())


@router.post("/regions", response_model=MessageOk)
async def create_region(
    body: RegionCreateIn,
    session: AsyncSession = Depends(get_db),
    _: object = Depends(get_current_admin),
) -> MessageOk:
    session.add(Region(region_name=body.region))
    await session.commit()
    return MessageOk()


@router.patch("/regions/{region_id}", response_model=MessageOk)
async def patch_region(
    region_id: int,
    body: RegionPatchIn,
    session: AsyncSession = Depends(get_db),
    _: object = Depends(get_current_admin),
) -> MessageOk:
    reg = await session.get(Region, region_id)
    if reg is None:
        raise HTTPException(status_code=404, detail="Region not found")
    reg.region_name = body.region
    await session.commit()
    return MessageOk(message="region_changed")


@router.get("/cities", response_model=list[CityOut])
async def list_cities(
    session: AsyncSession = Depends(get_db),
    region_at: int | None = Query(None),
    region_id: int | None = Query(None),
) -> list[CityOut]:
    rid = region_id if region_id is not None else region_at
    if rid is None:
        raise HTTPException(status_code=422, detail="region_id or region_at required")
    r = await session.execute(select(City).where(City.region_id == rid).order_by(City.id))
    rows = list(r.scalars().all())
    return [CityOut(id=c.id, city_name=c.city_name, region_at=c.region_id) for c in rows]


@router.get("/districts", response_model=list[DistrictOut])
async def list_districts(
    session: AsyncSession = Depends(get_db),
    city_at: int | None = Query(None),
    city_id: int | None = Query(None),
) -> list[DistrictOut]:
    cid = city_id if city_id is not None else city_at
    if cid is None:
        raise HTTPException(status_code=422, detail="city_id or city_at required")
    r = await session.execute(select(District).where(District.city_id == cid).order_by(District.id))
    rows = list(r.scalars().all())
    return [DistrictOut(id=d.id, district=d.district, city_at=d.city_id) for d in rows]


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(session: AsyncSession = Depends(get_db)) -> list[CategoryOut]:
    r = await session.execute(select(Category).order_by(Category.id))
    return list(r.scalars().all())
