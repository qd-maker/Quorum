"""Per-user 运行时配置覆盖 — 保证多用户互不干扰.

存储为内存 dict，进程内有效；适用于演示/单实例部署。
若需持久化或多实例，可将 _store 替换为 Redis / DB。
"""

from __future__ import annotations

from threading import RLock
from typing import Any

from config import get_settings


# {user_id: {"api_base_url": ..., "api_key": ..., "models": {"gpt-4o": "gpt-4o", ...}}}
_store: dict[str, dict[str, Any]] = {}
_lock = RLock()


# ─── 默认模型映射 ───────────────────────────────
# 与 model_service.MODEL_NAME_MAP 保持一致，但这里是只读副本，每个用户有自己的映射
_DEFAULT_MODEL_MAP: dict[str, str] = {
    "gpt-4o": "gpt-4o",
    "gemini-2.0-flash": "gemini-2.5-flash",
    "grok-2": "grok-4",
    "deepseek-r1": "deepseek-r1",
    "deepseek-chat": "deepseek-r1",
}


def _ensure(user_id: str) -> dict[str, Any]:
    """获取或初始化一个 user 的配置块."""
    with _lock:
        if user_id not in _store:
            _store[user_id] = {
                "api_base_url": None,  # None 表示沿用全局默认
                "api_key": None,
                "models": dict(_DEFAULT_MODEL_MAP),
            }
        return _store[user_id]


def get_effective_config(user_id: str | None) -> dict[str, Any]:
    """返回用户的有效配置（user 覆盖 > 全局 settings）.

    返回字段：
    - api_base_url: str
    - api_key: str
    - models: dict[frontend_id, api_model_name]
    """
    s = get_settings()
    if not user_id:
        # 无 user 上下文（如 demo 模式），用全局默认
        return {
            "api_base_url": s.API_BASE_URL,
            "api_key": s.API_KEY,
            "models": dict(_DEFAULT_MODEL_MAP),
        }

    block = _ensure(user_id)
    return {
        "api_base_url": block["api_base_url"] or s.API_BASE_URL,
        "api_key": block["api_key"] or s.API_KEY,
        "models": dict(block["models"]),
    }


def update_user_config(
    user_id: str,
    *,
    api_base_url: str | None = None,
    api_key: str | None = None,
    gpt_model: str | None = None,
    gemini_model: str | None = None,
    grok_model: str | None = None,
    deepseek_model: str | None = None,
) -> dict[str, Any]:
    """部分更新用户配置（None 字段保持不变）."""
    block = _ensure(user_id)
    with _lock:
        if api_base_url is not None:
            block["api_base_url"] = api_base_url.strip() or None
        if api_key is not None:
            block["api_key"] = api_key.strip() or None
        if gpt_model:
            block["models"]["gpt-4o"] = gpt_model
        if gemini_model:
            block["models"]["gemini-2.0-flash"] = gemini_model
        if grok_model:
            block["models"]["grok-2"] = grok_model
        if deepseek_model:
            block["models"]["deepseek-r1"] = deepseek_model
            block["models"]["deepseek-chat"] = deepseek_model

    return get_effective_config(user_id)


def get_user_models(user_id: str | None) -> dict[str, str]:
    """快捷取用户的 frontend_id → api_model 映射."""
    return get_effective_config(user_id)["models"]
