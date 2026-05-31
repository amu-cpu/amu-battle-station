import { Save } from 'lucide-react'
import Badge from '../components/Badge'
import Card from '../components/Card'
import Input from '../components/Input'
import { defaultReviewRecord, DISCIPLINE_OPTIONS } from '../utils/defaults'
import { sortByDateDesc } from '../utils/date'
import { isReviewComplete } from '../utils/scoring'

export default function ReviewPanel({ today, reviewRecords, setReviewRecords }) {
  const record = { ...defaultReviewRecord, date: today, ...(reviewRecords[today] || {}) }
  const history = sortByDateDesc(Object.values(reviewRecords)).slice(0, 10)
  const complete = isReviewComplete(record)

  function saveField(field, value) {
    setReviewRecords((current) => ({
      ...current,
      [today]: {
        ...defaultReviewRecord,
        date: today,
        ...(current[today] || {}),
        [field]: value,
      },
    }))
  }

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">每日复盘台</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">复盘不写废话</h1>
            <p className="mt-2 text-sm text-slate-600">只写能改变明天的东西，别把忙碌当进步。</p>
          </div>
          <Badge tone={complete ? 'success' : 'warning'}>{complete ? '今日已完成' : '今日未完成'}</Badge>
        </div>
      </header>

      <Card title="复盘提示" eyebrow="Prompt">
        <div className="grid gap-2 md:grid-cols-3">
          {['复盘不写废话，只写能改变明天的东西。', '别骗自己，今天哪里浪费时间或上头了？', '明天 3 件事要具体，别写空话。'].map((text) => (
            <div key={text} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800">
              {text}
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="今日复盘"
        eyebrow="Today"
        action={
          <Badge tone="success" className="gap-1">
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            自动保存
          </Badge>
        }
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <Input label="日期" type="date" value={record.date} disabled />
          <Input as="select" label="今天有没有破戒或摆烂" options={DISCIPLINE_OPTIONS} value={record.discipline} onChange={(event) => saveField('discipline', event.target.value)} />
          <Input
            as="textarea"
            label="今天最值钱的一件事"
            value={record.valuableThing}
            onChange={(event) => saveField('valuableThing', event.target.value)}
            placeholder="写具体动作，不写感受空话。"
          />
          <Input
            as="textarea"
            label="今天最蠢的一件事"
            value={record.stupidThing}
            onChange={(event) => saveField('stupidThing', event.target.value)}
            placeholder="哪里浪费时间、上头或逃避了？"
          />
          <Input
            as="textarea"
            label="今天为什么没完成"
            value={record.unfinishedReason}
            onChange={(event) => saveField('unfinishedReason', event.target.value)}
          />
          <Input
            as="textarea"
            label="明天最重要 3 件事"
            value={record.tomorrowTop3}
            onChange={(event) => saveField('tomorrowTop3', event.target.value)}
            placeholder="一行一件，必须能执行。"
          />
          <Input
            as="textarea"
            label="今天最大的风险是什么"
            className="lg:col-span-2"
            value={record.biggestRisk}
            onChange={(event) => saveField('biggestRisk', event.target.value)}
            placeholder="钱、身体、情绪、拖延，哪个最危险？"
          />
        </div>
      </Card>

      <Card title="最近 10 条复盘" eyebrow="History">
        <div className="grid gap-3">
          {history.length ? (
            history.map((item) => (
              <article key={item.date} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-black text-slate-950">{item.date}</h3>
                  <Badge tone={item.discipline === '有' ? 'danger' : item.discipline === '没有' ? 'success' : 'neutral'}>
                    破戒/摆烂：{item.discipline || '未记录'}
                  </Badge>
                </div>
                <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                  <p>
                    <span className="font-bold text-slate-950">最值钱：</span>
                    {item.valuableThing || '-'}
                  </p>
                  <p>
                    <span className="font-bold text-slate-950">最蠢：</span>
                    {item.stupidThing || '-'}
                  </p>
                  <p>
                    <span className="font-bold text-slate-950">未完成原因：</span>
                    {item.unfinishedReason || '-'}
                  </p>
                  <p>
                    <span className="font-bold text-slate-950">最大风险：</span>
                    {item.biggestRisk || '-'}
                  </p>
                  <p className="md:col-span-2">
                    <span className="font-bold text-slate-950">明天 3 件事：</span>
                    {item.tomorrowTop3 || '-'}
                  </p>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">还没有历史复盘，今晚先写第一条。</div>
          )}
        </div>
      </Card>
    </div>
  )
}
