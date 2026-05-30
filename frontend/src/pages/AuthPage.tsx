import { useEffect, useMemo, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react'
import {
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Eye,
    EyeOff,
    FileText,
    Loader2,
    Play,
    ShieldCheck,
    Sparkles,
    Users,
} from 'lucide-react'
import clsx from 'clsx'
import { supabase } from '../lib/supabase'
import AuthMascots from '../components/AuthMascots'
import { useAuth } from '../context/AuthContext'

type Mode = 'login' | 'register'
type DemoStatus = {
    enabled: boolean
    rate_per_minute?: number
    features?: string[]
    history_persistence?: string
}

const productName = 'Quorum'
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const valueProps = [
    { icon: Users, title: '多模型圆桌', body: '让 GPT、Gemini、Grok、DeepSeek 分角色讨论同一个问题。' },
    { icon: Sparkles, title: '共识汇总', body: '自动沉淀一致观点、分歧点和下一步追问方向。' },
    { icon: FileText, title: '可交付记录', body: '支持历史会话、Markdown 导出、附件和联网搜索。' },
]

export default function AuthPage() {
    const { enterDemoMode } = useAuth()
    const [mode, setMode] = useState<Mode>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isTyping, setIsTyping] = useState(false)
    const [loading, setLoading] = useState(false)
    const [demoLoading, setDemoLoading] = useState(false)
    const [demoStatus, setDemoStatus] = useState<DemoStatus | null>(null)
    const [demoStatusLoaded, setDemoStatusLoaded] = useState(false)
    const [touched, setTouched] = useState({ email: false, password: false })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => {
        const controller = new AbortController()
        fetch('/api/demo/status', { signal: controller.signal })
            .then(resp => (resp.ok ? resp.json() : null))
            .then((data: DemoStatus | null) => {
                if (data && typeof data.enabled === 'boolean') setDemoStatus(data)
            })
            .catch(() => {
                if (!controller.signal.aborted) setDemoStatus(null)
            })
            .finally(() => {
                if (!controller.signal.aborted) setDemoStatusLoaded(true)
            })
        return () => controller.abort()
    }, [])

    const isLogin = mode === 'login'
    const normalizedEmail = email.trim()

    const fieldErrors = useMemo(() => {
        const next = { email: '', password: '' }
        if (!normalizedEmail) {
            next.email = '请输入邮箱'
        } else if (!emailPattern.test(normalizedEmail)) {
            next.email = '请输入有效的邮箱地址'
        }

        if (!password) {
            next.password = '请输入密码'
        } else if (!isLogin && password.length < 6) {
            next.password = '密码至少 6 位'
        }

        return next
    }, [isLogin, normalizedEmail, password])

    const visibleEmailError = touched.email ? fieldErrors.email : ''
    const visiblePasswordError = touched.password ? fieldErrors.password : ''
    const canSubmit = !loading
    const demoEnabled = demoStatus?.enabled === true

    const switchMode = (nextMode: Mode) => {
        setMode(nextMode)
        setTouched({ email: false, password: false })
        setError('')
        setSuccess('')
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setTouched({ email: true, password: true })
        setError('')
        setSuccess('')

        if (fieldErrors.email || fieldErrors.password) {
            setError('请先修正邮箱或密码信息')
            return
        }

        setLoading(true)
        try {
            if (mode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({
                    email: normalizedEmail,
                    password,
                })
                if (error) throw error
            } else {
                const { data, error } = await supabase.auth.signUp({
                    email: normalizedEmail,
                    password,
                })
                if (error) throw error
                if (data.session) {
                    setSuccess('注册成功，已自动登录。')
                } else {
                    setMode('login')
                    setTouched({ email: false, password: false })
                    setSuccess('注册成功，请检查邮箱并点击确认链接后登录。')
                }
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '操作失败，请重试'
            if (msg.includes('Invalid login')) setError('邮箱或密码错误')
            else if (msg.includes('already registered')) setError('该邮箱已注册，请直接登录')
            else if (msg.includes('Password should')) setError('密码至少 6 位')
            else setError(msg)
        } finally {
            setLoading(false)
        }
    }

    const handleDemo = async () => {
        setError('')
        setDemoLoading(true)
        try {
            const ok = await enterDemoMode()
            if (!ok) {
                setError('演示模式暂未开启，请注册账号后使用。')
            }
        } finally {
            setDemoLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#f7f6f2] text-slate-950 font-sans">
            <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
                <aside className="relative hidden overflow-hidden bg-[#1e2a24] p-10 text-[#f7f6f2] lg:flex lg:flex-col">
                    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                        <div
                            className="absolute -left-24 -top-24 h-80 w-80 rounded-full"
                            style={{ background: 'radial-gradient(circle, rgba(149,197,173,0.20), transparent 70%)', filter: 'blur(44px)' }}
                        />
                        <div
                            className="absolute -right-20 top-1/3 h-72 w-72 rounded-full"
                            style={{ background: 'radial-gradient(circle, rgba(240,179,91,0.14), transparent 70%)', filter: 'blur(52px)' }}
                        />
                        <div
                            className="absolute inset-0 opacity-[0.05]"
                            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #f7f6f2 1px, transparent 0)', backgroundSize: '26px 26px' }}
                        />
                        <div
                            className="absolute inset-0"
                            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 52%, rgba(0,0,0,0.28) 100%)' }}
                        />
                    </div>
                    <div className="relative z-20 flex items-center justify-between">
                        <a href="/" className="flex items-center gap-2 text-lg font-semibold">
                            <BrandMark tone="dark" />
                            <span>{productName}</span>
                        </a>
                        <span className="rounded-full border border-[#f7f6f2]/15 px-3 py-1 text-xs text-[#d8e6d5]">
                            AI 协作工作台
                        </span>
                    </div>

                    <div className="relative z-20 mt-16 max-w-xl">
                        <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-[#95c5ad]">
                            多模型协作式 AI 对话平台
                        </p>
                        <h1 className="max-w-[11ch] text-5xl font-bold leading-[1.05] tracking-tight">
                            把一次提问变成一场圆桌评审
                        </h1>
                        <p className="mt-6 max-w-lg text-base leading-7 text-[#d8e6d5]">
                            Quorum 适合用来做技术方案评审、产品决策、创意发散和复杂问题复盘。它不只是聊天框，而是能留下过程、观点和结论的协作记录。
                        </p>
                    </div>

                    <div className="relative z-20 mt-10 grid max-w-xl gap-3">
                        {valueProps.map(item => (
                            <div key={item.title} className="flex gap-3 border-t border-[#f7f6f2]/10 pt-4">
                                <item.icon className="mt-0.5 size-5 shrink-0 text-[#f0b35b]" strokeWidth={1.8} />
                                <div>
                                    <h2 className="text-sm font-semibold text-[#f7f6f2]">{item.title}</h2>
                                    <p className="mt-1 text-sm leading-6 text-[#b9c9bf]">{item.body}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="relative z-20 mt-auto flex justify-center pt-8 select-none pointer-events-none">
                        <div className="origin-bottom scale-[0.8] xl:scale-90 2xl:scale-100">
                            <AuthMascots
                                isTyping={isTyping}
                                showPassword={showPassword}
                                passwordLength={password.length}
                            />
                        </div>
                    </div>
                </aside>

                <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8">
                    <div className="w-full max-w-[440px] animate-fade-in-up" style={{ opacity: 0 }}>
                        <div className="mb-8 flex items-center justify-between lg:hidden">
                            <a href="/" className="flex items-center gap-2 text-lg font-semibold">
                                <BrandMark />
                                <span>{productName}</span>
                            </a>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
                                多模型 AI
                            </span>
                        </div>

                        <div className="mb-8">
                            <p className="mb-2 text-sm font-medium text-[#406c55]">
                                {isLogin ? '继续你的 AI 圆桌' : '创建 Quorum 工作台'}
                            </p>
                            <h2 className="text-3xl font-bold tracking-tight">
                                {isLogin ? '登录后查看历史与配置' : '注册后保存讨论记录'}
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                {isLogin
                                    ? '账号用于隔离历史记录和 API 配置。公开演示开启时，也可以先免登录试用。'
                                    : '建议使用真实邮箱，便于确认账号并在多设备继续访问历史会话。'}
                            </p>
                        </div>

                        <div
                            className="mb-6 grid grid-cols-2 rounded-full border border-slate-200 bg-white p-1"
                            role="tablist"
                            aria-label="登录或注册"
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={isLogin}
                                onClick={() => switchMode('login')}
                                className={clsx(
                                    'h-10 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#406c55] focus-visible:ring-offset-2',
                                    isLogin ? 'bg-[#1e2a24] text-white' : 'text-slate-500 hover:text-slate-950',
                                )}
                            >
                                登录
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={!isLogin}
                                onClick={() => switchMode('register')}
                                className={clsx(
                                    'h-10 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#406c55] focus-visible:ring-offset-2',
                                    !isLogin ? 'bg-[#1e2a24] text-white' : 'text-slate-500 hover:text-slate-950',
                                )}
                            >
                                注册
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} noValidate className="space-y-5">
                            <FieldBlock
                                label="邮箱"
                                htmlFor="email"
                                error={visibleEmailError}
                            >
                                <input
                                    id="email"
                                    type="email"
                                    inputMode="email"
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    value={email}
                                    onChange={e => {
                                        setEmail(e.target.value)
                                        if (touched.email) setError('')
                                    }}
                                    onBlur={() => {
                                        setIsTyping(false)
                                        setTouched(prev => ({ ...prev, email: true }))
                                    }}
                                    onFocus={() => setIsTyping(true)}
                                    aria-invalid={Boolean(visibleEmailError)}
                                    aria-describedby={visibleEmailError ? 'email-error' : undefined}
                                    className={inputClass(Boolean(visibleEmailError))}
                                />
                            </FieldBlock>

                            <FieldBlock
                                label="密码"
                                htmlFor="password"
                                error={visiblePasswordError}
                                hint={isLogin ? undefined : '至少 6 位，建议包含字母和数字。'}
                            >
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder={isLogin ? '输入密码' : '至少 6 位'}
                                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                                        minLength={isLogin ? undefined : 6}
                                        value={password}
                                        onChange={e => {
                                            setPassword(e.target.value)
                                            if (touched.password) setError('')
                                        }}
                                        onFocus={() => setIsTyping(true)}
                                        onBlur={() => {
                                            setIsTyping(false)
                                            setTouched(prev => ({ ...prev, password: true }))
                                        }}
                                        aria-invalid={Boolean(visiblePasswordError)}
                                        aria-describedby={visiblePasswordError ? 'password-error' : isLogin ? undefined : 'password-hint'}
                                        className={clsx(inputClass(Boolean(visiblePasswordError)), 'pr-12')}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(value => !value)}
                                        className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#406c55]"
                                        aria-label={showPassword ? '隐藏密码' : '显示密码'}
                                    >
                                        {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                                    </button>
                                </div>
                            </FieldBlock>

                            {isLogin && (
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <ShieldCheck className="size-4 text-[#406c55]" />
                                        <span>会话由 Supabase 安全托管</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setError('请联系管理员通过 Supabase 后台重置密码。')}
                                        className="text-sm font-medium text-[#406c55] hover:underline"
                                    >
                                        忘记密码？
                                    </button>
                                </div>
                            )}

                            {error && (
                                <StatusMessage id="auth-error" tone="error">
                                    {error}
                                </StatusMessage>
                            )}

                            {success && (
                                <StatusMessage id="auth-success" tone="success">
                                    {success}
                                </StatusMessage>
                            )}

                            <PrimaryButton
                                type="submit"
                                disabled={!canSubmit}
                                loading={loading}
                                className="w-full"
                            >
                                {loading ? '处理中...' : isLogin ? '登录 Quorum' : '创建账号'}
                            </PrimaryButton>
                        </form>

                        <div className="mt-6">
                            {demoEnabled ? (
                                <button
                                    type="button"
                                    onClick={handleDemo}
                                    disabled={demoLoading}
                                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#d7c7a5] bg-[#fffaf0] px-5 text-sm font-semibold text-[#6d4b16] transition-colors hover:bg-[#fff3d8] disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b47d2a] focus-visible:ring-offset-2"
                                >
                                    {demoLoading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                                    免登录体验 Demo
                                </button>
                            ) : (
                                <p className="text-center text-xs leading-5 text-slate-500">
                                    {demoStatusLoaded ? '公开演示暂未开启，请登录或注册后使用。' : '正在检查公开演示状态...'}
                                </p>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

function FieldBlock({
    label,
    htmlFor,
    children,
    error,
    hint,
}: {
    label: string
    htmlFor: string
    children: ReactNode
    error?: string
    hint?: string
}) {
    return (
        <div className="space-y-2">
            <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-800">
                {label}
            </label>
            {children}
            {hint && !error && (
                <p id={`${htmlFor}-hint`} className="text-xs text-slate-500">
                    {hint}
                </p>
            )}
            {error && (
                <p id={`${htmlFor}-error`} className="flex items-center gap-1.5 text-xs text-red-600">
                    <AlertCircle className="size-3.5" />
                    {error}
                </p>
            )}
        </div>
    )
}

function StatusMessage({
    id,
    tone,
    children,
}: {
    id: string
    tone: 'error' | 'success'
    children: ReactNode
}) {
    const isError = tone === 'error'
    return (
        <div
            id={id}
            role={isError ? 'alert' : 'status'}
            className={clsx(
                'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm',
                isError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
            )}
        >
            {isError ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
            <span>{children}</span>
        </div>
    )
}

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    loading?: boolean
}

function PrimaryButton({
    children,
    className,
    loading = false,
    disabled,
    ...props
}: PrimaryButtonProps) {
    return (
        <button
            className={clsx(
                'group flex h-12 items-center justify-center gap-2 rounded-full bg-[#1e2a24] px-6 text-base font-semibold text-white transition-colors hover:bg-[#2b3b33] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#406c55] focus-visible:ring-offset-2',
                className,
            )}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <Loader2 className="size-4 animate-spin" />
            ) : (
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            )}
            <span>{children}</span>
        </button>
    )
}

function inputClass(hasError: boolean) {
    return clsx(
        'flex h-12 w-full rounded-full border bg-white px-4 py-2 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        hasError
            ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200'
            : 'border-slate-200 focus:border-[#406c55] focus:ring-2 focus:ring-[#cfe1d5]',
    )
}

function BrandMark({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
    return (
        <span
            className={clsx(
                'flex size-8 items-center justify-center rounded-lg',
                tone === 'dark' ? 'bg-[#f7f6f2]/10' : 'bg-[#1e2a24]/10',
            )}
            aria-label={`${productName} logo`}
        >
            <span
                className={clsx(
                    'flex size-6 items-center justify-center rounded-full text-[13px] font-bold leading-none',
                    tone === 'dark' ? 'bg-[#f7f6f2] text-[#1e2a24]' : 'bg-[#1e2a24] text-white',
                )}
            >
                Q
            </span>
        </span>
    )
}
