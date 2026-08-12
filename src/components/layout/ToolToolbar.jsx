import { IconButton } from '../ui/IconButton'

/**
 * Fixed thin tool rail. Always visible (or edge-revealed in fullscreen).
 */
export function ToolToolbar({
  tools,
  quickTools = [],
  activeIds,
  onToolSelect,
  onMouseEnter,
  onMouseLeave,
}) {
  return (
    <aside
      className="tool-toolbar"
      aria-label="Teaching tools"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
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

      {quickTools.length > 0 && (
        <div className="tool-toolbar__quick" role="toolbar" aria-label="Quick tools">
          {quickTools.map((tool) => (
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
      )}
    </aside>
  )
}
