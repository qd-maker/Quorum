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

- **Single-model Chat** — Stream conversations with your favorite models (e.g., GPT-4o, Gemini, Grok, DeepSeek).
- **AI Group Discussion (Multi-Agent)** — Throw a topic at multiple models simultaneously. Watch them debate in parallel rounds and eventually converge on a unified **consensus**.
- **Web Search Integration (实时联网)** — Toggle the web search button to fetch real-time data using Tavily (or DuckDuckGo fallback). Generated responses automatically include clickable citation badges `[1]` linking directly to the source websites.
- **File & Image Attachments (多模态与文档)** — Easily upload images and text documents. Images are piped through Vision APIs, while text context is automatically appended—supported in both solo chats and group discussions.
- **Follow-up Q&A (无缝追问)** — Keep the conversation going. Even after a consensus is reached, you can ask follow-up questions to the multi-agent panel, complete with web search and attachment support.
- **User Isolation** — Powered by Supabase Auth and Row Level Security (RLS). Your session history and data remain strictly private and tied to your account.
- **Keep-alive UI Architecture** — Switch between Chat and Discussion views without interrupting ongoing AI streaming generation.
- **High-Contrast Theming** — Meticulously tuned Dark and Light modes with silky smooth transitions and accessible contrasts.

---

## 🏗️ Stack

| Layer | Tech |
|-------|------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| **Backend** | Python 3.11 + FastAPI + SSE streaming |
| **Database** | Supabase SDK + PostgreSQL Core |
| **AI / APIs** | OpenAI-compatible proxies, Tavily Search API |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone & configure

```bash
git clone https://github.com/qd-maker/Quorum.git
cd quorum
cp .env.example .env
```

Edit your `.env` (requires your API endpoint and Supabase details):

```env
API_BASE_URL=https://api.openai.com/v1   # or compatible proxy
API_KEY=sk-...

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=<anon key>
SUPABASE_SERVICE_KEY=<service_role key>

# Optional: Web search config
TAVILY_API_KEY=tvly-...
```

### 2. Database migration

Run the following inside your Supabase SQL Editor to set up the schema, Auth rules, and basic RLS policies:

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
python -m venv .venv
# Activate venv: .\.venv\Scripts\activate OR source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 4. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`, configure your keys in the settings (if necessary), and start chatting!

---

## 📁 Project Structure

```
quorum/
├── backend/
│   ├── main.py              # FastAPI entry
│   ├── config.py            # Environment configuration
│   ├── routers/             # API Endpoints (/chat, /discuss, /auth)
│   └── services/
│       ├── orchestrator.py  # Parallel AI multi-round orchestration
│       ├── search_service.py# Tavily/DDG search & context formatting
│       └── model_service.py # LLM inference streams
└── frontend/
    ├── src/
    │   ├── components/      # MarkdownRenderer, Sidebar, etc.
    │   ├── pages/           # ChatPage, DiscussPage, AuthPage
    │   ├── lib/api.ts       # SSE and fetch wrappers
    │   └── context/         # Auth & state management
    └── vite.config.ts
```

---

## 🤝 Contributing

PRs are welcome! Please open an issue first to discuss any large architectural changes.

---

## License

MIT
