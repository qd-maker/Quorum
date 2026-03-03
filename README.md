<div align="center">

<h1>🔮 Quorum</h1>

<p><strong>Multi-model AI chat platform with group discussion & consensus</strong></p>

<p>
  <img src="https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat&logo=fastapi" />
  <img src="https://img.shields.io/badge/React-18+-61DAFB?style=flat&logo=react" />
  <img src="https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-3ECF8E?style=flat&logo=supabase" />
  <img src="https://img.shields.io/badge/TypeScript-5+-3178C6?style=flat&logo=typescript" />
</p>

</div>

---

## ✨ Features

- **Single-model Chat** — Stream conversations with GPT-4o, Gemini, Grok, or DeepSeek
- **AI Group Discussion** — Throw a topic at multiple models simultaneously; they debate in parallel rounds and converge on a **consensus**
- **User Isolation** — Supabase Auth + per-user session storage; your history is only visible to you
- **Keep-alive Architecture** — Switch between Chat and Discussion without interrupting ongoing AI streams
- **Dark / Light Theme** — Persisted per device

---

## 🏗️ Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Python 3.11 + FastAPI + SSE streaming |
| Database | Supabase (PostgreSQL + Auth) |
| AI | OpenAI-compatible unified API proxy |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone & configure

```bash
git clone <repo-url>
cd quorum
cp .env.example .env
```

Edit `.env`:

```env
API_BASE_URL=https://api.openai.com/v1   # or compatible proxy
API_KEY=sk-...

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=<anon key>
SUPABASE_SERVICE_KEY=<service_role key>
```

### 2. Database migration

Run in Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  type TEXT NOT NULL CHECK (type IN ('chat', 'discuss')),
  title TEXT NOT NULL DEFAULT '',
  preview TEXT NOT NULL DEFAULT '',
  model TEXT, topic TEXT, consensus TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL, content TEXT NOT NULL DEFAULT '',
  model TEXT, round INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all_sessions ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_messages ON messages FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
```

### 3. Start backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 4. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`, register an account, and start chatting.

---

## 📁 Project Structure

```
quorum/
├── backend/
│   ├── main.py              # FastAPI entry
│   ├── auth.py              # JWT verification dependency
│   ├── config.py            # Settings (env-based)
│   ├── routers/
│   │   ├── chat.py          # /api/chat  — SSE streaming
│   │   ├── discuss.py       # /api/discuss — multi-model rounds
│   │   ├── history.py       # /api/sessions CRUD
│   │   └── auth_router.py   # /api/auth/login, /register
│   └── services/
│       ├── history_service.py
│       ├── model_service.py
│       └── orchestrator.py  # Parallel AI round orchestration
└── frontend/
    ├── src/
    │   ├── context/AuthContext.tsx
    │   ├── lib/api.ts        # Authenticated fetch wrapper
    │   ├── pages/
    │   │   ├── ChatPage.tsx
    │   │   ├── DiscussPage.tsx
    │   │   └── AuthPage.tsx
    │   └── components/
    │       └── Sidebar.tsx
    └── vite.config.ts
```

---

## 🤝 Contributing

PRs welcome. Please open an issue first for large changes.

---

## License

MIT
