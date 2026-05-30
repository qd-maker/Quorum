import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const DEMO_FLAG_KEY = 'quorum-demo-mode'

interface AuthContextType {
    user: User | null
    isDemo: boolean
    loading: boolean
    signOut: () => Promise<void>
    enterDemoMode: () => Promise<boolean>
    exitDemoMode: () => void
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isDemo: false,
    loading: true,
    signOut: async () => { },
    enterDemoMode: async () => false,
    exitDemoMode: () => { },
})

// demo 模式下的虚拟 user，仅用于通过 user 非空判断；不会实际写入 Supabase
const DEMO_USER = {
    id: 'demo-anonymous',
    email: 'demo@quorum.local',
    user_metadata: { name: 'Demo 访客' },
} as unknown as User

async function fetchDemoEnabled(signal?: AbortSignal): Promise<boolean> {
    try {
        const resp = await fetch('/api/demo/status', { signal })
        if (!resp.ok) return false
        const data = await resp.json()
        return data?.enabled === true
    } catch {
        return false
    }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [isDemo, setIsDemo] = useState<boolean>(() => {
        try { return localStorage.getItem(DEMO_FLAG_KEY) === '1' } catch { return false }
    })

    useEffect(() => {
        const controller = new AbortController()
        let disposed = false

        // 初始化时获取当前 session
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (disposed) return
            setUser(session?.user ?? null)
            if (!session?.user && isDemo) {
                const enabled = await fetchDemoEnabled(controller.signal)
                if (!disposed && !enabled) {
                    try { localStorage.removeItem(DEMO_FLAG_KEY) } catch { }
                    setIsDemo(false)
                }
            }
            if (disposed) return
            setLoading(false)
        }).catch(() => {
            if (!disposed) setLoading(false)
        })

        // 监听登录/登出变化
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
            // 用户登录后退出 demo 模式
            if (session?.user) {
                try { localStorage.removeItem(DEMO_FLAG_KEY) } catch { }
                setIsDemo(false)
            }
        })

        return () => {
            disposed = true
            controller.abort()
            subscription.unsubscribe()
        }
    }, [isDemo])

    const enterDemoMode = async () => {
        const enabled = await fetchDemoEnabled()
        if (!enabled) {
            try { localStorage.removeItem(DEMO_FLAG_KEY) } catch { }
            setIsDemo(false)
            return false
        }
        try { localStorage.setItem(DEMO_FLAG_KEY, '1') } catch { }
        setIsDemo(true)
        return true
    }

    const exitDemoMode = () => {
        try { localStorage.removeItem(DEMO_FLAG_KEY) } catch { }
        setIsDemo(false)
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        exitDemoMode()
    }

    // demo 模式下 user 用虚拟对象（让上层判断为「已登录」）
    const effectiveUser = user ?? (isDemo ? DEMO_USER : null)

    return (
        <AuthContext.Provider value={{
            user: effectiveUser,
            isDemo: !user && isDemo,
            loading,
            signOut,
            enterDemoMode,
            exitDemoMode,
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
