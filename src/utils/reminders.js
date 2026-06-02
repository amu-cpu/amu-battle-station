import { defaultReminderRules, defaultWakeSettings } from './defaults'

export const REMINDER_STATUS_LABELS = {
  pending: '未完成',
  completed: '已完成',
  snoozed: '稍后',
  skipped: '跳过',
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
  sleep: '该收尾睡觉了，别再乱刷。',
}

export function emptyDailyReminderItem() {
  return {
    status: 'pending',
    remindCount: 0,
    completedAt: null,
    snoozedUntil: null,
    note: '',
    triggeredTimes: [],
  }
}

export function normalizeReminderRules(rules) {
  if (!Array.isArray(rules) || !rules.length) return defaultReminderRules.map((rule) => ({ ...rule, times: [...rule.times] }))

  return defaultReminderRules.map((defaultRule) => {
    const storedRule = rules.find((rule) => rule?.id === defaultRule.id) || {}
    const storedTimes = Array.isArray(storedRule.times) ? storedRule.times.filter(Boolean) : defaultRule.times

    return {
      ...defaultRule,
      ...storedRule,
      id: defaultRule.id,
      title: defaultRule.title,
      times: storedTimes.length ? storedTimes : defaultRule.times,
      active: storedRule.active ?? defaultRule.active,
    }
  })
}

export function normalizeDailyReminderItem(item) {
  return {
    ...emptyDailyReminderItem(),
    ...(item && typeof item === 'object' && !Array.isArray(item) ? item : {}),
    triggeredTimes: Array.isArray(item?.triggeredTimes) ? item.triggeredTimes : [],
  }
}

export function normalizeDailyReminderState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return {}

  return Object.fromEntries(
    Object.entries(state).map(([dateKey, dayState]) => [
      dateKey,
      Object.fromEntries(
        Object.entries(dayState && typeof dayState === 'object' && !Array.isArray(dayState) ? dayState : {}).map(([id, item]) => [
          id,
          normalizeDailyReminderItem(item),
        ]),
      ),
    ]),
  )
}

export function normalizeWakeSettings(settings) {
  return {
    ...defaultWakeSettings,
    ...(settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {}),
  }
}

export function normalizeDailyWakeState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return {}
  return Object.fromEntries(
    Object.entries(state).map(([dateKey, item]) => [
      dateKey,
      {
        targetWakeTime: item?.targetWakeTime || defaultWakeSettings.targetWakeTime,
        actualWakeTime: item?.actualWakeTime || '',
        status: item?.status || 'unrecorded',
        deviationMinutes: Number.isFinite(Number(item?.deviationMinutes)) ? Number(item.deviationMinutes) : null,
      },
    ]),
  )
}

export function timeToMinutes(time) {
  const [hour, minute] = String(time || '').split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

export function minutesToTime(totalMinutes) {
  const minutesInDay = 24 * 60
  const normalized = ((Math.round(totalMinutes) % minutesInDay) + minutesInDay) % minutesInDay
  const hour = String(Math.floor(normalized / 60)).padStart(2, '0')
  const minute = String(normalized % 60).padStart(2, '0')
  return `${hour}:${minute}`
}

export function getCurrentTimeString(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function getWakeTime(record) {
  return record?.wakeTime || record?.wakeUpTime || record?.endSleepTime || record?.起床时间 || ''
}

export function calculateWakeSummary(record, wakeSettings, storedWakeState = {}) {
  const settings = normalizeWakeSettings(wakeSettings)
  const actualWakeTime = getWakeTime(record) || storedWakeState.actualWakeTime || ''
  const targetWakeTime = storedWakeState.targetWakeTime || settings.targetWakeTime
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
  const status = deviationMinutes <= Number(settings.graceMinutes || 0) ? 'ok' : 'late'

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
  const stepMinutes = Number(normalized.stepMinutes || defaultWakeSettings.stepMinutes)

  if (targetMinutes === null || finalMinutes === null) return normalized

  return {
    ...normalized,
    targetWakeTime: minutesToTime(Math.max(finalMinutes, targetMinutes - stepMinutes)),
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
