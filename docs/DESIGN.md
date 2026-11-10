# date_alert 需求规格说明书

> 版本：v2.0
> 状态：定稿，可据此开发
> 本文件仅描述系统应具备的行为与形态。

---

## 0. 文档约定

### 0.1 需求编号

| 前缀 | 含义 |
|---|---|
| `FR` | 功能需求（Functional Requirement） |
| `BR` | 业务规则（Business Rule） |
| `DR` | 数据需求（Data Requirement） |
| `API` | 接口需求 |
| `UI` | 界面需求 |
| `NFR` | 非功能需求 |
| `AC` | 验收标准（Acceptance Criteria） |

### 0.2 术语

| 术语 | 定义 |
|---|---|
| 剩余天数 | 到期日与"今天"相差的日历天数；`>0` 未到期，`0` 当天到期，`<0` 已过期 |
| 今天 | 按系统设置时区计算出的当前日期 |
| 计划时间 | 系统设置中的每日推送时间 `HH:MM` |
| 归档 | 提醒被移出首页与推送范围，进入历史列表 |
| 规则色 | 由剩余天数命中某条颜色区间后确定的卡片主色 |

---

## 1. 项目概述

### 1.1 定位

一个部署在 Cloudflare 上的纯 Web 日期倒计时提醒应用。公开首页展示倒计时卡片墙；登录后可管理提醒与系统设置；每天在设定时间通过 Bark 向用户推送提醒。

### 1.2 系统边界

| 项 | 内容 |
|---|---|
| 运行平台 | Cloudflare Workers + Static Assets |
| 数据存储 | Cloudflare D1（单一数据库） |
| 定时任务 | Cloudflare Cron Triggers |
| 外部服务 | Bark 推送（`POST {baseUrl}/{deviceKey}`） |
| 用户模型 | 单管理员，无注册、无多用户 |
| 访问控制 | 首页完全公开；管理后台需密码登录 |
| 通知渠道 | 仅 Bark |

### 1.3 技术栈

| 层 | 选型 |
|---|---|
| 运行时 | Cloudflare Workers（Free Plan） |
| 服务端路由 | Hono |
| 前端框架 | Vue 3 + TypeScript |
| 构建 | Vite |
| 样式 | Tailwind CSS + CSS 变量 |
| 图标 | lucide-vue-next |
| 测试 | Vitest |

---

## 2. 功能需求

### FR-1 首页（`/`）

**FR-1.1 数据范围**

- 展示 `is_public = 1` 且 `is_done = 0` 的提醒。
- 分为两段：**有日期**在上，**未设置日期**在下（带小标题「未设置日期 (N)」）。
- 有日期部分：剩余天数升序；相同时按创建时间倒序。
- 单次最多返回 60 条；存在更多数据时底部显示「加载更多」，每次追加 60 条（通过 `limit` / `offset` 实现）。

**FR-1.2 卡片内容**

| 元素 | 内容 |
|---|---|
| 左侧色条 | 4px 宽，颜色 = 规则色 |
| 标题 | 提醒标题，最多 2 行，超出省略 |
| 剩余天数 | 数字 + 单位；`>0` 显示「N 天」，`0` 显示「今天」，`<0` 显示「已过期 N 天」；无日期显示「无日期」 |
| 备注 | 默认最多 2 行，超出省略；**鼠标悬停展开全文**，并带 `title` 原生提示 |
| 到期日 | `YYYY-MM-DD`，固定显示；无日期时不显示 |
| 状态标签 | 右上角 chip，文本为命中颜色规则的 `label`；已过期「已过期」；无日期不显示 chip |

**FR-1.3 布局**

| 视口宽度 | 每行卡片数 |
|---|---|
| `< 640px` | 1 |
| `640px – 1023px` | 2 |
| `>= 1024px` | 4 |

卡片间距 16px，页面容器最大宽度 1200px。

**FR-1.4 顶栏**

从左到右：站点名 `date_alert`、语言切换（🌐）、主题切换（🌓）、登录入口（🔒）。

顶栏下方显示「今天 · YYYY-MM-DD · {时区}」。

**FR-1.5 交互**

- 卡片 hover：上浮 2px 并加深阴影。
- 剩余天数 `<= 1` 的卡片：3 秒周期呼吸动画；系统开启「减少动态效果」时不播放。
- 未登录点击卡片：同一张卡片连续点击第 3 次时，弹出提示「请先登录」，同时登录图标高亮脉冲 2 秒。
- 已登录点击卡片：从右侧滑出详情抽屉（见 FR-2）；视口 `< 640px` 时改为底部弹出面板。
- 点击「加载更多」追加下一页。

**FR-1.6 状态**

- 加载中：显示 8 个骨架卡片。
- 空数据：显示插画与「暂无提醒」。
- 刷新时机：页面重新可见且本地日期已变化时重新拉取；页面持续可见超过 10 分钟时静默刷新。
- **版本检测**：启动后读取 `/version.json`，在页面可见、窗口聚焦以及每 5 分钟时重新比对；版本变化则自动刷新页面，避免停留在旧版本。

### FR-2 提醒详情抽屉

**FR-2.1 展示内容**

标题、剩余天数、到期日、备注全文、创建时间、公开开关、提醒方式。

**FR-2.2 操作**

「编辑」「归档」「删除」。

- 归档：立即生效，抽屉关闭，卡片从首页移除。
- 删除：二次确认后物理删除，抽屉关闭，卡片从首页移除。

### FR-3.0 首次初始化（`/setup`）

- 触发条件：`admin` 表为空（`GET /api/auth/me` 返回 `initialized = false`）。
- 未初始化时，访问任何页面都重定向到 `/setup`；初始化完成后访问 `/setup` 会被重定向走。
- 表单：管理员密码、确认密码；若服务端配置了 `SETUP_TOKEN`，额外要求输入初始化令牌。
- 成功后写入 `admin`（`must_change_password = 0`），清空旧会话，直接登录并跳转 `/admin`。
- 已初始化后再调用返回 `403 ALREADY_INITIALIZED`。
- 该机制让「一键部署（无交互终端）」也能完成初始化，无需在 CI 日志里找密码。

### FR-3 登录（`/login`）

| 项 | 规则 |
|---|---|
| 输入 | 单个密码框，支持显示/隐藏 |
| 选项 | 「记住我」勾选框 |
| 失败提示 | 统一为「密码错误」，不区分具体原因 |
| 频率限制 | 同一 IP 15 分钟内失败 5 次后，登录按钮禁用并显示倒计时，冷却 15 分钟 |
| 成功跳转 | `must_change_password = 1` 时跳转 `/change-password`，否则跳转 `/admin` |
| 会话有效期 | 默认 7 天；勾选「记住我」为 30 天 |
| 成功跳转 | 跳到 `next` 参数指定的后台路径；`next` 缺失、为 `/`、为 `/login` 或以 `//` 开头时回落到 `/admin` |

