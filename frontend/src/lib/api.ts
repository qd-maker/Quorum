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

    let resp: Response
    try {
        resp = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(options.headers as Record<string, string> || {}),
            },
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
