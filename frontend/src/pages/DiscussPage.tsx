import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import { Users, Sparkles, ArrowRight, RotateCcw, Trash2, Square, Paperclip, X, FileText, ImageIcon } from 'lucide-react'
import clsx from 'clsx'
import type { ModelId, DiscussMessage } from '../types'
import { MODEL_META, getModelDisplayName } from '../types'
import { ModelAvatar } from '../components/ModelBubble'
import TypingIndicator from '../components/TypingIndicator'
import ConsensusCard from '../components/ConsensusCard'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { apiFetch } from '../lib/api'

// ─── Types ───────────────────────────────────────
type Phase = 'idle' | 'round1' | 'between' | 'round2' | 'consensus' | 'done'
const MODELS: ModelId[] = ['gpt-4o', 'gemini-2.0-flash', 'grok-2', 'deepseek-chat']

// ─── Allowed file types ───────────────────────────────
const TEXT_EXTS = ['txt', 'md', 'py', 'js', 'ts', 'jsx', 'tsx', 'json', 'csv',
  'xml', 'yaml', 'yml', 'html', 'css', 'sh', 'sql', 'rs', 'go', 'java', 'c', 'cpp', 'h']
const MAX_TEXT_MB = 2

// ─── Participant Card ─────────────────────────────
function ParticipantCard({
  modelId, status,
}: {
  modelId: ModelId
  status: 'waiting' | 'typing' | 'done' | 'idle'
}) {
  const meta = MODEL_META[modelId]
  const statusLabel = { waiting: '等待中', typing: '发言中', done: '完成', idle: '' }

  return (
    <div className={clsx(
      'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-500',
      status === 'typing' ? 'bg-bg-3 border-white/15' : 'bg-bg-2 border-white/6',
    )}>
      <div className="relative">
        <ModelAvatar modelId={modelId} size="sm" />
        {status !== 'idle' && (
          <span
            className={clsx('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg-1', status === 'typing' && 'animate-pulse')}
            style={{ background: status === 'typing' ? meta.color : status === 'done' ? '#10A37F' : '#374151' }}
          />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold" style={{ color: status === 'idle' ? '#6B7280' : meta.color }}>
          {meta.shortName}
        </p>
        {status !== 'idle' && (
          <p className="text-xs text-text-5">{statusLabel[status]}</p>
        )}
      </div>
    </div>
  )
}

// ─── Round Divider ────────────────────────────────
function RoundDivider({ round, label }: { round: number; label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 animate-fade-in">
      <div className="flex-1 h-px bg-white/6" />
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-bg-3 border border-white/8">
        <span className="text-xs font-mono font-semibold" style={{
          background: round === 1 ? 'linear-gradient(90deg,#A855F7,#06B6D4)' : 'linear-gradient(90deg,#00D4FF,#A855F7)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          第 {round} 轮
        </span>
        <span className="text-xs text-text-5">·</span>
        <span className="text-xs text-text-4">{label}</span>
      </div>
      <div className="flex-1 h-px bg-white/6" />
    </div>
  )
}

// ─── Bubble ───────────────────────────────────────
function DiscussBubble({ msg }: { msg: DiscussMessage }) {
  const meta = MODEL_META[msg.model]
  const borderMap: Record<ModelId, string> = {
    'gpt-4o': 'bubble-gpt',
    'gemini-2.0-flash': 'bubble-gemini',
    'grok-2': 'bubble-grok',
    'deepseek-chat': 'bubble-deepseek',
  }
  return (
    <div className="flex gap-3 animate-fade-in-up" style={{ opacity: 0 }}>
      <ModelAvatar modelId={msg.model} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold" style={{ color: meta.color }}>{getModelDisplayName(msg.model)}</span>
          <span className="text-xs text-text-5">{meta.description}</span>
        </div>
        <div className={clsx('bg-bg-3 rounded-xl rounded-tl-sm px-4 py-3.5 text-sm text-text-2 leading-relaxed', borderMap[msg.model])}>
          <MarkdownRenderer
            content={msg.content}
            isStreaming={!!msg.isStreaming}
            accentColor={meta.color}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Empty State (with discussion history) ────────
function DiscussEmptyState({ onStart, onLoad, onDelete }: { onStart: (topic: string) => void; onLoad: (id: string) => void; onDelete?: (id: string) => void }) {
  const [topic, setTopic] = useState('')
  const [history, setHistory] = useState<{ id: string; title: string; preview: string; createdAt: string }[]>([])
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null)
  const [fileError, setFileError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const suggestions = [
    'AI会在5年内取代大多数程序员吗？',
    '创业公司应该选择微服务还是单体架构？',
    'Web3和区块链的未来还有多大空间？',
    '远程工作是否会永久改变工作文化？',
  ]

  const processFile = useCallback((file: File) => {
    setFileError('')
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const sizeMB = file.size / 1024 / 1024
    if (TEXT_EXTS.includes(ext)) {
      if (sizeMB > MAX_TEXT_MB) { setFileError(`文件不能超过 ${MAX_TEXT_MB}MB`); return }
      const reader = new FileReader()
      reader.onload = e => {
        setAttachment({ name: file.name, content: e.target!.result as string })
      }
      reader.readAsText(file, 'utf-8')
    } else if (ext === 'pdf') {
      setFileError('PDF 暂不支持，请将内容复制粘贴后发送')
    } else if (file.type.startsWith('image/')) {
      setFileError('讨论室暂不支持图片附件，请在单模型对话中使用')
    } else {
      setFileError(`不支持的文件类型：.${ext}`)
    }
  }, [])

  const handleStart = () => {
    const t = topic.trim()
    if (!t && !attachment) return
    let finalTopic = t
    if (attachment) {
      const fileContext = `\`\`\`${attachment.name}\n${attachment.content}\n\`\`\``
      finalTopic = t ? `${fileContext}\n\n${t}` : `请分析以下文件内容：\n\n${fileContext}`
    }
    onStart(finalTopic)
  }

  useEffect(() => {
    apiFetch('/api/sessions?limit=20')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const items = data
          .filter((s: any) => s.type === 'discuss')
          .map((s: any) => ({
            id: s.id,
            title: s.title || s.topic || '未命名讨论',
            preview: s.preview || '',
            createdAt: new Date(s.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
          }))
        setHistory(items)
      })
      .catch(() => { })
  }, [])

  const canStart = topic.trim().length > 0 || attachment !== null

  return (
    <div
      className="flex flex-col items-center h-full px-4 sm:px-6 pt-8 sm:pt-12 overflow-y-auto"
      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f) }}
    >
      {/* 拖拽遮罩 */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-violet-500/10 border-2 border-dashed border-violet-400/50 rounded-2xl flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <FileText size={32} className="mx-auto mb-2 text-violet-400" />
            <p className="text-violet-300 font-medium">松开以上传文件</p>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="mb-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl border-gradient-gemini flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-400/20" />
          <Users size={28} className="text-violet-300 relative z-10" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">
          <span className="gradient-text-brand">群聊讨论室</span>
        </h1>
        <p className="text-sm text-text-4 max-w-md">
          输入一个观点或问题，让多个模型展开真实讨论，最终达成共识。
        </p>
      </div>

      {/* Input area */}
      <div className="w-full max-w-xl mb-6">
        {/* 附件预览 */}
        {attachment && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-bg-3 border border-white/8 rounded-xl">
            <FileText size={16} className="text-violet-400 flex-shrink-0" />
            <span className="text-xs text-text-3 flex-1 truncate">{attachment.name}</span>
            <button onClick={() => setAttachment(null)} className="text-text-5 hover:text-red-400 transition-colors">
              <X size={14} />
            </button>
          </div>
        )}
        {fileError && <p className="text-xs text-red-400 mb-2 px-1">{fileError}</p>}

        <div className="relative bg-bg-3 border border-white/10 rounded-2xl p-1 input-glow transition-all">
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && canStart) { e.preventDefault(); handleStart() } }}
            placeholder="+ 输入讨论议题，或拖拽文件到此处..."
            rows={1}
            className="w-full bg-transparent text-sm text-text-1 placeholder:text-text-5 px-4 pt-3 pb-2 resize-none outline-none leading-relaxed"
          />
          <div className="flex items-center justify-between px-3 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1 rounded-lg text-text-5 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                title="上传文本文件作为讨论素材"
              >
                <Paperclip size={14} strokeWidth={1.8} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".txt,.md,.py,.js,.ts,.jsx,.tsx,.json,.csv,.xml,.yaml,.yml,.html,.css,.sh,.sql,.rs,.go,.java,.c,.cpp,.h"
                onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '' }}
              />
              <span className="text-xs text-text-5">Enter 开始讨论</span>
            </div>
            <button
              onClick={handleStart}
              disabled={!canStart}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all',
                canStart
                  ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white hover:opacity-90 shadow-gemini'
                  : 'bg-bg-5 text-text-5 cursor-not-allowed'
              )}
            >
              <Sparkles size={12} />
              开启讨论
            </button>
          </div>
        </div>

        {/* Suggestions */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => onStart(s)}
              className="glass glass-hover px-3 py-2 rounded-xl text-xs text-text-4 hover:text-text-2 text-left leading-snug transition-all"
            >
              <ArrowRight size={10} className="inline mr-1.5 opacity-50" />
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Discussion History (ChatGPT project-style) */}
      {history.length > 0 && (
        <div className="w-full max-w-xl mt-2 mb-8">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Users size={12} className="text-violet-400" />
            <span className="text-xs font-medium text-text-3 uppercase tracking-wider">历史讨论</span>
          </div>
          <div className="space-y-1">
            {history.map(item => (
              <button
                key={item.id}
                onClick={() => onLoad(item.id)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl glass glass-hover transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Sparkles size={14} className="text-violet-400 flex-shrink-0" />
                  <span className="text-sm text-text-2 group-hover:text-text-1 truncate transition-colors">
                    {item.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <span className="text-xs text-text-5">{item.createdAt}</span>
                  {onDelete && (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); onDelete(item.id); setHistory(prev => prev.filter(h => h.id !== item.id)) }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 text-text-5 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={12} />
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── DiscussPage ──────────────────────────────────
export default function DiscussPage({ active, sessionId }: { active: boolean; sessionId?: string }) {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [messages, setMessages] = useState<DiscussMessage[]>([])
  const [typingModels, setTypingModels] = useState<ModelId[]>([])
  const [modelStatus, setModelStatus] = useState<Record<ModelId, 'waiting' | 'typing' | 'done' | 'idle'>>({
    'gpt-4o': 'idle', 'gemini-2.0-flash': 'idle', 'grok-2': 'idle', 'deepseek-chat': 'idle',
  })
  const [consensusContent, setConsensusContent] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const sessionIdRef = useRef<string | null>(sessionId || null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Refs to avoid closure traps in saveDiscussion
  const topicRef = useRef(topic)
  const messagesRef = useRef<DiscussMessage[]>(messages)
  const consensusRef = useRef(consensusContent)
  topicRef.current = topic
  messagesRef.current = messages
  consensusRef.current = consensusContent

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingModels, consensusContent])

  // 加载历史讨论（仅在 active 且 sessionId 变化时触发）
  useEffect(() => {
    if (!active) return  // 页面隐藏时不加载，防止打断正在进行的讨论
    if (!sessionId) {
      sessionIdRef.current = null
      return
    }
    if (sessionIdRef.current === sessionId) return  // 已加载，跳过
    apiFetch(`/api/sessions/${sessionId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        sessionIdRef.current = sessionId
        setTopic(data.topic || '')
        setConsensusContent(data.consensus || '')
        setPhase('done')
        setModelStatus({ 'gpt-4o': 'done', 'gemini-2.0-flash': 'done', 'grok-2': 'done', 'deepseek-chat': 'done' })
        const msgs = (data.messages || []).map((m: any, i: number) => ({
          id: m.id || String(i),
          model: m.model as ModelId,
          round: m.round || 1,
          content: m.content,
          isStreaming: false,
          timestamp: new Date(m.created_at).getTime(),
        }))
        setMessages(msgs)
      })
      .catch(() => { })
  }, [active, sessionId])

  // 保存讨论到 Supabase（使用 refs 避免闭包陷阱，PUT 全量替换）
  const saveDiscussion = useCallback(async () => {
    try {
      const currentTopic = topicRef.current
      const currentMessages = messagesRef.current
      const currentConsensus = consensusRef.current
      const title = currentTopic.slice(0, 50) || '群聊讨论'

      let sid = sessionIdRef.current
      if (!sid) {
        const res = await apiFetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'discuss', title, topic: currentTopic, preview: '讨论进行中...' }),
        })
        if (!res.ok) return
        const session = await res.json()
        sid = session.id
        sessionIdRef.current = sid
      }

      // PUT 全量替换消息，避免重复追加
      const msgPayload = currentMessages.map(m => ({
        role: 'model',
        content: m.content,
        model: m.model,
        round: m.round,
      }))
      if (msgPayload.length > 0) {
        await apiFetch(`/api/sessions/${sid}/messages`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: msgPayload }),
        })
      }

      // 更新 session 的 preview 和 consensus
      await apiFetch(`/api/sessions/${sid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preview: currentConsensus.slice(0, 80) || '讨论完成',
          consensus: currentConsensus,
        }),
      })

      window.dispatchEvent(new Event('history-updated'))
    } catch { /* 静默 */ }
  }, [])

  const runDiscussion = useCallback(async (t: string) => {
    setTopic(t)
    setPhase('round1')
    setMessages([])
    setConsensusContent('')
    setModelStatus({ 'gpt-4o': 'waiting', 'gemini-2.0-flash': 'waiting', 'grok-2': 'waiting', 'deepseek-chat': 'waiting' })
    setTypingModels([])

    // 跟踪每个模型的消息 ID（用于增量更新内容）
    const msgIds: Record<string, string> = {}
    let currentRound = 1

    try {
      abortRef.current = new AbortController()
      const res = await apiFetch('/api/discuss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t, models: MODELS, rounds: 2 }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

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
          if (!payload) continue

          try {
            const evt = JSON.parse(payload)

            switch (evt.type) {
              case 'round_start': {
                currentRound = evt.round
                if (evt.round === 2) {
                  setPhase('round2')
                  setModelStatus({ 'gpt-4o': 'waiting', 'gemini-2.0-flash': 'waiting', 'grok-2': 'waiting', 'deepseek-chat': 'waiting' })
                }
                break
              }

              case 'model_chunk': {
                const model = evt.model as ModelId
                const round = evt.round as number
                const key = `r${round}-${model}`

                // 首次收到该模型的 chunk → 创建消息
                if (!msgIds[key]) {
                  msgIds[key] = key
                  setModelStatus(prev => ({ ...prev, [model]: 'typing' }))
                  setTypingModels(prev => prev.filter(m => m !== model))

                  const newMsg: DiscussMessage = {
                    id: key, model, round,
                    content: evt.content, isStreaming: true, timestamp: Date.now(),
                  }
                  setMessages(prev => [...prev, newMsg])
                } else {
                  // 增量追加
                  setMessages(prev =>
                    prev.map(m => m.id === key ? { ...m, content: m.content + evt.content } : m)
                  )
                }
                break
              }

              case 'model_done': {
                const model = evt.model as ModelId
                const round = evt.round as number
                const key = `r${round}-${model}`
                setModelStatus(prev => ({ ...prev, [model]: 'done' }))
                setMessages(prev =>
                  prev.map(m => m.id === key ? { ...m, isStreaming: false } : m)
                )
                break
              }

              case 'consensus_chunk': {
                setPhase('consensus')
                setConsensusContent(prev => prev + evt.content)
                break
              }

              case 'done': {
                setPhase('done')
                setTypingModels([])
                // 保存到 Supabase
                saveDiscussion()
                break
              }
            }
          } catch { /* skip malformed */ }
        }
      }

      // 确保最终状态
      setPhase('done')
      setTypingModels([])
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // 中断后保留已接收的消息，标记所有流结束
        setMessages(prev => prev.map(m => ({ ...m, isStreaming: false })))
        setTypingModels([])
        setPhase('done')
        setModelStatus({ 'gpt-4o': 'done', 'gemini-2.0-flash': 'done', 'grok-2': 'done', 'deepseek-chat': 'done' })
        setTimeout(() => saveDiscussion(), 50)
        return
      }
      console.error('Discussion error:', err)
      setPhase('done')
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' })
      window.dispatchEvent(new Event('history-updated'))
    } catch { /* 静默 */ }
  }, [])

  // 中断讨论（保留已接收内容）
  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  const handleReset = () => {
    if (abortRef.current) abortRef.current.abort()
    sessionIdRef.current = null
    setPhase('idle')
    setTopic('')
    setMessages([])
    setConsensusContent('')
    setTypingModels([])
    setModelStatus({ 'gpt-4o': 'idle', 'gemini-2.0-flash': 'idle', 'grok-2': 'idle', 'deepseek-chat': 'idle' })
    navigate('/discuss', { replace: true })
  }

  const r1Messages = messages.filter(m => m.round === 1)
  const r2Messages = messages.filter(m => m.round === 2)
  const showR2Divider = phase === 'round2' || phase === 'consensus' || phase === 'done'
  const showR2 = r2Messages.length > 0
  const showConsensus = consensusContent.length > 0

  if (phase === 'idle') {
    return (
      <div className="h-full bg-bg-2 overflow-y-auto">
        <DiscussEmptyState
          onStart={runDiscussion}
          onLoad={(id) => navigate(`/discuss/${id}`)}
          onDelete={handleDelete}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-bg-2">
      {/* Header */}
      <header className="flex items-center justify-between pl-12 md:pl-5 pr-5 py-3.5 border-b border-white/5 bg-bg-1/60 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/30 to-cyan-500/30 flex items-center justify-center flex-shrink-0">
            <Users size={14} className="text-violet-300" />
          </div>
          <span className="text-sm font-medium text-text-1 truncate max-w-xs">{topic}</span>
          {phase !== 'done' && (
            <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 animate-pulse">
              讨论中
            </span>
          )}
          {phase === 'done' && (
            <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
              已完成
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Participant indicators */}
          <div className="hidden md:flex items-center gap-1.5">
            {MODELS.map(m => (
              <ParticipantCard key={m} modelId={m} status={modelStatus[m]} />
            ))}
          </div>
          {phase !== 'done' && (
            <button
              onClick={handleStop}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-red-500/15 border border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/25 transition-all"
              title="停止讨论"
            >
              <Square size={10} fill="currentColor" />
              停止
            </button>
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 glass glass-hover rounded-xl text-xs text-text-4 hover:text-text-2 transition-all"
          >
            <RotateCcw size={12} />
            新议题
          </button>
        </div>
      </header>

      {/* Discussion feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 py-6 space-y-4">

          {/* Round 1 */}
          <RoundDivider round={1} label="各抒己见" />
          {r1Messages.map(msg => <DiscussBubble key={msg.id} msg={msg} />)}
          {typingModels.filter(() => phase === 'round1').map(m => (
            <TypingIndicator key={m} modelId={m} />
          ))}

          {/* Round 2 */}
          {showR2Divider && <RoundDivider round={2} label="深度互动" />}
          {showR2 && r2Messages.map(msg => <DiscussBubble key={msg.id} msg={msg} />)}
          {typingModels.filter(() => phase === 'round2').map(m => (
            <TypingIndicator key={m} modelId={m} label={`${MODEL_META[m].shortName} 正在回应其他模型`} />
          ))}

          {/* Consensus */}
          {showConsensus && (
            <>
              <div className="flex items-center gap-3 py-2 animate-fade-in">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
                <span className="text-xs gradient-text-gemini font-semibold tracking-wide">达成共识</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
              </div>
              <ConsensusCard content={consensusContent} />
            </>
          )}

          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

      {/* Footer hint */}
      {phase === 'done' && (
        <div className="flex-shrink-0 px-5 py-3 border-t border-white/5 bg-bg-1/40 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <p className="text-xs text-text-5">讨论已完成 · 基于 2 轮对话达成共识</p>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium bg-gradient-to-r from-violet-500/20 to-cyan-500/20 border border-violet-500/30 text-violet-300 hover:text-violet-200 hover:border-violet-500/50 transition-all"
            >
              <Sparkles size={12} />
              开启新讨论
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
