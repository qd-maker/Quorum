# Quorum · AI 产品决策记录

> 仅记录在本项目中真实做出过的、对未来类似 AI 产品仍有指导意义的取舍。
> 不写"业内通用最佳实践"。每条决策必须能追溯到具体 commit / 文件 / 截图。

---

## 1. 为什么做"多方共识"而不是单模型对话

- **痛点**：单一模型有口径偏差（GPT 偏中庸、DeepSeek 偏严苛、Grok 偏对抗），用户在重大决策前往往要切换 3-4 个网页才能交叉验证。
- **取舍**：用 4 个差异化模型并行讨论 + 一份中立摘要，把"打开多个网页 + 人工汇总"压缩成一次请求。
- **失败假设**：如果让模型按"角色"分工（技术专家 / 严厉批评者 / 创意大师 / 通用助手），会不会让差异更明显？→ 实测有效，前端保留了 `roles: dict[str, str]` 入参（`backend/routers/discuss.py:27`）让用户自定义。
- **MVP 边界**：只支持 2 轮讨论 + 1 次共识，不做无限轮次。多轮辩论收益急剧递减，但成本线性增长，违反"MVP 优先于完美"。

## 2. 为什么用 SSE 而不是 WebSocket

- **服务端 → 客户端单向流**就够用（4 个模型 chunk + round_start/done + consensus），不需要双向。
- SSE 天然走 HTTP/1.1，反向代理、CDN、企业网关一般都默认放行；WebSocket 容易被中间件 buffer。
- 已为长连接做好两件事：
  - `X-Accel-Buffering: no` 禁用 Nginx buffer（`backend/routers/discuss.py:83`）
  - 心跳 `: heartbeat\n\n` 每 10s 发一次，避免代理空闲超时
- **结论**：除非未来要做"用户实时打断模型 / 输入语音 / 多端协同"才换 WS。

## 3. 为什么共识阶段拆成"总结 + 合成"两步

- **首版做法**：把 4 个模型的完整 R1+R2 发言（约 4×800 字 = 3200 字）一次性塞给共识模型 → 经常被代理截断、首 token 超时。
- **改进做法**（现行）：
  1. **Phase 1 总结**：每个模型并发对自己的发言做 100-150 字摘要（`_summarize_system`，`backend/services/orchestrator.py:122`）
  2. **Phase 2 合成**：把 4 份 ~150 字摘要喂给共识模型 → 总输入压到 500-700 字
- **收益**：共识生成的 P95 时延从 ~25s 降到 ~6s，且不再因为单模型卡死拖垮整个共识。

## 4. 为什么"近期热门话题"统一用 GPT-4o 生成

- **首版**：每个模型生成自己的 4 条话题（`_MODEL_PERSONA` per-model 缓存）。
- **暴露问题**：DeepSeek-R1 输出 `<think>...</think>` 思考链经常无法被正则可靠剥离；Grok 偶尔输出英文。
- **改进**（commit `f120089`）：
  - 全局共享一份话题，统一用 `gpt-4o` 生成
  - 强制要求输出 JSON 数组 `[{emoji, title, hint}, ...]`
  - 单飞锁防并发重复生成；1h TTL；失败短缓存 5min
- **取舍代价**：所有模型空状态显示同一份话题，"个性化"消失。但用户是在"挑话题去和多模型讨论"，话题本身不需要 per-model。

## 5. 为什么把 4 张话题卡片接上 trending API

- **痛点**：用户反馈"卡片永远是那 4 个写死的话题，看一次就腻了"。
- **方案**：保留 4 张卡片的 emoji + hint UI，**只让标题动态化**。
  - 后端返回 `topics_full: [{emoji, title, hint}]`，每条由 GPT 同时给 emoji 和 hint
  - 前端 `localStorage` 24h 缓存 + 手动 🔄 按钮 + skeleton 加载
- **不做**：不让卡片完全 LLM 控制（包括交互行为），只让"内容"动态、"结构"固定，避免破坏既有 UX。

## 6. 为什么有 Demo Mode

- **面试 / 演示场景**：用户没 API Key 也能 1 分钟看到效果，比 README 截图说服力强 10 倍。
- **实现要点**（`backend/auth.py:1-69`）：
  - `DEMO_MODE=1` 时 `get_current_user` fallback 到 IP 哈希作为 `user_id`
  - 严格依赖（`get_current_user_strict`）用于 `/api/config` 等敏感接口，demo 用户**不能改全局配置**
  - slowapi 在 demo 模式下用 IP 限流，登录用户用 user_id 限流（`backend/rate_limit.py`）
- **风险**：未来如果接入真实付费 API，必须把 demo 流量隔离到一组演示 key（额度可控）；目前 demo 共用全局 `.env` 中的 key。

## 7. 决策日志（按时间倒序）

| 日期 | 决策 | Commit |
|---|---|---|
| 2026-05-08 | 并发瞬时 429 → 错峰 0.25s + stream 握手重试 | `bb425dc` |
| 2026-05-08 | 讨论室"灵感话题"接 trending API + JSON 结构化 | `f120089` |
| 2026-05-08 | ChatPage EmptyState 接热门话题（首版） | `05f9bfc` |
| 2026-05-07 | 上线前优化：稳定性 + 体验 + Demo Mode | `8a9766c` |
| 2026-05-07 | P0 安全修复 + P1 动画优化 + 中文 README | `2b8a9e8` |
