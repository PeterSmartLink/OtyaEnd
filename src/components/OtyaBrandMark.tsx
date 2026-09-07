'use client'

type Props = {
  size?: number
  thinking?: boolean
  ai?: boolean
  className?: string
  label?: string
}

/** Canonical Otya identity shared with the Android app. */
export function OtyaBrandMark({ size = 36, thinking = false, ai = false, className = '', label }: Props) {
  const accessibleLabel = label ?? (ai ? 'Otya assistant' : '')
  return <img
    src="/otya-app-icon.webp"
    width={size}
    height={size}
    alt={accessibleLabel}
    aria-label={accessibleLabel || undefined}
    className={`block shrink-0 object-contain ${thinking ? 'otya-brand-thinking' : ''} ${className}`}
    style={{ width: size, height: size, background: 'transparent' }}
  />
}