### FR-4 修改密码（`/change-password`）

- 表单：旧密码、新密码、确认新密码。
- 新密码规则：长度 12–64，必须同时包含字母与数字。
- 首次登录强制修改：在 `must_change_password = 1` 期间，除改密接口外，所有后台路由与后台 API 一律拦截并提示。
- 修改成功后：清空全部会话，为当前设备重新签发会话，跳转 `/admin`。
- 页面提供退出登录入口。

### FR-5 管理后台 · Tab 1「日期提醒管理」

**FR-5.1 列表**

| 元素 | 规则 |
|---|---|
| 列 | 标题（含备注摘要）、到期日、剩余天数、公开状态、操作按钮 |
| 状态筛选 | 下拉：`未到期`（默认）、`已归档`、`无日期`、`全部` |
| 搜索 | 按标题与备注模糊匹配，不区分大小写，输入后 300ms 防抖 |
| 分页 | 每页 20 条；底部显示「共 N 条 · 第 X / Y 页」与上一页 / 下一页 |
| 排序 | `未到期` / `全部`：未归档在前，按到期日升序；`已归档`：按归档时间倒序 |
| 空状态 | 未到期：`还没有提醒`；已归档：`没有已归档的提醒` |
| 加载态 | 5 行骨架 |
| 移动端 | 改为卡片列表，操作按钮为「编辑 / 归档或恢复 / 删除」 |
| 批量清理 | 仅 `已归档` 视图显示「清空已归档」按钮，二次确认 |

**FR-5.2 新建 / 编辑**

弹窗表单字段：

| 字段 | 规则 |
|---|---|
| 标题 | 必填，1–50 字符，允许重名 |
| 备注 | 选填，≤ 200 字符 |
| 到期日 | 日期选择器，允许选择过去日期；勾选「不设置日期」时置空并禁用输入 |
| 公开到首页 | 开关，默认开启 |
| 提醒方式 | 三选一：`跟随全局`（默认）/ `不提醒` / `自定义`；选「自定义」时展开天数多标签输入 |

- 到期日早于今天时，表单实时提示「该日期已过期，保存后将直接进入历史」。
- 不设置日期的提醒：不参与倒计时、不参与推送、永不被自动归档。
- 自定义天数：`0–365` 的整数，去重，最多 10 个。
- 提交中禁用按钮，防止重复提交。

**FR-5.3 操作**

| 操作 | 行为 |
|---|---|
| 查看详情 | 点击标题打开右侧抽屉（详见 FR-2） |
| 编辑 | 打开弹窗，预填当前值；保存后刷新列表 |
| 归档 | 立即置为已归档，从首页与推送中移除 |
| 恢复 | 仅对已归档项可用；恢复后若已过期，下一次定时任务会重新归档 |
| 彻底删除 | 二次确认后物理删除 |
| 清空已归档 | 二次确认后删除全部已归档提醒，提示删除条数 |

**编辑与归档的联动规则**

| 场景 | 结果 |
|---|---|
| 未归档，改到期日为过去 | 立即自动归档（`doneBy = auto`） |
| 自动归档，改到期日为未来 | 立即自动恢复 |
| 手动归档，改任意日期 | 保持归档，不自动恢复 |

### FR-6 管理后台 · Tab 2「系统管理」

分为 6 个小节。

**FR-6.1 密码修改**

同 FR-4。

**FR-6.2 时区与语言**

| 项 | 规则 |
|---|---|
| 时区 | 下拉选择；旁注该时区的当前时间（实时刷新） |
| 默认语言 | `跟随浏览器` / `简体中文` / `繁體中文` / `English`；仅影响新访客首屏语言 |
| 推送语言 | `简体中文` / `繁體中文` / `English`；影响推送文案 |

**FR-6.3 显示设置 · 颜色规则**

1. 规则列表，每行：`最小天数`、`最大天数`、颜色选择器、预览徽章、删除按钮。
2. 「添加规则」「恢复默认」按钮。
3. 两个固定项：`已过期颜色`、`超出范围颜色`（不可删除）。
4. 实时预览区：按当前配置渲染 `-1 / 0 / 1 / 2 / 7 / 15 / 30` 天的卡片样例。
5. 保存校验：
   - `0 <= min <= max`
   - 任意两条规则区间不得重叠，违反时拒绝保存并高亮冲突的两条规则
6. 其他设置：
   - `darkMode`：`跟随系统` / `浅色` / `深色`

**FR-6.4 提醒设置**

| 项 | 规则 |
|---|---|
| 总开关 | 开 / 关；关闭后不产生任何推送 |
| 推送时间 | `HH:MM` 时间选择器，默认 `08:00`，支持任意分钟；旁注所属时区与重试规则 |
| 剩余天数提醒 | 多标签输入，默认 `1`、`3`、`5`；取值 `0–365`，去重，最多 10 个 |
| 周期提醒 | 开关 + 「未来 N 天内到期汇总」，N 默认 7，取值 1–30 |
| 无命中 | 无任何提醒命中时不发送推送 |

Bark 配置：

| 字段 | 规则 |
|---|---|
| 服务器地址 | 默认 `https://api.day.app`，可填自建地址 |
| Device Key | 密码输入框；已保存时显示 `••••••` 并提供「更换」 |
| 分组 | 默认 `date_alert` |
| 提示音 | 默认 `bell` |
| 级别 | `active`（默认）/ `timeSensitive` / `passive` / `critical` |
| 图标 URL | 选填 |

- 「发送测试推送」按钮：立即发送一条测试消息，并反馈成功或失败原因（HTTP 状态 + 错误信息）。
- 页面注明：同一次推送会合并为一条消息。

**FR-6.5 执行日志**

| 元素 | 规则 |
|---|---|
| 统计条 | 近 7 天成功次数 / 失败次数 |
| 筛选 | `全部` / `仅失败`；日期范围；分页 20 条 |
| 列表列 | 时间、触发方式、状态、条数、标题、耗时、错误摘要 |
| 失败行 | 整行标红 |
| 行点击 | 打开抽屉，按「请求」「响应」「异常」三段展示 `detail`，JSON 高亮，提供复制按钮 |
| 清空 | 「清空日志」按钮，二次确认 |

**FR-6.6 数据与备份**

| 功能 | 规则 |
|---|---|
| 导出 | 下载 JSON 文件，含全部提醒与设置；不含密码哈希、会话、Bark Device Key |
| 导入 | 上传 JSON；模式二选一：`合并`（按 id 更新/新增）、`替换`（清空后导入）；导入后需重新填写 Bark Device Key |
| 清空已归档 | 删除全部 `is_done = 1` 的提醒，二次确认 |

### FR-7 定时提醒

