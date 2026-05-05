export default function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  min,
  max,
  step,
  className = '',
  autoFocus,
  onKeyDown,
  required,
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-xs font-medium text-sys-label2 dark:text-white/50 uppercase tracking-wide px-1">
          {label}
        </label>
      )}
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        required={required}
        className={[
          'w-full h-11 px-4 rounded-ios bg-sys-bg3 dark:bg-white/10',
          'text-sys-label dark:text-white placeholder:text-sys-label3 dark:placeholder:text-white/30',
          'border-0 outline-none focus:ring-2 focus:ring-ios-blue/40',
          'text-base', // 16px prevents iOS zoom on focus
        ].join(' ')}
      />
    </div>
  )
}

// Compact inline inputs for weight/reps in workout logging
export function SetInput({ value, onChange, onBlur, placeholder, className = '' }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      className={[
        'w-full h-11 text-center rounded-ios bg-sys-bg3 dark:bg-white/10',
        'text-sys-label dark:text-white placeholder:text-sys-label3 dark:placeholder:text-white/25',
        'border-0 outline-none focus:ring-2 focus:ring-ios-blue/40 text-base font-semibold',
        className,
      ].join(' ')}
    />
  )
}
