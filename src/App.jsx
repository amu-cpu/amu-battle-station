import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AuthPanel from './components/AuthPanel'
import Layout from './components/Layout'
import SyncStatus from './components/SyncStatus'
import {
  cloudSyncAvailable,
  getCurrentSession,
  loadCloudState,
  onAuthStateChange,
  saveCloudState,
  signInWithEmail,
  signOut,
} from './lib/cloudSync'
import BodyPanel from './pages/BodyPanel'
import Dashboard from './pages/Dashboard'
import FinancePanel from './pages/FinancePanel'
import ReminderPanel from './pages/ReminderPanel'
import ReviewPanel from './pages/ReviewPanel'
import XianyuPanel from './pages/XianyuPanel'
import { createDefaultTasks, defaultBodyRecord, defaultFinanceAssets, defaultReminderRules, defaultReviewRecord, defaultWakeSettings } from './utils/defaults'
import { calculateSleepHours, getTodayKey } from './utils/date'
import {
  createAppStateSnapshot,
  hasMeaningfulAppState,
  migrateAssets,
  migrateBodyRecordsMap,
  migrateDateMap,
  migrateFinanceAssets,
  migrateLearningRecordsMap,
  migrateLocalStorageToAppState,
  migrateOpsByDate,
  migrateReviewRecordsMap,
  migrateTasksMap,
  migrateTasksByDate,
  normalizeAppState,
  STORAGE_KEYS,
  useStoredState,
  writeAppStateToLocalStorage,
} from './utils/storage'
import {
  buildReminderSummary,
  calculateWakeSummary,
  getCurrentTimeString,
  getReminderStatus,
  normalizeDailyReminderItem,
  normalizeDailyReminderState,
  normalizeDailyWakeState,
  normalizeReminderRules,
  normalizeWakeSettings,
  REMINDER_MESSAGES,
  timeToMinutes,
} from './utils/reminders'
import {
  applyTaskAutomation,
  calculateBattleScore,
  calculateBodyScore,
  calculateOperationScore,
  calculateOperationSummary,
  calculateTaskScore,
  getFinanceStatusSummary,
  getOperationDiagnosis,
  hasBodyRecord,
  hasReviewRecord,
  isReviewComplete,
} from './utils/scoring'

const REMINDER_CHECK_INTERVAL = 60 * 1000

