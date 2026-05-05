import { BODY_PART_COLORS } from '../../lib/utils'

export default function Badge({ label, color, className = '' }) {
  const bg = color ? `${color}22` : '#78788028'
  const text = color ?? '#6E6E73'

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  )
}

export function BodyPartBadge({ bodyPart, className = '' }) {
  const color = BODY_PART_COLORS[bodyPart]
  return <Badge label={bodyPart} color={color} className={className} />
}

export function PRBadge({ className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-400/20 text-yellow-500 ${className}`}>
      PR
    </span>
  )
}
