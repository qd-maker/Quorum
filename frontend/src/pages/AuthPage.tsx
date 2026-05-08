import { useState, useEffect } from 'react'
import { Bot, Mail, Lock, ArrowRight, Loader2, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'

type Mode = 'login' | 'register'

export default function AuthPage() {
    const [mode, setMode] = useState<Mode>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [demoEnabled, setDemoEnabled] = useState(false)
    const { enterDemoMode } = useAuth()

    useEffect(() => {
        // 探测后端是否启用 demo 模式
        fetch('/api/demo/status')
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data?.enabled) setDemoEnabled(true) })
            .catch(() => { /* 后端未启动，不显示 demo 入口 */ })
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim() || !password.trim()) return
        setError('')
        setSuccess('')
        setLoading(true)

        try {
            if (mode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) throw error
                // AuthContext 会自动检测到登录并切换视图
            } else {
                const { data, error } = await supabase.auth.signUp({ email, password })
                if (error) throw error
                if (data.session) {
                    // Supabase 已开启自动确认，直接登录成功（AuthContext 会自动切换页面）
                    setSuccess('注册成功，已自动登录！')
                } else {
                    // 需要邮件确认
                    setSuccess('注册成功！请检查邮箱，点击确认链接后即可登录。')
                    setMode('login')
                }
            }
        } catch (err: any) {
            const msg = err?.message || '操作失败，请重试'
            if (msg.includes('Invalid login')) setError('邮箱或密码错误')
            else if (msg.includes('already registered')) setError('该邮箱已注册，请直接登录')
            else if (msg.includes('Password should')) setError('密码至少 6 位')
            else setError(msg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex h-screen bg-bg-0 items-center justify-center px-4">
            {/* 背景光晕 — 呆吸动画 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-violet-500/8 blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-cyan-500/6 blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
            </div>

            <div className="relative w-full max-w-sm animate-fade-in-up" style={{ opacity: 0 }}>
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center">
                        <Bot size={22} strokeWidth={1.5} className="text-violet-300" />
                    </div>
                    <h1 className="font-display text-2xl font-bold text-text-1 mb-1">Quorum</h1>
                    <p className="text-sm text-text-4">多模型 AI 对话平台</p>
                </div>

                {/* 卡片 */}
                <div className="bg-bg-1 border border-white/8 rounded-2xl p-6 shadow-card">
                    {/* 模式切换 */}
                    <div className="flex bg-bg-2 rounded-xl p-1 mb-6">
                        {(['login', 'register'] as Mode[]).map(m => (
                            <button
                                key={m}
                                onClick={() => { setMode(m); setError(''); setSuccess('') }}
                                className={clsx(
                                    'flex-1 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                                    mode === m
                                        ? 'bg-bg-4 text-text-1 shadow-sm'
                                        : 'text-text-4 hover:text-text-2'
                                )}
                            >
                                {m === 'login' ? '登录' : '注册'}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* 邮箱 */}
                        <div>
                            <label className="block text-xs font-medium text-text-4 mb-1.5">邮箱</label>
                            <div className="relative">
                                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-5" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    required
                                    className="w-full bg-bg-2 border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-sm text-text-1 placeholder:text-text-5 outline-none input-focus-glow"
                                />
                            </div>
                        </div>

                        {/* 密码 */}
                        <div>
                            <label className="block text-xs font-medium text-text-4 mb-1.5">密码</label>
                            <div className="relative">
                                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-5" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder={mode === 'register' ? '至少 6 位' : '输入密码'}
                                    required
                                    className="w-full bg-bg-2 border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-sm text-text-1 placeholder:text-text-5 outline-none input-focus-glow"
                                />
                            </div>
                        </div>

                        {/* 错误/成功提示 */}
                        {error && (
                            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 animate-spring-pop">
                                {error}
                            </p>
                        )}
                        {success && (
                            <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 animate-spring-pop">
                                {success}
                            </p>
                        )}

                        {/* 提交按钮 */}
                        <button
                            type="submit"
                            disabled={loading || !email.trim() || !password.trim()}
                            className={clsx(
                                'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 btn-ripple',
                                !loading && email.trim() && password.trim()
                                    ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white hover:opacity-90 hover:shadow-lg hover:shadow-violet-500/25 active:scale-[0.97]'
                                    : 'bg-bg-3 text-text-5 cursor-not-allowed'
                            )}
                        >
                            {loading ? (
                                <Loader2 size={15} className="animate-spin" />
                            ) : (
                                <>
                                    {mode === 'login' ? '登录' : '创建账号'}
                                    <ArrowRight size={14} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Demo 立即体验入口 */}
                    {demoEnabled && (
                        <>
                            <div className="my-5 flex items-center gap-3">
                                <div className="flex-1 h-px bg-white/8" />
                                <span className="text-[10px] text-text-5 uppercase tracking-wider">或</span>
                                <div className="flex-1 h-px bg-white/8" />
                            </div>
                            <button
                                onClick={enterDemoMode}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-violet-400/30 bg-violet-500/5 text-violet-300 hover:bg-violet-500/10 hover:border-violet-400/50 transition-all"
                                title="无需登录，立即体验所有功能"
                            >
                                <Zap size={14} />
                                免登录·立即体验 Demo
                            </button>
                            <p className="mt-2 text-[11px] text-text-5 text-center">
                                Demo 模式下不会保存历史记录
                            </p>
                        </>
                    )}
                </div>

                <p className="text-center text-xs text-text-5 mt-6">
                    你的数据仅对自己可见，完全隔离
                </p>
            </div>
        </div>
    )
}
