"""测试群聊讨论编排器 — 核心流程、容错机制、共识生成。"""

import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock


# ─── 辅助函数 ─────────────────────────────────────────

def parse_sse_events(text: str) -> list[dict]:
    """解析 SSE 文本流为事件列表。"""
    events = []
    for line in text.strip().split("\n\n"):
        line = line.strip()
        if line.startswith("data: "):
            payload = line[6:]
            try:
                events.append(json.loads(payload))
            except json.JSONDecodeError:
                pass  # 跳过心跳等非 JSON 行
        elif line.startswith(": heartbeat"):
            events.append({"type": "heartbeat"})
    return events


# ─── 完整讨论流程（2轮 + 共识） ──────────────────────

@pytest.mark.asyncio
async def test_full_discussion_flow():
    """完整讨论流程：Round 1 → Round 2 → 总结 → 共识 → done。"""
    from services.orchestrator import run_discussion

    call_count = {"stream": 0, "complete": 0}

    async def mock_stream(model, messages, system=None):
        call_count["stream"] += 1
        for chunk in [f"[{model}] ", "这是我的观点。"]:
            yield chunk

    async def mock_complete(model, messages, system=None):
        call_count["complete"] += 1
        return f"{model} 的总结：核心论点是..."

    with patch("services.orchestrator.stream_chat", side_effect=mock_stream), \
         patch("services.orchestrator.complete_chat", side_effect=mock_complete):
        events = []
        async for event_str in run_discussion(
            topic="AI是否会取代程序员",
            models=["gpt-4o", "deepseek-chat"],
            rounds=2,
        ):
            if event_str.startswith("data: "):
                try:
                    events.append(json.loads(event_str[6:]))
                except json.JSONDecodeError:
                    pass

    # 验证事件类型完整性
    event_types = [e.get("type") for e in events]
    assert "round_start" in event_types, "应有 round_start 事件"
    assert "model_chunk" in event_types, "应有 model_chunk 事件"
    assert "model_done" in event_types, "应有 model_done 事件"
    assert "consensus_phase" in event_types, "应有 consensus_phase 事件"
    assert "consensus_chunk" in event_types, "应有 consensus_chunk 事件"
    assert "done" in event_types, "应有 done 事件"

    # Round 1 和 Round 2 都应有 round_start
    round_starts = [e for e in events if e.get("type") == "round_start"]
    assert len(round_starts) == 2, "应有 2 个 round_start（R1 + R2）"

    # 每个模型在每轮都应有 model_done
    model_dones = [e for e in events if e.get("type") == "model_done"]
    assert len(model_dones) == 4, "2 模型 × 2 轮 = 4 个 model_done"


# ─── 模型报错容错 ─────────────────────────────────────

@pytest.mark.asyncio
async def test_discussion_model_error_fallback():
    """单个模型报错时不应中断整体流程，其他模型正常完成。"""
    from services.orchestrator import run_discussion

    async def mock_stream(model, messages, system=None):
        if model == "gpt-4o":
            raise Exception("API rate limited")
        for chunk in ["正常回复内容"]:
            yield chunk

    async def mock_complete(model, messages, system=None):
        return f"{model} 总结内容"

    with patch("services.orchestrator.stream_chat", side_effect=mock_stream), \
         patch("services.orchestrator.complete_chat", side_effect=mock_complete):
        events = []
        async for event_str in run_discussion(
            topic="测试容错",
            models=["gpt-4o", "deepseek-chat"],
            rounds=2,
        ):
            if event_str.startswith("data: "):
                try:
                    events.append(json.loads(event_str[6:]))
                except json.JSONDecodeError:
                    pass

    event_types = [e.get("type") for e in events]

    # 应有错误事件
    assert "model_error" in event_types, "报错模型应产生 model_error 事件"
    error_events = [e for e in events if e.get("type") == "model_error"]
    assert any(e.get("model") == "gpt-4o" for e in error_events)

    # 流程应正常结束
    assert "done" in event_types, "即使有模型报错，流程仍应正常结束"

    # 应有错误摘要
    assert "errors_summary" in event_types, "应有 errors_summary 汇总"


