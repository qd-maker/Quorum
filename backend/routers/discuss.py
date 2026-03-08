"""POST /api/discuss — 群聊讨论 SSE 端点.
POST /api/discuss/followup — 基于完整讨论上下文的追问端点.
"""

import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import get_settings
from services.orchestrator import run_discussion, run_followup

logger = logging.getLogger(__name__)
router = APIRouter()

DEFAULT_MODELS = ["gpt-4o", "gemini-2.0-flash", "grok-2", "deepseek-chat"]


class DiscussRequest(BaseModel):
    topic: str
    models: list[str] = DEFAULT_MODELS
    rounds: int = 2
    roles: dict[str, str] = {}  # model_id -> role_description (可选)


class FollowUpRequest(BaseModel):
    question: str
    topic: str
    context: str  # 前端传入的完整讨论文本（各轮内容 + 共识）
    models: list[str] = DEFAULT_MODELS


@router.post("/discuss")
async def discuss(req: DiscussRequest):
    if not req.topic.strip():
        raise HTTPException(400, "topic 不能为空")

    settings = get_settings()
    for m in req.models:
        if m not in settings.available_models:
            raise HTTPException(400, f"不支持的模型: {m}")

    async def event_stream():
        try:
            async for event in run_discussion(req.topic, req.models, req.rounds, roles=req.roles):
                yield event
        except Exception:
            logger.exception("Discussion stream error")

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/discuss/followup")
async def discuss_followup(req: FollowUpRequest):
    if not req.question.strip():
        raise HTTPException(400, "question 不能为空")
    if not req.context.strip():
        raise HTTPException(400, "context 不能为空")

    settings = get_settings()
    # 过滤掉不可用的模型，保留至少一个
    valid_models = [m for m in req.models if m in settings.available_models]
    if not valid_models:
        raise HTTPException(400, "没有可用的模型")

    async def event_stream():
        try:
            async for event in run_followup(req.question, req.topic, req.context, valid_models):
                yield event
        except Exception:
            logger.exception("Followup stream error")

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
