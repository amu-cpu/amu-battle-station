import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Card from '../components/Card'
import Input from '../components/Input'
import ScoreCard from '../components/ScoreCard'
import { DEFAULT_SHOPS } from '../utils/defaults'
import { formatDateLabel } from '../utils/date'
import { formatCurrency } from '../utils/scoring'

const emptyForm = {
  date: '',
  shopName: DEFAULT_SHOPS[0],
  accountWarmed: false,
  publishCount: '',
  exposure: '',
  views: '',
  inquiries: '',
  wechat: '',
  deals: '',
  income: '',
  exceptionReason: '',
}

const numberFields = ['publishCount', 'exposure', 'views', 'inquiries', 'wechat', 'deals', 'income']
const inlineControlClass =
  'h-9 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200'

function normalizeNumberInput(value) {
  const cleaned = String(value).replace(/[^\d.]/g, '')
  if (!cleaned) return ''

  const [integerPart, ...decimalParts] = cleaned.split('.')
  const normalizedInteger = String(Number(integerPart || 0))

  if (!cleaned.includes('.')) return normalizedInteger

  return `${normalizedInteger}.${decimalParts.join('')}`
}

function toSavedNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function getRawRecordValue(record, field) {
  if (field === 'views') {
    return record.views ?? record.browse ?? record.viewCount ?? record.browseCount
  }

  return record[field]
}

function getRecordNumber(record, field) {
  return toSavedNumber(getRawRecordValue(record, field))
}

function recordToDraft(record) {
  return {
    shopName: record.shopName || DEFAULT_SHOPS[0],
    accountWarmed: Boolean(record.accountWarmed),
    publishCount: normalizeNumberInput(getRecordNumber(record, 'publishCount')),
    exposure: normalizeNumberInput(getRecordNumber(record, 'exposure')),
    views: normalizeNumberInput(getRecordNumber(record, 'views')),
    inquiries: normalizeNumberInput(getRecordNumber(record, 'inquiries')),
    wechat: normalizeNumberInput(getRecordNumber(record, 'wechat')),
    deals: normalizeNumberInput(getRecordNumber(record, 'deals')),
    income: normalizeNumberInput(getRecordNumber(record, 'income')),
    exceptionReason: record.exceptionReason || '',
  }
}

function draftToPayload(draft) {
  const payload = {
    shopName: String(draft.shopName || '').trim() || DEFAULT_SHOPS[0],
    accountWarmed: Boolean(draft.accountWarmed),
    exceptionReason: String(draft.exceptionReason || '').trim(),
  }

  numberFields.forEach((field) => {
    payload[field] = toSavedNumber(draft[field])
  })

  return payload
}