# ─── 搜索注入 ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_discussion_with_search():
    """开启搜索时应有 search_done 事件。"""
    from services.orchestrator import run_discussion

    async def mock_stream(model, messages, system=None):
        yield "带搜索的回复"

    async def mock_complete(model, messages, system=None):
        return "总结"

    async def mock_search(query, max_results=5):
        return [{"title": "Test", "body": "Content", "href": "https://example.com"}]

    with patch("services.orchestrator.stream_chat", side_effect=mock_stream), \
         patch("services.orchestrator.complete_chat", side_effect=mock_complete), \
         patch("services.orchestrator.search_web", side_effect=mock_search), \
         patch("services.orchestrator.format_search_context", return_value="搜索结果..."):
        events = []
        async for event_str in run_discussion(
            topic="最新AI趋势",
            models=["gpt-4o"],
            rounds=1,
            use_search=True,
        ):
            if event_str.startswith("data: "):
                try:
                    events.append(json.loads(event_str[6:]))
                except json.JSONDecodeError:
                    pass

    event_types = [e.get("type") for e in events]
    assert "search_done" in event_types, "搜索开启时应有 search_done 事件"
    search_event = next(e for e in events if e.get("type") == "search_done")
    assert search_event["has_results"] is True


# ─── 追问编排 ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_followup_flow():
    """追问应正常返回 followup_chunk 和 followup_done。"""
    from services.orchestrator import run_followup

    async def mock_stream(model, messages, system=None):
        for chunk in ["追问", "回复"]:
            yield chunk

    with patch("services.orchestrator.stream_chat", side_effect=mock_stream):
        events = []
        async for event_str in run_followup(
            question="能详细解释一下吗？",
            topic="AI发展",
            context="之前的讨论内容...",
            models=["gpt-4o"],
        ):
            if event_str.startswith("data: "):
                try:
                    events.append(json.loads(event_str[6:]))
                except json.JSONDecodeError:
                    pass

    event_types = [e.get("type") for e in events]
    assert "followup_chunk" in event_types
    assert "followup_done" in event_types

    chunks = [e["content"] for e in events if e.get("type") == "followup_chunk"]
    assert "".join(chunks) == "追问回复"


# ─── System Prompt 构建测试 ───────────────────────────

def test_round1_system_prompt():
    """Round 1 system prompt 应包含模型身份、议题和时间。"""
    from services.orchestrator import _round1_system

    prompt = _round1_system("gpt-4o", "人工智能的未来")
    assert "OpenAI" in prompt, "应包含公司名"
    assert "人工智能的未来" in prompt, "应包含议题"
    assert "当前时间" in prompt, "应包含时间信息"


def test_round1_system_prompt_with_search():
    """带搜索上下文时 prompt 应包含搜索结果。"""
    from services.orchestrator import _round1_system

    prompt = _round1_system("gpt-4o", "测试", search_ctx="【搜索结果】测试数据")
    assert "搜索" in prompt, "应包含搜索结果"


def test_round1_system_prompt_with_role():
    """带角色设定时 prompt 应包含角色描述。"""
    from services.orchestrator import _round1_system

    prompt = _round1_system("gpt-4o", "测试", role="乐观主义者")
    assert "乐观主义者" in prompt, "应包含角色描述"


def test_consensus_system_prompt():
    """共识 prompt 应包含主持人角色和输出要求。"""
    from services.orchestrator import _consensus_system

    prompt = _consensus_system("AI发展")
    assert "主持人" in prompt
    assert "共识" in prompt


def test_build_consensus_messages():
    """共识消息构建应包含所有模型的总结。"""
    from services.orchestrator import _build_consensus_messages

    messages = _build_consensus_messages(
        topic="测试议题",
        model_summaries={
            "gpt-4o": "GPT的观点总结",
            "deepseek-chat": "DeepSeek的观点总结",
        },
    )

    assert len(messages) == 1
    content = messages[0]["content"]
    assert "GPT" in content
    assert "DeepSeek" in content
    assert "测试议题" in content
