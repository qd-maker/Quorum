/**
 * 带 Authorization header 的 fetch 封装。
 * - 自动从 Supabase session 取 JWT，附加到所有 /api 请求
 * - 429 限流时统一 toast 提示
 * - 网络错误统一 toast 提示
 */
import { toast } from 'sonner'
import { supabase } from './supabase'

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const headers = new Headers(options.headers)

    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
    }

    if (token) {
        headers.set('Authorization', `Bearer ${token}`)
    }

    let resp: Response
    try {
        resp = await fetch(url, {
            ...options,
            headers,
        })
    } catch (err) {
        // 网络层错误（断网、CORS、DNS 等）
        if (!(options.signal as AbortSignal | undefined)?.aborted) {
            toast.error('网络异常，请检查连接后重试')
        }
        throw err
    }

    // 429: 限流命中 — 给用户友好提示
    if (resp.status === 429) {
        try {
            const body = await resp.clone().json()
            const retry = body?.retry_after_seconds ?? 60
            toast.warning(body?.detail ?? '请求过于频繁', {
                description: `请等待约 ${retry} 秒后再试`,
            })
        } catch {
            toast.warning('请求过于频繁，请稍后再试')
        }
    }

    return resp
}

export async function readApiError(resp: Response, fallback = '请求失败，请稍后重试'): Promise<string> {
    try {
        const body = await resp.clone().json()
        if (typeof body?.detail === 'string') return body.detail
        if (Array.isArray(body?.detail) && body.detail[0]?.msg) return body.detail[0].msg
        if (typeof body?.message === 'string') return body.message
    } catch {
        // ignore non-JSON response
    }
    return `${fallback}（HTTP ${resp.status}）`
}
