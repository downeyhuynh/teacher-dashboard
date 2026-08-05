/**
 * Icon-only toolbar button with accessible name and hover label.
 */
export function IconButton({
  label,
  isActive = false,
  onClick,
  children,
  className = '',
}) {
  const classes = [
    'icon-button',
    isActive ? 'is-active' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={classes}
      aria-label={label}
      aria-pressed={isActive}
      title={label}
      onClick={onClick}
    >
      {children}
      <span className="icon-button__tooltip" aria-hidden="true">
        {label}
      </span>
    </button>
  )
}
