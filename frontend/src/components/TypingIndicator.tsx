import clsx from 'clsx'
import { ModelAvatar } from './ModelBubble'
import type { ModelId } from '../types'
import { MODEL_META, normalizeModelId } from '../types'

interface Props {
  modelId: ModelId | string
  label?: string
}

export default function TypingIndicator({ modelId, label }: Props) {
  const normalizedModelId = normalizeModelId(modelId)
  const meta = MODEL_META[normalizedModelId]

  return (
    <div className="flex items-center gap-3 animate-fade-in">
      <ModelAvatar modelId={normalizedModelId} size="md" />
      <div className="flex items-center gap-3 px-4 py-3 bg-bg-3 rounded-xl rounded-tl-sm border-l-2"
        style={{ borderColor: meta.color }}>
        <span className="text-xs text-text-4">{label ?? `${meta.shortName} 正在思考`}</span>
        <div className="flex items-end gap-1">
          {[1, 2, 3].map(i => (
            <span
              key={i}
              className={clsx('w-1.5 h-1.5 rounded-full', `dot-${i}`)}
              style={{ background: meta.color }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
