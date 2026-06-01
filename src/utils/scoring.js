export function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function isFilled(value) {
  return String(value ?? '').trim() !== ''
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
  if (summary.publishCount > 0) score += 35
  if (summary.inquiries > 0) score += 25
  if (summary.wechat > 0) score += 20
  if (summary.deals > 0) score += 20
  return clampScore(score)
}

export function getOperationDiagnosis(summary) {
  if (summary.publishCount === 0) {
    return '当天没有发布，现金流动作不足，先上架，不要研究半天。'
  }

  if (summary.exposure < 50) {
    return '曝光低，优先改标题、封面和关键词。'
  }

  if (summary.inquiries === 0) {
    return '有曝光没咨询，商品入口和卖点不够尖。'
  }

  if (summary.wechat === 0) {
    return '有咨询没加微，私信话术太软，需要更直接地要资料。'
  }

  if (summary.deals === 0) {
    return '有加微没成交，报价、案例和信任证明需要补强。'
  }

  return '今天有成交，复盘成交来源，把这条路径复制十遍。'
}

export function calculateBodyScore(record) {
  if (!record) return 0

  let score = 0
  if (toNumber(record.sleepHours) >= 7) score += 30
  if (isFilled(record.exercise) && record.exercise !== '未记录') score += 30
  if (String(record.weight || '').trim()) score += 10
  if (String(record.lunch || record.dinner || record.snack || '').trim()) score += 20
  if (String(record.note || '').trim()) score += 10

  return clampScore(score)
}

export function hasBodyDiet(record) {
  return Boolean(record && (isFilled(record.lunch) || isFilled(record.dinner) || isFilled(record.snack)))
}

export function hasBodyRecord(record) {
  if (!record) return false

  return Boolean(
    isFilled(record.weight) ||
      isFilled(record.bedTime) ||
      isFilled(record.wakeTime) ||
      isFilled(record.sleepHours) ||
      hasBodyDiet(record) ||
      (isFilled(record.exercise) && record.exercise !== '未记录') ||
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
    String(record.valuableThing || '').trim() &&
      String(record.tomorrowTop3 || '').trim() &&
      record.discipline &&
      record.discipline !== '未记录',
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
        autoDone = Boolean(isFilled(bodyRecord?.exercise) && bodyRecord.exercise !== '未记录')
        break
      case '记录今天饮食':
        autoDone = hasBodyDiet(bodyRecord)
        break
      case '填写每日复盘':
        autoDone = hasReviewCore(reviewRecord)
        break
      case '记录是否破戒、摆烂、熬夜或拖延':
        autoDone = Boolean(reviewRecord?.discipline && reviewRecord.discipline !== '未记录')
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
