"""GET /api/trending-topics — 智能生成近期热门讨论话题.

策略：
1. 全局共享一份话题（与模型无关），统一由 gpt-4o 生成
2. 每条话题包含 emoji / title / hint 三段，前端可直接渲染卡片
3. 内存 cache 1 小时 TTL；并发请求经单飞锁去重
4. 失败时返回默认通用提示（不抛错）
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time

from fastapi import APIRouter, Query

from services.model_service import complete_chat
from services.search_service import get_current_datetime_str

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Default fallback ─────────────────────────────────────
DEFAULT_TOPIC_OBJECTS: list[dict] = [
    {"emoji": "🤖", "title": "AI 会在 5 年内取代大多数程序员吗？", "hint": "热门科技话题 · 多方碰撞观点"},
    {"emoji": "🏗️", "title": "创业公司应该选择微服务还是单体架构？", "hint": "架构选型 · 技术评审"},
    {"emoji": "💡", "title": "如果重新设计 React，你会改变什么？", "hint": "思维实验 · 创意发散"},
    {"emoji": "🌍", "title": "远程工作是否会永久改变工作文化？", "hint": "社会议题 · 平衡视角"},
]

# 用于生成的固定模型（最稳，输出格式可控）
GENERATOR_MODEL = "gpt-4o"

# 全局缓存（单值，所有用户共享）
_cache: tuple[list[dict], float] | None = None
_TTL_SECONDS = 3600  # 1 小时
_lock = asyncio.Lock()


# ─── JSON 提取辅助（兼容模型在 JSON 周围加 ``` 包裹） ───
_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.+?)\s*```", re.DOTALL)
_JSON_ARRAY_RE = re.compile(r"\[\s*\{.*?\}\s*\]", re.DOTALL)


def _extract_json_array(raw: str) -> str | None:
    """从模型输出中尽力提取 JSON 数组字符串."""
    if not raw:
        return None
    # 优先 ``` ``` 围栏
    m = _JSON_FENCE_RE.search(raw)
    if m:
        return m.group(1).strip()
    # 否则匹配 [{...}] 形式
    m = _JSON_ARRAY_RE.search(raw)
    if m:
        return m.group(0)
    return raw.strip()


def _normalize_item(item: dict) -> dict | None:
    """归一化一个 topic 对象，剔除非法/超长值."""
    if not isinstance(item, dict):
        return None
    emoji = str(item.get("emoji", "") or "").strip()[:4] or "✨"
    title = str(item.get("title", "") or "").strip().strip("\"'")
    hint = str(item.get("hint", "") or "").strip().strip("\"'")
    if not (4 <= len(title) <= 40):
        return None
    if len(hint) > 30:
        hint = hint[:30]
    return {"emoji": emoji, "title": title, "hint": hint or "近期热门讨论"}


def _parse_topic_objects(raw: str) -> list[dict]:
    """从模型输出中解析 topic 对象列表."""
    json_text = _extract_json_array(raw)
    if not json_text:
        return []
    try:
        data = json.loads(json_text)
    except Exception:
        return []
    if not isinstance(data, list):
        return []
    out: list[dict] = []
    seen_titles: set[str] = set()
    for item in data:
        norm = _normalize_item(item)
        if norm and norm["title"] not in seen_titles:
            seen_titles.add(norm["title"])
            out.append(norm)
        if len(out) >= 4:
            break
    return out


async def _generate_topics() -> list[dict]:
    """让 GPT-4o 生成 4 条贴近时下的讨论议题，结构化 JSON 输出."""
    now_str = get_current_datetime_str()
    system = (
        f"你是讨论话题策划助理。当前时间：{now_str}。\n"
        "请基于本周/本月内开发者圈、AI 圈、科技圈最热的真实话题（新发布的库/产品、行业辩论、技术事件、社会议题等），"
        "生成 4 条用户最可能想拉多个 AI 模型一起讨论的开放式议题。\n\n"
        "严格要求：\n"
        "1. 标题 8 到 24 个字，要有讨论张力（带问号或对比），避免平淡\n"
        "2. 必须体现「近期」时效性，避免 GPT-3.5、ChatGPT 4.0 这类过时引用\n"
        "3. 形式要多样：technology / debate / creative / society 各 1 条\n"
        "4. 每条提供一个匹配的 emoji，以及一句 8-14 字的简短标签 hint\n\n"
        "输出格式：直接输出 JSON 数组，4 个对象，每个对象包含 emoji/title/hint 三个字段，不要任何额外解释或代码围栏：\n"
        "[\n"
        "  {\"emoji\": \"🤖\", \"title\": \"...\", \"hint\": \"...\"},\n"
        "  {\"emoji\": \"🏗️\", \"title\": \"...\", \"hint\": \"...\"},\n"
        "  {\"emoji\": \"💡\", \"title\": \"...\", \"hint\": \"...\"},\n"
        "  {\"emoji\": \"🌍\", \"title\": \"...\", \"hint\": \"...\"}\n"
        "]"
    )
    messages = [{"role": "user", "content": "请直接输出 JSON 数组。"}]

    text = await complete_chat(GENERATOR_MODEL, messages, system, user_id=None)
    parsed = _parse_topic_objects(text)
    if len(parsed) >= 4:
        return parsed[:4]
    if parsed:
        # 不足 4 条用 default 补齐
        topup = [t for t in DEFAULT_TOPIC_OBJECTS if t["title"] not in {p["title"] for p in parsed}]
        return (parsed + topup)[:4]
    logger.warning("Topics empty after parse, raw=%r", text[:300])
    return DEFAULT_TOPIC_OBJECTS


async def _get_or_refresh() -> list[dict]:
    """带 TTL + 单飞锁的全局 cache 获取."""
    global _cache
    now = time.time()
    if _cache and (now - _cache[1]) < _TTL_SECONDS:
        return _cache[0]

    async with _lock:
        if _cache and (time.time() - _cache[1]) < _TTL_SECONDS:
            return _cache[0]

        try:
            topics = await asyncio.wait_for(_generate_topics(), timeout=20.0)
        except Exception as e:
            logger.warning("Trending generation failed: %s", e)
            # 短缓存 5 分钟，避免连续打挂
            _cache = (DEFAULT_TOPIC_OBJECTS, now - _TTL_SECONDS + 300)
            return DEFAULT_TOPIC_OBJECTS

        _cache = (topics, time.time())
        return topics


@router.get("/trending-topics")
async def trending_topics(
    refresh: bool = Query(False, description="忽略缓存强制重新生成"),
):
    """返回 4 条近期热门讨论话题（全局共享，每小时刷新）.

    返回字段：
    - topics: 简单字符串数组（向后兼容 ChatPage 旧版）
    - topics_full: 完整对象数组 [{emoji, title, hint}, ...]
    """
    global _cache
    if refresh:
        _cache = None

    objs = await _get_or_refresh()
    return {
        "topics": [o["title"] for o in objs],
        "topics_full": objs,
        "generated_at": _cache[1] if _cache else 0,
        "ttl_seconds": _TTL_SECONDS,
    }
