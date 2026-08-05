import { useState } from 'react'
import { IconButton } from '../ui/IconButton'
import { BellIcon } from '../ui/icons'
import { playAttentionBell } from '../../utils/attentionBell'

/**
 * Fixed thin tool rail. Always visible.
 */
export function ToolToolbar({ tools, activeIds, onToolSelect }) {
  const [bellPlaying, setBellPlaying] = useState(false)

  const ringBell = async () => {
    if (bellPlaying) return
    try {
      const { durationMs } = await playAttentionBell()
      setBellPlaying(true)
      window.setTimeout(() => setBellPlaying(false), durationMs || 3100)
    } catch {
      setBellPlaying(false)
    }
  }

  return (
    <aside className="tool-toolbar" aria-label="Teaching tools">
      <div className="tool-toolbar__brand" aria-hidden="true">
        TD
      </div>
      <div className="tool-toolbar__tools" role="toolbar" aria-label="Tools">
        {tools.map((tool) => (
          <IconButton
            key={tool.id}
            label={tool.label}
            isActive={activeIds.has(tool.id)}
            onClick={() => onToolSelect(tool.id)}
          >
            <tool.Icon className="icon-button__glyph" />
          </IconButton>
        ))}
      </div>

      <div className="tool-toolbar__quick">
        <IconButton
          label="Attention bell"
          isActive={bellPlaying}
          onClick={ringBell}
          className={bellPlaying ? 'is-ringing' : ''}
        >
          <BellIcon className="icon-button__glyph" />
        </IconButton>
      </div>
    </aside>
  )
}
