"""统一限流器 — 优先按 user_id 限流，未登录请求按 IP 限流."""

from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def _user_or_ip(request: Request) -> str:
    """优先用 JWT 中的 user_id 作为限流 key；否则用 IP."""
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        # 不去验证签名，只取 sub 字段做 key（限流 key 不需要保密）
        token = auth.removeprefix("Bearer ").strip()
        try:
            import base64
            import json

            parts = token.split(".")
            if len(parts) >= 2:
                # JWT payload 是 base64url，需 padding
                payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
                payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode("utf-8"))
                sub = payload.get("sub")
                if sub:
                    return f"user:{sub}"
        except Exception:
            pass
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=_user_or_ip, default_limits=[])
