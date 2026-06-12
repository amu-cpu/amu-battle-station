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

const REVIEW_TOMORROW_TOP3_SOURCE = 'reviewTomorrowTop3'
const HIDDEN_DASHBOARD_TASK_CATEGORIES = new Set(['重点', '资金'])
const DASHBOARD_TASK_CATEGORIES = TASK_CATEGORIES.filter((category) => !HIDDEN_DASHBOARD_TASK_CATEGORIES.has(category))
const DEFAULT_LEARNING_TITLES = new Set([
  '学习 Codex 或代写运营知识 15 分钟',
  '整理 1 条可复用的代写方法或案例',
  '学习或沉淀 15 分钟',
  '整理 1 条可复用方法、案例或提示词',
  '今日学习 / 沉淀待定',
])

function groupTasks(tasks, categories = TASK_CATEGORIES) {
  return categories.map((category) => ({
    category,
    tasks: tasks.filter((task) => task.category === category),
  })).filter(({ tasks }) => tasks.length)
}

function getLearningTaskTitle(topic) {
  const trimmedTopic = topic.trim()
  return trimmedTopic ? `学习 / 沉淀：${trimmedTopic}` : '今日学习 / 沉淀待定'
}

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

function getReminderDashboardLabel(item, wakeSummary) {
  if (item.id === 'wake') return WAKE_STATUS_LABELS[wakeSummary.status]
  if (!item.active) return '已关闭'
  return REMINDER_STATUS_LABELS[item.status]
}

function DataItem({ label, value, multiline = false }) {
  const displayValue = value ?? '-'

  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p
        className={`mt-1 text-base font-black text-slate-950 ${multiline ? 'line-clamp-2 whitespace-pre-line' : 'truncate'}`}
        title={String(displayValue)}
      >
        {displayValue}
      </p>
    </div>
  )
}

function TaskCheckButton({ task, onToggle, compact = false }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(task)}
      disabled={task.autoManaged}
      className={`flex ${compact ? 'h-7 w-7 rounded-md' : 'h-9 w-9 rounded-lg'} shrink-0 items-center justify-center border ${
        task.done
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-white text-slate-400'
      } ${task.autoManaged ? 'opacity-70' : 'hover:border-slate-300 hover:bg-slate-50'}`}
      aria-label={task.done ? '标记未完成' : '标记完成'}
      title={task.autoManaged ? '由其它页面数据自动判断' : undefined}
    >
      <CheckCircle2 className={compact ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden="true" />
    </button>
  )
}

