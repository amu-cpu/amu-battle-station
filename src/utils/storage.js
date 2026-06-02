import { useEffect, useRef, useState } from 'react'

export const STORAGE_PREFIX = 'amu-battle-station:'

export const STORAGE_KEYS = {
  tasksByDate: 'amu-battle-station:tasks-by-date',
  opsByDate: 'amu-battle-station:ops-by-date',
  bodyByDate: 'amu-battle-station:body-by-date',
  reviewByDate: 'amu-battle-station:review-by-date',
  assets: 'amu-battle-station:assets',
  privacyMode: 'amu-battle-station:privacy-mode',
  learningTopicsByDate: 'amu-battle-station:learning-topics-by-date',
  learningRecordsByDate: 'amu-battle-station:learning-records-by-date',
  xianyuRecords: 'amu-battle-station:xianyu-records',
  bodyRecords: 'amu-battle-station:body-records',
  financeAssets: 'amu-battle-station:finance-assets',
  reviewRecords: 'amu-battle-station:review-records',
}

export function dailyTasksKey(dateKey) {
  return `amu-battle-station:tasks:${dateKey}`
}

const LEGACY_TASKS_PREFIX = 'amu-battle-station:tasks:'
export const APP_STATE_SCHEMA_VERSION = 2

const DEFAULT_TASK_TITLES = new Set([
  '养号 10 分钟',
  '两店铺各发布 1 条商品',
  '回复所有私信，引导客户发资料或加微信',
  '记录今日运营数据',
  '学习 Codex 或代写运营知识 15 分钟',
  '整理 1 条可复用的代写方法或案例',
  '学习或沉淀 15 分钟',
  '整理 1 条可复用方法、案例或提示词',
  '今日学习 / 沉淀待定',
  '记录体重',
  '记录睡眠',
  '完成俯卧撑、步行、跑步机或羽毛球中的任意一种',
  '记录今天饮食',
  '检查资产仓位是否越界',
  '今天不因情绪追涨杀跌',
  '填写每日复盘',
  '记录是否破戒、摆烂、熬夜或拖延',
])

function resolveFallback(fallback) {
  return typeof fallback === 'function' ? fallback() : fallback
}

function readRawStorage(key) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}

export function readStorage(key, fallback) {
  const value = readRawStorage(key)
  return value === undefined ? resolveFallback(fallback) : value
}

export function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function hasStoredValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function firstStoredValue(source, keys) {
  return keys.map((key) => source?.[key]).find(hasStoredValue)
}

function fillIfEmpty(target, field, value) {
  if (!hasStoredValue(target[field]) && hasStoredValue(value)) {
    target[field] = value
  }
}

function normalizeRelapseStatus(value) {
  const text = String(value ?? '').trim()
  if (['yes', '是', '有', '破戒'].includes(text)) return 'yes'
  if (['no', '否', '没有', '无'].includes(text)) return 'no'
  return 'unrecorded'
}

