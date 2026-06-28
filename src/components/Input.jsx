const baseClass =
  'min-h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200'

export default function Input({
  label,
  hint,
  as = 'input',
  options = [],
  className = '',
  inputClassName = '',
  ...props
}) {
  const Component = as

  return (
    <label className={`block ${className}`}>
      {label ? <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span> : null}
      {hint ? <span className="mb-2 block text-xs font-semibold text-slate-500">{hint}</span> : null}
      {as === 'select' ? (
        <select className={`${baseClass} ${inputClassName}`} {...props}>
          {options.map((option) => (
            <option
              key={typeof option === 'string' ? option : String(option?.value ?? option?.label ?? '')}
              value={typeof option === 'string' ? option : option?.value ?? option?.label ?? ''}
            >
              {typeof option === 'string' ? option : option?.label ?? option?.value ?? ''}
            </option>
          ))}
        </select>
      ) : (
        <Component className={`${baseClass} ${as === 'textarea' ? 'min-h-28 leading-6' : ''} ${inputClassName}`} {...props} />
      )}
    </label>
  )
}
