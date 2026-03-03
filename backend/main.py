"""Many AI — FastAPI 入口."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import chat, discuss, history, config_api, auth_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Many AI", version="0.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
