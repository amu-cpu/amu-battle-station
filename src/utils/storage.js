import { useEffect, useRef, useState } from 'react'

export const STORAGE_PREFIX = 'amu-battle-station:'

export const STORAGE_KEYS = {
  tasksByDate: 'amu-battle-station:tasks-by-date',
  opsByDate: 'amu-battle-station:ops-by-date',
  bodyByDate: 'amu-battle-station:body-by-date',
  reviewByDate: 'amu-battle-station:review-by-date',
  assets: 'amu-battle-station:assets',
  xianyuRecords: 'amu-battle-station:xianyu-records',
  bodyRecords: 'amu-battle-station:body-records',
  financeAssets: 'amu-battle-station:finance-assets',
  reviewRecords: 'amu-battle-station:review-records',
}

export function dailyTasksKey(dateKey) {
  return `amu-battle-station:tasks:${dateKey}`
}

const LEGACY_TASKS_PREFIX = 'amu-battle-station:tasks:'

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