function App() {
  const today = getTodayKey()
  const [selectedDate, setSelectedDate] = useState(today)
  const [activePage, setActivePage] = useState('dashboard')
  const [tasksByDate, setTasksByDate] = useStoredState(STORAGE_KEYS.tasksByDate, migrateTasksByDate, migrateTasksMap)
  const [opsByDate, setOpsByDate] = useStoredState(STORAGE_KEYS.opsByDate, migrateOpsByDate)
  const [bodyByDate, setBodyByDate] = useStoredState(STORAGE_KEYS.bodyByDate, () => migrateDateMap(STORAGE_KEYS.bodyRecords), migrateBodyRecordsMap)
  const [financeAssets, setFinanceAssets] = useStoredState(STORAGE_KEYS.assets, () => migrateAssets(defaultFinanceAssets), migrateFinanceAssets)
  const [reviewByDate, setReviewByDate] = useStoredState(STORAGE_KEYS.reviewByDate, () => migrateDateMap(STORAGE_KEYS.reviewRecords), migrateReviewRecordsMap)
  const [privacyMode, setPrivacyMode] = useStoredState(STORAGE_KEYS.privacyMode, true)
  const [learningTopicsByDate, setLearningTopicsByDate] = useStoredState(STORAGE_KEYS.learningTopicsByDate, {})
  const [learningRecordsByDate, setLearningRecordsByDate] = useStoredState(
    STORAGE_KEYS.learningRecordsByDate,
    () => learningTopicsByDate,
    migrateLearningRecordsMap,
  )
  const [reminderRules, setReminderRules] = useStoredState(STORAGE_KEYS.reminderRules, defaultReminderRules, normalizeReminderRules)
  const [dailyReminderState, setDailyReminderState] = useStoredState(STORAGE_KEYS.dailyReminderState, {}, normalizeDailyReminderState)
  const [wakeSettings, setWakeSettings] = useStoredState(STORAGE_KEYS.wakeSettings, defaultWakeSettings, normalizeWakeSettings)
  const [dailyWakeState, setDailyWakeState] = useStoredState(STORAGE_KEYS.dailyWakeState, {}, normalizeDailyWakeState)
  const [currentTime, setCurrentTime] = useState(getCurrentTimeString())
  const [activeReminder, setActiveReminder] = useState(null)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState('local')
  const [syncMessage, setSyncMessage] = useState('')
  const [syncConflict, setSyncConflict] = useState(null)
  const [cloudReady, setCloudReady] = useState(false)
  const [syncPaused, setSyncPaused] = useState(false)
  const initialSyncInFlightRef = useRef(null)
  const initialSyncedUserRef = useRef(null)

  const appState = useMemo(
    () =>
      createAppStateSnapshot({
        tasksByDate,
        opsByDate,
        bodyByDate,
        financeAssets,
        reviewByDate,
        privacyMode,
        learningTopicsByDate,
        learningRecordsByDate,
        reminderRules,
        dailyReminderState,
        wakeSettings,
        dailyWakeState,
      }),
    [
      bodyByDate,
      dailyReminderState,
      dailyWakeState,
      financeAssets,
      learningRecordsByDate,
      learningTopicsByDate,
      opsByDate,
      privacyMode,
      reminderRules,
      reviewByDate,
      tasksByDate,
      wakeSettings,
    ],
  )

  const applyAppState = useCallback(
    (state) => {
      const normalized = writeAppStateToLocalStorage(state, defaultFinanceAssets)

      setTasksByDate(normalized.tasks)
      setOpsByDate(normalized.xianyuRecords)
      setBodyByDate(normalized.bodyRecords)
      setFinanceAssets(normalized.financeAssets)
      setReviewByDate(normalized.reviewRecords)
      setPrivacyMode(normalized.settings.privacyMode)
      setLearningTopicsByDate(normalized.learningTopics)
      setLearningRecordsByDate(normalized.learningRecords)
      setReminderRules(normalized.reminderRules)
      setDailyReminderState(normalized.dailyReminderState)
      setWakeSettings(normalized.wakeSettings)
      setDailyWakeState(normalized.dailyWakeState)
    },
    [
      setBodyByDate,
      setDailyReminderState,
      setDailyWakeState,
      setFinanceAssets,
      setLearningRecordsByDate,
      setLearningTopicsByDate,
      setOpsByDate,
      setPrivacyMode,
      setReminderRules,
      setReviewByDate,
      setTasksByDate,
      setWakeSettings,
    ],
  )

  const runInitialCloudSync = useCallback(async () => {
    if (!cloudSyncAvailable) {
      setSyncStatus('local')
      return
    }

    let userId = null

    try {
      const currentSession = await getCurrentSession()
      userId = currentSession?.user?.id || null

      if (!userId) {
        setSyncStatus('local')
        return
      }

      if (initialSyncInFlightRef.current === userId || initialSyncedUserRef.current === userId) return

      initialSyncInFlightRef.current = userId
      setSyncStatus(navigator.onLine ? 'syncing' : 'offline')
      setSyncMessage('')

      const localState = migrateLocalStorageToAppState(defaultFinanceAssets)
      const cloudState = await loadCloudState()
      const localHasData = hasMeaningfulAppState(localState, defaultFinanceAssets)
      const cloudHasData = hasMeaningfulAppState(cloudState, defaultFinanceAssets)

      if (!cloudHasData) {
        await saveCloudState(localState)
        setCloudReady(true)
        setSyncPaused(false)
        setSyncConflict(null)
        setSyncStatus('synced')
        setSyncMessage(localHasData ? '已把本地数据同步到云端。' : '已创建云端同步记录。')
        initialSyncedUserRef.current = userId
        return
      }

      if (!localHasData) {
        applyAppState(cloudState)
        setCloudReady(true)
        setSyncPaused(false)
        setSyncConflict(null)
        setSyncStatus('synced')
        setSyncMessage('已从云端加载数据。')
        initialSyncedUserRef.current = userId
        return
      }

      setCloudReady(false)
      setSyncPaused(true)
      setSyncConflict({
        localState: normalizeAppState(localState, defaultFinanceAssets),
        cloudState: normalizeAppState(cloudState, defaultFinanceAssets),
      })
      setSyncStatus('conflict')
      setSyncMessage('请选择使用本地数据还是云端数据。')
      initialSyncedUserRef.current = userId
    } catch (error) {
      console.error('Cloud sync failed:', error)
      setCloudReady(false)
      setSyncStatus(navigator.onLine ? 'error' : 'offline')
      setSyncMessage('')
    } finally {
      if (userId && initialSyncInFlightRef.current === userId) {
        initialSyncInFlightRef.current = null
      }
    }
  }, [applyAppState])

  useEffect(() => {
    let active = true

    async function initAuth() {
      if (!cloudSyncAvailable) {
        setSyncStatus('local')
        return
      }

      try {
        const currentSession = await getCurrentSession()
        if (!active) return

        setSession(currentSession)
        if (currentSession) {
          await runInitialCloudSync()
        } else {
          setSyncStatus('local')
        }
      } catch (error) {
        console.error('Auth init failed:', error)
        setSyncStatus('error')
      }
    }

    initAuth()

    const unsubscribe = onAuthStateChange((nextSession) => {
      if (!active) return

      setSession(nextSession)

      if (nextSession) {
        setSyncPaused(false)
        setSyncConflict(null)
        runInitialCloudSync()
      } else {
        initialSyncedUserRef.current = null
        setCloudReady(false)
        setSyncPaused(false)
        setSyncConflict(null)
        setSyncStatus('local')
        setSyncMessage('已退出登录，继续使用本地数据。')
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [runInitialCloudSync])

  useEffect(() => {
    if (!cloudSyncAvailable || !session || !cloudReady || syncPaused || syncConflict) return undefined

    const timer = window.setTimeout(async () => {
      try {
        if (!navigator.onLine) {
          setSyncStatus('offline')
          setSyncMessage('')
          return
        }

        setSyncStatus('syncing')
        setSyncMessage('')
        await saveCloudState(appState)
        setSyncStatus('synced')
        setSyncMessage('云端已同步。')
      } catch (error) {
        console.error('Cloud save failed:', error)
        setSyncStatus(navigator.onLine ? 'error' : 'offline')
        setSyncMessage('')
      }
    }, 800)

    return () => window.clearTimeout(timer)
  }, [appState, cloudReady, session, syncConflict, syncPaused])

  async function handleSignIn(email) {
    setAuthLoading(true)

    try {
      await signInWithEmail(email)
      setSyncMessage('登录链接已发送，请检查邮箱。')
    } catch (error) {
      console.error('Sign in failed:', error)
      setSyncStatus('error')
      throw error
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleSignOut() {
    setAuthLoading(true)

    try {
      await signOut()
      setSession(null)
      initialSyncedUserRef.current = null
      setCloudReady(false)
      setSyncPaused(false)
      setSyncConflict(null)
      setSyncStatus('local')
      setSyncMessage('已退出登录，继续使用本地数据。')
    } catch (error) {
      console.error('Sign out failed:', error)
      setSyncStatus('error')
    } finally {
      setAuthLoading(false)
    }
  }

  function handleUseCloudState() {
    if (!syncConflict) return

    applyAppState(syncConflict.cloudState)
    setSyncConflict(null)
    setSyncPaused(false)
    setCloudReady(true)
    setSyncStatus('synced')
    setSyncMessage('已使用云端数据。')
  }

  async function handleUseLocalState() {
    if (!syncConflict) return

    try {
      setSyncStatus('syncing')
      await saveCloudState(syncConflict.localState)
      setSyncConflict(null)
      setSyncPaused(false)
      setCloudReady(true)
      setSyncStatus('synced')
      setSyncMessage('已使用本地数据覆盖云端。')
    } catch (error) {
      console.error('Cloud conflict save failed:', error)
      setSyncStatus(navigator.onLine ? 'error' : 'offline')
      setSyncMessage('')
    }
  }

  function handleSkipMerge() {
    setSyncConflict(null)
    setSyncPaused(true)
    setCloudReady(false)
    setSyncStatus('local')
    setSyncMessage('已暂时不合并，当前只保存本地数据。')
  }

  useEffect(() => {
    setTasksByDate((current) => {
      if (Object.prototype.hasOwnProperty.call(current, selectedDate)) return current
      return { ...current, [selectedDate]: createDefaultTasks(selectedDate) }
    })
  }, [selectedDate, setTasksByDate])

  const storedTasks = Object.prototype.hasOwnProperty.call(tasksByDate, selectedDate) ? tasksByDate[selectedDate] : null
  const tasks = Array.isArray(storedTasks) ? storedTasks : createDefaultTasks(selectedDate)
  const selectedOpsRecords = Array.isArray(opsByDate[selectedDate]) ? opsByDate[selectedDate] : []
  const allOpsRecords = Object.values(opsByDate).flat()
  const bodyRecord = useMemo(() => ({ ...defaultBodyRecord, date: selectedDate, ...(bodyByDate[selectedDate] || {}) }), [bodyByDate, selectedDate])
  const reviewRecord = useMemo(() => ({ ...defaultReviewRecord, date: selectedDate, ...(reviewByDate[selectedDate] || {}) }), [reviewByDate, selectedDate])
  const operationSummary = calculateOperationSummary(selectedOpsRecords)
  const learningRecord = {
    topic: learningTopicsByDate[selectedDate] || '',
    output: '',
    ...(learningRecordsByDate[selectedDate] || {}),
  }
  const operationScore = calculateOperationScore(operationSummary)
  const bodyScore = calculateBodyScore(bodyByDate[selectedDate] ? bodyRecord : null)
  const effectiveTasks = applyTaskAutomation(tasks, { operationSummary, bodyRecord, reviewRecord })
  const taskScore = calculateTaskScore(effectiveTasks)
  const battleScore = calculateBattleScore({ taskScore, bodyScore, operationScore })
  const operationDiagnosis = getOperationDiagnosis(operationSummary)
  const financeStatus = getFinanceStatusSummary(financeAssets)
  const selectedDayReminderState = dailyReminderState[selectedDate] || {}
  const wakeSummary = calculateWakeSummary(bodyRecord, wakeSettings, dailyWakeState[selectedDate])
  const reviewComplete = isReviewComplete(reviewRecord)
  const reminderSummary = buildReminderSummary(reminderRules, selectedDayReminderState, { wakeSummary, reviewComplete })
  const scores = { taskScore, operationScore, bodyScore, battleScore }
  const showCloudSync = cloudSyncAvailable

  useEffect(() => {
    setDailyWakeState((current) => {
      const currentItem = current[selectedDate] || {}
      const nextSummary = calculateWakeSummary(bodyRecord, wakeSettings, currentItem)

      if (!nextSummary.actualWakeTime && !currentItem.actualWakeTime) return current

      const nextItem = {
        ...currentItem,
        ...nextSummary,
      }

      if (JSON.stringify(currentItem) === JSON.stringify(nextItem)) return current
      return { ...current, [selectedDate]: nextItem }
    })
  }, [bodyRecord, selectedDate, setDailyWakeState, wakeSettings])

  function updateTasksForSelectedDate(updater) {
    setTasksByDate((current) => {
      const currentTasks = Object.prototype.hasOwnProperty.call(current, selectedDate)
        ? current[selectedDate]
        : createDefaultTasks(selectedDate)
      const nextTasks = typeof updater === 'function' ? updater(currentTasks) : updater
      return { ...current, [selectedDate]: nextTasks }
    })
  }

  function updateOpsForSelectedDate(updater) {
    setOpsByDate((current) => {
      const currentRecords = current[selectedDate] || []
      const nextRecords = typeof updater === 'function' ? updater(currentRecords) : updater
      return { ...current, [selectedDate]: nextRecords }
    })
  }

  function updateLearningRecordForSelectedDate(updater) {
    setLearningRecordsByDate((current) => {
      const currentRecord = {
        topic: learningTopicsByDate[selectedDate] || '',
        output: '',
        ...(current[selectedDate] || {}),
      }
      const nextRecord = typeof updater === 'function' ? updater(currentRecord) : updater

      return { ...current, [selectedDate]: nextRecord }
    })
  }

  function updateReminderStateForDate(dateKey, reminderId, updater) {
    setDailyReminderState((current) => {
      const currentDay = current[dateKey] || {}
      const currentItem = normalizeDailyReminderItem(currentDay[reminderId])
      const nextItem = typeof updater === 'function' ? updater(currentItem) : updater

      return {
        ...current,
        [dateKey]: {
          ...currentDay,
          [reminderId]: normalizeDailyReminderItem(nextItem),
        },
      }
    })
  }

  function setBodyWakeTime(dateKey, wakeTime, onlyIfEmpty = false) {
    if (!wakeTime) return

    setBodyByDate((current) => {
      const existing = current[dateKey] || {}
      if (onlyIfEmpty && (existing.wakeTime || existing.wakeUpTime || existing.起床时间)) return current

      const nextRecord = {
        ...defaultBodyRecord,
        date: dateKey,
        ...existing,
        wakeTime,
      }

      if (nextRecord.bedTime) {
        nextRecord.sleepHours = calculateSleepHours(nextRecord.bedTime, wakeTime)
      }

      return { ...current, [dateKey]: nextRecord }
    })
  }

  function setWakeSummaryForDate(dateKey, actualWakeTime) {
    setBodyWakeTime(dateKey, actualWakeTime)
    setDailyWakeState((current) => {
      const currentItem = current[dateKey] || {}
      const nextSummary = calculateWakeSummary({ ...(bodyByDate[dateKey] || {}), wakeTime: actualWakeTime }, wakeSettings, currentItem)
      return {
        ...current,
        [dateKey]: {
          ...currentItem,
          ...nextSummary,
        },
      }
    })
  }

  function completeReminder(dateKey, reminderId, wakeTime = getCurrentTimeString()) {
    updateReminderStateForDate(dateKey, reminderId, (item) => ({
      ...item,
      status: 'completed',
      completedAt: new Date().toISOString(),
      snoozedUntil: null,
    }))

    if (reminderId === 'wake') {
      setBodyWakeTime(dateKey, wakeTime, true)
    }
  }

  function snoozeReminder(dateKey, reminderId) {
    const snoozedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    updateReminderStateForDate(dateKey, reminderId, (item) => ({
      ...item,
      status: 'snoozed',
      snoozedUntil,
    }))
  }

  function skipReminder(dateKey, reminderId) {
    updateReminderStateForDate(dateKey, reminderId, (item) => ({
      ...item,
      status: 'skipped',
      snoozedUntil: null,
    }))
  }

  useEffect(() => {
    function checkReminders() {
      const now = new Date()
      const current = getCurrentTimeString(now)
      setCurrentTime(current)

      if (activeReminder) return

      const todayKey = getTodayKey()
      const currentMinutes = timeToMinutes(current)
      if (currentMinutes === null) return

      const todayDayState = dailyReminderState[todayKey] || {}
      const todayBodyRecord = { ...defaultBodyRecord, date: todayKey, ...(bodyByDate[todayKey] || {}) }
      const todayWakeSummary = calculateWakeSummary(todayBodyRecord, wakeSettings, dailyWakeState[todayKey])
      const todayReviewRecord = { ...defaultReviewRecord, date: todayKey, ...(reviewByDate[todayKey] || {}) }
      const context = { wakeSummary: todayWakeSummary, reviewComplete: isReviewComplete(todayReviewRecord) }

      for (const rule of normalizeReminderRules(reminderRules)) {
        if (!rule.active) continue

        const status = getReminderStatus(rule.id, todayDayState, context)
        if (status === 'completed' || status === 'skipped') continue

        const state = normalizeDailyReminderItem(todayDayState[rule.id])
        let triggerKey = null

        if (state.snoozedUntil && new Date(state.snoozedUntil).getTime() <= now.getTime() && !state.triggeredTimes.includes(`snooze:${state.snoozedUntil}`)) {
          triggerKey = `snooze:${state.snoozedUntil}`
        }

        if (!triggerKey) {
          const dueTime = rule.times.find((time) => {
            const reminderMinutes = timeToMinutes(time)
            return reminderMinutes !== null && reminderMinutes <= currentMinutes && !state.triggeredTimes.includes(`time:${time}`)
          })

          if (dueTime) {
            triggerKey = `time:${dueTime}`
          }
        }

        if (!triggerKey) continue

        setDailyReminderState((currentState) => {
          const currentDay = currentState[todayKey] || {}
          const currentItem = normalizeDailyReminderItem(currentDay[rule.id])
          return {
            ...currentState,
            [todayKey]: {
              ...currentDay,
              [rule.id]: {
                ...currentItem,
                status: currentItem.status === 'snoozed' ? 'pending' : currentItem.status,
                remindCount: Number(currentItem.remindCount || 0) + 1,
                triggeredTimes: [...new Set([...currentItem.triggeredTimes, triggerKey])],
              },
            },
          }
        })

        setActiveReminder({
          dateKey: todayKey,
          ruleId: rule.id,
          title: rule.title,
          message: REMINDER_MESSAGES[rule.id],
        })
        break
      }
    }

    checkReminders()
    const timer = window.setInterval(checkReminders, REMINDER_CHECK_INTERVAL)
    return () => window.clearInterval(timer)
  }, [activeReminder, bodyByDate, dailyReminderState, dailyWakeState, reminderRules, reviewByDate, setDailyReminderState, wakeSettings])

  function closeActiveReminder() {
    setActiveReminder(null)
  }

  function completeActiveReminder() {
    if (!activeReminder) return
    completeReminder(activeReminder.dateKey, activeReminder.ruleId)
    setActiveReminder(null)
  }

  function snoozeActiveReminder() {
    if (!activeReminder) return
    snoozeReminder(activeReminder.dateKey, activeReminder.ruleId)
    setActiveReminder(null)
  }

  function skipActiveReminder() {
    if (!activeReminder) return
    skipReminder(activeReminder.dateKey, activeReminder.ruleId)
    setActiveReminder(null)
  }

  const pages = {
    dashboard: (
      <Dashboard
        selectedDate={selectedDate}
        today={today}
        onDateChange={setSelectedDate}
        effectiveTasks={effectiveTasks}
        setTasks={updateTasksForSelectedDate}
        scores={scores}
        operationSummary={operationSummary}
        bodyRecord={bodyRecord}
        hasBodyRecord={hasBodyRecord(bodyByDate[selectedDate])}
        financeStatus={financeStatus}
        privacyMode={privacyMode}
        reviewRecord={reviewRecord}
        hasReviewRecord={hasReviewRecord(reviewByDate[selectedDate])}
        learningRecord={learningRecord}
        setLearningRecord={updateLearningRecordForSelectedDate}
        reminderSummary={reminderSummary}
        wakeSummary={wakeSummary}
        currentTime={currentTime}
      />
    ),
    xianyu: (
      <XianyuPanel
        selectedDate={selectedDate}
        records={selectedOpsRecords}
        allRecords={allOpsRecords}
        setRecords={updateOpsForSelectedDate}
        summary={operationSummary}
        operationScore={operationScore}
        diagnosis={operationDiagnosis}
      />
    ),
    body: (
      <BodyPanel
        selectedDate={selectedDate}
        bodyRecords={bodyByDate}
        setBodyRecords={setBodyByDate}
        bodyScore={bodyScore}
        wakeSummary={wakeSummary}
      />
    ),
    finance: (
      <FinancePanel
        assets={financeAssets}
        setAssets={setFinanceAssets}
        privacyMode={privacyMode}
        setPrivacyMode={setPrivacyMode}
      />
    ),
    review: <ReviewPanel selectedDate={selectedDate} reviewRecords={reviewByDate} setReviewRecords={setReviewByDate} />,
    reminders: (
      <ReminderPanel
        selectedDate={selectedDate}
        reminderRules={reminderRules}
        setReminderRules={setReminderRules}
        dayState={selectedDayReminderState}
        updateReminderState={(reminderId, updater) => updateReminderStateForDate(selectedDate, reminderId, updater)}
        completeReminder={(reminderId) => completeReminder(selectedDate, reminderId)}
        snoozeReminder={(reminderId) => snoozeReminder(selectedDate, reminderId)}
        skipReminder={(reminderId) => skipReminder(selectedDate, reminderId)}
        wakeSettings={wakeSettings}
        setWakeSettings={setWakeSettings}
        wakeSummary={wakeSummary}
        setWakeTime={(wakeTime) => setWakeSummaryForDate(selectedDate, wakeTime)}
        operationSummary={operationSummary}
        learningRecord={learningRecord}
        reviewComplete={reviewComplete}
      />
    ),
  }

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      <div className="space-y-4">
        {showCloudSync ? (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
            <AuthPanel
              configured={cloudSyncAvailable}
              session={session}
              loading={authLoading}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
              conflict={syncConflict}
              onUseCloud={handleUseCloudState}
              onUseLocal={handleUseLocalState}
              onSkipMerge={handleSkipMerge}
            />
            <SyncStatus status={syncStatus} message={syncMessage} />
          </div>
        ) : null}
        {activeReminder ? (
          <div className="fixed right-4 top-4 z-50 w-[min(420px,calc(100vw-2rem))] rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-amber-700">督促 · {activeReminder.title}</p>
                <p className="mt-2 text-sm font-bold leading-6">{activeReminder.message}</p>
              </div>
              <button type="button" onClick={closeActiveReminder} className="rounded-md px-2 py-1 text-sm font-bold text-amber-700 hover:bg-amber-100">
                关闭
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={completeActiveReminder} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white">
                已完成
              </button>
              <button type="button" onClick={snoozeActiveReminder} className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-amber-900">
                15分钟后提醒
              </button>
              <button type="button" onClick={skipActiveReminder} className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-amber-900">
                今日不提醒
              </button>
            </div>
          </div>
        ) : null}
        {pages[activePage]}
      </div>
    </Layout>
  )
}

export default App
