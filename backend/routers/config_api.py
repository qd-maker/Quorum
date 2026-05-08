"""动态配置 API 路由 — per-user 运行时配置，互不影响."""

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import get_current_user_strict as get_current_user
from services.user_config import get_effective_config, update_user_config

logger = logging.getLogger(__name__)
router = APIRouter()


class ConfigUpdateRequest(BaseModel):
    api_base_url: str | None = None
    api_key: str | None = None
    # 兼容字段（前端可能仍在传），目前未做单 provider 拆分
    openai_key: str | None = None
    google_key: str | None = None
    xai_key: str | None = None
    deepseek_key: str | None = None
    gpt_model: str | None = None
    gemini_model: str | None = None
    grok_model: str | None = None
    deepseek_model: str | None = None


@router.post("/config")
async def update_config(
    req: ConfigUpdateRequest,
    user_id: str = Depends(get_current_user),
):
    """更新当前用户的运行时配置（仅对自己生效）."""
    cfg = update_user_config(
        user_id,
        api_base_url=req.api_base_url,
        api_key=req.api_key,
        gpt_model=req.gpt_model,
        gemini_model=req.gemini_model,
        grok_model=req.grok_model,
        deepseek_model=req.deepseek_model,
    )
    logger.info("User %s config updated: models=%s", user_id[:8], cfg["models"])
    return {"ok": True, "models": cfg["models"]}


@router.get("/config")
async def get_config(user_id: str = Depends(get_current_user)):
    """获取当前用户的有效配置（不返回完整密钥）."""
    cfg = get_effective_config(user_id)
    return {
        "api_base_url": cfg["api_base_url"],
        "api_key_set": bool(cfg["api_key"]),
        "models": cfg["models"],
    }
