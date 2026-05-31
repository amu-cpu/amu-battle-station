import { AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Card from '../components/Card'
import Input from '../components/Input'
import ScoreCard from '../components/ScoreCard'
import { TASK_CATEGORIES } from '../utils/defaults'
import { formatDateLabel } from '../utils/date'
import { formatCurrency, formatPercent } from '../utils/scoring'

function groupTasks(tasks) {
  return TASK_CATEGORIES.map((category) => ({
    category,
    tasks: tasks.filter((task) => task.category === category),
  }))
}

export default function Dashboard({
  today,
  tasks,
  setTasks,
  scores,
  operationSummary,
  bodyRecord,
  financeAlerts,
  reviewComplete,
}) {
  const [newTask, setNewTask] = useState({ category: '赚钱', title: '' })
  const completedCount = tasks.filter((task) => task.done).length
  const completionRate = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0

  const riskAlerts = useMemo(() => {
    const alerts = []

    if (operationSummary.publishCount === 0) {
      alerts.push({ tone: 'danger', text: '今天还没发布商品，现金流动作断了。' })
    }

    if (!reviewComplete) {
      alerts.push({ tone: 'warning', text: '今天还没写复盘，晚上会继续糊成一团。' })
    }

    if (Number(bodyRecord?.sleepHours) > 0 && Number(bodyRecord.sleepHours) < 6) {
      alerts.push({ tone: 'warning', text: '睡眠少于 6 小时，身体账户正在透支。' })
    }

    financeAlerts.forEach((item) => {
      alerts.push({
        tone: 'danger',
        text: `${item.asset.name} 当前占比 ${formatPercent(item.ratio)}，高于上限，控制仓位。`,
      })
    })

    const learningTasks = tasks.filter((task) => task.category === '学习')
    if (learningTasks.length && learningTasks.some((task) => !task.done)) {
      alerts.push({ tone: 'warning', text: '今天学习动作还没完成，长期能力会掉队。' })
    }

    return alerts
  }, [bodyRecord, financeAlerts, operationSummary.publishCount, reviewComplete, tasks])

  function toggleTask(taskId) {
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)))
  }

  function deleteTask(taskId) {
    setTasks((current) => current.filter((task) => task.id !== taskId))
  }

  function addTask(event) {
    event.preventDefault()
    const title = newTask.title.trim()
    if (!title) return

    setTasks((current) => [
      ...current,
      {
        id: `${today}-${Date.now()}`,
        date: today,
        category: newTask.category,
        title,
        done: false,
      },
    ])
    setNewTask({ category: newTask.category, title: '' })
  }

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">{formatDateLabel(today)}</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">今日作战台</h1>
            <p className="mt-2 text-sm text-slate-600">一打开就知道今天有没有像个人一样干活。</p>
          </div>
          <Badge tone={scores.battleScore >= 70 ? 'success' : scores.battleScore >= 45 ? 'warning' : 'danger'}>
            作战分 {scores.battleScore}/100
          </Badge>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ScoreCard label="今日作战分" value={scores.battleScore} detail="任务 45% / 身体 30% / 运营 25%" tone="green" />
        <ScoreCard label="任务完成率" value={`${completionRate}%`} detail={`${completedCount}/${tasks.length} 个动作`} />
        <ScoreCard label="运营分" value={scores.operationScore} detail={`收入 ${formatCurrency(operationSummary.income)}`} tone="cyan" />
        <ScoreCard label="身体分" value={scores.bodyScore} detail={`睡眠 ${bodyRecord?.sleepHours || 0} 小时`} />
        <ScoreCard label="风险提醒" value={riskAlerts.length} detail={riskAlerts.length ? '需要处理' : '暂时干净'} tone={riskAlerts.length ? 'yellow' : 'green'} />
      </div>

      <Card title="风险提醒" eyebrow="Risk">
        {riskAlerts.length ? (
          <div className="grid gap-2">
            {riskAlerts.map((alert) => (
              <div
                key={alert.text}
                className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                  alert.tone === 'danger'
                    ? 'border-rose-200 bg-rose-50 text-rose-800'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {alert.text}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            今天暂时没有硬风险，继续把动作打完。
          </div>
        )}
      </Card>

      <Card title="今日任务" eyebrow="Actions">
        <form onSubmit={addTask} className="mb-4 grid gap-2 md:grid-cols-[160px_1fr_auto]">
          <Input
            as="select"
            label="类别"
            options={TASK_CATEGORIES}
            value={newTask.category}
            onChange={(event) => setNewTask((current) => ({ ...current, category: event.target.value }))}
          />
          <Input
            label="新增任务"
            value={newTask.title}
            onChange={(event) => setNewTask((current) => ({ ...current, title: event.target.value }))}
            placeholder="写一个今天必须落地的动作"
          />
          <Button type="submit" variant="primary" icon={Plus} className="self-end">
            新增
          </Button>
        </form>

        <div className="grid gap-4 lg:grid-cols-2">
          {groupTasks(tasks).map(({ category, tasks: categoryTasks }) => (
            <div key={category} className="rounded-lg border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                <h3 className="text-sm font-black text-slate-900">{category}</h3>
                <Badge tone="neutral">{categoryTasks.filter((task) => task.done).length}/{categoryTasks.length}</Badge>
              </div>
              <div className="divide-y divide-slate-100">
                {categoryTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 px-3 py-3">
                    <button
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
                        task.done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400'
                      }`}
                      aria-label={task.done ? '标记未完成' : '标记完成'}
                    >
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <p className={`min-w-0 flex-1 text-sm font-semibold ${task.done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {task.title}
                    </p>
                    <button
                      type="button"
                      onClick={() => deleteTask(task.id)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                      aria-label="删除任务"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
