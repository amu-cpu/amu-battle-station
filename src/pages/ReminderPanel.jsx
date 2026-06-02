import { useState } from 'react'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Card from '../components/Card'
import Input from '../components/Input'
import { formatDateLabel } from '../utils/date'
import {
  advanceWakeTarget,
  buildReminderSummary,
  minutesToTime,
  normalizeDailyReminderItem,
  normalizeReminderRules,
  REMINDER_STATUS_LABELS,
  timeToMinutes,
  WAKE_STATUS_LABELS,
} from '../utils/reminders'

const TIME_FORMAT_TIP = '时间格式应为 11:40, 12:00, 12:20'

function parseTimes(value) {
  return String(value || '')
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function validTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return Boolean(match)
}

function statusTone(status, active) {
  if (!active) return 'neutral'
  if (status === 'completed' || status === 'ok') return 'success'
  if (status === 'skipped') return 'neutral'
  if (status === 'snoozed') return 'warning'
  if (status === 'late') return 'danger'
  return 'warning'
}

function formatSnoozeTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function getNextReminderTime(card, itemState) {
  if (!card.active) return '已关闭'
  if (card.status === 'completed' || card.status === 'skipped') return '-'

  if (card.status === 'snoozed' && itemState.snoozedUntil) {
    return formatSnoozeTime(itemState.snoozedUntil) || '-'
  }

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  const nextTime = card.times.find((time) => {
    const minutes = timeToMinutes(time)
    return minutes !== null && minutes >= nowMinutes && !itemState.triggeredTimes.includes(`time:${time}`)
  })

  return nextTime || card.times[0] || '-'
}