**FR-7.1 触发**

- 定时任务每分钟执行一次。
- 当日仅当本地时间落入 `[计划时间, 计划时间 + 30 分钟)` 区间时尝试推送。
- 计划时间与 30 分钟窗口相加跨日时，归属于计划时间所在的日期。

**FR-7.2 命中规则**

一条提醒满足以下任一条件即为命中：

| 条件 | 说明 |
|---|---|
| 剩余天数命中 | 剩余天数属于该提醒生效的天数集合（含 `0`）；负数与无日期不参与 |
| 周期汇总命中 | 周期提醒开启，且剩余天数在 `0` 到 `N` 之间（含两端） |

生效天数集合：

| 提醒的提醒方式 | 生效天数集合 |
|---|---|
| 跟随全局 | 系统设置的剩余天数列表 |
| 不提醒 | 空集 |
| 自定义 | 该提醒自己的天数列表 |

**FR-7.3 推送内容**

多条命中时合并为一条：

```
标题：📅 今日日期提醒 (3)
正文：• 科目1考试 · 还剩 3 天
      • 房租到期 · 还剩 1 天
      • 体检复查 · 今天到期
```

单条命中时：

```
标题：科目1考试 · 还剩 3 天
正文：{备注}
```

- 超过 10 条时截断，尾部追加「…等共 N 条」。
- 推送不含跳转链接。

**FR-7.4 重试**

- 每次定时任务只尝试发送 1 次。
- 失败后由窗口内的**后续每分钟**继续尝试，累计尝试达到 3 次后停止。
- 成功一次即写入 `status = ok`，后续分钟因幂等检查不再发送。
- 窗口结束后不再补发（避免深夜打扰）。

### FR-8 执行日志

**FR-8.1 记录范围**

| 场景 | channel | trigger | status |
|---|---|---|---|
| 推送成功 | `bark` | `cron` | `ok` |
| 推送失败 | `bark` | `cron` | `failed` |
| 测试推送 | `bark` | `test` | `ok` 或 `failed` |
| 定时任务内部异常 | `internal` | `cron` | `failed` |

- 无命中项的定时任务不写日志。

**FR-8.2 失败详情**

失败时 `detail` 必填，结构：

```jsonc
{
  "attempt": 2,
  "request": {
    "method": "POST",
    "url": "https://api.day.app/••••••/",
    "headers": { "content-type": "application/json" },
    "bodyPreview": "{...}"
  },
  "response": {
    "status": 502,
    "statusText": "Bad Gateway",
    "headers": { "content-type": "application/json", "cf-ray": "..." },
    "bodySnippet": "{...}"
  },
  "error": { "name": "HttpError", "message": "Bark returned 502", "stack": "..." },
  "timings": { "startedAt": "2026-11-10T00:29:58.120Z", "elapsedMs": 2831 }
}
```

约束：

- `request.bodyPreview` 最多 2000 字符，超出截断。
- `response.bodySnippet` 最多 2000 字符，超出截断。
- `error.stack` 最多 2000 字符，超出截断。
- `request.url` 中的 Device Key 替换为 `••••••`。

---

## 3. 业务规则

### BR-1 日期与剩余天数

```ts
/** 指定时区的"今天"，格式 YYYY-MM-DD */
export function todayInTz(tz: string, now?: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now ?? new Date());
}

/** 剩余天数 */
export function daysLeft(dueDate: string, today: string): number {
  const a = Date.parse(dueDate + 'T00:00:00Z');
  const b = Date.parse(today + 'T00:00:00Z');
  return Math.round((a - b) / 86_400_000);
}
```

- 到期日只以 `YYYY-MM-DD` 存储，不使用时间戳。
- 「今天」只由系统设置的时区决定，与访问者浏览器时区无关。
- 必须正确处理：跨年、闰日、夏令时切换日、`UTC+14`、`UTC-11`。
- 时区小时取值需做 `% 24` 归一化。

### BR-2 颜色匹配

```
若 days < 0        → 已过期颜色
否则若命中规则     → 该规则颜色（规则区间为闭区间）
否则               → 超出范围颜色
```

卡片配色由规则色派生：

```css
.card {
  --c: var(--rule-color);
  background: color-mix(in srgb, var(--c) 8%, #fff);
  border-left: 4px solid var(--c);
  color: color-mix(in srgb, var(--c) 65%, #111);
}
[data-theme='dark'] .card {
  background: color-mix(in srgb, var(--c) 18%, #0f172a);
  color: color-mix(in srgb, var(--c) 35%, #fff);
}
```

### BR-3 自动归档

- 到期日早于今天（按时区）且未归档的提醒，自动置为已归档，`done_by = 'auto'`。
- 未设置日期（`due_date` 为空）的提醒不参与自动归档。
- 定时任务每次执行均做归档判定，操作幂等。
- 创建或编辑时若到期日已过期，立即归档。
- 归档后：不出现在首页、不参与推送、在「已归档」列表可见。

### BR-4 手动操作

| 操作 | 结果 |
|---|---|
| 归档 | `is_done = 1`，`done_by = 'manual'`，`done_at` = 当前时间 |
| 恢复 | `is_done = 0`，清空 `done_at` 与 `done_by` |
| 彻底删除 | 物理删除记录 |

### BR-5 定时任务流程

```
1. 读取设置
2. 计算本地时间 { date, hh, mm }
3. 执行自动归档；若 mm == 0 则执行数据清理
4. 若总开关关闭或 Bark 关闭：结束
5. 计算 now = hh*60+mm，sched = 计划时间折算分钟数
   若 now < sched：schedDate = date 的前一天，now += 1440
   否则：schedDate = date
   若 now < sched 或 now >= sched + 30：结束
6. run_key = `${schedDate}T${计划时间}`
   若已存在 (run_key, 'bark') 且状态为成功：结束
   若已存在且尝试次数 >= 3：结束
7. 收集命中提醒，按 id 去重
8. 若无命中：结束（不写日志）
9. 组装并发送推送
10. 写入或更新日志记录
```

**30 分钟窗口的含义**：从计划时间起的 30 分钟内，每分钟的定时任务共用同一个 `run_key`，
因此都算作"同一次推送"的重试机会。每次触发只发送 1 次，累计 3 次失败后放弃；
一旦某次成功，后续分钟因幂等检查直接跳过。窗口结束后不再补发（避免深夜打扰）。

### BR-6 幂等

- 日志表 `(run_key, channel)` 唯一。
- `run_key` 使用计划时间生成，同一次推送的所有重试写入同一行。
- 已成功的记录不再发送；尝试次数达到 3 次后不再发送。
- 测试推送的 `run_key` 为 `test:<uuid>`，不参与幂等判断。

### BR-7 数据清理

本地分钟为 `00` 时执行：

