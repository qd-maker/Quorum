"""搜索服务 — 为讨论议题提供实时网络信息注入.

策略：
1. 优先 Tavily（有 key 时）：topic=news + advanced 深度，结果质量最高
2. 无 Tavily key 时用 DuckDuckGo（同时尝试英文查询）
3. 所有引擎失败时静默跳过搜索
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


# ─── Tavily（主力，新闻类最准） ───────────────────────────

def _sync_tavily_search(
    query: str, max_results: int, api_key: str, topic: str = "news"
) -> list[dict]:
    """同步执行 Tavily 搜索，返回与 DDG 格式兼容的结果列表。"""
    try:
        import httpx
        payload = {
            "api_key": api_key,
            "query": query,
            "max_results": max_results,
            "search_depth": "advanced",
            "include_answer": True,
            "topic": topic,          # "news" 专门检索新闻源
        }
        resp = httpx.post(
            "https://api.tavily.com/search",
            json=payload,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        results = []
        # 如果有 answer 字段，插到最前面
        if data.get("answer"):
            results.append({
                "title": "Tavily 综合摘要",
                "body": data["answer"],
                "href": "",
            })
        for r in data.get("results", []):
            results.append({
                "title": r.get("title", ""),
                "body": r.get("content", ""),
                "href": r.get("url", ""),
            })
        return results
    except Exception as e:
        logger.warning(f"Tavily search failed (query={query!r}): {e}")
        return []


# ─── DuckDuckGo（备用） ──────────────────────────────────

def _sync_ddg_search(query: str, max_results: int) -> list[dict]:
    """同步执行 DuckDuckGo 搜索。"""
    try:
        from duckduckgo_search import DDGS
        with DDGS(timeout=8) as ddgs:
            return list(ddgs.text(
                query,
                region="wt-wt",      # 全球区域，避免中文区跑偏
                safesearch="off",
                max_results=max_results,
            ))
    except Exception as e:
        logger.warning(f"DuckDuckGo search failed: {e}")
        return []


# ─── 统一搜索入口 ────────────────────────────────────────

def _is_news_topic(query: str) -> bool:
    """判断是否应使用新闻搜索模式。"""
    news_kws = [
        "战争", "战事", "局势", "冲突", "事件", "发生", "爆发", "进展",
        "新闻", "政策", "选举", "制裁", "外交", "军事", "袭击", "谈判",
    ]
    return any(kw in query for kw in news_kws)


async def search_web(query: str, max_results: int = 6) -> list[dict]:
    """
    异步搜索：
    - 有 Tavily key → 优先 Tavily news 模式，同时并行查一次英文
    - 无 Tavily key → DuckDuckGo（中文 + 英文双语）
    """
    from config import get_settings
    loop = asyncio.get_event_loop()
    settings = get_settings()

    if settings.TAVILY_API_KEY:
        topic = "news" if _is_news_topic(query) else "general"
        logger.info(f"Tavily search [{topic}]: {query[:60]}")

        # 并行：中文查询 + 英文查询（新闻英文效果更好）
        en_query = _to_english_hint(query)
        tasks = [
            loop.run_in_executor(
                None, _sync_tavily_search, query, max_results, settings.TAVILY_API_KEY, topic
            ),
        ]
        if en_query and en_query != query:
            tasks.append(loop.run_in_executor(
                None, _sync_tavily_search, en_query, max_results, settings.TAVILY_API_KEY, topic
            ))

        all_results = await asyncio.gather(*tasks, return_exceptions=True)
        merged = []
        seen_hrefs: set[str] = set()
        for batch in all_results:
            if isinstance(batch, list):
                for r in batch:
                    href = r.get("href", "")
                    if href not in seen_hrefs:
                        seen_hrefs.add(href)
                        merged.append(r)
        if merged:
            logger.info(f"Tavily returned {len(merged)} results (merged)")
            return merged[:max_results + 2]  # 略多一点，格式化时截断

    # Fallback: DuckDuckGo
    logger.info(f"DuckDuckGo search: {query[:60]}")
    results = await loop.run_in_executor(None, _sync_ddg_search, query, max_results)
    if not results:
        # 再试英文
        en_query = _to_english_hint(query)
        if en_query and en_query != query:
            results = await loop.run_in_executor(None, _sync_ddg_search, en_query, max_results)
    if results:
        logger.info(f"DuckDuckGo returned {len(results)} results")
        return results

    logger.warning("All search backends returned no results")
    return []


def _to_english_hint(query: str) -> str:
    """
    简单的中→英关键词替换，提升新闻搜索命中率。
    仅做关键词级别，不做翻译。
    """
    replacements = {
        "美国": "United States",
        "伊朗": "Iran",
        "以色列": "Israel",
        "俄罗斯": "Russia",
        "乌克兰": "Ukraine",
        "战争": "war",
        "冲突": "conflict",
        "军事": "military",
        "袭击": "attack",
        "制裁": "sanctions",
        "外交": "diplomacy",
        "谈判": "negotiations",
        "选举": "election",
        "发生什么": "news",
        "最新": "latest",
        "2026年": "2026",
        "2025年": "2025",
        "2月": "February",
        "3月": "March",
    }
    result = query
    for zh, en in replacements.items():
        result = result.replace(zh, en)
    # 如果没有任何替换，返回空（避免重复搜索相同中文）
    return result if result != query else ""


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
                lines.append(body[:600] + ("…" if len(body) > 600 else ""))
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
