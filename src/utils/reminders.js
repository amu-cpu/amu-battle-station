import { defaultReminderRules, defaultWakeSettings } from './defaults'

export const REMINDER_STATUS_LABELS = {
  pending: '未完成',
  completed: '已完成',
  snoozed: '稍后',
  skipped: '今日不提醒',
}

export const WAKE_STATUS_LABELS = {
  unrecorded: '未记录',
  ok: '达标',
  late: '晚起',
}

export const REMINDER_MESSAGES = {
  wake: '到点了，先起来，今天别从中午废掉。',
  xianyu: '养号还没做，别继续靠手写单子硬扛。',
  study: '学习还没做，长期能力会掉队。',
  review: '复盘还没写，今天没有闭环。',
  sleep: '该收尾了，关掉无效输入，准备睡觉。',
}

const REMINDER_STATUSES = new Set(['pending', 'completed', 'snoozed', 'skipped'])
const LEGACY_SLEEP_TIMES = ['02:00', '02:30', '03:00']

export function isValidReminderTime(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ''))
}

export function parseReminderTimes(value) {
  return String(value || '')
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeReminderTimes(times, fallbackTimes) {
  const normalizedTimes = Array.isArray(times)
    ? times.map((time) => String(time || '').trim()).filter(isValidReminderTime)
    : []

  return normalizedTimes.length ? normalizedTimes : [...fallbackTimes]
}

function sameTimes(left, right) {
  return left.length === right.length && left.every((time, index) => time === right[index])
}

function normalizeStoredDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function emptyDailyReminderItem() {
  return {
    status: 'pending',
    remindCount: 0,
    completedAt: null,
    snoozedUntil: null,
    note: '',
    triggeredTimes: [],
    activeAlertKey: null,
    lastTriggeredAt: null,
  }
}

export function normalizeReminderRules(rules) {
  if (!Array.isArray(rules) || !rules.length)
    return defaultReminderRules.map((rule) => ({
      ...rule,
      times: [...rule.times],
    }))

  return defaultReminderRules.map((defaultRule) => {
    const storedRule = rules.find((rule) => rule?.id === defaultRule.id) || {}
    const storedTimes = Array.isArray(storedRule.times)
      ? storedRule.times.map((time) => String(time || '').trim()).filter(Boolean)
      : []
    const useDefaultTimes =
      defaultRule.id === 'sleep' && sameTimes(storedTimes, LEGACY_SLEEP_TIMES)
    const times = useDefaultTimes
      ? [...defaultRule.times]
      : normalizeReminderTimes(storedTimes, defaultRule.times)

    return {
      ...defaultRule,
      ...storedRule,
      id: defaultRule.id,
      title: defaultRule.title,
      times,
      active: storedRule.active ?? defaultRule.active,
    }
  })
}

export function normalizeDailyReminderItem(item) {
  const source = item && typeof item === 'object' && !Array.isArray(item) ? item : {}
  const status = REMINDER_STATUSES.has(source.status) ? source.status : 'pending'
  const remindCount = Number(source.remindCount)

  return {
    ...emptyDailyReminderItem(),
    ...source,
    status,
    remindCount: Number.isFinite(remindCount) && remindCount >= 0 ? remindCount : 0,
    completedAt: normalizeStoredDate(source.completedAt),
    snoozedUntil: normalizeStoredDate(source.snoozedUntil),
    note: String(source.note ?? ''),
    triggeredTimes: Array.isArray(source.triggeredTimes)
      ? [...new Set(source.triggeredTimes.map((item) => String(item || '').trim()).filter(Boolean))]
      : [],
    activeAlertKey: source.activeAlertKey ? String(source.activeAlertKey) : null,
    lastTriggeredAt: normalizeStoredDate(source.lastTriggeredAt),
  }
}

export function normalizeDailyReminderState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return {}

  return Object.fromEntries(
    Object.entries(state).map(([dateKey, dayState]) => [
      dateKey,
      Object.fromEntries(
        Object.entries(
          dayState && typeof dayState === 'object' && !Array.isArray(dayState)
            ? dayState
            : {},
        ).map(([id, item]) => [id, normalizeDailyReminderItem(item)]),
      ),
    ]),
  )
}

export function normalizeWakeSettings(settings) {
  return {
    ...defaultWakeSettings,
    ...(settings && typeof settings === 'object' && !Array.isArray(settings)
      ? settings
      : {}),
  }
}

export function normalizeDailyWakeState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return {}
  return Object.fromEntries(
    Object.entries(state).map(([dateKey, item]) => [
      dateKey,
      {
        targetWakeTime:
          item?.targetWakeTime || defaultWakeSettings.targetWakeTime,
        actualWakeTime: item?.actualWakeTime || '',
        status: item?.status || 'unrecorded',
        deviationMinutes: Number.isFinite(Number(item?.deviationMinutes))
          ? Number(item.deviationMinutes)
          : null,
      },
    ]),
  )
}

