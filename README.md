# 日期提醒 · date_alert

部署在 Cloudflare 上的极简日期倒计时提醒：**公开卡片墙 + 后台管理 + Bark 定时推送**。

只使用 Cloudflare 自身资源（Workers / D1 / Cron Triggers），**不需要域名，也不需要邮件服务**。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_GITHUB_USER/date_alert)

> 上面的按钮需要把 `YOUR_GITHUB_USER` 换成你的 GitHub 用户名，且仓库是**公开**的。
> 部署完成后打开站点，首次访问会让你**自己设置管理员密码**（见下方说明）。

---

## 功能

**首页（公开，无需登录）**

- 卡片墙，最多每行 4 个，响应式适配手机
- 按剩余天数由近及远排序，颜色由可配置的区间规则决定（含标签、浅/深色）
- 无日期事项单独分区显示在下方
- 备注默认 2 行，鼠标悬停展开全文
- 已登录点卡片看详情；未登录连点 3 次提示登录

**后台（密码登录）**

| 模块 | 内容 |
|---|---|
| 日期提醒管理 | 列表（未到期 / 已归档 / 无日期 / 全部）、搜索、分页、新建、编辑、归档、恢复、删除、清空已归档 |
| 时区与语言 | 418 个时区 + 实时时间预览、默认语言、推送语言 |
| 颜色规则 | 可增删的区间规则、颜色选择、实时预览、重叠校验、恢复默认、深色模式 |
| 提醒设置 | 开关、推送时间（精确到分钟）、剩余天数提醒、每日汇总、Bark 地址/密钥/分组/提示音/级别、**测试推送** |
| 执行日志 | 近 7 天成功/失败统计、筛选、失败详情（请求/响应/异常，密钥脱敏） |
| 数据与备份 | 导出 JSON、导入（合并/替换）、清空已归档 |

**通知**

- 每分钟 Cron，按设置时区判定 30 分钟推送窗口（含跨零点）
- 多条命中合并为一条；失败后由窗口内的后续分钟重试，最多 3 次，成功后幂等不再重发
- 无日期事项永不推送、永不自动归档

**安全**

- PBKDF2-SHA256（10,000 次迭代 + 服务端 pepper，适配免费版 10ms CPU）
- 登录限频（同一 IP 15 分钟 5 次）、首次登录强制改密、改密踢掉所有会话
- Bark Device Key 用 AES-256-GCM 加密存储，接口永不回传明文
- 执行日志中密钥显示为 `••••••`

---

## 技术栈

| 层 | 选型 |
|---|---|
| 运行时 | Cloudflare Workers（免费版即可） |
| 服务端 | Hono + TypeScript |
| 数据库 | Cloudflare D1（SQLite） |
| 定时 | Cron Triggers（每分钟） |
| 前端 | Vue 3 + Vite + Tailwind CSS |
| 测试 | Vitest（99 个用例） |
| 多语言 | 自研轻量 i18n（简中 / 繁中 / English） |

---

## 本地开发

前置：Node.js ≥ 20。

```bash
npm install
npm run db:local                 # 建表（本地 D1）
node scripts/init.mjs --local    # 生成初始密码，只打印一次
npm run dev                      # 构建前端 + 启动 Worker(8787) 与 Vite(5173)
```

打开 <http://localhost:8787/>，用 `init` 打印的密码登录，首次登录会强制改密。

| 命令 | 作用 |
|---|---|
| `npm run dev` | 构建并同时启动 Worker 与 Vite |
| `npm run build` | 只构建前端到 `web/dist` |
| `npm run db:local` | 应用迁移（本地 D1） |
| `npm run db:remote` | 应用迁移（线上 D1） |
| `npm test` | 单元测试 |
| `npm run init` | 初始化管理员密码（线上） |
| `npm run reset:password` | 重置密码并清空所有会话 |
| `npm run deploy` | 构建 → 迁移（线上）→ 部署 |
| `npm run cron:local` | 手动触发一次定时任务（本地不会自动跑 Cron，见下） |

> **本地开发不会自动触发定时任务** —— Wrangler 只在线上按 `crons` 触发。
> 调试推送时：把推送时间改成本分钟，然后执行 `npm run cron:local`。

本地密钥在 `.dev.vars`（已 gitignore）：`SECRET_KEY=<32 字节 Base64>`。

---

## 部署到 Cloudflare

### 方式 A：一键部署按钮

1. 先把仓库 push 到 GitHub（公开），把 README 顶部按钮里的 `YOUR_GITHUB_USER` 换成你的用户名
2. 点击按钮 → Cloudflare 会克隆仓库、创建 D1、写入绑定并执行 `npm run deploy`
3. 打开站点，按「一键部署后（两步）」完成初始化

### 一键部署后（两步）

1. 打开 `https://<你的-worker>.workers.dev`
2. 首次访问会自动跳到 **初始化页**，自己设定管理员密码即可完成初始化

> 为什么不是"看终端里的初始密码"？因为一键部署的构建跑在 Cloudflare CI 里，没有交互式终端。
> 所以首次访问时由你**自己设定**密码，而不是生成一个随机密码再去找它。
> 想防止别人抢先初始化，可在部署时额外配置一个 `SETUP_TOKEN`（见下）。

