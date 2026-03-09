import { Trophy, Edit3, Check, X } from 'lucide-react'
import { useState } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import CopyButton from './CopyButton'
import clsx from 'clsx'

interface Props {
  content: string
  onSave?: (newContent: string) => void
}

export default function ConsensusCard({ content, onSave }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(content)

  const handleSave = () => {
    onSave?.(editContent)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditContent(content)
    setIsEditing(false)
  }

  return (
    <div className="border-gradient-glow rounded-3xl p-[1px] animate-fade-in-up animate-glow-pulse mt-4 relative group">
      <div className="bg-bg-2 rounded-[23px] px-6 py-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gradient-to-br from-violet-600 via-violet-500 to-cyan-400 shadow-lg shadow-violet-500/20">
            <Trophy size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-bold text-lg tracking-tight bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Quorum 四方共识摘要
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-text-4 font-medium uppercase tracking-wider">验证模型:</span>
              <div className="flex gap-1">
                {(['gpt', 'gemini', 'grok', 'deepseek'] as const).map(m => (
                  <div key={m} className={clsx(clsx_model(m), "ring-1 ring-white/10")} title={m.toUpperCase()} />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton content={content} className="p-1.5 hover:bg-white/10" />

            {onSave && !isEditing && (
              <button
                onClick={() => { setEditContent(content); setIsEditing(true) }}
                className="p-1.5 rounded-xl bg-white/5 text-text-4 hover:text-violet-400 hover:bg-white/10 transition-all font-semibold"
                title="人工修正共识"
              >
                <Edit3 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-violet-500/30 via-blue-500/10 to-transparent mb-5" />

        {/* Content */}
        {isEditing ? (
          <div className="space-y-3 animate-fade-in">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-bg-3 border border-violet-500/20 rounded-2xl px-4 py-3 text-sm text-text-2 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all min-h-[200px] leading-relaxed"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 text-text-4 hover:bg-white/10 transition-all"
              >
                <X size={14} />
                取消
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/20 hover:opacity-90 transition-all"
              >
                <Check size={14} />
                保存修正
              </button>
            </div>
          </div>
        ) : (
          <div className="text-[15px] text-text-2 leading-relaxed prose-custom">
            <MarkdownRenderer content={content} />
          </div>
        )}
      </div>
    </div>
  )
}

function clsx_model(m: 'gpt' | 'gemini' | 'grok' | 'deepseek') {
  const colors = {
    gpt: 'bg-emerald-500',
    gemini: 'bg-violet-500',
    grok: 'bg-cyan-400',
    deepseek: 'bg-blue-600'
  }
  return `w-2 h-2 rounded-full ${colors[m]}`
}

