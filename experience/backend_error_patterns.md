# Quorum · 后端错误模式（真实踩坑记录）

> 只收录**真实在本项目里遇到过、定位过、修过**的问题。每条都给出根因 + 最小修复 + commit。
> 看似类似但不一样的问题，请单独记录而不是合并。

---

## 1. SSE 流并发握手 → 代理"上游分组"瞬时饱和 429

### 现象
```
讨论室 4 个模型均可用，但第 1 轮某个模型（如 Gemini）没参与，
第 2 轮却参与了。错误：
Error code: 429 - {'error': {'message': '当前分组上游负载已饱和'}}
```

### 根因
- `orchestrator.run_discussion` 中 R1 用 `asyncio.create_task(_stream_model_r1(m)) for m in models]` **同 tick** 起 4 个并发 stream
- 第三方聚合代理（new-api / one-api）按"上游分组"做瞬时并发限制，4 个 task 同一毫秒命中 → 返回 429
- R2 因为间隔 30s+ 已冷却 → 看似 "R1 缺席 R2 出现"

### 修复（commit `bb425dc`）
1. **stream_chat 握手重试**（`backend/services/model_service.py`）
   - 仅在 `client.chat.completions.create` 抛 `RateLimitError / APIStatusError(429/502/503)` 或错误信息含"饱和" / "rate limit" 时重试
   - 节奏 `0.6s / 1.5s / 3.0s` 三档指数退避
   - **流已开启后不再重试**（避免重复 chunk）
2. **task 错峰启动**（`backend/services/orchestrator.py`）
   - `asyncio.create_task` 立刻入队不阻塞主调度
   - task 内部 `await asyncio.sleep(i * 0.25)` 后才发请求
   - 总时延仅 +0.75s，但避开瞬时高峰

### 教训
- 凡是"批量并发调外部 API"都要先想"对方有没有瞬时并发上限"，**不是只看 RPS**
- 错峰是预防、重试是兜底，**两者都要有**

---

## 2. `AsyncClient.__init__() got an unexpected keyword argument 'proxies'`

### 现象
```
⚠️ GPT 未参与讨论：AsyncClient.__init__() got an unexpected keyword argument 'proxies'
（4 个模型同样报错）
```

### 根因
- `openai>=1.x` 内部用 `httpx.AsyncClient`，`httpx>=0.28` **移除了 `proxies` 关键字**（改名 `proxy` / `mounts`）
- 项目 `requirements.txt` 没固定 `httpx` 版本，CI 装到 `httpx==0.28+` → openai 内部传 `proxies` → 抛错

### 修复
- `requirements.txt` 固定 `httpx>=0.27,<0.28` 或同步升 `openai` 到兼容新版 httpx 的版本
- 长期方案：把 `httpx` 也写进 `pip freeze` 锁版本

### 教训
- 间接依赖的**破坏性升级**比直接依赖更隐蔽
- Python 项目应该有 `pip-compile` / `uv lock` 锁全部传递依赖

---

## 3. SSE 流不会因为客户端关闭而停止

### 现象
- 用户在讨论生成中关闭浏览器 → 后端继续燃烧 4 个 LLM 的 token
- 重新打开页面发起新讨论 → 上一波"幽灵流"还在跑 → token 浪费 + 速率限制更容易撞

### 根因
- FastAPI `StreamingResponse` 的生成器不会自动感知 `request.is_disconnected()`
- `orchestrator.run_discussion` 是个 async generator，没人 cancel 它就一直执行

### 修复
- `discuss` 路由把 `request.is_disconnected` 包装成 `_should_stop` 谓词传给 `run_discussion`（`backend/routers/discuss.py:56`）
- `orchestrator` 在每个关键点 `await _is_stopped(should_stop)`，True 时 cancel 所有子 task 并 `return`
- R1 / R2 / 总结 / 共识 4 个阶段全部加了断连检查

### 教训
- SSE / 长流式接口必须有"客户端断连感知"，否则成本会爆炸
- 心跳 `: heartbeat\n\n` 不仅是为了防代理超时，也是触发 `is_disconnected()` 实际写出的 trigger

---

## 4. 全局单例 OpenAI Client 导致多用户 API key 互相覆盖

### 现象
- 用户 A 在 `/api/config` 改了自己的 base_url + api_key
- 用户 B 同一时刻发起讨论 → B 的请求被 A 的配置打过去 → 报错 / 被收 A 的费

### 根因
- 首版只有一个全局 `client = AsyncOpenAI(...)`，配置变更直接 `reset_client()` 全员重建
- 多用户场景下没有任何隔离

### 修复
- `services/user_config.py` 引入 per-user runtime config（内存 dict）
- `services/model_service.py` 用 `_client_cache: dict[(base_url, api_key), AsyncOpenAI]` 按 (base_url, api_key) 复用 client
- `stream_chat / complete_chat` 全部接收 `user_id` 参数，从 `get_effective_config(user_id)` 解析

### 教训
- 任何"运行时可变配置 + 多用户并发"组合，**默认就要按 user 隔离**
- LRU 缓存有上限，但内存 dict 没有 → 长期运行需要加 TTL 或 maxsize

---

## 5. R1 缺席的模型在共识里也出现，导致共识胡说

### 现象
- R1 中 Grok 报错没产出 → R2 中 Grok 也报错
- 共识阶段把"Grok 的观点"作为空字符串塞进 prompt → 共识里出现"Grok 认为..."但实际无内容
- 用户看到共识里的"Grok 立场"是模型瞎编的

### 根因
- `_build_consensus_messages` 没过滤报错模型的空 summary
- 共识模型看到 `### Grok 的核心观点：\n（空）` 就开始想象

### 修复
- `_summarize_model` 中先 `if model in model_errors: return model, ""`
- `model_summaries` 字典只塞非空 summary
- 共识 prompt 只列实际产出的模型

### 教训
- 多 agent 编排的"局部失败"必须显式 propagate 到下游 prompt，不能让下游模型"看不见"失败模型
- 给前端发 `errors_summary` event 让用户清楚"谁没参与"

---

## 6. 共识阶段一次性塞所有发言 → 代理截断 / 首 token 慢

### 现象
- 共识 prompt = 4 模型 × 2 轮 × ~800 字 ≈ 6400 字（约 2K tokens 中文）
- 部分代理超过 4K 输入直接 503，或者首 token > 30s

### 修复（同 ai_product_decisions §3）
- 拆"总结 + 合成"两阶段，把输入压到 500-700 字
- 共识阶段失败重试链：`healthy_models + fallback_models` 依次尝试

---

## 7. slowapi 在 FastAPI 中文件级 `@limiter.limit` 装饰器无效

### 现象
- 限流装饰器加了但不生效，slowapi 报 `Limiter not registered`

### 根因
- slowapi 必须把 `Limiter` 实例同时挂到 `app.state.limiter`，并注册 `RateLimitExceeded` 异常处理器
- 否则装饰器本身只是"标记"，没有实际拦截逻辑

### 修复（`backend/main.py`）
```python
from rate_limit import limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

### 教训
- 第三方限流库都有"中间件 + 装饰器"两件套，一个都不能漏；先看官方 README 而不是直接 copy 装饰器

---

## 错误模式登记格式（追加新条目时复用）

```markdown
## N. 一句话现象

### 现象
（贴具体报错 / 用户描述 / 日志）

### 根因
（说清楚为什么会发生）

### 修复（commit `xxxxxxx`）
（最小变更方案）

### 教训
（一两句话，下次写代码前提醒自己）
```
