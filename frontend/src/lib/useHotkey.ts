/**
 * 简洁的全局快捷键 hook
 * 用法: useHotkey('Mod+Enter', () => doSend(), { enabled: canSend })
 *
 * Mod = Cmd (mac) / Ctrl (其他)
 */
import { useEffect } from 'react'

interface Options {
    enabled?: boolean
    /** 是否在 input/textarea 中也触发，默认仅 Mod+Enter / Esc 触发 */
    allowInInput?: boolean
    /** preventDefault 默认 true */
    preventDefault?: boolean
}

function isInputElement(t: EventTarget | null): boolean {
    if (!(t instanceof HTMLElement)) return false
    const tag = t.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable
}

function matchesCombo(e: KeyboardEvent, combo: string): boolean {
    const parts = combo.split('+').map((s) => s.trim().toLowerCase())
    const key = parts[parts.length - 1]
    const mods = parts.slice(0, -1)

    const isMod = mods.includes('mod')
    const isCtrl = mods.includes('ctrl') || (isMod && !navigator.platform.toLowerCase().includes('mac'))
    const isMeta = mods.includes('meta') || (isMod && navigator.platform.toLowerCase().includes('mac'))
    const isShift = mods.includes('shift')
    const isAlt = mods.includes('alt')

    // 检查 modifiers
    if (isMod) {
        if (!(e.ctrlKey || e.metaKey)) return false
    } else {
        if (isCtrl !== e.ctrlKey) return false
        if (isMeta !== e.metaKey) return false
    }
    if (isShift !== e.shiftKey) return false
    if (isAlt !== e.altKey) return false

    return e.key.toLowerCase() === key
}

export function useHotkey(
    combo: string,
    handler: (e: KeyboardEvent) => void,
    { enabled = true, allowInInput = false, preventDefault = true }: Options = {},
) {
    useEffect(() => {
        if (!enabled) return
        const listener = (e: KeyboardEvent) => {
            if (!matchesCombo(e, combo)) return
            // 默认在输入框内不触发，除非显式允许（或带 mod 键）
            const inInput = isInputElement(e.target)
            const hasMod = e.ctrlKey || e.metaKey
            if (inInput && !allowInInput && !hasMod && e.key !== 'Escape') return

            if (preventDefault) e.preventDefault()
            handler(e)
        }
        window.addEventListener('keydown', listener)
        return () => window.removeEventListener('keydown', listener)
    }, [combo, handler, enabled, allowInInput, preventDefault])
}
