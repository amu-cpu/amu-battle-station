import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
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
  shopName: '店铺A',
  accountWarmed: false,
  publishCount: '',
  exposure: '',
  inquiries: '',
  wechat: '',
  deals: '',
  income: '',
  exceptionReason: '',
}

const numberFields = ['publishCount', 'exposure', 'inquiries', 'wechat', 'deals', 'income']

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

function recordToForm(record) {
  return numberFields.reduce(
    (form, field) => ({
      ...form,
      [field]: record[field] === undefined || record[field] === null ? '' : normalizeNumberInput(record[field]),
    }),
    { ...emptyForm, ...record },
  )
}

export default function XianyuPanel({
  selectedDate,
  records,
  allRecords = [],
  setRecords,
  summary,
  operationScore,
  diagnosis,
}) {
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ ...emptyForm, date: selectedDate })
  const todayRecords = records
  const shopOptions = useMemo(
    () => [...new Set([...DEFAULT_SHOPS, ...allRecords.map((record) => record.shopName).filter(Boolean)])],
    [allRecords],
  )

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: numberFields.includes(field) ? normalizeNumberInput(value) : value,
    }))
  }

  function resetForm() {
    setEditingId(null)
    setForm({ ...emptyForm, date: selectedDate })
  }

  function saveRecord(event) {
    event.preventDefault()
    const payload = {
      ...form,
      shopName: form.shopName.trim() || '未命名店铺',
      date: selectedDate,
    }
    numberFields.forEach((field) => {
      payload[field] = toSavedNumber(payload[field])
    })

    if (editingId) {
      setRecords((current) => current.map((record) => (record.id === editingId ? { ...record, ...payload, id: editingId } : record)))
    } else {
      setRecords((current) => [{ ...payload, id: `xianyu-${Date.now()}` }, ...current])
    }

    resetForm()
  }

  function editRecord(record) {
    setEditingId(record.id)
    setForm(recordToForm(record))
  }

  function deleteRecord(recordId) {
    setRecords((current) => current.filter((record) => record.id !== recordId))
  }

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">闲鱼运营台 · {formatDateLabel(selectedDate)}</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">现金流动作不能断</h1>
        <p className="mt-2 text-sm text-slate-600">发布、曝光、咨询、加微、成交，今天有没有往前推，一眼看清。</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <ScoreCard label="运营分" value={operationScore} detail="发布 / 咨询 / 加微 / 成交" tone="cyan" />
        <ScoreCard label="发布" value={summary.publishCount} detail="今日商品数" />
        <ScoreCard label="曝光" value={summary.exposure} detail="入口是否有流量" />
        <ScoreCard label="咨询" value={summary.inquiries} detail="卖点是否够尖" />
        <ScoreCard label="加微" value={summary.wechat} detail="私信是否够直接" />
        <ScoreCard label="收入" value={formatCurrency(summary.income)} detail={`${summary.deals} 笔成交`} tone="green" />
      </div>

      <Card title="自动诊断" eyebrow="Diagnosis">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800">
          {diagnosis}
        </div>
      </Card>

      <Card title={editingId ? '编辑运营记录' : '新增运营记录'} eyebrow="Record">
        <form onSubmit={saveRecord} className="grid gap-3 xl:grid-cols-8">
          <Input label="日期" type="date" value={selectedDate} disabled />
          <label className="block xl:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">店铺名称</span>
            <input
              className="min-h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              list="shop-options"
              value={form.shopName}
              onChange={(event) => updateField('shopName', event.target.value)}
              placeholder="店铺A / 店铺B / 自定义"
            />
            <datalist id="shop-options">
              {shopOptions.map((shop) => (
                <option key={shop} value={shop} />
              ))}
            </datalist>
          </label>
          <Input label="发布数量" type="text" inputMode="decimal" value={form.publishCount} onChange={(event) => updateField('publishCount', event.target.value)} placeholder="0" />
          <Input label="曝光" type="text" inputMode="decimal" value={form.exposure} onChange={(event) => updateField('exposure', event.target.value)} placeholder="0" />
          <Input label="咨询" type="text" inputMode="decimal" value={form.inquiries} onChange={(event) => updateField('inquiries', event.target.value)} placeholder="0" />
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
            已养号
          </label>
          <Input
            label="异常原因"
            className="xl:col-span-6"
            value={form.exceptionReason}
            onChange={(event) => updateField('exceptionReason', event.target.value)}
            placeholder="没有异常就留空"
          />
          <div className="flex flex-wrap gap-2 xl:col-span-2 xl:self-end">
            <Button type="submit" variant="primary" icon={editingId ? Save : Plus}>
              {editingId ? '保存修改' : '新增记录'}
            </Button>
            {editingId ? (
              <Button type="button" icon={X} onClick={resetForm}>
                取消编辑
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      <Card title="今日运营记录" eyebrow="Today">
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">店铺</th>
                <th className="py-2 pr-3">养号</th>
                <th className="py-2 pr-3">发布</th>
                <th className="py-2 pr-3">曝光</th>
                <th className="py-2 pr-3">咨询</th>
                <th className="py-2 pr-3">加微</th>
                <th className="py-2 pr-3">成交</th>
                <th className="py-2 pr-3">收入</th>
                <th className="py-2 pr-3">异常</th>
                <th className="py-2 pr-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {todayRecords.length ? (
                todayRecords.map((record) => (
                  <tr key={record.id} className="align-top">
                    <td className="py-3 pr-3 font-semibold text-slate-900">{record.shopName}</td>
                    <td className="py-3 pr-3">{record.accountWarmed ? <Badge tone="success">是</Badge> : <Badge>否</Badge>}</td>
                    <td className="py-3 pr-3">{record.publishCount}</td>
                    <td className="py-3 pr-3">{record.exposure}</td>
                    <td className="py-3 pr-3">{record.inquiries}</td>
                    <td className="py-3 pr-3">{record.wechat}</td>
                    <td className="py-3 pr-3">{record.deals}</td>
                    <td className="py-3 pr-3">{formatCurrency(record.income)}</td>
                    <td className="max-w-56 py-3 pr-3 text-slate-600">{record.exceptionReason || '-'}</td>
                    <td className="py-3 pr-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => editRecord(record)}
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
                ))
              ) : (
                <tr>
                  <td className="py-6 text-slate-500" colSpan="10">
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
