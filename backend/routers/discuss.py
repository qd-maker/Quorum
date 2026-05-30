"""POST /api/discuss — 群聊讨论 SSE 端点.
POST /api/discuss/followup — 基于完整讨论上下文的追问端点.
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from auth import get_current_user
from config import get_settings
from rate_limit import limiter
from services.orchestrator import run_discussion, run_followup

logger = logging.getLogger(__name__)
router = APIRouter()

DEFAULT_MODELS = ["gpt-4o", "gemini-2.0-flash", "grok-2", "deepseek-r1"]
MAX_DISCUSS_MODELS = 4
MAX_ROUNDS = 3
MAX_TOPIC_CHARS = 2_200_000
MAX_IMAGE_DATA_URL_CHARS = 6_200_000
MAX_ROLE_CHARS = 80


class DiscussRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=MAX_TOPIC_CHARS)
    models: list[str] = Field(default_factory=lambda: DEFAULT_MODELS.copy(), min_length=1, max_length=MAX_DISCUSS_MODELS)
    rounds: int = Field(default=2, ge=1, le=MAX_ROUNDS)
    roles: dict[str, str] = Field(default_factory=dict)  # model_id -> role_description (可选)
    image: str | None = Field(default=None, max_length=MAX_IMAGE_DATA_URL_CHARS)  # base64 data URL (可选，用于图片分析)
    use_search: bool = False    # 强制开启联网搜索

    @field_validator("models")
    @classmethod
    def validate_models(cls, models: list[str]) -> list[str]:
        normalized = [m.strip() for m in models if isinstance(m, str) and m.strip()]
        if not normalized:
            raise ValueError("models 不能为空")
        if len(set(normalized)) != len(normalized):
            raise ValueError("models 不能重复")
        return normalized

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, roles: dict[str, str]) -> dict[str, str]:
        cleaned: dict[str, str] = {}
        for model, role in roles.items():
            model_key = model.strip()
            role_value = role.strip()
            if model_key and role_value:
                cleaned[model_key] = role_value[:MAX_ROLE_CHARS]
        return cleaned


class FollowUpRequest(BaseModel):
    question: str = Field(min_length=1, max_length=MAX_TOPIC_CHARS)
    topic: str = Field(min_length=1, max_length=MAX_TOPIC_CHARS)
    context: str = Field(min_length=1, max_length=MAX_TOPIC_CHARS)  # 前端传入的完整讨论文本（各轮内容 + 共识）
    models: list[str] = Field(default_factory=lambda: DEFAULT_MODELS.copy(), min_length=1, max_length=MAX_DISCUSS_MODELS)
    image: str | None = Field(default=None, max_length=MAX_IMAGE_DATA_URL_CHARS)  # base64 data URL (可选)
    use_search: bool = False

    @field_validator("models")
    @classmethod
    def validate_models(cls, models: list[str]) -> list[str]:
        normalized = [m.strip() for m in models if isinstance(m, str) and m.strip()]
        if not normalized:
            raise ValueError("models 不能为空")
        return list(dict.fromkeys(normalized))


@router.post("/discuss")
@limiter.limit("5/minute")
async def discuss(
    request: Request,
    req: DiscussRequest,
    user_id: str = Depends(get_current_user),
):
    if not req.topic.strip():
        raise HTTPException(400, "topic 不能为空")

    settings = get_settings()
    for m in req.models:
        if m not in settings.available_models:
            raise HTTPException(400, f"不支持的模型: {m}")

    async def _should_stop() -> bool:
        return await request.is_disconnected()

    async def event_stream():
        try:
            async for event in run_discussion(
                req.topic,
                req.models,
                req.rounds,
                roles=req.roles,
                image=req.image,
                use_search=req.use_search,
                user_id=user_id,
                should_stop=_should_stop,
            ):
                yield event
        except Exception as e:
            logger.exception("Discussion stream error")
            # 向前端发送错误提示，避免静默失败
            yield f"data: {json.dumps({'type': 'consensus_chunk', 'content': f'[讨论流异常中断: {e}]'}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/discuss/followup")
@limiter.limit("15/minute")
async def discuss_followup(
    request: Request,
    req: FollowUpRequest,
    user_id: str = Depends(get_current_user),
):
    if not req.question.strip():
        raise HTTPException(400, "question 不能为空")
    if not req.context.strip():
        raise HTTPException(400, "context 不能为空")

    settings = get_settings()
    # 过滤掉不可用的模型，保留至少一个
    valid_models = [m for m in req.models if m in settings.available_models]
    if not valid_models:
        raise HTTPException(400, "没有可用的模型")

    async def _should_stop() -> bool:
        return await request.is_disconnected()

    async def event_stream():
        try:
            async for event in run_followup(
                req.question,
                req.topic,
                req.context,
                valid_models,
                image=req.image,
                use_search=req.use_search,
                user_id=user_id,
                should_stop=_should_stop,
            ):
                yield event
        except Exception as e:
            logger.exception("Followup stream error")
            yield f"data: {json.dumps({'type': 'followup_chunk', 'content': f'[追问流异常中断: {e}]'}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'followup_done'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
