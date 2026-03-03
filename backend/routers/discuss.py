"""POST /api/discuss — 群聊讨论 SSE 端点."""

import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import get_settings
from services.orchestrator import run_discussion

logger = logging.getLogger(__name__)
router = APIRouter()


class DiscussRequest(BaseModel):
    topic: str
    models: list[str] = ["gpt-4o", "gemini-2.0-flash", "grok-2", "deepseek-chat"]
    rounds: int = 2


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
            async for event in run_discussion(req.topic, req.models, req.rounds):
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
