"""测试模型服务对 OpenAI 兼容中转站流式 chunk 的容错。"""

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from services.model_service import _extract_stream_text, _stream_error_message, stream_chat


class _FakeCompletions:
    async def create(self, **kwargs):
        async def _stream():
            yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content="Hi"))])
            yield SimpleNamespace(choices=[SimpleNamespace(delta=None)])
            yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=None))])
            yield SimpleNamespace(choices=[])
            yield {"choices": [{"delta": {"content": " there"}}]}

        return _stream()


class _FakeClient:
    chat = SimpleNamespace(completions=_FakeCompletions())


@pytest.mark.asyncio
async def test_stream_chat_skips_empty_or_null_delta_chunks():
    """中转站结束 chunk 可能 delta=None；应跳过而不是抛 NoneType.content。"""
    cfg = {
        "api_base_url": "https://relay.example.com/v1",
        "api_key": "test-key",
        "models": {"gpt-4o": "gpt-4o"},
    }
    with patch("services.model_service.get_effective_config", return_value=cfg), patch(
        "services.model_service._client_for", return_value=_FakeClient()
    ):
        chunks = [
            chunk
            async for chunk in stream_chat(
                "gpt-4o",
                [{"role": "user", "content": "hello"}],
                user_id="test-user",
            )
        ]

    assert "".join(chunks) == "Hi there"


def test_extract_stream_text_supports_common_relay_chunk_shapes():
    """兼容常见中转站 chunk：dict、message fallback、list content。"""
    assert (
        _extract_stream_text({"choices": [{"delta": {"content": "hello"}}]})
        == "hello"
    )
    assert (
        _extract_stream_text({"choices": [{"delta": None, "message": {"content": "fallback"}}]})
        == "fallback"
    )
    assert (
        _extract_stream_text(
            {
                "choices": [
                    {
                        "delta": {
                            "content": [
                                {"type": "text", "text": "hi"},
                                {"type": "text", "content": " there"},
                            ]
                        }
                    }
                ]
            }
        )
        == "hi there"
    )
    assert _extract_stream_text({"choices": [{"delta": None, "finish_reason": "stop"}]}) == ""


def test_stream_error_message_extracts_relay_error_payload():
    """有些中转站会在 200 流中发送 error 对象，后端应识别成异常。"""
    assert (
        _stream_error_message({"error": {"message": "upstream overloaded"}})
        == "upstream overloaded"
    )
