import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Users, Trash2, Settings,
  PanelLeftClose, PanelLeft, Bot, MessageSquare, LogOut
} from 'lucide-react'
import clsx from 'clsx'
import type { HistoryItem, ModelId } from '../types'
import { MODEL_META } from '../types'
import ApiSettingsModal from './ApiSettingsModal'
import ThemeToggle from './ThemeToggle'
import { apiFetch } from '../lib/api'
import { useAuth } from '../context/AuthContext'

// ─── Logo ────────────────────────────────────────
function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1 text-text-1 cursor-pointer rounded-lg">
      <Bot size={20} strokeWidth={1.5} className="text-text-3" />
      <span className="font-semibold text-[15px] tracking-wide text-text-1">
        Many AI
      </span>
    </div>
  )
}

// ─── Model Group ─────────────────────────────────
const CHAT_MODELS: ModelId[] = ['gpt-4o', 'gemini-2.0-flash', 'grok-2', 'deepseek-chat']

// 模型中文分组名
const MODEL_LABEL: Record<ModelId, string> = {
  'gpt-4o': 'GPT 对话',
  'gemini-2.0-flash': 'Gemini 对话',
  'grok-2': 'Grok 对话',
  'deepseek-chat': 'DeepSeek 对话',
}

function ModelHistoryGroup({
  modelId,
  items,
  onDelete,
}: {
  modelId: ModelId
  items: HistoryItem[]
  onDelete: (id: string) => void
}) {
  const navigate = useNavigate()

  if (items.length === 0) return null

  return (
    <div className="mb-5">
      <div className="px-3 mb-1.5">
        <h3 className="text-[11px] font-medium text-text-5 uppercase tracking-wider">
          {MODEL_LABEL[modelId]}
        </h3>
      </div>

      <div className="space-y-0.5">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => navigate(`/chat/${item.id}`)}
            className="w-full text-left px-3 py-1.5 rounded-lg group transition-colors duration-150 hover:bg-bg-3/60 flex items-center justify-between"
          >
            <div className="min-w-0 pr-2">
              <p className="text-[13px] text-text-3 truncate group-hover:text-text-1 transition-colors">
                {item.title || '未命名'}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-red-400 text-text-5 transition-all flex-shrink-0"
              title="删除"
            >
              <Trash2 size={12} strokeWidth={2} />
            </button>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Sidebar ─────────────────────────────────────
export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true' }
    catch { return false }
  })
  const [chatHistory, setChatHistory] = useState<Record<string, HistoryItem[]>>({})
  const [discussHistory, setDiscussHistory] = useState<HistoryItem[]>([])
  const [showSettings, setShowSettings] = useState(false)

  const toggleSidebar = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await apiFetch('/api/sessions?limit=50')
      if (!res.ok) return
      const data = await res.json()

      const grouped: Record<string, HistoryItem[]> = {}
      for (const m of CHAT_MODELS) grouped[m] = []

      for (const s of data) {
        if (s.type === 'chat') {
          const item: HistoryItem = {
            id: s.id,
            type: 'chat',
            title: s.title || '未命名',
            preview: s.preview || '',
            createdAt: new Date(s.created_at).getTime(),
          }
          const model = s.model || 'gpt-4o'
          if (grouped[model]) grouped[model].push(item)
          else grouped['gpt-4o'].push(item)
        }
      }
      setChatHistory(grouped)

      const discussItems: HistoryItem[] = data
        .filter((s: any) => s.type === 'discuss')
        .map((s: any) => ({
          id: s.id,
          type: 'discuss' as const,
          title: s.title || s.topic || '未命名讨论',
          preview: s.preview || '',
          createdAt: new Date(s.created_at).getTime(),
        }))
      setDiscussHistory(discussItems)
    } catch { /* 静默 */ }
  }, [])

  useEffect(() => {
    fetchHistory()
    const handler = () => fetchHistory()
    window.addEventListener('history-updated', handler)
    return () => window.removeEventListener('history-updated', handler)
  }, [fetchHistory])

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' })
      fetchHistory()
    } catch { /* 静默 */ }
  }

  const totalChats = Object.values(chatHistory).reduce((a, b) => a + b.length, 0)

  return (
    <>
      {/* ── 侧边栏主体：用 max-width + opacity 联动，过渡更顺滑 ── */}
      <aside
        className="flex flex-col bg-bg-1 flex-shrink-0 relative group/sidebar overflow-hidden"
        style={{
          maxWidth: collapsed ? 0 : 260,
          opacity: collapsed ? 0 : 1,
          transition: 'max-width 350ms cubic-bezier(0.4,0,0.2,1), opacity 250ms ease',
          minWidth: 0,
        }}
      >
        <div className="flex-1 overflow-y-auto w-[260px] flex flex-col pt-3 pb-2 px-3">
          {/* ── 顶部标题栏 ── */}
          <div className="flex items-center justify-between mb-4 select-none">
            <Logo />
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg text-text-5 hover:text-text-2 hover:bg-bg-3/60 transition-colors opacity-0 group-hover/sidebar:opacity-100"
              title="收起侧边栏"
            >
              <PanelLeftClose size={17} strokeWidth={1.5} />
            </button>
          </div>

          {/* ── 主导航 ── */}
          <div className="space-y-0.5 mb-6">
            <button
              onClick={() => navigate('/chat')}
              className={clsx(
                'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13.5px] font-medium transition-colors duration-150',
                location.pathname === '/chat' || location.pathname === '/'
                  ? 'bg-bg-3/80 text-text-1'
                  : 'text-text-3 hover:bg-bg-3/50 hover:text-text-1'
              )}
            >
              <MessageSquare size={16} strokeWidth={1.5} />
              <span>AI 对话</span>
            </button>

            <button
              onClick={() => navigate('/discuss')}
              className={clsx(
                'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13.5px] font-medium transition-colors duration-150',
                location.pathname.startsWith('/discuss')
                  ? 'bg-bg-3/80 text-text-1'
                  : 'text-text-3 hover:bg-bg-3/50 hover:text-text-1'
              )}
            >
              <Users size={16} strokeWidth={1.5} />
              <span>群聊讨论室</span>
            </button>
          </div>

          {/* ── 分割线 ── */}
          <div className="h-px bg-white/5 mb-4 mx-1" />

          {/* ── 历史记录 ── */}
          <div className="flex-1 min-h-0">
            {totalChats === 0 && discussHistory.length === 0 ? (
              <p className="text-[12px] text-text-5 px-3 py-3 text-center">
                暂无历史记录
              </p>
            ) : (
              CHAT_MODELS.map(m => (
                <ModelHistoryGroup
                  key={m}
                  modelId={m}
                  items={chatHistory[m] || []}
                  onDelete={handleDelete}
                />
              ))
            )}

            {/* ── 讨论历史 ── */}
            {discussHistory.length > 0 && (
              <div className="mb-5">
                <div className="px-3 mb-1.5">
                  <h3 className="text-[11px] font-medium text-text-5 uppercase tracking-wider">群聊历史</h3>
                </div>
                <div className="space-y-0.5">
                  {discussHistory.map(item => (
                    <button
                      key={item.id}
                      onClick={() => navigate(`/discuss/${item.id}`)}
                      className="w-full text-left px-3 py-1.5 rounded-lg group transition-colors duration-150 hover:bg-bg-3/60 flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-[13px] text-text-3 truncate group-hover:text-text-1 transition-colors">
                          {item.title}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-red-400 text-text-5 transition-all flex-shrink-0"
                      >
                        <Trash2 size={12} strokeWidth={2} />
                      </button>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 底部设置 ── */}
        <div className="px-3 pb-4 pt-2 w-[260px] border-t border-white/5">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg flex-1 text-left hover:bg-bg-3/60 transition-colors group"
            >
              <Settings size={15} strokeWidth={1.5} className="text-text-4 group-hover:text-text-2 transition-colors flex-shrink-0" />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[13.5px] font-medium text-text-2 truncate pointer-events-none">接口设置</span>
                <span className="text-[11px] text-text-5 truncate">{user?.email || '配置 API Key'}</span>
              </div>
            </button>
            <ThemeToggle />
          </div>
          <button
            onClick={signOut}
            className="mt-1 flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-text-5 hover:text-red-400 hover:bg-red-500/8 transition-colors text-[12px]"
          >
            <LogOut size={13} strokeWidth={1.5} />
            退出登录
          </button>
        </div>
      </aside>

      {/* ── 展开按钮：用 max-width 同步过渡，避免闪烁 ── */}
      <div
        className="flex-shrink-0 flex items-start pt-[11px]"
        style={{
          maxWidth: collapsed ? 44 : 0,
          opacity: collapsed ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-width 350ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease',
        }}
      >
        <button
          onClick={toggleSidebar}
          className="ml-3 p-1.5 rounded-lg text-text-5 hover:text-text-2 hover:bg-bg-3/60 transition-colors flex-shrink-0"
          style={{ pointerEvents: collapsed ? 'auto' : 'none' }}
          title="展开侧边栏"
        >
          <PanelLeft size={17} strokeWidth={1.5} />
        </button>
      </div>

      {showSettings && <ApiSettingsModal onClose={() => setShowSettings(false)} />}
    </>
  )
}
