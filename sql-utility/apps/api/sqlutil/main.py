from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import get_store
from .routes import api_router

logging.basicConfig(level=settings.log_level)

app = FastAPI(title="sqlutil", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    get_store().migrate()


app.include_router(api_router, prefix="/api")


WEB_DIST = Path(os.environ.get("SQLUTIL_WEB_DIST", "/app/web"))


if WEB_DIST.exists():
    app.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str) -> FileResponse:
        target = WEB_DIST / full_path
        if target.is_file():
            return FileResponse(target)
        return FileResponse(WEB_DIST / "index.html")
