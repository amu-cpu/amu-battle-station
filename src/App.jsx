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
import ReviewPanel from './pages/ReviewPanel'
import XianyuPanel from './pages/XianyuPanel'
import { createDefaultTasks, defaultBodyRecord, defaultFinanceAssets, defaultReviewRecord } from './utils/defaults'
import { getTodayKey } from './utils/date'
import {
  createAppStateSnapshot,
  hasMeaningfulAppState,
  migrateAssets,
  migrateBodyRecordsMap,
  migrateDateMap,
  migrateFinanceAssets,
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
} from './utils/scoring'

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
      }),
    [bodyByDate, financeAssets, learningTopicsByDate, opsByDate, privacyMode, reviewByDate, tasksByDate],
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
    },
    [setBodyByDate, setFinanceAssets, setLearningTopicsByDate, setOpsByDate, setPrivacyMode, setReviewByDate, setTasksByDate],
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
  const bodyRecord = { ...defaultBodyRecord, date: selectedDate, ...(bodyByDate[selectedDate] || {}) }
  const reviewRecord = { ...defaultReviewRecord, date: selectedDate, ...(reviewByDate[selectedDate] || {}) }
  const operationSummary = calculateOperationSummary(selectedOpsRecords)
  const learningTopic = learningTopicsByDate[selectedDate] || ''
  const operationScore = calculateOperationScore(operationSummary)
  const bodyScore = calculateBodyScore(bodyByDate[selectedDate] ? bodyRecord : null)
  const effectiveTasks = applyTaskAutomation(tasks, { operationSummary, bodyRecord, reviewRecord })
  const taskScore = calculateTaskScore(effectiveTasks)
  const battleScore = calculateBattleScore({ taskScore, bodyScore, operationScore })
  const operationDiagnosis = getOperationDiagnosis(operationSummary)
  const financeStatus = getFinanceStatusSummary(financeAssets)
  const scores = { taskScore, operationScore, bodyScore, battleScore }
  const showCloudSync = cloudSyncAvailable

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

  function updateLearningTopicForSelectedDate(topic) {
    setLearningTopicsByDate((current) => ({ ...current, [selectedDate]: topic }))
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
        learningTopic={learningTopic}
        setLearningTopic={updateLearningTopicForSelectedDate}
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
        {pages[activePage]}
      </div>
    </Layout>
  )
}

export default App
