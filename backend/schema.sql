-- Many AI: Supabase 表结构
-- 在 Supabase SQL Editor 中执行

-- 先删除旧表（如果存在）
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;

-- 会话表（chat + discuss 共用）
CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,                                 -- 归属用户（Supabase auth.users.id）
  type TEXT NOT NULL CHECK (type IN ('chat', 'discuss')),
  title TEXT NOT NULL DEFAULT '',
  preview TEXT NOT NULL DEFAULT '',
  model TEXT,
  topic TEXT,
  consensus TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 消息表
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  model TEXT,
  round INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX idx_sessions_created ON sessions (created_at DESC);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);   -- 用户查询加速
CREATE INDEX idx_messages_session_id ON messages (session_id);
CREATE INDEX idx_messages_created ON messages (created_at);

-- RLS（保留，后端用 service_role key 操作，手动过滤 user_id）
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all_sessions ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_messages ON messages FOR ALL USING (true) WITH CHECK (true);

-- ─── 如果已有旧表，仅需执行这段迁移 ────────────────────
-- ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id UUID;
-- CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);

