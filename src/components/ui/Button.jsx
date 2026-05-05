export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  className = '',
  type = 'button',
  destructive = false,
}) {
  const base =
    'inline-flex items-center justify-center font-semibold rounded-ios select-none transition-opacity active:opacity-70 disabled:opacity-40 disabled:pointer-events-none'

  const sizes = {
    sm: 'h-9 px-4 text-sm',
    md: 'h-11 px-5 text-base',
    lg: 'h-14 px-6 text-lg',
  }

  const variants = {
    primary:   'bg-ios-blue text-white',
    secondary: 'bg-sys-bg3 text-ios-blue dark:bg-white/10 dark:text-ios-blue',
    ghost:     'bg-transparent text-ios-blue',
    danger:    'bg-ios-red text-white',
    outline:   'border border-sys-separator text-sys-label dark:border-white/20 dark:text-white bg-transparent',
  }

  const chosen = destructive ? variants.danger : variants[variant] ?? variants.primary

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[base, sizes[size], chosen, fullWidth ? 'w-full' : '', className].join(' ')}
    >
      {children}
    </button>
  )
}
