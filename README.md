# 阿木作战台

阿木作战台 V1.1 桌面本地版。

一个个人每日作战台网页 App，用来记录闲鱼运营、身体打卡、资金仓位、每日复盘和自律状态。当前阶段优先电脑网页端使用，目标是简单、方便、直观、低摩擦。

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
7. 不建议把实际资金金额写入默认代码或文档。
8. 今日学习主题按日期保存在本地，用来细化当天学习任务。
9. 身体记录里的自律状态是私密记录字段，旧身体记录会按未记录兼容显示。
10. 督促页、起床追踪和每日提醒状态也保存在 localStorage。

重要数据建议定期在“每日复盘台”底部导出 JSON 备份。JSON 导入导出包含任务、身体、闲鱼、资金、复盘、督促和起床数据。资金页的 Excel 导出只用于查看完整资金状态，不能替代 JSON 灾难恢复备份。

## 数据安全说明

当前仓库是公开仓库。

1. 不建议把实际资金金额、客户资料、个人隐私内容写进代码或文档。
2. 真实使用数据应只保存在浏览器 localStorage 或自己导出的本地 JSON 中。
3. 线上演示时建议使用测试数据。
4. 默认示例资产只用于演示，不代表个人资产配置。

## 复盘与今日任务联动

每日复盘页的“明天最重要 3 件事”会在第二天自动生成“今日重点任务”。

1. 今日重点任务显示在今日作战台顶部。
2. 今日重点任务可以勾选完成，并计入任务完成率和今日作战分。
3. 今日学习主题仍然独立，用于长期能力沉淀，不等同于今日重点任务。
4. 空行不会生成任务，最多生成 3 条。
5. 所有数据仍保存在 localStorage。
6. JSON 导入导出包含复盘和任务数据。

## 闲鱼运营页说明

V1.1 闲鱼运营页新增“浏览量”字段，字段名为 `views`。

1. 运营漏斗顺序为：发布、曝光、浏览、咨询、加微、成交、收入。
2. 顶部运营数据卡片包含运营分、发布、曝光、浏览、咨询、加微、成交、收入。
3. 今日运营记录支持表格行内编辑，点击可编辑单元格后直接修改，按 Enter 保存，按 Esc 取消，离开当前行自动保存。
4. 旧运营记录没有浏览量时按 0 处理。
5. JSON 导入导出兼容浏览量字段；旧备份没有 `views` 时会按 0 使用，旧字段 `browse`、`viewCount`、`browseCount` 会映射到 `views`。

## 督促页说明

V1.1 新增“督促”页，默认包含 4 项：养号、学习、复盘、睡觉。

1. 当前只做网页内提醒。
2. 网页关闭时不会提醒。
3. 不请求浏览器通知权限，不使用 Push API，不播放声音。
4. 强提醒建议配合手机或电脑闹钟。
5. 起床不再作为网页内提醒卡片。
6. 起床只保留目标追踪：目标起床、实际起床和起床状态。
7. 起床目标默认 12:00，最终目标默认 09:30。
8. 连续稳定后，可以在督促页手动点击“目标提前 15 分钟”。
9. 提醒时间在主界面以标签显示，点击“编辑时间”后再修改。
10. 备注默认折叠，点击“备注”后再填写。
11. “提醒中 / 已关闭”用于控制该事项是否提醒；已关闭时不会触发网页内提醒。
12. 督促规则、每日督促状态、起床目标和每日起床状态都保存在 localStorage。
13. JSON 导入导出包含督促数据和起床目标数据。
14. 云同步 UI 默认隐藏。

## 身体页说明

身体页支持“公开展示模式 / 完整记录模式”。

1. 公开展示模式只隐藏自律状态相关 UI，不删除数据。
2. 完整记录模式用于个人自查。
3. JSON 导出仍保留完整身体记录数据。
4. 切换展示模式会保存到 localStorage，并可随 JSON 备份恢复。

## 资金页说明

1. 资金页默认隐私模式。
2. 默认示例资产只使用演示数据。
3. Excel 导出会包含当前浏览器里的完整金额，导出前需要确认。
4. Excel 只在本地下载，不上传。

## 云同步暂存说明

Supabase 云同步功能已暂存，当前版本默认不启用，也不在主界面显示登录或同步入口。

如果后续要重新启用云同步，需要配置 Supabase 环境变量，并显式打开开关：

```text
VITE_ENABLE_CLOUD_SYNC=true
VITE_SUPABASE_URL=你的 Supabase Project URL
VITE_SUPABASE_ANON_KEY=你的 Supabase anon public key
```

不要在前端使用或提交 Supabase `service_role` key。
.env 不要提交到仓库。

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
4. 实际资金数据不要写死在代码默认值里。
5. 默认示例资产只使用演示数据。
6. 线上使用复盘、资金和私密内容前，建议先确认隐私模式和 JSON 备份可用。

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
7. 线上演示时先用测试数据，不要填写私密复盘、资金或个人自查内容。
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
- 闲鱼运营台：运营记录增删改、浏览量、今日汇总、运营漏斗诊断和表格行内编辑。
- 身体打卡台：睡眠、饮食、运动记录、自律状态、展示模式切换、备注和最近 10 条历史。
- 资金雷达台：手动资产记录、表格行内编辑、总资产、占比、上下限状态和完整资金状态 Excel 导出。
- 每日复盘台：自动保存当天复盘、最近 10 条历史和 JSON 数据备份。
- 督促页：养号、学习、复盘、睡觉 4 项网页内提醒，以及起床目标追踪。

默认不包含登录注册、后端服务、外部 API、客户交付台、CRM 或团队协作。
