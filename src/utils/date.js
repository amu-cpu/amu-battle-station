export function getTodayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function formatDateLabel(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(date)

  return `${year}年${month}月${day}日 ${weekday}`
}

export function sortByDateDesc(items) {
  return [...items].sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

export function calculateSleepHours(bedTime, wakeTime) {
  if (!bedTime || !wakeTime) return ''

  const [bedHour, bedMinute] = bedTime.split(':').map(Number)
  const [wakeHour, wakeMinute] = wakeTime.split(':').map(Number)
  let bedTotal = bedHour * 60 + bedMinute
  let wakeTotal = wakeHour * 60 + wakeMinute

  if (wakeTotal <= bedTotal) {
    wakeTotal += 24 * 60
  }

  const hours = (wakeTotal - bedTotal) / 60
  return Number(hours.toFixed(1))
}
