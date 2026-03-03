"""POST /api/chat — 单模型流式对话（含实时搜索注入）."""

import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import get_settings
from services.model_service import stream_chat
from services.search_service import (
    get_current_datetime_str,
    search_web,
    format_search_context,
    needs_search,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatRequest(BaseModel):
    model: str
    messages: list[dict]
    stream: bool = True


def _build_system_prompt(search_ctx: str) -> str:
    now_str = get_current_datetime_str()
    search_block = f"\n\n{search_ctx}" if search_ctx else ""
    return (
        f"当前时间：{now_str}{search_block}\n\n"
        "若问题涉及近期事件，请结合上方搜索结果（如有）进行回答，并注明信息来源。"
    )


@router.post("/chat")
async def chat(req: ChatRequest):
    settings = get_settings()
    if req.model not in settings.available_models:
        raise HTTPException(400, f"不支持的模型: {req.model}")

    if not req.messages:
        raise HTTPException(400, "messages 不能为空")

    # 提取最新用户消息用于判断是否需要搜索
    last_user_msg = next(
        (m["content"] for m in reversed(req.messages) if m.get("role") == "user"),
        "",
    )

    # 实时搜索注入
    search_ctx = ""
    if needs_search(last_user_msg):
        try:
            results = await search_web(last_user_msg, max_results=5)
            search_ctx = format_search_context(results, last_user_msg)
        except Exception:
            logger.warning("Search failed in chat, continuing without results")

    system_prompt = _build_system_prompt(search_ctx)

    async def event_stream():
        try:
            async for chunk in stream_chat(req.model, req.messages, system_prompt):
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
