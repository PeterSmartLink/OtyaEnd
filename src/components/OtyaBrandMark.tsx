'use client'

type Props = {
  size?: number
  thinking?: boolean
  ai?: boolean
  className?: string
  label?: string
}

/**
 * Canonical Otya identity component.
 *
 * Every Otya product surface uses the exact approved mark synced from the app.
 * Admin-assistant thinking state may animate that same mark, but it never swaps
 * to a second public logo or alternate color identity.
 */
export function OtyaBrandMark({ size = 36, thinking = false, ai = false, className = '', label }: Props) {
  const accessibleLabel = label ?? (ai ? "Otya assistant" : '')
  return <img
    src="/otya-mark-current.png"
    width={size}
    height={size}
    alt={accessibleLabel}
    aria-label={accessibleLabel || undefined}
    className={`block shrink-0 object-contain ${thinking ? 'otya-brand-thinking' : ''} ${className}`}
    style={{ width: size, height: size, background: 'transparent' }}
  />
}