| 对象 | 清理条件 |
|---|---|
| 会话 | `expires_at` 早于当前时间 |
| 登录尝试 | 早于 30 天 |
| 执行日志 | 早于 90 天 |

执行日志额外只保留最近 1000 条。

### BR-8 配置优先级

| 项 | 优先级 |
|---|---|
| 界面语言 | 本地存储的用户选择 > 系统设置默认语言 > 浏览器语言 > 简体中文 |
| 深色模式 | 本地存储的用户选择 > 系统设置（`跟随系统` 时读取系统偏好） |
| 时区 | 仅系统设置 |
| 推送语言 | 仅系统设置 |

前端手动切换语言与主题只写入浏览器本地存储，不写回服务端。

---

## 4. 数据需求

### DR-1 表结构

```sql
CREATE TABLE IF NOT EXISTS reminders (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  note           TEXT NOT NULL DEFAULT '',
  due_date       TEXT NOT NULL,
  is_public      INTEGER NOT NULL DEFAULT 1,
  is_done        INTEGER NOT NULL DEFAULT 0,
  done_at        TEXT,
  done_by        TEXT,
  notify_mode    TEXT NOT NULL DEFAULT 'global',
  notify_offsets TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reminders_active ON reminders(is_done, due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_public ON reminders(is_public, is_done, due_date);

CREATE TABLE IF NOT EXISTS settings (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  json       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash        TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  updated_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip         TEXT,
  ua         TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  ts TEXT NOT NULL,
  ok INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_ip ON login_attempts(ip, ts);

CREATE TABLE IF NOT EXISTS notify_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  run_key     TEXT NOT NULL,
  local_date  TEXT NOT NULL,
  channel     TEXT NOT NULL,
  trigger     TEXT NOT NULL,
  status      TEXT NOT NULL,
  item_count  INTEGER NOT NULL DEFAULT 0,
  title       TEXT,
  body        TEXT,
  http_status INTEGER,
  elapsed_ms  INTEGER,
  attempts    INTEGER NOT NULL DEFAULT 1,
  error       TEXT,
  detail      TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notify_run ON notify_log(run_key, channel);
CREATE INDEX IF NOT EXISTS idx_notify_status ON notify_log(status, created_at);
```

### DR-2 字段约束

**reminders**

| 字段 | 约束 |
|---|---|
| `id` | UUID v4 |
| `title` | 1–50 字符 |
| `note` | 0–200 字符 |
| `due_date` | 合法 `YYYY-MM-DD`；空字符串表示「不设置日期」 |
| `is_public` | `0` / `1` |
| `is_done` | `0` / `1` |
| `done_by` | `auto` / `manual` / `NULL` |
| `notify_mode` | `global` / `off` / `custom` |
| `notify_offsets` | `custom` 时为 JSON 整数数组，元素 0–365，去重，最多 10 个；其他模式为 `NULL` |

**notify_log**

| 字段 | 约束 |
|---|---|
| `run_key` | `YYYY-MM-DDTHH:MM` 或 `test:<uuid>` |
| `channel` | `bark` / `internal` |
| `trigger` | `cron` / `test` |
| `status` | `ok` / `failed` |
| `detail` | `failed` 时必填，合法 JSON 字符串 |

### DR-3 时间存储

- 所有时间戳字段统一为 ISO-8601 UTC 字符串，例如 `2026-11-09T02:00:00Z`。
- `due_date` 为日历日 `YYYY-MM-DD`，与时区语义绑定。
- 时间戳与日历日不得混用。

### DR-4 系统设置结构

单行 JSON，读取时与默认值深合并。

```jsonc
{
  "tz": "Asia/Shanghai",
  "lang": "zh-CN",
  "notifyLang": "zh-CN",

  "colors": {
    "overdue": "#94A3B8",
    "default": "#3B82F6",
    "rules": [
      { "id": "r1", "min": 0, "max": 1, "color": "#F59E0B", "label": "即将到期" },
      { "id": "r2", "min": 2, "max": 7, "color": "#10B981", "label": "一周内" }
    ]
  },

  "notify": {
    "enabled": true,
    "time": "08:00",
    "offsets": [1, 3, 5],
    "digest": { "enabled": true, "windowDays": 7 },
    "bark": {
      "enabled": true,
      "baseUrl": "https://api.day.app",
      "keyCipher": "base64(iv|ct|tag)",
      "group": "date_alert",
      "sound": "bell",
      "level": "active",
      "icon": ""
    }
  },

  "display": {
    "darkMode": "auto"
  }
}
```

| 字段 | 取值 |
|---|---|
| `lang` | `zh-CN` / `zh-TW` / `en` / `auto` |
| `notifyLang` | `zh-CN` / `zh-TW` / `en` |
| `darkMode` | `auto` / `light` / `dark` |
| `time` | `HH:MM` |
| `offsets` | 整数数组，元素 0–365，最多 10 个 |
| `windowDays` | 1–30 |
| `level` | `active` / `timeSensitive` / `passive` / `critical` |
| `keyCipher` | AES-256-GCM 加密后的 Device Key，Base64(`iv ‖ 密文 ‖ tag`) |

### DR-5 保留策略

| 数据 | 保留 |
|---|---|
| 会话 | 到期即删 |
| 登录尝试 | 30 天 |
| 执行日志 | 90 天且最多 1000 条 |
| 提醒 | 永久，除非手动删除 |

---

## 5. 接口需求

### 5.1 通用约定

**错误响应**

```jsonc
{ "error": { "code": "VALIDATION_FAILED", "message": "title is required",
             "fields": { "title": "长度需为 1-50" } } }
```

| HTTP | code |
|---|---|
| 400 | `BAD_JSON` / `VALIDATION_FAILED` |
| 401 | `UNAUTHENTICATED` / `PASSWORD_WRONG` |
| 403 | `MUST_CHANGE_PASSWORD` |
| 404 | `NOT_FOUND` |
| 409 | `RULE_OVERLAP`（附 `conflict: [ruleId, ruleId]`） |
| 429 | `TOO_MANY_ATTEMPTS`（附 `retryAfter` 秒数） |
| 500 | `INTERNAL` |

**分页响应**

```jsonc
{ "items": [], "total": 0, "page": 1, "size": 20 }
```

**其他**

- 请求体上限 32KB。
- 需要登录的接口未携带有效会话时返回 401。
- `must_change_password = 1` 时，除登录、登出、改密外的后台接口一律返回 403。
- 所有写操作校验 `Origin` 头与当前站点同源。

### 5.2 公开接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/public/reminders` | 首页数据，无需登录 |

查询参数：

| 参数 | 默认 | 限制 | 说明 |
|---|---|---|---|
| `limit` | 60 | 1–200 | 单页条数 |
| `offset` | 0 | 0–100000 | 偏移量 |

响应：

