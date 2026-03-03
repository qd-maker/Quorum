"""POST /api/chat — 单模型流式对话."""

import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import get_settings
from services.model_service import stream_chat

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatRequest(BaseModel):
    model: str
    messages: list[dict]
    stream: bool = True


@router.post("/chat")
async def chat(req: ChatRequest):
    settings = get_settings()
    if req.model not in settings.available_models:
        raise HTTPException(400, f"不支持的模型: {req.model}")

    if not req.messages:
        raise HTTPException(400, "messages 不能为空")

    async def event_stream():
        try:
            async for chunk in stream_chat(req.model, req.messages):
                data = json.dumps({"content": chunk}, ensure_ascii=False)
                yield f"data: {data}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.exception("Chat stream error")
            error = json.dumps({"error": str(e)}, ensure_ascii=False)
            yield f"data: {error}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
