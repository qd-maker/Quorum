import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
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

  useEffect(() => {
    if (location.pathname === '/') navigate('/chat', { replace: true })
  }, [location.pathname, navigate])

  // 加载中：防止未初始化时闪烁
  if (loading) {
    return (
      <div className="flex h-screen bg-bg-0 items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-violet-500/40 border-t-violet-400 animate-spin" />
      </div>
    )
  }

  // 未登录：显示登录页
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
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-hidden relative">
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