```jsonc
{
  "today": "2026-11-09",
  "tz": "Asia/Shanghai",
  "total": 72,
  "limit": 60,
  "offset": 0,
  "lang": "auto",
  "items": [
    { "id": "...", "title": "科目1考试", "note": "考试理论",
      "dueDate": "2026-12-09", "daysLeft": 30,
      "color": "#3B82F6", "label": "计划中", "labelKey": "fallback" },
    { "id": "...", "title": "资料整理", "note": "",
      "dueDate": "", "daysLeft": null,
      "color": "#64748B", "label": "无日期", "labelKey": "undated" }
  ]
}
```

- `total` 为公开且未归档提醒总数；`items.length < total` 时前端展示「加载更多」。
- 排序：有日期在前（按到期日升序），无日期在后（按创建时间倒序）。
- 无日期项 `daysLeft` 为 `null`，`labelKey` 为 `undated`，颜色固定 `#64748B`。
- `color` 与 `label` 由服务端按颜色规则计算下发，前端不重复实现匹配逻辑。
- 响应头：`Cache-Control: no-store`（与其余接口一致，保证数据与部署更新后立即生效）。
- 不返回 `is_public = 0` 的提醒。

### 5.3 认证接口

| 方法 | 路径 | 请求体 | 说明 |
|---|---|---|---|
| GET | `/api/auth/me` | — | `{ initialized, authenticated, mustChangePassword, setupRequiresToken }` |
| POST | `/api/auth/setup` | `{ password, token? }` | 首次初始化；已初始化返回 403 `ALREADY_INITIALIZED`，令牌错误返回 403 `SETUP_TOKEN_INVALID` |
| POST | `/api/auth/login` | `{ password, remember }` | 成功设置会话 Cookie；返回 `{ initialized, authenticated, mustChangePassword }` |
| POST | `/api/auth/logout` | — | 删除当前会话并清 Cookie |
| GET | `/api/auth/me` | — | `{ authenticated, mustChangePassword }` |
| POST | `/api/auth/change-password` | `{ oldPassword, newPassword }` | 成功后清空全部会话并为当前设备重新签发 |

**登录错误码**

| 场景 | HTTP | code |
|---|---|---|
| 密码未填 | 400 | `VALIDATION_FAILED` |
| 密码错误 | 401 | `PASSWORD_WRONG` |
| 同一 IP 15 分钟内失败 5 次 | 429 | `TOO_MANY_ATTEMPTS`（响应体与 `Retry-After` 头均带剩余秒数） |

**登录限频**

- 统计口径：同一 IP、`ok = 0`、最近 15 分钟。
- 达到 5 次后拒绝，即使密码正确也拒绝，直到窗口滑过。
- IP 取自 `CF-Connecting-IP`，缺失时依次回退 `X-Forwarded-For`、`local`。

**改密接口**

- 未登录返回 401 `UNAUTHENTICATED`。
- 旧密码错误返回 401 `PASSWORD_WRONG`。
- 新密码不合规返回 400 `VALIDATION_FAILED`，并附 `issues` 数组（`PASSWORD_LENGTH` / `PASSWORD_LETTER` / `PASSWORD_DIGIT`）。
- 新旧密码相同返回 400 `VALIDATION_FAILED`。
- 成功：更新哈希、置 `must_change_password = 0`、删除全部会话、为当前设备新建会话并下发 Cookie。

**会话 Cookie**：名称 `da_session`，属性 `HttpOnly; SameSite=Lax; Path=/`，有效期 7 天（`remember: true` 时为 30 天）。仅在请求协议为 `https:` 时附加 `Secure`；本地 `http://localhost` 调试下不加。

### 5.4 管理接口（需登录）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/reminders?scope=active\|archived\|undated\|all&q=&page=1&size=20` | 列表（`size` 上限 100） |
| GET | `/api/admin/reminders/:id` | 单条详情 |
| POST | `/api/admin/reminders` | 创建 |
| PATCH | `/api/admin/reminders/:id` | 部分更新 |
| POST | `/api/admin/reminders/:id/archive` | 归档 |
| POST | `/api/admin/reminders/:id/restore` | 恢复 |
| DELETE | `/api/admin/reminders/:id` | 物理删除 |
| GET | `/api/admin/settings` | 读取设置（`keyCipher` 脱敏为 `hasKey: true`） |
| PUT | `/api/admin/settings` | 整体保存；`key` 为明文时加密存储 |
| POST | `/api/admin/settings/test-bark` | 发送测试推送 |
| GET | `/api/admin/logs?status=all\|failed&from=&to=&page=1&size=20` | 执行日志 |
| DELETE | `/api/admin/logs` | 清空执行日志 |
| GET | `/api/admin/export` | 导出 JSON |
| POST | `/api/admin/import` | 导入，`{ mode: "merge" \| "replace", data }` |
| POST | `/api/admin/reminders/purge-archived` | 删除全部已归档提醒 |

**创建 / 编辑请求体**

```jsonc
{
  "title": "科目1考试",
  "note": "考试理论",
  "dueDate": "2026-12-09",
  "isPublic": true,
  "notifyMode": "global",
  "notifyOffsets": null
}
```

**列表响应**

```jsonc
{
  "items": [
    {
      "id": "...", "title": "科目1考试", "note": "考试理论",
      "dueDate": "2026-12-09", "daysLeft": 30,
      "color": "#3B82F6", "label": "计划中",
      "isPublic": true, "isDone": false, "doneBy": null, "doneAt": null,
      "notifyMode": "global", "notifyOffsets": null,
      "createdAt": "...", "updatedAt": "..."
    }
  ],
  "total": 7, "page": 1, "size": 20
}
```

- 创建成功返回 `201 { item }`；创建时若到期日已过期，`item.isDone` 直接为 `true`。
- 编辑、归档、恢复返回 `200 { item }`。
- 删除返回 `200 { deleted: true }`；`purge-archived` 返回 `200 { deleted: N }`。
- 校验失败返回 `400 VALIDATION_FAILED`，附 `issues: [{ code, field, message }]`。
- 目标不存在返回 `404 NOT_FOUND`。

**设置保存请求体**

与 DR-4 结构一致。`notify.bark` 的两个特殊字段：

| 字段 | 说明 |
|---|---|
| `key` | 明文 Device Key；传入即加密覆盖，不传则保持不变 |
| `clearKey` | `true` 时清除已存密钥 |

- 服务端先把 `key` 加密为 `keyCipher` 再校验，校验失败返回 `400 VALIDATION_FAILED` 或 `409 RULE_OVERLAP`（附 `issues`）。
- 响应为脱敏后的完整设置（`hasKey` 表示是否已配置密钥，永不返回密文）。

**测试推送响应**

```jsonc
{ "ok": true, "httpStatus": 200, "elapsedMs": 312, "error": null }
```

