// ============ 模型定义 ============
export type ModelId = 'gpt-4o' | 'gemini-2.0-flash' | 'grok-2' | 'deepseek-chat'

export interface ModelMeta {
  id: ModelId
  name: string
  shortName: string
  provider: 'openai' | 'google' | 'xai' | 'deepseek'
  color: string
  gradientFrom: string
  gradientTo: string
  dimColor: string
  description: string
}

// localStorage 中存储的 API 配置 key
const API_CONFIG_KEY = 'many-ai-api-config'

// ModelId → localStorage 配置字段名
const MODEL_CONFIG_KEYS: Record<ModelId, string> = {
  'gpt-4o': 'gptModel',
  'gemini-2.0-flash': 'geminiModel',
  'grok-2': 'grokModel',
  'deepseek-chat': 'deepseekModel',
}

/**
 * 从 localStorage 读取用户配置的模型名称。
 * 如果用户配置了自定义名称，返回自定义名称；否则返回默认名称。
 */
export function getModelDisplayName(modelId: ModelId): string {
  try {
    const raw = localStorage.getItem(API_CONFIG_KEY)
    if (raw) {
      const cfg = JSON.parse(raw)
      const key = MODEL_CONFIG_KEYS[modelId]
      if (key && cfg[key]) return cfg[key]
    }
  } catch { /* ignore */ }
  return MODEL_META[modelId].name
}

export const MODEL_META: Record<ModelId, ModelMeta> = {
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    shortName: 'GPT',
    provider: 'openai',
    color: '#10A37F',
    gradientFrom: '#10A37F',
    gradientTo: '#059669',
    dimColor: 'rgba(16,163,127,0.15)',
    description: 'OpenAI · 深度推理',
  },
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0',
    shortName: 'Gemini',
    provider: 'google',
    color: '#A855F7',
    gradientFrom: '#A855F7',
    gradientTo: '#06B6D4',
    dimColor: 'rgba(168,85,247,0.15)',
    description: 'Google · 多模态',
  },
  'grok-2': {
    id: 'grok-2',
    name: 'Grok-4',
    shortName: 'Grok',
    provider: 'xai',
    color: '#00D4FF',
    gradientFrom: '#00D4FF',
    gradientTo: '#0EA5E9',
    dimColor: 'rgba(0,212,255,0.15)',
    description: 'xAI · 实时资讯',
  },
  'deepseek-chat': {
    id: 'deepseek-chat',
    name: 'DeepSeek',
    shortName: 'DeepSeek',
    provider: 'deepseek',
    color: '#4D6BFE',
    gradientFrom: '#4D6BFE',
    gradientTo: '#3B82F6',
    dimColor: 'rgba(77,107,254,0.15)',
    description: 'DeepSeek · 深度思考',
  },
}

// ============ 聊天 ============
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  model?: ModelId
  timestamp: number
}

// ============ 群聊讨论 ============
export interface DiscussMessage {
  id: string
  model: ModelId
  round: number
  content: string
  isStreaming: boolean
  timestamp: number
}

export type DiscussPhase = 'idle' | 'round1' | 'round2' | 'consensus' | 'done'

export interface DiscussSession {
  id: string
  topic: string
  messages: DiscussMessage[]
  phase: DiscussPhase
  consensusContent: string
  createdAt: number
}

// ============ 历史记录 ============
export type SessionType = 'chat' | 'discuss'
export interface HistoryItem {
  id: string
  type: SessionType
  title: string
  preview: string
  createdAt: number
}
