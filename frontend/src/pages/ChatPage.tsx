import { useState, useRef, useEffect, useCallback, useReducer } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, ChevronDown, Square, Paperclip, X, FileText, ImageIcon, Globe, Users } from 'lucide-react'
import clsx from 'clsx'
import type { ModelId, ChatMessage } from '../types'
import { MODEL_META, getModelDisplayName } from '../types'
import { ModelAvatar } from '../components/ModelBubble'
import TypingIndicator from '../components/TypingIndicator'
import MarkdownRenderer from '../components/MarkdownRenderer'
import CopyButton from '../components/CopyButton'
import { apiFetch } from '../lib/api'

// ─── Types ───────────────────────────────────────────
interface Attachment {
  type: 'image' | 'text'
  data: string   // base64 data URL for images, plain text for text files
  name: string
  mimeType: string
}

// ─── Allowed file types ───────────────────────────────
const TEXT_EXTS = ['txt', 'md', 'py', 'js', 'ts', 'jsx', 'tsx', 'json', 'csv',
  'xml', 'yaml', 'yml', 'html', 'css', 'sh', 'sql', 'rs', 'go', 'java', 'c', 'cpp', 'h']
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
const MAX_IMAGE_MB = 10
const MAX_TEXT_MB = 2

// ─── Model Selector ───────────────────────────────────
const MODELS: ModelId[] = ['gpt-4o', 'gemini-2.0-flash', 'grok-2', 'deepseek-chat']

