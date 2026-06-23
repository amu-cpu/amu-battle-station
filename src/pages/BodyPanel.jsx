import { Save } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { WAKE_STATUS_LABELS } from '../utils/reminders'
import { getRelapseStatus } from '../utils/scoring'

const ALTERNATIVE_ACTIONS = [
  '关电脑睡觉',
  '俯卧撑 20 个',
  '下楼走 10 分钟',
  '洗澡',
  '看正常电影',
  '写 3 行复盘',
]

const RELAPSE_LABELS = {
  unrecorded: '未记录',
  no: '达标',
  yes: '失守',
}

function displayExercise(value) {
  return value && value !== '未记录' ? value : ''
}

function getExerciseText(record) {
  return (
    displayExercise(record?.exerciseText) || displayExercise(record?.exercise)
  )
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
  return `${label}${sources.length ? `（${sources.join('、')}）` : ''}`
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
  return Math.max(
    0,
    Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)),
  )
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

function calculateDisciplineStats(bodyRecords, selectedDate) {
  const selectedRecord = buildRecordForDate(bodyRecords, selectedDate)
  const selectedStatus = getRelapseStatus(selectedRecord)
  const entries = Object.values(bodyRecords)
    .filter((record) => record?.date && record.date <= selectedDate)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  const lastLostRecord = entries.find((record) => getRelapseStatus(record) === 'yes')
  const daysSinceLastLost = lastLostRecord
    ? daysBetween(lastLostRecord.date, selectedDate)
    : null
  const monthPrefix = selectedDate.slice(0, 7)
  const monthLostCount = Object.values(bodyRecords).filter(
    (record) =>
      record?.date?.startsWith(monthPrefix) &&
      getRelapseStatus(record) === 'yes',
  ).length
  const streak = calculateCurrentStreak(bodyRecords, selectedDate)
  let risk = {
    label: '暂无失守记录',
    tone: 'info',
    message: streak >= 7 ? '已经连续稳定一段时间，继续守住节奏。' : '先把今天记录清楚。',
  }

  if (selectedStatus === 'yes') {
    risk = {
      label: '高风险',
      tone: 'danger',
      message: '重新开始，不用补偿性放纵，先守住今天。',
    }
  } else if (daysSinceLastLost !== null && daysSinceLastLost < 3) {
    risk = {
      label: '高风险',
      tone: 'danger',
      message: '距离上次失守还不到 3 天，先别喂大脑，撑过这 15 分钟。',
    }
  } else if (daysSinceLastLost !== null && daysSinceLastLost < 7) {
    risk = {
      label: '恢复期',
      tone: 'warning',
      message: '还在恢复期，别让一次疲惫把前几天清零。',
    }
  } else if (daysSinceLastLost !== null && daysSinceLastLost < 14) {
    risk = {
      label: '稳定中',
      tone: 'success',
      message: '已经守住一段时间了，别因为一时冲动毁掉节奏。',
    }
  } else if (daysSinceLastLost !== null) {
    risk = {
      label: '连续稳定',
      tone: 'info',
      message: '连续稳定已经建立起来，今天继续按节奏走。',
    }
  }

  let rewardText = `距离 7 天奖励还差 ${Math.max(0, 7 - streak)} 天。`
  if (selectedStatus === 'yes') {
    rewardText = '重新开始，不用补偿性放纵，先守住今天。'
  } else if (streak >= 14) {
    rewardText = '已连续 14 天达标，说明你正在重建控制感。'
  } else if (streak >= 7) {
    rewardText = '已连续 7 天达标，可以给自己一个小奖励。'
  }

  return {
    streak,
    daysSinceLastLost,
    monthLostCount,
    risk,
    rewardText,
    selectedStatus,
  }
}

function getDaysSinceText(value) {
  return value === null ? '暂无失守记录' : `${value} 天`
}

