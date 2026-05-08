"""Quorum — FastAPI 入口."""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from config import get_settings
from rate_limit import limiter
from routers import chat, discuss, history, config_api, auth_router, trending

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Quorum", version="0.1.0")

# 限流器 — 防止恶意请求打爆配额
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """限流命中时返回友好的中文提示."""
    return JSONResponse(
        status_code=429,
        content={
            "detail": "请求过于频繁，请稍后再试",
            "retry_after_seconds": getattr(exc, "retry_after", 60),
        },
        headers={"Retry-After": str(getattr(exc, "retry_after", 60))},
    )


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
app.include_router(trending.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/demo/status")
async def demo_status():
    """返回 demo 模式是否启用，前端据此显示「立即体验」按钮."""
    s = get_settings()
    return {"enabled": s.DEMO_MODE}