export default function XianyuPanel({
  selectedDate,
  records,
  setRecords,
  summary,
  operationScore,
  diagnosis,
}) {
  const [form, setForm] = useState({ ...emptyForm, date: selectedDate })
  const [editingRowId, setEditingRowId] = useState(null)
  const [draftRow, setDraftRow] = useState(null)
  const [focusField, setFocusField] = useState(null)
  const [saveNotice, setSaveNotice] = useState(false)
  const saveNoticeTimerRef = useRef(null)
  const todayRecords = records

  useEffect(
    () => () => {
      window.clearTimeout(saveNoticeTimerRef.current)
    },
    [],
  )

  function showSavedNotice() {
    window.clearTimeout(saveNoticeTimerRef.current)
    setSaveNotice(true)
    saveNoticeTimerRef.current = window.setTimeout(() => setSaveNotice(false), 1200)
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: numberFields.includes(field) ? normalizeNumberInput(value) : value,
    }))
  }

  function resetForm() {
    setForm({ ...emptyForm, date: selectedDate })
  }

  function saveRecord(event) {
    event.preventDefault()
    const payload = {
      ...draftToPayload(form),
      date: selectedDate,
    }

    setRecords((current) => [{ ...payload, id: `xianyu-${Date.now()}` }, ...current])
    resetForm()
  }

  function beginInlineEdit(record, field = 'shopName') {
    setEditingRowId(record.id)
    setDraftRow(recordToDraft(record))
    setFocusField(field)
  }

  function updateDraftField(field, value) {
    setDraftRow((current) => ({
      ...current,
      [field]: numberFields.includes(field) ? normalizeNumberInput(value) : value,
    }))
  }

  function cancelInlineEdit() {
    setEditingRowId(null)
    setDraftRow(null)
    setFocusField(null)
  }

  function saveInlineEdit() {
    if (!editingRowId || !draftRow) return

    const recordId = editingRowId
    const payload = draftToPayload(draftRow)

    setRecords((current) =>
      current.map((record) => (record.id === recordId ? { ...record, ...payload, id: record.id } : record)),
    )
    cancelInlineEdit()
    showSavedNotice()
  }

  function handleInlineBlur(event) {
    if (event.currentTarget.contains(event.relatedTarget)) return
    saveInlineEdit()
  }

  function handleInlineKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveInlineEdit()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      cancelInlineEdit()
    }
  }

  function deleteRecord(recordId) {
    if (editingRowId === recordId) {
      cancelInlineEdit()
    }

    setRecords((current) => current.filter((record) => record.id !== recordId))
  }

  function renderInlineControl(field) {
    const value = draftRow?.[field] ?? ''
    const autoFocus = focusField === field

    if (field === 'shopName') {
      return (
        <select
          value={value}
          onChange={(event) => updateDraftField(field, event.target.value)}
          className={inlineControlClass}
          autoFocus={autoFocus}
        >
          {DEFAULT_SHOPS.map((shop) => (
            <option key={shop} value={shop}>
              {shop}
            </option>
          ))}
        </select>
      )
    }

    if (field === 'accountWarmed') {
      return (
        <label className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => updateDraftField(field, event.target.checked)}
            className="h-4 w-4"
            autoFocus={autoFocus}
          />
          已养号
        </label>
      )
    }

    if (field === 'exceptionReason') {
      return (
        <input
          type="text"
          value={value}
          onChange={(event) => updateDraftField(field, event.target.value)}
          className={inlineControlClass}
          placeholder="没有异常就留空"
          autoFocus={autoFocus}
        />
      )
    }

    return (
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => updateDraftField(field, event.target.value)}
        className={`${inlineControlClass} text-right tabular-nums`}
        placeholder="0"
        autoFocus={autoFocus}
      />
    )
  }

  function renderEditableCell(record, field, content, { align = 'left', className = '' } = {}) {
    const isEditing = editingRowId === record.id
    const alignClass = align === 'right' ? 'text-right tabular-nums' : 'text-left'
    const buttonAlignClass = align === 'right' ? 'text-right' : 'text-left'

    return (
      <td className={`py-2 pr-3 ${alignClass} ${className}`}>
        {isEditing ? (
          renderInlineControl(field)
        ) : (
          <button
            type="button"
            onClick={() => beginInlineEdit(record, field)}
            className={`min-h-9 w-full rounded-md px-2 py-1.5 text-sm transition hover:bg-slate-50 ${buttonAlignClass}`}
          >
            {content}
          </button>
        )}
      </td>
    )
  }

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">闲鱼运营台 · {formatDateLabel(selectedDate)}</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">现金流动作不能断</h1>
        <p className="mt-2 text-sm text-slate-600">发布、曝光、浏览、咨询、加微、成交，今天有没有往前推，一眼看清。</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ScoreCard label="运营分" value={operationScore} detail="漏斗动作 + 养号" tone="cyan" />
        <ScoreCard label="发布" value={summary.publishCount} detail="今日商品数" />
        <ScoreCard label="曝光" value={summary.exposure} detail="入口是否有流量" />
        <ScoreCard label="浏览" value={summary.views} detail="曝光后是否有人点进来" />
        <ScoreCard label="咨询" value={summary.inquiries} detail="卖点是否够尖" />
        <ScoreCard label="加微" value={summary.wechat} detail="私信是否够直接" />
        <ScoreCard label="成交" value={summary.deals} detail="今天成交笔数" />
        <ScoreCard label="收入" value={formatCurrency(summary.income)} detail="今日收入" tone="green" />
      </div>

      <Card title="自动诊断" eyebrow="Diagnosis">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800">
          {diagnosis}
        </div>
      </Card>

      <Card title="新增运营记录" eyebrow="Record">
        <form onSubmit={saveRecord} className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-7">
            <Input label="日期" type="date" value={selectedDate} disabled />
            <Input as="select" label="发布账号" options={DEFAULT_SHOPS} value={form.shopName} onChange={(event) => updateField('shopName', event.target.value)} className="xl:col-span-2" />
            <Input label="发布数量" type="text" inputMode="decimal" value={form.publishCount} onChange={(event) => updateField('publishCount', event.target.value)} placeholder="0" />
            <Input label="曝光" type="text" inputMode="decimal" value={form.exposure} onChange={(event) => updateField('exposure', event.target.value)} placeholder="0" />
            <Input label="浏览量" type="text" inputMode="decimal" value={form.views} onChange={(event) => updateField('views', event.target.value)} placeholder="0" />
            <Input label="咨询" type="text" inputMode="decimal" value={form.inquiries} onChange={(event) => updateField('inquiries', event.target.value)} placeholder="0" />
          </div>
          <div className="grid gap-3 xl:grid-cols-7">
            <Input label="加微" type="text" inputMode="decimal" value={form.wechat} onChange={(event) => updateField('wechat', event.target.value)} placeholder="0" />
            <Input label="成交" type="text" inputMode="decimal" value={form.deals} onChange={(event) => updateField('deals', event.target.value)} placeholder="0" />
            <Input label="收入" type="text" inputMode="decimal" value={form.income} onChange={(event) => updateField('income', event.target.value)} placeholder="0" />
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 lg:self-end">
              <input
                type="checkbox"
                checked={form.accountWarmed}
                onChange={(event) => updateField('accountWarmed', event.target.checked)}
                className="h-4 w-4"
              />
              是否养号
            </label>
            <Input
              label="异常原因"
              className="xl:col-span-3"
              value={form.exceptionReason}
              onChange={(event) => updateField('exceptionReason', event.target.value)}
              placeholder="没有异常就留空"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" icon={Plus}>
              新增记录
            </Button>
          </div>
        </form>
      </Card>

      <Card
        title="今日运营记录"
        eyebrow="Today"
        action={editingRowId ? <Badge tone="warning">编辑运营记录</Badge> : saveNotice ? <Badge tone="success">已保存</Badge> : null}
      >
        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">发布账号</th>
                <th className="py-2 pr-3">是否养号</th>
                <th className="py-2 pr-3 text-right">发布</th>
                <th className="py-2 pr-3 text-right">曝光</th>
                <th className="py-2 pr-3 text-right">浏览</th>
                <th className="py-2 pr-3 text-right">咨询</th>
                <th className="py-2 pr-3 text-right">加微</th>
                <th className="py-2 pr-3 text-right">成交</th>
                <th className="py-2 pr-3 text-right">收入</th>
                <th className="py-2 pr-3">异常</th>
                <th className="py-2 pr-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {todayRecords.length ? (
                todayRecords.map((record) => {
                  const isEditing = editingRowId === record.id

                  return (
                    <tr
                      key={record.id}
                      className="align-top"
                      onBlurCapture={isEditing ? handleInlineBlur : undefined}
                      onKeyDown={isEditing ? handleInlineKeyDown : undefined}
                    >
                      {renderEditableCell(record, 'shopName', <span className="font-semibold text-slate-900">{record.shopName || DEFAULT_SHOPS[0]}</span>)}
                      {renderEditableCell(record, 'accountWarmed', record.accountWarmed ? <Badge tone="success">是</Badge> : <Badge>否</Badge>)}
                      {renderEditableCell(record, 'publishCount', getRecordNumber(record, 'publishCount'), { align: 'right' })}
                      {renderEditableCell(record, 'exposure', getRecordNumber(record, 'exposure'), { align: 'right' })}
                      {renderEditableCell(record, 'views', getRecordNumber(record, 'views'), { align: 'right' })}
                      {renderEditableCell(record, 'inquiries', getRecordNumber(record, 'inquiries'), { align: 'right' })}
                      {renderEditableCell(record, 'wechat', getRecordNumber(record, 'wechat'), { align: 'right' })}
                      {renderEditableCell(record, 'deals', getRecordNumber(record, 'deals'), { align: 'right' })}
                      {renderEditableCell(record, 'income', formatCurrency(getRecordNumber(record, 'income')), { align: 'right' })}
                      {renderEditableCell(record, 'exceptionReason', record.exceptionReason || '-', { className: 'max-w-56 text-slate-600' })}
                      <td className="py-2 pr-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => beginInlineEdit(record)}
                            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                            aria-label="编辑记录"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRecord(record.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                            aria-label="删除记录"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td className="py-6 text-slate-500" colSpan="11">
                    今天还没有运营记录，先上架，别研究半天。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
