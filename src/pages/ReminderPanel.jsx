import { Save } from 'lucide-react'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Card from '../components/Card'
import Input from '../components/Input'
import { formatDateLabel } from '../utils/date'
import {
  advanceWakeTarget,
  buildReminderSummary,
  normalizeDailyReminderItem,
  normalizeReminderRules,
  REMINDER_STATUS_LABELS,
  WAKE_STATUS_LABELS,
} from '../utils/reminders'

function parseTimes(value) {
  return String(value || '')
    .split(/[,\s，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function statusTone(status) {
  if (status === 'completed' || status === 'ok') return 'success'
  if (status === 'skipped') return 'neutral'
  if (status === 'snoozed') return 'warning'
  if (status === 'late') return 'danger'
  return 'warning'
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
  const rules = normalizeReminderRules(reminderRules)
  const cards = buildReminderSummary(rules, dayState, { wakeSummary, reviewComplete })

  function updateRule(ruleId, patch) {
    setReminderRules((current) => normalizeReminderRules(current).map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)))
  }

  function updateNote(ruleId, note) {
    updateReminderState(ruleId, (item) => ({ ...normalizeDailyReminderItem(item), note }))
  }

  function complete(ruleId) {
    if (ruleId === 'wake' && !wakeSummary.actualWakeTime) {
      setWakeTime(
        `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
      )
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
          const wakeCard = card.id === 'wake'
          const extra =
            card.id === 'xianyu' && operationSummary.recordCount > 0
              ? '已有运营记录'
              : card.id === 'study' && learningRecord.topic
                ? learningRecord.topic
                : card.id === 'review' && reviewComplete
                  ? '复盘已完成'
                  : ''

          return (
            <Card key={card.id} title={card.title} eyebrow="Reminder">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-600">今日状态</span>
                  <Badge tone={statusTone(card.status)}>{REMINDER_STATUS_LABELS[card.status]}</Badge>
                </div>

                {wakeCard ? (
                  <Input
                    label="实际起床时间"
                    type="time"
                    value={wakeSummary.actualWakeTime || ''}
                    onChange={(event) => setWakeTime(event.target.value)}
                  />
                ) : extra ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-600">{extra}</div>
                ) : null}

                <Input
                  label="提醒时间"
                  value={card.times.join(', ')}
                  onChange={(event) => updateRule(card.id, { times: parseTimes(event.target.value) })}
                />

                <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-700">启用</span>
                  <input
                    type="checkbox"
                    checked={Boolean(card.active)}
                    onChange={(event) => updateRule(card.id, { active: event.target.checked })}
                    className="h-4 w-4"
                  />
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-500">已提醒次数</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{itemState.remindCount || 0}</p>
                </div>

                <Input
                  as="textarea"
                  label="备注"
                  value={itemState.note || ''}
                  onChange={(event) => updateNote(card.id, event.target.value)}
                  inputClassName="min-h-20"
                />

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="primary" icon={Save} onClick={() => complete(card.id)}>
                    完成
                  </Button>
                  <Button type="button" onClick={() => snoozeReminder(card.id)}>
                    稍后 15 分钟
                  </Button>
                  <Button type="button" variant="danger" onClick={() => skipReminder(card.id)}>
                    今天跳过
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
