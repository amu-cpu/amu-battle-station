const baseClass =
  'min-h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200'

export default function Input({
  label,
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
      {as === 'select' ? (
        <select className={baseClass} {...props}>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <Component className={`${baseClass} ${as === 'textarea' ? 'min-h-28 leading-6' : ''} ${inputClassName}`} {...props} />
      )}
    </label>
  )
}