function normalizeRelapseTypes(value) {
  if (Array.isArray(value)) return value.filter(hasStoredValue)
  if (!hasStoredValue(value)) return []
  return String(value)
    .split(/[,+，、/]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function toDateMap(value) {
  return isPlainObject(value) ? value : {}
}

function toAssetList(value, fallbackAssets) {
  return Array.isArray(value) ? value : fallbackAssets
}

function normalizeAsset(asset) {
  return {
    name: String(asset?.name ?? ''),
    amount: Number(asset?.amount ?? 0),
    target: Number(asset?.target ?? 0),
    lower: Number(asset?.lower ?? 0),
    upper: Number(asset?.upper ?? 0),
    note: String(asset?.note ?? ''),
  }
}

function assetsMatchFallback(assets, fallbackAssets) {
  if (!Array.isArray(assets) || !Array.isArray(fallbackAssets)) return false
  if (assets.length !== fallbackAssets.length) return false

  return assets.every((asset, index) => {
    const current = normalizeAsset(asset)
    const fallback = normalizeAsset(fallbackAssets[index])
    return JSON.stringify(current) === JSON.stringify(fallback)
  })
}

function hasMeaningfulTasks(tasksByDate) {
  return Object.values(tasksByDate).some((tasks) =>
    Array.isArray(tasks)
      ? tasks.length !== DEFAULT_TASK_TITLES.size ||
        tasks.some((task) => Boolean(task?.done) || !DEFAULT_TASK_TITLES.has(String(task?.title ?? '')))
      : false,
  )
}

function hasOperationRecords(opsByDate) {
  return Object.values(opsByDate).some((records) => Array.isArray(records) && records.length > 0)
}

function hasMeaningfulBodyRecords(bodyByDate) {
  return Object.values(bodyByDate).some((record) =>
    Boolean(
      record?.weight ||
        record?.bedTime ||
        record?.wakeTime ||
        record?.sleepHours ||
        record?.lunch ||
        record?.dinner ||
        record?.snack ||
        record?.afternoonSnack ||
        record?.eveningSnack ||
        record?.legacySnack ||
        record?.extraMeal ||
        record?.加餐 ||
        record?.exerciseText ||
        record?.relapseNote ||
        normalizeRelapseTypes(record?.relapseTypes).length ||
        normalizeRelapseStatus(record?.relapseStatus) !== 'unrecorded' ||
        record?.note ||
        (record?.exercise && record.exercise !== '未记录'),
    ),
  )
}

function hasMeaningfulLearningTopics(learningTopics) {
  return Object.values(toDateMap(learningTopics)).some(hasStoredValue)
}

export function migrateLearningRecord(record) {
  if (typeof record === 'string') {
    return { topic: record, output: '' }
  }

  if (!isPlainObject(record)) {
    return { topic: '', output: '' }
  }

  const next = { ...record }
  fillIfEmpty(next, 'topic', firstStoredValue(record, ['topic', 'learningTopic', '今日学习 / 沉淀主题', '今日学习主题']))
  fillIfEmpty(next, 'output', firstStoredValue(record, ['output', 'learningOutput', '今日学习产出', '今日学习产出，可选']))

  return {
    ...next,
    topic: String(next.topic ?? ''),
    output: String(next.output ?? ''),
    ...(next.completed === undefined ? {} : { completed: Boolean(next.completed) }),
  }
}

export function migrateLearningRecordsMap(recordsByDate) {
  return Object.fromEntries(
    Object.entries(toDateMap(recordsByDate)).map(([dateKey, record]) => [dateKey, migrateLearningRecord(record)]),
  )
}

function hasMeaningfulLearningRecords(learningRecords) {
  return Object.values(toDateMap(learningRecords)).some((record) => {
    const normalized = migrateLearningRecord(record)
    return hasStoredValue(normalized.topic) || hasStoredValue(normalized.output) || Boolean(normalized.completed)
  })
}

function hasMeaningfulReviewRecords(reviewByDate) {
  return Object.values(reviewByDate).some((record) =>
    Boolean(
      record?.valuableThing ||
        record?.stupidThing ||
        record?.unfinishedReason ||
        record?.tomorrowTop3 ||
        record?.biggestRisk ||
        (record?.discipline && record.discipline !== '未记录'),
    ),
  )
}

export function normalizeAppState(state, fallbackAssets = []) {
  const source = isPlainObject(state) ? state : {}
  const settings = isPlainObject(source.settings) ? source.settings : {}

  return {
    schemaVersion: APP_STATE_SCHEMA_VERSION,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : new Date().toISOString(),
    tasks: migrateTasksMap(toDateMap(source.tasks ?? source.tasksByDate)),
    xianyuRecords: toDateMap(source.xianyuRecords ?? source.opsByDate),
    bodyRecords: migrateBodyRecordsMap(toDateMap(source.bodyRecords ?? source.bodyByDate)),
    financeAssets: migrateFinanceAssets(toAssetList(source.financeAssets ?? source.assets, fallbackAssets)),
    reviewRecords: migrateReviewRecordsMap(toDateMap(source.reviewRecords ?? source.reviewByDate)),
    learningTopics: toDateMap(source.learningTopics ?? source.learningTopicsByDate),
    learningRecords: migrateLearningRecordsMap(source.learningRecords ?? source.learningRecordsByDate ?? source.learningTopics ?? source.learningTopicsByDate),
    settings: {
      ...settings,
      privacyMode: Boolean(settings.privacyMode ?? source.privacyMode ?? true),
    },
  }
}

export function migrateBodyRecord(record) {
  if (!isPlainObject(record)) return record

  const next = { ...record }

  fillIfEmpty(next, 'date', firstStoredValue(record, ['date', '日期']))
  fillIfEmpty(next, 'weight', firstStoredValue(record, ['weight', '体重']))
  fillIfEmpty(next, 'bedTime', firstStoredValue(record, ['bedTime', 'sleepTime', 'startSleepTime', '上床时间']))
  fillIfEmpty(next, 'wakeTime', firstStoredValue(record, ['wakeTime', 'endSleepTime', 'wakeUpTime', '起床时间']))
  fillIfEmpty(next, 'sleepHours', firstStoredValue(record, ['sleepHours', '睡眠小时']))
  fillIfEmpty(next, 'lunch', firstStoredValue(record, ['lunch', '中餐']))
  fillIfEmpty(next, 'dinner', firstStoredValue(record, ['dinner', '晚餐']))
  fillIfEmpty(next, 'note', firstStoredValue(record, ['note', '身体备注', '备注']))

  const legacySnack = firstStoredValue(record, ['legacySnack', 'snack', 'extraMeal', '加餐'])
  fillIfEmpty(next, 'legacySnack', legacySnack)
  fillIfEmpty(next, 'afternoonSnack', firstStoredValue(record, ['afternoonSnack', '下午加餐', '下午加']))
  fillIfEmpty(next, 'eveningSnack', firstStoredValue(record, ['eveningSnack', '晚上加餐', '晚上加']))

  if (!hasStoredValue(next.afternoonSnack) && hasStoredValue(legacySnack)) {
    next.afternoonSnack = legacySnack
  }

  next.afternoonSnack = next.afternoonSnack ?? ''
  next.eveningSnack = next.eveningSnack ?? ''
  next.legacySnack = next.legacySnack ?? ''

  fillIfEmpty(next, 'exerciseText', firstStoredValue(record, ['exerciseText', '运动记录']))

  if (!hasStoredValue(next.exerciseText) && hasStoredValue(record.exercise) && record.exercise !== '未记录') {
    next.exerciseText = record.exercise
  }

  next.relapseStatus = normalizeRelapseStatus(firstStoredValue(next, ['relapseStatus', '是否破戒']))
  next.relapseTypes = normalizeRelapseTypes(firstStoredValue(next, ['relapseTypes', '破戒类型']))
  fillIfEmpty(next, 'relapseNote', firstStoredValue(record, ['relapseNote', '破戒备注']))
  next.relapseNote = next.relapseNote ?? ''

  return {
    schemaVersion: APP_STATE_SCHEMA_VERSION,
    ...next,
  }
}

export function migrateReviewRecord(record) {
  if (!isPlainObject(record)) return record

  const next = { ...record }

  fillIfEmpty(next, 'date', firstStoredValue(record, ['date', '日期']))
  fillIfEmpty(next, 'importantThing', firstStoredValue(record, ['importantThing', '今天最重要的一件事', 'valuableThing', '今天最值钱的一件事']))
  fillIfEmpty(next, 'valuableThing', firstStoredValue(record, ['valuableThing', '今天最值钱的一件事', 'importantThing', '今天最重要的一件事']))
  fillIfEmpty(next, 'stupidThing', firstStoredValue(record, ['stupidThing', '今天最蠢的一件事']))
  fillIfEmpty(next, 'unfinishedReason', firstStoredValue(record, ['unfinishedReason', '今天为什么没完成']))
  fillIfEmpty(next, 'tomorrowTop3', firstStoredValue(record, ['tomorrowTop3', '明天最重要 3 件事', '明天最重要的三件事']))
  fillIfEmpty(next, 'discipline', firstStoredValue(record, ['discipline', '今天有没有破戒或摆烂']))
  fillIfEmpty(next, 'biggestRisk', firstStoredValue(record, ['biggestRisk', '今天最大风险是什么']))

  return {
    schemaVersion: APP_STATE_SCHEMA_VERSION,
    ...next,
  }
}

export function migrateFinanceAsset(asset) {
  if (!isPlainObject(asset)) return asset

  const next = { ...asset }

  fillIfEmpty(next, 'name', firstStoredValue(asset, ['name', '资产名称']))
  fillIfEmpty(next, 'amount', firstStoredValue(asset, ['amount', '金额']))
  fillIfEmpty(next, 'target', firstStoredValue(asset, ['target', '目标']))
  fillIfEmpty(next, 'lower', firstStoredValue(asset, ['lower', '下限']))
  fillIfEmpty(next, 'upper', firstStoredValue(asset, ['upper', '上限']))
  fillIfEmpty(next, 'note', firstStoredValue(asset, ['note', '备注']))

  return {
    ...next,
  }
}

export function migrateTasksMap(tasksByDate) {
  return Object.fromEntries(
    Object.entries(toDateMap(tasksByDate)).map(([dateKey, tasks]) => [dateKey, Array.isArray(tasks) ? tasks.map((task) => ({ ...task })) : tasks]),
  )
}

export function migrateBodyRecordsMap(recordsByDate) {
  return Object.fromEntries(
    Object.entries(toDateMap(recordsByDate)).map(([dateKey, record]) => [dateKey, migrateBodyRecord({ date: dateKey, ...record })]),
  )
}

export function migrateReviewRecordsMap(recordsByDate) {
  return Object.fromEntries(
    Object.entries(toDateMap(recordsByDate)).map(([dateKey, record]) => [dateKey, migrateReviewRecord({ date: dateKey, ...record })]),
  )
}

export function migrateFinanceAssets(assets) {
  return Array.isArray(assets) ? assets.map(migrateFinanceAsset) : []
}

export function createAppStateSnapshot({
  tasksByDate,
  opsByDate,
  bodyByDate,
  financeAssets,
  reviewByDate,
  privacyMode,
  learningTopicsByDate,
  learningRecordsByDate,
}) {
  return normalizeAppState({
    updatedAt: new Date().toISOString(),
    tasks: tasksByDate,
    xianyuRecords: opsByDate,
    bodyRecords: bodyByDate,
    financeAssets,
    reviewRecords: reviewByDate,
    learningTopics: learningTopicsByDate,
    learningRecords: learningRecordsByDate,
    settings: { privacyMode },
  })
}

export function migrateLocalStorageToAppState(fallbackAssets = []) {
  const tasks = readStorage(STORAGE_KEYS.tasksByDate, undefined)
  const xianyuRecords = readStorage(STORAGE_KEYS.opsByDate, undefined)
  const bodyRecords = readStorage(STORAGE_KEYS.bodyByDate, undefined)
  const financeAssets = readStorage(STORAGE_KEYS.assets, undefined)
  const reviewRecords = readStorage(STORAGE_KEYS.reviewByDate, undefined)
  const privacyMode = readStorage(STORAGE_KEYS.privacyMode, true)
  const learningTopics = readStorage(STORAGE_KEYS.learningTopicsByDate, {})
  const learningRecords = readStorage(STORAGE_KEYS.learningRecordsByDate, undefined)

  return normalizeAppState(
    {
      tasks: toDateMap(tasks ?? migrateTasksByDate()),
      xianyuRecords: toDateMap(xianyuRecords ?? migrateOpsByDate()),
      bodyRecords: toDateMap(bodyRecords ?? migrateDateMap(STORAGE_KEYS.bodyRecords)),
      financeAssets: toAssetList(financeAssets ?? migrateAssets(fallbackAssets), fallbackAssets),
      reviewRecords: toDateMap(reviewRecords ?? migrateDateMap(STORAGE_KEYS.reviewRecords)),
      learningTopics: toDateMap(learningTopics),
      learningRecords: toDateMap(learningRecords ?? learningTopics),
      settings: { privacyMode },
    },
    fallbackAssets,
  )
}

export function writeAppStateToLocalStorage(state, fallbackAssets = []) {
  const normalized = normalizeAppState(state, fallbackAssets)

  writeStorage(STORAGE_KEYS.tasksByDate, normalized.tasks)
  writeStorage(STORAGE_KEYS.opsByDate, normalized.xianyuRecords)
  writeStorage(STORAGE_KEYS.bodyByDate, normalized.bodyRecords)
  writeStorage(STORAGE_KEYS.assets, normalized.financeAssets)
  writeStorage(STORAGE_KEYS.reviewByDate, normalized.reviewRecords)
  writeStorage(STORAGE_KEYS.privacyMode, normalized.settings.privacyMode)
  writeStorage(STORAGE_KEYS.learningTopicsByDate, normalized.learningTopics)
  writeStorage(STORAGE_KEYS.learningRecordsByDate, normalized.learningRecords)

  return normalized
}

export function hasMeaningfulAppState(state, fallbackAssets = []) {
  const normalized = normalizeAppState(state, fallbackAssets)

  return Boolean(
    hasMeaningfulTasks(normalized.tasks) ||
      hasOperationRecords(normalized.xianyuRecords) ||
      hasMeaningfulBodyRecords(normalized.bodyRecords) ||
      hasMeaningfulReviewRecords(normalized.reviewRecords) ||
      hasMeaningfulLearningTopics(normalized.learningTopics) ||
      hasMeaningfulLearningRecords(normalized.learningRecords) ||
      !assetsMatchFallback(normalized.financeAssets, fallbackAssets),
  )
}

function readProjectKeys() {
  const keys = []

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key?.startsWith(STORAGE_PREFIX)) {
      keys.push(key)
    }
  }

  return keys.sort()
}

