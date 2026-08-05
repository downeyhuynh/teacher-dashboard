const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function TimerIcon({ className }) {
  return (
    <svg className={className} {...iconProps}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 1.5" />
      <path d="M9 2h6" />
      <path d="M12 2v2" />
    </svg>
  )
}

export function AnnotateIcon({ className }) {
  return (
    <svg className={className} {...iconProps}>
      <path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z" />
      <path d="M13.5 6.5l3 3" />
    </svg>
  )
}

export function CalculatorIcon({ className }) {
  return (
    <svg className={className} {...iconProps}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <rect x="8" y="5" width="8" height="3" rx="0.5" />
      <path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
    </svg>
  )
}

export function StudentsIcon({ className }) {
  return (
    <svg className={className} {...iconProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="3" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a3 3 0 0 1 0 5.74" />
    </svg>
  )
}

export function SeatingIcon({ className }) {
  return (
    <svg className={className} {...iconProps}>
      <rect x="3" y="4" width="8" height="6" rx="1" />
      <rect x="13" y="4" width="8" height="6" rx="1" />
      <rect x="3" y="14" width="8" height="6" rx="1" />
      <rect x="13" y="14" width="8" height="6" rx="1" />
    </svg>
  )
}

export function AttendanceIcon({ className }) {
  return (
    <svg className={className} {...iconProps}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  )
}

export function MinimizeIcon({ className }) {
  return (
    <svg className={className} {...iconProps} strokeWidth={2}>
      <path d="M6 12h12" />
    </svg>
  )
}

export function RestoreIcon({ className }) {
  return (
    <svg className={className} {...iconProps} strokeWidth={1.75}>
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  )
}

export function CloseIcon({ className }) {
  return (
    <svg className={className} {...iconProps} strokeWidth={2}>
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  )
}

export function CameraIcon({ className }) {
  return (
    <svg className={className} {...iconProps}>
      <path d="M4 8h3l2-2h6l2 2h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}

export function ZoomInIcon({ className }) {
  return (
    <svg className={className} {...iconProps}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M16 16l4 4" />
      <path d="M10.5 8v5M8 10.5h5" />
    </svg>
  )
}

export function ZoomOutIcon({ className }) {
  return (
    <svg className={className} {...iconProps}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M16 16l4 4" />
      <path d="M8 10.5h5" />
    </svg>
  )
}

export function HandIcon({ className }) {
  return (
    <svg className={className} {...iconProps}>
      <path d="M8 11V6.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M11 10.5V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M14 10.5V7a1.5 1.5 0 0 1 3 0v6.5a5 5 0 0 1-5 5H11a5 5 0 0 1-4.5-2.7L5 13.5a1.5 1.5 0 0 1 2.5-1.6L8 13" />
    </svg>
  )
}
