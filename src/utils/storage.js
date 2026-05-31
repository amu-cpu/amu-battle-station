import { useEffect, useRef, useState } from 'react'

export const STORAGE_KEYS = {
  xianyuRecords: 'amu-battle-station:xianyu-records',
  bodyRecords: 'amu-battle-station:body-records',
  financeAssets: 'amu-battle-station:finance-assets',
  reviewRecords: 'amu-battle-station:review-records',
}

export function dailyTasksKey(dateKey) {
  return `amu-battle-station:tasks:${dateKey}`
}

function resolveFallback(fallback) {
  return typeof fallback === 'function' ? fallback() : fallback
}

export function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : resolveFallback(fallback)
  } catch {
    return resolveFallback(fallback)
  }
}

export function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value))
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