export default function ReminderPanel({
  selectedDate,
  reminderRules,
  setReminderRules,
  dayState,
  updateReminderState,
  completeReminder,
  snoozeReminder,
  skipReminder,
  wakeSettings,
  setWakeSettings,
  wakeSummary,
  setWakeTime,
  operationSummary,
  learningRecord,
  reviewComplete,
}) {
  const [editingTimes, setEditingTimes] = useState({})
  const [expandedNotes, setExpandedNotes] = useState({})
  const rules = normalizeReminderRules(reminderRules)
  const cards = buildReminderSummary(rules, dayState, { wakeSummary, reviewComplete })

  function updateRule(ruleId, patch) {
    setReminderRules((current) => normalizeReminderRules(current).map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)))
  }

  function updateNote(ruleId, note) {
    updateReminderState(ruleId, (item) => ({ ...normalizeDailyReminderItem(item), note }))
  }

  function startTimeEdit(card) {
    setEditingTimes((current) => ({
      ...current,
      [card.id]: {
        value: card.times.join(', '),
        error: '',
      },
    }))
  }

  function updateTimeDraft(ruleId, value) {
    setEditingTimes((current) => ({
      ...current,
      [ruleId]: {
        ...(current[ruleId] || {}),
        value,
        error: '',
      },
    }))
  }

  function saveTimeEdit(ruleId) {
    const draft = editingTimes[ruleId]?.value || ''
    const times = parseTimes(draft)

    if (!times.length || times.some((time) => !validTime(time))) {
      setEditingTimes((current) => ({
        ...current,
        [ruleId]: {
          ...(current[ruleId] || {}),
          error: TIME_FORMAT_TIP,
        },
      }))
      return
    }

    updateRule(ruleId, { times })
    setEditingTimes((current) => {
      const next = { ...current }
      delete next[ruleId]
      return next
    })
  }

  function complete(ruleId) {
    if (ruleId === 'wake' && !wakeSummary.actualWakeTime) {
      const now = new Date()
      setWakeTime(minutesToTime(now.getHours() * 60 + now.getMinutes()))
    }

    completeReminder(ruleId)
  }

  function updateWakeSetting(field, value) {
    setWakeSettings((current) => ({
      ...current,
      [field]: field === 'stepMinutes' || field === 'graceMinutes' ? Number(value || 0) : value,
    }))
  }

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">督促 · {formatDateLabel(selectedDate)}</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">督促</h1>
        <p className="mt-2 text-sm text-slate-600">该做的事，别靠心情。</p>
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          当前为网页内提醒，页面打开时生效。强提醒请配合手机或电脑闹钟。
        </p>
      </header>

      <Card title="起床目标" eyebrow="Wake">
        <div className="grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
          <Input
            label="目标起床时间"
            type="time"
            value={wakeSettings.targetWakeTime}
            onChange={(event) => updateWakeSetting('targetWakeTime', event.target.value)}
          />
          <Input
            label="最终目标"
            type="time"
            value={wakeSettings.finalWakeTime}
            onChange={(event) => updateWakeSetting('finalWakeTime', event.target.value)}
          />
          <Input
            label="每次提前"
            type="number"
            min="1"
            value={wakeSettings.stepMinutes}
            onChange={(event) => updateWakeSetting('stepMinutes', event.target.value)}
          />
          <Input
            label="宽限时间"
            type="number"
            min="0"
            value={wakeSettings.graceMinutes}
            onChange={(event) => updateWakeSetting('graceMinutes', event.target.value)}
          />
          <Button type="button" variant="primary" className="self-end" onClick={() => setWakeSettings((current) => advanceWakeTarget(current))}>
            目标提前 15 分钟
          </Button>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-500">目标起床</p>
            <p className="mt-1 text-sm font-black text-slate-950">{wakeSummary.targetWakeTime}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-500">实际起床</p>
            <p className="mt-1 text-sm font-black text-slate-950">{wakeSummary.actualWakeTime || '未记录'}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-500">起床状态</p>
            <p className="mt-1 text-sm font-black text-slate-950">{WAKE_STATUS_LABELS[wakeSummary.status]}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-5">
        {cards.map((card) => {
          const itemState = normalizeDailyReminderItem(dayState[card.id])
          const timeDraft = editingTimes[card.id]
          const noteOpen = Boolean(expandedNotes[card.id])
          const displayStatus = card.active ? REMINDER_STATUS_LABELS[card.status] : '已关闭'
          const nextReminderTime = getNextReminderTime(card, itemState)
          const extra =
            card.id === 'xianyu' && operationSummary.recordCount > 0
              ? '已有运营记录'
              : card.id === 'study' && learningRecord.topic
                ? learningRecord.topic
                : card.id === 'review' && reviewComplete
                  ? '复盘已完成'
                  : ''

          return (
            <Card key={card.id} title={card.title} eyebrow={displayStatus} className={card.active ? '' : 'opacity-70'}>
              <div className="space-y-3">
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-600">状态</span>
                    <Badge tone={statusTone(card.status, card.active)}>{displayStatus}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-600">下次</span>
                    <span className="font-black text-slate-950">{nextReminderTime}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-600">已提醒</span>
                    <span className="font-black text-slate-950">{itemState.remindCount || 0} 次</span>
                  </div>
                </div>

                {extra ? <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-600">{extra}</div> : null}

                <div>
                  <p className="mb-1.5 text-xs font-bold text-slate-500">时间</p>
                  <div className="flex flex-wrap gap-1.5">
                    {card.times.map((time) => (
                      <span key={time} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700">
                        {time}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button type="button" variant="primary" className="min-h-9 px-2 text-xs" onClick={() => complete(card.id)}>
                    已完成
                  </Button>
                  <Button type="button" className="min-h-9 px-2 text-xs" onClick={() => snoozeReminder(card.id)}>
                    15分钟后提醒
                  </Button>
                  <Button type="button" variant="danger" className="min-h-9 px-2 text-xs" onClick={() => skipReminder(card.id)}>
                    今日不提醒
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => startTimeEdit(card)} className="text-xs font-bold text-slate-600 hover:text-slate-950">
                    编辑时间
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedNotes((current) => ({ ...current, [card.id]: !current[card.id] }))}
                    className="text-xs font-bold text-slate-600 hover:text-slate-950"
                  >
                    备注
                  </button>
                  <button
                    type="button"
                    onClick={() => updateRule(card.id, { active: !card.active })}
                    className={`text-xs font-bold ${card.active ? 'text-emerald-700 hover:text-emerald-900' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    {card.active ? '提醒中' : '已关闭'}
                  </button>
                </div>

                {timeDraft ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <Input
                      label="提醒时间"
                      value={timeDraft.value}
                      onChange={(event) => updateTimeDraft(card.id, event.target.value)}
                      placeholder="11:40, 12:00, 12:20"
                    />
                    {timeDraft.error ? <p className="mt-2 text-xs font-bold text-rose-700">{timeDraft.error}</p> : null}
                    <div className="mt-2 flex gap-2">
                      <Button type="button" variant="primary" className="min-h-9 px-3 text-xs" onClick={() => saveTimeEdit(card.id)}>
                        保存
                      </Button>
                      <Button
                        type="button"
                        className="min-h-9 px-3 text-xs"
                        onClick={() =>
                          setEditingTimes((current) => {
                            const next = { ...current }
                            delete next[card.id]
                            return next
                          })
                        }
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                ) : null}

                {noteOpen ? (
                  <Input
                    as="textarea"
                    label="备注"
                    value={itemState.note || ''}
                    onChange={(event) => updateNote(card.id, event.target.value)}
                    placeholder="简单写一句原因或补充，不写也行。"
                    inputClassName="min-h-20"
                  />
                ) : null}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
