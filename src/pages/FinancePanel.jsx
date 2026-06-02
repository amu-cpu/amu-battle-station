import { Download, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Card from '../components/Card'
import Input from '../components/Input'
import ScoreCard from '../components/ScoreCard'
import { calculateFinanceTotal, formatCurrency, formatPercent, getAssetStatus, toNumber } from '../utils/scoring'

const emptyAsset = {
  name: '',
  amount: 0,
  target: 0,
  lower: 0,
  upper: 0,
  note: '',
}

const numberFields = ['amount', 'target', 'lower', 'upper']

function localDateKey() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

export default function FinancePanel({ assets, setAssets, privacyMode, setPrivacyMode }) {
  const [form, setForm] = useState(emptyAsset)
  const [emotionVisible, setEmotionVisible] = useState(false)
  const [editingCell, setEditingCell] = useState(null)
  const [saveNotice, setSaveNotice] = useState('')
  const noticeTimerRef = useRef(null)
  const cancelBlurRef = useRef(false)
  const total = calculateFinanceTotal(assets)
  const rows = useMemo(
    () => assets.map((asset, index) => ({ ...asset, __index: index, ...getAssetStatus(asset, total) })),
    [assets, total],
  )
  const highCount = rows.filter((row) => row.status === '偏高').length
  const lowCount = rows.filter((row) => row.status === '偏低').length
  const moneyText = (value) => (privacyMode ? '****' : formatCurrency(value))

  function showSavedNotice() {
    setSaveNotice('已保存')
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setSaveNotice(''), 1400)
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
    setAssets((current) => [...current, { ...payload, id: `asset-${Date.now()}` }])
    resetForm()
  }

  function deleteAsset(assetIndex) {
    setAssets((current) => current.filter((_, index) => index !== assetIndex))
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
    const confirmed = window.confirm('导出 Excel 将包含全部资产真实金额，是否继续？')
    if (!confirmed) return

    const detailRows = rows.map((row) => ({
      资产名称: row.name || '',
      当前金额: toNumber(row.amount),
      当前占比: formatPercent(row.ratio),
      目标占比: formatPercent(row.target),
      下限: formatPercent(row.lower),
      上限: formatPercent(row.upper),
      状态: row.status,
      操作提示: row.action,
      备注: row.note || '',
    }))

    const summaryRows = [
      {
        导出日期: localDateKey(),
        总资产: total,
        资产数量: assets.length,
        正常资产数量: rows.filter((row) => row.status === '正常').length,
        偏高资产数量: highCount,
        偏低资产数量: lowCount,
        隐私模式状态: privacyMode ? '已开启' : '已关闭',
        说明: '本文件只从当前浏览器本地数据导出，不会上传到外部服务。',
      },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), '资金状态明细')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), '资金汇总')
    XLSX.writeFile(workbook, `amu-finance-radar-${localDateKey()}.xlsx`)
  }

  function renderEditableCell(row, field, displayValue, extraClassName = '') {
    const isEditing = editingCell?.assetIndex === row.__index && editingCell.field === field
    const disabled = field === 'amount' && privacyMode

    if (isEditing) {
      return (
        <td className={`py-2 pr-3 ${extraClassName}`}>
          <input
            autoFocus
            type={numberFields.includes(field) ? 'number' : 'text'}
            min={numberFields.includes(field) ? '0' : undefined}
            step={numberFields.includes(field) ? '0.1' : undefined}
            value={editingCell.value}
            onChange={(event) => setEditingCell((current) => ({ ...current, value: event.target.value }))}
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
      <td className={`py-2 pr-3 ${extraClassName}`}>
        <button
          type="button"
          onClick={() => startCellEdit(row, field)}
          disabled={disabled}
          className={`w-full rounded-md px-2 py-2 text-left transition ${
            disabled ? 'cursor-default text-slate-700' : 'hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200'
          }`}
          title={disabled ? '隐私模式下金额不可编辑，先点击显示金额' : '点击编辑'}
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
            <h1 className="mt-2 text-3xl font-black text-slate-950">只做记录和提醒，不给投资建议</h1>
            <p className="mt-2 text-sm text-slate-600">根据你手动填写的金额和上下限，判断仓位是否越界。</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:mt-1 sm:justify-end">
            <Button type="button" icon={Download} onClick={exportFinanceExcel}>
              导出完整资金状态 Excel
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ScoreCard label="总资产" value={moneyText(total)} detail="手动记录合计" tone="green" />
        <ScoreCard label="资产数量" value={assets.length} detail="可新增、点击表格编辑" />
        <ScoreCard label="偏高资产" value={highCount} detail="超过上限要控制" tone={highCount ? 'red' : 'green'} />
        <ScoreCard label="偏低资产" value={lowCount} detail="低于下限仅提醒关注" tone={lowCount ? 'yellow' : 'green'} />
      </div>

      <Card title="新增资产" eyebrow="Record">
        <form onSubmit={saveAsset} className="grid gap-3 xl:grid-cols-8">
          <Input label="资产名称" value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="例如：现金池" className="xl:col-span-2" />
          <Input
            label="当前金额"
            type={privacyMode ? 'password' : 'number'}
            min="0"
            value={form.amount}
            onChange={(event) => updateField('amount', event.target.value)}
            autoComplete="off"
          />
          <Input label="目标占比" type="number" min="0" step="0.1" value={form.target} onChange={(event) => updateField('target', event.target.value)} />
          <Input label="下限" type="number" min="0" step="0.1" value={form.lower} onChange={(event) => updateField('lower', event.target.value)} />
          <Input label="上限" type="number" min="0" step="0.1" value={form.upper} onChange={(event) => updateField('upper', event.target.value)} />
          <Input label="备注" value={form.note} onChange={(event) => updateField('note', event.target.value)} className="xl:col-span-6" />
          <div className="flex flex-wrap gap-2 xl:col-span-2 xl:self-end">
            <Button type="submit" variant="primary" icon={Plus}>
              新增资产
            </Button>
          </div>
        </form>
      </Card>

      <Card
        title="仓位状态"
        eyebrow="Radar"
        action={
          <Button type="button" variant="ghost" onClick={() => setEmotionVisible((value) => !value)}>
            禁止情绪化操作
          </Button>
        }
      >
        {emotionVisible ? (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            今天情绪波动时，不做买卖决定。
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">资产</th>
                <th className="py-2 pr-3">金额</th>
                <th className="py-2 pr-3">当前占比</th>
                <th className="py-2 pr-3">目标</th>
                <th className="py-2 pr-3">下限</th>
                <th className="py-2 pr-3">上限</th>
                <th className="py-2 pr-3">状态</th>
                <th className="py-2 pr-3">操作提示</th>
                <th className="py-2 pr-3">备注</th>
                <th className="py-2 pr-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id || `${row.name}-${row.__index}`} className="align-top hover:bg-slate-50/50">
                  {renderEditableCell(row, 'name', row.name || '-', 'font-semibold text-slate-900')}
                  {renderEditableCell(row, 'amount', privacyMode ? '****' : formatCurrency(row.amount))}
                  <td className="py-3 pr-3">{formatPercent(row.ratio)}</td>
                  {renderEditableCell(row, 'target', formatPercent(row.target))}
                  {renderEditableCell(row, 'lower', formatPercent(row.lower))}
                  {renderEditableCell(row, 'upper', formatPercent(row.upper))}
                  <td className="py-3 pr-3">
                    <Badge tone={row.tone}>{row.status}</Badge>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge tone={row.tone}>{row.action}</Badge>
                  </td>
                  {renderEditableCell(row, 'note', row.note || '-', 'max-w-72 text-slate-600')}
                  <td className="py-3 pr-3">
                    <button
                      type="button"
                      onClick={() => deleteAsset(row.__index)}
                      className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                      aria-label="删除资产"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