- 未配置 Device Key 返回 `400 BARK_KEY_MISSING`。
- 每次测试推送都会写入执行日志（`trigger = test`，`run_key = test:<uuid>`）。

**执行日志响应**

```jsonc
{
  "items": [
    { "id": 1, "run_key": "2026-11-10T08:00", "local_date": "2026-11-10",
      "channel": "bark", "trigger": "cron", "status": "ok", "item_count": 3,
      "title": "今日日期提醒 (3)", "body": "…", "http_status": 200,
      "elapsed_ms": 412, "attempts": 1, "error": null, "detail": {}, "created_at": "…" }
  ],
  "total": 12, "page": 1, "size": 20,
  "stats7d": { "ok": 11, "failed": 1 }
}
```

**导出格式**

```jsonc
{
  "version": 1,
  "exportedAt": "2026-11-10T01:00:00Z",
  "settings": { /* 同 GET /settings，不含密钥 */ },
  "reminders": [ { "id": "...", "title": "...", "due_date": "2026-12-09", "is_public": 1, /* … */ } ]
}
```

**导入**：`{ mode: "merge" | "replace", data: <导出的对象> }`

- `merge`：按 `id` UPSERT；`replace`：先清空 reminders 再导入。
- 逐条校验，非法条目计入 `skipped`，不中断整体导入。
- `data.settings` 存在时同步保存，但**忽略**其中的密钥字段，保留当前密钥。

---

## 6. 界面需求

### 6.1 页面清单

| 路径 | 页面 | 权限 |
|---|---|---|
| `/` | 首页卡片墙 | 公开 |
| `/login` | 登录 | 公开 |
| `/change-password` | 修改密码 | 需登录 |
| `/admin` | 管理后台（两个 Tab） | 需登录 |

前端使用 history 路由，未匹配路径回落到首页。

### 6.2 视觉规范

| 类别 | 值 |
|---|---|
| 字体 | `system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans TC", sans-serif` |
| 数字 | 继承字体 + `font-variant-numeric: tabular-nums` |
| 圆角 | 卡片 16px、按钮与输入框 10px、徽章 999px |
| 间距刻度 | 4 / 8 / 12 / 16 / 24 / 32 / 48 px |
| 页面容器 | 最大宽度 1200px；左右内边距 桌面 32px、移动 16px |
| 卡片 | 最小高度 132px，内边距 16px，网格间距 16px |
| 阴影 | 常态 `0 1px 2px rgb(0 0 0 / .06)`；悬停 `0 8px 24px rgb(0 0 0 / .10)` |
| 页面底色 | 浅色 `#F8FAFC` / 深色 `#0B1220` |
| 正文色 | 浅色 `#0F172A`，次要 `#64748B`；深色 `#E2E8F0`，次要 `#94A3B8` |
| 强调色 | `#2563EB` |
| 动效 | 时长 160ms，缓动 `cubic-bezier(.4,0,.2,1)` |
| 焦点环 | `outline: 2px solid #2563EB; outline-offset: 2px` |
| 剩余天数 | 数字 40px / 字重 700，单位 14px / 字重 500 |
| 卡片标题 | 18px / 字重 600 |
| 卡片备注 | 12px |
| 卡片日期 | 11px |

上述数值以 CSS 变量形式集中定义于 `web/src/styles/tokens.css`。

### 6.3 无障碍

- 颜色不作为唯一信息载体：卡片固定显示状态标签。
- 所有可交互元素可通过 Tab 键到达，焦点环可见。
- 纯图标按钮必须提供 `aria-label`。
- 正文与背景对比度不低于 4.5:1（浅色与深色模式均需满足）。
- 系统开启「减少动态效果」时关闭呼吸、滑入等动画。

### 6.4 国际化

- 语言包：`web/src/i18n/{zh-CN,zh-TW,en}.json`，扁平 key，例如 `home.empty`、`admin.tab.notify`。
- 服务端推送文案使用 `src/i18n.server.ts` 中的同结构子集。
- 日期与数字格式通过 `Intl` 按语言渲染。
- 页面所有用户可见文案不得硬编码，必须经语言包。
- 站点名随语言变化：`日期提醒` / `日期提醒` / `Date Alert`；切换语言时同步更新 `document.title`。静态 `<title>` 与 `manifest.webmanifest` 使用默认名「日期提醒」。
- 颜色规则的标签属于用户数据，不随语言翻译；默认规则标签由初始化数据提供。

### 6.5 安装与离线

- 提供 `manifest.webmanifest` 与 192/512 图标，支持添加到主屏幕。
- 不要求离线可用。

---

## 7. 非功能需求

### NFR-1 性能与额度

| 项 | 目标 |
|---|---|
| 单次请求 CPU | ≤ 10ms（免费额度上限） |
| 接口缓存 | 所有 `/api/*` 响应 `Cache-Control: no-store` |
| 静态资源 | `index.html` 与页面路由 `no-store`；`/assets/*`（内容哈希）`max-age=31536000, immutable` |
| 首屏资源 | ≤ 100KB（gzip） |
| 定时任务频率 | 每分钟 1 次 |
| 免费额度占用 | 请求、D1 读写、存储均低于额度的 10% |

### NFR-2 安全

| 项 | 要求 |
|---|---|
| 密码哈希 | PBKDF2-SHA256，10,000 次迭代，16 字节随机盐，32 字节输出，存储格式 `pbkdf2$10000$<saltB64>$<hashB64>` |
| 密码 pepper | 输入为 `password + "|" + SHA-256(SECRET_KEY + "|password-v1")`；pepper 不落库 |
| 密码哈希耗时 | 单次登录校验 ≤ 6ms CPU |
| 哈希比较 | 常量时间比较 |
| 密码长度 | 12–64 字符 |
| 会话令牌 | 32 字节随机值；Cookie 存明文，数据库存 SHA-256 |
| Cookie | `HttpOnly; Secure; SameSite=Lax; Path=/` |
| CSRF | 写操作校验 `Origin` 同源 |
| 防爆破 | 同一 IP 15 分钟内失败 5 次即锁定 15 分钟 |
| Bark Device Key | AES-256-GCM 加密存储；密钥由 `SECRET_KEY` 经 HKDF 派生，info 为 `bark-v1` |
| 密钥下发 | 读取设置时永不返回明文，只返回 `hasKey` |
| 日志脱敏 | 日志中 Device Key 显示为 `••••••`；不记录密码、Cookie |
| 首页数据 | 只返回公开字段 |

### NFR-3 兼容性

- 支持最近两个大版本的 Chrome、Edge、Safari、Firefox。
- 依赖 `color-mix()`、`Intl.DateTimeFormat` 时区能力、`crypto.subtle`。
- 移动端宽度 320px 起可用。

### NFR-4 可维护性

