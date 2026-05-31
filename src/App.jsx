import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import BodyPanel from './pages/BodyPanel'
import Dashboard from './pages/Dashboard'
import FinancePanel from './pages/FinancePanel'
import ReviewPanel from './pages/ReviewPanel'
import XianyuPanel from './pages/XianyuPanel'
import { createDefaultTasks, defaultBodyRecord, defaultFinanceAssets, defaultReviewRecord } from './utils/defaults'
import { getTodayKey } from './utils/date'
import { migrateAssets, migrateDateMap, migrateOpsByDate, migrateTasksByDate, STORAGE_KEYS, useStoredState } from './utils/storage'
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
  const [tasksByDate, setTasksByDate] = useStoredState(STORAGE_KEYS.tasksByDate, migrateTasksByDate)
  const [opsByDate, setOpsByDate] = useStoredState(STORAGE_KEYS.opsByDate, migrateOpsByDate)
  const [bodyByDate, setBodyByDate] = useStoredState(STORAGE_KEYS.bodyByDate, () => migrateDateMap(STORAGE_KEYS.bodyRecords))
  const [financeAssets, setFinanceAssets] = useStoredState(STORAGE_KEYS.assets, () => migrateAssets(defaultFinanceAssets))
  const [reviewByDate, setReviewByDate] = useStoredState(STORAGE_KEYS.reviewByDate, () => migrateDateMap(STORAGE_KEYS.reviewRecords))

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
  const operationScore = calculateOperationScore(operationSummary)
  const bodyScore = calculateBodyScore(bodyByDate[selectedDate] ? bodyRecord : null)
  const effectiveTasks = applyTaskAutomation(tasks, { operationSummary, bodyRecord, reviewRecord })
  const taskScore = calculateTaskScore(effectiveTasks)
  const battleScore = calculateBattleScore({ taskScore, bodyScore, operationScore })
  const operationDiagnosis = getOperationDiagnosis(operationSummary)
  const financeStatus = getFinanceStatusSummary(financeAssets)
  const scores = { taskScore, operationScore, bodyScore, battleScore }

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
        reviewRecord={reviewRecord}
        hasReviewRecord={hasReviewRecord(reviewByDate[selectedDate])}
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
    finance: <FinancePanel assets={financeAssets} setAssets={setFinanceAssets} />,
    review: <ReviewPanel selectedDate={selectedDate} reviewRecords={reviewByDate} setReviewRecords={setReviewByDate} />,
  }

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {pages[activePage]}
    </Layout>
  )
}

export default App
