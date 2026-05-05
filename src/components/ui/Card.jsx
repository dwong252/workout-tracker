export default function Card({ children, className = '', onClick, padding = true }) {
  const base = 'ios-card overflow-hidden'
  const pad  = padding ? 'p-4' : ''
  const interactive = onClick
    ? 'cursor-pointer active:scale-[0.98] transition-transform'
    : ''

  return (
    <div className={[base, pad, interactive, className].join(' ')} onClick={onClick}>
      {children}
    </div>
  )
}

export function CardRow({ label, value, className = '' }) {
  return (
    <div className={`flex items-center justify-between py-2 ${className}`}>
      <span className="text-sys-label dark:text-white">{label}</span>
      <span className="text-sys-label2 dark:text-white/60 text-sm">{value}</span>
    </div>
  )
}
