import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

/**
 * Markdown 渲染器 — 支持 GFM(表格/删除线/任务列表) + 代码高亮
 * 流式输出时也能正确渲染（增量 Markdown）
 */
export default function MarkdownRenderer({
    content,
    isStreaming = false,
    accentColor,
}: {
    content: string
    isStreaming?: boolean
    accentColor?: string
}) {
    return (
        <div className="markdown-body">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                    // 代码块
                    pre({ children }) {
                        return <div className="relative group/code my-3">{children}</div>
                    },
                    code({ className, children, ...props }) {
                        const isInline = !className
                        if (isInline) {
                            return (
                                <code className="px-1.5 py-0.5 bg-white/8 rounded-md text-[13px] font-mono text-violet-300" {...props}>
                                    {children}
                                </code>
                            )
                        }
                        const lang = className?.replace('hljs language-', '')?.replace('language-', '') || ''
                        return <CodeBlock lang={lang} code={String(children).replace(/\n$/, '')} />
                    },
                    // 段落
                    p({ children }) {
                        return <p className="mb-2.5 last:mb-0">{children}</p>
                    },
                    // 标题
                    h1({ children }) { return <h1 className="text-lg font-bold text-text-1 mt-4 mb-2">{children}</h1> },
                    h2({ children }) { return <h2 className="text-base font-bold text-text-1 mt-3 mb-2">{children}</h2> },
                    h3({ children }) { return <h3 className="text-sm font-bold text-text-1 mt-3 mb-1.5">{children}</h3> },
                    // 列表
                    ul({ children }) { return <ul className="list-disc pl-5 mb-2.5 space-y-1">{children}</ul> },
                    ol({ children }) { return <ol className="list-decimal pl-5 mb-2.5 space-y-1">{children}</ol> },
                    li({ children }) { return <li className="text-text-2">{children}</li> },
                    // 引用
                    blockquote({ children }) {
                        return (
                            <blockquote className="border-l-2 border-violet-400/40 pl-3 my-2.5 text-text-4 italic">
                                {children}
                            </blockquote>
                        )
                    },
                    // 表格
                    table({ children }) {
                        return (
                            <div className="overflow-x-auto my-3 rounded-lg border border-white/10">
                                <table className="min-w-full text-sm">{children}</table>
                            </div>
                        )
                    },
                    thead({ children }) { return <thead className="bg-white/5">{children}</thead> },
                    th({ children }) { return <th className="px-3 py-2 text-left text-xs font-semibold text-text-2 border-b border-white/10">{children}</th> },
                    td({ children }) { return <td className="px-3 py-2 text-text-3 border-b border-white/5">{children}</td> },
                    // 链接
                    a({ href, children }) {
                        return <a href={href} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">{children}</a>
                    },
                    // 分割线
                    hr() { return <hr className="my-4 border-white/10" /> },
                    // 粗体/斜体
                    strong({ children }) { return <strong className="font-semibold text-text-1">{children}</strong> },
                    em({ children }) { return <em className="italic text-text-3">{children}</em> },
                }}
            >
                {content}
            </ReactMarkdown>
            {/* 流式光标 */}
            {isStreaming && (
                <span
                    className="inline-block w-0.5 h-4 ml-0.5 rounded-full animate-pulse align-text-bottom"
                    style={{ background: accentColor || '#8b5cf6' }}
                />
            )}
        </div>
    )
}

// ─── 代码块（带复制按钮 + 语言标签）──────────────
function CodeBlock({ lang, code }: { lang: string; code: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="relative rounded-xl overflow-hidden bg-[#0d1117] border border-white/8 my-3">
            {/* 顶栏 */}
            <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/8">
                <span className="text-[11px] font-mono text-text-5 uppercase tracking-wide">{lang || 'code'}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-[11px] text-text-5 hover:text-text-2 transition-colors"
                >
                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    {copied ? '已复制' : '复制'}
                </button>
            </div>
            {/* 代码 */}
            <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed">
                <code className={`hljs language-${lang}`}>{code}</code>
            </pre>
        </div>
    )
}
