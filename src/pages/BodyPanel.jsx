import { Save } from 'lucide-react'
import { useState } from 'react'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Card from '../components/Card'
import Input from '../components/Input'
import ScoreCard from '../components/ScoreCard'
import {
  defaultBodyRecord,
  EXERCISE_OPTIONS,
  RELAPSE_STATUS_OPTIONS,
  RELAPSE_TYPE_OPTIONS,
} from '../utils/defaults'
import {
  calculateSleepHours,
  formatDateLabel,
  shiftDateKey,
  sortByDateDesc,
} from '../utils/date'
import {
  calculateWakeStats,
  formatMinutesToTime,
  getWakeDelayMinutes,
  getWakeStatus,
  parseTimeToMinutes,
} from '../utils/reminders'
import { getRelapseStatus } from '../utils/scoring'

const ALTERNATIVE_ACTIONS = [
  '关电脑睡觉',
  '俯卧撑 20 个',
  '下楼走 10 分钟',
  '洗澡',
  '看正常电影',
  '写 3 行复盘',
]

const REWARD_SUGGESTIONS = [
  '喝一杯咖啡',
  '看一部正常电影',
  '买一个小工具',
  '出门散步 30 分钟',
  '半小时无负担休息',
  '吃一顿正常好饭',
  '买一本书',
  '去理发或整理形象',
]

const REWARD_MILESTONES = {
  3: {
    title: '连续 3 天达标',
    message: '你已经扛过最容易反复的前几天，可以给自己一个小奖励。',
  },
  7: {
    title: '连续 7 天达标',
    message: '一周节奏已经建立，奖励自己一次低刺激放松。',
  },
  14: {
    title: '连续 14 天达标',
    message: '控制感正在重建，别拿高刺激奖励奖励自己。',
  },
  30: {
    title: '连续 30 天达标',
    message: '这已经不是偶然，是新的节奏。',
  },
}

const RELAPSE_LABELS = {
  unrecorded: '未记录',
  no: '达标',
  yes: '失守',
}

const RESCUE_STEPS = new Set(['pause', 'alternative', 'result'])

function displayExercise(value) {
  return value && value !== '未记录' ? value : ''
}

function getExerciseText(record) {
  return displayExercise(record?.exerciseText) || displayExercise(record?.exercise)
}

function getLegacySnack(record) {
  return (
    record?.legacySnack ||
    record?.snack ||
    record?.extraMeal ||
    record?.加餐 ||
    ''
  )
}

function getSnackSummary(record) {
  const snacks = [record?.afternoonSnack, record?.eveningSnack].filter(Boolean)
  return snacks.length ? snacks.join(' / ') : getLegacySnack(record)
}

function getDisciplineLabel(record) {
  return RELAPSE_LABELS[getRelapseStatus(record)] || '未记录'
}

function getTriggerSources(record) {
  return Array.isArray(record?.relapseTypes)
    ? record.relapseTypes.filter(Boolean)
    : []
}

function getDisciplineSummary(record) {
  const status = getRelapseStatus(record)
  const label = getDisciplineLabel(record)
  if (status !== 'yes') return label
  const sources = getTriggerSources(record)
  return sources.length ? `${label}（${sources.join('、')}）` : label
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function daysBetween(fromDateKey, toDateKey) {
  const from = parseDateKey(fromDateKey)
  const to = parseDateKey(toDateKey)
  if (!from || !to) return null
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000))
}

function buildRecordForDate(bodyRecords, dateKey) {
  return {
    ...defaultBodyRecord,
    date: dateKey,
    ...(bodyRecords[dateKey] || {}),
  }
}

function calculateCurrentStreak(bodyRecords, selectedDate) {
  const latestRecord = Object.values(bodyRecords)
    .filter((record) => record?.date && record.date <= selectedDate)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .find((record) => getRelapseStatus(record) !== 'unrecorded')
  let cursor = latestRecord?.date
  let streak = 0

  while (cursor) {
    const record = bodyRecords[cursor]
    if (!record || getRelapseStatus(record) !== 'no') break
    streak += 1
    cursor = shiftDateKey(cursor, -1)
  }

  return streak
}

function getStage({ selectedStatus, daysSinceLastLost, streak }) {
  if (selectedStatus === 'yes') return { label: '重启期', tone: 'warning' }
  if (daysSinceLastLost !== null && daysSinceLastLost < 3) {
    return { label: '重启期', tone: 'warning' }
  }
  if (daysSinceLastLost !== null && daysSinceLastLost < 7) {
    return { label: '恢复期', tone: 'warning' }
  }
  if (daysSinceLastLost !== null && daysSinceLastLost < 14) {
    return { label: '稳定期', tone: 'success' }
  }
  if (daysSinceLastLost !== null) return { label: '强化期', tone: 'info' }
  if (streak >= 14) return { label: '强化期', tone: 'info' }
  if (streak >= 7) return { label: '稳定期', tone: 'success' }
  if (streak >= 3) return { label: '恢复期', tone: 'warning' }
  return { label: '重启期', tone: 'neutral' }
}

