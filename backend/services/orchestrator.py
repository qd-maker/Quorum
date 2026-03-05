"""群聊讨论编排器 — Round 1 并行 → Round 2 串行 → 共识生成.

通过 asyncio.Queue 保证并行推送的 SSE 事件有序。
"""

import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator

from services.model_service import stream_chat, complete_chat, MODEL_NAME_MAP
from services.search_service import (
    get_current_datetime_str,
    search_web,
    format_search_context,
    needs_search,
)

logger = logging.getLogger(__name__)

# ─── System Prompt 模板 ───────────────────────────────

# 前端 ID → 公司（固定，不随模型版本变化）
_PROVIDER = {
    "gpt-4o": "OpenAI",
    "gemini-2.0-flash": "Google",
    "grok-2": "xAI",
    "deepseek-chat": "DeepSeek",
}


def _get_model_identity(frontend_id: str) -> tuple[str, str]:
    """动态返回模型名称和公司。
    名称从 MODEL_NAME_MAP 读取（跟随用户设置），公司固定。
    """
    actual_name = MODEL_NAME_MAP.get(frontend_id, frontend_id)
    company = _PROVIDER.get(frontend_id, "Unknown")
    return actual_name, company


def _get_base_name(frontend_id: str) -> str:
    """获取模型的大类名称，用于讨论中互相称呼。"""
    mapping = {
        "gpt-4o": "GPT",
        "gemini-2.0-flash": "Gemini",
        "grok-2": "Grok",
        "deepseek-chat": "DeepSeek"
    }
    return mapping.get(frontend_id, frontend_id)


def _round1_system(model: str, topic: str, search_ctx: str = "") -> str:
    name, company = _get_model_identity(model)
    base_name = _get_base_name(model)
    now_str = get_current_datetime_str()
    search_block = f"\n\n{search_ctx}" if search_ctx else ""
    return (
        f"你是 {name}，由 {company} 开发。你正在参与一场多AI模型的群聊讨论。\n"
        f"当前时间：{now_str}\n"
        f"讨论议题：{topic}\n"
        f"{search_block}\n"
        "【称呼规范】为了让讨论更加自然，请在发言时自称为「我」，称呼其他模型为「GPT」「Gemini」「Grok」或「DeepSeek」，坚决省略具体的版本号（如 4o, 1.5-pro, 2.0-flash 等）。\n"
        "讨论风格：保持你自身的特点和立场，可以与其他模型观点有分歧。\n"
        '输出要求：直接回应议题，不要说"作为一个AI我没有观点"，要有真实立场。\n'
        "若议题涉及近期事件，请结合上方搜索结果（如有）进行分析，并注明信息来源。\n"
        "篇幅：200-400字，观点鲜明，结构清晰。"
    )


def _round2_system(model: str, topic: str, others: dict[str, str]) -> str:
    name, company = _get_model_identity(model)
    base_name = _get_base_name(model)
    now_str = get_current_datetime_str()
    other_views = "\n\n".join(
        f"【{_get_base_name(m)} 的观点】\n{text}"
        for m, text in others.items()
    )
    return (
        f"你是 {name}，由 {company} 开发。你正在参与一场多AI模型的群聊讨论的第二轮。\n"
        f"当前时间：{now_str}\n"
        f"讨论议题：{topic}\n\n"
        f"以下是其他模型在第一轮的观点：\n\n{other_views}\n\n"
        "【称呼规范】在引用或评价其他模型时，一律只称呼它们的系列名称（如 GPT, Gemini, Grok, DeepSeek），坚决不要带上具体版本号（如 4o, 2.0-flash 等）。\n"
        "请在回应中具体引用并反驳或赞同其他模型的观点。\n"
        "篇幅：200-400字。"
    )


def _consensus_system(topic: str) -> str:
    """共识生成的 system prompt — 仅角色指令，不含讨论内容。"""
    now_str = get_current_datetime_str()
    return (
        f"你是一位中立的讨论主持人。当前时间：{now_str}\n"
        "你的任务是基于对话历史中各模型的实际发言，生成一份简洁的共识摘要。\n\n"
        "要求：\n"
        "1. 提炼各方真实观点中的共同认知\n"
        "2. 指出主要分歧点（如有）\n"
        "3. 给出综合结论\n\n"
        "【称呼规范】一律只写大类名称（GPT/Gemini/Grok/DeepSeek），不要出现版本号。\n"
        "重要：必须引用对话历史中的实际观点作答，语气客观精炼，300字左右，中文回复。"
    )


