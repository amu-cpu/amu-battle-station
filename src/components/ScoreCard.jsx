export default function ScoreCard({ label, value, detail, tone = 'slate', compact = false }) {
  const toneClasses = {
    slate: 'border-slate-200 bg-white text-slate-950',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    yellow: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-rose-200 bg-rose-50 text-rose-900',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-900',
  }

  return (
    <div className={`rounded-lg border shadow-sm ${compact ? 'min-h-[104px] p-3' : 'p-4'} ${toneClasses[tone]}`}>
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className={`${compact ? 'mt-2 text-[34px]' : 'mt-2 text-3xl'} font-black leading-none`}>{value}</p>
      {detail ? <p className={`${compact ? 'mt-2 truncate text-xs' : 'mt-2 text-sm'} text-slate-600`} title={detail}>{detail}</p> : null}
    </div>
  )
}