function parseBackupValue(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export function createProjectBackupPayload() {
  const data = {}
  const rawLocalStorage = {}

  readProjectKeys().forEach((key) => {
    const raw = window.localStorage.getItem(key)
    rawLocalStorage[key] = raw
    data[key] = parseBackupValue(raw)
  })

  return {
    app: 'amu-battle-station',
    schemaVersion: APP_STATE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    appState: migrateLocalStorageToAppState(),
    rawLocalStorage,
  }
}

export function restoreProjectBackupPayload(payload) {
  const data =
    payload?.data ||
    (payload?.rawLocalStorage && typeof payload.rawLocalStorage === 'object'
      ? Object.fromEntries(
          Object.entries(payload.rawLocalStorage).map(([key, raw]) => [key, parseBackupValue(raw)]),
        )
      : null)

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('备份文件格式不正确。')
  }

  const entries = Object.entries(data).filter(([key]) => key.startsWith(STORAGE_PREFIX))

  readProjectKeys().forEach((key) => {
    window.localStorage.removeItem(key)
  })

  entries.forEach(([key, value]) => {
    window.localStorage.setItem(key, JSON.stringify(value))
  })
}

export function clearProjectStorage() {
  readProjectKeys().forEach((key) => {
    window.localStorage.removeItem(key)
  })
}

