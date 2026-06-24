import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Lock,
  Plus,
  ShieldAlert,
  Trash2,
  WalletCards,
} from 'lucide-react'
import { Fragment, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Card from '../components/Card'
import Input from '../components/Input'
import {
  formatCurrency,
  formatPercent,
  getAssetStatus,
  toNumber,
} from '../utils/scoring'
import {
  createProjectBackupPayload,
  restoreProjectBackupPayload,
} from '../utils/storage'

const FINANCE_ACTION_LOG_KEY = 'amu-battle-station:finance-action-log'

const emptyAsset = {
  name: '',
  amount: 0,
  target: 0,
  lower: 0,
  upper: 0,
  note: '',
}

const numberFields = ['amount', 'target', 'lower', 'upper']

const actionLevels = {
  must: {
    icon: '🔴',
    label: '需人工操作',
    rank: 1,
    bg: 'var(--action-red-bg)',
    text: 'var(--action-red-text)',
  },
  cash: {
    icon: '🔴',
    label: '请补现金池',
    rank: 2,
    bg: 'var(--action-red-bg)',
    text: 'var(--action-red-text)',
  },
  cooldown: {
    icon: '🔒',
    label: '禁止重复卖出',
    rank: 3,
    bg: 'var(--action-red-bg)',
    text: 'var(--action-red-text)',
  },
  attention: {
    icon: '🟠',
    label: '需要关注',
    rank: 4,
    bg: 'var(--action-orange-bg)',
    text: 'var(--action-orange-text)',
  },
  normal: {
    icon: '✅',
    label: '正常',
    rank: 9,
    bg: 'var(--action-green-bg)',
    text: 'var(--action-green-text)',
  },
  neutral: {
    icon: '✅',
    label: '无需操作',
    rank: 10,
    bg: 'var(--action-gray-bg)',
    text: 'var(--action-gray-text)',
  },
}

const assetRules = [
  {
    key: 'cash',
    match: ['余额宝', '现金池', '现金账户', '现金'],
    category: 'cash',
    lower: 5,
    target: 7,
    upper: 10,
    type: 'cash',
  },
  {
    key: 'chip',
    match: ['芯片', '芯片ETF', '半导体'],
    category: 'equity',
    lower: 4,
    target: 6,
    observe: 8,
    upper: 10,
    hardTrigger: 10.5,
    type: 'chip',
    fallbackCooldown: {
      active: true,
      remainingText: '10 个交易日内',
      reason: '近期已卖出，处于冷静期',
    },
  },
  {
    key: 'baijiu',
    match: ['白酒'],
    category: 'equity',
    lower: 10,
    target: 15,
    upper: 20,
    hardTrigger: 20.5,
    type: 'baijiu',
  },
  {
    key: 'coal',
    match: ['煤炭', '煤炭ETF'],
    category: 'equity',
    lower: 2,
    target: 3,
    upper: 6,
    type: 'coal',
  },
  {
    key: 'hstech',
    match: ['恒生科技', '恒科'],
    category: 'equity',
    lower: 2,
    target: 4,
    upper: 6,
    type: 'hstech',
  },
  {
    key: 'gold',
    match: ['黄金'],
    category: 'high-volatility',
    lower: 6,
    target: 8,
    upper: 10,
    hardTrigger: 10.5,
    type: 'gold',
  },
  {
    key: 'dividend',
    match: ['红利'],
    category: 'equity',
    type: 'generic',
  },
  {
    key: 'nasdaq',
    match: ['纳斯达克', '纳指', 'NASDAQ'],
    category: 'equity',
    type: 'generic',
  },
  {
    key: 'bond',
    match: ['短债', '90天债', '同业存单', '债'],
    category: 'stable',
    type: 'generic',
  },
]

function localDateKey() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localStamp() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}`
}

function parseCellValue(field, value) {
  if (field === 'name') {
    const name = String(value).trim()
    return name ? { ok: true, value: name } : { ok: false }
  }

  if (numberFields.includes(field)) {
    const nextValue = value === '' ? 0 : Number(value)
    return { ok: true, value: Number.isFinite(nextValue) ? nextValue : 0 }
  }

  return { ok: true, value }
}

function triggerDownload(fileName, content, mimeType = 'application/json') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function calculateTotalAssets(assets) {
  return Array.isArray(assets)
    ? assets.reduce((total, asset) => total + toNumber(asset?.amount), 0)
    : 0
}

function calculateCurrentPercent(asset, total) {
  return total > 0 ? (toNumber(asset?.amount) / total) * 100 : 0
}

function calculateCashGap(total, cashAmount) {
  const targetAmount = total * 0.05
  return Math.max(0, targetAmount - toNumber(cashAmount))
}

function normalizedText(value) {
  return String(value || '').toLowerCase()
}

function getAssetRule(asset) {
  const name = normalizedText(asset?.name)
  return (
    assetRules.find((rule) =>
      rule.match.some((keyword) => name.includes(normalizedText(keyword))),
    ) || {
      key: 'generic',
      category: getFallbackCategory(asset),
      type: 'generic',
    }
  )
}

function getFallbackCategory(asset) {
  const name = normalizedText(asset?.name)
  if (['现金', '余额宝', '货币'].some((keyword) => name.includes(keyword))) {
    return 'cash'
  }
  if (['债', '存单', '稳健'].some((keyword) => name.includes(keyword))) {
    return 'stable'
  }
  return 'equity'
}

function getRuleValue(asset, rule, field) {
  if (rule?.type === 'cash' && ['lower', 'target', 'upper'].includes(field)) {
    return toNumber(rule?.[field])
  }

  const raw = asset?.[field]
  const value = toNumber(raw)
  return raw !== undefined && raw !== null && String(raw).trim() !== ''
    ? value
    : toNumber(rule?.[field])
}

function getEffectiveBounds(asset, rule) {
  return {
    lower: getRuleValue(asset, rule, 'lower'),
    target: getRuleValue(asset, rule, 'target'),
    upper: getRuleValue(asset, rule, 'upper'),
    observe: toNumber(rule?.observe),
    hardTrigger: toNumber(rule?.hardTrigger),
  }
}

function getDistanceToBoundary(asset, total) {
  const rule = getAssetRule(asset)
  const ratio = calculateCurrentPercent(asset, total)
  const { lower, target, upper } = getEffectiveBounds(asset, rule)

  if (!lower && !upper) return '规则未配置'
  if (lower && ratio < lower) return `低下限 ${(lower - ratio).toFixed(1)}%`
  if (upper && ratio > upper) return `超上限 ${(ratio - upper).toFixed(1)}%`
  if (target && Math.abs(ratio - target) <= 0.6) return '接近目标'

  const lowerDistance = lower ? ratio - lower : Number.POSITIVE_INFINITY
  const upperDistance = upper ? upper - ratio : Number.POSITIVE_INFINITY
  if (upperDistance <= lowerDistance) return `距上限 ${upperDistance.toFixed(1)}%`
  return `距下限 ${lowerDistance.toFixed(1)}%`
}

function daysBetween(dateText, now = new Date()) {
  const date = new Date(dateText)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000))
}

function getCooldownStatus(asset, rule = getAssetRule(asset)) {
  const cooldownDays = toNumber(asset?.cooldownDays)
  const elapsedDays = asset?.lastSellDate ? daysBetween(asset.lastSellDate) : null

  if (cooldownDays > 0 && elapsedDays !== null && elapsedDays < cooldownDays) {
    const remaining = Math.max(0, cooldownDays - elapsedDays)
    return {
      active: true,
      label: '冷静期中',
      remainingText: `剩余 ${remaining} 天`,
      reason: asset.cooldownReason || '近期已卖出',
    }
  }

  if (asset?.cooldownReason) {
    return {
      active: true,
      label: '冷静期中',
      remainingText: cooldownDays ? `共 ${cooldownDays} 天` : '规则未设天数',
      reason: asset.cooldownReason,
    }
  }

  if (rule?.fallbackCooldown?.active) {
    return {
      label: '冷静期中',
      ...rule.fallbackCooldown,
    }
  }

  return {
    active: false,
    label: '—',
    remainingText: '—',
    reason: '',
  }
}

function formatGap(value, privacyMode) {
  return privacyMode ? '****' : formatCurrency(value)
}

function makeEvaluation({
  actionLevel = 'normal',
  triggerReason = '按计划执行',
  nextAction = '不动',
  investmentGear = '无需关注',
  attentionLevel = '无需关注',
  status = '正常',
  tone = 'success',
}) {
  return {
    actionLevel,
    triggerReason,
    nextAction,
    investmentGear,
    attentionLevel,
    status,
    tone,
  }
}

function evaluateCashAsset(row, context) {
  const ratio = row.ratio
  const gapText = formatGap(context.cashGap, context.privacyMode)

  if (ratio < 3) {
    return makeEvaluation({
      actionLevel: 'must',
      triggerReason: '现金池严重低于 5%下限',
      nextAction: `优先补现金池，缺口约 ${gapText}`,
      investmentGear: '补现金池',
      attentionLevel: '今日处理',
      status: '现金不足',
      tone: 'danger',
    })
  }

  if (ratio < 5) {
    return makeEvaluation({
      actionLevel: 'cash',
      triggerReason: '低于 5%现金池下限',
      nextAction: `优先补现金池，缺口约 ${gapText}`,
      investmentGear: '补现金池',
      attentionLevel: '今日处理',
      status: '现金不足',
      tone: 'info',
    })
  }

  if (ratio < 7) {
    return makeEvaluation({
      actionLevel: 'attention',
      triggerReason: '现金池处于 5%—7%偏低区',
      nextAction: '不动，后续现金流优先补现金池',
      investmentGear: '正常偏低',
      attentionLevel: '本周观察',
      status: '偏低',
      tone: 'warning',
    })
  }

  if (ratio > 10) {
    return makeEvaluation({
      triggerReason: '现金充足，可作为子弹池',
      nextAction: '不动',
      investmentGear: '现金充足',
      attentionLevel: '无需关注',
    })
  }

  return makeEvaluation({
    triggerReason: '现金池处于目标区间',
    nextAction: '不动',
    investmentGear: '正常',
  })
}

function evaluateChipAsset(row) {
  const ratio = row.ratio
  const cooldown = row.cooldown
  const hardTrigger = getHardTrigger(row)

  if (ratio >= hardTrigger && hardTrigger > 0) {
    return makeEvaluation({
      actionLevel: 'must',
      triggerReason: `超过硬触发线 ${formatPercent(hardTrigger)}`,
      nextAction: '超过硬触发线才允许卖出，先压回区间',
      investmentGear: '月末再平衡候选',
      attentionLevel: '今日处理',
      status: '硬触发',
      tone: 'danger',
    })
  }

  if (cooldown.active) {
    return makeEvaluation({
      actionLevel: 'cooldown',
      triggerReason: `${cooldown.reason}，${cooldown.remainingText}`,
      nextAction:
        ratio >= 8
          ? '冷静期内禁止重复卖出；定投降速到 50/天'
          : '冷静期内禁止重复卖出；按计划执行',
      investmentGear: ratio >= 8 ? '冷静期 / 降速定投' : '冷静期',
      attentionLevel: '今日处理',
      status: '冷静期',
      tone: 'info',
    })
  }

  if (ratio < 4) {
    return makeEvaluation({
      actionLevel: 'attention',
      triggerReason: '低于 4%下限',
      nextAction: '加速定投',
      investmentGear: '加速定投',
      attentionLevel: '本周观察',
      status: '偏低',
      tone: 'warning',
    })
  }

  if (ratio < 8) {
    return makeEvaluation({
      triggerReason: '处于 4%—8%正常区',
      nextAction: '继续 100/天',
      investmentGear: '正常定投',
    })
  }

  if (ratio < 10) {
    return makeEvaluation({
      actionLevel: 'attention',
      triggerReason: '处于 8%—10%降速区',
      nextAction: '降速到 50/天，不卖',
      investmentGear: '降速定投',
      attentionLevel: '今日关注',
      status: '偏高',
      tone: 'warning',
    })
  }

  return makeEvaluation({
    actionLevel: 'attention',
    triggerReason: '达到 10%上限区',
    nextAction: '月末再平衡日再看',
    investmentGear: '月末再平衡候选',
    attentionLevel: '月度观察',
    status: '偏高',
    tone: 'warning',
  })
}

function evaluateBaijiuAsset(row) {
  const ratio = row.ratio
  const hardTrigger = getHardTrigger(row)

  if (ratio >= hardTrigger && hardTrigger > 0) {
    return makeEvaluation({
      actionLevel: 'must',
      triggerReason: `超过硬触发线 ${formatPercent(hardTrigger)}`,
      nextAction: '可考虑卖出压回区间',
      investmentGear: '月末再平衡候选',
      attentionLevel: '今日处理',
      status: '硬触发',
      tone: 'danger',
    })
  }

  if (ratio >= 20) {
    return makeEvaluation({
      actionLevel: 'attention',
      triggerReason: '达到 20%上限区',
      nextAction: '月末再平衡日再看',
      investmentGear: '月末再平衡候选',
      attentionLevel: '月度观察',
      status: '偏高',
      tone: 'warning',
    })
  }

  if (ratio >= 18.5) {
    return makeEvaluation({
      actionLevel: 'attention',
      triggerReason: '高于 18.5%防抖线',
      nextAction: '暂停定投，不额外加仓',
      investmentGear: '暂停定投',
      attentionLevel: '今日关注',
      status: '偏高',
      tone: 'warning',
    })
  }

  if (ratio > 17.5) {
    return makeEvaluation({
      actionLevel: 'attention',
      triggerReason: '处于 17.5%—18.5%防抖区',
      nextAction: '保持上一次状态，不额外加仓',
      investmentGear: '保持上一次状态',
      attentionLevel: '本周观察',
      status: '正常偏高',
      tone: 'warning',
    })
  }

  return makeEvaluation({
    triggerReason: ratio < 10 ? '低于下限，先恢复节奏' : '回到目标附近',
    nextAction: '继续 40/天，不额外加仓',
    investmentGear: ratio < 10 ? '恢复定投' : '正常定投',
    attentionLevel: ratio < 10 ? '本周观察' : '无需关注',
    status: ratio < 10 ? '偏低' : '正常',
    tone: ratio < 10 ? 'warning' : 'success',
    actionLevel: ratio < 10 ? 'attention' : 'normal',
  })
}

function evaluateCoalAsset(row) {
  const ratio = row.ratio
  if (ratio < 2) {
    return makeEvaluation({
      actionLevel: 'attention',
      triggerReason: '低于 2%下限',
      nextAction: '加速到 150/天',
      investmentGear: '加速定投',
      attentionLevel: '本周观察',
      status: '偏低',
      tone: 'warning',
    })
  }
  if (ratio < 4) {
    return makeEvaluation({
      triggerReason: '处于 2%—4%正常区',
      nextAction: '继续 50/天',
      investmentGear: '正常定投',
    })
  }
  if (ratio < 6) {
    return makeEvaluation({
      actionLevel: 'attention',
      triggerReason: '处于 4%—6%偏高区',
      nextAction: '维持 30/天，不卖',
      investmentGear: '降速定投',
      attentionLevel: '今日关注',
      status: '偏高',
      tone: 'warning',
    })
  }
  return makeEvaluation({
    actionLevel: 'attention',
    triggerReason: '达到 6%上限区',
    nextAction: '暂停定投，月度再平衡日再看',
    investmentGear: '暂停定投',
    attentionLevel: '月度观察',
    status: '偏高',
    tone: 'warning',
  })
}

function evaluateHstechAsset(row) {
  const ratio = row.ratio
  if (ratio < 2) {
    return makeEvaluation({
      actionLevel: 'attention',
      triggerReason: '低于 2%下限',
      nextAction: '加速到 150/天',
      investmentGear: '加速定投',
      attentionLevel: '本周观察',
      status: '偏低',
      tone: 'warning',
    })
  }
  if (ratio < 4) {
    return makeEvaluation({
      triggerReason: '标准建仓区',
      nextAction: '继续 100/天',
      investmentGear: '正常定投',
    })
  }
  if (ratio < 6) {
    return makeEvaluation({
      actionLevel: 'attention',
      triggerReason: '处于 4%—6%降速区',
      nextAction: '降速到 50/天',
      investmentGear: '降速定投',
      attentionLevel: '今日关注',
      status: '偏高',
      tone: 'warning',
    })
  }
  return makeEvaluation({
    actionLevel: 'attention',
    triggerReason: '达到 6%上限区',
    nextAction: '暂停定投，月度再平衡日再看',
    investmentGear: '暂停定投',
    attentionLevel: '月度观察',
    status: '偏高',
    tone: 'warning',
  })
}

function evaluateGoldAsset(row) {
  const ratio = row.ratio
  const hardTrigger = getHardTrigger(row)
  if (ratio >= hardTrigger && hardTrigger > 0) {
    return makeEvaluation({
      actionLevel: 'must',
      triggerReason: `超过硬触发线 ${formatPercent(hardTrigger)}`,
      nextAction: '可考虑卖出压回区间',
      investmentGear: '月末再平衡候选',
      attentionLevel: '今日处理',
      status: '硬触发',
      tone: 'danger',
    })
  }
  if (ratio >= 10) {
    return makeEvaluation({
      actionLevel: 'attention',
      triggerReason: '达到 10%上限区',
      nextAction: '月末再平衡日再看',
      investmentGear: '月末再平衡候选',
      attentionLevel: '月度观察',
      status: '偏高',
      tone: 'warning',
    })
  }
  if (ratio >= 9) {
    return makeEvaluation({
      actionLevel: 'attention',
      triggerReason: '处于 9%—10%偏高区',
      nextAction: '降速或暂停',
      investmentGear: '降速定投',
      attentionLevel: '今日关注',
      status: '偏高',
      tone: 'warning',
    })
  }
  return makeEvaluation({
    triggerReason: ratio < 6 ? '低于下限' : '处于目标区间',
      nextAction: ratio < 6 ? '维持原计划，复核是否需要恢复配置' : '不动',
    investmentGear: ratio < 6 ? '恢复定投' : '正常',
    attentionLevel: ratio < 6 ? '本周观察' : '无需关注',
    status: ratio < 6 ? '偏低' : '正常',
    tone: ratio < 6 ? 'warning' : 'success',
    actionLevel: ratio < 6 ? 'attention' : 'normal',
  })
}

function evaluateGenericAsset(row) {
  const lower = getRuleLower(row)
  const upper = getRuleUpper(row)

  if (!lower && !upper) {
    return makeEvaluation({
      actionLevel: 'neutral',
      triggerReason: '规则未配置',
      nextAction: '补充上下限后再判断',
      investmentGear: '规则未配置',
      attentionLevel: '本周观察',
      status: '未配置',
      tone: 'neutral',
    })
  }

  if (upper && row.ratio >= upper + 0.5) {
    return makeEvaluation({
      actionLevel: 'must',
      triggerReason: '明显超过上限 0.5%以上',
      nextAction: '必须处理，先确认是否月末再平衡',
      investmentGear: '月末再平衡候选',
      attentionLevel: '今日处理',
      status: '硬触发',
      tone: 'danger',
    })
  }

  if (upper && row.ratio > upper) {
    return makeEvaluation({
      actionLevel: 'attention',
      triggerReason: '高于上限',
      nextAction: '月度再平衡候选',
      investmentGear: '月末再平衡候选',
      attentionLevel: '月度观察',
      status: '偏高',
      tone: 'warning',
    })
  }

  if (lower && row.ratio < lower) {
    return makeEvaluation({
      actionLevel: 'attention',
      triggerReason: '低于下限',
      nextAction: '低于下限，维持原计划并复核定投',
      investmentGear: '恢复定投',
      attentionLevel: '本周观察',
      status: '偏低',
      tone: 'warning',
    })
  }

  return makeEvaluation({
    triggerReason: '处于目标区间',
    nextAction: '不动',
    investmentGear: '无需关注',
  })
}

const ruleEvaluators = {
  cash: evaluateCashAsset,
  chip: evaluateChipAsset,
  baijiu: evaluateBaijiuAsset,
  coal: evaluateCoalAsset,
  hstech: evaluateHstechAsset,
  gold: evaluateGoldAsset,
  generic: evaluateGenericAsset,
}

function getActionLevel(row) {
  return row.actionLevel || 'normal'
}

function getNextAction(row) {
  return row.nextAction || '不动'
}

function getInvestmentGear(row) {
  return row.investmentGear || '无需关注'
}

function getAttentionLevel(row) {
  return row.attentionLevel || '无需关注'
}

function isEquityLike(row) {
  return ['equity', 'high-volatility'].includes(row.category)
}

function enrichFinanceRows(assets, total, context) {
  return assets.map((asset, index) => {
    const rule = getAssetRule(asset)
    const bounds = getEffectiveBounds(asset, rule)
    const ratio = calculateCurrentPercent(asset, total)
    const baseStatus = getAssetStatus(asset, total)
    const cooldown = getCooldownStatus(asset, rule)
    const rowBase = {
      ...asset,
      __index: index,
      rule,
      ruleKey: rule.key,
      category: rule.category,
      rawTarget: toNumber(asset?.target),
      rawLower: toNumber(asset?.lower),
      rawUpper: toNumber(asset?.upper),
      ratio,
      ruleLower: bounds.lower,
      ruleTarget: bounds.target,
      ruleUpper: bounds.upper,
      ruleObserve: bounds.observe,
      ruleHardTrigger: bounds.hardTrigger,
      ...baseStatus,
      cooldown,
      distanceToBoundary: getDistanceToBoundary(asset, total),
    }
    const evaluator = ruleEvaluators[rule.type] || evaluateGenericAsset
    const evaluation = evaluator(rowBase, context)

    return {
      ...rowBase,
      ...evaluation,
      actionLevel: getActionLevel(evaluation),
      nextAction: getNextAction(evaluation),
      investmentGear: getInvestmentGear(evaluation),
      attentionLevel: getAttentionLevel(evaluation),
    }
  })
}

function getCashAsset(rows) {
  return rows.find((row) => row.category === 'cash') || null
}

function getActionItems(rows) {
  return rows
    .filter((row) => row.actionLevel !== 'normal' && row.actionLevel !== 'neutral')
    .sort((a, b) => {
      const aRank = actionLevels[a.actionLevel]?.rank || 99
      const bRank = actionLevels[b.actionLevel]?.rank || 99
      if (aRank !== bRank) return aRank - bRank
      if (a.actionLevel === 'cooldown' && b.actionLevel !== 'cooldown') return -1
      if (b.actionLevel === 'cooldown' && a.actionLevel !== 'cooldown') return 1
      return b.ratio - a.ratio
    })
}

function getEquityRatio(rows) {
  return rows
    .filter(isEquityLike)
    .reduce((total, row) => total + row.ratio, 0)
}

function getRuleLower(row) {
  return toNumber(row.ruleLower)
}

function getRuleTarget(row) {
  return toNumber(row.ruleTarget)
}

function getRuleUpper(row) {
  return toNumber(row.ruleUpper)
}

function getHardTrigger(row) {
  return toNumber(row.ruleHardTrigger)
}

function ActionBadge({ level }) {
  const config = actionLevels[level] || actionLevels.neutral
  return (
    <span
      className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-black"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </span>
  )
}

function RadarMetricCard({ label, value, detail, level = 'neutral', icon: Icon }) {
  const config = actionLevels[level] || actionLevels.neutral
  return (
    <div
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      style={{
        backgroundColor: level === 'neutral' ? '#fff' : config.bg,
        color: level === 'neutral' ? undefined : config.text,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-600">{label}</p>
        {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      </div>
      <p className="mt-2 text-2xl font-black leading-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm font-semibold text-slate-600">{detail}</p>
    </div>
  )
}

function getRowStyle(row) {
  if (row.actionLevel === 'must') return { backgroundColor: 'rgba(254, 226, 226, 0.42)' }
  if (row.actionLevel === 'cash') return { backgroundColor: 'rgba(254, 226, 226, 0.38)' }
  if (row.actionLevel === 'cooldown') return { backgroundColor: 'rgba(254, 226, 226, 0.3)' }
  return {}
}

function getActionSummaryLevel(rows) {
  if (rows.some((row) => ['must', 'cash', 'cooldown'].includes(row.actionLevel))) {
    return 'must'
  }
  return rows.length ? 'attention' : 'neutral'
}

function buildTodayDecision({ actionItems, cashGap, cooldownCount }) {
  if (cashGap > 0 && cooldownCount > 0) {
    return '今日总判断：优先补现金池；冷静期资产禁止重复卖出；其余资产按计划观察。'
  }
  if (cashGap > 0) {
    return '今日总判断：优先补现金池，其余资产暂不操作。'
  }
  if (cooldownCount > 0) {
    return '今日总判断：冷静期内禁止重复操作，其他资产继续观察。'
  }
  if (actionItems.length > 0) {
    return '今日总判断：有资产需要关注，先看清单，不执行真实交易。'
  }
  return '今日总判断：今日无需操作，按计划执行即可。'
}

function readActionLog() {
  try {
    const value = window.localStorage.getItem(FINANCE_ACTION_LOG_KEY)
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeActionLog(records) {
  window.localStorage.setItem(FINANCE_ACTION_LOG_KEY, JSON.stringify(records))
}

function getStripeStyle(row) {
  const config = actionLevels[row.actionLevel] || actionLevels.neutral
  return { borderLeftColor: config.text }
}

export default function FinancePanel({
  assets,
  setAssets,
  privacyMode,
  setPrivacyMode,
}) {
  const [form, setForm] = useState(emptyAsset)
  const [formOpen, setFormOpen] = useState(false)
  const [emotionVisible, setEmotionVisible] = useState(false)
  const [editingCell, setEditingCell] = useState(null)
  const [expandedRow, setExpandedRow] = useState(null)
  const [tableMode, setTableMode] = useState('full')
  const [recordsOpen, setRecordsOpen] = useState(false)
  const [actionLog, setActionLog] = useState(() => readActionLog())
  const [saveNotice, setSaveNotice] = useState('')
  const [backupNotice, setBackupNotice] = useState('')
  const importInputRef = useRef(null)
  const noticeTimerRef = useRef(null)
  const backupNoticeTimerRef = useRef(null)
  const cancelBlurRef = useRef(false)
  const total = calculateTotalAssets(assets)
  const moneyText = (value) => (privacyMode ? '****' : formatCurrency(value))
  const rows = useMemo(() => {
    const cashAssetAmount = toNumber(
      (Array.isArray(assets)
        ? assets.find((asset) => getAssetRule(asset).category === 'cash')
        : null)?.amount,
    )
    const cashGap = calculateCashGap(total, cashAssetAmount)
    return enrichFinanceRows(assets, total, { cashGap, privacyMode })
  }, [assets, privacyMode, total])

  const cashAsset = getCashAsset(rows)
  const cashAmount = toNumber(cashAsset?.amount)
  const cashGap = calculateCashGap(total, cashAmount)
  const cashRatio = cashAsset ? cashAsset.ratio : 0
  const actionItems = getActionItems(rows)
  const cooldownCount = rows.filter((row) => row.cooldown.active).length
  const equityRatio = getEquityRatio(rows)
  const highCount = rows.filter((row) => row.status === '偏高').length
  const lowCount = rows.filter((row) => row.status === '偏低').length
  const actionSummaryLevel = getActionSummaryLevel(actionItems)
  const todayDecision = buildTodayDecision({
    actionItems,
    cashGap,
    cooldownCount,
  })
  const compactTable = tableMode === 'compact'

  function showSavedNotice() {
    setSaveNotice('已保存')
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setSaveNotice(''), 1400)
  }

  function showBackupNotice(message) {
    setBackupNotice(message)
    if (backupNoticeTimerRef.current) {
      window.clearTimeout(backupNoticeTimerRef.current)
    }
    backupNoticeTimerRef.current = window.setTimeout(
      () => setBackupNotice(''),
      2200,
    )
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: numberFields.includes(field) ? Number(value || 0) : value,
    }))
  }

  function resetForm() {
    setForm(emptyAsset)
  }

  function saveAsset(event) {
    event.preventDefault()
    const name = form.name.trim()
    if (!name) return

    const payload = { ...form, name }
    setAssets((current) => [
      ...current,
      { ...payload, id: `asset-${Date.now()}` },
    ])
    resetForm()
    setFormOpen(false)
  }

  function deleteAsset(assetIndex) {
    setAssets((current) => current.filter((_, index) => index !== assetIndex))
  }

  function markActionRead(row) {
    const record = {
      id: `finance-action-${row.__index}-${row.name}-${row.actionLevel}-${actionLog.length}`,
      createdAt: new Date().toISOString(),
      assetName: row.name || '',
      actionLevel: actionLevels[row.actionLevel]?.label || row.actionLevel,
      nextAction: row.nextAction,
      operationType: '标记已读',
    }
    const nextLog = [record, ...actionLog].slice(0, 80)
    setActionLog(nextLog)
    writeActionLog(nextLog)
    showBackupNotice('已标记为已读，仅用于本地记录。')
  }

  function startCellEdit(row, field) {
    if (field === 'amount' && privacyMode) return
    setEditingCell({
      assetIndex: row.__index,
      field,
      value: String(row[field] ?? ''),
    })
  }

  function cancelCellEdit() {
    cancelBlurRef.current = true
    setEditingCell(null)
  }

  function commitCellEdit() {
    if (!editingCell) return

    const parsed = parseCellValue(editingCell.field, editingCell.value)
    if (!parsed.ok) {
      setEditingCell(null)
      return
    }

    setAssets((current) =>
      current.map((asset, index) =>
        index === editingCell.assetIndex
          ? {
              ...asset,
              [editingCell.field]: parsed.value,
            }
          : asset,
      ),
    )
    setEditingCell(null)
    showSavedNotice()
  }

  function handleCellBlur() {
    if (cancelBlurRef.current) {
      cancelBlurRef.current = false
      return
    }

    commitCellEdit()
  }

  function exportFinanceExcel() {
    const confirmed = window.confirm(
      '导出 Excel 将包含全部资产真实金额，是否继续？',
    )
    if (!confirmed) return

    const detailRows = rows.map((row) => ({
      资产名称: row.name || '',
      当前金额: toNumber(row.amount),
      当前占比: formatPercent(row.ratio),
      目标占比: formatPercent(row.target),
      下限: formatPercent(row.lower),
      上限: formatPercent(row.upper),
      距边界: row.distanceToBoundary,
      当前档位: row.investmentGear,
      下一动作: row.nextAction,
      关注级别: row.attentionLevel,
      冷静期: row.cooldown.active
        ? `${row.cooldown.label}，${row.cooldown.remainingText}`
        : '—',
      状态: row.status,
      操作提示: row.nextAction,
      备注: row.note || '',
    }))

    const summaryRows = [
      {
        导出日期: localDateKey(),
        总资产: total,
        资产数量: assets.length,
        今日需动作: actionItems.length,
        冷静期资产: cooldownCount,
        权益仓占比: formatPercent(equityRatio),
        正常资产数量: rows.filter((row) => row.status === '正常').length,
        偏高资产数量: highCount,
        偏低资产数量: lowCount,
        隐私模式状态: privacyMode ? '已开启' : '已关闭',
        说明: '本文件只从当前浏览器本地数据导出，不会上传到外部服务。',
      },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(detailRows),
      '资金状态明细',
    )
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(summaryRows),
      '资金汇总',
    )
    XLSX.writeFile(workbook, `amu-finance-radar-${localDateKey()}.xlsx`)
  }

  function exportLocalBackup() {
    const payload = createProjectBackupPayload()
    triggerDownload(
      `amu-battle-station-localStorage-backup-${localStamp()}.json`,
      JSON.stringify(payload, null, 2),
    )
    showBackupNotice('已导出本地备份，请妥善保存。')
  }

  function handleImportBackup(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const confirmed = window.confirm(
      '导入会覆盖当前浏览器本地数据。请确认你已经导出备份。',
    )
    if (!confirmed) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || '{}'))
        restoreProjectBackupPayload(payload)
        window.location.reload()
      } catch (error) {
        console.error('Backup import failed:', error)
        window.alert('备份文件格式不正确，未导入。')
      }
    }
    reader.readAsText(file)
  }

  function renderEditableCell(
    row,
    field,
    displayValue,
    extraClassName = '',
    style,
  ) {
    const isEditing =
      editingCell?.assetIndex === row.__index && editingCell.field === field
    const disabled = field === 'amount' && privacyMode

    if (isEditing) {
      return (
        <td className={`py-2 pr-3 ${extraClassName}`} style={style}>
          <input
            autoFocus
            type={numberFields.includes(field) ? 'number' : 'text'}
            min={numberFields.includes(field) ? '0' : undefined}
            step={numberFields.includes(field) ? '0.1' : undefined}
            value={editingCell.value}
            onChange={(event) =>
              setEditingCell((current) => ({
                ...current,
                value: event.target.value,
              }))
            }
            onBlur={handleCellBlur}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitCellEdit()
              }

              if (event.key === 'Escape') {
                event.preventDefault()
                cancelCellEdit()
              }
            }}
            className="min-h-9 w-full min-w-24 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </td>
      )
    }

    return (
      <td className={`py-2 pr-3 ${extraClassName}`} style={style}>
        <button
          type="button"
          onClick={() => startCellEdit(row, field)}
          disabled={disabled}
          className={`w-full rounded-md px-2 py-2 text-left transition ${
            disabled
              ? 'cursor-default text-slate-700'
              : 'hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200'
          }`}
          title={
            disabled ? '隐私模式下金额不可编辑，先点击显示金额' : '点击编辑'
          }
        >
          {displayValue}
        </button>
      </td>
    )
  }

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">资金雷达台</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              今天要不要动，一眼看清
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              保留原始资产记录，在上方叠加动作提示层。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:mt-1 sm:justify-end">
            <Button type="button" icon={Download} onClick={exportFinanceExcel}>
              导出完整资金状态 Excel
            </Button>
            <Button type="button" variant="secondary" icon={Download} onClick={exportLocalBackup}>
              导出本地备份
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportBackup}
            />
            <Button
              type="button"
              variant="secondary"
              icon={Plus}
              onClick={() => importInputRef.current?.click()}
            >
              导入本地备份
            </Button>
            <Button
              type="button"
              variant={privacyMode ? 'primary' : 'secondary'}
              icon={privacyMode ? EyeOff : Eye}
              onClick={() => setPrivacyMode((value) => !value)}
            >
              {privacyMode ? '显示金额' : '隐藏金额'}
            </Button>
          </div>
        </div>
      </header>

      {saveNotice ? (
        <div className="fixed right-6 top-6 z-50 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 shadow-sm">
          {saveNotice}
        </div>
      ) : null}
      {backupNotice ? (
        <div className="fixed right-6 top-16 z-50 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-800 shadow-sm">
          {backupNotice}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <RadarMetricCard
          label="总资产"
          value={moneyText(total)}
          detail="手动记录合计"
          icon={WalletCards}
        />
        <RadarMetricCard
          label="即时现金占比"
          value={formatPercent(cashRatio)}
          detail={cashRatio < 5 ? '低于 5%，请补现金池' : '现金池可用'}
          level={cashRatio < 5 ? 'cash' : 'neutral'}
          icon={WalletCards}
        />
        <RadarMetricCard
          label="现金池缺口"
          value={cashGap > 0 ? formatGap(cashGap, privacyMode) : '已达标'}
          detail={cashGap > 0 ? '还差这笔补到 5%' : '不需要补现金池'}
          level={cashGap > 0 ? 'cash' : 'neutral'}
          icon={AlertTriangle}
        />
        <RadarMetricCard
          label="今日需动作"
          value={actionItems.length ? `${actionItems.length} 个` : '无需操作'}
          detail={actionItems.length ? '需要关注，先阅读清单' : '按计划执行'}
          level={actionSummaryLevel}
          icon={ShieldAlert}
        />
        <RadarMetricCard
          label="冷静期资产"
          value={`${cooldownCount} 个`}
          detail={cooldownCount ? '禁止重复卖出' : '暂无冷静期'}
          level={cooldownCount ? 'cooldown' : 'neutral'}
          icon={Lock}
        />
        <RadarMetricCard
          label="权益仓占比"
          value={formatPercent(equityRatio)}
          detail="股票/权益/高波动合计"
          icon={ShieldAlert}
        />
      </div>

      <Card title="今日动作清单" eyebrow="Action">
        <div
          className="mb-4 rounded-lg border p-3 text-sm font-black leading-6"
          style={{
            backgroundColor: actionLevels[actionSummaryLevel]?.bg,
            color: actionLevels[actionSummaryLevel]?.text,
          }}
        >
          {todayDecision}
        </div>
        {actionItems.length ? (
          <div className="space-y-3">
            {actionItems.map((row) => (
              <div
                key={row.id || `${row.name}-${row.__index}`}
                className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[minmax(160px,1fr)_150px_minmax(220px,1.1fr)_minmax(260px,1.35fr)_120px_120px]"
                style={getRowStyle(row)}
              >
                <div>
                  <p className="text-base font-black text-slate-950">{row.name || '-'}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    当前 {formatPercent(row.ratio)}
                  </p>
                </div>
                <ActionBadge level={row.actionLevel} />
                <p className="text-sm font-semibold leading-6 text-slate-700">
                  {row.triggerReason}
                </p>
                <p className="text-sm font-black leading-6 text-slate-950">
                  下一步：{row.nextAction}
                </p>
                <Badge tone={row.tone}>{row.attentionLevel}</Badge>
                <Button type="button" variant="secondary" onClick={() => markActionRead(row)}>
                  标记已读
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
            ✅ 今日无需操作，按计划执行。
          </div>
        )}
      </Card>

      <Card
        title="新增资产"
        eyebrow="Record"
        action={
          <Button
            type="button"
            variant={formOpen ? 'secondary' : 'primary'}
            icon={Plus}
            onClick={() => setFormOpen((value) => !value)}
          >
            {formOpen ? '收起新增' : '新增资产'}
          </Button>
        }
      >
        {formOpen ? (
          <form onSubmit={saveAsset} className="grid gap-3 xl:grid-cols-8">
            <Input
              label="资产名称"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="例如：现金池"
              className="xl:col-span-2"
            />
            <Input
              label="当前金额"
              type={privacyMode ? 'password' : 'number'}
              min="0"
              value={form.amount}
              onChange={(event) => updateField('amount', event.target.value)}
              autoComplete="off"
            />
            <Input
              label="目标占比"
              type="number"
              min="0"
              step="0.1"
              value={form.target}
              onChange={(event) => updateField('target', event.target.value)}
            />
            <Input
              label="下限"
              type="number"
              min="0"
              step="0.1"
              value={form.lower}
              onChange={(event) => updateField('lower', event.target.value)}
            />
            <Input
              label="上限"
              type="number"
              min="0"
              step="0.1"
              value={form.upper}
              onChange={(event) => updateField('upper', event.target.value)}
            />
            <Input
              label="备注"
              value={form.note}
              onChange={(event) => updateField('note', event.target.value)}
              className="xl:col-span-6"
            />
            <div className="flex flex-wrap gap-2 xl:col-span-2 xl:self-end">
              <Button type="submit" variant="primary" icon={Plus}>
                保存资产
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm font-semibold text-slate-500">
            不是每天新增资产，默认收起。需要时点击右上角按钮展开。
          </p>
        )}
      </Card>

      <Card
        title="持仓雷达表"
        eyebrow="Radar"
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant={compactTable ? 'primary' : 'secondary'}
              onClick={() =>
                setTableMode((current) => (current === 'full' ? 'compact' : 'full'))
              }
            >
              {compactTable ? '完整模式' : '简洁模式'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEmotionVisible((value) => !value)}
            >
              禁止情绪化操作
            </Button>
          </div>
        }
      >
        {emotionVisible ? (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            今天情绪波动时，不做买卖决定。
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className={`${compactTable ? 'min-w-[1120px]' : 'min-w-[1640px]'} w-full table-fixed border-collapse text-left text-sm`}>
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 [&>th]:whitespace-nowrap">
                <th className="w-[180px] py-2 pr-3">资产</th>
                <th className="w-[140px] py-2 pr-3">金额</th>
                <th className="w-[110px] py-2 pr-3">当前占比</th>
                {!compactTable ? <th className="w-[90px] py-2 pr-3">目标</th> : null}
                {!compactTable ? <th className="w-[90px] py-2 pr-3">下限</th> : null}
                {!compactTable ? <th className="w-[90px] py-2 pr-3">上限</th> : null}
                {!compactTable ? <th className="w-[130px] py-2 pr-3">距边界</th> : null}
                <th className="w-[140px] py-2 pr-3">当前档位</th>
                <th className="w-[280px] py-2 pr-3">下一动作</th>
                <th className="w-[150px] py-2 pr-3">关注级别</th>
                <th className="w-[170px] py-2 pr-3">冷静期</th>
                {!compactTable ? <th className="w-[220px] py-2 pr-3">备注</th> : null}
                <th className="w-[100px] py-2 pr-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const rowKey = row.id || `${row.name}-${row.__index}`
                const rowExpanded = expandedRow === rowKey
                return (
                  <Fragment key={rowKey}>
                    <tr
                      className="align-top hover:bg-slate-50/70"
                      style={getRowStyle(row)}
                    >
                      {renderEditableCell(
                        row,
                        'name',
                        row.name || '-',
                        'border-l-4 font-semibold text-slate-900',
                        getStripeStyle(row),
                      )}
                      {renderEditableCell(
                        row,
                        'amount',
                        privacyMode ? '****' : formatCurrency(row.amount),
                      )}
                      <td className="py-3 pr-3">{formatPercent(row.ratio)}</td>
                      {!compactTable ? renderEditableCell(row, 'target', formatPercent(row.target)) : null}
                      {!compactTable ? renderEditableCell(row, 'lower', formatPercent(row.lower)) : null}
                      {!compactTable ? renderEditableCell(row, 'upper', formatPercent(row.upper)) : null}
                      {!compactTable ? (
                        <td className="py-3 pr-3 font-semibold text-slate-700">
                          {row.distanceToBoundary}
                        </td>
                      ) : null}
                      <td className="py-3 pr-3">
                        <Badge tone={row.tone}>{row.investmentGear}</Badge>
                      </td>
                      <td className="max-w-72 py-3 pr-3 font-semibold leading-6 text-slate-800">
                        {row.nextAction}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="space-y-1">
                          <ActionBadge level={row.actionLevel} />
                          <p className="text-xs font-semibold text-slate-500">
                            {row.attentionLevel}
                          </p>
                        </div>
                      </td>
                      <td className="max-w-56 py-3 pr-3 text-slate-700">
                        {row.cooldown.active ? (
                          <span className="font-semibold">
                            {row.cooldown.label} · {row.cooldown.remainingText}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      {!compactTable
                        ? renderEditableCell(
                            row,
                            'note',
                            row.note || '-',
                            'max-w-64 text-slate-600',
                          )
                        : null}
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRow((current) =>
                                current === rowKey ? null : rowKey,
                              )
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            aria-label="展开规则"
                          >
                            {rowExpanded ? (
                              <ChevronDown className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAsset(row.__index)}
                            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                            aria-label="删除资产"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {rowExpanded ? (
                      <tr className="bg-slate-50">
                        <td colSpan={compactTable ? 8 : 13} className="px-4 py-3">
                          <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-3">
                            <p>
                              <span className="font-black text-slate-900">触发原因：</span>
                              {row.triggerReason}
                            </p>
                            <p>
                              <span className="font-black text-slate-900">规则：</span>
                              下限 {formatPercent(getRuleLower(row))} / 目标 {formatPercent(getRuleTarget(row))} / 上限 {formatPercent(getRuleUpper(row))}
                            </p>
                            <p>
                              <span className="font-black text-slate-900">冷静期：</span>
                              {row.cooldown.active
                                ? `${row.cooldown.reason}，${row.cooldown.remainingText}`
                                : '—'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="处理记录"
        eyebrow="Log"
        action={
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRecordsOpen((value) => !value)}
          >
            {recordsOpen ? '收起记录' : '展开记录'}
          </Button>
        }
      >
        {recordsOpen ? (
          actionLog.length ? (
            <div className="divide-y divide-slate-100">
              {actionLog.slice(0, 12).map((item) => (
                <div key={item.id} className="grid gap-2 py-3 text-sm md:grid-cols-[180px_160px_160px_1fr]">
                  <p className="font-semibold text-slate-500">
                    {new Date(item.createdAt).toLocaleString('zh-CN')}
                  </p>
                  <p className="font-black text-slate-900">{item.assetName || '-'}</p>
                  <p className="font-semibold text-slate-700">{item.operationType}</p>
                  <p className="font-semibold text-slate-600">
                    {item.actionLevel} · {item.nextAction}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-semibold text-slate-500">
              还没有处理记录。点击动作清单里的“标记已读”后会记录在这里。
            </p>
          )
        ) : (
          <p className="text-sm font-semibold text-slate-500">
            默认收起，只记录提醒已读情况，不执行真实交易。
          </p>
        )}
      </Card>

      <p className="text-sm font-semibold text-slate-500">
        本页只做记录和提醒，不执行真实交易。
      </p>
    </div>
  )
}
