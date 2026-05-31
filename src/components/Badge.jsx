const toneClasses = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-cyan-200 bg-cyan-50 text-cyan-700',
}

export default function Badge({ children, tone = 'neutral', className = '' }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