export function timeToMinutes(time) {
  const [hour, minute] = String(time || '')
    .split(':')
    .map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

export function minutesToTime(totalMinutes) {
  const minutesInDay = 24 * 60
  const normalized =
    ((Math.round(totalMinutes) % minutesInDay) + minutesInDay) % minutesInDay
  const hour = String(Math.floor(normalized / 60)).padStart(2, '0')
  const minute = String(normalized % 60).padStart(2, '0')
  return `${hour}:${minute}`
}

export function getCurrentTimeString(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function shouldTriggerReminder(rule, itemState, now = new Date()) {
  const normalizedRule = {
    ...rule,
    times: normalizeReminderTimes(rule?.times, []),
  }
  const state = normalizeDailyReminderItem(itemState)

  if (!normalizedRule.active) return null
  if (state.status === 'completed' || state.status === 'skipped') return null
  if (state.activeAlertKey) return null

  const nowTime = now.getTime()
  const snoozedUntilTime = state.snoozedUntil ? new Date(state.snoozedUntil).getTime() : null

  if (
    state.status === 'snoozed' &&
    snoozedUntilTime &&
    !Number.isNaN(snoozedUntilTime)
  ) {
    if (nowTime < snoozedUntilTime) return null

    const alertKey = `snooze:${state.snoozedUntil}`
    if (state.triggeredTimes.includes(alertKey)) return null

    return {
      alertKey,
      type: 'snooze',
    }
  }

  const currentMinutes = timeToMinutes(getCurrentTimeString(now))
  if (currentMinutes === null) return null

  const dueTime = normalizedRule.times.find((time) => {
    const reminderMinutes = timeToMinutes(time)
    const alertKey = `time:${time}`

    return (
      reminderMinutes !== null &&
      reminderMinutes <= currentMinutes &&
      !state.triggeredTimes.includes(alertKey)
    )
  })

  return dueTime
    ? {
        alertKey: `time:${dueTime}`,
        type: 'time',
      }
    : null
}

export function getWakeTime(record) {
  return (
    record?.wakeTime ||
    record?.wakeUpTime ||
    record?.endSleepTime ||
    record?.起床时间 ||
    ''
  )
}

export function calculateWakeSummary(
  record,
  wakeSettings,
  storedWakeState = {},
) {
  const settings = normalizeWakeSettings(wakeSettings)
  const actualWakeTime =
    getWakeTime(record) || storedWakeState.actualWakeTime || ''
  const targetWakeTime =
    storedWakeState.targetWakeTime || settings.targetWakeTime
  const targetMinutes = timeToMinutes(targetWakeTime)
  const actualMinutes = timeToMinutes(actualWakeTime)

  if (!actualWakeTime || targetMinutes === null || actualMinutes === null) {
    return {
      targetWakeTime,
      actualWakeTime,
      status: 'unrecorded',
      deviationMinutes: null,
    }
  }

  const deviationMinutes = actualMinutes - targetMinutes
  const status =
    deviationMinutes <= Number(settings.graceMinutes || 0) ? 'ok' : 'late'

  return {
    targetWakeTime,
    actualWakeTime,
    status,
    deviationMinutes,
  }
}

export function advanceWakeTarget(settings) {
  const normalized = normalizeWakeSettings(settings)
  const targetMinutes = timeToMinutes(normalized.targetWakeTime)
  const finalMinutes = timeToMinutes(normalized.finalWakeTime)
  const stepMinutes = Number(
    normalized.stepMinutes || defaultWakeSettings.stepMinutes,
  )

  if (targetMinutes === null || finalMinutes === null) return normalized

  return {
    ...normalized,
    targetWakeTime: minutesToTime(
      Math.max(finalMinutes, targetMinutes - stepMinutes),
    ),
  }
}

export function getReminderStatus(id, dayState, context = {}) {
  const state = normalizeDailyReminderItem(dayState?.[id])

  if (state.status === 'skipped') return 'skipped'
  if (state.status === 'completed') return 'completed'
  if (id === 'wake' && context.wakeSummary?.actualWakeTime) return 'completed'
  if (id === 'review' && context.reviewComplete) return 'completed'
  if (state.status === 'snoozed') return 'snoozed'

  return 'pending'
}

export function buildReminderSummary(rules, dayState, context = {}) {
  return normalizeReminderRules(rules).map((rule) => ({
    ...rule,
    status: getReminderStatus(rule.id, dayState, context),
    state: normalizeDailyReminderItem(dayState?.[rule.id]),
  }))
}
