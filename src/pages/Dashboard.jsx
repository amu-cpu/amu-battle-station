import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Card from '../components/Card'
import Input from '../components/Input'
import ScoreCard from '../components/ScoreCard'
import { TASK_CATEGORIES } from '../utils/defaults'
import { formatDateLabel, shiftDateKey } from '../utils/date'
import { REMINDER_STATUS_LABELS, timeToMinutes, WAKE_STATUS_LABELS } from '../utils/reminders'
import { formatCurrency, getRelapseLabel, getRelapseStatus } from '../utils/scoring'

function groupTasks(tasks) {
  return TASK_CATEGORIES.map((category) => ({
    category,
    tasks: tasks.filter((task) => task.category === category),
  }))
}

function getLearningTaskTitle(topic) {
  const trimmedTopic = topic.trim()
  return trimmedTopic ? `学习 / 沉淀：${trimmedTopic}` : '今日学习 / 沉淀待定'
}

const DEFAULT_LEARNING_TITLES = new Set([
  '学习 Codex 或代写运营知识 15 分钟',
  '整理 1 条可复用的代写方法或案例',
  '学习或沉淀 15 分钟',
  '整理 1 条可复用方法、案例或提示词',
  '今日学习 / 沉淀待定',
])
const REVIEW_TOMORROW_TOP3_SOURCE = 'reviewTomorrowTop3'

function isReviewFocusTask(task) {
  return task?.source === REVIEW_TOMORROW_TOP3_SOURCE
}

function hasReviewTomorrowTop3(value) {
  return String(value || '').trim().length > 0
}

function buildDisplayTasks(tasks, learningRecord) {
  const learningTasks = tasks.filter((task) => task.category === '学习')
  const nonLearningTasks = tasks.filter((task) => task.category !== '学习')
  const defaultLearningTasks = learningTasks.filter((task) => DEFAULT_LEARNING_TITLES.has(task.title))
  const customLearningTasks = learningTasks.filter((task) => !DEFAULT_LEARNING_TITLES.has(task.title))
  const hasLearningRecord = Boolean(learningRecord.topic || learningRecord.output || Object.prototype.hasOwnProperty.call(learningRecord, 'completed'))

  if (!defaultLearningTasks.length && !hasLearningRecord) return [...nonLearningTasks, ...customLearningTasks]

  const hasStoredCompletion = Object.prototype.hasOwnProperty.call(learningRecord, 'completed')
  const learningDone = hasStoredCompletion ? Boolean(learningRecord.completed) : defaultLearningTasks.some((task) => task.done)

  return [
    ...nonLearningTasks,
    ...customLearningTasks,
    {
      id: 'learning-closure',
      category: '学习',
      title: getLearningTaskTitle(learningRecord.topic || ''),
      output: learningRecord.output || '',
      done: learningDone,
      autoManaged: false,
      isLearningRecord: true,
    },
  ]
}

function StatItem({ label, value, multiline = false }) {
  const displayValue = value ?? '-'

  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p
        className={`mt-0.5 text-sm font-black text-slate-950 ${multiline ? 'line-clamp-2 whitespace-pre-line' : 'truncate'}`}
        title={String(displayValue)}
      >
        {displayValue}
      </p>
    </div>
  )
}

