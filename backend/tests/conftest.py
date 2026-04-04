"""Quorum 后端测试配置 — pytest fixtures."""

import sys
import os
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

# 确保 backend 目录在 sys.path 中
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# 在导入 app 之前 mock 掉 Settings，避免需要真实 .env
os.environ.setdefault("API_BASE_URL", "https://test.example.com/v1")
os.environ.setdefault("API_KEY", "test-key-xxx")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-at-least-32-chars-long")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")


@pytest.fixture
def mock_stream_chat():
    """Mock stream_chat 为异步生成器，返回预设文本 chunk。"""
    async def _fake_stream(model, messages, system_prompt=None):
        for chunk in ["Hello", " from ", model]:
            yield chunk

    with patch("routers.chat.stream_chat", side_effect=_fake_stream) as m:
        yield m


@pytest.fixture
def mock_search_web():
    """Mock search_web 返回预设搜索结果。"""
    async def _fake_search(query, max_results=5):
        return [
            {"title": "Test Result", "body": "Test body content", "href": "https://example.com"},
        ]

    with patch("routers.chat.search_web", side_effect=_fake_search) as m:
        yield m


@pytest.fixture
def mock_auth():
    """Mock JWT 认证，返回固定 user_id。"""
    with patch("auth.get_current_user", return_value="test-user-id-123") as m:
        yield m


@pytest.fixture
def test_client():
    """创建 FastAPI TestClient。"""
    from httpx import AsyncClient, ASGITransport
    from main import app
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
