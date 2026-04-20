import os
import sys
from pathlib import Path


# Ensure backend package is importable as top-level 'app'
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Provide minimal settings for import-time safety
os.environ.setdefault("SECRET_KEY", "testsecret")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

import pytest
from app.schemas import AnnouncementCreateIn


def _base_payload(**kwargs):
    base = {
        "ann_name": "test",
        "ann_description": "desc",
        "ann_city_id": 1,
        "ann_district_id": 1,
        "category_ids": [],
    }
    base.update(kwargs)
    return base


def test_resolved_region_id_prefers_ann_region_id():
    p = AnnouncementCreateIn(**_base_payload(ann_region_id=5))
    assert p.resolved_region_id() == 5


def test_resolved_region_id_uses_ann_regions():
    p = AnnouncementCreateIn(**_base_payload(ann_regions=7))
    assert p.resolved_region_id() == 7


def test_resolved_region_id_raises_when_missing():
    p = AnnouncementCreateIn(**_base_payload())
    with pytest.raises(ValueError):
        p.resolved_region_id()
