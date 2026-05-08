"""统一模型服务 — 所有模型通过同一个 OpenAI 兼容 API 中转站调用.

per-user client 缓存：每个用户可配置独立的 base_url / api_key / 模型别名，
互不干扰。无 user_id 时回退到全局 settings（demo / 兼容旧调用）。
"""

import asyncio
import logging
from collections.abc import AsyncGenerator

from openai import APIStatusError, AsyncOpenAI, RateLimitError

from services.user_config import get_effective_config

logger = logging.getLogger(__name__)

# 429 / 上游饱和重试节奏（秒）
_RETRY_DELAYS = (0.6, 1.5, 3.0)


def _is_retryable(exc: BaseException) -> bool:
    """是否值得重试：标准 429 + 第三方代理的"上游饱和" 5xx."""
    if isinstance(exc, RateLimitError):
        return True
    if isinstance(exc, APIStatusError):
        # new-api / one-api 等代理用 429 + 中文 message 表达上游饱和；
        # 也有少数代理用 503 / 502 表示 upstream busy
        if exc.status_code in (429, 502, 503):
            return True
    msg = str(exc)
    return ("饱和" in msg) or ("rate limit" in msg.lower())

# 前端 ID 别名归一（旧 ID → 新 ID）
MODEL_ALIASES: dict[str, str] = {
    "deepseek-chat": "deepseek-r1",
}

# 兼容性：保留作为「默认模型映射」，新代码请用 user_config.get_user_models()
MODEL_NAME_MAP: dict[str, str] = {
    "gpt-4o": "gpt-4o",
    "gemini-2.0-flash": "gemini-2.5-flash",
    "grok-2": "grok-4",
    "deepseek-r1": "deepseek-r1",
    "deepseek-chat": "deepseek-r1",
}

# {(base_url, api_key): client}
_client_cache: dict[tuple[str, str], AsyncOpenAI] = {}


def _client_for(base_url: str, api_key: str) -> AsyncOpenAI:
    key = (base_url or "", api_key or "")
    client = _client_cache.get(key)
    if client is None:
        client = AsyncOpenAI(base_url=base_url, api_key=api_key, timeout=180.0)
        _client_cache[key] = client
    return client


def reset_client() -> None:
    """清空所有 client 缓存（API 配置变更后调用）."""
    _client_cache.clear()


def normalize_model_id(model: str) -> str:
    """把旧前端模型 ID 归一到当前规范 ID。"""
    return MODEL_ALIASES.get(model, model)


def set_deepseek_model(api_model: str) -> None:
    """[兼容] 全局更新 DeepSeek 默认映射。新代码请改用 user_config。"""
    MODEL_NAME_MAP["deepseek-r1"] = api_model
    MODEL_NAME_MAP["deepseek-chat"] = api_model


async def stream_chat(
    model: str,
    messages: list[dict],
    system_prompt: str | None = None,
    user_id: str | None = None,
) -> AsyncGenerator[str, None]:
    """流式调用指定模型，yield 增量文本 chunk.

    user_id 用于解析该用户的私有配置（API key / 模型映射）。
    无 user_id 时使用全局默认（仅推荐 demo 场景）。

    握手阶段（create stream）遇到 429 / 上游饱和会指数退避重试；
    一旦流已开启则不再重试，让上层判定为真正的失败。
    """
    cfg = get_effective_config(user_id)
    client = _client_for(cfg["api_base_url"], cfg["api_key"])
    frontend_model = normalize_model_id(model)
    api_model = cfg["models"].get(frontend_model, frontend_model)

    full_messages: list[dict] = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    stream = None
    last_exc: BaseException | None = None
    for attempt in range(len(_RETRY_DELAYS) + 1):
        try:
            stream = await client.chat.completions.create(
                model=api_model,
                messages=full_messages,
                stream=True,
            )
            break
        except Exception as exc:
            last_exc = exc
            if not _is_retryable(exc) or attempt == len(_RETRY_DELAYS):
                raise
            delay = _RETRY_DELAYS[attempt]
            logger.warning(
                "model=%s upstream busy (attempt %d/%d): %s — retrying in %.1fs",
                api_model, attempt + 1, len(_RETRY_DELAYS), exc, delay,
            )
            await asyncio.sleep(delay)

    if stream is None:  # 理论不会到这；防御性
        if last_exc:
            raise last_exc
        raise RuntimeError("stream_chat: failed to open stream")

    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content


async def complete_chat(
    model: str,
    messages: list[dict],
    system_prompt: str | None = None,
    user_id: str | None = None,
) -> str:
    """非流式调用，返回完整文本（orchestrator 内部用于收集完整回答）."""
    parts: list[str] = []
    async for chunk in stream_chat(model, messages, system_prompt, user_id=user_id):
        parts.append(chunk)
    return "".join(parts)
