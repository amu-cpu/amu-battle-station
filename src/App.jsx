import { useMemo, useState } from 'react'
import Layout from './components/Layout'
import BodyPanel from './pages/BodyPanel'
import Dashboard from './pages/Dashboard'
import FinancePanel from './pages/FinancePanel'
import ReviewPanel from './pages/ReviewPanel'
import XianyuPanel from './pages/XianyuPanel'
import { createDefaultTasks, defaultBodyRecord, defaultFinanceAssets, defaultReviewRecord } from './utils/defaults'
import { getTodayKey } from './utils/date'
import { dailyTasksKey, STORAGE_KEYS, useStoredState } from './utils/storage'
import {
  calculateBattleScore,
  calculateBodyScore,
  calculateOperationScore,
  calculateOperationSummary,
  calculateTaskScore,
  getFinanceAlerts,
  getOperationDiagnosis,
  isReviewComplete,
} from './utils/scoring'

function App() {
  const today = getTodayKey()
  const [activePage, setActivePage] = useState('dashboard')
  const [tasks, setTasks] = useStoredState(dailyTasksKey(today), () => createDefaultTasks(today))
  const [xianyuRecords, setXianyuRecords] = useStoredState(STORAGE_KEYS.xianyuRecords, [])
  const [bodyRecords, setBodyRecords] = useStoredState(STORAGE_KEYS.bodyRecords, {})
  const [financeAssets, setFinanceAssets] = useStoredState(STORAGE_KEYS.financeAssets, defaultFinanceAssets)
  const [reviewRecords, setReviewRecords] = useStoredState(STORAGE_KEYS.reviewRecords, {})

  const operationSummary = useMemo(() => calculateOperationSummary(xianyuRecords, today), [xianyuRecords, today])
  const bodyRecord = { ...defaultBodyRecord, date: today, ...(bodyRecords[today] || {}) }
  const reviewRecord = { ...defaultReviewRecord, date: today, ...(reviewRecords[today] || {}) }
  const taskScore = calculateTaskScore(tasks)
  const operationScore = calculateOperationScore(operationSummary)
  const bodyScore = calculateBodyScore(bodyRecord)
  const battleScore = calculateBattleScore({ taskScore, bodyScore, operationScore })
  const operationDiagnosis = getOperationDiagnosis(operationSummary)
  const financeAlerts = getFinanceAlerts(financeAssets)
  const reviewComplete = isReviewComplete(reviewRecord)
  const scores = { taskScore, operationScore, bodyScore, battleScore }

  const pages = {
    dashboard: (
      <Dashboard
        today={today}
        tasks={tasks}
        setTasks={setTasks}
        scores={scores}
        operationSummary={operationSummary}
        bodyRecord={bodyRecord}
        financeAlerts={financeAlerts}
        reviewComplete={reviewComplete}
      />
    ),
    xianyu: (
      <XianyuPanel
        today={today}
        records={xianyuRecords}
        setRecords={setXianyuRecords}
        summary={operationSummary}
        operationScore={operationScore}
        diagnosis={operationDiagnosis}
      />
    ),
    body: <BodyPanel today={today} bodyRecords={bodyRecords} setBodyRecords={setBodyRecords} bodyScore={bodyScore} />,
    finance: <FinancePanel assets={financeAssets} setAssets={setFinanceAssets} />,
    review: <ReviewPanel today={today} reviewRecords={reviewRecords} setReviewRecords={setReviewRecords} />,
  }

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {pages[activePage]}
    </Layout>
  )
}

export default App
