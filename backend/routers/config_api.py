"""动态配置 API 路由 — 运行时更新 API 配置."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel

from config import get_settings
from services.model_service import MODEL_NAME_MAP

logger = logging.getLogger(__name__)
router = APIRouter()


class ConfigUpdateRequest(BaseModel):
    api_base_url: str | None = None
    api_key: str | None = None
    openai_key: str | None = None
    google_key: str | None = None
    xai_key: str | None = None
    deepseek_key: str | None = None
    gpt_model: str | None = None
    gemini_model: str | None = None
    grok_model: str | None = None
    deepseek_model: str | None = None


@router.post("/config")
async def update_config(req: ConfigUpdateRequest):
    """运行时更新 API 配置."""
    s = get_settings()

    if req.api_base_url:
        s.API_BASE_URL = req.api_base_url
    if req.api_key:
        s.API_KEY = req.api_key

    # 更新模型名称映射
    if req.gpt_model:
        MODEL_NAME_MAP["gpt-4o"] = req.gpt_model
    if req.gemini_model:
        MODEL_NAME_MAP["gemini-2.0-flash"] = req.gemini_model
    if req.grok_model:
        MODEL_NAME_MAP["grok-2"] = req.grok_model
    if req.deepseek_model:
        MODEL_NAME_MAP["deepseek-chat"] = req.deepseek_model

    logger.info("Config updated: base_url=%s, models=%s", s.API_BASE_URL, MODEL_NAME_MAP)
    return {"ok": True, "models": MODEL_NAME_MAP}


@router.get("/config")
async def get_config():
    """获取当前 API 配置（不返回完整密钥）."""
    s = get_settings()
    return {
        "api_base_url": s.API_BASE_URL,
        "api_key_set": bool(s.API_KEY),
        "models": dict(MODEL_NAME_MAP),
    }
