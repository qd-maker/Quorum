import { Trophy } from 'lucide-react'

interface Props {
  content: string
}

export default function ConsensusCard({ content }: Props) {
  return (
    <div className="border-gradient-glow rounded-2xl p-[1px] animate-fade-in-up animate-glow-pulse mt-2">
      <div className="bg-bg-2 rounded-2xl px-6 py-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-cyan-400">
            <Trophy size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-base gradient-text-gemini">
              三方共识
            </h3>
            <p className="text-xs text-text-4 mt-0.5">GPT · Gemini · Grok 共同认可</p>
          </div>
          <div className="ml-auto flex gap-1">
            {(['gpt', 'gemini', 'grok'] as const).map(m => (
              <div key={m} className={clsx_model(m)} />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-violet-500/30 via-blue-500/30 to-cyan-500/30 mb-4" />

        {/* Content */}
        <div className="text-sm text-text-2 leading-relaxed prose-dark space-y-1">
          {content.split('\n').map((line, i) => {
            if (line.startsWith('**') && line.endsWith('**')) {
              return <p key={i} className="font-semibold text-text-1 mt-2 first:mt-0">{line.slice(2, -2)}</p>
            }
            if (line.match(/^\d+\./)) {
              return <p key={i} className="pl-1">{line}</p>
            }
            return line ? <p key={i}>{line}</p> : <div key={i} className="h-1" />
          })}
        </div>
      </div>
    </div>
  )
}

function clsx_model(m: 'gpt' | 'gemini' | 'grok') {
  const colors = { gpt: 'bg-emerald-500', gemini: 'bg-violet-500', grok: 'bg-cyan-400' }
  return `w-2 h-2 rounded-full ${colors[m]}`
}