function getRewardProgressText(streak, selectedStatus) {
  if (selectedStatus === 'yes') return '先守住今天'
  const nextMilestone = [3, 7, 14, 30].find((milestone) => streak < milestone)
  if (!nextMilestone) return '已达成 30 天里程碑'
  return `距离下个奖励还差 ${nextMilestone - streak} 天`
}

function getRewardSuggestions(dateKey, milestone) {
  const seed = `${dateKey}:${milestone}`
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0)
  const first = seed % REWARD_SUGGESTIONS.length
  const second = (first + 3) % REWARD_SUGGESTIONS.length
  return [REWARD_SUGGESTIONS[first], REWARD_SUGGESTIONS[second]]
}

function rewardKey(dateKey, milestone) {
  return `${dateKey}:${milestone}`
}

function getAcknowledgedRewardKeys(record) {
  if (Array.isArray(record?.acknowledgedDisciplineRewards)) {
    return record.acknowledgedDisciplineRewards
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  }
  return []
}

function compactText(value, fallback = '-') {
  return value ? String(value) : fallback
}

function getActiveRewardMilestone(record, selectedDate, streak, status) {
  const milestone = [3, 7, 14, 30].find((item) => item === streak)
  if (!milestone || status !== 'no') return null

  const key = rewardKey(selectedDate, milestone)
  if (getAcknowledgedRewardKeys(record).includes(key)) return null

  return {
    key,
    milestone,
    ...REWARD_MILESTONES[milestone],
    suggestions: getRewardSuggestions(selectedDate, milestone).slice(0, 2),
  }
}

function normalizeCount(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function getRescueState(record) {
  const source =
    record?.rescueState &&
    typeof record.rescueState === 'object' &&
    !Array.isArray(record.rescueState)
      ? record.rescueState
      : {}
  const step = RESCUE_STEPS.has(source.step) ? source.step : 'pause'

  return {
    active: Boolean(source.active),
    step,
    startedAt: source.startedAt || '',
    delayedAt: source.delayedAt || '',
    selectedAlternativeAction:
      source.selectedAlternativeAction || record?.selectedAlternativeAction || '',
  }
}

function appendDisciplineEvent(record, event) {
  return [
    ...(Array.isArray(record.disciplineUrges) ? record.disciplineUrges : []),
    {
      time: new Date().toISOString(),
      note: '',
      ...event,
    },
  ]
}

function getRecentBodyStats(history) {
  const recent = history.slice(0, 7)
  const sleepValues = recent
    .map((item) => Number(item?.sleepHours))
    .filter((value) => Number.isFinite(value) && value > 0)
  const averageSleep = sleepValues.length
    ? (
        sleepValues.reduce((total, value) => total + value, 0) / sleepValues.length
      ).toFixed(1)
    : '0.0'
  const latestWeight = [...recent].find((item) => item?.weight)?.weight || '-'
  const exerciseDays = recent.filter((item) => getExerciseText(item)).length
  const mealDays = recent.filter((item) =>
    [item?.lunch, item?.dinner, getSnackSummary(item)].some(Boolean),
  ).length

  return {
    averageSleep,
    latestWeight,
    exerciseDays,
    mealDays,
  }
}

function getRecentDisciplineStats(history) {
  const recent = history.slice(0, 7)
  const dayBlocks = recent.map((item) => ({
    date: item.date,
    status:
      getRelapseStatus(item) === 'yes'
        ? '失守'
        : getRelapseStatus(item) === 'no'
          ? '达标'
          : '未记录',
  }))

  const counts = dayBlocks.reduce(
    (acc, item) => {
      if (item.status === '达标') acc.success += 1
      else if (item.status === '失守') acc.lost += 1
      else acc.unrecorded += 1
      return acc
    },
    { success: 0, lost: 0, unrecorded: 0 },
  )

  return { recent, dayBlocks, counts }
}

function DisciplineNoteEditor({ open, note, onChange, onToggle }) {
  if (!open && !note) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        添加备注
      </button>
    )
  }

  if (!open && note) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-500">自律备注</p>
        <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-700">{note}</p>
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 text-xs font-semibold text-slate-600 hover:text-slate-950"
        >
          编辑备注
        </button>
      </div>
    )
  }

  return (
    <Input
      as="textarea"
      label="自律备注"
      value={note}
      onChange={(event) => onChange(event.target.value)}
      placeholder="简单记下原因、触发点或补救动作"
      inputClassName="min-h-20"
    />
  )
}

function BodyNoteEditor({ open, note, onChange, onToggle }) {
  if (!open && !note) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        添加身体备注
      </button>
    )
  }

  if (!open && note) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-500">身体备注</p>
        <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-700">{note}</p>
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 text-xs font-semibold text-slate-600 hover:text-slate-950"
        >
          编辑备注
        </button>
      </div>
    )
  }

  return (
    <Input
      as="textarea"
      label="身体备注"
      value={note}
      onChange={(event) => onChange(event.target.value)}
      placeholder="简单记下今天的疲惫、疼痛、状态或提醒"
      inputClassName="min-h-24"
    />
  )
}

