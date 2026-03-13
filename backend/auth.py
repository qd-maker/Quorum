"""JWT 验证依赖 — 本地 PyJWT 验证，零网络开销."""

import logging

import jwt
from fastapi import Header, HTTPException

from config import get_settings

logger = logging.getLogger(__name__)


async def get_current_user(authorization: str = Header(...)) -> str:
    """验证 Bearer token，返回 user_id (UUID str).

    使用 PyJWT 在本地验证签名，不再远程调 Supabase get_user()，
    单次调用节省 ~1.5-2s 网络延迟。
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authorization header 格式错误，需要 Bearer <token>")
    token = authorization.removeprefix("Bearer ").strip()

    settings = get_settings()
    secret = settings.SUPABASE_JWT_SECRET
    if not secret:
        raise HTTPException(500, "SUPABASE_JWT_SECRET 未配置")

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(401, "Token 缺少 sub 字段")
        return str(user_id)
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token 已过期，请重新登录")
    except jwt.InvalidTokenError as e:
        logger.warning("JWT decode failed: %s", e)
        raise HTTPException(401, "Token 无效，请重新登录")
