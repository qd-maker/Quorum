"""JWT 验证依赖 — 从 Authorization header 提取并验证 Supabase JWT."""

import logging
from fastapi import Header, HTTPException

from supabase import create_client
from config import get_settings

logger = logging.getLogger(__name__)

_auth_client = None


def _get_auth_client():
    global _auth_client
    if _auth_client is None:
        s = get_settings()
        _auth_client = create_client(s.SUPABASE_URL, s.SUPABASE_KEY)
    return _auth_client


async def get_current_user(authorization: str = Header(...)) -> str:
    """验证 Bearer token，返回 user_id (UUID str)."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authorization header 格式错误，需要 Bearer <token>")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        client = _get_auth_client()
        resp = client.auth.get_user(token)
        if not resp or not resp.user:
            raise HTTPException(401, "Token 无效或已过期")
        return str(resp.user.id)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("JWT validation failed: %s", e)
        raise HTTPException(401, "认证失败，请重新登录")