function RescueFlow({
  activeReward,
  bodyPublicView,
  onAcknowledgeReward,
  onChooseAlternative,
  onDelayUrge,
  onMarkLost,
  onMarkResolved,
  onStartRescue,
  rescueFeedback,
  rescueState,
}) {
  if (bodyPublicView) return null

  const showCurrentStep = rescueState.active
  const hasPaused =
    rescueState.active &&
    (rescueState.step === 'alternative' || rescueState.step === 'result')
  const hasChosenAlternative =
    rescueState.active &&
    rescueState.step === 'result' &&
    rescueState.selectedAlternativeAction

  return (
    <Card title="急救模式" eyebrow="Rescue" className="min-h-[500px]">
      <div className="space-y-4">
        {!rescueState.active ? (
          <>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold leading-6 text-slate-700">
                先撑过 15 分钟，不急着做决定。
              </p>
            </div>
            <Button type="button" variant="primary" className="w-full" onClick={onStartRescue}>
              我现在有冲动
            </Button>
            {rescueFeedback ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold leading-6 text-emerald-800">
                {rescueFeedback}
              </div>
            ) : null}
          </>
        ) : null}

        {hasPaused ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
            已暂停：延迟 15 分钟
          </div>
        ) : null}

        {showCurrentStep && rescueState.step === 'pause' ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400">下一步</p>
            <h3 className="mt-1 text-base font-black text-slate-950">第一步：先暂停</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              冲动不是命令，先离开屏幕。
            </p>
            <Button type="button" variant="primary" className="mt-3 w-full" onClick={onDelayUrge}>
              延迟 15 分钟
            </Button>
            <div className="mt-3 space-y-1 text-xs font-medium text-slate-400">
              <p>下一步：换个动作</p>
              <p>最后：记录结果</p>
            </div>
          </div>
        ) : null}

        {showCurrentStep && rescueState.step === 'alternative' ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400">下一步</p>
            <h3 className="mt-1 text-base font-black text-slate-950">第二步：换个动作</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              选一个低刺激动作，先把身体挪开。
            </p>
            {rescueFeedback ? (
              <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                {rescueFeedback}
              </p>
            ) : null}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {ALTERNATIVE_ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => onChooseAlternative(action)}
                  className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm font-semibold transition ${
                    rescueState.selectedAlternativeAction === action
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {hasChosenAlternative ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
            已选择：{rescueState.selectedAlternativeAction}
          </div>
        ) : null}

        {showCurrentStep && rescueState.step === 'result' ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400">下一步</p>
            <h3 className="mt-1 text-base font-black text-slate-950">第三步：记录结果</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              结果会同步到今日自律状态和历史记录。
            </p>
            <div className="mt-3 space-y-2">
              <Button type="button" variant="primary" className="w-full" onClick={onMarkResolved}>
                我扛过去了
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={onMarkLost}
              >
                我已失守
              </Button>
            </div>
            <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
              先完成记录，再继续下一步。
            </p>
          </div>
        ) : null}

        {activeReward ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-black text-emerald-900">{activeReward.title}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-emerald-800">
              {activeReward.message}
            </p>
            <div className="mt-3 space-y-1 text-xs font-semibold text-emerald-700">
              {activeReward.suggestions.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
            <Button
              type="button"
              className="mt-3 w-full border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100"
              onClick={() => onAcknowledgeReward(activeReward.key)}
            >
              知道了
            </Button>
          </div>
        ) : null}

      </div>
    </Card>
  )
}

