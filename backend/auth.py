"""JWT 验证依赖 — 本地 PyJWT 验证，零网络开销.

提供两种依赖：
- get_current_user: 接受 Bearer token；DEMO_MODE 开启时也接受匿名访问（返回 demo:IP）
- get_current_user_strict: 必须有有效 token（用于 history 等敏感端点）
"""

import logging

import jwt
from fastapi import Header, HTTPException, Request

from config import get_settings

logger = logging.getLogger(__name__)


def _decode(token: str) -> str:
    """解析 JWT 返回 user_id；失败抛 HTTPException."""
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


async def get_current_user(
    request: Request,
    authorization: str | None = Header(None),
) -> str:
    """获取当前 user_id；DEMO_MODE 开启时未带 token 也允许，返回 demo:IP."""
    settings = get_settings()
    if not authorization:
        if settings.DEMO_MODE:
            ip = request.client.host if request.client else "unknown"
            return f"demo:{ip}"
        raise HTTPException(401, "未登录，请先登录或开启 demo 模式")

    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authorization header 格式错误，需要 Bearer <token>")
    token = authorization.removeprefix("Bearer ").strip()
    return _decode(token)


async def get_current_user_strict(
    authorization: str | None = Header(None),
) -> str:
    """严格模式：必须带有效 Bearer token；用于 history 等敏感端点."""
    if not authorization:
        raise HTTPException(401, "未登录，请先登录")
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authorization header 格式错误，需要 Bearer <token>")
    token = authorization.removeprefix("Bearer ").strip()
    return _decode(token)
