import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'

export interface SourceItem {
    title: string
    url: string
}

/**
 * Markdown 渲染器 — 支持 GFM + Math(LaTeX) + 代码高亮 + 引用来源 tooltip
 */
export default function MarkdownRenderer({
    content,
    isStreaming = false,
    accentColor,
    sources = [],
}: {
    content: string
    isStreaming?: boolean
    accentColor?: string
    sources?: SourceItem[]
}) {
    // 预处理：将 [N] 和【N】引用标记替换为 Unicode 标记，避免被 react-markdown 解析为链接
    const processedContent = sources.length > 0
        ? content
            .replace(/\[(\d+)\]/g, '⟦CITE:$1⟧')
            .replace(/【(\d+)】/g, '⟦CITE:$1⟧')
        : content

    return (
        <div className="markdown-body prose-custom">
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeHighlight, rehypeKatex]}
                components={{
                    pre({ children }) {
                        return <div className="relative group/code my-4">{children}</div>
                    },
                    code({ className, children, ...props }) {
                        const isInline = !className
                        if (isInline) {
                            return (
                                <code className="px-1.5 py-0.5 bg-white/10 rounded-md text-[13px] font-mono text-violet-300 font-medium" {...props}>
                                    {children}
                                </code>
                            )
                        }
                        const lang = className?.replace('hljs language-', '')?.replace('language-', '') || ''
                        return <CodeBlock lang={lang} code={String(children).replace(/\n$/, '')} />
                    },
                    p({ children }) {
                        return <p className="mb-4 last:mb-0 leading-relaxed text-text-2">{injectCitations(children, sources)}</p>
                    },
                    li({ children }) { return <li className="text-text-2">{injectCitations(children, sources)}</li> },
                    h1({ children }) { return <h1 className="text-xl font-bold text-text-1 mt-6 mb-4">{children}</h1> },
                    h2({ children }) { return <h2 className="text-lg font-bold text-text-1 mt-5 mb-3">{children}</h2> },
                    h3({ children }) { return <h3 className="text-base font-bold text-text-1 mt-4 mb-2">{children}</h3> },
                    ul({ children }) { return <ul className="list-disc pl-6 mb-4 space-y-2">{children}</ul> },
                    ol({ children }) { return <ol className="list-decimal pl-6 mb-4 space-y-2">{children}</ol> },
                    blockquote({ children }) {
                        return (
                            <blockquote className="border-l-4 border-violet-500/40 pl-4 py-1 my-4 bg-violet-500/5 rounded-r-lg text-text-3 italic">
                                {children}
                            </blockquote>
                        )
                    },
                    table({ children }) {
                        return (
                            <div className="overflow-x-auto my-5 rounded-xl border border-white/10 shadow-sm">
                                <table className="min-w-full text-sm divide-y divide-white/10">{children}</table>
                            </div>
                        )
                    },
                    thead({ children }) { return <thead className="bg-white/5">{children}</thead> },
                    th({ children }) { return <th className="px-4 py-3 text-left text-xs font-bold text-text-1 uppercase tracking-wider">{children}</th> },
                    td({ children }) { return <td className="px-4 py-3 text-text-3 border-t border-white/5">{children}</td> },
                    a({ href, children }) {
                        return <a href={href} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-cyan-400 transition-colors underline underline-offset-4 decoration-violet-500/30 font-medium">{children}</a>
                    },
                    hr() { return <hr className="my-6 border-white/10" /> },
                    strong({ children }) { return <strong className="font-bold text-text-1">{children}</strong> },
                    em({ children }) { return <em className="italic text-text-3 leading-loose">{children}</em> },
                }}
            >
                {processedContent}
            </ReactMarkdown>
            {isStreaming && (
                <span
                    className="inline-block w-1 h-5 ml-1 rounded-full animate-pulse transition-all shadow-[0_0_10px_currentColor]"
                    style={{ background: accentColor || '#a855f7', color: accentColor || '#a855f7' }}
                />
            )}
        </div>
    )
}

// ─── Citation Tooltip ─────────────────────────────
function CitationBadge({ index, source }: { index: number; source?: SourceItem }) {
    const [show, setShow] = useState(false)

    if (!source) {
        return <sup className="text-[10px] text-violet-400/60 font-mono">[{index}]</sup>
    }

    return (
        <span
            className="relative inline-block align-super"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            <sup className="cursor-pointer text-[10px] font-bold text-violet-400 bg-violet-500/15 px-1 py-0.5 rounded-md hover:bg-violet-500/30 transition-all">
                {index}
            </sup>
            {show && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 z-50 animate-spring-pop">
                    <span className="block bg-bg-3 border border-white/10 rounded-xl p-3 shadow-2xl backdrop-blur-sm">
                        <span className="text-[11px] text-text-2 font-medium leading-snug line-clamp-2 block mb-1.5">
                            {source.title}
                        </span>
                        {source.url && (
                            <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-cyan-400 transition-colors"
                                onClick={e => e.stopPropagation()}
                            >
                                <ExternalLink size={9} />
                                <span className="truncate">{(() => { try { return new URL(source.url).hostname } catch { return source.url } })()}</span>
                            </a>
                        )}
                    </span>
                    <span className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-bg-3 border-r border-b border-white/10 rotate-45 -mt-1" />
                </span>
            )}
        </span>
    )
}

/** 递归扫描 React children，将文本中的 ⟦CITE:N⟧ 替换为 CitationBadge */
function injectCitations(children: React.ReactNode, sources: SourceItem[]): React.ReactNode {
    if (!sources || sources.length === 0) return children

    const processNode = (node: React.ReactNode, key: number): React.ReactNode => {
        // 纯文本：拆分并替换标记
        if (typeof node === 'string') {
            const parts = node.split(/(⟦CITE:\d+⟧)/g)
            if (parts.length === 1) return node
            return (
                <React.Fragment key={`frag-${key}`}>
                    {parts.map((part, i) => {
                        const match = part.match(/^⟦CITE:(\d+)⟧$/)
                        if (match) {
                            const idx = parseInt(match[1], 10)
                            return <CitationBadge key={`cite-${key}-${i}`} index={idx} source={sources[idx - 1]} />
                        }
                        return part
                    })}
                </React.Fragment>
            )
        }
        // 数组：递归处理每个子节点
        if (Array.isArray(node)) {
            return node.map((child, i) => processNode(child, i))
        }
        // React 元素：递归 clone 其 children
        if (React.isValidElement(node)) {
            const props = node.props as Record<string, any>
            if (props.children) {
                const newChildren = processNode(props.children, key + 100)
                return React.cloneElement(node, { key: `cloned-${key}` }, newChildren)
            }
        }
        return node
    }

    if (Array.isArray(children)) {
        return children.map((child, i) => processNode(child, i))
    }
    return processNode(children, 0)
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
            <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed">
                <code className={`hljs language-${lang}`}>{code}</code>
            </pre>
        </div>
    )
}
