import { useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import clsx from 'clsx'
import { supabase } from '../lib/supabase'
import AuthMascots from '../components/AuthMascots'

type Mode = 'login' | 'register'
const productName = 'Quorum'

export default function AuthPage() {
    const [mode, setMode] = useState<Mode>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isTyping, setIsTyping] = useState(false)
    const [remember, setRemember] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!email.trim() || !password.trim()) return
        setError('')
        setSuccess('')
        setLoading(true)

        try {
            if (mode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) throw error
            } else {
                const { data, error } = await supabase.auth.signUp({ email, password })
                if (error) throw error
                if (data.session) {
                    setSuccess('注册成功，已自动登录！')
                } else {
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

    const isLogin = mode === 'login'

    return (
        <div className="min-h-screen max-h-screen overflow-hidden grid lg:grid-cols-2 bg-white text-slate-950 font-sans">
            <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 p-12 text-white">
                <div className="relative z-20">
                    <a href="/" className="flex items-center gap-2 text-lg font-semibold">
                        <BrandMark />
                        <span>{productName}</span>
                    </a>
                </div>

                <div className="relative z-20 flex items-end justify-center h-[500px]">
                    <AuthMascots
                        isTyping={isTyping}
                        showPassword={showPassword}
                        passwordLength={password.length}
                    />
                </div>

                <div className="absolute top-1/4 right-1/4 size-64 bg-gray-400/20 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 left-1/4 size-96 bg-gray-300/20 rounded-full blur-3xl" />
            </aside>

            <main className="flex items-center justify-center p-8 bg-white">
                <div className="w-full max-w-[420px] animate-fade-in-up" style={{ opacity: 0 }}>
                    <div className="lg:hidden flex items-center justify-center gap-2 text-lg font-semibold mb-12">
                        <BrandMark />
                        <span>{productName}</span>
                    </div>

                    <div className="text-center mb-10">
                        <h1 className="text-3xl font-bold tracking-tight mb-2">
                            {isLogin ? 'Welcome back!' : 'Create account'}
                        </h1>
                        <p className="text-slate-500 text-sm">
                            {isLogin ? 'Please enter your details' : 'Enter your details to get started'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                autoComplete="off"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                onFocus={() => setIsTyping(true)}
                                onBlur={() => setIsTyping(false)}
                                className="flex h-12 w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-base text-slate-950 ring-offset-white placeholder:text-slate-500 outline-none transition-colors focus:border-[#3f51b5] focus:ring-2 focus:ring-[#3f51b5] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="flex h-12 w-full rounded-full border border-slate-200 bg-white px-4 py-2 pr-10 text-base text-slate-950 ring-offset-white placeholder:text-slate-500 outline-none transition-colors focus:border-[#3f51b5] focus:ring-2 focus:ring-[#3f51b5] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(value => !value)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-950 transition-colors"
                                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                                >
                                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                                </button>
                            </div>
                        </div>

                        {isLogin && (
                            <div className="flex items-center justify-between">
                                <label htmlFor="remember" className="flex items-center space-x-2 cursor-pointer">
                                    <span className="relative flex size-4 shrink-0 items-center justify-center">
                                        <input
                                            id="remember"
                                            type="checkbox"
                                            checked={remember}
                                            onChange={e => setRemember(e.target.checked)}
                                            className="peer size-4 shrink-0 appearance-none rounded-sm border border-[#3f51b5] bg-white ring-offset-white transition-colors checked:bg-[#3f51b5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3f51b5] focus-visible:ring-offset-2"
                                        />
                                        <svg
                                            viewBox="0 0 24 24"
                                            aria-hidden="true"
                                            className="pointer-events-none absolute size-4 text-white opacity-0 peer-checked:opacity-100"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M20 6 9 17l-5-5" />
                                        </svg>
                                    </span>
                                    <span className="text-sm font-normal">Remember for 30 days</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setError('请联系管理员通过 Supabase 后台重置密码')}
                                    className="text-sm text-[#3f51b5] hover:underline font-medium"
                                >
                                    Forgot password?
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="p-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
                                {success}
                            </div>
                        )}

                        <InteractiveHoverButton
                            type="submit"
                            text={loading ? 'Signing in...' : isLogin ? 'Log in' : 'Create account'}
                            className="w-full h-12 text-base font-medium"
                            disabled={loading}
                        />
                    </form>

                    <div className="text-center text-sm text-slate-500 mt-8">
                        {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                        <button
                            type="button"
                            onClick={() => {
                                setMode(isLogin ? 'register' : 'login')
                                setError('')
                                setSuccess('')
                            }}
                            className="text-slate-950 font-medium hover:underline"
                        >
                            {isLogin ? 'Sign Up' : 'Log in'}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    )
}

interface InteractiveHoverButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    text?: string
    icon?: ReactNode
}

function InteractiveHoverButton({
    text = 'Button',
    icon,
    className,
    ...props
}: InteractiveHoverButtonProps) {
    return (
        <button
            className={clsx(
                'group relative w-32 cursor-pointer overflow-hidden rounded-full border bg-white px-6 py-2 text-center font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-70',
                className,
            )}
            {...props}
        >
            <span className="inline-block transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0">
                {text}
            </span>
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-full bg-[#3f51b5] text-zinc-50 opacity-0 transition-all duration-300 group-hover:opacity-100">
                <span>{text}</span>
                {icon || <ArrowRight className="h-4 w-4" />}
            </div>
        </button>
    )
}

function BrandMark() {
    return (
        <span
            className="flex size-8 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm"
            aria-label={`${productName} logo`}
        >
            <span className="flex size-6 items-center justify-center rounded-full bg-slate-950 text-[13px] font-bold leading-none text-white">
                Q
            </span>
        </span>
    )
}
