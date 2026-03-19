import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Users, Trash2, Settings, Search,
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
        Quorum
      </span>
    </div>
  )
}

// ─── Constants ───────────────────────────────────
const CHAT_MODELS: ModelId[] = ['gpt-4o', 'gemini-2.0-flash', 'grok-2', 'deepseek-chat']
const MODEL_LABEL: Record<ModelId, string> = {
  'gpt-4o': 'GPT 对话',
  'gemini-2.0-flash': 'Gemini 对话',
  'grok-2': 'Grok 对话',
  'deepseek-chat': 'DeepSeek 对话',
}

// ─── Model History Group ──────────────────────────
function ModelHistoryGroup({
  modelId, items, onDelete,
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

// ─── Sidebar Nav + History (shared) ──────────────
function SidebarInner({
  searchQuery, setSearchQuery, chatHistory, discussHistory, totalChats, handleDelete, historyFilter, setHistoryFilter,
}: {
  searchQuery: string
  setSearchQuery: (q: string) => void
  chatHistory: Record<string, HistoryItem[]>
  discussHistory: HistoryItem[]
  totalChats: number
  handleDelete: (id: string) => void
  historyFilter: 'all' | 'chat' | 'discuss'
  setHistoryFilter: (v: 'all' | 'chat' | 'discuss') => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const isChatActive = location.pathname === '/chat' || location.pathname === '/'
  const isDiscussActive = location.pathname.startsWith('/discuss')
  return (
    <>
      {/* 主导航 */}
      <div className="mb-6 rounded-xl border border-white/8 bg-bg-3/40 p-1 flex items-center gap-1">
        <button
          onClick={() => navigate('/chat')}
          className={clsx(
            'flex items-center justify-center gap-2.5 flex-1 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200',
            isChatActive
              ? 'bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white shadow-lg shadow-violet-500/20'
              : 'text-text-3 hover:bg-bg-3/60 hover:text-text-1'
          )}
        >
          <MessageSquare size={16} strokeWidth={1.5} />
          <span>AI 对话</span>
        </button>
        <button
          onClick={() => navigate('/discuss')}
          className={clsx(
            'flex items-center justify-center gap-2.5 flex-1 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200',
            isDiscussActive
              ? 'bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white shadow-lg shadow-violet-500/20'
              : 'text-text-3 hover:bg-bg-3/60 hover:text-text-1'
          )}
        >
          <Users size={16} strokeWidth={1.5} />
          <span>群聊讨论室</span>
        </button>
      </div>

      <div className="h-px bg-white/5 mb-4 mx-1" />

      {/* 搜索框 */}
      <div className="relative mb-3 mx-1">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-5" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="搜索历史记录..."
          className="w-full pl-8 pr-3 py-1.5 bg-bg-3/50 border border-white/6 rounded-lg text-[12px] text-text-2 placeholder:text-text-5 outline-none focus:border-violet-500/40 transition-colors"
        />
      </div>

      <div className="flex items-center gap-1 mb-3 mx-1">
        {([
          { id: 'all', label: '全部' },
          { id: 'chat', label: '对话' },
          { id: 'discuss', label: '讨论' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setHistoryFilter(tab.id)}
            className={clsx(
              'px-2.5 py-1 rounded-md text-[11px] transition-colors',
              historyFilter === tab.id
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-text-5 hover:text-text-3 hover:bg-bg-3/50 border border-transparent'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 历史记录 */}
      <div className="flex-1 min-h-0">
        {totalChats === 0 && discussHistory.length === 0 ? (
          <p className="text-[12px] text-text-5 px-3 py-3 text-center">暂无历史记录</p>
        ) : (
          historyFilter !== 'discuss' && CHAT_MODELS.map(m => {
            const items = (chatHistory[m] || []).filter(item =>
              !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase())
            )
            return <ModelHistoryGroup key={m} modelId={m} items={items} onDelete={handleDelete} />
          })
        )}
        {historyFilter !== 'chat' && discussHistory.filter(item =>
          !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase())
        ).length > 0 && (
            <div className="mb-5">
              <div className="px-3 mb-1.5">
                <h3 className="text-[11px] font-medium text-text-5 uppercase tracking-wider">群聊历史</h3>
              </div>
              <div className="space-y-0.5">
                {discussHistory
                  .filter(item => !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(item => (
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
    </>
  )
}

// ─── Sidebar Footer (shared) ─────────────────────
function SidebarFooter({
  setShowSettings,
}: {
  showSettings: boolean
  setShowSettings: (s: boolean) => void
}) {
  const { user, signOut } = useAuth()
  return (
    <div className="px-3 pb-4 pt-2 mobile-safe-bottom border-t border-white/5 flex-shrink-0">
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
  )
}

// ─── Sidebar ─────────────────────────────────────
export default function Sidebar({
  mobileSidebarOpen,
  setMobileSidebarOpen,
}: {
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
}) {
  const { user, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true' }
    catch { return false }
  })
  const [chatHistory, setChatHistory] = useState<Record<string, HistoryItem[]>>({})
  const [discussHistory, setDiscussHistory] = useState<HistoryItem[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'chat' | 'discuss'>('all')

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

  const innerProps = {
    searchQuery, setSearchQuery,
    chatHistory, discussHistory,
    totalChats, handleDelete,
    historyFilter, setHistoryFilter,
  }

  return (
    <>
      {/* ── 移动端侧边栏：固定覆盖抽屉 ── */}
      <aside
        className={clsx(
          'md:hidden fixed inset-y-0 left-0 z-50 w-[300px] max-w-[86vw] bg-bg-1 border-r border-white/10 rounded-r-2xl shadow-2xl flex flex-col mobile-drawer',
          mobileSidebarOpen ? 'translate-x-0 mobile-drawer-open' : '-translate-x-full mobile-drawer-closed'
        )}
        style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
      >
        <div className="flex-1 overflow-y-auto flex flex-col pt-3 pb-2 px-3">
          <div className="flex items-center justify-between mb-4 select-none">
            <Logo />
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="p-1.5 rounded-lg text-text-5 hover:text-text-2 hover:bg-bg-3/60 transition-colors"
              title="关闭侧边栏"
            >
              <PanelLeftClose size={17} strokeWidth={1.5} />
            </button>
          </div>
          <SidebarInner {...innerProps} />
        </div>
        <SidebarFooter showSettings={showSettings} setShowSettings={setShowSettings} />
      </aside>

      {/* ── 桌面端侧边栏：max-width + opacity 联动 ── */}
      <aside
        className="hidden md:flex flex-col bg-bg-1 flex-shrink-0 relative group/sidebar overflow-hidden"
        style={{
          maxWidth: collapsed ? 0 : 260,
          opacity: collapsed ? 0 : 1,
          transition: 'max-width 350ms cubic-bezier(0.4,0,0.2,1), opacity 250ms ease',
          minWidth: 0,
        }}
      >
        <div className="flex-1 overflow-y-auto w-[260px] flex flex-col pt-3 pb-2 px-3">
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
          <SidebarInner {...innerProps} />
        </div>
        <SidebarFooter showSettings={showSettings} setShowSettings={setShowSettings} />
      </aside>

      {/* ── 桌面端展开按钮：悬浮覆盖，不再占出一整条空白栏 ── */}
      <div
        className="hidden md:block relative w-0 flex-shrink-0"
        style={{
          opacity: collapsed ? 1 : 0,
          overflow: 'visible',
          transition: 'opacity 180ms ease',
          pointerEvents: collapsed ? 'auto' : 'none',
        }}
      >
        <button
          onClick={toggleSidebar}
          className="absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-bg-2/82 text-text-5 shadow-lg shadow-black/5 backdrop-blur-sm transition-colors hover:bg-bg-3/78 hover:text-text-2"
          title="展开侧边栏"
          aria-label="展开侧边栏"
        >
          <PanelLeft size={17} strokeWidth={1.5} />
        </button>
      </div>

      {showSettings && <ApiSettingsModal onClose={() => setShowSettings(false)} />}
    </>
  )
}