function getReminderDashboardLabel(item, wakeSummary) {
  if (item.id === 'wake') return WAKE_STATUS_LABELS[wakeSummary.status]
  if (!item.active) return '今日不提醒'
  return REMINDER_STATUS_LABELS[item.status]
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
  financeStatus,
  privacyMode,
  reviewRecord,
  hasReviewRecord,
  previousReviewTomorrowTop3,
  learningRecord,
  setLearningRecord,
  dismissReviewTaskSource,
  reminderSummary,
  wakeSummary,
  currentTime,
}) {
  const [newTask, setNewTask] = useState({ category: '赚钱', title: '' })
  const learningTasks = effectiveTasks.filter((task) => task.category === '学习')
  const defaultLearningTasks = learningTasks.filter((task) => DEFAULT_LEARNING_TITLES.has(task.title))
  const hasStoredLearningCompletion = Object.prototype.hasOwnProperty.call(learningRecord, 'completed')
  const learningCompleted = hasStoredLearningCompletion ? Boolean(learningRecord.completed) : defaultLearningTasks.some((task) => task.done)
  const displayTasks = useMemo(() => buildDisplayTasks(effectiveTasks, learningRecord), [effectiveTasks, learningRecord])
  const focusTasks = useMemo(() => displayTasks.filter(isReviewFocusTask), [displayTasks])
  const groupedDisplayTasks = useMemo(() => displayTasks.filter((task) => !isReviewFocusTask(task)), [displayTasks])
  const hasPreviousReviewPriority = hasReviewTomorrowTop3(previousReviewTomorrowTop3)
  const hasIncompleteFocusTask = focusTasks.some((task) => !task.done)
  const completedCount = displayTasks.filter((task) => task.done).length
  const completionRate = displayTasks.length ? Math.round((completedCount / displayTasks.length) * 100) : 0

  const riskAlerts = useMemo(() => {
    const alerts = []
    const learningTopic = learningRecord.topic || ''
    const reminderById = Object.fromEntries(reminderSummary.map((item) => [item.id, item]))
    const reminderStatus = Object.fromEntries(reminderSummary.map((item) => [item.id, item.status]))

    if (!focusTasks.length && !hasPreviousReviewPriority) {
      alerts.push({ tone: 'warning', text: '昨晚没有留下今天的 3 件重点，今天容易被琐事带跑。' })
    }

    if (hasIncompleteFocusTask) {
      alerts.push({ tone: 'warning', text: '今日重点任务还没完成，先别开新坑。' })
    }

    if (reminderById.wake?.active !== false && wakeSummary.status === 'unrecorded') {
      alerts.push({ tone: 'warning', text: '今天还没记录起床时间。' })
    }

    if (reminderById.wake?.active !== false && wakeSummary.status === 'late') {
      alerts.push({ tone: 'danger', text: '今天晚起了，晚上别再装无辜。' })
    }

    if (reminderById.xianyu?.active !== false && reminderStatus.xianyu === 'pending') {
      alerts.push({ tone: 'warning', text: '养号还没做，别继续靠手写单子硬扛。' })
    }

    if (reminderById.study?.active !== false && reminderStatus.study === 'pending' && !learningTopic.trim()) {
      alerts.push({ tone: 'warning', text: '学习还没做，长期能力会掉队。' })
    }

    if (reminderById.review?.active !== false && reminderStatus.review === 'pending') {
      alerts.push({ tone: 'warning', text: '复盘还没写，今天没有闭环。' })
    }

    if (reminderById.sleep?.active !== false && reminderStatus.sleep === 'pending' && timeToMinutes(currentTime) >= timeToMinutes('02:00')) {
      alerts.push({ tone: 'warning', text: '睡前收尾还没做，别再乱刷。' })
    }

    const relapseStatus = getRelapseStatus(bodyRecord)
    if (relapseStatus === 'unrecorded') {
      alerts.push({ tone: 'warning', text: '今天还没记录自律状态。' })
    }

    if (relapseStatus === 'yes') {
      alerts.push({ tone: 'danger', text: '今天自律状态异常，晚上复盘原因。' })
    }

    if (operationSummary.recordCount === 0) {
      alerts.push({ tone: 'danger', text: '今天还没有运营记录，现金流动作断了。' })
    }

    if (financeStatus.lowCount > 0) {
      alerts.push({ tone: 'warning', text: '有资产低于下限，先观察，不要乱补。' })
    }

    if (!hasIncompleteFocusTask && displayTasks.some((task) => !task.done)) {
      alerts.push({ tone: 'warning', text: '还有任务没完成，先收口今天的动作。' })
    }

    return alerts.slice(0, 5)
  }, [
    bodyRecord,
    currentTime,
    displayTasks,
    financeStatus,
    focusTasks.length,
    hasIncompleteFocusTask,
    hasPreviousReviewPriority,
    learningRecord.topic,
    operationSummary,
    reminderSummary,
    wakeSummary.status,
  ])

  function toggleTask(targetTask) {
    if (targetTask.isLearningRecord) {
      setLearningRecord((current) => ({ ...current, completed: !targetTask.done }))
      return
    }

    if (targetTask.autoManaged) return
    setTasks((current) =>
      current.map((task) => (task.id === targetTask.id ? { ...task, done: !task.done } : task)),
    )
  }

  function updateLearningField(field, value) {
    setLearningRecord((current) => ({ ...current, [field]: value }))
  }

  function deleteTask(targetTask) {
    dismissReviewTaskSource?.(selectedDate, targetTask)
    setTasks((current) => current.filter((task) => task.id !== targetTask.id))
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
        <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-950">今日作战台</h1>
            <p className="mt-1 text-sm text-slate-600">一屏看清今天该干什么、哪里有风险。</p>
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
        <ScoreCard compact label="今日作战分" value={scores.battleScore} detail="任务 45% / 身体 30% / 运营 25%" tone="green" />
        <ScoreCard compact label="任务完成率" value={`${completionRate}%`} detail={`${completedCount}/${displayTasks.length} 个动作`} />
        <ScoreCard compact label="运营分" value={scores.operationScore} detail={`收入 ${formatCurrency(operationSummary.income)}`} tone="cyan" />
        <ScoreCard compact label="身体分" value={scores.bodyScore} detail={`睡眠 ${bodyRecord?.sleepHours || 0} 小时`} />
        <ScoreCard compact label="风险提醒" value={riskAlerts.length} detail={riskAlerts.length ? '需要处理' : '暂时干净'} tone={riskAlerts.length ? 'yellow' : 'green'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card title="今日任务" eyebrow="Actions">
          <div className="max-h-none overflow-visible xl:max-h-[360px] xl:overflow-y-auto xl:pr-1">
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-950">今日重点任务</h3>
                <p className="mt-1 text-xs font-semibold text-slate-600">来自昨晚复盘，先完成这几件事。</p>
              </div>
              {focusTasks.length ? (
                <Badge tone="warning">
                  {focusTasks.filter((task) => task.done).length}/{focusTasks.length}
                </Badge>
              ) : null}
            </div>
            <div className="mt-2 grid max-h-28 gap-2 overflow-y-auto pr-1">
              {focusTasks.length ? (
                focusTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-md border border-amber-200 bg-white px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => toggleTask(task)}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                        task.done
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 text-amber-600'
                      }`}
                      aria-label={task.done ? '标记未完成' : '标记完成'}
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <p className={`min-w-0 flex-1 text-sm font-semibold ${task.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                      {task.title}
                    </p>
                    <button
                      type="button"
                      onClick={() => deleteTask(task)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                      aria-label="删除重点任务"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-amber-200 bg-white/70 p-2 text-sm font-semibold text-amber-800">
                  昨晚没有写明天 3 件事，今天容易被琐事带跑。
                </p>
              )}
            </div>
          </div>

          <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <Input
              label="今日学习 / 沉淀主题"
              value={learningRecord.topic || ''}
              onChange={(event) => updateLearningField('topic', event.target.value)}
              placeholder="例如：Codex 提效、闲鱼选题、成交话术、可研案例、图片提示词、客户沟通"
              className="mb-2"
              inputClassName="min-h-10 py-1.5"
            />
            <Input
              label="今日学习产出，可选"
              value={learningRecord.output || ''}
              onChange={(event) => updateLearningField('output', event.target.value)}
              placeholder="例如：整理 1 条提示词、复盘 1 个案例、看完 1 篇文章、跑通 1 个流程"
              className="mb-2"
              inputClassName="min-h-10 py-1.5"
            />
            <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={learningCompleted}
                onChange={(event) => updateLearningField('completed', event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              完成学习闭环
            </label>
          </div>

          <form onSubmit={addTask} className="mb-3 grid gap-2 md:grid-cols-[140px_1fr_auto]">
            <Input
              as="select"
              label="类别"
              options={TASK_CATEGORIES}
              value={newTask.category}
              onChange={(event) => setNewTask((current) => ({ ...current, category: event.target.value }))}
              inputClassName="min-h-10 py-1.5"
            />
            <Input
              label="新增任务"
              value={newTask.title}
              onChange={(event) => setNewTask((current) => ({ ...current, title: event.target.value }))}
              placeholder="写一个今天必须落地的动作"
              inputClassName="min-h-10 py-1.5"
            />
            <Button type="submit" variant="primary" icon={Plus} className="min-h-10 self-end px-3 py-1.5">
              新增
            </Button>
          </form>

          <div className="grid gap-3 xl:grid-cols-2">
            {groupTasks(groupedDisplayTasks)
              .filter(({ category, tasks: categoryTasks }) => category !== '重点' || categoryTasks.length)
              .map(({ category, tasks: categoryTasks }) => (
              <div key={category} className="rounded-lg border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-1.5">
                  <h3 className="text-sm font-black text-slate-900">{category}</h3>
                  <Badge tone="neutral">
                    {categoryTasks.filter((task) => task.done).length}/{categoryTasks.length}
                  </Badge>
                </div>
                <div className="max-h-44 divide-y divide-slate-100 overflow-y-auto">
                  {categoryTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleTask(task)}
                        disabled={task.autoManaged}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                          task.done
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 text-slate-400'
                        } ${task.autoManaged ? 'opacity-80' : ''}`}
                        aria-label={task.done ? '标记未完成' : '标记完成'}
                        title={task.autoManaged ? '由其它页面数据自动判断' : undefined}
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${task.done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                          {task.title}
                        </p>
                        {task.output ? <p className="mt-1 text-xs font-semibold text-slate-500">产出：{task.output}</p> : null}
                        {task.autoManaged ? (
                          <Badge tone={task.autoDone ? 'success' : 'neutral'} className="mt-1">
                            {task.autoDone ? '自动完成' : '等数据'}
                          </Badge>
                        ) : null}
                      </div>
                      {task.isLearningRecord ? null : (
                        <button
                          type="button"
                          onClick={() => deleteTask(task)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                          aria-label="删除任务"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          </div>
        </Card>

        <Card title="风险提醒" eyebrow="Risk" className="xl:max-h-[440px] xl:overflow-hidden">
          {riskAlerts.length ? (
            <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1">
              {riskAlerts.map((alert) => (
                <div
                  key={alert.text}
                  className={`flex items-start gap-2 rounded-md border p-2.5 text-sm ${
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

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
        <Card title="今日督促" eyebrow="Reminder" className="xl:max-h-[150px] xl:overflow-hidden">
          <div className="grid grid-cols-2 gap-2">
            {reminderSummary
              .filter((item) => ['xianyu', 'study', 'review', 'sleep'].includes(item.id))
              .map((item) => (
                <StatItem key={item.id} label={item.title} value={getReminderDashboardLabel(item, wakeSummary)} />
              ))}
          </div>
        </Card>

        <Card title="运营概览" eyebrow="Ops" className="xl:max-h-[150px] xl:overflow-hidden">
          <div className="grid grid-cols-2 gap-2">
            <StatItem label="发布" value={operationSummary.publishCount} />
            <StatItem label="曝光" value={operationSummary.exposure} />
            <StatItem label="浏览" value={operationSummary.views} />
            <StatItem label="咨询" value={operationSummary.inquiries} />
            <StatItem label="加微" value={operationSummary.wechat} />
            <StatItem label="成交" value={operationSummary.deals} />
            <StatItem label="收入" value={formatCurrency(operationSummary.income)} />
          </div>
        </Card>

        <Card title="身体概览" eyebrow="Body" className="xl:max-h-[150px] xl:overflow-hidden">
          <div className="grid grid-cols-2 gap-2">
            <StatItem label="体重" value={bodyRecord.weight || '未记录'} />
            <StatItem label="睡眠" value={bodyRecord.sleepHours ? `${bodyRecord.sleepHours} 小时` : '未记录'} />
            <StatItem label="目标起床" value={wakeSummary.targetWakeTime || '未记录'} />
            <StatItem label="实际起床" value={wakeSummary.actualWakeTime || '未记录'} />
            <StatItem label="起床状态" value={WAKE_STATUS_LABELS[wakeSummary.status]} />
            <StatItem label="运动" value={bodyRecord.exerciseText || (bodyRecord.exercise && bodyRecord.exercise !== '未记录' ? bodyRecord.exercise : '未记录')} />
            <StatItem label="自律状态" value={getRelapseLabel(bodyRecord)} />
            <StatItem label="身体分" value={`${scores.bodyScore}/100`} />
          </div>
        </Card>

        <Card title="资金概览" eyebrow="Finance" className="xl:max-h-[150px] xl:overflow-hidden">
          <div className="grid grid-cols-2 gap-2">
            <StatItem label="总资产" value={privacyMode ? '****' : formatCurrency(financeStatus.total)} />
            <StatItem label="偏高" value={financeStatus.highCount} />
            <StatItem label="偏低" value={financeStatus.lowCount} />
            <StatItem label="正常" value={financeStatus.normalCount} />
          </div>
        </Card>

        <Card title="复盘状态" eyebrow="Review" className="xl:max-h-[150px] xl:overflow-hidden">
          <div className="grid gap-2">
            <StatItem label="是否已复盘" value={hasReviewRecord ? '已填写' : '未填写'} />
            <StatItem multiline label="今天最重要的一件事" value={reviewRecord.importantThing || reviewRecord.valuableThing || '未记录'} />
            <StatItem multiline label="明天最重要 3 件事" value={reviewRecord.tomorrowTop3 || '未记录'} />
          </div>
        </Card>
      </div>
    </div>
  )
}
