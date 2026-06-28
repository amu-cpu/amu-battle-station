export function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function getOperationViews(record) {
  return toNumber(record?.views ?? record?.browse ?? record?.viewCount ?? record?.browseCount)
}

function isFilled(value) {
  return String(value ?? '').trim() !== ''
}

function getExerciseValue(record) {
  return (
    record?.exerciseNote ||
    record?.exerciseText ||
    (record?.exercise !== '未记录' ? record?.exercise : '')
  )
}

function parseTimeToMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

function isWakeOnTime(record, targetWakeTime, options = {}) {
  const actualMinutes = parseTimeToMinutes(record?.wakeTime || record?.wakeUpTime || record?.起床时间)
  const targetMinutes = parseTimeToMinutes(targetWakeTime)
  const graceMinutes = Number(options.graceMinutes || 0)
  return (
    actualMinutes !== null &&
    targetMinutes !== null &&
    actualMinutes <= targetMinutes + graceMinutes
  )
}

export function getRelapseStatus(record) {
  const text = String(record?.relapseStatus ?? record?.是否破戒 ?? '').trim()
  if (['yes', '是', '有', '破戒'].includes(text)) return 'yes'
  if (['no', '否', '没有', '无'].includes(text)) return 'no'
  return 'unrecorded'
}

export function getRelapseLabel(record) {
  const status = getRelapseStatus(record)
  if (status === 'yes') return '是'
  if (status === 'no') return '否'
  return '未记录'
}

export function calculateTaskScore(tasks) {
  if (!tasks.length) return 0
  const doneCount = tasks.filter((task) => task.done).length
  return clampScore((doneCount / tasks.length) * 100)
}

export function calculateOperationSummary(records, dateKey) {
  const selectedRecords = dateKey ? records.filter((record) => record.date === dateKey) : records

  return selectedRecords.reduce(
    (summary, record) => ({
      publishCount: summary.publishCount + toNumber(record.publishCount),
      exposure: summary.exposure + toNumber(record.exposure),
      views: summary.views + getOperationViews(record),
      inquiries: summary.inquiries + toNumber(record.inquiries),
      wechat: summary.wechat + toNumber(record.wechat),
      deals: summary.deals + toNumber(record.deals),
      income: summary.income + toNumber(record.income),
      warmedCount: summary.warmedCount + (record.accountWarmed ? 1 : 0),
      recordCount: summary.recordCount + 1,
    }),
    {
      publishCount: 0,
      exposure: 0,
      views: 0,
      inquiries: 0,
      wechat: 0,
      deals: 0,
      income: 0,
      warmedCount: 0,
      recordCount: 0,
    },
  )
}

export function calculateOperationScore(summary) {
  let score = 0
  if (summary.publishCount > 0) score += 20
  if (summary.exposure > 0) score += 15
  if (summary.views > 0) score += 15
  if (summary.inquiries > 0) score += 15
  if (summary.wechat > 0) score += 15
  if (summary.deals > 0) score += 10
  if (summary.income > 0) score += 5
  if (summary.warmedCount > 0) score += 5
  return clampScore(score)
}

export function getOperationDiagnosis(summary) {
  if (summary.publishCount === 0) {
    return '当天没有发布，现金流动作不足，先上架，不要研究半天。'
  }

  if (summary.exposure === 0) {
    return '曝光为 0，优先检查标题、主图、类目和擦亮。'
  }

  if (summary.exposure > 0 && summary.views === 0) {
    return '有曝光没浏览，主图和标题不够吸引人。'
  }

  if (summary.views > 0 && summary.inquiries === 0) {
    return '有浏览没咨询，详情页、价格或信任感有问题。'
  }

  if (summary.inquiries > 0 && summary.wechat === 0) {
    return '有咨询没加微，私信引导不够直接。'
  }

  if (summary.wechat > 0 && summary.deals === 0) {
    return '有加微没成交，成交话术或报价需要优化。'
  }

  if (summary.deals > 0) {
    return '今天有成交，记录来源和话术，别只爽一下。'
  }

  return '继续补齐漏斗数据，先看哪一环断了。'
}

export function calculateBodyScore(record, options = {}) {
  if (!record) return 0

  const targetWakeTime = options.targetWakeTime || ''
  const sleepHours = toNumber(record.sleepHours)
  let score = 0
  if (isWakeOnTime(record, targetWakeTime, options)) score += 30
  if (sleepHours >= 7) score += 30
  else if (sleepHours >= 6) score += 15
  if (isFilled(getExerciseValue(record))) score += 30
  if (toNumber(record.weight) > 0) score += 10

  return clampScore(score)
}

