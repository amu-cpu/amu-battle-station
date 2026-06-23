export const TASK_CATEGORIES = ['重点', '赚钱', '学习', '身体', '资金', '复盘']

const DEFAULT_TASKS = [
  ['赚钱', '养号 10 分钟'],
  ['赚钱', '两店铺各发布 1 条商品'],
  ['赚钱', '回复所有私信，引导客户发资料或加微信'],
  ['赚钱', '记录今日运营数据'],
  ['学习', '今日学习 / 沉淀待定'],
  ['身体', '记录体重'],
  ['身体', '记录睡眠'],
  ['身体', '完成俯卧撑、步行、跑步机或羽毛球中的任意一种'],
  ['身体', '记录今天饮食'],
  ['复盘', '填写每日复盘'],
  ['复盘', '记录今日自律状态'],
]

export const DEFAULT_SHOPS = [
  '商业计划书阿木「安卓」',
  '阿木可研计划书顾问「苹果」',
]

export const EXERCISE_OPTIONS = [
  '俯卧撑',
  '步行',
  '跑步机',
  '羽毛球',
  '骑车',
  '拉伸',
  '其他',
]

export const RELAPSE_STATUS_OPTIONS = [
  { value: 'unrecorded', label: '未记录' },
  { value: 'no', label: '达标' },
  { value: 'yes', label: '失守' },
]

export const RELAPSE_TYPE_OPTIONS = [
  '疲惫',
  '压力',
  '凌晨',
  '无聊',
  '独处',
  '刷屏',
  '其他',
]

export const DISCIPLINE_OPTIONS = ['未记录', '没有', '有']

export const defaultReminderRules = [
  {
    id: 'xianyu',
    title: '养号',
    times: ['13:30', '16:30', '21:00'],
    active: true,
  },
  {
    id: 'study',
    title: '学习',
    times: ['15:00', '20:30', '00:30'],
    active: true,
  },
  {
    id: 'review',
    title: '复盘',
    times: ['01:00', '01:45'],
    active: true,
  },
  {
    id: 'sleep',
    title: '睡前收尾',
    times: ['01:00', '01:30', '02:00'],
    active: true,
  },
]

export const defaultWakeSettings = {
  targetWakeTime: '12:00',
  finalWakeTime: '09:30',
  stepMinutes: 15,
  graceMinutes: 30,
}

export const defaultBodyRecord = {
  date: '',
  weight: '',
  bedTime: '',
  wakeTime: '',
  sleepHours: '',
  lunch: '',
  dinner: '',
  snack: '',
  afternoonSnack: '',
  eveningSnack: '',
  legacySnack: '',
  exercise: '未记录',
  exerciseText: '',
  relapseStatus: 'unrecorded',
  relapseTypes: [],
  relapseNote: '',
  disciplineUrges: [],
  urgeDelayCount: 0,
  urgeResolvedCount: 0,
  urgeDelayedAt: '',
  lastUrgeAt: '',
  selectedAlternativeAction: '',
  rescueState: {
    active: false,
    step: 'pause',
    startedAt: '',
    delayedAt: '',
    selectedAlternativeAction: '',
  },
  acknowledgedDisciplineRewards: [],
  note: '',
}

export const defaultReviewRecord = {
  date: '',
  importantThing: '',
  valuableThing: '',
  stupidThing: '',
  unfinishedReason: '',
  tomorrowTop3: '',
  discipline: '未记录',
  biggestRisk: '',
}

export const defaultFinanceAssets = [
  {
    id: 'demo-cash',
    name: '现金账户',
    amount: 10000,
    target: 20,
    lower: 10,
    upper: 30,
    note: '演示数据，可按自己的情况修改',
  },
  {
    id: 'demo-stable',
    name: '稳健资产',
    amount: 20000,
    target: 40,
    lower: 30,
    upper: 50,
    note: '演示数据，可按自己的情况修改',
  },
  {
    id: 'demo-equity',
    name: '权益资产',
    amount: 15000,
    target: 30,
    lower: 20,
    upper: 40,
    note: '演示数据，可按自己的情况修改',
  },
  {
    id: 'demo-watch',
    name: '观察资产',
    amount: 5000,
    target: 10,
    lower: 5,
    upper: 15,
    note: '演示数据，可按自己的情况修改',
  },
]

export function createDefaultTasks(dateKey) {
  return DEFAULT_TASKS.map(([category, title], index) => ({
    id: `${dateKey}-${index}`,
    date: dateKey,
    category,
    title,
    done: false,
  }))
}
