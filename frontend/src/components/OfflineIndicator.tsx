import { useState, useEffect, useCallback } from 'react'
import { Wifi, WifiOff, Check, Loader2 } from 'lucide-react'
import { syncPendingDiscussions, getPendingCount } from '../lib/offlineStore'
import { apiFetch } from '../lib/api'

type Status = 'online' | 'offline' | 'syncing' | 'synced'

export default function OfflineIndicator() {
    const [status, setStatus] = useState<Status>(navigator.onLine ? 'online' : 'offline')
    const [pendingCount, setPendingCount] = useState(0)
    const [visible, setVisible] = useState(false)

    // 检查待同步数量
    const checkPending = useCallback(async () => {
        try {
            const count = await getPendingCount()
            setPendingCount(count)
        } catch { /* silent */ }
    }, [])

    // 自动同步
    const doSync = useCallback(async () => {
        const count = await getPendingCount()
        if (count === 0) return

        setStatus('syncing')
        setVisible(true)

        try {
            const result = await syncPendingDiscussions(apiFetch)
            if (result.synced > 0) {
                setStatus('synced')
                setPendingCount(prev => prev - result.synced)
                // 3秒后淡出
                setTimeout(() => setVisible(false), 3000)
            }
        } catch {
            setStatus('online')
            setVisible(false)
        }
    }, [])

    useEffect(() => {
        const goOnline = () => {
            setStatus('online')
            // 联网后尝试同步
            doSync()
        }

        const goOffline = () => {
            setStatus('offline')
            setVisible(true)
            checkPending()
        }

        window.addEventListener('online', goOnline)
        window.addEventListener('offline', goOffline)

        // 初始状态
        if (!navigator.onLine) {
            setStatus('offline')
            setVisible(true)
        }
        checkPending()

        return () => {
            window.removeEventListener('online', goOnline)
            window.removeEventListener('offline', goOffline)
        }
    }, [doSync, checkPending])

    if (!visible) return null

    const config = {
        offline: {
            icon: <WifiOff size={14} />,
            text: '当前离线 · 内容已自动缓存',
            bg: 'bg-amber-500/15 border-amber-500/25 text-amber-300',
        },
        syncing: {
            icon: <Loader2 size={14} className="animate-spin" />,
            text: `正在同步 ${pendingCount} 条记录...`,
            bg: 'bg-blue-500/15 border-blue-500/25 text-blue-300',
        },
        synced: {
            icon: <Check size={14} />,
            text: '同步完成',
            bg: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300',
        },
        online: {
            icon: <Wifi size={14} />,
            text: '已连接',
            bg: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300',
        },
    }

    const c = config[status]

    return (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-banner-up`}>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm text-xs font-medium ${c.bg}`}>
                {c.icon}
                <span>{c.text}</span>
            </div>
        </div>
    )
}