- 服务端与前端均为 TypeScript。
- 纯函数（日期计算、颜色匹配、调度窗口判定）必须有单元测试。
- 数据库变更通过 `migrations/` 目录管理。

---

## 8. 项目结构

```
date_alert/
├─ .dev.vars                  # 本地 SECRET_KEY（不入库）
├─ .gitignore
├─ .npmrc
├─ docs/DESIGN.md
├─ migrations/0001_init.sql
├─ scripts/
│  ├─ shared.mjs             # 密钥/哈希/密码/终端打印
│  ├─ init.mjs
│  └─ reset-password.mjs
├─ src/
│  ├─ index.ts               # Hono 入口 + scheduled 导出
│  ├─ cron.ts                # 调度窗口判定、归档、清理
│  ├─ types.ts               # Env / Settings 等类型
│  ├─ api/{public,auth,admin}.ts
│  ├─ lib/
│  │  ├─ time.ts  time.test.ts
│  │  ├─ crypto.ts  crypto.test.ts
│  │  ├─ validation.ts  validation.test.ts
│  │  ├─ reminders.ts  reminders.test.ts
│  │  ├─ settings.ts
│  │  ├─ color.ts  color.test.ts
│  │  ├─ bark.ts             # Bark 客户端（含脱敏诊断）
│  │  ├─ i18n.server.ts      # 推送文案（三语言）
│  │  └─ settings-validation.ts  settings-validation.test.ts
│  └─ middleware/
│     └─ session.ts          # 会话 + 登录限频
├─ web/
│  ├─ index.html
│  ├─ vite.config.ts
│  ├─ tailwind.config.ts
│  ├─ postcss.config.js
│  ├─ tsconfig.json
│  └─ src/
│     ├─ main.ts
│     ├─ App.vue             # 壳：RouterView + Toast + Confirm
│     ├─ router.ts           # 路由与守卫
│     ├─ env.d.ts
│     ├─ api/
│     │  ├─ client.ts
│     │  └─ admin.ts
│     ├─ components/
│     │  ├─ ReminderCard.vue
│     │  ├─ ReminderFormDialog.vue
│     │  ├─ ReminderDrawer.vue
│     │  ├─ AppToast.vue
│     │  └─ AppConfirm.vue
│     ├─ composables/
│     │  ├─ usePublicReminders.ts
│     │  ├─ useAdminReminders.ts
│     │  ├─ useSession.ts
│     │  ├─ useTheme.ts
│     │  ├─ useToast.ts
│     │  └─ useConfirm.ts
│     ├─ pages/
│     │  ├─ HomePage.vue
│     │  ├─ LoginPage.vue
│     │  ├─ ChangePasswordPage.vue
│     │  └─ AdminPage.vue
│     ├─ components/settings/
│     │  ├─ SettingsTab.vue
│     │  ├─ TimeLocaleSection.vue
│     │  ├─ ColorSection.vue
│     │  ├─ NotifySection.vue
│     │  ├─ LogsSection.vue
│     │  └─ DataSection.vue
│     ├─ i18n/index.ts       # 三语言字典 + t()
│     ├─ lib/color.ts        # 前端预览用配色
│     ├─ styles/main.css
│     └─ public/             # manifest + 图标
├─ tsconfig.json
├─ wrangler.toml
├─ README.md
└─ package.json
```

---

## 9. 部署与配置

### 9.1 wrangler.toml

```toml
name = "date-alert"
main = "src/index.ts"
compatibility_date = "2025-09-01"

[assets]
directory = "./web/dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*"]

[[d1_databases]]
binding = "DB"
database_name = "date-alert"
database_id = "<创建后填入>"
migrations_dir = "migrations"

[triggers]
crons = ["* * * * *"]

[observability]
enabled = true
```

### 9.2 环境变量与绑定

| 名称 | 类型 | 用途 |
|---|---|---|
| `DB` | D1 binding | 数据存储 |
| `ASSETS` | Assets binding | 静态资源 |
| `SECRET_KEY` | Secret，32 字节 Base64 | 派生加密 Device Key 的密钥 |
| `SETUP_TOKEN` | Secret（可选） | 设置后首次初始化必须携带相同令牌 |

### 9.3 npm scripts

```jsonc
{
  "dev":      "concurrently 'wrangler dev' 'vite --config web/vite.config.ts'",
  "build":    "vite build --config web/vite.config.ts",
  "db:local": "wrangler d1 migrations apply date-alert --local",
  "test":     "vitest run",
  "init":     "node scripts/init.mjs",
  "reset:password": "node scripts/reset-password.mjs",
  "deploy":   "npm run build && wrangler d1 migrations apply date-alert --remote && wrangler deploy"
}
```

### 9.4 首次部署

执行顺序：

```bash
npm install
npx wrangler login
npx wrangler d1 create date-alert          # 将 database_id 填入 wrangler.toml
npm run build
npx wrangler d1 migrations apply date-alert --remote
npm run init
npm run deploy
```

`scripts/init.mjs` 行为（支持 `--local` / `--password <值>`）：

1. 读取 `SECRET_KEY`：优先环境变量，其次 `.dev.vars`；都没有时生成 32 字节随机值并写入 `.dev.vars`（权限 600）。
2. 未指定 `--password` 时生成 16 字符随机密码（字母 + 数字，排除 `0 O 1 l I`）。
3. 本地计算带 pepper 的 PBKDF2 哈希（10,000 次迭代）。
4. 写入 `admin` 表：`password_hash` 更新、`must_change_password = 1`（UPSERT）。
5. 远端模式下尝试 `wrangler secret put SECRET_KEY`；失败时打印手动命令与密钥值。
6. 以对齐边框在终端打印初始密码，提示仅显示一次。

pepper 由 `SECRET_KEY` 派生（`SHA-256(SECRET_KEY + "|password-v1")`），初始化脚本与 Worker 必须使用同一公式。

`scripts/reset-password.mjs` 行为（支持 `--local` / `--password <值>`）：

1. 生成新密码并更新 `admin.password_hash`。
2. 置 `must_change_password = 1`。
3. 清空 `sessions`。
4. 打印新密码。

### 9.5 本地开发

| 操作 | 命令 |
|---|---|
| 构建前端 | `npm run build` |
| 启动 Worker + Vite | `npm run dev`（先构建，再并行启动 8787 与 5173） |
| 应用本地迁移 | `npm run db:local` |
| 手动触发定时任务 | `curl http://localhost:8787/cdn-cgi/local/scheduled` |
| 单元测试 | `npm test` |

- 本地 D1 数据位于 `.wrangler/state`。
- 本地密钥通过 `.dev.vars` 提供 `SECRET_KEY`，该文件不提交版本库。

---

## 10. 交付阶段