def _summarize_system(model: str, topic: str) -> str:
    """让模型总结自己在讨论中的核心观点。"""
    base_name = _get_base_name(model)
    return (
        f"你是 {base_name}。你刚刚参与了一场关于「{topic}」的多AI讨论。\n"
        "以下对话历史中是你在两轮讨论中的完整发言记录。\n\n"
        "请用 100-150 字总结你的核心观点：\n"
        "1. 你的主要立场是什么\n"
        "2. 你最关键的论据/依据\n"
        "3. 你与其他模型的分歧点（如有）\n\n"
        "要求：观点鲜明，不要含糊其辞，不要说'作为AI我没有观点'。\n"
        "直接输出总结，不要加标题或前缀。"
    )


def _build_consensus_messages(
    topic: str,
    model_summaries: dict[str, str],
    search_ctx: str = "",
) -> list[dict]:
    """基于各模型的观点总结，构建共识生成的 user message。

    输入是经过总结压缩后的观点（每个约 100-150 字），
    总量控制在 500-700 字，不会被任何代理截断。
    """
    parts: list[str] = []
    parts.append(f"# 讨论议题：「{topic}」\n")

    if search_ctx:
        parts.append(search_ctx)

    parts.append("---\n## 各模型观点总结\n")
    for model, summary in model_summaries.items():
        base = _get_base_name(model)
        parts.append(f"### {base} 的核心观点：\n{summary}\n")

    parts.append(
        f"---\n\n以上是各模型关于「{topic}」的核心观点总结。\n"
        "请基于以上各方观点，生成共识摘要。"
    )

    return [{"role": "user", "content": "\n".join(parts)}]


def _followup_system(topic: str) -> str:
    """追问的 system prompt — 仅角色指令，讨论上下文通过 messages 传入。"""
    now_str = get_current_datetime_str()
    return (
        f"你是一位中立的讨论主持人。当前时间：{now_str}\n"
        "对话历史中包含多个AI模型的完整讨论记录和共识。\n"
        "请以主持人身份，基于讨论内容回应用户的追问。\n"
        "要求：回答须贴合实际讨论内容，客观中立，200-400字，中文回复。"
    )


# ─── SSE 事件辅助 ─────────────────────────────────────

def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


# ─── 核心编排 ─────────────────────────────────────────

