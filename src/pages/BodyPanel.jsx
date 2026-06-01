import { Save } from 'lucide-react'
import Badge from '../components/Badge'
import Card from '../components/Card'
import Input from '../components/Input'
import ScoreCard from '../components/ScoreCard'
import { defaultBodyRecord, EXERCISE_OPTIONS } from '../utils/defaults'
import { calculateSleepHours, formatDateLabel, sortByDateDesc } from '../utils/date'

function displayExercise(value) {
  return value && value !== '未记录' ? value : ''
}

function getExerciseText(record) {
  return displayExercise(record?.exerciseText) || displayExercise(record?.exercise)
}

function getLegacySnack(record) {
  return record?.legacySnack || record?.snack || record?.extraMeal || record?.加餐 || ''
}

function getSnackSummary(record) {
  const snacks = [record?.afternoonSnack, record?.eveningSnack].filter(Boolean)
  return snacks.length ? snacks.join(' / ') : getLegacySnack(record)
}

export default function BodyPanel({ selectedDate, bodyRecords, setBodyRecords, bodyScore }) {
  const record = { ...defaultBodyRecord, date: selectedDate, ...(bodyRecords[selectedDate] || {}) }
  const history = sortByDateDesc(Object.values(bodyRecords)).slice(0, 10)

  function saveField(field, value) {
    setBodyRecords((current) => {
      const nextRecord = { ...defaultBodyRecord, date: selectedDate, ...(current[selectedDate] || {}), [field]: value }

      if (field === 'bedTime' || field === 'wakeTime') {
        nextRecord.sleepHours = calculateSleepHours(nextRecord.bedTime, nextRecord.wakeTime)
      }

      return { ...current, [selectedDate]: nextRecord }
    })
  }

  function appendExercise(text) {
    const currentExercise = getExerciseText(record).trim()
    saveField('exerciseText', currentExercise ? `${currentExercise} + ${text}` : text)
  }

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">身体打卡台 · {formatDateLabel(selectedDate)}</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">身体是本金，别熬夜硬扛</h1>
        <p className="mt-2 text-sm text-slate-600">记录睡眠、饮食、运动和备注，防止硬扛到报废。</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ScoreCard label="身体分" value={bodyScore} detail="睡眠 / 运动 / 饮食 / 备注" tone="green" />
        <ScoreCard label="睡眠小时" value={record.sleepHours || 0} detail="7 小时以上加 30 分" />
        <ScoreCard label="运动" value={getExerciseText(record) ? '已记' : '未记'} detail="完成运动加 30 分" tone={getExerciseText(record) ? 'green' : 'yellow'} />
        <ScoreCard label="体重" value={record.weight || '未记'} detail="记录体重加 10 分" />
      </div>

      <Card
        title="今日身体记录"
        eyebrow="Today"
        action={
          <Badge tone="success" className="gap-1">
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            自动保存
          </Badge>
        }
      >
        <div className="grid gap-3 xl:grid-cols-12">
          <Input label="日期" type="date" value={record.date} disabled className="xl:col-span-2" />
          <Input label="体重" type="number" min="0" step="0.1" value={record.weight} onChange={(event) => saveField('weight', event.target.value)} placeholder="kg" className="xl:col-span-2" />
          <Input label="上床时间" type="time" value={record.bedTime} onChange={(event) => saveField('bedTime', event.target.value)} className="xl:col-span-2" />
          <Input label="起床时间" type="time" value={record.wakeTime} onChange={(event) => saveField('wakeTime', event.target.value)} className="xl:col-span-2" />
          <Input
            label="睡眠小时"
            type="number"
            min="0"
            step="0.1"
            value={record.sleepHours}
            onChange={(event) => saveField('sleepHours', event.target.value)}
            placeholder="可自动计算，也可手动填"
            className="xl:col-span-2"
          />
          <Input label="中餐" value={record.lunch} onChange={(event) => saveField('lunch', event.target.value)} placeholder="吃了什么，别骗自己" className="xl:col-span-2" />
          <Input label="晚餐" value={record.dinner} onChange={(event) => saveField('dinner', event.target.value)} className="xl:col-span-2" />
          <Input label="下午加餐" value={record.afternoonSnack || ''} onChange={(event) => saveField('afternoonSnack', event.target.value)} placeholder={getLegacySnack(record) || ''} className="xl:col-span-2" />
          <Input label="晚上加餐" value={record.eveningSnack || ''} onChange={(event) => saveField('eveningSnack', event.target.value)} className="xl:col-span-2" />
          <div className="xl:col-span-5">
            <Input
              as="textarea"
              label="运动记录"
              value={getExerciseText(record)}
              onChange={(event) => saveField('exerciseText', event.target.value)}
              placeholder="俯卧撑50个 + 步行3公里 + 羽毛球1小时"
              inputClassName="min-h-24"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {EXERCISE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => appendExercise(option)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <Input
            as="textarea"
            label="身体备注"
            className="xl:col-span-5"
            value={record.note}
            onChange={(event) => saveField('note', event.target.value)}
            placeholder="疲劳、疼痛、熬夜、精神状态，写清楚。"
            inputClassName="min-h-32"
          />
        </div>
      </Card>

      <Card title="最近 10 条身体记录" eyebrow="History">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">日期</th>
                <th className="py-2 pr-3">体重</th>
                <th className="py-2 pr-3">睡眠</th>
                <th className="py-2 pr-3">运动</th>
                <th className="py-2 pr-3">饮食</th>
                <th className="py-2 pr-3">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length ? (
                history.map((item) => (
                  <tr key={item.date} className="align-top">
                    <td className="py-3 pr-3 font-semibold text-slate-900">{item.date}</td>
                    <td className="py-3 pr-3">{item.weight || '-'}</td>
                    <td className="py-3 pr-3">{item.sleepHours || '-'} 小时</td>
                    <td className="max-w-72 py-3 pr-3 text-slate-700">{getExerciseText(item) || '-'}</td>
                    <td className="max-w-64 py-3 pr-3 text-slate-600">{[item.lunch, item.dinner, getSnackSummary(item)].filter(Boolean).join(' / ') || '-'}</td>
                    <td className="max-w-64 py-3 pr-3 text-slate-600">{item.note || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-6 text-slate-500" colSpan="6">
                    还没有身体记录，先填今天。
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
