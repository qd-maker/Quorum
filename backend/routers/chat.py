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
    use_search: bool = False


def _build_system_prompt(search_ctx: str) -> str:
    now_str = get_current_datetime_str()
    search_block = f"\n\n{search_ctx}" if search_ctx else ""
    return (
        f"当前时间：{now_str}{search_block}\n\n"
        "回答要求：\n"
        "1. 若上方有搜索结果，请充分利用其中的信息进行详细回答，并标注来源编号（如[1]）\n"
        "2. 回答要结构清晰、内容充分，不要仅用一两句话敷衍了事\n"
        "3. 涉及事件时，请说明时间线、各方立场、影响和后续进展\n"
        "4. 若搜索结果不足，请说明哪些方面信息有限，并给出已知部分的分析"
    )


@router.post("/chat")
async def chat(req: ChatRequest):
    settings = get_settings()
    if req.model not in settings.available_models:
        raise HTTPException(400, f"不支持的模型: {req.model}")

    if not req.messages:
        raise HTTPException(400, "messages 不能为空")

    # 提取最新用户消息用于判断是否需要搜索
    last_user_msg_raw = next(
        (m["content"] for m in reversed(req.messages) if m.get("role") == "user"),
        "",
    )
    
    last_user_msg = ""
    if isinstance(last_user_msg_raw, list):
        # 提取 Vision 格式中的文本部分
        texts = [item.get("text", "") for item in last_user_msg_raw if item.get("type") == "text"]
        last_user_msg = " ".join(texts).strip()
    elif isinstance(last_user_msg_raw, str):
        last_user_msg = last_user_msg_raw.strip()

    # 实时搜索注入（仅在前端明确开启时）
    search_ctx = ""
    search_sources: list[dict] = []
    if req.use_search and last_user_msg:
        try:
            results = await search_web(last_user_msg, max_results=5)
            search_ctx = format_search_context(results, last_user_msg)
            search_sources = [{"title": r.get("title", ""), "url": r.get("href", "")} for r in results if r.get("title")]
        except Exception:
            logger.warning("Search failed in chat, continuing without results")

    system_prompt = _build_system_prompt(search_ctx)

    async def event_stream():
        try:
            # 先发送搜索来源（如果有）
            if search_sources:
                sources_data = json.dumps({"sources": search_sources}, ensure_ascii=False)
                yield f"data: {sources_data}\n\n"
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
