export const TASK_CATEGORIES = ['赚钱', '学习', '身体', '资金', '复盘']

const DEFAULT_TASKS = [
  ['赚钱', '养号 10 分钟'],
  ['赚钱', '两店铺各发布 1 条商品'],
  ['赚钱', '回复所有私信，引导客户发资料或加微信'],
  ['赚钱', '记录今日运营数据'],
  ['学习', '学习 Codex 或代写运营知识 15 分钟'],
  ['学习', '整理 1 条可复用的代写方法或案例'],
  ['身体', '记录体重'],
  ['身体', '记录睡眠'],
  ['身体', '完成俯卧撑、步行、跑步机或羽毛球中的任意一种'],
  ['身体', '记录今天饮食'],
  ['资金', '检查资产仓位是否越界'],
  ['资金', '今天不因情绪追涨杀跌'],
  ['复盘', '填写每日复盘'],
  ['复盘', '记录是否破戒、摆烂、熬夜或拖延'],
]

export const DEFAULT_SHOPS = ['店铺A', '店铺B']

export const EXERCISE_OPTIONS = ['未记录', '俯卧撑', '步行', '跑步机', '羽毛球', '骑车', '其他']

export const DISCIPLINE_OPTIONS = ['未记录', '没有', '有']

export const defaultBodyRecord = {
  date: '',
  weight: '',
  bedTime: '',
  wakeTime: '',
  sleepHours: '',
  lunch: '',
  dinner: '',
  snack: '',
  exercise: '未记录',
  note: '',
}

export const defaultReviewRecord = {
  date: '',
  valuableThing: '',
  stupidThing: '',
  unfinishedReason: '',
  tomorrowTop3: '',
  discipline: '未记录',
  biggestRisk: '',
}

export const defaultFinanceAssets = [
  {
    id: 'gold',
    name: '黄金',
    amount: 35667,
    target: 8,
    lower: 6,
    upper: 10,
    note: '防守资产，超过上限要控制',
  },
  {
    id: 'bond-90',
    name: '国联安恒悦90天持有债',
    amount: 81123,
    target: 16,
    lower: 12,
    upper: 20,
    note: '稳定底仓',
  },
  {
    id: 'baijiu',
    name: '白酒',
    amount: 74442,
    target: 15,
    lower: 10,
    upper: 20,
    note: '仓位高，少动，不要情绪化补仓',
  },
  {
    id: 'dividend',
    name: '红利',
    amount: 65541,
    target: 14,
    lower: 10,
    upper: 18,
    note: '稳健权益',
  },
  {
    id: 'short-bond',
    name: '短债',
    amount: 59901,
    target: 12,
    lower: 8,
    upper: 15,
    note: '流动性和防守',
  },
  {
    id: 'chip-etf',
    name: '芯片ETF',
    amount: 35412,
    target: 6,
    lower: 4,
    upper: 10,
    note: '进攻仓，禁止上头',
  },
  {
    id: 'certificate',
    name: '同业存单',
    amount: 30848,
    target: 7,
    lower: 5,
    upper: 10,
    note: '备用资金',
  },
  {
    id: 'coal-etf',
    name: '煤炭ETF',
    amount: 21052,
    target: 3,
    lower: 2,
    upper: 6,
    note: '周期仓',
  },
  {
    id: 'yu-ebao',
    name: '余额宝',
    amount: 22387,
    target: 7,
    lower: 5,
    upper: 10,
    note: '现金池',
  },
  {
    id: 'hstech',
    name: '恒生科技',
    amount: 13686,
    target: 4,
    lower: 2,
    upper: 6,
    note: '观察仓',
  },
  {
    id: 'nasdaq',
    name: '纳斯达克',
    amount: 38580,
    target: 8,
    lower: 5,
    upper: 12,
    note: '进攻仓',
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