**可选加固：SETUP_TOKEN**

在 Cloudflare 控制台 → Worker → Settings → Variables and Secrets 添加加密变量 `SETUP_TOKEN`，
初始化页就必须输入相同的值才能完成设置：

```bash
npx wrangler secret put SETUP_TOKEN
```

### 方式 B：命令行

```bash
npm install
npx wrangler login

npx wrangler d1 create date-alert        # 把返回的 database_id 填进 wrangler.toml
npm run build
npm run db:remote                        # 建表
npm run deploy                           # 首次部署（含迁移）
```

命令行方式可以用脚本直接生成随机初始密码（会打印在终端）：

```bash
npm run init        # 写入 admin 表 + 推送 SECRET_KEY，终端显示随机密码
npm run reset:password   # 忘记密码时重置
```

也可以跳过 `init`，直接访问站点走「首次初始化」页面自己设密码。

> `wrangler.toml` 里的 `database_id` 目前是占位值。用一键部署按钮时 Cloudflare 会自动创建并替换；
> 命令行部署则必须先 `d1 create` 再填进去，否则 `--remote` 的迁移会失败。

---

## 配置 Bark 推送

1. 手机安装 [Bark](https://github.com/Finb/Bark)，复制 App 里的 device key
2. 登录后台 → **系统管理 → 提醒设置**，填入 Device Key → 保存
3. 点 **发送测试推送**，手机收到即成功
4. 按需设置：
   - **推送时间**：精确到分钟，按时区计算；失败会在 30 分钟内每分钟重试，最多 3 次
   - **剩余天数提醒**：默认 `1 / 3 / 5`，即还剩这些天时推送
   - **每日汇总**：每天推送未来 N 天内到期的总览
   - 单条提醒也可以在编辑时改为「跟随全局 / 不提醒 / 自定义天数」

推送格式：单条命中时是「标题 · 还剩 N 天」，多条命中时合并为一条列表（最多 10 行）。

---

## 数据与备份

- 所有数据在 D1，可在后台 **系统管理 → 数据与备份** 导出 JSON
- 导出**不含** Bark Device Key，换环境导入后需重新填写
- 导入支持「合并」（按 id 更新/新增）与「替换」（清空后导入）
- D1 自带 Time Travel（免费版 7 天），重要数据建议定期导出

---

## 更新与缓存

- 接口与页面入口均为 `Cache-Control: no-store`，部署后立刻生效
- `/assets/*` 文件名带内容哈希，长期缓存
- 前端会读取 `/version.json`，在**切回页面、窗口聚焦、每 5 分钟**时比对版本；有新版自动刷新，无需手动强刷

---

## 常见问题

| 问题 | 处理 |
|---|---|
| 收不到推送 | 后台点「发送测试推送」→ 看「执行日志」里的失败详情（Bark 地址、状态码、错误信息） |
| 日志显示失败 ×3 | 已经重试 3 次后放弃；修好地址/密钥后下一次定时任务会继续 |
| 页面像是旧版本 | 已内置自动刷新；若仍异常，检查是否被浏览器强缓存，`Cmd/Ctrl + Shift + R` |
| 登录提示 429 | 同一 IP 15 分钟内密码错 5 次会锁定 15 分钟 |
| 忘记密码 | `npm run reset:password`（线上）或 `node scripts/reset-password.mjs --local` |
| 初始化页说"已完成初始化" | 说明库里已有管理员，直接登录；忘记密码用上面的重置命令 |
| 初始化页要求令牌 | 你配置了 `SETUP_TOKEN`，填入部署时设置的值即可 |
| 登录报 1102 / CPU 超限 | 免费版 10ms/请求；本项目已把哈希降到 10,000 次迭代，若仍超限可升级 Workers Paid |
| `workers.dev` 打不开 | 中国大陆访问不稳定，可绑定自己的域名 |
| 改了时区后时间不对 | 推送时间按 `系统管理 → 时区` 计算，与浏览器时区无关 |
| 数据存在哪 | Cloudflare D1；本地开发在 `.wrangler/state`（已 gitignore） |

---

## 目录结构

```
├─ src/                  Worker：Hono 路由、认证、定时任务
│  ├─ api/               public / auth / admin 三组接口
│  ├─ lib/               时间、颜色、校验、加密、Bark、推送文案（含单测）
│  └─ middleware/        会话与登录限频
├─ web/                  前端：页面、组件、i18n、设计令牌
│  └─ public/            _headers、manifest、图标
├─ migrations/           D1 迁移
├─ scripts/              初始化与重置密码
├─ docs/DESIGN.md        需求规格说明书（做成了什么样）
└─ wrangler.toml
```

---

## 开发约定

- 服务端与前端均为 TypeScript，纯函数（日期、颜色、调度窗口、校验）必须有单测
- 数据库变更走 `migrations/`，不要手改线上表
- 用户可见文案必须走 `web/src/i18n`，不要硬编码
- 提交前跑 `npm test` 与 `npm run build`

需求与实现的完整对照见 [`docs/DESIGN.md`](docs/DESIGN.md)。
