"""测试 /api/chat 端点 — 流式响应、搜索注入、参数校验。"""

import json
import pytest
from unittest.mock import patch, AsyncMock


# ─── 基础流式聊天 ─────────────────────────────────────

@pytest.mark.asyncio
async def test_chat_stream_basic(test_client, mock_stream_chat):
    """正常流式聊天：返回 SSE 格式、包含 content chunk 和 [DONE]。"""
    async with test_client as client:
        resp = await client.post("/api/chat", json={
            "model": "gpt-4o",
            "messages": [{"role": "user", "content": "你好"}],
        })

    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]

    # 解析 SSE 事件
    lines = resp.text.strip().split("\n\n")
    contents = []
    has_done = False
    for line in lines:
        if line.startswith("data: "):
            payload = line[6:]
            if payload == "[DONE]":
                has_done = True
            else:
                data = json.loads(payload)
                if "content" in data:
                    contents.append(data["content"])

    assert len(contents) > 0, "应该收到至少一个 content chunk"
    assert has_done, "流应该以 [DONE] 结束"
    # mock 返回 "Hello" + " from " + "gpt-4o"
    assert "".join(contents) == "Hello from gpt-4o"


# ─── 带搜索的聊天 ─────────────────────────────────────

@pytest.mark.asyncio
async def test_chat_with_search(test_client, mock_stream_chat, mock_search_web):
    """开启联网搜索时：SSE 中应先发送 sources，再发送 content。"""
    async with test_client as client:
        resp = await client.post("/api/chat", json={
            "model": "gpt-4o",
            "messages": [{"role": "user", "content": "最新新闻"}],
            "use_search": True,
        })

    assert resp.status_code == 200

    lines = resp.text.strip().split("\n\n")
    events = []
    for line in lines:
        if line.startswith("data: ") and line[6:] != "[DONE]":
            events.append(json.loads(line[6:]))

    # 第一个事件应该是 sources
    assert "sources" in events[0], "搜索开启时第一个事件应包含 sources"
    assert len(events[0]["sources"]) > 0

    # 后续事件是 content
    content_events = [e for e in events if "content" in e]
    assert len(content_events) > 0


# ─── 不支持的模型 ─────────────────────────────────────

@pytest.mark.asyncio
async def test_chat_unsupported_model(test_client):
    """请求不支持的模型应返回 400。"""
    async with test_client as client:
        resp = await client.post("/api/chat", json={
            "model": "nonexistent-model",
            "messages": [{"role": "user", "content": "test"}],
        })

    assert resp.status_code == 400
    assert "不支持" in resp.json()["detail"]


# ─── 空消息列表 ───────────────────────────────────────

@pytest.mark.asyncio
async def test_chat_empty_messages(test_client):
    """空 messages 数组应返回 400。"""
    async with test_client as client:
        resp = await client.post("/api/chat", json={
            "model": "gpt-4o",
            "messages": [],
        })

    assert resp.status_code == 400


# ─── Vision 格式消息 ──────────────────────────────────

@pytest.mark.asyncio
async def test_chat_vision_format(test_client, mock_stream_chat):
    """Vision 格式的 user message（list content）应正常处理。"""
    async with test_client as client:
        resp = await client.post("/api/chat", json={
            "model": "gpt-4o",
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": "这张图片是什么？"},
                    {"type": "image_url", "image_url": {"url": "data:image/png;base64,abc"}},
                ],
            }],
        })

    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]
