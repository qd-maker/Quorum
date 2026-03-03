import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import ChatPage from './pages/ChatPage'
import DiscussPage from './pages/DiscussPage'
import AuthPage from './pages/AuthPage'

// ─── Keep-Alive Layout ───────────────────────────
function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    if (location.pathname === '/') navigate('/chat', { replace: true })
  }, [location.pathname, navigate])

  // 路由变化时关闭移动端侧边栏
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [location.pathname])

  if (loading) {
    return (
      <div className="flex h-screen bg-bg-0 items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-violet-500/40 border-t-violet-400 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  const isChat = location.pathname === '/' || location.pathname.startsWith('/chat')
  const isDiscuss = location.pathname.startsWith('/discuss')

  const chatSessionId = isChat
    ? location.pathname.match(/^\/chat\/(.+)$/)?.[1]
    : undefined
  const discussSessionId = isDiscuss
    ? location.pathname.match(/^\/discuss\/(.+)$/)?.[1]
    : undefined

  return (
    <div className="flex h-screen bg-bg-0 overflow-hidden">
      {/* 移动端侧边栏背景遮罩 */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <Sidebar mobileSidebarOpen={mobileSidebarOpen} setMobileSidebarOpen={setMobileSidebarOpen} />

      <main className="flex-1 min-w-0 overflow-hidden relative">
        {/* 移动端汉堡菜单 */}
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="fixed top-3 left-3 z-30 p-2 rounded-xl bg-bg-2/80 backdrop-blur-sm border border-white/8 text-text-3 hover:text-text-1 transition-colors md:hidden"
        >
          <Menu size={18} />
        </button>

        {/* Chat */}
        <div
          className="absolute inset-0 flex flex-col"
          style={{ display: isChat ? 'flex' : 'none' }}
        >
          <ChatPage active={isChat} sessionId={chatSessionId} />
        </div>

        {/* Discuss */}
        <div
          className="absolute inset-0 flex flex-col"
          style={{ display: isDiscuss ? 'flex' : 'none' }}
        >
          <DiscussPage active={isDiscuss} sessionId={discussSessionId} />
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  )
}
