"""Auth 路由 — 代理 Supabase 登录/注册，前端也可直连 Supabase."""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from supabase import create_client
from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

_client = None


def _get_client():
    global _client
    if _client is None:
        s = get_settings()
        _client = create_client(s.SUPABASE_URL, s.SUPABASE_KEY)
    return _client


class AuthRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
async def login(req: AuthRequest):
    """邮箱密码登录，返回 access_token + user 信息."""
    try:
        res = _get_client().auth.sign_in_with_password(
            {"email": req.email, "password": req.password}
        )
        return {
            "access_token": res.session.access_token,
            "user": {"id": str(res.user.id), "email": res.user.email},
        }
    except Exception as e:
        logger.warning("Login failed: %s", e)
        raise HTTPException(401, "邮箱或密码错误")


@router.post("/register")
async def register(req: AuthRequest):
    """注册新账号."""
    try:
        res = _get_client().auth.sign_up(
            {"email": req.email, "password": req.password}
        )
        if not res.user:
            raise HTTPException(400, "注册失败，邮箱可能已存在")
        return {"message": "注册成功，请检查邮箱确认（或直接登录）", "user_id": str(res.user.id)}
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Register failed: %s", e)
        raise HTTPException(400, "注册失败")