function TaskLine({ task, onToggle, onDelete, showCategory = false, compact = false }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
        <TaskCheckButton task={task} onToggle={onToggle} compact />
        {showCategory ? (
          <Badge tone="neutral" className="min-h-5 shrink-0 px-1.5 py-0 text-[11px]">
            {task.category}
          </Badge>
        ) : null}
        <p
          className={`min-w-0 flex-1 truncate text-sm font-semibold ${task.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}
          title={task.title}
        >
          {task.title}
        </p>
        {task.isLearningRecord ? null : (
          <button
            type="button"
            onClick={() => onDelete(task)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700"
            aria-label="删除任务"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`flex items-center rounded-lg border border-slate-200 bg-white ${compact ? 'gap-2 px-2 py-1.5' : 'gap-3 px-3 py-2'}`}>
      <TaskCheckButton task={task} onToggle={onToggle} compact={compact} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold ${task.done ? 'text-slate-400 line-through' : 'text-slate-900'}`} title={task.title}>
          {task.title}
        </p>
        <div className={`${compact ? 'mt-0.5' : 'mt-1'} flex flex-wrap items-center gap-1.5`}>
          {showCategory ? <Badge tone="neutral" className="min-h-6 px-2 py-0.5">{task.category}</Badge> : null}
          {task.output ? <span className="truncate text-xs font-semibold text-slate-500">产出：{task.output}</span> : null}
          {task.autoManaged ? (
            <Badge tone={task.autoDone ? 'success' : 'neutral'} className="min-h-6 px-2 py-0.5">
              {task.autoDone ? '自动完成' : '等数据'}
            </Badge>
          ) : null}
        </div>
      </div>
      {task.isLearningRecord ? null : (
        <button
          type="button"
          onClick={() => onDelete(task)}
          className={`flex ${compact ? 'h-7 w-7 rounded-md' : 'h-9 w-9 rounded-lg'} shrink-0 items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-700`}
          aria-label="删除任务"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
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
  financeStatus,
  privacyMode,
  setPrivacyMode,
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
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [editingLearning, setEditingLearning] = useState(false)
  const [selectedTaskCategory, setSelectedTaskCategory] = useState(null)
  const learningTasks = effectiveTasks.filter((task) => task.category === '学习')
  const defaultLearningTasks = learningTasks.filter((task) => DEFAULT_LEARNING_TITLES.has(task.title))
  const hasStoredLearningCompletion = Object.prototype.hasOwnProperty.call(learningRecord, 'completed')
  const learningCompleted = hasStoredLearningCompletion ? Boolean(learningRecord.completed) : defaultLearningTasks.some((task) => task.done)
  const displayTasks = useMemo(() => buildDisplayTasks(effectiveTasks, learningRecord), [effectiveTasks, learningRecord])
  const focusTasks = useMemo(() => displayTasks.filter(isReviewFocusTask).slice(0, 3), [displayTasks])
  const dashboardDisplayTasks = useMemo(
    () => displayTasks.filter((task) => !isReviewFocusTask(task) && !HIDDEN_DASHBOARD_TASK_CATEGORIES.has(task.category)),
    [displayTasks],
  )
  const taskGroups = useMemo(() => groupTasks(dashboardDisplayTasks, DASHBOARD_TASK_CATEGORIES), [dashboardDisplayTasks])
  const actionableUnfinishedTasks = useMemo(
    () => dashboardDisplayTasks.filter((task) => !task.done && !task.autoManaged).slice(0, 5),
    [dashboardDisplayTasks],
  )
  const selectedCategoryTasks = useMemo(
    () => (selectedTaskCategory ? dashboardDisplayTasks.filter((task) => task.category === selectedTaskCategory) : []),
    [dashboardDisplayTasks, selectedTaskCategory],
  )
  const visibleSummaryTasks = selectedTaskCategory ? selectedCategoryTasks : actionableUnfinishedTasks
  const hasPreviousReviewPriority = hasReviewTomorrowTop3(previousReviewTomorrowTop3)
  const hasIncompleteFocusTask = focusTasks.some((task) => !task.done)
  const completedCount = [...focusTasks, ...dashboardDisplayTasks].filter((task) => task.done).length
  const dashboardTaskCount = focusTasks.length + dashboardDisplayTasks.length
  const completionRate = dashboardTaskCount ? Math.round((completedCount / dashboardTaskCount) * 100) : 0
  const learningSummary = learningRecord.topic?.trim() ? `已设置：${learningRecord.topic.trim()}` : '未设置'

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

    if (!hasIncompleteFocusTask && dashboardDisplayTasks.some((task) => !task.done)) {
      alerts.push({ tone: 'warning', text: '还有任务没完成，先收口今天的动作。' })
    }

    return alerts.slice(0, 5)
  }, [
    bodyRecord,
    currentTime,
    dashboardDisplayTasks,
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
    <div className="dashboard-shell min-h-[calc(100svh-2rem)] w-full max-w-none space-y-5">
      <header className="flex min-h-[88px] flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center">
        <div>
          <p className="text-sm font-semibold text-slate-500">{formatDateLabel(selectedDate)}</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">今日作战台</h1>
          <p className="mt-1 text-sm text-slate-600">一屏看清今天该干什么、哪里有风险。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Button type="button" icon={ChevronLeft} onClick={() => onDateChange(shiftDateKey(selectedDate, -1))}>
            前一天
          </Button>
          <Button type="button" variant={selectedDate === today ? 'primary' : 'secondary'} onClick={() => onDateChange(today)}>
            今天
          </Button>
          <Button type="button" icon={ChevronRight} onClick={() => onDateChange(shiftDateKey(selectedDate, 1))}>
            后一天
          </Button>
          <label className="relative min-w-[160px] flex-1 sm:flex-none">
            <span className="sr-only">选择日期</span>
            <CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => event.target.value && onDateChange(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-semibold text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
          </label>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-5">
        <ScoreCard compact label="今日作战分" value={scores.battleScore} detail="任务 45% / 身体 30% / 运营 25%" tone="green" />
        <ScoreCard compact label="任务完成率" value={`${completionRate}%`} detail={`${completedCount}/${dashboardTaskCount} 个动作`} />
        <ScoreCard compact label="运营分" value={scores.operationScore} detail={`收入 ${formatCurrency(operationSummary.income)}`} tone="cyan" />
        <ScoreCard compact label="身体分" value={scores.bodyScore} detail={`睡眠 ${bodyRecord?.sleepHours || 0} 小时`} />
        <ScoreCard compact label="风险提醒" value={riskAlerts.length} detail={riskAlerts.length ? '需要处理' : '暂时干净'} tone={riskAlerts.length ? 'yellow' : 'green'} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_1.4fr_1fr]">
        <Card title="今日重点" eyebrow="Focus" className="dashboard-card">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-600">来自昨晚复盘，先完成这几件事。</p>
            {focusTasks.length ? (
              <div className="space-y-3">
                {focusTasks.map((task) => (
                  <TaskLine key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                昨晚没有留下今日重点，今天容易被琐事带跑。
              </div>
            )}
          </div>
        </Card>

        <Card
          title="任务摘要"
          eyebrow="Actions"
          action={
            <Button type="button" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => setShowAllTasks((current) => !current)}>
              {showAllTasks ? '收起全部任务' : '展开全部任务'}
            </Button>
          }
          className="dashboard-card"
        >
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-1.5">
              {taskGroups.map(({ category, tasks: categoryTasks }) => {
                const selected = selectedTaskCategory === category

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedTaskCategory((current) => (current === category ? null : category))}
                    className={`min-w-0 rounded-lg border px-2 py-1 text-left transition ${
                      selected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-950 hover:border-slate-300 hover:bg-white'
                    }`}
                    aria-pressed={selected}
                    title={`查看${category}任务`}
                  >
                    <p className={`truncate text-[11px] font-bold ${selected ? 'text-slate-200' : 'text-slate-500'}`}>{category}</p>
                    <p className={`mt-0.5 text-lg font-black ${selected ? 'text-white' : 'text-slate-950'}`}>
                    {categoryTasks.filter((task) => task.done).length}/{categoryTasks.length}
                    </p>
                  </button>
                )
              })}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-slate-950">
                  {selectedTaskCategory ? `${selectedTaskCategory}任务` : '未完成任务 Top 5'}
                </h3>
                {selectedTaskCategory ? (
                  <button
                    type="button"
                    onClick={() => setSelectedTaskCategory(null)}
                    className="text-xs font-bold text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline"
                  >
                    默认
                  </button>
                ) : (
                  <span className="hidden text-xs font-semibold text-slate-500 2xl:inline">点击分类卡片可筛选任务</span>
                )}
              </div>
              {visibleSummaryTasks.length ? (
                <div className="space-y-1.5">
                  {visibleSummaryTasks.map((task) => (
                    <TaskLine key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} showCategory={!selectedTaskCategory} compact />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                  {selectedTaskCategory ? `当前没有${selectedTaskCategory}任务。` : '当前没有可直接勾选的未完成任务。'}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-slate-950" title={learningSummary}>
                    <span className="mr-1 text-xs font-bold text-slate-500">学习主题</span>
                    {learningSummary}
                  </p>
                </div>
                <Button type="button" className="min-h-8 px-2.5 py-1 text-xs" onClick={() => setEditingLearning((current) => !current)}>
                  {editingLearning ? '收起学习' : '编辑学习'}
                </Button>
              </div>
              {editingLearning ? (
                <div className="mt-3 grid gap-2">
                  <Input
                    label="今日学习 / 沉淀主题"
                    value={learningRecord.topic || ''}
                    onChange={(event) => updateLearningField('topic', event.target.value)}
                    placeholder="例如：Codex 提效、闲鱼选题、成交话术、可研案例"
                    inputClassName="min-h-9 py-1"
                  />
                  <Input
                    label="今日学习产出，可选"
                    value={learningRecord.output || ''}
                    onChange={(event) => updateLearningField('output', event.target.value)}
                    placeholder="例如：整理 1 条提示词、复盘 1 个案例、跑通 1 个流程"
                    inputClassName="min-h-9 py-1"
                  />
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={learningCompleted}
                      onChange={(event) => updateLearningField('completed', event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900"
                    />
                    完成学习闭环
                  </label>
                </div>
              ) : null}
            </div>

            <form onSubmit={addTask} className="grid gap-2 md:grid-cols-[116px_1fr_auto]">
              <select
                aria-label="任务类别"
                value={newTask.category}
                onChange={(event) => setNewTask((current) => ({ ...current, category: event.target.value }))}
                className="min-h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                {DASHBOARD_TASK_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input
                aria-label="新增任务"
                value={newTask.title}
                onChange={(event) => setNewTask((current) => ({ ...current, title: event.target.value }))}
                placeholder="写一个今天必须落地的动作"
                className="min-h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
              <Button type="submit" variant="primary" icon={Plus} className="min-h-9 px-3 py-1">
                新增
              </Button>
            </form>

            {showAllTasks ? (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                {taskGroups.map(({ category, tasks: categoryTasks }) => (
                  <div key={category} className="rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                      <h3 className="text-sm font-black text-slate-900">{category}</h3>
                      <Badge tone="neutral">
                        {categoryTasks.filter((task) => task.done).length}/{categoryTasks.length}
                      </Badge>
                    </div>
                    <div className="grid gap-2 p-3">
                      {categoryTasks.map((task) => (
                        <TaskLine key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Card>

        <Card title="风险提醒" eyebrow="Risk" className="dashboard-card">
          {riskAlerts.length ? (
            <div className="space-y-3">
              {riskAlerts.map((alert) => (
                <div
                  key={alert.text}
                  className={`flex items-start gap-2 rounded-xl border p-3 text-sm font-semibold leading-6 ${
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
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              今天暂时没有硬风险，继续把动作打完。
            </div>
          )}
        </Card>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <Card title="今日督促" eyebrow="Reminder" className="dashboard-card min-h-[190px]">
          <div className="grid grid-cols-2 gap-3">
            {reminderSummary
              .filter((item) => ['xianyu', 'study', 'review', 'sleep'].includes(item.id))
              .map((item) => (
                <DataItem key={item.id} label={item.title} value={getReminderDashboardLabel(item, wakeSummary)} />
              ))}
          </div>
        </Card>

        <Card title="运营概览" eyebrow="Ops" className="dashboard-card min-h-[190px]">
          <div className="grid grid-cols-2 gap-3">
            <DataItem label="发布" value={operationSummary.publishCount} />
            <DataItem label="曝光" value={operationSummary.exposure} />
            <DataItem label="浏览" value={operationSummary.views} />
            <DataItem label="咨询" value={operationSummary.inquiries} />
            <DataItem label="加微" value={operationSummary.wechat} />
            <DataItem label="成交" value={operationSummary.deals} />
            <DataItem label="收入" value={formatCurrency(operationSummary.income)} />
          </div>
        </Card>

        <Card title="身体概览" eyebrow="Body" className="dashboard-card min-h-[190px]">
          <div className="grid grid-cols-2 gap-3">
            <DataItem label="体重" value={bodyRecord.weight || '未记录'} />
            <DataItem label="睡眠" value={bodyRecord.sleepHours ? `${bodyRecord.sleepHours} 小时` : '未记录'} />
            <DataItem label="实际起床" value={wakeSummary.actualWakeTime || '未记录'} />
            <DataItem label="起床状态" value={WAKE_STATUS_LABELS[wakeSummary.status]} />
            <DataItem label="运动" value={bodyRecord.exerciseText || (bodyRecord.exercise && bodyRecord.exercise !== '未记录' ? bodyRecord.exercise : '未记录')} />
            <DataItem label="自律状态" value={getRelapseLabel(bodyRecord)} />
            <DataItem label="身体分" value={`${scores.bodyScore}/100`} />
          </div>
        </Card>

        <Card
          title="资金概览"
          eyebrow="Finance"
          action={
            <Button type="button" className="min-h-8 px-2.5 py-1 text-xs" onClick={() => setPrivacyMode?.((value) => !value)}>
              {privacyMode ? '显示金额' : '隐藏金额'}
            </Button>
          }
          className="dashboard-card min-h-[190px]"
        >
          <div className="grid grid-cols-2 gap-3">
            <DataItem label="总资产" value={privacyMode ? '****' : formatCurrency(financeStatus.total)} />
            <DataItem label="偏高" value={financeStatus.highCount} />
            <DataItem label="偏低" value={financeStatus.lowCount} />
            <DataItem label="正常" value={financeStatus.normalCount} />
          </div>
        </Card>

        <Card title="复盘状态" eyebrow="Review" className="dashboard-card min-h-[190px]">
          <div className="grid gap-3">
            <DataItem label="是否已复盘" value={hasReviewRecord ? '已填写' : '未填写'} />
            <DataItem multiline label="今天最重要的一件事" value={reviewRecord.importantThing || reviewRecord.valuableThing || '未填写'} />
            <DataItem multiline label="明天最重要 3 件事" value={reviewRecord.tomorrowTop3 || '未填写'} />
          </div>
        </Card>
      </section>
    </div>
  )
}
