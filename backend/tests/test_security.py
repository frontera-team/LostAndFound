import os
import sys
import importlib
from pathlib import Path


# Ensure backend package is importable as top-level 'app'
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Provide required settings before importing app modules
os.environ.setdefault("SECRET_KEY", "testsecret")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

import app.config as config
importlib.reload(config)

import app.security as security


def test_hash_and_verify_password():
    plain = "s3cretP@ss"
    hashed = security.hash_password(plain)
    assert security.verify_password(plain, hashed)
    assert not security.verify_password("wrong", hashed)


def test_refresh_token_hash_and_uniqueness():
    a = security.new_refresh_token_value()
    b = security.new_refresh_token_value()
    assert a != b
    ha = security.hash_refresh_token(a)
    assert ha == security.hash_refresh_token(a)
    assert ha != security.hash_refresh_token(b)


def test_jwt_create_and_verify():
    token = security.create_access_token("me@example.com", 42, 7)
    payload = security.verify_jwt_payload(token)
    assert payload is not None
    assert payload["sub"] == "me@example.com"
    assert payload["uid"] == 42
    assert payload["rid"] == 7
    assert payload["type"] == "access"


def test_verify_jwt_payload_invalid():
    assert security.verify_jwt_payload("not.a.valid.token") is None
