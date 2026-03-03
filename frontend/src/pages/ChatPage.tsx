import { useState, useRef, useEffect, useCallback, useReducer } from 'react'
import { Send, ChevronDown, Square } from 'lucide-react'
import clsx from 'clsx'
import type { ModelId, ChatMessage } from '../types'
import { MODEL_META, getModelDisplayName } from '../types'
import { ModelAvatar } from '../components/ModelBubble'
import TypingIndicator from '../components/TypingIndicator'
import { apiFetch } from '../lib/api'

// ─── Model Selector ───────────────────────────────
const MODELS: ModelId[] = ['gpt-4o', 'gemini-2.0-flash', 'grok-2', 'deepseek-chat']

function ModelSelector({ selected, onChange }: { selected: ModelId; onChange: (m: ModelId) => void }) {
  const [open, setOpen] = useState(false)
  const meta = MODEL_META[selected]
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 glass glass-hover rounded-xl text-sm font-medium text-text-2 transition-all"
      >
        <ModelAvatar modelId={selected} size="sm" />
        <span>{getModelDisplayName(selected)}</span>
        <ChevronDown size={13} className={clsx('text-text-5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-52 bg-bg-2 border border-white/10 rounded-xl shadow-card overflow-hidden z-50 animate-fade-in">
          {MODELS.map(m => {
            const mm = MODEL_META[m]
            return (
              <button
                key={m}
                onClick={() => { onChange(m); setOpen(false) }}
                className={clsx(
                  'flex items-center gap-3 w-full px-3 py-2.5 text-sm transition-colors',
                  m === selected ? 'bg-bg-4 text-text-1' : 'text-text-3 hover:bg-bg-3 hover:text-text-2'
                )}
              >
                <ModelAvatar modelId={m} size="sm" />
                <div className="text-left">
                  <div className="font-medium">{getModelDisplayName(m)}</div>
                  <div className="text-xs text-text-5">{mm.description}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── User bubble ──────────────────────────────────
function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end animate-fade-in-up" style={{ opacity: 0 }}>
      <div className="max-w-[75%] px-4 py-3 bg-bg-4 border border-white/8 rounded-2xl rounded-br-sm text-sm text-text-2 leading-relaxed">
        {content}
      </div>
    </div>
  )
}

// ─── Assistant bubble ─────────────────────────────
function AssistantMessage({ msg }: { msg: ChatMessage & { isStreaming?: boolean } }) {
  const meta = MODEL_META[msg.model!]
  const bubbleMap: Record<ModelId, string> = {
    'gpt-4o': 'bubble-gpt',
    'gemini-2.0-flash': 'bubble-gemini',
    'grok-2': 'bubble-grok',
    'deepseek-chat': 'bubble-deepseek',
  }
  return (
    <div className="flex gap-3 animate-fade-in-up" style={{ opacity: 0 }}>
      <ModelAvatar modelId={msg.model!} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.shortName}</span>
          <span className="text-xs text-text-5">{meta.description}</span>
        </div>
        <div className={clsx('bg-bg-3 rounded-xl rounded-tl-sm px-4 py-3.5 text-sm text-text-2 leading-relaxed prose-dark', bubbleMap[msg.model!])}>
          {msg.content.split('\n').map((line, i) => {
            if (line.startsWith('**') && line.endsWith('**')) {
              return <p key={i} className="font-semibold text-text-1">{line.slice(2, -2)}</p>
            }
            if (line.match(/^- /)) {
              return <p key={i} className="pl-2">• {line.slice(2)}</p>
            }
            return line ? <p key={i}>{line}</p> : <br key={i} />
          })}
          {(msg as any).isStreaming && (
            <span className="inline-block w-0.5 h-4 ml-0.5 rounded-full animate-pulse" style={{ background: meta.color }} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────
function EmptyState({ model, onSend }: { model: ModelId; onSend: (text: string) => void }) {
  const meta = MODEL_META[model]
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 pb-24">
      <div className="w-16 h-16 rounded-2xl mb-5 flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${meta.gradientFrom}22, ${meta.gradientTo}22)`, border: `1px solid ${meta.color}33` }}>
        <ModelAvatar modelId={model} size="lg" />
      </div>
      <h2 className="font-display text-xl font-semibold text-text-1 mb-2">{getModelDisplayName(model)}</h2>
      <p className="text-sm text-text-4 max-w-xs">{meta.description} · 有什么可以帮你的？</p>
      <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-sm">
        {['解释一个技术概念', '帮我写代码', '分析这个问题', '给我一些建议'].map(s => (
          <button
            key={s}
            onClick={() => onSend(s)}
            className="px-3 py-1.5 glass rounded-full text-xs text-text-4 cursor-pointer hover:text-text-2 hover:bg-bg-3 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── ChatPage ─────────────────────────────────────
export default function ChatPage({ active, sessionId }: { active: boolean; sessionId?: string }) {
  const [model, setModel] = useState<ModelId>('gpt-4o')
  const [messages, setMessages] = useState<(ChatMessage & { isStreaming?: boolean })[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const messagesRef = useRef<(ChatMessage & { isStreaming?: boolean })[]>([])
  const modelRef = useRef<ModelId>(model)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  // Re-render when API config changes (model names)
  useEffect(() => {
    const handler = () => forceUpdate()
    window.addEventListener('config-updated', handler)
    return () => window.removeEventListener('config-updated', handler)
  }, [])

  // 同步 refs
  modelRef.current = model

  const updateMessages = (updater: (prev: (ChatMessage & { isStreaming?: boolean })[]) => (ChatMessage & { isStreaming?: boolean })[]) => {
    setMessages(prev => {
      const next = updater(prev)
      messagesRef.current = next
      return next
    })
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // 加载历史会话（仅在 active 且 sessionId 变化时触发）
  useEffect(() => {
    if (!active) return  // 页面隐藏时不加载，防止打断当前流
    if (!sessionId) {
      // 只有当 sessionIdRef 非空时才重置（避免新对话时清空当前消息）
      if (sessionIdRef.current !== null) {
        // 切换到新对话：中止正在进行的流
        if (abortRef.current) {
          abortRef.current.abort()
          abortRef.current = null
        }
        setIsTyping(false)
        setIsStreaming(false)
        updateMessages(() => [])
        sessionIdRef.current = null
      }
      return
    }
    if (sessionIdRef.current === sessionId) return  // 已加载，跳过

    // ⚠️ 切换到历史会话：立即中止当前流，防止旧响应污染新会话
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setIsTyping(false)
    setIsStreaming(false)

    sessionIdRef.current = sessionId
    apiFetch(`/api/sessions/${sessionId}`)
      .then(r => {
        if (!r.ok) throw new Error('not found')
        return r.json()
      })
      .then(data => {
        if (data.model) setModel(data.model as ModelId)
        const msgs = (data.messages || []).map((m: any, i: number) => ({
          id: m.id || String(i),
          role: m.role as 'user' | 'assistant',
          content: m.content,
          model: m.model as ModelId | undefined,
          timestamp: new Date(m.created_at).getTime(),
          isStreaming: false,
        }))
        updateMessages(() => msgs)
      })
      .catch(() => {
        sessionIdRef.current = null
      })
  }, [active, sessionId])

  // 保存会话到 Supabase（PUT 全量替换，避免重复）
  const saveSession = useCallback(async () => {
    try {
      const allMsgs = messagesRef.current
      if (allMsgs.length === 0) return

      const currentModel = modelRef.current
      const userMsgs = allMsgs.filter(m => m.role === 'user')
      const title = userMsgs[0]?.content?.slice(0, 50) || '新对话'
      const lastAi = allMsgs.filter(m => m.role === 'assistant').pop()
      const preview = lastAi?.content?.slice(0, 80) || ''

      if (!sessionIdRef.current) {
        const res = await apiFetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'chat', title, preview, model: currentModel }),
        })
        if (!res.ok) return
        const session = await res.json()
        sessionIdRef.current = session.id
      } else {
        await apiFetch(`/api/sessions/${sessionIdRef.current}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, preview }),
        })
      }

      // PUT 全量替换所有消息，避免重复
      const allPayload = allMsgs.map(m => ({
        role: m.role, content: m.content, model: m.model || undefined,
      }))
      await apiFetch(`/api/sessions/${sessionIdRef.current}/messages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allPayload }),
      })

      window.dispatchEvent(new Event('history-updated'))
    } catch (e) {
      console.error('Save session failed:', e)
    }
  }, [])

  // 中断流式输出
  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  const handleSend = async (overrideText?: string) => {
    const content = (overrideText ?? input).trim()
    if (!content || isTyping || isStreaming) return
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    const updatedMessages = [...messages, userMsg]
    updateMessages(() => updatedMessages)
    setInput('')
    setIsTyping(true)

    const aiId = (Date.now() + 1).toString()

    // 构造发送给后端的 messages（去掉前端专属字段）
    const apiMessages = updatedMessages.map(m => ({
      role: m.role,
      content: m.content,
    }))

    try {
      abortRef.current = new AbortController()
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: apiMessages, stream: true }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      // 创建 AI 消息占位
      const aiMsg: ChatMessage & { isStreaming: boolean } = {
        id: aiId, role: 'assistant', content: '', model, timestamp: Date.now(), isStreaming: true,
      }
      updateMessages(prev => [...prev, aiMsg])
      setIsTyping(false)
      setIsStreaming(true)

      // 流式读取 SSE
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') break
          try {
            const data = JSON.parse(payload)
            if (data.content) {
              updateMessages(prev =>
                prev.map(m => m.id === aiId ? { ...m, content: m.content + data.content } : m)
              )
            }
            if (data.error) {
              updateMessages(prev =>
                prev.map(m => m.id === aiId ? { ...m, content: m.content + `\n\n❌ ${data.error}`, isStreaming: false } : m)
              )
              return
            }
          } catch { /* skip malformed */ }
        }
      }

      // 标记流结束并保存
      updateMessages(prev =>
        prev.map(m => m.id === aiId ? { ...m, isStreaming: false } : m)
      )
      setIsStreaming(false)
      // 使用 setTimeout 确保 messagesRef 已更新
      setTimeout(() => saveSession(), 50)
    } catch (err: any) {
      setIsStreaming(false)
      if (err.name === 'AbortError') {
        // 中断后保留已接收的内容，标记流结束
        updateMessages(prev =>
          prev.map(m => m.id === aiId ? { ...m, isStreaming: false } : m)
        )
        setTimeout(() => saveSession(), 50)
        return
      }
      setIsTyping(false)
      updateMessages(prev => [...prev, {
        id: aiId, role: 'assistant' as const, content: `❌ 请求失败: ${err.message}`, model, timestamp: Date.now(), isStreaming: false,
      }])
    }
  }

  return (
    <div className="flex flex-col h-full bg-bg-2">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 bg-bg-1/50 backdrop-blur-sm flex-shrink-0">
        <ModelSelector selected={model} onChange={m => {
          setModel(m)
          updateMessages(() => [])
          sessionIdRef.current = null
        }} />
        <span className="text-xs text-text-5">单模型对话</span>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState model={model} onSend={(text) => handleSend(text)} />
        ) : (
          <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
            {messages.map(msg =>
              msg.role === 'user'
                ? <UserMessage key={msg.id} content={msg.content} />
                : <AssistantMessage key={msg.id} msg={msg} />
            )}
            {isTyping && <TypingIndicator modelId={model} />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-5 py-4 bg-bg-2/80 backdrop-blur-sm border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-3 bg-bg-3 border border-white/8 rounded-2xl px-4 py-3 input-glow transition-all">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder={`向 ${getModelDisplayName(model)} 提问...`}
              rows={1}
              className="flex-1 bg-transparent text-sm text-text-1 placeholder:text-text-5 resize-none outline-none leading-relaxed max-h-32 overflow-y-auto"
              style={{ minHeight: '22px' }}
            />
            {isStreaming ? (
              <button
                onClick={handleStop}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all flex-shrink-0 bg-red-500/90 hover:bg-red-400 text-white animate-pulse"
                title="停止生成"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                className={clsx(
                  'w-8 h-8 rounded-xl flex items-center justify-center transition-all flex-shrink-0',
                  input.trim() && !isTyping
                    ? 'bg-violet-500 hover:bg-violet-400 text-white shadow-gemini'
                    : 'bg-bg-5 text-text-5 cursor-not-allowed'
                )}
              >
                <Send size={14} />
              </button>
            )}
          </div>
          <p className="text-center text-xs text-text-5 mt-2">Enter 发送 · Shift+Enter 换行</p>
        </div>
      </div>
    </div>
  )
}
