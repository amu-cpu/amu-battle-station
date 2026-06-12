import { Activity, BellRing, HeartPulse, NotebookPen, Radar, Store } from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: '今日', icon: Activity },
  { id: 'xianyu', label: '闲鱼', icon: Store },
  { id: 'body', label: '身体', icon: HeartPulse },
  { id: 'finance', label: '资金', icon: Radar },
  { id: 'review', label: '复盘', icon: NotebookPen },
  { id: 'reminders', label: '督促', icon: BellRing },
]

export default function Layout({ activePage, onNavigate, children }) {
  return (
    <div className="min-h-svh bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r border-slate-200 bg-slate-950 p-5 text-white md:block">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-xl font-black text-slate-950">
            木
          </div>
          <div>
            <p className="text-base font-black">阿木作战台</p>
            <p className="text-xs text-slate-400">每天动作落地</p>
          </div>
        </div>

        <nav className="mt-8 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = activePage === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition ${
                  active ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <p className="absolute bottom-5 left-5 right-5 text-sm leading-6 text-slate-400">
          别把记录当成果，勾完才算动作落地。
        </p>
      </aside>

      <main className="min-h-svh w-full px-4 pb-28 pt-4 md:ml-60 md:w-[calc(100%-15rem)] md:px-6 md:pb-6 md:pt-5 xl:px-8">
        <div className={activePage === 'dashboard' ? 'w-full max-w-none' : 'mx-auto w-full max-w-[1600px]'}>
          {children}
        </div>
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-6 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = activePage === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs font-bold transition ${
                  active ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
