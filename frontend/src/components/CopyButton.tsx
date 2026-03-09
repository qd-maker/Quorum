import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import clsx from 'clsx'

interface Props {
    content: string
    className?: string
}

export default function CopyButton({ content, className }: Props) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        if (!content) return
        try {
            await navigator.clipboard.writeText(content)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy text: ', err)
        }
    }

    return (
        <button
            onClick={handleCopy}
            className={clsx(
                'p-1.5 rounded-lg transition-all duration-200',
                copied
                    ? 'text-emerald-400 bg-emerald-400/10'
                    : 'text-text-5 hover:text-text-2 hover:bg-white/5',
                className
            )}
            title={copied ? '已复制' : '复制内容'}
        >
            {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
    )
}
