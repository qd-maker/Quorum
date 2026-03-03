"""历史记录 API 路由（带用户认证）."""

import logging

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from auth import get_current_user
from services.history_service import (
    list_sessions,
    create_session,
    update_session,
    get_session,
    delete_session,
    save_messages,
    replace_messages,
    get_messages,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── 请求模型 ─────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    type: str  # 'chat' | 'discuss'
    title: str = ""
    preview: str = ""
    model: str | None = None
    topic: str | None = None


class UpdateSessionRequest(BaseModel):
    title: str | None = None
    preview: str | None = None
    consensus: str | None = None


class SaveMessagesRequest(BaseModel):
    messages: list[dict]


# ─── 路由 ─────────────────────────────────────────────

@router.get("/sessions")
async def api_list_sessions(
    limit: int = 30,
    user_id: str = Depends(get_current_user),
):
    """获取当前用户的历史会话列表."""
    try:
        return await list_sessions(user_id, limit)
    except Exception as e:
        logger.exception("Failed to list sessions")
        raise HTTPException(500, str(e))


@router.post("/sessions")
async def api_create_session(
    req: CreateSessionRequest,
    user_id: str = Depends(get_current_user),
):
    """创建新会话（归属当前用户）."""
    if req.type not in ("chat", "discuss"):
        raise HTTPException(400, "type 必须是 'chat' 或 'discuss'")
    try:
        return await create_session(
            user_id=user_id,
            session_type=req.type,
            title=req.title,
            preview=req.preview,
            model=req.model,
            topic=req.topic,
        )
    except Exception as e:
        logger.exception("Failed to create session")
        raise HTTPException(500, str(e))


@router.patch("/sessions/{session_id}")
async def api_update_session(
    session_id: str,
    req: UpdateSessionRequest,
    user_id: str = Depends(get_current_user),
):
    """更新会话信息（仅限自己的会话）."""
    try:
        updates = {k: v for k, v in req.model_dump().items() if v is not None}
        if not updates:
            raise HTTPException(400, "没有要更新的字段")
        return await update_session(session_id, user_id, **updates)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update session")
        raise HTTPException(500, str(e))


@router.get("/sessions/{session_id}")
async def api_get_session(
    session_id: str,
    user_id: str = Depends(get_current_user),
):
    """获取会话详情 + 消息（仅限自己的）."""
    try:
        session = await get_session(session_id, user_id)
        if not session:
            raise HTTPException(404, "会话不存在")
        msgs = await get_messages(session_id)
        return {**session, "messages": msgs}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get session")
        raise HTTPException(500, str(e))


@router.delete("/sessions/{session_id}")
async def api_delete_session(
    session_id: str,
    user_id: str = Depends(get_current_user),
):
    """删除会话（仅限自己的）."""
    try:
        await delete_session(session_id, user_id)
        return {"ok": True}
    except Exception as e:
        logger.exception("Failed to delete session")
        raise HTTPException(500, str(e))


@router.post("/sessions/{session_id}/messages")
async def api_save_messages(
    session_id: str,
    req: SaveMessagesRequest,
    user_id: str = Depends(get_current_user),
):
    """批量追加消息."""
    try:
        await save_messages(session_id, req.messages)
        return {"ok": True}
    except Exception as e:
        logger.exception("Failed to save messages")
        raise HTTPException(500, str(e))


@router.put("/sessions/{session_id}/messages")
async def api_replace_messages(
    session_id: str,
    req: SaveMessagesRequest,
    user_id: str = Depends(get_current_user),
):
    """全量替换消息（先清后写）."""
    try:
        await replace_messages(session_id, req.messages)
        return {"ok": True}
    except Exception as e:
        logger.exception("Failed to replace messages")
        raise HTTPException(500, str(e))
