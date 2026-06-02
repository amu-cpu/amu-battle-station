# 阿木作战台

阿木作战台 V1.1 桌面本地版。

一个个人每日作战台网页 App，用来记录闲鱼运营、身体打卡、资金仓位、每日复盘和自我约束。当前阶段优先电脑网页端使用，目标是简单、方便、直观、低摩擦。

## 电脑上运行

1. 安装 Node.js。
2. 在项目根目录运行：

```bash
npm install
npm run dev
```

3. 打开终端显示的本地地址，通常是：

```text
http://localhost:5173/
```

## 手机端使用

手机端只保证基本可访问，不作为 V1.1 主使用场景。

1. 让电脑和 iPhone 连接同一个局域网。
2. 在电脑上运行 `npm run dev -- --host 0.0.0.0`。
3. 在 iPhone Safari 打开电脑的局域网地址，例如 `http://电脑IP:5173/`。

## 添加到主屏幕

1. 用 iPhone Safari 打开网页。
2. 点击 Safari 底部分享按钮。
3. 选择“添加到主屏幕”。
4. 名称保留“阿木作战台”或改成你习惯的名字。

## 数据保存说明

当前主版本是桌面本地版：

1. 默认使用当前浏览器的 localStorage 保存数据。
2. 刷新页面不会丢失数据。
3. 不同浏览器、不同设备、不同域名之间的 localStorage 不互通。
4. JSON 导出 / 导入用于备份、迁移和恢复。
5. Cloudflare Pages 用于网页访问和自动部署。
6. 资金页默认开启隐私模式。
7. 不建议把真实资产金额写入默认代码。
8. 今日学习主题按日期保存在本地，用来细化当天学习任务。
9. 身体记录里的“是否破戒”是新增字段，旧身体记录会按未记录兼容显示。
10. 督促页、起床目标和每日提醒状态也保存在 localStorage。

重要数据建议定期在“每日复盘台”底部导出 JSON 备份。JSON 导入导出包含任务、身体、闲鱼、资金、复盘、督促和起床数据。资金页的 Excel 导出只用于查看完整资金状态，不能替代 JSON 灾难恢复备份。

## 督促页说明

V1.1 新增“督促”页，默认包含 5 项：起床、养号、学习、复盘、睡觉。

1. 当前只做网页内提醒。
2. 网页关闭时不会提醒。
3. 不请求浏览器通知权限，不使用 Push API，不播放声音。
4. 强提醒建议配合手机闹钟。
5. 起床目标默认 12:00，最终目标默认 09:30。
6. 连续稳定后，可以在督促页手动点击“目标提前 15 分钟”。
7. 督促规则、每日督促状态、起床目标和每日起床状态都保存在 localStorage。
8. 云同步 UI 默认隐藏。

## 云同步暂存说明

Supabase 云同步功能已暂存，当前版本默认不启用，也不在主界面显示登录或同步入口。

如果后续要重新启用云同步，需要配置 Supabase 环境变量，并显式打开开关：

```text
VITE_ENABLE_CLOUD_SYNC=true
VITE_SUPABASE_URL=你的 Supabase Project URL
VITE_SUPABASE_ANON_KEY=你的 Supabase anon public key
```

不要在前端使用或提交 Supabase `service_role` key。

### Supabase 云端同步说明

下面内容仅作为后续恢复云同步时的配置备忘。

#### 存储结构

云端同步使用 Supabase Auth 邮箱 Magic Link 登录，并用一张 `app_states` 表保存整份 App 状态。

App State 格式：

```json
{
  "schemaVersion": 1,
  "updatedAt": "ISO 时间",
  "tasks": {},
  "xianyuRecords": {},
  "bodyRecords": {},
  "financeAssets": [],
  "reviewRecords": {},
  "learningTopics": {},
  "learningRecords": {},
  "reminderRules": [],
  "dailyReminderState": {},
  "wakeSettings": {},
  "dailyWakeState": {},
  "settings": {}
}
```

#### Supabase 配置步骤

1. 创建 Supabase 项目。
2. 打开 Supabase SQL Editor。
3. 执行下面 SQL。
4. 在 Supabase Project Settings 里复制 Project URL 和 anon public key。
5. 在 Cloudflare Pages 里配置环境变量。
6. 在 Supabase Auth 的 URL 配置里，把 Cloudflare Pages 线上地址加入允许跳转地址。

