"""群聊讨论编排器 — Round 1 并发 → Round 2 并发 → 多方共识生成.

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


def _round1_system(model: str, topic: str, search_ctx: str = "", role: str = "") -> str:
    name, company = _get_model_identity(model)
    now_str = get_current_datetime_str()
    search_block = f"\n\n【实时搜索参考】\n{search_ctx}" if search_ctx else ""
    role_block = f"\n你是「{role}」，请严格以此身份参与讨论并发表观点。" if role else ""
    return (
        f"你是 {name}，由 {company} 开发。你正在参与一个多模型 AI 群聊。{role_block}\n"
        f"当前时间：{now_str}\n"
        f"讨论议题：{topic}\n"
        f"{search_block}\n"
        "【称呼规范】自称为「我」，称呼其他模型为「GPT」「Gemini」「Grok」或「DeepSeek」，坚决省略版本号。\n"
        "讨论风格：保持你自身（及特定角色）的特点和立场，观点应鲜明且具有差异化。\n"
        '输出要求：直接回应议题，不要模棱两可，要有真实立场。\n'
        "若上方有搜索结果，请务必引用并注明真实来源以增强观点的可信度。\n"
        "篇幅：250-450字。"
    )


def _round2_system(model: str, topic: str, others: dict[str, str], role: str = "") -> str:
    name, company = _get_model_identity(model)
    now_str = get_current_datetime_str()
    role_block = f"\n你是「{role}」，请继续以此身份参与互动。" if role else ""
    other_views = "\n\n".join(
        f"【{_get_base_name(m)} 的观点】\n{text}"
        for m, text in others.items()
    )
    return (
        f"你是 {name}，由 {company} 开发。你正在参与群聊讨论的第 2 轮互动。{role_block}\n"
        f"当前时间：{now_str}\n"
        f"讨论议题：{topic}\n\n"
        f"以下是其他模型在前一轮的观点：\n\n{other_views}\n\n"
        "【称呼规范】一律只称呼系列名称（GPT, Gemini, Grok, DeepSeek），不带版本号。\n"
        "任务：请具体回应、引用、赞同或有理有据地反驳其他模型的观点，展现深度互动。\n"
        "篇幅：250-450字。"
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
    roles: dict[str, str] = {},
    use_search: bool = False,
    image: str | None = None,
) -> AsyncGenerator[str, None]:
    """执行完整讨论流程，yield SSE 格式字符串."""

    queue: asyncio.Queue[str | None] = asyncio.Queue()
    all_views: dict[str, list[str]] = {m: [] for m in models}
    model_errors: dict[str, str] = {}  # 记录报错的模型及原因

    # ── 搜索预处理 ──────────────────────────────────
    search_ctx = ""
    results: list[dict] = []
    # 仅在明确开启 search 时搜索
    if use_search:
        logger.info(f"Triggering web search for topic: {topic[:50]}")
        try:
            results = await search_web(topic, max_results=5)
            search_ctx = format_search_context(results, topic)
            if search_ctx:
                logger.info(f"Search returned {len(results)} results")
        except Exception as e:
            logger.warning(f"Search failed: {e}")
        
        # 传递搜索精简结果供前端显示
        simplified_results = [{"title": r.get("title"), "url": r.get("href")} for r in results if r.get("title")]
        yield _sse({"type": "search_done", "has_results": bool(search_ctx), "sources": simplified_results})

    # ── Round 1：并行 ──────────────────────────────

    yield _sse({"type": "round_start", "round": 1})

    async def _stream_model_r1(model: str):
        """单个模型的 Round 1 流式输出，推入 queue."""
        accumulated = ""
        try:
            role_desc = roles.get(model, "")
            system = _round1_system(model, topic, search_ctx, role_desc)
            # 图片仅在 Round 1 传入（Vision API 格式）
            if image:
                user_content: str | list = [
                    {"type": "text", "text": topic},
                    {"type": "image_url", "image_url": {"url": image}},
                ]
            else:
                user_content = topic
            messages = [{"role": "user", "content": user_content}]
            async for chunk in stream_chat(model, messages, system):
                accumulated += chunk
                await queue.put(
                    _sse({"type": "model_chunk", "model": model, "round": 1, "content": chunk})
                )
            
            if not accumulated.strip():
                raise ValueError("API 正常返回但未产生任何有效内容 (空回复)")

            all_views[model].append(accumulated)
            await queue.put(
                _sse({"type": "model_done", "model": model, "round": 1})
            )
        except Exception as e:
            logger.exception(f"Round 1 error for {model}")
            err_msg = str(e)
            model_errors[model] = err_msg
            await queue.put(
                _sse({"type": "model_error", "model": model, "round": 1, "error": err_msg})
            )
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

    # ── Round 2：并发 ──────────────────────────────

    if rounds >= 2:
        yield _sse({"type": "round_start", "round": 2})

        async def _stream_model_r2(model: str):
            """单个模型的 Round 2 流式输出，推入 queue."""
            accumulated = ""
            try:
                others = {m: all_views[m][0] for m in models if m != model and all_views[m]}
                role_desc = roles.get(model, "")
                system = _round2_system(model, topic, others, role_desc)
                messages = [{"role": "user", "content": f"请回应其他模型并深化讨论议题「{topic}」。"}]

                async for chunk in stream_chat(model, messages, system):
                    accumulated += chunk
                    await queue.put(
                        _sse({"type": "model_chunk", "model": model, "round": 2, "content": chunk})
                    )
                
                if not accumulated.strip():
                    raise ValueError("API 正常返回但未产生任何有效内容 (空回复)")

                all_views[model].append(accumulated)
                await queue.put(
                    _sse({"type": "model_done", "model": model, "round": 2})
                )
            except Exception as e:
                logger.exception(f"Round 2 error for {model}")
                err_msg = str(e)
                if model not in model_errors:
                    model_errors[model] = err_msg
                await queue.put(
                    _sse({"type": "model_error", "model": model, "round": 2, "error": err_msg})
                )
                await queue.put(
                    _sse({"type": "model_done", "model": model, "round": 2})
                )

        try:
            # 启动并发任务
            tasks_r2 = [asyncio.create_task(_stream_model_r2(m)) for m in models]

            done_count_r2 = 0
            target_done_r2 = len(models)

            while done_count_r2 < target_done_r2:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=10.0)
                except asyncio.TimeoutError:
                    # 心跳
                    yield ": heartbeat\n\n"
                    continue

                if event is None:
                    continue
                yield event

                # 计数 model_done
                if '"type": "model_done"' in event:
                    done_count_r2 += 1

            # 确保所有任务完成
            await asyncio.gather(*tasks_r2, return_exceptions=True)
            
        except Exception as e:
            logger.exception(f"Round 2 fatal error: {e}")

    # ── Phase 1：观点总结（每个模型总结自己的核心观点，并发执行）──────

    try:
        yield _sse({"type": "consensus_phase", "phase": "summarizing"})
        model_summaries: dict[str, str] = {}

        async def _summarize_model(model: str) -> tuple[str, str]:
            # 跳过报错的模型
            if model in model_errors:
                logger.info(f"Skipping summary for errored model {_get_base_name(model)}")
                return model, ""
            base_name = _get_base_name(model)
            views = all_views.get(model, [])
            if not views or all(not v.strip() for v in views):
                logger.warning(f"No views for {base_name}, skipping summary")
                return model, ""

            # 把该模型的发言拼成 user message
            view_parts = []
            for i, text in enumerate(views, 1):
                view_parts.append(f"【第{i}轮发言】\n{text}")
            view_text = "\n\n".join(view_parts)

            system = _summarize_system(model, topic)
            messages = [{"role": "user", "content": view_text}]

            try:
                summary = await complete_chat(model, messages, system)
                logger.info(f"  {base_name} summary: {len(summary)} chars")
                return model, summary
            except Exception:
                # 总结失败时用原始发言的首段兜底
                logger.warning(f"Summary failed for {base_name}, using truncated original")
                return model, views[0][:300] + ("…" if len(views[0]) > 300 else "")

        # 启动所有的总结任务
        summarize_tasks = [asyncio.create_task(_summarize_model(m)) for m in models]
        
        # 使用 wait 管理任务完成和心跳
        while summarize_tasks:
            done, pending = await asyncio.wait(
                summarize_tasks, 
                timeout=5.0, 
                return_when=asyncio.FIRST_COMPLETED
            )
            
            for task in done:
                try:
                    m, s = task.result()
                    if s:
                        model_summaries[m] = s
                except Exception as e:
                    logger.exception(f"Summarize task error: {e}")
                    
            summarize_tasks = list(pending)
            if summarize_tasks:
                yield ": heartbeat\n\n"

    except Exception as e:
        logger.exception(f"Summarization phase fatal error: {e}")
        # 兜底：如果总结阶段完全崩溃，用原始发言截断作为总结
        if not model_summaries:
            model_summaries = {}
            for model in models:
                views = all_views.get(model, [])
                if views and views[0].strip():
                    model_summaries[model] = views[0][:300] + ("…" if len(views[0]) > 300 else "")

    # ── Phase 2：共识合成 ─────────────────────────────────

    try:
        yield _sse({"type": "consensus_phase", "phase": "synthesizing"})
        consensus_system = _consensus_system(topic)
        consensus_msgs = _build_consensus_messages(topic, model_summaries, search_ctx)
        total_chars = sum(len(m["content"]) for m in consensus_msgs)
        logger.info(f"Consensus payload: {len(model_summaries)} summaries, {total_chars} total chars")
        consensus_generated = False

        # 优先用未报错的模型生成共识
        healthy_models = [m for m in models if m not in model_errors]
        fallback_models = [m for m in models if m in model_errors]
        for consensus_model in healthy_models + fallback_models:
            try:
                logger.info(f"Trying consensus generation with {consensus_model}")
                consensus_text = await complete_chat(consensus_model, consensus_msgs, consensus_system)
                if consensus_text and consensus_text.strip():
                    logger.info(f"Consensus generated with {consensus_model}, chars={len(consensus_text)}")
                    yield _sse({"type": "consensus_chunk", "content": consensus_text})
                    consensus_generated = True
                    break
                else:
                    logger.warning(f"Consensus returned empty text with {consensus_model}, trying next model...")
                    continue
            except Exception:
                logger.warning(f"Consensus failed with {consensus_model}, trying next model...")
                continue

        if not consensus_generated:
            logger.error("All consensus models failed or returned empty output")
            yield _sse({"type": "consensus_chunk", "content": "[共识生成失败：所有候选模型都未返回有效内容，请重试或检查模型配置]"})
    except Exception as e:
        logger.exception(f"Consensus phase fatal error: {e}")
        yield _sse({"type": "consensus_chunk", "content": f"[共识生成异常: {e}]"})

    # 发送错误摘要（如有）
    if model_errors:
        error_list = [
            {"model": m, "error": e} for m, e in model_errors.items()
        ]
        yield _sse({"type": "errors_summary", "errors": error_list})

    yield _sse({"type": "done"})


# ─── 追问编排 ─────────────────────────────────────────

async def run_followup(
    question: str,
    topic: str,
    context: str,
    models: list[str],
    image: str | None = None,
    use_search: bool = False,
) -> AsyncGenerator[str, None]:
    """基于完整讨论上下文，以主持人身份回答用户追问."""
    system = _followup_system(topic)
    # 追问内容：若有图片则使用 Vision 格式
    if image:
        question_content: str | list = [
            {"type": "text", "text": question},
            {"type": "image_url", "image_url": {"url": image}},
        ]
    else:
        question_content = question

    search_ctx = ""
    if use_search and question:
        try:
            results = await search_web(question, max_results=3)
            search_ctx = format_search_context(results, question)
        except Exception as e:
            logger.warning(f"Search failed in followup: {e}")
            
    # 将搜索结果附加到上下文中
    context_str = f"以下是关于「{topic}」的完整讨论记录（含共识）：\n\n{context}"
    if search_ctx:
        context_str += f"\n\n{search_ctx}"

    messages = [
        {"role": "user", "content": context_str},
        {"role": "assistant", "content": "已了解完整讨论内容和共识。请问有什么追问？"},
        {"role": "user", "content": question_content},
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
