import { Eye, EyeOff, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Card from '../components/Card'
import Input from '../components/Input'
import ScoreCard from '../components/ScoreCard'
import { calculateFinanceTotal, formatCurrency, formatPercent, getAssetStatus } from '../utils/scoring'

const emptyAsset = {
  name: '',
  amount: 0,
  target: 0,
  lower: 0,
  upper: 0,
  note: '',
}

const numberFields = ['amount', 'target', 'lower', 'upper']

export default function FinancePanel({ assets, setAssets, privacyMode, setPrivacyMode }) {
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyAsset)
  const [emotionVisible, setEmotionVisible] = useState(false)
  const total = calculateFinanceTotal(assets)
  const rows = useMemo(() => assets.map((asset) => ({ ...asset, ...getAssetStatus(asset, total) })), [assets, total])
  const highCount = rows.filter((row) => row.status === '偏高').length
  const lowCount = rows.filter((row) => row.status === '偏低').length
  const moneyText = (value) => (privacyMode ? '****' : formatCurrency(value))

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: numberFields.includes(field) ? Number(value) : value,
    }))
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyAsset)
  }

  function saveAsset(event) {
    event.preventDefault()
    const name = form.name.trim()
    if (!name) return

    const payload = { ...form, name }
    if (editingId) {
      setAssets((current) => current.map((asset) => (asset.id === editingId ? { ...asset, ...payload, id: editingId } : asset)))
    } else {
      setAssets((current) => [...current, { ...payload, id: `asset-${Date.now()}` }])
    }

    resetForm()
  }

  function editAsset(asset) {
    setEditingId(asset.id)
    setForm({
      name: asset.name,
      amount: asset.amount,
      target: asset.target,
      lower: asset.lower,
      upper: asset.upper,
      note: asset.note,
    })
  }

  function deleteAsset(assetId) {
    setAssets((current) => current.filter((asset) => asset.id !== assetId))
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
          <Button
            type="button"
            variant={privacyMode ? 'primary' : 'secondary'}
            icon={privacyMode ? EyeOff : Eye}
            onClick={() => setPrivacyMode((value) => !value)}
            className="sm:mt-1"
          >
            {privacyMode ? '显示金额' : '隐藏金额'}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ScoreCard label="总资产" value={moneyText(total)} detail="手动记录合计" tone="green" />
        <ScoreCard label="资产数量" value={assets.length} detail="可新增、编辑、删除" />
        <ScoreCard label="偏高资产" value={highCount} detail="超过上限要控制" tone={highCount ? 'red' : 'green'} />
        <ScoreCard label="偏低资产" value={lowCount} detail="低于下限仅提醒关注" tone={lowCount ? 'yellow' : 'green'} />
      </div>

      <Card title={editingId ? '编辑资产' : '新增资产'} eyebrow="Record">
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
            <Button type="submit" variant="primary" icon={editingId ? Save : Plus}>
              {editingId ? '保存修改' : '新增资产'}
            </Button>
            {editingId ? (
              <Button type="button" icon={X} onClick={resetForm}>
                取消
              </Button>
            ) : null}
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
                <th className="py-2 pr-3">区间</th>
                <th className="py-2 pr-3">状态</th>
                <th className="py-2 pr-3">操作提示</th>
                <th className="py-2 pr-3">备注</th>
                <th className="py-2 pr-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="py-3 pr-3 font-semibold text-slate-900">{row.name}</td>
                  <td className="py-3 pr-3">{moneyText(row.amount)}</td>
                  <td className="py-3 pr-3">{formatPercent(row.ratio)}</td>
                  <td className="py-3 pr-3">{formatPercent(row.target)}</td>
                  <td className="py-3 pr-3">
                    {formatPercent(row.lower)} - {formatPercent(row.upper)}
                  </td>
                  <td className="py-3 pr-3">
                    <Badge tone={row.tone}>{row.status}</Badge>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge tone={row.tone}>{row.action}</Badge>
                  </td>
                  <td className="max-w-72 py-3 pr-3 text-slate-600">{row.note || '-'}</td>
                  <td className="py-3 pr-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => editAsset(row)}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                        aria-label="编辑资产"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAsset(row.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                        aria-label="删除资产"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
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
