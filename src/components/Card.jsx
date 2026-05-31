export default function Card({ title, eyebrow, action, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {(title || eyebrow || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {eyebrow ? <p className="text-xs font-bold uppercase text-slate-500">{eyebrow}</p> : null}
            {title ? <h2 className="mt-1 text-lg font-bold text-slate-950">{title}</h2> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