export function hasBodyDiet(record) {
  return Boolean(
    record &&
      (isFilled(record.lunch) ||
        isFilled(record.dinner) ||
        isFilled(record.snack) ||
        isFilled(record.afternoonSnack) ||
        isFilled(record.eveningSnack) ||
        isFilled(record.legacySnack) ||
        isFilled(record.extraMeal) ||
        isFilled(record.dietNote) ||
        (isFilled(record.dietStatus) &&
          !['未记录', 'unrecorded'].includes(record.dietStatus)) ||
        isFilled(record.加餐)),
  )
}

export function hasBodyRecord(record) {
  if (!record) return false

  return Boolean(
    isFilled(record.weight) ||
      isFilled(record.bedTime) ||
      isFilled(record.wakeTime) ||
      isFilled(record.sleepHours) ||
      hasBodyDiet(record) ||
      isFilled(getExerciseValue(record)) ||
      getRelapseStatus(record) !== 'unrecorded' ||
      (Array.isArray(record.relapseTypes) && record.relapseTypes.length > 0) ||
      isFilled(record.relapseNote) ||
      isFilled(record.note),
  )
}

export function calculateBattleScore({ taskScore, bodyScore, operationScore }) {
  return clampScore(taskScore * 0.45 + bodyScore * 0.3 + operationScore * 0.25)
}

export function hasReviewCore(record) {
  if (!record) return false

  return Boolean(
    isFilled(record.valuableThing) ||
      isFilled(record.importantThing) ||
      isFilled(record.stupidThing) ||
      isFilled(record.unfinishedReason) ||
      isFilled(record.tomorrowTop3) ||
      isFilled(record.biggestRisk),
  )
}

export function hasReviewRecord(record) {
  if (!record) return false

  return Boolean(hasReviewCore(record) || (record.discipline && record.discipline !== '未记录'))
}

export function isReviewComplete(record) {
  if (!record) return false

  return Boolean(
    String(record.importantThing || record.valuableThing || '').trim() &&
      String(record.tomorrowTop3 || '').trim(),
  )
}

export function applyTaskAutomation(tasks, { operationSummary, bodyRecord, reviewRecord }) {
  return tasks.map((task) => {
    let autoManaged = true
    let autoDone = false

    switch (task.title) {
      case '记录今日运营数据':
        autoDone = operationSummary.recordCount > 0
        break
      case '两店铺各发布 1 条商品':
        autoDone = operationSummary.publishCount >= 2
        break
      case '养号 10 分钟':
        autoDone = operationSummary.warmedCount > 0
        break
      case '记录体重':
        autoDone = isFilled(bodyRecord?.weight)
        break
      case '记录睡眠':
        autoDone = isFilled(bodyRecord?.sleepHours)
        break
      case '完成俯卧撑、步行、跑步机或羽毛球中的任意一种':
        autoDone = Boolean(isFilled(getExerciseValue(bodyRecord)))
        break
      case '记录今天饮食':
        autoDone = hasBodyDiet(bodyRecord)
        break
      case '填写每日复盘':
        autoDone = hasReviewCore(reviewRecord)
        break
      case '记录今日自律状态':
      case '记录是否破戒、摆烂、熬夜或拖延':
        autoDone = Boolean((reviewRecord?.discipline && reviewRecord.discipline !== '未记录') || getRelapseStatus(bodyRecord) !== 'unrecorded')
        break
      default:
        autoManaged = false
        break
    }

    return {
      ...task,
      autoManaged,
      autoDone,
      done: autoManaged ? autoDone : Boolean(task.done),
    }
  })
}

export function calculateFinanceTotal(assets) {
  return assets.reduce((total, asset) => total + toNumber(asset.amount), 0)
}

export function getAssetStatus(asset, total) {
  const ratio = total ? (toNumber(asset.amount) / total) * 100 : 0
  const lower = toNumber(asset.lower)
  const upper = toNumber(asset.upper)

  if (upper > 0 && ratio > upper) {
    return { ratio, status: '偏高', action: '控制仓位', tone: 'danger' }
  }

  if (lower > 0 && ratio < lower) {
    return { ratio, status: '偏低', action: '补充关注', tone: 'warning' }
  }

  return { ratio, status: '正常', action: '观察', tone: 'success' }
}

export function getFinanceAlerts(assets) {
  const total = calculateFinanceTotal(assets)

  return assets
    .map((asset) => ({ asset, ...getAssetStatus(asset, total) }))
    .filter((item) => item.status === '偏高')
}

export function getFinanceStatusSummary(assets) {
  const total = calculateFinanceTotal(assets)
  const rows = assets.map((asset) => ({ ...asset, ...getAssetStatus(asset, total) }))

  return {
    total,
    rows,
    highCount: rows.filter((row) => row.status === '偏高').length,
    lowCount: rows.filter((row) => row.status === '偏低').length,
    normalCount: rows.filter((row) => row.status === '正常').length,
  }
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(toNumber(value))
}

export function formatPercent(value) {
  return `${toNumber(value).toFixed(1)}%`
}