function DisciplinePanel({
  bodyPublicView,
  disciplineStats,
  onSetStatus,
  onToggleNote,
  onToggleType,
  record,
  relapseStatus,
  relapseTypes,
  relapseNoteOpen,
  onChangeNote,
}) {
  if (bodyPublicView) return null

  return (
    <Card title="自律防线" eyebrow="Discipline" className="min-h-[500px]">
      <div className="space-y-3">
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-slate-500">连续达标</p>
          <p className="mt-1 text-3xl font-black text-slate-950">{disciplineStats.streak} 天</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 bg-white p-2.5">
            <p className="text-xs font-semibold text-slate-500">距上次失守</p>
            <p className="mt-1 text-lg font-black text-slate-950">
              {disciplineStats.daysSinceLastLost === null
                ? '暂无记录'
                : `${disciplineStats.daysSinceLastLost} 天`}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2.5">
            <p className="text-xs font-semibold text-slate-500">本月次数</p>
            <p className="mt-1 text-lg font-black text-slate-950">{disciplineStats.monthLostCount}</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5">
          <p className="text-sm font-semibold text-slate-700">当前阶段</p>
          <Badge tone={disciplineStats.stage.tone}>{disciplineStats.stage.label}</Badge>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <p className="text-xs font-semibold text-slate-500">奖励进度</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {disciplineStats.rewardProgressText}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-500">今日自律</p>
            <p className="text-sm font-semibold text-slate-800">
              {relapseStatus === 'no'
                ? '达标'
                : relapseStatus === 'yes'
                  ? '失守'
                  : '未记录'}
            </p>
          </div>
          <p className="mt-1 text-xs font-semibold leading-4 text-slate-500">
            {relapseStatus === 'no'
              ? '今天已达标，继续保持低刺激放松。'
              : relapseStatus === 'yes'
                ? '重新开始，不要补偿性放纵，先守住剩下时间。'
                : '先记录事实，不用审判自己。'}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {RELAPSE_STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onSetStatus(option.value)}
                className={`min-h-9 rounded-md border px-2 py-1.5 text-xs font-semibold transition ${
                  relapseStatus === option.value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {relapseStatus === 'yes' ? (
          <div className="space-y-2.5">
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-500">触发源（可选）</p>
              <div className="grid grid-cols-4 gap-1.5">
                {RELAPSE_TYPE_OPTIONS.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onToggleType(type)}
                    className={`min-h-8 rounded-md border px-2 py-1 text-xs font-semibold transition ${
                      relapseTypes.includes(type)
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <DisciplineNoteEditor
              open={relapseNoteOpen}
              note={record.relapseNote || ''}
              onChange={onChangeNote}
              onToggle={onToggleNote}
            />
          </div>
        ) : null}
      </div>
    </Card>
  )
}

const WAKE_BADGE_CONFIG = {
  unrecorded: {
    label: '未记录',
    tone: 'neutral',
    message: '今天还没记录起床时间，无法判断是否早起。',
  },
  on_time: {
    label: '早起达标',
    tone: 'success',
    message: '今天已达标，继续保持。',
  },
  slightly_late: {
    label: '轻微晚起',
    tone: 'warning',
    message: '今天晚起不多，明天把误差压回去。',
  },
  late: {
    label: '晚起失守',
    tone: 'danger',
    message: '今天已经明显晚起，今晚必须提前收手机。',
  },
}

