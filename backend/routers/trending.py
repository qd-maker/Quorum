"""GET /api/trending-topics — 智能生成近期热门话题建议.

策略：
1. 全局共享一份话题（与模型无关），统一由 gpt-4o 生成
2. 内存 cache 1 小时 TTL；并发请求经单飞锁去重
3. 失败时返回默认通用提示（不抛错）
"""

from __future__ import annotations

import asyncio
import logging
import re
import time

from fastapi import APIRouter, Query

from services.model_service import complete_chat
from services.search_service import get_current_datetime_str

logger = logging.getLogger(__name__)
router = APIRouter()

# 默认 fallback（无网络/LLM 失败时使用）
DEFAULT_TOPICS = [
    "解释一个技术概念",
    "帮我写代码",
    "分析这个问题",
    "给我一些建议",
]

# 用于生成的固定模型（最稳，输出格式可控）
GENERATOR_MODEL = "gpt-4o"

# 全局缓存（单值，所有用户共享）
_cache: tuple[list[str], float] | None = None
_TTL_SECONDS = 3600  # 1 小时
_lock = asyncio.Lock()


# 解析辅助
_LEADING_RE = re.compile(r"^[\s\-•·*>0-9.、)]+")
_MD_BOLD_RE = re.compile(r"\*+|`+")


def _parse_topics(raw: str) -> list[str]:
    """从模型输出中提取 4 条话题，宽容多种格式."""
    text = _MD_BOLD_RE.sub("", raw or "").strip()

    candidates: list[str] = []
    for line in text.splitlines():
        s = _LEADING_RE.sub("", line).strip()
        if not s:
            continue
        # 长行可能用「，」「、」「;」分隔多条
        parts = re.split(r"[,，、;；]", s) if len(s) > 30 else [s]
        for p in parts:
            t = _LEADING_RE.sub("", p.strip()).strip(" 。.!?！？:：\"'")
            if 4 <= len(t) <= 30:
                candidates.append(t)

    seen = set()
    uniq: list[str] = []
    for t in candidates:
        if t not in seen:
            seen.add(t)
            uniq.append(t)
        if len(uniq) >= 4:
            break
    return uniq


async def _generate_topics() -> list[str]:
    """统一让 GPT-4o 生成 4 条贴近时下的开放式问题."""
    now_str = get_current_datetime_str()
    system = (
        f"你是话题策划助理。当前时间：{now_str}。\n"
        "请基于本周/本月内开发者圈、AI 圈最热的真实话题（新发布的库/产品、行业辩论、技术事件等），"
        "生成 4 条用户最可能现在想问 AI 的开放式问题建议。\n\n"
        "严格要求：\n"
        "1. 每条 6 到 18 个字，简洁、口语化、有吸引力\n"
        "2. 必须体现「近期」时效性，避免使用 GPT-3.5、ChatGPT 4.0 这类过时引用\n"
        "3. 形式要多样：技术深度、行业观察、对比辩论、实用建议各占 1 条\n"
        "4. 直接输出 4 行内容，每行 1 条，不要编号、不要解释、不要标点结尾\n"
    )
    messages = [{"role": "user", "content": "请直接给出 4 条建议。"}]

    text = await complete_chat(GENERATOR_MODEL, messages, system, user_id=None)
    cleaned = _parse_topics(text)
    if len(cleaned) >= 4:
        return cleaned[:4]
    if cleaned:
        topup = [t for t in DEFAULT_TOPICS if t not in cleaned]
        return (cleaned + topup)[:4]
    logger.warning("Topics empty after parse, raw=%r", text[:200])
    return DEFAULT_TOPICS


async def _get_or_refresh() -> list[str]:
    """带 TTL + 单飞锁的全局 cache 获取."""
    global _cache
    now = time.time()
    if _cache and (now - _cache[1]) < _TTL_SECONDS:
        return _cache[0]

    async with _lock:
        if _cache and (time.time() - _cache[1]) < _TTL_SECONDS:
            return _cache[0]

        try:
            topics = await asyncio.wait_for(_generate_topics(), timeout=15.0)
        except Exception as e:
            logger.warning("Trending generation failed: %s", e)
            # 短缓存 5 分钟，避免连续打挂
            _cache = (DEFAULT_TOPICS, now - _TTL_SECONDS + 300)
            return DEFAULT_TOPICS

        _cache = (topics, time.time())
        return topics


@router.get("/trending-topics")
async def trending_topics(
    model: str = Query("gpt-4o", description="保留参数仅用于响应回显，不影响生成"),
    refresh: bool = Query(False, description="忽略缓存强制重新生成"),
):
    """返回 4 条近期热门话题建议（全局共享，每小时刷新一次）."""
    global _cache
    if refresh:
        _cache = None

    topics = await _get_or_refresh()
    return {
        "model": model,
        "topics": topics,
        "generated_at": _cache[1] if _cache else 0,
        "ttl_seconds": _TTL_SECONDS,
    }
