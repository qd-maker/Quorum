import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Users, Sparkles, Send, RotateCcw, ArrowRight, Share2,
  MessageSquare, Layout, LogOut, ChevronDown, Paperclip, Globe,
  Trash2, X, Plus, Square, ChevronRight, FileText, Check, ImageIcon
} from 'lucide-react'
import clsx from 'clsx'
import type { ModelId, DiscussMessage } from '../types'
import { MODEL_META, getModelDisplayName } from '../types'
import { ModelAvatar } from '../components/ModelBubble'
import TypingIndicator from '../components/TypingIndicator'
import ConsensusCard from '../components/ConsensusCard'
import MarkdownRenderer from '../components/MarkdownRenderer'
import CopyButton from '../components/CopyButton'
import { apiFetch } from '../lib/api'

// ─── Types ───────────────────────────────────────
type Phase = 'idle' | 'round1' | 'between' | 'round2' | 'consensus' | 'done'
interface FollowUpItem { question: string; answer: string; isStreaming: boolean }
interface ModelError { model: string; error: string }
const MODELS: ModelId[] = ['gpt-4o', 'gemini-2.0-flash', 'grok-2', 'deepseek-chat']
const ROLES = [
  { id: 'general', label: '通用助手', desc: '客观中立，平衡各方观点' },
  { id: 'tech', label: '技术专家', desc: '专注架构、性能和代码质量' },
  { id: 'critic', label: '严厉批评者', desc: '挑战假设，指出潜在隐患' },
  { id: 'creative', label: '创意大师', desc: '跳出框框，提供新颖方案' },
  { id: 'product', label: '产品经理', desc: '平衡用户价值与商业落地' }
]

const RECOMMENDED_PRESETS = [
  { label: '极客对峙', roles: { 'gpt-4o': '技术专家', 'gemini-2.0-flash': '技术专家', 'grok-2': '严厉批评者', 'deepseek-chat': '技术专家' } },
  { label: '头脑风暴', roles: { 'gpt-4o': '创意大师', 'gemini-2.0-flash': '产品经理', 'grok-2': '创意大师', 'deepseek-chat': '通用助手' } },
  { label: '深度评审', roles: { 'gpt-4o': '严厉批评者', 'gemini-2.0-flash': '技术专家', 'grok-2': '产品经理', 'deepseek-chat': '严厉批评者' } }
]


function toPreviewPlainText(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^\)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+[.)]\s+/gm, '')
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/>\s?/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}


function RoleDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-[100px] bg-bg-4 hover:bg-bg-5 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-text-2 transition-all outline-none"
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={10} className={clsx("transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-full right-0 mb-1 w-48 bg-bg-3 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-spring-pop origin-bottom-right">
            <div className="p-1.5 space-y-0.5">
              {ROLES.map(r => (
                <button
                  key={r.id}
                  onClick={() => { onChange(r.label); setIsOpen(false) }}
                  className={clsx(
                    "w-full flex flex-col items-start px-2.5 py-1.5 rounded-lg transition-colors text-left group",
                    value === r.label ? "bg-violet-500/20 text-violet-300" : "hover:bg-white/5 text-text-3 hover:text-text-2"
                  )}
                >
                  <span className="text-[11px] font-semibold">{r.label}</span>
                  <span className="text-[9px] opacity-50 leading-tight mt-0.5">{r.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}


// ─── Allowed file types ───────────────────────────────
const TEXT_EXTS = ['txt', 'md', 'py', 'js', 'ts', 'jsx', 'tsx', 'json', 'csv',
  'xml', 'yaml', 'yml', 'html', 'css', 'sh', 'sql', 'rs', 'go', 'java', 'c', 'cpp', 'h']
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
const MAX_TEXT_MB = 2
const MAX_IMAGE_MB = 4

// ─── Participant Card ─────────────────────────────
function ParticipantCard({
  modelId, status, onClick
}: {
  modelId: ModelId
  status: 'waiting' | 'typing' | 'done' | 'idle' | 'error'
  onClick?: () => void
}) {
  const meta = MODEL_META[modelId]
  const statusLabel: Record<string, string> = { waiting: '等待中', typing: '发言中', done: '完成', idle: '', error: '出错' }
  const dotColor: Record<string, string> = { waiting: '#374151', typing: meta.color, done: '#10A37F', idle: '', error: '#EF4444' }

  return (
    <div
      onClick={onClick}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`)
        e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`)
      }}
      className={clsx(
        'spotlight-card flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-500',
        status === 'typing' ? 'bg-bg-3 border-white/15' : status === 'error' ? 'bg-red-500/5 border-red-500/20' : 'bg-bg-2 border-white/6',
        onClick && 'cursor-pointer hover:bg-bg-3'
      )}>
      <div className="relative">
        <ModelAvatar modelId={modelId} size="sm" />
        {status !== 'idle' && (
          <span
            className={clsx('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg-1', status === 'typing' && 'animate-pulse')}
            style={{ background: dotColor[status] }}
          />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold" style={{ color: status === 'idle' ? '#6B7280' : status === 'error' ? '#EF4444' : meta.color }}>
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

function DiscussionStepper({ phase, onJump }: { phase: Phase; onJump?: (step: 1 | 2 | 3) => void }) {
  const steps = ['观点发散', '交叉讨论', '共识汇总']
  const currentStep =
    phase === 'round1' ? 1 :
      phase === 'round2' ? 2 :
        phase === 'consensus' ? 3 :
          phase === 'done' ? 4 : 0

  return (
    <div className="mb-5 rounded-2xl border border-white/8 bg-bg-3/40 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={12} className="text-violet-400" />
        <span className="text-[11px] text-text-4 uppercase tracking-wider">讨论进度</span>
      </div>
      <div className="flex items-center gap-2">
        {steps.map((step, idx) => {
          const stepNo = (idx + 1) as 1 | 2 | 3
          const done = currentStep > stepNo || phase === 'done'
          const active = currentStep === stepNo
          const canJump = currentStep >= stepNo || phase === 'done'

          return (
            <button
              key={step}
              type="button"
              onClick={() => canJump && onJump?.(stepNo)}
              className={clsx(
                'flex-1 flex items-center gap-2 min-w-0 text-left rounded-lg transition-colors',
                canJump ? 'cursor-pointer hover:bg-white/5' : 'cursor-not-allowed'
              )}
            >
              <div className={clsx(
                'w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold transition-colors',
                done
                  ? 'bg-emerald-500/90 border-emerald-400 text-white'
                  : active
                    ? 'bg-violet-500/80 border-violet-400 text-white'
                    : 'bg-bg-4 border-white/10 text-text-5'
              )}>
                {done ? <Check size={11} /> : stepNo}
              </div>
              <span className={clsx(
                'text-xs truncate transition-colors',
                active ? 'text-text-2' : done ? 'text-emerald-300' : 'text-text-5'
              )}>
                {step}
              </span>
              {idx < steps.length - 1 && (
                <div className={clsx(
                  'flex-1 h-px min-w-3 transition-colors',
                  currentStep > stepNo ? 'bg-emerald-400/60' : 'bg-white/8'
                )} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Bubble ───────────────────────────────────────
function DiscussBubble({ msg, index = 0, sources = [] }: { msg: DiscussMessage; index?: number; sources?: { title: string; url: string }[] }) {
  const meta = MODEL_META[msg.model]
  const borderMap: Record<ModelId, string> = {
    'gpt-4o': 'bubble-gpt',
    'gemini-2.0-flash': 'bubble-gemini',
    'grok-2': 'bubble-grok',
    'deepseek-chat': 'bubble-deepseek',
  }
  const staggerClass = `stagger-${Math.min(index + 1, 8)}`
  return (
    <div id={msg.id} className={clsx('flex gap-3 msg-enter gpu-accelerated', staggerClass)}>
      <ModelAvatar modelId={msg.model} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold" style={{ color: meta.color }}>{getModelDisplayName(msg.model)}</span>
          {msg.role && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-text-3 border border-white/5">
              {msg.role}
            </span>
          )}
          <span className="text-xs text-text-5">{meta.description}</span>
        </div>
        <div className={clsx('bg-bg-3 rounded-xl rounded-tl-sm px-4 py-3.5 text-sm text-text-2 leading-relaxed group/bubble relative', borderMap[msg.model])}>
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

// ─── FollowUp Bubble ─────────────────────────────
function FollowUpBubble({ item }: { item: FollowUpItem }) {
  return (
    <div className="space-y-3 animate-fade-in">
      {/* 用户追问 */}
      <div className="flex justify-end">
        <div className="max-w-[78%] px-4 py-3 rounded-xl rounded-tr-sm bg-violet-500/20 border border-violet-500/25 text-sm text-text-2 leading-relaxed">
          {item.question}
        </div>
      </div>
      {/* 主持人回复 */}
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/40 to-cyan-500/40 flex items-center justify-center flex-shrink-0 border border-violet-500/30">
          <Sparkles size={14} className="text-violet-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-violet-300">主持人</span>
            <span className="text-xs text-text-5">综合分析</span>
          </div>
          <div className="bg-bg-3 rounded-xl rounded-tl-sm px-4 py-3.5 text-sm text-text-2 leading-relaxed border border-violet-500/15 group/bubble relative">
            {item.answer
              ? <MarkdownRenderer content={item.answer} isStreaming={item.isStreaming} accentColor="#8B5CF6" />
              : <span className="opacity-40">正在思考...</span>
            }
            {item.answer && !item.isStreaming && (
              <div className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover/bubble:opacity-100 transition-opacity">
                <CopyButton content={item.answer} className="p-1 hover:bg-white/10" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Empty State (with discussion history) ────────
function DiscussEmptyState({ onStart, onLoad, onDelete }: {
  onStart: (topic: string, roles: Record<string, string>, imageData?: string, useSearch?: boolean) => void;
  onLoad: (id: string) => void;
  onDelete?: (id: string) => void
}) {
  const [topic, setTopic] = useState('')
  const [history, setHistory] = useState<{ id: string; title: string; preview: string; createdAt: string }[]>([])
  const [modelRoles, setModelRoles] = useState<Record<string, string>>({
    'gpt-4o': '技术专家',
    'gemini-2.0-flash': '通用助手',
    'grok-2': '创意大师',
    'deepseek-chat': '严厉批评者'
  })
  const [showRoleSetting, setShowRoleSetting] = useState(false)
  const [useSearch, setUseSearch] = useState(false)

  const [attachment, setAttachment] = useState<{ type: 'image' | 'text'; name: string; content: string } | null>(null)
  const [fileError, setFileError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSmartRoles = () => {
    const t = topic.toLowerCase()
    if (t.length < 5) return
    let preset = RECOMMENDED_PRESETS[2] // 默认深度评审
    if (t.includes('代码') || t.includes('技术') || t.includes('架构') || t.includes('性能')) {
      preset = RECOMMENDED_PRESETS[0]
    } else if (t.includes('创意') || t.includes('想法') || t.includes('策划') || t.includes('方案')) {
      preset = RECOMMENDED_PRESETS[1]
    }
    setModelRoles(preset.roles)
    setShowRoleSetting(true)
  }

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
    if (IMAGE_TYPES.includes(file.type) || file.type.startsWith('image/')) {
      if (sizeMB > MAX_IMAGE_MB) { setFileError(`图片不能超过 ${MAX_IMAGE_MB}MB`); return }
      const reader = new FileReader()
      reader.onload = e => {
        setAttachment({ type: 'image', name: file.name, content: e.target!.result as string })
      }
      reader.readAsDataURL(file)
    } else if (TEXT_EXTS.includes(ext)) {
      if (sizeMB > MAX_TEXT_MB) { setFileError(`文件不能超过 ${MAX_TEXT_MB}MB`); return }
      const reader = new FileReader()
      reader.onload = e => {
        setAttachment({ type: 'text', name: file.name, content: e.target!.result as string })
      }
      reader.readAsText(file, 'utf-8')
    } else if (ext === 'pdf') {
      setFileError('PDF 暂不支持，请将内容复制粘贴后发送')
    } else {
      setFileError(`不支持的文件类型：.${ext}`)
    }
  }, [])

  const handleStart = () => {
    const t = topic.trim()
    if (!t && !attachment) return
    if (attachment?.type === 'image') {
      const finalTopic = t || `请分析这张图片的内容`
      onStart(finalTopic, modelRoles, attachment.content, useSearch)
    } else if (attachment?.type === 'text') {
      const fileContext = `\`\`\`${attachment.name}\n${attachment.content}\n\`\`\``
      const finalTopic = t ? `${fileContext}\n\n${t}` : `请分析以下文件内容：\n\n${fileContext}`
      onStart(finalTopic, modelRoles, undefined, useSearch)
    } else {
      onStart(t, modelRoles, undefined, useSearch)
    }
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
            preview: toPreviewPlainText(s.preview || s.consensus || ''),
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
            {attachment.type === 'image' ? (
              <img src={attachment.content} alt={attachment.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <FileText size={16} className="text-violet-400 flex-shrink-0" />
            )}
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
                title="上传文件或图片作为讨论素材"
              >
                <Paperclip size={14} strokeWidth={1.8} />
              </button>
              {/* 联网搜索开关 */}
              <button
                onClick={() => setUseSearch(prev => !prev)}
                className={clsx(
                  "p-1 rounded-lg transition-colors flex-shrink-0",
                  useSearch ? "text-violet-400 bg-violet-500/10" : "text-text-5 hover:text-violet-400 hover:bg-violet-500/10"
                )}
                title={useSearch ? "已开启联网搜索" : "点击开启联网搜索"}
              >
                <Globe size={14} strokeWidth={useSearch ? 2.5 : 1.8} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.txt,.md,.py,.js,.ts,.jsx,.tsx,.json,.csv,.xml,.yaml,.yml,.html,.css,.sh,.sql,.rs,.go,.java,.c,.cpp,.h"
                onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '' }}
              />
              <span className="text-xs text-text-5">Enter 开始讨论</span>
            </div>
            <button
              onClick={handleStart}
              disabled={!canStart}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all press-effect',
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

        {/* Role Settings Toggle */}
        <div className="mt-4 mb-2 px-1 flex items-center justify-between">
          <button
            onClick={() => setShowRoleSetting(!showRoleSetting)}
            className="flex items-center gap-2 text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            <Users size={12} />
            {showRoleSetting ? '收起角色设置' : '为各模型分配角色 (可选)'}
          </button>

          {!showRoleSetting && topic.length > 5 && (
            <button
              onClick={handleSmartRoles}
              className="flex items-center gap-1.5 text-[10px] bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full hover:bg-violet-500/20 transition-all border border-violet-500/20"
            >
              <Sparkles size={10} />
              AI 智能分配角色
            </button>
          )}
        </div>

        {showRoleSetting && (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
            {MODELS.map(m => (
              <div key={m} className="bg-bg-3/50 border border-white/5 rounded-xl p-2.5 flex items-center justify-between group">
                <div className="flex items-center gap-2 min-w-0">
                  <ModelAvatar modelId={m} size="sm" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-text-3">{MODEL_META[m].shortName}</span>
                    <span className="text-[9px] text-text-5 truncate max-w-[80px]">{MODEL_META[m].description.split(' · ')[1]}</span>
                  </div>
                </div>
                <RoleDropdown
                  value={modelRoles[m]}
                  onChange={(v) => setModelRoles(prev => ({ ...prev, [m]: v }))}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="w-full max-w-xl mt-3 grid grid-cols-2 gap-2">
        {suggestions.map(s => (
          <button
            key={s}
            onClick={() => onStart(s, modelRoles)}
            className="glass glass-hover px-3 py-2 rounded-xl text-xs text-text-4 hover:text-text-2 text-left leading-snug transition-all"
          >
            <ArrowRight size={10} className="inline mr-1.5 opacity-50" />
            {s}
          </button>
        ))}
      </div>

      {/* Discussion History */}
      {history.length > 0 && (
        <div className="w-full max-w-xl mt-8 mb-12">
          <div className="flex items-center gap-2 mb-3 px-1">
            <FileText size={12} className="text-violet-400" />
            <span className="text-xs font-medium text-text-3 uppercase tracking-wider">最近讨论记录</span>
          </div>
          <div className="space-y-2">
            {history.map(item => (
              <button
                key={item.id}
                onClick={() => onLoad(item.id)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl glass glass-hover transition-all group border border-white/5 hover-lift"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-500/10 transition-colors">
                    <FileText size={14} className="text-violet-400" />
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-sm text-text-2 group-hover:text-text-1 font-medium truncate w-full transition-colors text-left">
                      {item.title}
                    </span>
                    <span className="text-[11px] text-text-4 truncate w-full text-left">{item.preview || '暂无摘要'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <span className="text-[10px] text-text-5">{item.createdAt}</span>
                  {onDelete && (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); onDelete(item.id); setHistory(prev => prev.filter(h => h.id !== item.id)) }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/10 text-text-5 hover:text-red-400 transition-all"
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
  const [roles, setRoles] = useState<Record<string, string>>({})
  const [phase, setPhase] = useState<Phase>('idle')

  const [messages, setMessages] = useState<DiscussMessage[]>([])
  const [typingModels, setTypingModels] = useState<ModelId[]>([])
  const [modelStatus, setModelStatus] = useState<Record<ModelId, 'waiting' | 'typing' | 'done' | 'idle' | 'error'>>({
    'gpt-4o': 'idle', 'gemini-2.0-flash': 'idle', 'grok-2': 'idle', 'deepseek-chat': 'idle',
  })
  const [consensusContent, setConsensusContent] = useState('')
  const [searchSources, setSearchSources] = useState<{ title: string; url: string }[]>([])
  const [modelErrors, setModelErrors] = useState<ModelError[]>([])
  const [followUpItems, setFollowUpItems] = useState<FollowUpItem[]>([])
  const [followUpInput, setFollowUpInput] = useState('')
  const [isFollowingUp, setIsFollowingUp] = useState(false)
  const [followUpAttachment, setFollowUpAttachment] = useState<{ type: 'image' | 'text'; name: string; content: string } | null>(null)
  const [followUpFileError, setFollowUpFileError] = useState('')
  const [useFollowUpSearch, setUseFollowUpSearch] = useState(false)
  const [hasUnseenStreamUpdate, setHasUnseenStreamUpdate] = useState(false)
  const followUpFileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const followUpAbortRef = useRef<AbortController | null>(null)
  const sessionIdRef = useRef<string | null>(sessionId || null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const round1AnchorRef = useRef<HTMLDivElement>(null)
  const round2AnchorRef = useRef<HTMLDivElement>(null)
  const consensusAnchorRef = useRef<HTMLDivElement>(null)
  const isAutoScrollRef = useRef(true)

  // Refs to avoid closure traps in saveDiscussion
  const topicRef = useRef(topic)
  const messagesRef = useRef<DiscussMessage[]>(messages)
  const consensusRef = useRef(consensusContent)
  topicRef.current = topic
  messagesRef.current = messages
  consensusRef.current = consensusContent

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    // 如果滚动到底部（阈值 100px），重新开启自动滚动；否则锁定不滚动
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100
    isAutoScrollRef.current = isAtBottom
    if (isAtBottom) setHasUnseenStreamUpdate(false)
  }

  useEffect(() => {
    if (isAutoScrollRef.current) {
      // 使用默认的 auto 或者 smooth，平滑更舒适，且不打断用户阅读
      bottomRef.current?.scrollIntoView({ behavior: 'auto' })
    }
  }, [messages, typingModels, consensusContent, followUpItems])

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
  const saveDiscussion = useCallback(async (consensusOverride?: string) => {
    try {
      const currentTopic = topicRef.current
      const currentMessages = messagesRef.current
      const currentConsensus = consensusOverride ?? consensusRef.current
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

  const runDiscussion = useCallback(async (t: string, assignedRoles: Record<string, string>, imageData?: string, use_search = false) => {
    setTopic(t)
    setRoles(assignedRoles)
    setPhase('round1')
    setMessages([])
    setConsensusContent('')
    setSearchSources([])
    setModelErrors([])
    setHasUnseenStreamUpdate(false)
    setModelStatus({ 'gpt-4o': 'waiting', 'gemini-2.0-flash': 'waiting', 'grok-2': 'waiting', 'deepseek-chat': 'waiting' })
    setTypingModels([])

    // 跟踪每个模型的消息 ID（用于增量更新内容）
    const msgIds: Record<string, string> = {}
    let currentRound = 1
    let receivedDone = false
    let finalConsensus = ''
    const pendingByMsgId: Record<string, string> = {}
    let pendingConsensus = ''
    let flushRaf: number | null = null

    const flushPending = () => {
      const appendEntries = Object.entries(pendingByMsgId).filter(([, chunk]) => chunk.length > 0)
      if (appendEntries.length > 0) {
        const appendMap = Object.fromEntries(appendEntries)
        setMessages(prev => prev.map(m => appendMap[m.id] ? { ...m, content: m.content + appendMap[m.id] } : m))
        for (const [id] of appendEntries) pendingByMsgId[id] = ''
      }
      if (pendingConsensus) {
        finalConsensus += pendingConsensus
        setConsensusContent(prev => prev + pendingConsensus)
        pendingConsensus = ''
      }
      if (!isAutoScrollRef.current && (appendEntries.length > 0 || finalConsensus.length > 0)) {
        setHasUnseenStreamUpdate(true)
      }
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

    try {
      abortRef.current = new AbortController()
      const reqBody: any = { topic: t, models: MODELS, rounds: 2, roles: assignedRoles, use_search }
      if (imageData) reqBody.image = imageData
      const res = await apiFetch('/api/discuss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
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
              case 'search_done': {
                if (evt.sources) setSearchSources(evt.sources)
                break
              }
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
                    role: assignedRoles[model], // 使用本次讨论分配的角色
                    content: '', isStreaming: true, timestamp: Date.now(),
                  }
                  setMessages(prev => [...prev, newMsg])
                }

                pendingByMsgId[key] = (pendingByMsgId[key] || '') + (evt.content || '')
                scheduleFlush()
                break
              }

              case 'model_done': {
                const model = evt.model as ModelId
                const round = evt.round as number
                const key = `r${round}-${model}`
                setModelStatus(prev => ({ ...prev, [model]: prev[model] === 'error' ? 'error' : 'done' }))
                setMessages(prev =>
                  prev.map(m => m.id === key ? { ...m, isStreaming: false } : m)
                )
                break
              }

              case 'model_error': {
                const errModel = evt.model as ModelId
                setModelStatus(prev => ({ ...prev, [errModel]: 'error' }))
                break
              }

              case 'consensus_chunk': {
                setPhase('consensus')
                pendingConsensus += evt.content || ''
                scheduleFlush()
                break
              }

              case 'errors_summary': {
                if (Array.isArray(evt.errors)) {
                  setModelErrors(evt.errors as ModelError[])
                }
                break
              }

              case 'done': {
                receivedDone = true
                finalizeFlush()
                if (finalConsensus) {
                  setConsensusContent(finalConsensus)
                }
                setPhase('done')
                setTypingModels([])
                // 保存到 Supabase（优先使用本地累积的最终共识，避免状态异步导致落库为空）
                saveDiscussion(finalConsensus)
                break
              }
            }
          } catch { /* skip malformed */ }
        }
      }

      finalizeFlush()

      // 仅在未收到正常 done 事件时兜底（连接异常关闭）
      if (!receivedDone) {
        console.warn('SSE stream closed without receiving done event')
        setTypingModels([])
        setMessages(prev => prev.map(m => ({ ...m, isStreaming: false })))
        setPhase('idle')
      }
    } catch (err: any) {
      finalizeFlush()
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
    if (followUpAbortRef.current) followUpAbortRef.current.abort()
    sessionIdRef.current = null
    setPhase('idle')
    setTopic('')
    setMessages([])
    setConsensusContent('')
    setSearchSources([])
    setModelErrors([])
    setFollowUpItems([])
    setFollowUpInput('')
    setIsFollowingUp(false)
    setFollowUpAttachment(null)
    setFollowUpFileError('')
    setUseFollowUpSearch(false)
    setTypingModels([])
    setModelStatus({ 'gpt-4o': 'idle', 'gemini-2.0-flash': 'idle', 'grok-2': 'idle', 'deepseek-chat': 'idle' })
    navigate('/discuss', { replace: true })
  }

  const handleFollowUp = useCallback(async () => {
    const q = followUpInput.trim()
    if (!q && !followUpAttachment) return
    if (isFollowingUp) return

    // 构建讨论上下文文本（精简版，防止代理截断）
    const contextParts: string[] = []
    const r1 = messagesRef.current.filter(m => m.round === 1)
    const r2 = messagesRef.current.filter(m => m.round === 2)

    // 为了防止上下文过大（类似于共识生成的痛点），截断原始发言
    const truncateMsg = (text: string) => text.length > 200 ? text.slice(0, 200) + '...' : text;

    if (r1.length) {
      contextParts.push('【第一轮讨论要点】')
      r1.forEach(m => {
        const name = MODEL_META[m.model]?.shortName || m.model
        contextParts.push(`${name}：\n${truncateMsg(m.content)}`)
      })
    }
    if (r2.length) {
      contextParts.push('\n【第二轮讨论要点】')
      r2.forEach(m => {
        const name = MODEL_META[m.model]?.shortName || m.model
        contextParts.push(`${name}：\n${truncateMsg(m.content)}`)
      })
    }
    if (consensusRef.current) {
      contextParts.push(`\n【达成共识（核心）】\n${consensusRef.current}`)
    }
    const context = contextParts.join('\n\n')

    const idx = followUpItems.length  // 用来更新对应条目
    const displayQ = q || (`（附件：${followUpAttachment?.name}）`)
    setFollowUpItems(prev => [...prev, { question: displayQ, answer: '', isStreaming: true }])
    setFollowUpInput('')
    const currentFollowUpAttachment = followUpAttachment
    setFollowUpAttachment(null)
    setFollowUpFileError('')
    setIsFollowingUp(true)

    // 构建 API 请求体
    let finalQuestion = q
    if (currentFollowUpAttachment?.type === 'text') {
      const fileCtx = `\`\`\`${currentFollowUpAttachment.name}\n${currentFollowUpAttachment.content}\n\`\`\``
      finalQuestion = q ? `${fileCtx}\n\n${q}` : `请分析以下文件内容：\n\n${fileCtx}`
    } else if (!q && currentFollowUpAttachment?.type === 'image') {
      finalQuestion = '请分析这张图片的内容'
    }

    const followUpReqBody: any = { question: finalQuestion, topic: topicRef.current, context, models: MODELS, use_search: useFollowUpSearch }
    if (currentFollowUpAttachment?.type === 'image') {
      followUpReqBody.image = currentFollowUpAttachment.content
    }

    try {
      followUpAbortRef.current = new AbortController()
      const res = await apiFetch('/api/discuss/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(followUpReqBody),
        signal: followUpAbortRef.current.signal,
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
            if (evt.type === 'followup_chunk') {
              setFollowUpItems(prev => prev.map((item, i) =>
                i === idx ? { ...item, answer: item.answer + evt.content } : item
              ))
            } else if (evt.type === 'followup_done') {
              setFollowUpItems(prev => prev.map((item, i) =>
                i === idx ? { ...item, isStreaming: false } : item
              ))
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setFollowUpItems(prev => prev.map((item, i) =>
          i === idx ? { ...item, answer: item.answer || '[请求失败，请重试]', isStreaming: false } : item
        ))
      }
    } finally {
      setIsFollowingUp(false)
    }
  }, [followUpInput, isFollowingUp, followUpItems.length, followUpAttachment])

  // 追问文件处理
  const processFollowUpFile = useCallback((file: File) => {
    setFollowUpFileError('')
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const sizeMB = file.size / 1024 / 1024
    if (IMAGE_TYPES.includes(file.type) || file.type.startsWith('image/')) {
      if (sizeMB > MAX_IMAGE_MB) { setFollowUpFileError(`图片不能超过 ${MAX_IMAGE_MB}MB`); return }
      const reader = new FileReader()
      reader.onload = e => {
        setFollowUpAttachment({ type: 'image', name: file.name, content: e.target!.result as string })
      }
      reader.readAsDataURL(file)
    } else if (TEXT_EXTS.includes(ext)) {
      if (sizeMB > MAX_TEXT_MB) { setFollowUpFileError(`文件不能超过 ${MAX_TEXT_MB}MB`); return }
      const reader = new FileReader()
      reader.onload = e => {
        setFollowUpAttachment({ type: 'text', name: file.name, content: e.target!.result as string })
      }
      reader.readAsText(file, 'utf-8')
    } else {
      setFollowUpFileError(`不支持的文件类型：.${ext}`)
    }
  }, [])

  const scrollToModel = useCallback((modelId: ModelId) => {
    // 优先跳转到最新的一轮
    let el = document.getElementById(`r2-${modelId}`)
    if (!el || phase === 'round1') {
      el = document.getElementById(`r1-${modelId}`)
    }
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 闪烁高亮提示
      el.classList.add('animate-pulse', 'bg-white/5', 'rounded-xl', '-mx-2', 'px-2', 'transition-colors', 'duration-500')
      setTimeout(() => {
        el?.classList.remove('animate-pulse', 'bg-white/5')
        setTimeout(() => el?.classList.remove('rounded-xl', '-mx-2', 'px-2', 'transition-colors', 'duration-500'), 500)
      }, 1000)
    }
  }, [phase])

  const handleStepJump = useCallback((step: 1 | 2 | 3) => {
    const target = step === 1 ? round1AnchorRef.current : step === 2 ? round2AnchorRef.current : consensusAnchorRef.current
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

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
    <div className="flex flex-col h-full bg-bg-2 quorum-surface">
      {/* Header */}
      <header className="desktop-sidebar-aware-header border-b border-white/5 bg-bg-1/60 backdrop-blur-sm flex-shrink-0 px-5 py-3.5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden h-10 w-10 flex-shrink-0" aria-hidden="true" />
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
          <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
            <button
              onClick={() => navigate('/chat')}
              className="md:hidden mobile-switch-chat flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs press-effect"
            >
              <MessageSquare size={12} />
              对话
            </button>
            {phase !== 'done' && (
              <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-violet-300">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                SSE 实时协同中
              </span>
            )}
          {/* Participant indicators */}
          <div className="hidden md:flex items-center gap-1.5">
            {MODELS.map(m => (
              <ParticipantCard
                key={m}
                modelId={m}
                status={modelStatus[m]}
                onClick={() => scrollToModel(m)}
              />
            ))}
          </div>
          {phase !== 'done' && (
            <button
              onClick={handleStop}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-red-500/15 border border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/25 transition-all press-effect touch-manipulation"
              title="停止讨论"
            >
              <Square size={10} fill="currentColor" />
              停止
            </button>
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 glass glass-hover rounded-xl text-xs text-text-4 hover:text-text-2 transition-all press-effect touch-manipulation"
          >
            <RotateCcw size={12} />
            新议题
          </button>
        </div>
      </div>
      </header>

      {/* Discussion feed */}
      <div className="flex-1 overflow-y-auto smooth-scroll relative" onScroll={handleScroll}>
        <div className="max-w-3xl mx-auto px-5 py-6 space-y-4">
          <DiscussionStepper phase={phase} onJump={handleStepJump} />

          {/* Round 1 */}
          <div ref={round1AnchorRef}>
            <RoundDivider round={1} label="各抒己见" />
          </div>
          {r1Messages.map((msg, i) => <DiscussBubble key={msg.id} msg={msg} index={i} sources={searchSources} />)}
          {typingModels.filter(() => phase === 'round1').map(m => (
            <TypingIndicator key={m} modelId={m} />
          ))}

          {/* Round 2 */}
          {showR2Divider && (
            <div ref={round2AnchorRef}>
              <RoundDivider round={2} label="深度互动" />
            </div>
          )}
          {showR2 && r2Messages.map((msg, i) => <DiscussBubble key={msg.id} msg={msg} index={i} sources={searchSources} />)}
          {typingModels.filter(() => phase === 'round2').map(m => (
            <TypingIndicator key={m} modelId={m} label={`${MODEL_META[m].shortName} 正在回应其他模型`} />
          ))}

          {/* Search Sources */}
          {searchSources.length > 0 && (showConsensus || phase === 'done') && (
            <div className="mt-8 mb-6 animate-content-reveal">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                <span className="text-[10px] font-bold text-text-4 uppercase tracking-[0.1em]">研究资料 & 参考来源</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {searchSources.map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-2 rounded-xl bg-bg-2 border border-white/5 hover:border-violet-500/20 hover:bg-violet-500/10 transition-all group"
                  >
                    <div className="w-6 h-6 rounded bg-violet-500/10 flex items-center justify-center flex-shrink-0 text-[9px] text-violet-400 font-bold group-hover:bg-violet-500/30 transition-colors">
                      {i + 1}
                    </div>
                    <span className="text-xs text-text-3 truncate flex-1 group-hover:text-violet-200 transition-colors">{s.title}</span>
                    <Share2 size={10} className="text-text-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Consensus */}
          {showConsensus && (
            <div ref={consensusAnchorRef}>
              <div className="flex items-center gap-3 py-2 animate-scale-reveal">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
                <span className="text-xs gradient-text-gemini font-semibold tracking-wide">多方共识</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
              </div>
              <ConsensusCard
                content={consensusContent}
                errors={modelErrors}
                isStreaming={phase === 'consensus'}
                onSave={(newVal) => {
                  setConsensusContent(newVal);
                  setTimeout(() => saveDiscussion(), 50);
                }}
              />
            </div>
          )}

          {/* Follow-up Q&A */}
          {followUpItems.map((item, i) => (
            <FollowUpBubble key={i} item={item} />
          ))}

          <div ref={bottomRef} className="h-4" />
        </div>

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

      {/* Footer: 追问输入框（讨论完成后） */}
      {phase === 'done' && (
        <div className="flex-shrink-0 px-5 py-3 mobile-safe-bottom border-t border-white/5 bg-bg-1/40 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto space-y-2">
            {/* 追问附件预览 */}
            {followUpAttachment && (
              <div className="flex items-center gap-2 px-3 py-2 bg-bg-3 border border-white/8 rounded-xl">
                {followUpAttachment.type === 'image' ? (
                  <img src={followUpAttachment.content} alt={followUpAttachment.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <FileText size={14} className="text-violet-400 flex-shrink-0" />
                )}
                <span className="text-xs text-text-3 flex-1 truncate">{followUpAttachment.name}</span>
                <button onClick={() => setFollowUpAttachment(null)} className="text-text-5 hover:text-red-400 transition-colors">
                  <X size={12} />
                </button>
              </div>
            )}
            {followUpFileError && <p className="text-xs text-red-400 px-1">{followUpFileError}</p>}
            {/* 追问输入行 */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-bg-3 border border-white/10 rounded-xl px-3 py-2 focus-within:border-violet-500/40 transition-colors">
                <button
                  onClick={() => followUpFileRef.current?.click()}
                  className="p-1.5 md:p-0.5 rounded-lg text-text-5 hover:text-violet-400 hover:bg-violet-500/10 transition-colors flex-shrink-0 touch-manipulation press-effect"
                  title="上传文件或图片"
                  disabled={isFollowingUp}
                >
                  <Paperclip size={13} strokeWidth={1.8} />
                </button>
                {/* 追问联网搜索开关 */}
                <button
                  onClick={() => setUseFollowUpSearch(prev => !prev)}
                  className={clsx(
                    "p-1.5 md:p-0.5 rounded-lg transition-colors flex-shrink-0 touch-manipulation press-effect",
                    isFollowingUp ? "opacity-50 cursor-not-allowed text-text-5" :
                    useFollowUpSearch ? "text-violet-400 bg-violet-500/10" : "text-text-5 hover:text-violet-400 hover:bg-violet-500/10"
                  )}
                  title={useFollowUpSearch ? "已开启联网搜索" : "点击开启联网搜索"}
                  disabled={isFollowingUp}
                >
                  <Globe size={13} strokeWidth={useFollowUpSearch ? 2.5 : 1.8} />
                </button>
                <input
                  ref={followUpFileRef}
                  type="file"
                  className="hidden"
                  accept="image/*,.txt,.md,.py,.js,.ts,.jsx,.tsx,.json,.csv,.xml,.yaml,.yml,.html,.css,.sh,.sql,.rs,.go,.java,.c,.cpp,.h"
                  onChange={e => { const f = e.target.files?.[0]; if (f) processFollowUpFile(f); e.target.value = '' }}
                />
                <input
                  type="text"
                  value={followUpInput}
                  onChange={e => setFollowUpInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleFollowUp() } }}
                  placeholder="向主持人追问…"
                  disabled={isFollowingUp}
                  className="flex-1 bg-transparent text-sm text-text-1 placeholder:text-text-5 outline-none disabled:opacity-50"
                />
              </div>
              <button
                onClick={handleFollowUp}
                disabled={(!followUpInput.trim() && !followUpAttachment) || isFollowingUp}
                className="flex items-center gap-1.5 px-3 py-2.5 md:py-2 rounded-xl text-xs font-medium bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 hover:text-violet-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed press-effect touch-manipulation"
              >
                <Send size={13} />
                追问
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-2.5 md:py-2 glass glass-hover rounded-xl text-xs text-text-4 hover:text-text-2 transition-all press-effect touch-manipulation"
              >
                <RotateCcw size={12} />
                新议题
              </button>
            </div>
            <p className="text-xs text-text-5 pl-1">讨论已完成 · 基于 2 轮对话达成多方共识 · 可继续追问主持人</p>
          </div>
        </div>
      )}
    </div>
  )
}
