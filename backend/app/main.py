import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from app.config import settings
from app.database import engine
from app.init_data import create_tables, run_seed
from app.routers import announcements, auth, geo, profile, roles, users


@asynccontextmanager
async def lifespan(_: FastAPI):
    await create_tables()
    await run_seed()
    yield
    await engine.dispose()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(profile.router)
api.include_router(geo.router)
api.include_router(announcements.router)
api.include_router(roles.router)
api.include_router(users.router)


@api.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api)


def _resolved_public_dir() -> Path | None:
    raw = settings.frontend_static_dir or os.environ.get("FRONTEND_STATIC_DIR")
    if raw:
        p = Path(raw).expanduser().resolve()
        return p if p.is_dir() else None
    # Локально: .../Desktop/poteryashki_maket/public (parents[3] = родитель репозитория LostAndFound).
    # В Docker путь короче — без IndexError не обойтись.
    try:
        repo_parent = Path(__file__).resolve().parents[3]
    except IndexError:
        return None
    guess = repo_parent / "poteryashki_maket" / "public"
    return guess if guess.is_dir() else None


_public = _resolved_public_dir()
if _public is not None:

    @app.get("/profile")
    async def serve_profile_page():
        return FileResponse(_public / "profile.html")

    @app.get("/")
    async def serve_index():
        return FileResponse(_public / "index.html")

    @app.get("/style.css")
    async def serve_style():
        return FileResponse(_public / "style.css")

    @app.get("/profile.css")
    async def serve_profile_css():
        return FileResponse(_public / "profile.css")

    @app.get("/script.js")
    async def serve_script():
        return FileResponse(_public / "script.js")

    @app.get("/profile.js")
    async def serve_profile_js():
        return FileResponse(_public / "profile.js")

    @app.get("/api.js")
    async def serve_api_js():
        return FileResponse(_public / "api.js")


@app.get("/health")
async def health_root() -> dict[str, str]:
    return {"status": "ok"}
