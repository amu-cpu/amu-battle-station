import { LogOut, Mail } from 'lucide-react'
import { useState } from 'react'
import Button from './Button'

export default function AuthPanel({
  configured,
  session,
  loading,
  onSignIn,
  onSignOut,
  conflict,
  onUseCloud,
  onUseLocal,
  onSkipMerge,
}) {
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState('')

  async function submitEmail(event) {
    event.preventDefault()
    const nextEmail = email.trim()
    if (!nextEmail) return

    try {
      setNotice('')
      await onSignIn(nextEmail)
      setNotice('登录链接已发送，请到邮箱里点击确认。')
    } catch {
      setNotice('发送失败，请稍后再试。')
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">Cloud Sync</p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {configured ? (session ? session.user.email : '邮箱登录后多端同步') : '云同步未配置'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {configured ? '未登录时继续使用本地数据。' : '缺少 Supabase 环境变量，当前为本地模式。'}
          </p>
        </div>

        {configured && session ? (
          <Button type="button" icon={LogOut} onClick={onSignOut} disabled={loading}>
            退出登录
          </Button>
        ) : null}

        {configured && !session ? (
          <form onSubmit={submitEmail} className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-md">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="输入邮箱"
              className="min-h-11 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
            <Button type="submit" variant="primary" icon={Mail} disabled={loading}>
              发送登录链接
            </Button>
          </form>
        ) : null}
      </div>

      {notice ? <p className="mt-2 text-xs font-semibold text-slate-500">{notice}</p> : null}

      {conflict ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-black text-amber-950">检测到本地和云端都有数据，请选择一次数据来源。</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">不会自动覆盖，选定后才会继续云端同步。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="primary" onClick={onUseCloud}>
              使用云端数据覆盖本地
            </Button>
            <Button type="button" onClick={onUseLocal}>
              使用本地数据覆盖云端
            </Button>
            <Button type="button" variant="ghost" onClick={onSkipMerge}>
              暂时不合并
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
