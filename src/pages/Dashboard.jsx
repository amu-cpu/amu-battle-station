import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Card from '../components/Card'
import Input from '../components/Input'
import ScoreCard from '../components/ScoreCard'
import { TASK_CATEGORIES } from '../utils/defaults'
import { formatDateLabel, shiftDateKey } from '../utils/date'
import { formatCurrency } from '../utils/scoring'

function groupTasks(tasks) {
  return TASK_CATEGORIES.map((category) => ({
    category,
    tasks: tasks.filter((task) => task.category === category),
  }))
}

function StatItem({ label, value }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-950">{value}</p>
    </div>
  )
}

export default function Dashboard({
  selectedDate,
  today,
  onDateChange,
  effectiveTasks,
  setTasks,
  scores,
  operationSummary,
  bodyRecord,
  hasBodyRecord,
  financeStatus,
  privacyMode,
  reviewRecord,
  hasReviewRecord,
}) {
  const [newTask, setNewTask] = useState({ category: '赚钱', title: '' })
  const completedCount = effectiveTasks.filter((task) => task.done).length
  const completionRate = effectiveTasks.length ? Math.round((completedCount / effectiveTasks.length) * 100) : 0

  const riskAlerts = useMemo(() => {
    const alerts = []

    if (operationSummary.recordCount === 0) {
      alerts.push({ tone: 'danger', text: '今天还没有运营记录，现金流动作断了。' })
    } else if (operationSummary.publishCount === 0) {
      alerts.push({ tone: 'danger', text: '今天还没发布商品，现金流动作断了。' })
    }

    if (!hasBodyRecord) {
      alerts.push({ tone: 'warning', text: '今天还没填写身体记录，别把身体当无限电池。' })
    } else if (Number(bodyRecord?.sleepHours) > 0 && Number(bodyRecord.sleepHours) < 6) {
      alerts.push({ tone: 'warning', text: '睡眠少于 6 小时，身体账户正在透支。' })
    }

    if (!hasReviewRecord) {
      alerts.push({ tone: 'warning', text: '今天还没写复盘，晚上会继续糊成一团。' })
    }

    const learningTasks = effectiveTasks.filter((task) => task.category === '学习')
    if (learningTasks.length && learningTasks.some((task) => !task.done)) {
      alerts.push({ tone: 'warning', text: '今天学习动作还没完成，长期能力会掉队。' })
    }

    if (financeStatus.highCount > 0) {
      alerts.push({ tone: 'danger', text: '有资产超过上限，今天不要情绪化操作。' })
    }

    if (financeStatus.lowCount > 0) {
      alerts.push({ tone: 'warning', text: '有资产低于下限，先观察，不要乱补。' })
    }

    return alerts
  }, [bodyRecord, effectiveTasks, financeStatus, hasBodyRecord, hasReviewRecord, operationSummary])

  function toggleTask(targetTask) {
    if (targetTask.autoManaged) return
    setTasks((current) =>
      current.map((task) => (task.id === targetTask.id ? { ...task, done: !task.done } : task)),
    )
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
        id: `${selectedDate}-${Date.now()}`,
        date: selectedDate,
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
        <p className="text-sm font-semibold text-slate-500">{formatDateLabel(selectedDate)}</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">今日作战台</h1>
            <p className="mt-2 text-sm text-slate-600">一打开就知道今天有没有像个人一样干活。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" icon={ChevronLeft} onClick={() => onDateChange(shiftDateKey(selectedDate, -1))}>
              前一天
            </Button>
            <Button type="button" variant={selectedDate === today ? 'primary' : 'secondary'} onClick={() => onDateChange(today)}>
              今天
            </Button>
            <Button type="button" icon={ChevronRight} onClick={() => onDateChange(shiftDateKey(selectedDate, 1))}>
              后一天
            </Button>
            <label className="relative min-w-[150px] flex-1 sm:flex-none">
              <span className="sr-only">选择日期</span>
              <CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden="true" />
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => event.target.value && onDateChange(event.target.value)}
                className="min-h-11 w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-semibold text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ScoreCard label="今日作战分" value={scores.battleScore} detail="任务 45% / 身体 30% / 运营 25%" tone="green" />
        <ScoreCard label="任务完成率" value={`${completionRate}%`} detail={`${completedCount}/${effectiveTasks.length} 个动作`} />
        <ScoreCard label="运营分" value={scores.operationScore} detail={`收入 ${formatCurrency(operationSummary.income)}`} tone="cyan" />
        <ScoreCard label="身体分" value={scores.bodyScore} detail={`睡眠 ${bodyRecord?.sleepHours || 0} 小时`} />
        <ScoreCard label="风险提醒" value={riskAlerts.length} detail={riskAlerts.length ? '需要处理' : '暂时干净'} tone={riskAlerts.length ? 'yellow' : 'green'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
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
            {groupTasks(effectiveTasks).map(({ category, tasks: categoryTasks }) => (
              <div key={category} className="rounded-lg border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                  <h3 className="text-sm font-black text-slate-900">{category}</h3>
                  <Badge tone="neutral">
                    {categoryTasks.filter((task) => task.done).length}/{categoryTasks.length}
                  </Badge>
                </div>
                <div className="divide-y divide-slate-100">
                  {categoryTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-2 px-3 py-3">
                      <button
                        type="button"
                        onClick={() => toggleTask(task)}
                        disabled={task.autoManaged}
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
                          task.done
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 text-slate-400'
                        } ${task.autoManaged ? 'opacity-80' : ''}`}
                        aria-label={task.done ? '标记未完成' : '标记完成'}
                        title={task.autoManaged ? '由其它页面数据自动判断' : undefined}
                      >
                        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${task.done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                          {task.title}
                        </p>
                        {task.autoManaged ? (
                          <Badge tone={task.autoDone ? 'success' : 'neutral'} className="mt-1">
                            {task.autoDone ? '自动完成' : '等数据'}
                          </Badge>
                        ) : null}
                      </div>
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
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <Card title="今日运营概览" eyebrow="Ops">
          <div className="grid grid-cols-2 gap-2">
            <StatItem label="发布" value={operationSummary.publishCount} />
            <StatItem label="曝光" value={operationSummary.exposure} />
            <StatItem label="咨询" value={operationSummary.inquiries} />
            <StatItem label="加微" value={operationSummary.wechat} />
            <StatItem label="成交" value={operationSummary.deals} />
            <StatItem label="收入" value={formatCurrency(operationSummary.income)} />
          </div>
        </Card>

        <Card title="今日身体概览" eyebrow="Body">
          <div className="grid grid-cols-2 gap-2">
            <StatItem label="体重" value={bodyRecord.weight || '未记录'} />
            <StatItem label="睡眠" value={bodyRecord.sleepHours ? `${bodyRecord.sleepHours} 小时` : '未记录'} />
            <StatItem label="运动" value={bodyRecord.exercise === '未记录' ? '未记录' : bodyRecord.exercise} />
            <StatItem label="身体分" value={`${scores.bodyScore}/100`} />
          </div>
        </Card>

        <Card title="资金雷达概览" eyebrow="Finance">
          <div className="grid grid-cols-2 gap-2">
            <StatItem label="总资产" value={privacyMode ? '****' : formatCurrency(financeStatus.total)} />
            <StatItem label="偏高" value={financeStatus.highCount} />
            <StatItem label="偏低" value={financeStatus.lowCount} />
            <StatItem label="正常" value={financeStatus.normalCount} />
          </div>
        </Card>

        <Card title="今日复盘状态" eyebrow="Review">
          <div className="grid gap-2">
            <StatItem label="是否已复盘" value={hasReviewRecord ? '已填写' : '未填写'} />
            <StatItem label="今天最大的风险" value={reviewRecord.biggestRisk || '未记录'} />
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-500">明天最重要 3 件事</p>
              <p className="mt-1 whitespace-pre-line break-words text-sm font-black text-slate-950">
                {reviewRecord.tomorrowTop3 || '未记录'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
