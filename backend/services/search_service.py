"""搜索服务 — 为讨论议题提供实时网络信息注入.

优先使用 DuckDuckGo（免费无 key），失败时自动 fallback 到 Tavily Search API。
结果格式化为可直接注入 system prompt 的文本片段。
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# 中国标准时间 UTC+8
_CST = timezone(timedelta(hours=8))


def get_current_datetime_str() -> str:
    """返回当前时间字符串（CST），用于注入 system prompt。"""
    now = datetime.now(_CST)
    return now.strftime("%Y年%m月%d日 %H:%M（北京时间）")


# ─── DuckDuckGo ──────────────────────────────────────────

def _sync_ddg_search(query: str, max_results: int) -> list[dict]:
    """同步执行 DuckDuckGo 搜索。"""
    try:
        from duckduckgo_search import DDGS
        with DDGS(timeout=8) as ddgs:
            return list(ddgs.text(
                query,
                region="cn-zh",
                safesearch="off",
                max_results=max_results,
            ))
    except Exception as e:
        logger.warning(f"DuckDuckGo search failed: {e}")
        return []


# ─── Tavily ──────────────────────────────────────────────

def _sync_tavily_search(query: str, max_results: int, api_key: str) -> list[dict]:
    """同步执行 Tavily 搜索，返回与 DDG 格式兼容的结果列表。"""
    try:
        import httpx
        resp = httpx.post(
            "https://api.tavily.com/search",
            json={
                "api_key": api_key,
                "query": query,
                "max_results": max_results,
                "search_depth": "basic",
                "include_answer": False,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        results = []
        for r in data.get("results", []):
            results.append({
                "title": r.get("title", ""),
                "body": r.get("content", ""),
                "href": r.get("url", ""),
            })
        return results
    except Exception as e:
        logger.warning(f"Tavily search failed: {e}")
        return []


# ─── 统一搜索入口 ────────────────────────────────────────

async def search_web(query: str, max_results: int = 5) -> list[dict]:
    """异步执行网络搜索：优先 DuckDuckGo，失败 fallback 到 Tavily。"""
    from config import get_settings
    loop = asyncio.get_event_loop()

    # 先尝试 DuckDuckGo
    results = await loop.run_in_executor(None, _sync_ddg_search, query, max_results)
    if results:
        logger.info(f"Search via DuckDuckGo: {len(results)} results")
        return results

    # Fallback: Tavily
    settings = get_settings()
    if settings.TAVILY_API_KEY:
        logger.info("DuckDuckGo returned no results, falling back to Tavily")
        results = await loop.run_in_executor(
            None, _sync_tavily_search, query, max_results, settings.TAVILY_API_KEY
        )
        if results:
            logger.info(f"Search via Tavily: {len(results)} results")
            return results

    logger.warning("All search backends returned no results")
    return []


# ─── 格式化 ──────────────────────────────────────────────

def format_search_context(results: list[dict], query: str) -> str:
    """将搜索结果格式化为可注入 system prompt 的文本块。"""
    if not results:
        return ""

    lines = [f"【网络搜索结果 · 查询词：{query}】"]
    for i, r in enumerate(results, 1):
        title = r.get("title", "").strip()
        body = r.get("body", "").strip()
        href = r.get("href", "")
        if title or body:
            lines.append(f"\n[{i}] {title}")
            if body:
                lines.append(body[:300] + ("…" if len(body) > 300 else ""))
            if href:
                lines.append(f"来源：{href}")
    return "\n".join(lines)


# ─── 关键词判断 ───────────────────────────────────────────

_REALTIME_KEYWORDS = [
    "最新", "最近", "现在", "今天", "今年", "当前", "实时", "新闻",
    "战争", "战事", "局势", "冲突", "事件", "发生", "爆发", "进展",
    "股价", "汇率", "天气", "比赛", "结果", "选举", "政策", "法规",
    "2025", "2026", "2027",
]


def needs_search(topic: str) -> bool:
    """判断议题是否需要实时搜索（启发式规则）。"""
    topic_lower = topic.lower()
    return any(kw in topic_lower for kw in _REALTIME_KEYWORDS)
