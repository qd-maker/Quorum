# Quorum 线上部署提示词（给 OpenClaw）

## 📋 项目概况

Quorum 是一个多 AI 模型群聊讨论平台，技术栈：
- **前端**：React + Vite + TypeScript，打包后由 Nginx 托管
- **后端**：FastAPI (Python 3.11)，通过 OpenAI 兼容的 API 中转站调用多个模型
- **认证**：Supabase Auth (JWT)
- **部署方式**：Docker Compose（`frontend` + `backend` 两个容器）

---

## 🚨 当前线上已知问题及修复方案

### 问题 1：紫色引用小徽章不显示

**现象**：开启联网搜索后，AI 回答中 `[1]`、`[2]` 等引用编号本应显示为紫色可点击的小徽章（悬停显示来源链接），但线上部署后不再出现。

**根因**：后端搜索服务的 Tavily API Key 未配置到线上环境变量中，导致 fallback 到 DuckDuckGo。而 DuckDuckGo 在 Docker/服务器 IP 环境下极不稳定，经常返回空结果或被 rate limit，最终 `sources` 为空数组，前端自然不渲染徽章。

**修复**：**必须在线上 [.env](file:///e:/code/claude/Quorum/.env) 中配置 `TAVILY_API_KEY`**（见下方环境变量清单）。

### 问题 2：搜索结果牛头不对马嘴

**现象**：搜索"美国伊朗冲突"返回的全是 United Airlines、Reddit/UK 等无关内容。

**根因**：DuckDuckGo 搜索质量极低，无法正确处理新闻时事类查询。代码中的 [_to_english_hint()](file:///e:/code/claude/Quorum/backend/services/search_service.py#153-184) 将"美国"翻译为"United States"后，DDG 按"United"匹配到了航空公司等噪音结果。Tavily 有专门的 `topic="news"` 模式，不会出此问题。

**修复**：同上，**配置 Tavily API Key** 即可根治（Tavily 是搜索的主力引擎，DDG 仅为备用）。

---

## ✅ 线上部署环境变量清单

> **重要**：[.env](file:///e:/code/claude/Quorum/.env) 文件在 [.gitignore](file:///e:/code/claude/Quorum/.gitignore) 中，不会随代码推送。必须在服务器上手动创建。

在项目根目录创建 [.env](file:///e:/code/claude/Quorum/.env) 文件，包含以下所有变量：

```env
# ═══════════════════════════════════════════
# Quorum 线上部署环境变量（必须项全部填写）
# ═══════════════════════════════════════════

# ─── AI 模型 API ──────────────────────────
# 统一 API 中转站（OpenAI 兼容格式）
API_BASE_URL=https://api.bltcy.ai/v1
API_KEY=<你的中转站 API Key>

# ─── Supabase（认证 + 数据库）─────────────
SUPABASE_URL=https://iotavlgqnpmxbkfhsgfj.supabase.co
SUPABASE_KEY=<Supabase anon key (公开的)>
SUPABASE_SERVICE_KEY=<Supabase service_role key (私密, 绕过 RLS)>
SUPABASE_JWT_SECRET=<Supabase JWT secret (Settings > API 页面获取, 用于本地 JWT 验证)>

# ─── 搜索服务 ─────────────────────────────
# ⚠️ 这个是关键！没有它搜索功能基本废掉
TAVILY_API_KEY=<你的 Tavily API Key>
```

### 各环境变量的作用

| 变量 | 必需 | 说明 |
|------|------|------|
| `API_BASE_URL` | ✅ | OpenAI 兼容 API 的地址，后端所有模型调用都走这个 |
| `API_KEY` | ✅ | 上述 API 中转站的密钥 |
| `SUPABASE_URL` | ✅ | Supabase 项目 URL |
| `SUPABASE_KEY` | ✅ | Supabase anon key（前端认证用，也在 [frontend/src/lib/supabase.ts](file:///e:/code/claude/Quorum/frontend/src/lib/supabase.ts) 硬编码了一份） |
| `SUPABASE_SERVICE_KEY` | ✅ | Supabase service_role key，后端用它绕过 RLS 直接操作数据库 |
| `SUPABASE_JWT_SECRET` | ✅ | JWT 签名密钥，后端用 PyJWT 本地验证 token，不再远程调 Supabase API |
| `TAVILY_API_KEY` | ⚠️ 强烈推荐 | Tavily 搜索 API key。**没有它，联网搜索会 fallback 到 DuckDuckGo，在服务器环境下基本不可用** |

---

## 🐳 Docker 部署步骤

```bash
# 1. 在项目根目录创建 .env 文件（参考上方清单）
nano .env

# 2. 构建并启动
docker compose up -d --build

# 3. 健康检查
curl http://localhost:3330/health
# 应返回: {"status":"ok"}
```

### 端口映射

| 服务 | 容器端口 | 宿主机端口 |
|------|----------|------------|
| frontend (Nginx) | 80 | **3330** |
| backend (Uvicorn) | 8000 | **8000** |

### Nginx 反向代理说明（已内置）

前端 Nginx 已配置好 `/api/` 反向代理到 `backend:8000`：
- 所有 `/api/*` 请求 → 转发到后端容器
- 仅 `/health` → 直接代理到后端健康检查
- 其他路径 → SPA fallback 到 `index.html`
- **SSE 流式特别配置**：已关闭 `proxy_buffering`，超时 600s

---

## 🗄️ Supabase 数据库 Schema

首次部署需要在 Supabase SQL Editor 中执行建表脚本：

文件位置：[backend/schema.sql](file:///e:/code/claude/Quorum/backend/schema.sql)

这个 schema 包含了会话（sessions）和消息（messages）表，是历史记录功能的基础。

---

## ⚠️ 常见部署问题排查

### 1. 搜索功能不工作（紫色徽章不显示）
- **首先检查**：[.env](file:///e:/code/claude/Quorum/.env) 中 `TAVILY_API_KEY` 是否已配置
- 如果无法获取 Tavily key（免费额度：https://tavily.com），搜索功能会严重退化
- 后端日志会打印 `Tavily search [news/general]: ...` 或 `DuckDuckGo search: ...` 可以判断走了哪个引擎

### 2. 登录/认证失败
- 检查 `SUPABASE_JWT_SECRET` 是否正确（从 Supabase Dashboard > Settings > API > JWT Secret 复制）
- 错误表现：后端返回 401，日志显示 `JWT decode failed`

### 3. AI 模型无回复
- 检查 `API_BASE_URL` 和 `API_KEY` 是否正确
- 中转站是否支持这些模型：`gpt-4o`, `gemini-2.5-flash`, `grok-4`, `deepseek-chat`
- 注意：前端 ID 和实际 API 调用的模型名有映射关系（在 `backend/services/model_service.py:MODEL_NAME_MAP`）

### 4. CORS 错误
- 当前 [main.py](file:///e:/code/claude/Quorum/backend/main.py) 只允许了 `localhost:5173`（Vite 开发服务器）
- **线上部署通过 Nginx 代理 `/api/` 到后端，不经过 CORS**，所以这不是问题
- 但如果将来前后端分开部署到不同域名，需要更新 CORS 配置

### 5. SSE 流式中断
- Nginx 配置已设置 `proxy_read_timeout 600s`
- 如果使用 Cloudflare 等 CDN，需要设置 **不缓存 `/api/` 路径**，或启用 WebSocket/SSE 支持

---

## 📁 项目结构概览

```
Quorum/
├── .env                    # ← 线上必须创建！
├── docker-compose.yml      # Docker 编排
├── backend/
│   ├── Dockerfile
│   ├── main.py             # FastAPI 入口, CORS 配置
│   ├── config.py           # 环境变量读取 (pydantic-settings)
│   ├── auth.py             # JWT 验证 (PyJWT 本地验证)
│   ├── requirements.txt    # Python 依赖
│   ├── schema.sql          # Supabase 建表脚本
│   ├── routers/
│   │   ├── chat.py         # 单模型对话 (含联网搜索)
│   │   ├── discuss.py      # 多模型讨论
│   │   ├── history.py      # 历史记录 CRUD
│   │   ├── config_api.py   # 模型名称配置
│   │   └── auth_router.py  # 认证路由
│   └── services/
│       ├── model_service.py     # 统一模型调用层
│       ├── search_service.py    # 搜索服务 (Tavily 优先, DDG 备用)
│       ├── orchestrator.py      # 群聊编排器
│       └── history_service.py   # 历史记录服务
└── frontend/
    ├── Dockerfile
    ├── nginx.conf           # Nginx 配置 (含 /api/ 反向代理)
    └── src/
        ├── lib/supabase.ts  # Supabase 客户端 (URL+Key 硬编码)
        ├── lib/api.ts       # 带 JWT 的 fetch 封装
        └── components/
            └── MarkdownRenderer.tsx  # 引用徽章渲染组件
```

---

## 🔑 一句话总结

> **线上出问题的核心原因：[.env](file:///e:/code/claude/Quorum/.env) 文件没有正确部署到服务器上（尤其是 `TAVILY_API_KEY`）。**
> 把本地 [.env](file:///e:/code/claude/Quorum/.env) 中的所有变量原封不动复制到服务器项目根目录的 [.env](file:///e:/code/claude/Quorum/.env) 文件中，重启 Docker 容器，所有问题即可解决。