function WakeSupervisionPanel({
  record,
  wakeSettings,
  onSetTargetWakeTime,
  bodyRecords,
  selectedDate,
}) {
  const [editingTarget, setEditingTarget] = useState(false)
  const targetWakeTime = wakeSettings?.finalWakeTime || wakeSettings?.targetWakeTime || ''
  const actualWakeTime = record.wakeTime || ''
  const wakeStatus = getWakeStatus(actualWakeTime, targetWakeTime)
  const delayMinutes = getWakeDelayMinutes(actualWakeTime, targetWakeTime)
  const stats = calculateWakeStats(bodyRecords, targetWakeTime, selectedDate)
  const targetMinutes = parseTimeToMinutes(targetWakeTime)
  const suggestedBedTime =
    targetMinutes === null ? '' : formatMinutesToTime(targetMinutes - 8 * 60)
  const config = WAKE_BADGE_CONFIG[wakeStatus] || WAKE_BADGE_CONFIG.unrecorded
  const deviationText =
    wakeStatus === 'unrecorded'
      ? '未记录'
      : delayMinutes > 0
        ? `晚起 ${delayMinutes} 分钟`
        : '达标'
  const rateText =
    stats.recordedDays > 0
      ? `${stats.onTimeDays}/${stats.recordedDays} 天达标（${stats.rate}%）`
      : '样本不足'
  const recentWakeDetails = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDateKey(selectedDate, -index)
    const item = bodyRecords[date]
    const wakeTime = item?.wakeTime || item?.wakeUpTime || item?.起床时间 || ''
    const status = getWakeStatus(wakeTime, targetWakeTime)
    const label =
      status === 'unrecorded'
        ? '未记录'
        : status === 'on_time'
          ? '达标'
          : '晚起'
    const className =
      status === 'unrecorded'
        ? 'border-slate-200 bg-slate-100 text-slate-600'
        : status === 'on_time'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-rose-200 bg-rose-50 text-rose-700'

    return {
      date,
      wakeTime,
      label,
      className,
    }
  })

  return (
    <Card
      title="早起监督"
      eyebrow="Wake"
      action={
        <Button
          type="button"
          variant="secondary"
          className="min-h-9 px-3 py-1.5 text-xs"
          onClick={() => setEditingTarget((current) => !current)}
        >
          设置目标
        </Button>
      }
    >
      <p className="mb-4 text-sm font-semibold text-slate-600">
        只看实际起床，不看幻想目标。
      </p>

      {editingTarget ? (
        <div className="mb-4 max-w-xs">
          <Input
            label="今日目标起床"
            type="time"
            value={targetWakeTime}
            onChange={(event) => onSetTargetWakeTime(event.target.value)}
          />
        </div>
      ) : null}

      <div className="grid gap-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-500">今日目标起床</p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {targetWakeTime || '未设置'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold text-slate-500">今日实际起床</p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {actualWakeTime || '未记录'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold text-slate-500">今日偏差</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{deviationText}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold text-slate-500">今日状态</p>
            <div className="mt-2">
              <Badge tone={config.tone}>{config.label}</Badge>
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
              {config.message}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-500">最近 7 天平均起床</p>
            <p className="mt-1 font-black text-slate-950">
              {stats.averageWakeTime || '样本不足'}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-500">最近 7 天达标率</p>
            <p className="mt-1 font-black text-slate-950">{rateText}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-500">连续早起天数</p>
            <p className="mt-1 font-black text-slate-950">
              {actualWakeTime ? `连续达标 ${stats.streak} 天` : '今日未记录'}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-500">最早起床</p>
            <p className="mt-1 font-black text-slate-950">
              {stats.earliestWakeTime || '样本不足'}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-500">最晚起床</p>
            <p className="mt-1 font-black text-slate-950">
              {stats.latestWakeTime || '样本不足'}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-500">明日建议上床</p>
            <p className="mt-1 font-black text-slate-950">
              {suggestedBedTime ? `建议 ${suggestedBedTime} 前上床` : '先设置目标'}
            </p>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-7">
          {recentWakeDetails.map((item) => (
            <div
              key={item.date}
              className={`rounded-md border p-2 text-xs font-semibold ${item.className}`}
            >
              <p>{item.date}</p>
              <p className="mt-1">{item.wakeTime || '未记录'}</p>
              <p className="mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

export default function BodyPanel({
  selectedDate,
  bodyRecords,
  setBodyRecords,
  bodyScore,
  wakeSummary,
  wakeSettings,
  setWakeSettings,
  bodyPublicView,
  setBodyPublicView,
}) {
  const [bodyNoteOpen, setBodyNoteOpen] = useState(false)
  const [disciplineNoteOpen, setDisciplineNoteOpen] = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [rescueFeedback, setRescueFeedback] = useState('')
  const record = buildRecordForDate(bodyRecords, selectedDate)
  const history = sortByDateDesc(Object.values(bodyRecords)).slice(0, 10)
  const summaryHistory = history.slice(0, 7)
  const relapseStatus = getRelapseStatus(record)
  const relapseTypes = getTriggerSources(record)
  const rescueState = getRescueState(record)
  const targetWakeTime = wakeSettings?.finalWakeTime || wakeSettings?.targetWakeTime || ''
  const actualWakeTime = record.wakeTime || wakeSummary.actualWakeTime || ''
  const wakeStatus = getWakeStatus(actualWakeTime, targetWakeTime)
  const wakeDelayMinutes = getWakeDelayMinutes(actualWakeTime, targetWakeTime)
  const wakeCardLabel =
    wakeStatus === 'on_time'
      ? '达标'
      : wakeStatus === 'unrecorded'
        ? '未记录'
        : '晚起'
  const wakeCardTone =
    wakeStatus === 'on_time'
      ? 'green'
      : wakeStatus === 'unrecorded'
        ? 'yellow'
        : 'red'
  const wakeCardDetail =
    wakeStatus === 'on_time'
      ? '今日已达标'
      : wakeStatus === 'unrecorded'
        ? '未记录'
        : `晚起 ${wakeDelayMinutes || 0} 分钟`

  const disciplineStats = (() => {
    const entries = Object.values(bodyRecords)
      .filter((item) => item?.date && item.date <= selectedDate)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    const lastLostRecord = entries.find((item) => getRelapseStatus(item) === 'yes')
    const daysSinceLastLost = lastLostRecord
      ? daysBetween(lastLostRecord.date, selectedDate)
      : null
    const monthPrefix = selectedDate.slice(0, 7)
    const monthLostCount = Object.values(bodyRecords).filter(
      (item) =>
        item?.date?.startsWith(monthPrefix) &&
        getRelapseStatus(item) === 'yes',
    ).length
    const streak = calculateCurrentStreak(bodyRecords, selectedDate)
    const stage = getStage({
      selectedStatus: relapseStatus,
      daysSinceLastLost,
      streak,
    })
    return {
      streak,
      daysSinceLastLost,
      monthLostCount,
      stage,
      rewardProgressText: getRewardProgressText(streak, relapseStatus),
    }
  })()

  const activeReward = getActiveRewardMilestone(
    record,
    selectedDate,
    disciplineStats.streak,
    relapseStatus,
  )
  const historyStats = getRecentBodyStats(history)
  const disciplineHistoryStats = getRecentDisciplineStats(history)

  function setTargetWakeTime(value) {
    setWakeSettings((current) => ({
      ...current,
      finalWakeTime: value,
      targetWakeTime: value,
    }))
  }

  function saveField(field, value) {
    setBodyRecords((current) => {
      const nextRecord = {
        ...defaultBodyRecord,
        date: selectedDate,
        ...(current[selectedDate] || {}),
        [field]: value,
      }

      if (field === 'bedTime' || field === 'wakeTime') {
        nextRecord.sleepHours = calculateSleepHours(
          nextRecord.bedTime,
          nextRecord.wakeTime,
        )
      }

      return { ...current, [selectedDate]: nextRecord }
    })
  }

  function updateRecord(updater) {
    setBodyRecords((current) => {
      const currentRecord = {
        ...defaultBodyRecord,
        date: selectedDate,
        ...(current[selectedDate] || {}),
      }
      const nextRecord =
        typeof updater === 'function' ? updater(currentRecord) : updater
      return { ...current, [selectedDate]: nextRecord }
    })
  }

  function appendExercise(text) {
    const currentExercise = getExerciseText(record).trim()
    saveField('exerciseText', currentExercise ? `${currentExercise} + ${text}` : text)
  }

  function toggleRelapseType(type) {
    const nextTypes = relapseTypes.includes(type)
      ? relapseTypes.filter((item) => item !== type)
      : [...relapseTypes, type]
    saveField('relapseTypes', nextTypes)
  }

  function setDisciplineStatus(status) {
    updateRecord((currentRecord) => ({
      ...currentRecord,
      relapseStatus: status,
    }))
    if (status !== 'yes') setDisciplineNoteOpen(false)
  }

  function startRescue() {
    const now = new Date().toISOString()
    updateRecord((currentRecord) => ({
      ...currentRecord,
      lastUrgeAt: now,
      rescueState: {
        active: true,
        step: 'pause',
        startedAt: now,
        delayedAt: '',
        selectedAlternativeAction: currentRecord.selectedAlternativeAction || '',
      },
    }))
    setRescueFeedback('')
  }

  function delayUrge() {
    const now = new Date().toISOString()
    updateRecord((currentRecord) => {
      const currentRescue = getRescueState(currentRecord)
      return {
        ...currentRecord,
        urgeDelayCount: normalizeCount(currentRecord.urgeDelayCount) + 1,
        urgeDelayedAt: now,
        lastUrgeAt: now,
        rescueState: {
          active: true,
          step: 'alternative',
          startedAt: currentRescue.startedAt || now,
          delayedAt: now,
          selectedAlternativeAction:
            currentRescue.selectedAlternativeAction ||
            currentRecord.selectedAlternativeAction ||
            '',
        },
        disciplineUrges: appendDisciplineEvent(currentRecord, { action: 'delay' }),
      }
    })
    setRescueFeedback('已暂停，先离开屏幕。')
  }

  function chooseAlternative(action) {
    const now = new Date().toISOString()
    updateRecord((currentRecord) => {
      const currentRescue = getRescueState(currentRecord)
      return {
        ...currentRecord,
        selectedAlternativeAction: action,
        lastUrgeAt: now,
        rescueState: {
          active: true,
          step: 'result',
          startedAt: currentRescue.startedAt || now,
          delayedAt: currentRescue.delayedAt || '',
          selectedAlternativeAction: action,
        },
        disciplineUrges: appendDisciplineEvent(currentRecord, {
          action: 'alternative',
          alternativeAction: action,
        }),
      }
    })
    setRescueFeedback(`已选择：${action}。先做完，再回来记录结果。`)
  }

  function markResolvedFromRescue() {
    const now = new Date().toISOString()
    updateRecord((currentRecord) => {
      const currentRescue = getRescueState(currentRecord)
      return {
        ...currentRecord,
        relapseStatus: 'no',
        urgeResolvedCount: normalizeCount(currentRecord.urgeResolvedCount) + 1,
        lastUrgeAt: now,
        rescueState: {
          ...currentRescue,
          active: false,
          step: 'result',
        },
        disciplineUrges: appendDisciplineEvent(currentRecord, {
          action: 'resolved',
          alternativeAction: currentRescue.selectedAlternativeAction || '',
        }),
      }
    })
    setRescueFeedback('这次你没有喂养冲动，控制感 +1。')
  }

  function markLostFromRescue() {
    const now = new Date().toISOString()
    updateRecord((currentRecord) => {
      const currentRescue = getRescueState(currentRecord)
      return {
        ...currentRecord,
        relapseStatus: 'yes',
        relapseTypes: Array.isArray(currentRecord.relapseTypes)
          ? currentRecord.relapseTypes
          : [],
        lastUrgeAt: now,
        rescueState: {
          ...currentRescue,
          active: false,
          step: 'result',
        },
        disciplineUrges: appendDisciplineEvent(currentRecord, {
          action: 'lost',
          alternativeAction: currentRescue.selectedAlternativeAction || '',
        }),
      }
    })
    setRescueFeedback('重新开始，不要补偿性放纵，先守住剩下时间。')
  }

  function acknowledgeReward(key) {
    updateRecord((currentRecord) => {
      const acknowledged = getAcknowledgedRewardKeys(currentRecord)
      return {
        ...currentRecord,
        acknowledgedDisciplineRewards: acknowledged.includes(key)
          ? acknowledged
          : [...acknowledged, key],
      }
    })
  }

  function renderSummaryBlocks() {
    if (!summaryHistory.length) {
      return (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
          还没有身体记录，先填今天。
        </p>
      )
    }

    return summaryHistory.map((item) => (
      <div
        key={item.date}
        className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm md:grid-cols-[120px_1fr]"
      >
        <p className="font-black text-slate-900">{item.date}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600">
          <span>体重 {compactText(item.weight)}</span>
          <span>睡眠 {compactText(item.sleepHours, '0')} 小时</span>
          <span>运动 {compactText(getExerciseText(item))}</span>
          {bodyPublicView ? null : <span>{getDisciplineSummary(item)}</span>}
        </div>
      </div>
    ))
  }

  function renderDetailedHistory() {
    if (!historyExpanded) return null

    return (
      <div className="mt-4 overflow-x-auto">
        <table
          className={`${bodyPublicView ? 'min-w-[840px]' : 'min-w-[960px]'} w-full border-collapse text-left text-sm`}
        >
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-3">日期</th>
              <th className="py-2 pr-3">体重</th>
              <th className="py-2 pr-3">睡眠</th>
              <th className="py-2 pr-3">运动</th>
              {bodyPublicView ? null : <th className="py-2 pr-3">自律状态</th>}
              <th className="py-2 pr-3">饮食</th>
              <th className="py-2 pr-3">备注</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.length ? (
              history.map((item) => (
                <tr key={item.date} className="align-top">
                  <td className="py-3 pr-3 font-semibold text-slate-900">{item.date}</td>
                  <td className="py-3 pr-3">{item.weight || '-'}</td>
                  <td className="py-3 pr-3">{item.sleepHours || '-'} 小时</td>
                  <td className="max-w-72 py-3 pr-3 text-slate-700">
                    {getExerciseText(item) || '-'}
                  </td>
                  {bodyPublicView ? null : (
                    <td className="max-w-60 py-3 pr-3 text-slate-700">
                      <span title={item.relapseNote || ''}>{getDisciplineSummary(item)}</span>
                      {item.relapseNote ? (
                        <p className="mt-1 line-clamp-1 text-xs text-slate-500">{item.relapseNote}</p>
                      ) : null}
                    </td>
                  )}
                  <td className="max-w-64 py-3 pr-3 text-slate-600">
                    {[item.lunch, item.dinner, getSnackSummary(item)]
                      .filter(Boolean)
                      .join(' / ') || '-'}
                  </td>
                  <td className="max-w-64 py-3 pr-3 text-slate-600">{item.note || '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-6 text-slate-500" colSpan={bodyPublicView ? 6 : 7}>
                  还没有身体记录，先填今天。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">
          身体打卡台 · {formatDateLabel(selectedDate)}
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">身体是本金，别熬夜硬扛</h1>
        <p className="mt-2 text-sm text-slate-600">记录睡眠、饮食和运动，把状态稳住。</p>
      </header>

      <div className={bodyPublicView ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-5' : 'grid gap-4 sm:grid-cols-2 xl:grid-cols-6'}>
        <ScoreCard label="身体分" value={bodyScore} detail="睡眠 / 运动 / 饮食 / 备注" tone="green" />
        <ScoreCard
          label="起床"
          value={wakeCardLabel}
          detail={wakeCardDetail}
          tone={wakeCardTone}
        />
        <ScoreCard label="睡眠小时" value={record.sleepHours || 0} detail="7 小时以上加 30 分" />
        <ScoreCard
          label="运动"
          value={getExerciseText(record) ? '已记' : '未记'}
          detail="完成运动加 30 分"
          tone={getExerciseText(record) ? 'green' : 'yellow'}
        />
        <ScoreCard label="体重" value={record.weight || '未记'} detail="记录体重加 10 分" />
        {bodyPublicView ? null : (
          <ScoreCard
            label="自律"
            value={
              relapseStatus === 'yes'
                ? '重启中'
                : relapseStatus === 'no'
                  ? '达标'
                  : '未记录'
            }
            detail={disciplineStats.rewardProgressText}
            tone={
              relapseStatus === 'no'
                ? 'green'
                : relapseStatus === 'yes'
                  ? 'yellow'
                  : 'slate'
            }
          />
        )}
      </div>

      <div className={bodyPublicView ? 'grid gap-5' : 'grid items-start gap-5 xl:grid-cols-[280px_minmax(720px,1fr)_300px]'}>
        <DisciplinePanel
          bodyPublicView={bodyPublicView}
          disciplineStats={disciplineStats}
          onSetStatus={setDisciplineStatus}
          onToggleNote={() => setDisciplineNoteOpen((current) => !current)}
          onToggleType={toggleRelapseType}
          record={record}
          relapseNoteOpen={disciplineNoteOpen}
          relapseStatus={relapseStatus}
          relapseTypes={relapseTypes}
          onChangeNote={(value) => saveField('relapseNote', value)}
        />

        <Card
          title="今日身体记录"
          eyebrow="Today"
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBodyPublicView(!bodyPublicView)}
                className="min-h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                展示模式：{bodyPublicView ? '公开' : '完整'}
              </button>
              <Badge tone="success" className="gap-1">
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                自动保存
              </Badge>
            </div>
          }
          className="min-w-0"
        >
          <div className="grid gap-3 xl:grid-cols-12">
            <Input label="日期" type="date" value={record.date} disabled className="xl:col-span-2" />
            <Input
              label="体重"
              type="number"
              min="0"
              step="0.1"
              value={record.weight}
              onChange={(event) => saveField('weight', event.target.value)}
              placeholder="kg"
              className="xl:col-span-2"
            />
            <Input
              label="上床时间"
              type="time"
              value={record.bedTime}
              onChange={(event) => saveField('bedTime', event.target.value)}
              className="xl:col-span-2"
            />
            <Input
              label="起床时间"
              hint="早起监督核心字段"
              type="time"
              value={record.wakeTime}
              onChange={(event) => saveField('wakeTime', event.target.value)}
              className="rounded-lg border border-amber-200 bg-amber-50/40 p-2 xl:col-span-2"
            />
            <Input
              label="睡眠小时"
              type="number"
              min="0"
              step="0.1"
              value={record.sleepHours}
              onChange={(event) => saveField('sleepHours', event.target.value)}
              placeholder="可自动计算，也可手动填"
              className="xl:col-span-2"
            />
            <Input label="中餐" value={record.lunch} onChange={(event) => saveField('lunch', event.target.value)} placeholder="吃了什么" className="xl:col-span-2" />
            <Input label="晚餐" value={record.dinner} onChange={(event) => saveField('dinner', event.target.value)} className="xl:col-span-3" />
            <Input
              label="下午加餐"
              value={record.afternoonSnack || ''}
              onChange={(event) => saveField('afternoonSnack', event.target.value)}
              placeholder={getLegacySnack(record) || ''}
              className="xl:col-span-3"
            />
            <Input
              label="晚上加餐"
              value={record.eveningSnack || ''}
              onChange={(event) => saveField('eveningSnack', event.target.value)}
              className="xl:col-span-3"
            />
            <div className="xl:col-span-6">
              <Input
                as="textarea"
                label="运动记录"
                value={getExerciseText(record)}
                onChange={(event) => saveField('exerciseText', event.target.value)}
                placeholder="俯卧撑50个 + 步行3公里 + 羽毛球1小时"
                inputClassName="min-h-24"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {EXERCISE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => appendExercise(option)}
                    className="min-h-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="xl:col-span-6">
              <BodyNoteEditor
                open={bodyNoteOpen}
                note={record.note}
                onChange={(value) => saveField('note', value)}
                onToggle={() => setBodyNoteOpen((current) => !current)}
              />
            </div>
          </div>
        </Card>

        {bodyPublicView ? null : (
          <RescueFlow
            activeReward={activeReward}
            bodyPublicView={bodyPublicView}
            onAcknowledgeReward={acknowledgeReward}
            onChooseAlternative={chooseAlternative}
            onDelayUrge={delayUrge}
            onMarkLost={markLostFromRescue}
            onMarkResolved={markResolvedFromRescue}
            onStartRescue={startRescue}
            rescueFeedback={rescueFeedback}
            rescueState={rescueState}
          />
        )}
      </div>

      <WakeSupervisionPanel
        bodyRecords={bodyRecords}
        onSetTargetWakeTime={setTargetWakeTime}
        record={record}
        selectedDate={selectedDate}
        wakeSettings={wakeSettings}
      />

      {bodyPublicView ? null : (
        <Card title="身体摘要" eyebrow="Summary">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">最近 7 天身体摘要</p>
              <div className="mt-3 grid gap-2 text-sm font-medium text-slate-700 sm:grid-cols-2">
                <p>平均睡眠：{historyStats.averageSleep} 小时</p>
                <p>最近体重：{historyStats.latestWeight}</p>
                <p>运动天数：{historyStats.exerciseDays}</p>
                <p>饮食记录天数：{historyStats.mealDays}</p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">最近 7 天自律摘要</p>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm text-slate-700">
                <p>达标天数：{disciplineHistoryStats.counts.success}</p>
                <p>失守次数：{disciplineHistoryStats.counts.lost}</p>
                <p>未记录天数：{disciplineHistoryStats.counts.unrecorded}</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {disciplineHistoryStats.dayBlocks.map((item) => (
                  <div
                    key={item.date}
                    className={`rounded-md border p-2 text-xs font-semibold ${
                      item.status === '达标'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : item.status === '失守'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                    }`}
                  >
                    <p>{item.date}</p>
                    <p className="mt-1">{item.status}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card
        title="最近 7 天摘要"
        eyebrow="History"
        action={
          <button
            type="button"
            onClick={() => setHistoryExpanded((current) => !current)}
            className="min-h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {historyExpanded ? '收起完整历史' : '展开完整历史'}
          </button>
        }
      >
        <div className="grid gap-2">{renderSummaryBlocks()}</div>
        {renderDetailedHistory()}
      </Card>
    </div>
  )
}
