"""Quorum — FastAPI 入口."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from routers import chat, discuss, history, config_api, auth_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Quorum", version="0.1.0")

# CORS — 从环境变量读取允许的源，支持生产部署
settings = get_settings()
cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由
app.include_router(chat.router, prefix="/api")
app.include_router(discuss.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(config_api.router, prefix="/api")
app.include_router(auth_router.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
