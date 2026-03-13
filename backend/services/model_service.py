"""统一模型服务 — 所有模型通过同一个 OpenAI 兼容 API 中转站调用."""

from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from config import get_settings

# 前端 ID → 实际 API 模型名映射（也作为显示名，用户可通过 /api/config 更新）
MODEL_NAME_MAP: dict[str, str] = {
    "gpt-4o": "gpt-4o",
    "gemini-2.0-flash": "gemini-2.5-flash",
    "grok-2": "grok-4",
    "deepseek-chat": "deepseek-chat",
}

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        s = get_settings()
        _client = AsyncOpenAI(base_url=s.API_BASE_URL, api_key=s.API_KEY)
    return _client


async def stream_chat(
    model: str,
    messages: list[dict],
    system_prompt: str | None = None,
) -> AsyncGenerator[str, None]:
    """流式调用指定模型，yield 增量文本 chunk."""
    client = _get_client()
    api_model = MODEL_NAME_MAP.get(model, model)

    full_messages: list[dict] = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    stream = await client.chat.completions.create(
        model=api_model,
        messages=full_messages,
        stream=True,
    )

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
) -> str:
    """非流式调用，返回完整文本（orchestrator 内部用于收集完整回答）."""
    parts: list[str] = []
    async for chunk in stream_chat(model, messages, system_prompt):
        parts.append(chunk)
    return "".join(parts)
