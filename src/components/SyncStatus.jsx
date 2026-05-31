import { AlertTriangle, CheckCircle2, Cloud, HardDrive, LoaderCircle, WifiOff } from 'lucide-react'

const statusConfig = {
  local: {
    icon: HardDrive,
    label: '本地模式',
    detail: '数据保存在当前浏览器。',
    className: 'border-slate-200 bg-white text-slate-700',
  },
  syncing: {
    icon: LoaderCircle,
    label: '正在同步',
    detail: '正在连接云端数据。',
    className: 'border-sky-200 bg-sky-50 text-sky-800',
  },
  synced: {
    icon: CheckCircle2,
    label: '云端已同步',
    detail: '本地和云端已保存。',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  error: {
    icon: AlertTriangle,
    label: '同步失败，请稍后重试',
    detail: '本地数据仍会保存。',
    className: 'border-rose-200 bg-rose-50 text-rose-800',
  },
  offline: {
    icon: WifiOff,
    label: '网络异常，本地已保存',
    detail: '恢复网络后可继续同步。',
    className: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  conflict: {
    icon: Cloud,
    label: '需要选择数据来源',
    detail: '本地和云端都有数据。',
    className: 'border-amber-200 bg-amber-50 text-amber-900',
  },
}

export default function SyncStatus({ status = 'local', message }) {
  const current = statusConfig[status] || statusConfig.local
  const Icon = current.icon

  return (
    <section className={`rounded-lg border p-3 shadow-sm ${current.className}`}>
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${status === 'syncing' ? 'animate-spin' : ''}`} aria-hidden="true" />
        <div>
          <p className="text-sm font-black">{current.label}</p>
          <p className="mt-1 text-xs leading-5">{message || current.detail}</p>
        </div>
      </div>
    </section>
  )
}