async def run_discussion(
    topic: str,
    models: list[str],
    rounds: int = 2,
) -> AsyncGenerator[str, None]:
    """执行完整讨论流程，yield SSE 格式字符串."""

    queue: asyncio.Queue[str | None] = asyncio.Queue()
    all_views: dict[str, list[str]] = {m: [] for m in models}

    # ── 搜索预处理（并行，不阻塞讨论启动）────────────────
    search_ctx = ""
    if needs_search(topic):
        logger.info(f"Triggering web search for topic: {topic[:50]}")
        results = await search_web(topic, max_results=5)
        search_ctx = format_search_context(results, topic)
        if search_ctx:
            logger.info(f"Search returned {len(results)} results")
        yield _sse({"type": "search_done", "has_results": bool(search_ctx)})

    # ── Round 1：并行 ──────────────────────────────

    yield _sse({"type": "round_start", "round": 1})

    async def _stream_model_r1(model: str):
        """单个模型的 Round 1 流式输出，推入 queue."""
        accumulated = ""
        try:
            system = _round1_system(model, topic, search_ctx)
            messages = [{"role": "user", "content": topic}]
            async for chunk in stream_chat(model, messages, system):
                accumulated += chunk
                await queue.put(
                    _sse({"type": "model_chunk", "model": model, "round": 1, "content": chunk})
                )
            all_views[model].append(accumulated)
            await queue.put(
                _sse({"type": "model_done", "model": model, "round": 1})
            )
        except Exception as e:
            logger.exception(f"Round 1 error for {model}")
            all_views[model].append(accumulated or f"[错误: {e}]")
            await queue.put(
                _sse({"type": "model_done", "model": model, "round": 1})
            )

    # 启动并行任务
    tasks = [asyncio.create_task(_stream_model_r1(m)) for m in models]

    # 心跳 + 消费 queue
    done_count = 0
    target_done = len(models)  # 每个模型产生一个 model_done
    last_yield = time.monotonic()

    while done_count < target_done:
        try:
            event = await asyncio.wait_for(queue.get(), timeout=10.0)
        except asyncio.TimeoutError:
            # 心跳
            yield ": heartbeat\n\n"
            last_yield = time.monotonic()
            continue

        if event is None:
            continue
        yield event
        last_yield = time.monotonic()

        # 计数 model_done
        if '"type": "model_done"' in event:
            done_count += 1

    # 确保所有任务完成
    await asyncio.gather(*tasks, return_exceptions=True)

    # ── Round 2：串行 ──────────────────────────────

    if rounds >= 2:
        yield _sse({"type": "round_start", "round": 2})

        for model in models:
            others = {m: all_views[m][0] for m in models if m != model and all_views[m]}
            system = _round2_system(model, topic, others)
            messages = [{"role": "user", "content": f"请回应其他模型关于「{topic}」的观点。"}]

            accumulated = ""
            try:
                async for chunk in stream_chat(model, messages, system):
                    accumulated += chunk
                    yield _sse({"type": "model_chunk", "model": model, "round": 2, "content": chunk})
                all_views[model].append(accumulated)
            except Exception as e:
                logger.exception(f"Round 2 error for {model}")
                all_views[model].append(accumulated or f"[错误: {e}]")

            yield _sse({"type": "model_done", "model": model, "round": 2})

    # ── Phase 1：观点总结（每个模型总结自己的核心观点）──────

    yield _sse({"type": "consensus_phase", "phase": "summarizing"})
    model_summaries: dict[str, str] = {}

    for model in models:
        base_name = _get_base_name(model)
        views = all_views.get(model, [])
        if not views or all(not v.strip() for v in views):
            logger.warning(f"No views for {base_name}, skipping summary")
            continue

        # 把该模型的发言拼成 user message
        view_parts = []
        for i, text in enumerate(views, 1):
            view_parts.append(f"【第{i}轮发言】\n{text}")
        view_text = "\n\n".join(view_parts)

        system = _summarize_system(model, topic)
        messages = [{"role": "user", "content": view_text}]

        try:
            summary = await complete_chat(model, messages, system)
            model_summaries[model] = summary
            logger.info(f"  {base_name} summary: {len(summary)} chars")
        except Exception:
            # 总结失败时用原始发言的首段兜底
            logger.warning(f"Summary failed for {base_name}, using truncated original")
            model_summaries[model] = views[0][:300] + ("…" if len(views[0]) > 300 else "")

    # ── Phase 2：共识合成 ─────────────────────────────────

    yield _sse({"type": "consensus_phase", "phase": "synthesizing"})
    consensus_system = _consensus_system(topic)
    consensus_msgs = _build_consensus_messages(topic, model_summaries, search_ctx)
    total_chars = sum(len(m["content"]) for m in consensus_msgs)
    logger.info(f"Consensus payload: {len(model_summaries)} summaries, {total_chars} total chars")
    consensus_generated = False

    for consensus_model in models:
        try:
            async for chunk in stream_chat(consensus_model, consensus_msgs, consensus_system):
                yield _sse({"type": "consensus_chunk", "content": chunk})
            consensus_generated = True
            break  # 成功则退出
        except Exception:
            logger.warning(f"Consensus failed with {consensus_model}, trying next model...")
            continue

    if not consensus_generated:
        yield _sse({"type": "consensus_chunk", "content": "[所有模型共识生成均失败，请检查 API 配置]"})

    yield _sse({"type": "done"})


# ─── 追问编排 ─────────────────────────────────────────

async def run_followup(
    question: str,
    topic: str,
    context: str,
    models: list[str],
) -> AsyncGenerator[str, None]:
    """基于完整讨论上下文，以主持人身份回答用户追问."""
    system = _followup_system(topic)
    # 讨论上下文放入 messages，而非 system prompt
    messages = [
        {"role": "user", "content": f"以下是关于「{topic}」的完整讨论记录（含共识）：\n\n{context}"},
        {"role": "assistant", "content": "已了解完整讨论内容和共识。请问有什么追问？"},
        {"role": "user", "content": question},
    ]

    for model in models:
        try:
            async for chunk in stream_chat(model, messages, system):
                yield _sse({"type": "followup_chunk", "content": chunk})
            yield _sse({"type": "followup_done"})
            return
        except Exception:
            logger.warning(f"Followup failed with {model}, trying next...")
            continue

    yield _sse({"type": "followup_chunk", "content": "[追问回复生成失败，请检查 API 配置]"})
    yield _sse({"type": "followup_done"})
