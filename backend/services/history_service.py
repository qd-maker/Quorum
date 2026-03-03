"""Supabase 历史记录服务（带用户隔离）."""

from datetime import datetime
from supabase import create_client, Client

from config import get_settings

# 使用 service_role key 操作 DB，绕过 RLS，手动过滤 user_id
_db_client: Client | None = None


def _get_db() -> Client:
    global _db_client
    if _db_client is None:
        s = get_settings()
        _db_client = create_client(s.SUPABASE_URL, s.SUPABASE_SERVICE_KEY)
    return _db_client


# ─── 会话 CRUD ────────────────────────────────────────

async def list_sessions(user_id: str, limit: int = 30) -> list[dict]:
    """获取用户自己的会话列表."""
    db = _get_db()
    res = db.table("sessions") \
        .select("id, type, title, preview, model, topic, created_at") \
        .eq("user_id", user_id) \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()
    return res.data


async def create_session(
    user_id: str,
    session_type: str,
    title: str = "",
    preview: str = "",
    model: str | None = None,
    topic: str | None = None,
) -> dict:
    """创建新会话（绑定 user_id）."""
    db = _get_db()
    data = {
        "user_id": user_id,
        "type": session_type,
        "title": title,
        "preview": preview,
    }
    if model:
        data["model"] = model
    if topic:
        data["topic"] = topic

    res = db.table("sessions").insert(data).execute()
    return res.data[0]


async def update_session(session_id: str, user_id: str, **kwargs) -> dict:
    """更新会话字段（校验归属权）."""
    db = _get_db()
    kwargs["updated_at"] = datetime.utcnow().isoformat()
    res = db.table("sessions").update(kwargs) \
        .eq("id", session_id).eq("user_id", user_id).execute()
    return res.data[0] if res.data else {}


async def get_session(session_id: str, user_id: str) -> dict | None:
    """获取单个会话（校验归属权）."""
    db = _get_db()
    res = db.table("sessions").select("*") \
        .eq("id", session_id).eq("user_id", user_id).execute()
    return res.data[0] if res.data else None


async def delete_session(session_id: str, user_id: str) -> None:
    """删除会话（校验归属权）."""
    db = _get_db()
    db.table("sessions").delete() \
        .eq("id", session_id).eq("user_id", user_id).execute()


# ─── 消息 CRUD ────────────────────────────────────────

async def save_messages(session_id: str, messages: list[dict]) -> None:
    """批量保存消息."""
    if not messages:
        return
    db = _get_db()
    rows = []
    for msg in messages:
        row = {
            "session_id": session_id,
            "role": msg.get("role", "model"),
            "content": msg.get("content", ""),
        }
        if msg.get("model"):
            row["model"] = msg["model"]
        if msg.get("round") is not None:
            row["round"] = msg["round"]
        rows.append(row)
    db.table("messages").insert(rows).execute()


async def replace_messages(session_id: str, messages: list[dict]) -> None:
    """全量替换会话消息（先删后插）."""
    db = _get_db()
    db.table("messages").delete().eq("session_id", session_id).execute()
    if not messages:
        return
    rows = []
    for msg in messages:
        row = {
            "session_id": session_id,
            "role": msg.get("role", "model"),
            "content": msg.get("content", ""),
        }
        if msg.get("model"):
            row["model"] = msg["model"]
        if msg.get("round") is not None:
            row["round"] = msg["round"]
        rows.append(row)
    db.table("messages").insert(rows).execute()


async def get_messages(session_id: str) -> list[dict]:
    """获取会话的所有消息."""
    db = _get_db()
    res = db.table("messages") \
        .select("*") \
        .eq("session_id", session_id) \
        .order("created_at") \
        .execute()
    return res.data
