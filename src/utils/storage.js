import { useEffect, useRef, useState } from 'react'

export const STORAGE_PREFIX = 'amu-battle-station:'

export const STORAGE_KEYS = {
  tasksByDate: 'amu-battle-station:tasks-by-date',
  opsByDate: 'amu-battle-station:ops-by-date',
  bodyByDate: 'amu-battle-station:body-by-date',
  reviewByDate: 'amu-battle-station:review-by-date',
  assets: 'amu-battle-station:assets',
  privacyMode: 'amu-battle-station:privacy-mode',
  xianyuRecords: 'amu-battle-station:xianyu-records',
  bodyRecords: 'amu-battle-station:body-records',
  financeAssets: 'amu-battle-station:finance-assets',
  reviewRecords: 'amu-battle-station:review-records',
}

export function dailyTasksKey(dateKey) {
  return `amu-battle-station:tasks:${dateKey}`
}

const LEGACY_TASKS_PREFIX = 'amu-battle-station:tasks:'
export const APP_STATE_SCHEMA_VERSION = 1

const DEFAULT_TASK_TITLES = new Set([
  '养号 10 分钟',
  '两店铺各发布 1 条商品',
  '回复所有私信，引导客户发资料或加微信',
  '记录今日运营数据',
  '学习 Codex 或代写运营知识 15 分钟',
  '整理 1 条可复用的代写方法或案例',
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
        record?.note ||
        (record?.exercise && record.exercise !== '未记录'),
    ),
  )
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
    tasks: toDateMap(source.tasks ?? source.tasksByDate),
    xianyuRecords: toDateMap(source.xianyuRecords ?? source.opsByDate),
    bodyRecords: toDateMap(source.bodyRecords ?? source.bodyByDate),
    financeAssets: toAssetList(source.financeAssets ?? source.assets, fallbackAssets),
    reviewRecords: toDateMap(source.reviewRecords ?? source.reviewByDate),
    settings: {
      ...settings,
      privacyMode: Boolean(settings.privacyMode ?? source.privacyMode ?? true),
    },
  }
}

export function createAppStateSnapshot({
  tasksByDate,
  opsByDate,
  bodyByDate,
  financeAssets,
  reviewByDate,
  privacyMode,
}) {
  return normalizeAppState({
    updatedAt: new Date().toISOString(),
    tasks: tasksByDate,
    xianyuRecords: opsByDate,
    bodyRecords: bodyByDate,
    financeAssets,
    reviewRecords: reviewByDate,
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

  return normalizeAppState(
    {
      tasks: toDateMap(tasks ?? migrateTasksByDate()),
      xianyuRecords: toDateMap(xianyuRecords ?? migrateOpsByDate()),
      bodyRecords: toDateMap(bodyRecords ?? migrateDateMap(STORAGE_KEYS.bodyRecords)),
      financeAssets: toAssetList(financeAssets ?? migrateAssets(fallbackAssets), fallbackAssets),
      reviewRecords: toDateMap(reviewRecords ?? migrateDateMap(STORAGE_KEYS.reviewRecords)),
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

  return normalized
}

export function hasMeaningfulAppState(state, fallbackAssets = []) {
  const normalized = normalizeAppState(state, fallbackAssets)

  return Boolean(
    hasMeaningfulTasks(normalized.tasks) ||
      hasOperationRecords(normalized.xianyuRecords) ||
      hasMeaningfulBodyRecords(normalized.bodyRecords) ||
      hasMeaningfulReviewRecords(normalized.reviewRecords) ||
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

  readProjectKeys().forEach((key) => {
    data[key] = parseBackupValue(window.localStorage.getItem(key))
  })

  return {
    app: 'amu-battle-station',
    exportedAt: new Date().toISOString(),
    data,
  }
}

export function restoreProjectBackupPayload(payload) {
  const data = payload?.data

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

export function useStoredState(key, fallback) {
  const fallbackRef = useRef(fallback)
  const [value, setValue] = useState(() => readStorage(key, fallback))

  useEffect(() => {
    fallbackRef.current = fallback
  }, [fallback])

  useEffect(() => {
    setValue(readStorage(key, fallbackRef.current))
  }, [key])

  useEffect(() => {
    writeStorage(key, value)
  }, [key, value])

  return [value, setValue]
}
