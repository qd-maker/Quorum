import clsx from 'clsx'
import type { ModelId } from '../types'
import { MODEL_META } from '../types'
import TypingIndicator from './TypingIndicator'

// ─── Model Avatar ─────────────────────────────────
export function ModelAvatar({
  modelId, size = 'md',
}: {
  modelId: ModelId
  size?: 'sm' | 'md' | 'lg'
}) {
  const meta = MODEL_META[modelId]
  const sizeMap = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base' }

  if (modelId === 'gpt-4o') {
    return (
      <div className={clsx('rounded-xl flex items-center justify-center font-bold font-mono flex-shrink-0', sizeMap[size])}
        style={{ background: `linear-gradient(135deg, ${meta.gradientFrom}, ${meta.gradientTo})` }}>
        <span className="text-white">G</span>
      </div>
    )
  }

  if (modelId === 'gemini-2.0-flash') {
    return (
      <div className={clsx('rounded-xl flex items-center justify-center flex-shrink-0', sizeMap[size])}
        style={{ background: `linear-gradient(135deg, ${meta.gradientFrom}, ${meta.gradientTo})` }}>
        {/* Gemini star icon */}
        <svg viewBox="0 0 24 24" className={size === 'sm' ? 'w-3.5 h-3.5' : size === 'md' ? 'w-4.5 h-4.5' : 'w-5 h-5'} fill="white" style={{ width: size === 'sm' ? 14 : size === 'md' ? 18 : 22, height: size === 'sm' ? 14 : size === 'md' ? 18 : 22 }}>
          <path d="M12 2C12 7.52 16.48 12 22 12C16.48 12 12 16.48 12 22C12 16.48 7.52 12 2 12C7.52 12 12 7.52 12 2Z" />
        </svg>
      </div>
    )
  }

  if (modelId === 'deepseek-chat') {
    return (
      <div className={clsx('rounded-xl flex items-center justify-center font-bold font-mono flex-shrink-0', sizeMap[size])}
        style={{ background: `linear-gradient(135deg, ${meta.gradientFrom}, ${meta.gradientTo})` }}>
        <span className="text-white">D</span>
      </div>
    )
  }

  // Grok
  return (
    <div className={clsx('rounded-xl flex items-center justify-center flex-shrink-0', sizeMap[size])}
      style={{ background: `linear-gradient(135deg, ${meta.gradientFrom}, ${meta.gradientTo})` }}>
      <svg viewBox="0 0 24 24" fill="white" style={{ width: size === 'sm' ? 14 : size === 'md' ? 18 : 22, height: size === 'sm' ? 14 : size === 'md' ? 18 : 22 }}>
        <path d="M17.675 3H14.5L9.1 11.25 13.2 17.75 17.675 3ZM6.325 21L9.5 21 14.9 12.75 10.8 6.25 6.325 21Z" />
      </svg>
    </div>
  )
}

// ─── Model Badge ──────────────────────────────────
function ModelBadge({ modelId }: { modelId: ModelId }) {
  const meta = MODEL_META[modelId]
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-md"
      style={{ color: meta.color, background: meta.dimColor }}
    >
      {meta.shortName}
    </span>
  )
}

// ─── MessageBubble ────────────────────────────────
interface MessageBubbleProps {
  modelId: ModelId
  content: string
  isStreaming?: boolean
  round: number
  animDelay?: number
}

const bubbleClass: Record<ModelId, string> = {
  'gpt-4o': 'bubble-gpt',
  'gemini-2.0-flash': 'bubble-gemini',
  'grok-2': 'bubble-grok',
  'deepseek-chat': 'bubble-deepseek',
}

export default function ModelBubble({
  modelId, content, isStreaming = false, round, animDelay = 0,
}: MessageBubbleProps) {
  const meta = MODEL_META[modelId]

  return (
    <div
      className="flex gap-3 animate-fade-in-up"
      style={{ animationDelay: `${animDelay}ms`, opacity: 0 }}
    >
      <ModelAvatar modelId={modelId} size="md" />

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <ModelBadge modelId={modelId} />
          <span className="text-xs text-text-5">{meta.description}</span>
          <span className="text-xs text-text-5 ml-auto">第 {round} 轮</span>
        </div>

        {/* Bubble */}
        <div
          className={clsx(
            'rounded-xl rounded-tl-sm px-4 py-3.5 bg-bg-3 text-text-2 text-sm leading-relaxed',
            bubbleClass[modelId],
            'transition-all duration-300'
          )}
        >
          <div className="prose-dark">
            {content.split('\n').map((line, i) => {
              if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="font-semibold text-text-1">{line.slice(2, -2)}</p>
              }
              return line ? <p key={i}>{line}</p> : <br key={i} />
            })}
          </div>

          {isStreaming && (
            <span
              className="inline-block w-0.5 h-4 ml-0.5 rounded-full animate-pulse"
              style={{ background: meta.color }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