export function migrateTasksByDate() {
  const tasksByDate = {}

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)

      if (!key?.startsWith(LEGACY_TASKS_PREFIX)) continue

      const dateKey = key.slice(LEGACY_TASKS_PREFIX.length)
      const tasks = readRawStorage(key)

      if (dateKey && Array.isArray(tasks)) {
        tasksByDate[dateKey] = tasks
      }
    }
  } catch {
    return {}
  }

  return tasksByDate
}

export function migrateOpsByDate() {
  const legacyRecords = readStorage(STORAGE_KEYS.xianyuRecords, [])

  if (!Array.isArray(legacyRecords)) return {}

  return legacyRecords.reduce((recordsByDate, record) => {
    const dateKey = record?.date
    if (!dateKey) return recordsByDate

    return {
      ...recordsByDate,
      [dateKey]: [...(recordsByDate[dateKey] || []), record],
    }
  }, {})
}

export function migrateDateMap(legacyKey) {
  const legacyMap = readStorage(legacyKey, {})
  return legacyMap && typeof legacyMap === 'object' && !Array.isArray(legacyMap) ? legacyMap : {}
}

export function migrateAssets(fallbackAssets) {
  return readStorage(STORAGE_KEYS.financeAssets, fallbackAssets)
}

export function useStoredState(key, fallback, migrateValue = (value) => value) {
  const fallbackRef = useRef(fallback)
  const migrateRef = useRef(migrateValue)
  const [value, setValue] = useState(() => migrateValue(readStorage(key, fallback)))

  useEffect(() => {
    fallbackRef.current = fallback
  }, [fallback])

  useEffect(() => {
    migrateRef.current = migrateValue
  }, [migrateValue])

  useEffect(() => {
    setValue(migrateRef.current(readStorage(key, fallbackRef.current)))
  }, [key])

  useEffect(() => {
    writeStorage(key, value)
  }, [key, value])

  return [value, setValue]
}
