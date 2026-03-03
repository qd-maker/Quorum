import { useState, useEffect, useCallback } from 'react'
import { Moon, Sun } from 'lucide-react'
import clsx from 'clsx'

const STORAGE_KEY = 'many-ai-theme'

function getInitialTheme(): 'dark' | 'light' {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved === 'light' || saved === 'dark') return saved
    } catch { /* ignore */ }
    return 'dark'
}

export default function ThemeToggle() {
    const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme)
    const [animKey, setAnimKey] = useState(0)

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
    }, [])

    const toggle = useCallback(() => {
        const next = theme === 'dark' ? 'light' : 'dark'
        setTheme(next)
        setAnimKey(k => k + 1)
        document.documentElement.setAttribute('data-theme', next)
        localStorage.setItem(STORAGE_KEY, next)
    }, [theme])

    const isDark = theme === 'dark'

    return (
        <button
            onClick={toggle}
            title={isDark ? '切换到浅色主题' : '切换到深色主题'}
            className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-bg-3 transition-colors shrink-0 text-text-4 hover:text-text-1"
        >
            <span key={animKey} className="theme-icon-enter">
                {isDark ? (
                    <Sun size={18} strokeWidth={1.5} />
                ) : (
                    <Moon size={18} strokeWidth={1.5} />
                )}
            </span>
        </button>
    )
}
