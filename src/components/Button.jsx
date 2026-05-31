const variantClasses = {
  primary: 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800',
  secondary: 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
  danger: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
  ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100',
}

export default function Button({
  children,
  icon: Icon,
  variant = 'secondary',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}