function ModelSelector({ selected, onChange }: { selected: ModelId; onChange: (m: ModelId) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative min-w-0 flex-1 md:flex-none md:w-auto md:max-w-none z-40">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full md:w-auto items-center justify-between md:justify-start gap-2 px-3 py-2 glass glass-hover rounded-xl text-sm font-medium text-text-2 transition-all max-w-full"
      >
        <ModelAvatar modelId={selected} size="sm" />
        <span className="truncate max-w-[11rem] md:max-w-none">{getModelDisplayName(selected)}</span>
        <ChevronDown size={13} className={clsx('text-text-5 transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="hidden md:block absolute top-full left-0 mt-1.5 bg-bg-2 border border-white/10 rounded-xl shadow-card overflow-hidden z-[70] animate-fade-in min-w-[15rem]">
            {MODELS.map(m => {
              const mm = MODEL_META[m]
              return (
                <button
                  key={m}
                  onClick={() => { onChange(m); setOpen(false) }}
                  className={clsx(
                    'flex items-center gap-3 w-full px-3 py-2.5 text-sm transition-colors text-left',
                    m === selected ? 'bg-bg-4 text-text-1' : 'text-text-3 hover:bg-bg-3 hover:text-text-2'
                  )}
                >
                  <ModelAvatar modelId={m} size="sm" />
                  <div className="text-left min-w-0">
                    <div className="font-medium truncate">{getModelDisplayName(m)}</div>
                    <div className="text-xs text-text-5 truncate">{mm.description}</div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="md:hidden fixed inset-0 z-[80]" onClick={() => setOpen(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
            <div
              className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/10 bg-bg-1 shadow-2xl px-4 pt-3 pb-5 animate-spring-pop"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/10" />
              <div className="mb-3 px-1 text-sm font-medium text-text-2">选择模型</div>
              <div className="space-y-2">
                {MODELS.map(m => {
                  const mm = MODEL_META[m]
                  const active = m === selected
                  return (
                    <button
                      key={m}
                      onClick={() => { onChange(m); setOpen(false) }}
                      className={clsx(
                        'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all',
                        active
                          ? 'bg-bg-4 border border-violet-500/25 text-text-1'
                          : 'bg-bg-2/70 border border-white/6 text-text-3 hover:bg-bg-3'
                      )}
                    >
                      <ModelAvatar modelId={m} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{getModelDisplayName(m)}</div>
                        <div className="text-xs text-text-5 truncate">{mm.description}</div>
                      </div>
                      {active && <span className="text-[11px] text-violet-300">当前</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── User bubble ──────────────────────────────────────
function UserMessage({ content, attachment }: { content: string; attachment?: Attachment }) {
  return (
    <div className="flex justify-end animate-fade-in-up" style={{ opacity: 0 }}>
      <div className="max-w-[75%] flex flex-col gap-2 items-end">
        {/* 附件预览 */}
        {attachment && (
          attachment.type === 'image' ? (
            <img
              src={attachment.data}
              alt={attachment.name}
              className="max-w-xs max-h-64 rounded-xl border border-white/10 object-cover"
            />
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-bg-4/60 border border-white/8 rounded-xl">
              <FileText size={14} className="text-violet-400 flex-shrink-0" />
              <span className="text-xs text-text-3 truncate max-w-[180px]">{attachment.name}</span>
            </div>
          )
        )}
        {/* 文字内容 */}
        {content && (
          <div className="px-4 py-3 bg-bg-4 border border-white/8 rounded-2xl rounded-br-sm text-sm text-text-2 leading-relaxed">
            {content}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Assistant bubble ─────────────────────────────────
function AssistantMessage({ msg, sources = [] }: { msg: ChatMessage & { isStreaming?: boolean }; sources?: { title: string; url: string }[] }) {
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
        <div className={clsx('bg-bg-3 rounded-xl rounded-tl-sm px-4 py-3.5 text-sm text-text-2 leading-relaxed group/bubble relative', bubbleMap[msg.model!])}>
          <MarkdownRenderer
            content={msg.content}
            isStreaming={!!msg.isStreaming}
            accentColor={meta.color}
            sources={sources}
          />
          {!msg.isStreaming && (
            <div className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover/bubble:opacity-100 transition-opacity">
              <CopyButton content={msg.content} className="p-1 hover:bg-white/10" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────
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

// ─── ChatPage ─────────────────────────────────────────
export default function ChatPage({ active, sessionId }: { active: boolean; sessionId?: string }) {
  const navigate = useNavigate()
  const [model, setModel] = useState<ModelId>('gpt-4o')
  const [messages, setMessages] = useState<(ChatMessage & { isStreaming?: boolean; attachment?: Attachment })[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileError, setFileError] = useState('')
  const [chatSources, setChatSources] = useState<{ title: string; url: string }[]>([])
  const [useSearch, setUseSearch] = useState(false)
  const [hasUnseenStreamUpdate, setHasUnseenStreamUpdate] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const messagesRef = useRef<(ChatMessage & { isStreaming?: boolean })[]>([])
  const modelRef = useRef<ModelId>(model)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isAutoScrollRef = useRef(true)
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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100
    isAutoScrollRef.current = isAtBottom
    if (isAtBottom) setHasUnseenStreamUpdate(false)
  }

  useEffect(() => {
    if (isAutoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' })
    }
  }, [messages, isTyping])

  // 加载历史会话
  useEffect(() => {
    if (!active) return
    if (!sessionId) {
      if (sessionIdRef.current !== null) {
        if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
        setIsTyping(false); setIsStreaming(false)
        updateMessages(() => [])
        sessionIdRef.current = null
      }
      return
    }
    if (sessionIdRef.current === sessionId) return
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
    setIsTyping(false); setIsStreaming(false)
    sessionIdRef.current = sessionId
    apiFetch(`/api/sessions/${sessionId}`)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json() })
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
      .catch(() => { sessionIdRef.current = null })
  }, [active, sessionId])

  // ─── 文件处理 ──────────────────────────────────────
  const processFile = useCallback((file: File) => {
    setFileError('')
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const sizeMB = file.size / 1024 / 1024

    if (IMAGE_TYPES.includes(file.type)) {
      if (sizeMB > MAX_IMAGE_MB) { setFileError(`图片不能超过 ${MAX_IMAGE_MB}MB`); return }
      const reader = new FileReader()
      reader.onload = e => {
        setAttachment({ type: 'image', data: e.target!.result as string, name: file.name, mimeType: file.type })
      }
      reader.readAsDataURL(file)
    } else if (TEXT_EXTS.includes(ext)) {
      if (sizeMB > MAX_TEXT_MB) { setFileError(`文本文件不能超过 ${MAX_TEXT_MB}MB`); return }
      const reader = new FileReader()
      reader.onload = e => {
        setAttachment({ type: 'text', data: e.target!.result as string, name: file.name, mimeType: 'text/plain' })
      }
      reader.readAsText(file, 'utf-8')
    } else if (ext === 'pdf') {
      setFileError('PDF 暂不支持，请将内容复制粘贴后发送')
    } else {
      setFileError(`不支持的文件类型：.${ext}`)
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''  // reset so same file can be re-selected
  }

  // 拖拽支持
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  // ─── 保存会话 ──────────────────────────────────────
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
      const allPayload = allMsgs.map(m => ({ role: m.role, content: m.content, model: m.model || undefined }))
      await apiFetch(`/api/sessions/${sessionIdRef.current}/messages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allPayload }),
      })
      window.dispatchEvent(new Event('history-updated'))
    } catch (e) { console.error('Save session failed:', e) }
  }, [])

  const handleStop = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
  }, [])

  // ─── 发送消息 ──────────────────────────────────────
  const handleSend = async (overrideText?: string) => {
    const textContent = (overrideText ?? input).trim()
    if ((!textContent && !attachment) || isTyping || isStreaming) return

    // 构建 API message content
    let apiContent: string | any[]
    let displayContent = textContent

    if (attachment?.type === 'image') {
      // Vision 格式
      apiContent = [
        ...(textContent ? [{ type: 'text', text: textContent }] : []),
        { type: 'image_url', image_url: { url: attachment.data } },
      ]
      displayContent = textContent
    } else if (attachment?.type === 'text') {
      // 将文件内容作为上下文前置
      const fileContext = `\`\`\`${attachment.name}\n${attachment.data}\n\`\`\``
      apiContent = textContent
        ? `${fileContext}\n\n${textContent}`
        : fileContext
      displayContent = textContent || `（附件：${attachment.name}）`
    } else {
      apiContent = textContent
    }

    const currentAttachment = attachment
    setAttachment(null)
    setFileError('')

    const userMsg = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: displayContent,
      timestamp: Date.now(),
      attachment: currentAttachment || undefined,
    }
    const updatedMessages = [...messages, userMsg]
    updateMessages(() => updatedMessages)
    setInput('')
    setHasUnseenStreamUpdate(false)
    setIsTyping(true)

    // 清空上一轮的搜索来源
    setChatSources([])

    const aiId = (Date.now() + 1).toString()
    const apiMessages = updatedMessages.map((m, i) =>
      i === updatedMessages.length - 1
        ? { role: m.role, content: apiContent }   // 最后一条用带附件的 content
        : { role: m.role, content: m.content }
    )

    try {
      abortRef.current = new AbortController()
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: apiMessages, stream: true, use_search: useSearch }),
        signal: abortRef.current.signal,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const aiMsg: ChatMessage & { isStreaming: boolean } = {
        id: aiId, role: 'assistant', content: '', model, timestamp: Date.now(), isStreaming: true,
      }
      updateMessages(prev => [...prev, aiMsg])
      setIsTyping(false)
      setIsStreaming(true)

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let receivedDone = false
      let finalAssistantContent = ''
      let pendingChunk = ''
      let flushRaf: number | null = null

      const flushPending = () => {
        if (!pendingChunk) return
        const chunk = pendingChunk
        pendingChunk = ''
        finalAssistantContent += chunk
        updateMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: m.content + chunk } : m))
        if (!isAutoScrollRef.current) setHasUnseenStreamUpdate(true)
      }

      const scheduleFlush = () => {
        if (flushRaf !== null) return
        flushRaf = requestAnimationFrame(() => {
          flushRaf = null
          flushPending()
        })
      }

      const finalizeFlush = () => {
        if (flushRaf !== null) {
          cancelAnimationFrame(flushRaf)
          flushRaf = null
        }
        flushPending()
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') {
            receivedDone = true
            continue
          }
          try {
            const data = JSON.parse(payload)
            if (data.content) {
              pendingChunk += data.content
              scheduleFlush()
            }
            if (data.sources) {
              setChatSources(data.sources)
            }
            if (data.error) {
              finalizeFlush()
              updateMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: (m.content || finalAssistantContent) + `\n\n❌ ${data.error}`, isStreaming: false } : m))
              setIsStreaming(false)
              setTimeout(() => saveSession(), 50)
              return
            }
          } catch { /* skip */ }
        }
      }
      finalizeFlush()
      if (!receivedDone) {
        updateMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: (m.content || finalAssistantContent) + '\n\n⚠️ 本次回复连接异常中断，以下内容可能不完整。', isStreaming: false } : m))
      } else {
        updateMessages(prev => prev.map(m => m.id === aiId ? { ...m, isStreaming: false } : m))
      }
      setIsStreaming(false)
      setTimeout(() => saveSession(), 50)
    } catch (err: any) {
      setIsStreaming(false)
      if (err.name === 'AbortError') {
        updateMessages(prev => prev.map(m => m.id === aiId ? { ...m, isStreaming: false } : m))
        setTimeout(() => saveSession(), 50)
        return
      }
      setIsTyping(false)
      updateMessages(prev => [...prev, {
        id: aiId, role: 'assistant' as const, content: `❌ 请求失败: ${err.message}`, model, timestamp: Date.now(), isStreaming: false,
      }])
    }
  }

  const canSend = (input.trim().length > 0 || attachment !== null) && !isTyping && !isStreaming

  return (
    <div
      className="flex flex-col h-full bg-bg-2 quorum-surface"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖拽遮罩 */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-violet-500/10 border-2 border-dashed border-violet-400/50 rounded-2xl flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <ImageIcon size={32} className="mx-auto mb-2 text-violet-400" />
            <p className="text-violet-300 font-medium">松开以上传文件</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="desktop-sidebar-aware-header border-b border-white/5 bg-bg-1/50 backdrop-blur-sm flex-shrink-0 px-5 py-3.5 relative z-30">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden h-10 w-10 flex-shrink-0" aria-hidden="true" />
            <ModelSelector selected={model} onChange={m => {
              setModel(m)
              updateMessages(() => [])
              sessionIdRef.current = null
            }} />
          </div>
          <div className="flex items-center justify-end md:justify-start gap-2 md:gap-2">
            {isStreaming ? (
              <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-violet-300">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                SSE 实时输出中
              </span>
            ) : (
              <span className="hidden md:inline text-xs text-text-5">单模型对话</span>
            )}
            <button
              onClick={() => navigate('/discuss')}
              className="md:hidden mobile-switch-discuss flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs press-effect"
            >
              <Users size={12} />
              讨论室
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto smooth-scroll relative" onScroll={handleScroll}>
        {messages.length === 0 ? (
          <EmptyState model={model} onSend={(text) => handleSend(text)} />
        ) : (
          <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
            {messages.map(msg =>
              msg.role === 'user'
                ? <UserMessage key={msg.id} content={msg.content} attachment={(msg as any).attachment} />
                : <AssistantMessage key={msg.id} msg={msg} sources={chatSources} />
            )}
            {isTyping && <TypingIndicator modelId={model} />}
            <div ref={bottomRef} />
          </div>
        )}

        {hasUnseenStreamUpdate && (
          <button
            onClick={() => {
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
              setHasUnseenStreamUpdate(false)
            }}
            className="absolute right-5 bottom-4 px-3 py-1.5 rounded-full bg-violet-500/90 text-white text-xs shadow-lg shadow-violet-500/25 z-10 press-effect"
          >
            <span className="inline-flex items-center gap-1">
              <ChevronDown size={12} />
              查看实时输出
            </span>
          </button>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-5 py-4 mobile-safe-bottom bg-bg-2/80 backdrop-blur-sm border-t border-white/5">
        <div className="max-w-3xl mx-auto">

          {/* 附件预览条 */}
          {attachment && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-bg-3 border border-white/8 rounded-xl">
              {attachment.type === 'image' ? (
                <>
                  <img src={attachment.data} alt={attachment.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                  <span className="text-xs text-text-3 flex-1 truncate">{attachment.name}</span>
                </>
              ) : (
                <>
                  <FileText size={16} className="text-violet-400 flex-shrink-0" />
                  <span className="text-xs text-text-3 flex-1 truncate">{attachment.name}</span>
                </>
              )}
              <button onClick={() => setAttachment(null)} className="text-text-5 hover:text-red-400 transition-colors">
                <X size={14} />
              </button>
            </div>
          )}

          {/* 错误提示 */}
          {fileError && (
            <p className="text-xs text-red-400 mb-2 px-1">{fileError}</p>
          )}

          <div className={clsx(
            'relative flex items-end gap-3 bg-bg-3 border rounded-2xl px-4 py-3 min-h-[52px] input-glow transition-all',
            isDragging ? 'border-violet-400/50' : 'border-white/8'
          )}>
            {/* 附件按钮 */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 md:p-1 rounded-lg text-text-5 hover:text-violet-400 hover:bg-violet-500/10 transition-colors flex-shrink-0 mb-0.5 touch-manipulation press-effect"
              title="上传文件或图片"
            >
              <Paperclip size={16} strokeWidth={1.8} />
            </button>
            {/* 联网搜索开关 */}
            <button
              type="button"
              onClick={() => setUseSearch(prev => !prev)}
              className={clsx(
                "p-2 md:p-1 rounded-lg transition-colors flex-shrink-0 mb-0.5 touch-manipulation press-effect",
                useSearch ? "text-violet-400 bg-violet-500/10" : "text-text-5 hover:text-violet-400 hover:bg-violet-500/10"
              )}
              title={useSearch ? "已开启联网搜索" : "点击开启联网搜索"}
            >
              <Globe size={16} strokeWidth={useSearch ? 2.5 : 1.8} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.txt,.md,.py,.js,.ts,.jsx,.tsx,.json,.csv,.xml,.yaml,.yml,.html,.css,.sh,.sql,.rs,.go,.java,.c,.cpp,.h"
              onChange={handleFileChange}
            />

            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder={`向 ${getModelDisplayName(model)} 提问，或拖拽文件到此处...`}
              rows={1}
              className="flex-1 bg-transparent text-sm text-text-1 placeholder:text-text-5 resize-none outline-none leading-relaxed max-h-32 overflow-y-auto"
              style={{ minHeight: '22px' }}
            />

            {isStreaming ? (
              <button
                onClick={handleStop}
                className="w-10 h-10 md:w-8 md:h-8 rounded-xl flex items-center justify-center transition-all flex-shrink-0 bg-red-500/90 hover:bg-red-400 text-white animate-pulse press-effect touch-manipulation"
                title="停止生成"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!canSend}
                className={clsx(
                  'w-10 h-10 md:w-8 md:h-8 rounded-xl flex items-center justify-center transition-all flex-shrink-0 press-effect touch-manipulation',
                  canSend
                    ? 'bg-violet-500 hover:bg-violet-400 text-white shadow-gemini'
                    : 'bg-bg-5 text-text-5 cursor-not-allowed'
                )}
              >
                <Send size={14} />
              </button>
            )}
          </div>
          <p className="text-center text-xs text-text-5 mt-2">Enter 发送 · Shift+Enter 换行 · 支持拖拽上传图片 / 文本文件</p>
        </div>
      </div>
    </div>
  )
}