```sql
create table if not exists public.app_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(user_id)
);

alter table public.app_states enable row level security;

create policy "Users can select own app state"
on public.app_states
for select
using (auth.uid() = user_id);

create policy "Users can insert own app state"
on public.app_states
for insert
with check (auth.uid() = user_id);

create policy "Users can update own app state"
on public.app_states
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

#### Cloudflare Pages 环境变量

进入 Cloudflare Pages 项目：

```text
Pages 项目 -> Settings -> Environment variables
```

添加：

```text
VITE_SUPABASE_URL=你的 Supabase Project URL
VITE_SUPABASE_ANON_KEY=你的 Supabase anon public key
VITE_ENABLE_CLOUD_SYNC=true
```

云同步关闭时，不需要配置这些变量。

#### 安全说明

1. 必须开启 Row Level Security。
2. 只使用 Supabase anon key。
3. 不要把 `service_role` key 写进前端代码、`.env` 或 Cloudflare Pages 前端环境变量。
4. 真实资金数据不要写死在代码默认值里。
5. 默认资产数据只使用演示数据。
6. 线上使用真实复盘、资金、隐私内容前，建议先确认隐私模式和 JSON 备份可用。

## Vercel 在线部署说明

本项目是 React + Vite 项目，推荐用 Vercel 直接导入 GitHub 仓库部署。

1. 打开 Vercel，选择导入 GitHub 仓库。
2. 选择 `amu-battle-station` 仓库。
3. Framework Preset 选择 `Vite`。
4. Build Command 通常使用 `npm run build`。
5. Output Directory 通常使用 `dist`。
6. 完成首次部署后，每次 `git push` 到 `main`，Vercel 会自动重新部署。

注意：线上地址和本地地址的 localStorage 不互通。线上版本建议先用测试数据，不要直接填写过多隐私内容。如果要给别人看，只发 Vercel 生成的 `.vercel.app` 链接，不要发 GitHub 仓库链接，也不要发 localhost 链接。

## 备用部署说明

### 为什么需要备用部署

当前 Vercel 版本电脑端可以打开，但手机端访问 `vercel.app` 域名报 `ERR_CONNECTION_ABORTED`。
这更像是手机网络、DNS、运营商链路或 `vercel.app` 子域名访问问题。
所以保留 Vercel，同时准备 Cloudflare Pages 和 Netlify 作为备用线上地址。

### Cloudflare Pages 部署

1. 登录 Cloudflare。
2. 进入 Workers & Pages。
3. 选择 Pages。
4. 连接 GitHub。
5. 选择仓库：`amu-battle-station`。
6. Framework preset 选择：`Vite`。
7. Build command 填：`npm run build`。
8. Output directory 填：`dist`。
9. 点击 Deploy。
10. 部署成功后，会得到一个 `pages.dev` 地址。
11. 用手机打开 `pages.dev` 地址测试。

### Netlify 部署

1. 登录 Netlify。
2. Add new site。
3. Import an existing project。
4. 连接 GitHub。
5. 选择仓库：`amu-battle-station`。
6. Framework 选择：`Vite` 或自动识别。
7. Build command 填：`npm run build`。
8. Publish directory 填：`dist`。
9. 点击 Deploy。
10. 部署成功后，会得到一个 `netlify.app` 地址。
11. 用手机打开 `netlify.app` 地址测试。

### 重要提醒

1. Vercel、Cloudflare Pages、Netlify、本地 localhost 是不同访问来源。
2. 当前 App 使用 localStorage 保存数据。
3. 不同域名下的 localStorage 数据互不相通。
4. 本地数据不会自动同步到 Vercel。
5. Vercel 数据不会自动同步到 Cloudflare Pages。
6. Cloudflare Pages 数据不会自动同步到 Netlify。
7. 线上演示时先用测试数据，不要填真实隐私复盘、资金、戒色等内容。
8. Supabase 云同步已暂存，当前 V1.1 默认只使用当前域名下的 localStorage。

## 手机打不开线上地址时怎么排查

1. 先确认电脑是否能打开。
2. 手机分别测试 WiFi 和蜂窝流量。
3. 手机关闭代理再试。
4. 手机开启全局代理再试。
5. 手机浏览器直接打开 `vercel.com`、`pages.dev`、`netlify.app`。
6. 如果 Vercel 打不开但 Cloudflare Pages 能打开，就优先使用 Cloudflare Pages 地址。
7. 如果所有海外托管地址都打不开，就考虑代理、DNS 或以后绑定自定义域名。
8. 不要因为手机打不开就立刻改业务代码。

## V1.1 范围

- 今日作战台：每日任务、作战分、风险提醒。
- 闲鱼运营台：运营记录增删改、今日汇总、运营诊断。
- 身体打卡台：睡眠、饮食、运动记录、是否破戒、备注和最近 10 条历史。
- 资金雷达台：手动资产记录、表格行内编辑、总资产、占比、上下限状态和完整资金状态 Excel 导出。
- 每日复盘台：自动保存当天复盘、最近 10 条历史和 JSON 数据备份。
- 督促页：起床、养号、学习、复盘、睡觉 5 项网页内提醒，以及起床目标调整。

默认不包含登录注册、后端服务、外部 API、客户交付台、CRM 或团队协作。