export default function BodyPanel({
  selectedDate,
  bodyRecords,
  setBodyRecords,
  bodyScore,
  wakeSummary,
  bodyPublicView,
  setBodyPublicView,
}) {
  const [rescueOpen, setRescueOpen] = useState(false)
  const [rescueMessage, setRescueMessage] = useState('')
  const record = buildRecordForDate(bodyRecords, selectedDate)
  const history = sortByDateDesc(Object.values(bodyRecords)).slice(0, 10)
  const relapseStatus = getRelapseStatus(record)
  const relapseTypes = getTriggerSources(record)
  const disciplineStats = useMemo(
    () => calculateDisciplineStats(bodyRecords, selectedDate),
    [bodyRecords, selectedDate],
  )
  const scoreGridClass = bodyPublicView
    ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-5'
    : 'grid gap-4 sm:grid-cols-2 xl:grid-cols-6'
  const bodyLayoutClass = bodyPublicView
    ? 'grid gap-5'
    : 'grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)_300px] 2xl:grid-cols-[320px_minmax(0,1fr)_340px]'

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
    saveField(
      'exerciseText',
      currentExercise ? `${currentExercise} + ${text}` : text,
    )
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
  }

  function appendUrgeEvent(event) {
    updateRecord((currentRecord) => ({
      ...currentRecord,
      disciplineUrges: [
        ...(Array.isArray(currentRecord.disciplineUrges)
          ? currentRecord.disciplineUrges
          : []),
        {
          time: new Date().toISOString(),
          note: '',
          ...event,
        },
      ],
    }))
  }

  function delayUrge() {
    appendUrgeEvent({ action: 'delay' })
    saveField('urgeDelayedAt', new Date().toISOString())
    setRescueMessage('已延迟 15 分钟，先离开屏幕。')
  }

  function chooseAlternative(action) {
    updateRecord((currentRecord) => ({
      ...currentRecord,
      selectedAlternativeAction: action,
      lastUrgeAt: new Date().toISOString(),
      disciplineUrges: [
        ...(Array.isArray(currentRecord.disciplineUrges)
          ? currentRecord.disciplineUrges
          : []),
        {
          time: new Date().toISOString(),
          action: 'alternative',
          alternativeAction: action,
          note: '',
        },
      ],
    }))
    setRescueMessage('已选择替代动作，先做完再回来记录结果。')
  }

  function markLostFromRescue() {
    updateRecord((currentRecord) => ({
      ...currentRecord,
      relapseStatus: 'yes',
      relapseTypes: Array.isArray(currentRecord.relapseTypes)
        ? currentRecord.relapseTypes
        : [],
      disciplineUrges: [
        ...(Array.isArray(currentRecord.disciplineUrges)
          ? currentRecord.disciplineUrges
          : []),
        {
          time: new Date().toISOString(),
          action: 'lost',
          alternativeAction: '',
          note: '',
        },
      ],
    }))
    setRescueMessage('已记录失守，下一步只做复盘和收口。')
  }

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">
          身体打卡台 · {formatDateLabel(selectedDate)}
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">
          身体是本金，别熬夜硬扛
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          记录睡眠、饮食、运动和备注，防止硬扛到报废。
        </p>
      </header>

      <div className={scoreGridClass}>
        <ScoreCard
          label="身体分"
          value={bodyScore}
          detail="睡眠 / 运动 / 饮食 / 备注"
          tone="green"
        />
        <ScoreCard
          label="起床"
          value={WAKE_STATUS_LABELS[wakeSummary.status]}
          detail={wakeSummary.actualWakeTime || '未记录'}
          tone={
            wakeSummary.status === 'ok'
              ? 'green'
              : wakeSummary.status === 'late'
                ? 'red'
                : 'yellow'
          }
        />
        <ScoreCard
          label="睡眠小时"
          value={record.sleepHours || 0}
          detail="7 小时以上加 30 分"
        />
        <ScoreCard
          label="运动"
          value={getExerciseText(record) ? '已记' : '未记'}
          detail="完成运动加 30 分"
          tone={getExerciseText(record) ? 'green' : 'yellow'}
        />
        <ScoreCard
          label="体重"
          value={record.weight || '未记'}
          detail="记录体重加 10 分"
        />
        {bodyPublicView ? null : (
          <ScoreCard
            label="自律"
            value={
              relapseStatus === 'no'
                ? `连续 ${disciplineStats.streak} 天`
                : getDisciplineLabel(record)
            }
            detail={
              relapseStatus === 'unrecorded'
                ? '今日未记录'
                : `距上次失守 ${getDaysSinceText(disciplineStats.daysSinceLastLost)}`
            }
            tone={
              relapseStatus === 'yes'
                ? 'red'
                : relapseStatus === 'no'
                  ? 'green'
                  : 'yellow'
            }
          />
        )}
      </div>

      <div className={bodyLayoutClass}>
        {bodyPublicView ? null : (
          <Card title="自律状态卡" eyebrow="Discipline">
            <div className="grid gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500">
                  当前连续达标
                </p>
                <p className="mt-1 text-3xl font-black text-slate-950">
                  {disciplineStats.streak} 天
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-500">
                    距上次失守
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {getDaysSinceText(disciplineStats.daysSinceLastLost)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-500">
                    本月失守
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {disciplineStats.monthLostCount} 次
                  </p>
                </div>
              </div>
              <Badge tone={disciplineStats.risk.tone} className="justify-center">
                {disciplineStats.risk.label}
              </Badge>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold leading-6 text-slate-700">
                {disciplineStats.rewardText}
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500">奖励建议</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
                  看一部正常电影、喝一杯咖啡、买一个小工具，或给自己半小时无负担休息。
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card
          title="今日身体记录"
          eyebrow="Today"
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBodyPublicView(!bodyPublicView)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
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
            <Input
              label="日期"
              type="date"
              value={record.date}
              disabled
              className="xl:col-span-2"
            />
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
              type="time"
              value={record.wakeTime}
              onChange={(event) => saveField('wakeTime', event.target.value)}
              className="xl:col-span-2"
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
            <Input
              label="中餐"
              value={record.lunch}
              onChange={(event) => saveField('lunch', event.target.value)}
              placeholder="吃了什么，别骗自己"
              className="xl:col-span-2"
            />
            <Input
              label="晚餐"
              value={record.dinner}
              onChange={(event) => saveField('dinner', event.target.value)}
              className="xl:col-span-2"
            />
            <Input
              label="下午加餐"
              value={record.afternoonSnack || ''}
              onChange={(event) =>
                saveField('afternoonSnack', event.target.value)
              }
              placeholder={getLegacySnack(record) || ''}
              className="xl:col-span-2"
            />
            <Input
              label="晚上加餐"
              value={record.eveningSnack || ''}
              onChange={(event) =>
                saveField('eveningSnack', event.target.value)
              }
              className="xl:col-span-2"
            />
            <div className="xl:col-span-5">
              <Input
                as="textarea"
                label="运动记录"
                value={getExerciseText(record)}
                onChange={(event) =>
                  saveField('exerciseText', event.target.value)
                }
                placeholder="俯卧撑50个 + 步行3公里 + 羽毛球1小时"
                inputClassName="min-h-24"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {EXERCISE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => appendExercise(option)}
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <Input
              as="textarea"
              label="身体备注"
              className="xl:col-span-5"
              value={record.note}
              onChange={(event) => saveField('note', event.target.value)}
              placeholder="疲劳、疼痛、熬夜、精神状态，写清楚。"
              inputClassName="min-h-32"
            />
            {bodyPublicView ? null : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 xl:col-span-12">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      今日自律状态
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      只记录事实，不用在这里审判自己。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {RELAPSE_STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDisciplineStatus(option.value)}
                        className={`rounded-md border px-4 py-2 text-sm font-bold transition ${
                          relapseStatus === option.value
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {relapseStatus === 'yes' ? (
                  <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                    <div>
                      <p className="mb-2 text-sm font-semibold text-slate-700">
                        触发源
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {RELAPSE_TYPE_OPTIONS.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => toggleRelapseType(type)}
                            className={`rounded-md border px-3 py-1.5 text-xs font-bold transition ${
                              relapseTypes.includes(type)
                                ? 'border-rose-200 bg-rose-50 text-rose-700'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Input
                      as="textarea"
                      label="自律备注"
                      value={record.relapseNote || ''}
                      onChange={(event) =>
                        saveField('relapseNote', event.target.value)
                      }
                      placeholder="简单写原因、触发点或补救动作"
                      inputClassName="min-h-24"
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </Card>

        {bodyPublicView ? null : (
          <Card title="急救模式" eyebrow="Rescue">
            <div className="space-y-3">
              <Button
                type="button"
                variant="primary"
                className="w-full"
                onClick={() => setRescueOpen((current) => !current)}
              >
                我现在有冲动
              </Button>
              {rescueOpen ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-bold text-slate-500">
                        连续达标
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-950">
                        {disciplineStats.streak} 天
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-bold text-slate-500">
                        距上次失守
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-950">
                        {getDaysSinceText(disciplineStats.daysSinceLastLost)}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`rounded-lg border p-3 text-sm font-bold leading-6 ${
                      disciplineStats.risk.tone === 'danger'
                        ? 'border-rose-200 bg-rose-50 text-rose-800'
                        : disciplineStats.risk.tone === 'warning'
                          ? 'border-amber-200 bg-amber-50 text-amber-900'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {disciplineStats.risk.message}
                  </div>
                  <div className="grid gap-2">
                    {ALTERNATIVE_ACTIONS.map((action) => (
                      <button
                        key={action}
                        type="button"
                        onClick={() => chooseAlternative(action)}
                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button type="button" onClick={delayUrge}>
                      延迟 15 分钟
                    </Button>
                    <Button type="button" variant="danger" onClick={markLostFromRescue}>
                      我已失守
                    </Button>
                  </div>
                  {rescueMessage ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                      {rescueMessage}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm font-semibold leading-6 text-slate-600">
                  有波动时先延迟、换动作，再决定是否记录结果。
                </p>
              )}
            </div>
          </Card>
        )}
      </div>

      <Card title="最近 10 条身体记录" eyebrow="History">
        <div className="overflow-x-auto">
          <table
            className={`${bodyPublicView ? 'min-w-[840px]' : 'min-w-[960px]'} w-full border-collapse text-left text-sm`}
          >
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">日期</th>
                <th className="py-2 pr-3">体重</th>
                <th className="py-2 pr-3">睡眠</th>
                <th className="py-2 pr-3">运动</th>
                {bodyPublicView ? null : (
                  <th className="py-2 pr-3">自律状态</th>
                )}
                <th className="py-2 pr-3">饮食</th>
                <th className="py-2 pr-3">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length ? (
                history.map((item) => (
                  <tr key={item.date} className="align-top">
                    <td className="py-3 pr-3 font-semibold text-slate-900">
                      {item.date}
                    </td>
                    <td className="py-3 pr-3">{item.weight || '-'}</td>
                    <td className="py-3 pr-3">{item.sleepHours || '-'} 小时</td>
                    <td className="max-w-72 py-3 pr-3 text-slate-700">
                      {getExerciseText(item) || '-'}
                    </td>
                    {bodyPublicView ? null : (
                      <td className="max-w-60 py-3 pr-3 text-slate-700">
                        <span title={item.relapseNote || ''}>
                          {getDisciplineSummary(item)}
                        </span>
                        {item.relapseNote ? (
                          <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                            {item.relapseNote}
                          </p>
                        ) : null}
                      </td>
                    )}
                    <td className="max-w-64 py-3 pr-3 text-slate-600">
                      {[item.lunch, item.dinner, getSnackSummary(item)]
                        .filter(Boolean)
                        .join(' / ') || '-'}
                    </td>
                    <td className="max-w-64 py-3 pr-3 text-slate-600">
                      {item.note || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="py-6 text-slate-500"
                    colSpan={bodyPublicView ? 6 : 7}
                  >
                    还没有身体记录，先填今天。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
