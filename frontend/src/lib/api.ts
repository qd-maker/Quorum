/**
 * 带 Authorization header 的 fetch 封装。
 * 自动从 Supabase session 取 JWT，附加到所有 /api 请求。
 */
import { supabase } from './supabase'

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers as Record<string, string> || {}),
        },
    })
}
