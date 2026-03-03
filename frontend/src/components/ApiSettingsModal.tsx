import { useState, useEffect } from 'react'
import { X, Key, Globe, Server, Cpu } from 'lucide-react'
import clsx from 'clsx'

// ─── 默认配置结构 ─────────────────────────────────
interface ApiConfig {
    // API 中转站
    proxyUrl: string
    proxyKey: string
    // 官方 API Keys
    openaiKey: string
    googleKey: string
    xaiKey: string
    deepseekKey: string
    // 模型名称
    gptModel: string
    geminiModel: string
    grokModel: string
    deepseekModel: string
}

const DEFAULT_CONFIG: ApiConfig = {
    proxyUrl: '',
    proxyKey: '',
    openaiKey: '',
    googleKey: '',
    xaiKey: '',
    deepseekKey: '',
    gptModel: 'gpt-4o',
    geminiModel: 'gemini-2.0-flash',
    grokModel: 'grok-4',
    deepseekModel: 'deepseek-chat',
}

const STORAGE_KEY = 'many-ai-api-config'

function loadConfig(): ApiConfig {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
    } catch { /* ignore */ }
    return { ...DEFAULT_CONFIG }
}

function saveConfig(config: ApiConfig) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

// ─── Input Row ───────────────────────────────────
function ConfigInput({
    label, value, onChange, placeholder, icon: Icon, type = 'text',
}: {
    label: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
    icon?: React.ElementType
    type?: string
}) {
    return (
        <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-text-3 mb-1.5">
                {Icon && <Icon size={12} className="text-text-5" />}
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-bg-3 border border-white/10 rounded-xl px-3 py-2 text-sm text-text-1 placeholder:text-text-5 outline-none focus:border-violet-500/50 transition-colors"
            />
        </div>
    )
}

// ─── Section ─────────────────────────────────────
function Section({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon: React.ElementType }) {
    return (
        <div className="mb-6">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                <Icon size={14} className="text-violet-400" />
                <h3 className="text-sm font-semibold text-text-2">{title}</h3>
            </div>
            <div className="space-y-3">
                {children}
            </div>
        </div>
    )
}

// ─── Modal ───────────────────────────────────────
export default function ApiSettingsModal({ onClose }: { onClose: () => void }) {
    const [config, setConfig] = useState<ApiConfig>(loadConfig)
    const [saved, setSaved] = useState(false)

    const update = (key: keyof ApiConfig) => (value: string) => {
        setConfig(prev => ({ ...prev, [key]: value }))
        setSaved(false)
    }

    const handleSave = async () => {
        saveConfig(config)

        // 同步到后端
        try {
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_base_url: config.proxyUrl || undefined,
                    api_key: config.proxyKey || undefined,
                    openai_key: config.openaiKey || undefined,
                    google_key: config.googleKey || undefined,
                    xai_key: config.xaiKey || undefined,
                    deepseek_key: config.deepseekKey || undefined,
                    gpt_model: config.gptModel || undefined,
                    gemini_model: config.geminiModel || undefined,
                    grok_model: config.grokModel || undefined,
                    deepseek_model: config.deepseekModel || undefined,
                }),
            })
        } catch { /* 静默 */ }

        setSaved(true)
        window.dispatchEvent(new Event('config-updated'))
        setTimeout(() => setSaved(false), 2000)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative bg-bg-1 border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl mx-4"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-bg-1/95 backdrop-blur-md flex items-center justify-between px-6 py-4 border-b border-white/5 z-10">
                    <h2 className="text-lg font-bold text-text-1 flex items-center gap-2">
                        <Key size={18} className="text-violet-400" />
                        API 设置
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-text-5 hover:text-text-2 hover:bg-bg-3 transition-all"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                    {/* Proxy / 中转站 */}
                    <Section title="API 中转站（统一代理）" icon={Server}>
                        <ConfigInput
                            label="代理 URL"
                            value={config.proxyUrl}
                            onChange={update('proxyUrl')}
                            placeholder="https://api.example.com/v1"
                            icon={Globe}
                        />
                        <ConfigInput
                            label="API Key"
                            value={config.proxyKey}
                            onChange={update('proxyKey')}
                            placeholder="sk-..."
                            icon={Key}
                            type="password"
                        />
                        <p className="text-xs text-text-5 leading-relaxed">
                            如果使用中转站，所有模型将通过此代理访问。优先级高于官方 API。
                        </p>
                    </Section>

                    {/* Official Keys */}
                    <Section title="官方 API Keys" icon={Key}>
                        <ConfigInput
                            label="OpenAI API Key"
                            value={config.openaiKey}
                            onChange={update('openaiKey')}
                            placeholder="sk-..."
                            type="password"
                        />
                        <ConfigInput
                            label="Google AI API Key"
                            value={config.googleKey}
                            onChange={update('googleKey')}
                            placeholder="AIza..."
                            type="password"
                        />
                        <ConfigInput
                            label="xAI (Grok) API Key"
                            value={config.xaiKey}
                            onChange={update('xaiKey')}
                            placeholder="xai-..."
                            type="password"
                        />
                        <ConfigInput
                            label="DeepSeek API Key"
                            value={config.deepseekKey}
                            onChange={update('deepseekKey')}
                            placeholder="sk-..."
                            type="password"
                        />
                    </Section>

                    {/* Model Names */}
                    <Section title="模型名称" icon={Cpu}>
                        <ConfigInput
                            label="GPT 模型"
                            value={config.gptModel}
                            onChange={update('gptModel')}
                            placeholder="gpt-4o"
                        />
                        <ConfigInput
                            label="Gemini 模型"
                            value={config.geminiModel}
                            onChange={update('geminiModel')}
                            placeholder="gemini-2.0-flash"
                        />
                        <ConfigInput
                            label="Grok 模型"
                            value={config.grokModel}
                            onChange={update('grokModel')}
                            placeholder="grok-4"
                        />
                        <ConfigInput
                            label="DeepSeek 模型"
                            value={config.deepseekModel}
                            onChange={update('deepseekModel')}
                            placeholder="deepseek-chat"
                        />
                    </Section>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-bg-1/95 backdrop-blur-md px-6 py-4 border-t border-white/5 flex items-center justify-between">
                    <p className="text-xs text-text-5">设置保存在浏览器本地</p>
                    <button
                        onClick={handleSave}
                        className={clsx(
                            'px-5 py-2 rounded-xl text-sm font-semibold transition-all',
                            saved
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white hover:opacity-90 shadow-gemini'
                        )}
                    >
                        {saved ? '✓ 已保存' : '保存设置'}
                    </button>
                </div>
            </div>
        </div>
    )
}