| 阶段 | 内容 | 完成标志 |
|---|---|---|
| M0 | 工程骨架：wrangler 配置、Vite + Vue 最小页面、Hono 路由、D1 迁移、首页只读渲染 | `npm run dev` 可访问页面；`/api/public/reminders` 返回正确 `daysLeft`；本地 D1 迁移成功；`wrangler deploy` 线上可访问 |
| M1 | 纯函数与单测：日期计算、颜色匹配、调度窗口判定 | 单元测试全部通过，覆盖跨年、闰日、夏令时、UTC±14、跨零点窗口 |
| M2 | 首页：公开接口、卡片墙、颜色派生、响应式、深色模式 | 首页可浏览并正确显示天数与颜色 |
| M3 | 认证：初始化/重置脚本、首次初始化页、登录、强制改密、会话、防爆破、路由守卫 | 空库首访跳 `/setup`；未登录访问 `/admin` 跳登录；强制改密无法绕过；改密后旧会话失效 |
| M4 | Tab 1：列表（筛选/搜索/分页）、创建、编辑、归档、恢复、删除、清空已归档、详情抽屉 | 提醒管理功能完整；编辑或创建过期日期会立即归档 |
| M5 | Tab 2：账号安全、时区与语言、颜色规则与显示、提醒设置（含 Bark 加密与测试推送）、执行日志、数据备份 | 设置可保存并即时生效；颜色规则重叠被拒绝 |
| M6 | 通知：每分钟定时任务、命中合并、Bark 发送与重试、执行日志落库 | 到点收到推送；失败 3 次后停止并可在日志中定位 |
| M7 | 三语言（含推送文案）、PWA 清单与图标、空状态、动画、导出导入 | 语言切换无硬编码残留；可添加到主屏幕 |
| M8 | 文档：README（本地开发、部署、运维、限制） | 线上可用 |

---

## 11. 验收标准

### AC-0 无日期提醒

- [ ] 新建时勾选「不设置日期」，保存后出现在首页「未设置日期」分区
- [ ] 该卡片显示「无日期」，不显示到期日与状态 chip
- [ ] 后台筛选「无日期」能一键筛出
- [ ] 触发定时任务后它不会被自动归档，也不会进入推送内容
- [ ] 备注超过 2 行时，鼠标悬停卡片可看到全文

### AC-1 日期与颜色

- [ ] 到期日为今天时，首页显示「今天」，使用 `0-1` 区间颜色
- [ ] 到期日为明天时，显示「1 天」，使用 `0-1` 区间颜色
- [ ] 到期日为 8 天后时，使用超出范围颜色
- [ ] 到期日为昨天时，已自动归档，首页不显示，「已归档」列表可见
- [ ] 修改时区后，天数与归档行为随新时区变化
- [ ] 浏览器日期跨天后，首页静默刷新且天数正确
- [ ] 颜色规则重叠时保存被拒绝，并高亮冲突的两条规则
- [ ] 计划时间设为 `23:50` 时，当日只产生 1 条推送

### AC-2 认证

- [ ] 空库首次访问任意页面会被重定向到 `/setup`
- [ ] `/setup` 设置密码后自动登录并进入 `/admin`，再次访问 `/setup` 被弹走
- [ ] 已初始化后调用 `/api/auth/setup` 返回 403
- [ ] 配置了 `SETUP_TOKEN` 时，缺少或错误令牌返回 403

- [ ] 首次部署后终端打印初始密码，数据库中不存在明文密码
- [ ] 首次登录强制跳转改密页，且无法通过直接访问 `/admin` 绕过
- [ ] 未改密时调用其他后台接口返回 403
- [ ] 改密后其他设备的会话失效
- [ ] 连续 5 次密码错误后锁定 15 分钟
- [ ] 重置脚本可恢复访问
- [ ] 密码长度 11 与 65 时被拒绝

### AC-3 提醒

- [ ] 设置 `08:37` 与天数 `1,3,5` 后，在对应天数 08:37 收到推送
- [ ] 多条提醒同时命中时只收到 1 条合并推送
- [ ] 无命中项时当日不推送，且不写执行日志
- [ ] 关闭总开关后不推送
- [ ] 单条提醒设为「不提醒」后不出现在推送中
- [ ] 手动触发定时任务两次，第二次不重复推送
- [ ] Bark 地址不可达时，窗口内尝试 3 次后停止，执行日志可查看请求、响应、异常三段详情
- [ ] 推送内容不含跳转链接
- [ ] 执行日志中 Device Key 显示为 `••••••`
- [ ] 测试推送按钮即时反馈成功或失败原因

### AC-4 管理与设置

- [ ] 创建到期日为昨天的提醒后，立即进入历史，首页不显示，表单有提示
- [ ] 三语言切换覆盖所有用户可见文案，无硬编码残留
- [ ] 首页在 390px 宽度下无横向滚动，卡片标签完整可见
- [ ] 深色模式下正文与背景对比度不低于 4.5:1
- [ ] 手机端：卡片 1 列、详情为底部面板、日期选择器可操作
- [ ] 未登录连续点击同一张卡片 3 次后出现登录提示
- [ ] 导出后再导入，提醒与设置数据一致
- [ ] 导出文件不包含 Bark Device Key
- [ ] 首页超过 60 条时出现「加载更多」，每次追加 60 条

---

## 12. 默认值

| 项目 | 默认值 |
|---|---|
| 时区 | `Asia/Shanghai` |
| 默认语言 | 跟随浏览器（兜底 `zh-CN`） |
| 推送语言 | `zh-CN` |
| 颜色规则 | `0-1` → `#F59E0B`（即将到期）；`2-7` → `#10B981`（一周内） |
| 已过期颜色 | `#94A3B8` |
| 超出范围颜色 | `#3B82F6` |
| 推送时间 | `08:00` |
| 剩余天数提醒 | `1`、`3`、`5` |
| 周期汇总 | 开启，未来 7 天 |
| 推送窗口 | 30 分钟 |
| 单次最大尝试次数 | 3 |
| 首页卡片上限 | 60 条 / 页 |
| 列表分页 | 20 条 / 页 |
| 标题 / 备注长度 | 50 / 200 字符 |
| 会话有效期 | 7 天；记住我 30 天 |
| 密码长度 | 12–64 字符 |
| 初始密码 | 16 字符随机 |
| 密码哈希迭代 | 10,000 |
| 登录锁定 | 15 分钟 / 5 次失败 |
| Bark 分组 | `date_alert` |
| Bark 提示音 | `bell` |
| Bark 级别 | `active` |
| 执行日志保留 | 90 天且最多 1000 条 |

---

## 13. 不在本期范围

- 邮件通知、群机器人通知、通用 Webhook
- 多用户与权限
- 重复性提醒（每年/每月循环）
- 提醒分组、标签、置顶
- 日历订阅（iCal）
- 离线可用
- 推送内跳转链接与深链
- 数据统计与图表
