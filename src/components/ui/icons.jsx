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

export function NoiseIcon({ className }) {
  return (
    <svg className={className} {...iconProps}>
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  )
}

export function NoiseMeterIcon({ className }) {
  return (
    <svg className={className} {...iconProps}>
      <path d="M6 20V10" />
      <path d="M12 20V4" />
      <path d="M18 20v-7" />
      <path d="M4 20h16" />
    </svg>
  )
}

export function MusicIcon({ className }) {
  return (
    <svg className={className} {...iconProps}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

export function MusicOffIcon({ className }) {
  return (
    <svg className={className} {...iconProps}>
      <path d="M9 18V5l12-2v5" />
      <circle cx="6" cy="18" r="3" />
      <path d="M4 4l16 16" />
    </svg>
  )
}

export function BathroomIcon({ className }) {
  return (
    <svg className={className} {...iconProps}>
      <circle cx="12" cy="5.5" r="2" />
      <path d="M9 10h6l-1 11h-4L9 10z" />
      <path d="M8 13.5H5.5M16 13.5h2.5" />
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

export function ExpandIcon({ className }) {
  return (
    <svg className={className} {...iconProps}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      <path d="M4 4l5 5M20 4l-5 5M4 20l5-5M20 20l-5-5" />
    </svg>
  )
}

export function CompressIcon({ className }) {
  return (
    <svg className={className} {...iconProps}>
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
      <path d="M9 9L4 4M15 9l5-5M9 15l-5 5M15 15l5 5" />
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
