import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import Base, engine
from .routes import (
    attachments,
    bootstrap,
    care_board,
    chat,
    conflicts,
    events,
    handoffs,
    schedules,
)
from .seed import seed
from .services.llm_client import warmup as ai_warmup


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed()
    # Absorb the AI provider's cold start in the background so the first
    # caregiver message is not the one that waits for it.
    warmup_task = asyncio.create_task(ai_warmup())
    yield
    warmup_task.cancel()


settings.upload_dir.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="CareRelay API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

for router in (
    bootstrap.router,
    chat.router,
    conflicts.router,
    events.router,
    schedules.router,
    handoffs.router,
    attachments.router,
    care_board.router,
):
    app.include_router(router, prefix="/api")


@app.get("/health", tags=["system"])
def health():
    return {
        "status": "ok",
        "ai_configured": settings.ai_configured,
        "ai_model": settings.ai_model if settings.ai_configured else None,
    }

