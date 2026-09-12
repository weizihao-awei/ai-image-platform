# AI Image Generation Platform（AI 图片生成平台）

输入商品名称，一键调用 AI 生成电商商品图的小型 SaaS 系统。支持多用户注册登录、任务列表、任务详情、失败重试，任务状态自动刷新。

> Demo 项目，用于全栈能力展示。技术栈：Next.js (App Router) + TypeScript + Supabase (PostgreSQL / Auth) + SiliconFlow Kolors + Vercel。

## 项目介绍

整体业务闭环：

```
用户登录/注册 → 输入商品名称 + 图片数量（1~4）
  → 创建任务（落库 PENDING）
  → 后台队列异步调用 AI 生图 API（PROCESSING）
  → 保存图片 URL（SUCCESS）
  → 详情页展示图片（页面自动刷新）
  → 失败时可查看原因并一键重试（FAILED → retry_count+1）
```

任务状态机：`PENDING（等待生成）→ PROCESSING（生成中）→ SUCCESS / FAILED`。

## 技术架构

| 层 | 方案 |
|---|---|
| 前端页面 | Next.js App Router（Server Components 渲染 + 少量 Client Components 处理表单/轮询） |
| 后端接口 | Route Handlers（`app/api/**/route.ts`，REST 风格）+ Server Actions（认证表单） |
| 数据库 | Supabase PostgreSQL（行级安全 RLS 做数据隔离） |
| 认证 | Supabase Auth（邮箱+密码、邮箱确认、忘记密码） |
| AI 生图 | SiliconFlow `Kwai-Kolors/Kolors` |
| 部署 | Vercel（页面走 CDN，接口走 Serverless Functions） |

### 关键设计

- **异步队列 + Worker（demo 级）**：`tasks` 表本身就是持久化队列（任务先落库为 `PENDING`，进程重启不丢）；`lib/queue.ts` 实现进程内调度队列，**并发上限 2**——既是 Worker 调度器，也是对第三方 API 的并发限流。接口创建任务后通过 `after()` 立即返回，生图在后台执行。生产规模下应替换为 Redis/BullMQ 等独立队列 + 独立 Worker 进程。
- **两层重试**：API 调用层自动重试 1 次（仅网络异常/服务端 5xx，等待 2 秒）；业务层用户手动重试（`retry_count+1`，同一行更新，不产生重复任务）。
- **校验**：`lib/validation.ts` 的 zod schema 前后端共用一份（前端表单快速反馈 + 服务端强制校验，双层防御）。
- **数据隔离**：RLS（`auth.uid() = user_id`）数据库强制隔离 + 代码层每次查询带 `user_id` 过滤 + 接口统一 401/404 语义（不暴露他人任务的存在性）。
- **自动刷新**：页面由 Server Components 渲染；存在进行中任务时，`AutoRefresh` 组件每 3 秒 `router.refresh()` 触发服务端重新渲染，进入终态自动停止。

### 认证方案说明

使用 Supabase Auth 原生的**邮箱+密码**体系 + **邮件链接认证**。完整实现：注册（发送确认邮件 → 点击邮件里的链接完成验证并自动登录）→ 登录 → 忘记密码（重置邮件 → 点链接进入设置新密码页）。

- **无需开发者配置发件邮箱**：认证邮件由 Supabase 内置发件服务代发，收件方使用任意真实邮箱（QQ/163/Gmail 等）即可。
- 已知限制：内置发件服务有速率限制（约每小时 2 封认证邮件），demo 测试足够；量大需在 Supabase 配置自定义 SMTP。
- 邮件可能进入垃圾箱（发件地址为 Supabase 官方域名）。
- 链接认证是 Supabase 默认模板，无需自定义；技术链路：注册 `signUp` → 邮件链接 → `/auth/callback` 用 code 兑换会话 → 进入系统；找回 `resetPasswordForEmail` → 邮件链接（`?next=/reset-password`）→ `/auth/callback` 兑换 recovery 会话 → `/reset-password` 设置新密码（`updateUser`）。

### 图片链接说明（如实说明）

SiliconFlow 返回的图片 URL 是**约 1 小时有效的临时预签名链接**，本 Demo 按最小实现直接存该 URL，过期后历史任务图片无法访问（重新生成即可）。生产方案：拿到 URL 后由 Worker 下载图片并转存到对象存储（Supabase Storage / S3 / OSS），数据库保存永久链接，并配合 CDN 与生命周期策略。

## 本地启动方式

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量：复制 .env.example 为 .env.local，填入真实值
#    （SUPABASE_URL / SUPABASE_ANON_KEY / SILICONFLOW_API_KEY）

# 3. 初始化数据库（见下一节）

# 4. 启动
npm run dev
# 打开 http://localhost:3000，会自动跳转到登录页，注册账号即可使用
```

## 环境变量说明

| 变量 | 说明 |
|---|---|
| `SUPABASE_URL` | Supabase 项目地址（Dashboard → Project Settings → API） |
| `SUPABASE_ANON_KEY` | Supabase 匿名 key（publishable key）。配合 RLS 使用是安全的；本项目的 key 不带 `NEXT_PUBLIC_` 前缀，只存在于服务端，不会进入浏览器代码 |
| `SILICONFLOW_API_KEY` | SiliconFlow 平台 API Key（https://cloud.siliconflow.cn ），仅服务端使用 |

安全约定：真实 `.env.local` 不提交 git（已在 `.gitignore`）；所有密钥只在服务端；仓库提供 `.env.example` 模板。

## 数据库初始化方式

1. 打开 Supabase Dashboard → **SQL Editor**
2. 把 [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) 的全部内容粘贴进去执行（脚本幂等，可重复执行）
3. Dashboard → **Authentication → Sign In / Providers**：保持/开启 **「Confirm email」**（注册后需点击确认邮件，真实邮箱可正常收到）
4. Dashboard → **Authentication → Emails**：邮件模板保持**默认**（默认即链接样式，无需修改；若之前改成过验证码样式，请把模板恢复为包含 `{{ .ConfirmationURL }}` 的版本）
5. Dashboard → **Authentication → URL Configuration**：
   - **Site URL** 填 `http://localhost:3000`（部署 Vercel 后改成线上地址）
   - **Redirect URLs** 添加 `http://localhost:3000/**`（邮件里的确认/重置链接只允许跳回配置过的地址）

脚本内容：`tasks` 表（含 `user_id` 外键、状态约束、索引）、`updated_at` 自动更新触发器、RLS 策略（用户只能访问自己的任务）。

## 部署方式

1. 代码推送到 GitHub（Public 仓库）
2. Vercel → Add New Project → 导入该仓库（框架自动识别 Next.js）
3. Vercel 项目的 Settings → Environment Variables 添加上表 3 个环境变量（与 `.env.local` 相同的值）
4. Deploy 即可。部署后页面由 CDN 提供，`/api/**` 变成 Serverless Functions（生图流水线设置了 `maxDuration = 60`）

## 项目目录说明

```
ai-image-platform/
├── app/
│   ├── layout.tsx              # 全局布局：顶部导航（当前账号/退出）
│   ├── page.tsx                # 首页 → 重定向到 /tasks
│   ├── login/                  # 登录/注册页（page + 客户端表单）
│   ├── forgot-password/        # 忘记密码：发送重置邮件
│   ├── reset-password/         # 设置新密码（从邮件链接进入）
│   ├── auth/callback/route.ts  # 邮件链接回调：code 换会话后跳转
│   ├── tasks/
│   │   ├── page.tsx            # 任务列表（Server Component）
│   │   ├── new/                # 新建任务页（page + 客户端表单）
│   │   └── [id]/page.tsx       # 任务详情（图片/失败原因/重试入口）
│   ├── actions/auth.ts         # 认证 Server Actions（注册/登录/退出/找回密码/设置新密码）
│   └── api/
│       └── tasks/
│           ├── route.ts            # GET 列表 / POST 创建（创建后 after 入队）
│           └── [id]/
│               ├── route.ts        # GET 单任务（轮询/程序化查询）
│               └── retry/route.ts  # POST 失败重试
├── components/
│   ├── status-badge.tsx        # 状态徽章
│   ├── auto-refresh.tsx        # 自动刷新（router.refresh 轮询）
│   └── retry-button.tsx        # 重新生成按钮
├── lib/
│   ├── supabase/server.ts      # Supabase 服务端客户端（Cookie 会话）
│   ├── validation.ts           # zod schema（前后端共用）
│   ├── prompt.ts               # 商品名 → 生图 Prompt 模板
│   ├── siliconflow.ts          # SiliconFlow API 客户端（含自动重试）
│   ├── queue.ts                # 进程内任务队列（并发上限 2）
│   ├── task-processor.ts       # 任务流水线（PROCESSING → SUCCESS/FAILED）
│   └── types.ts                # Task 类型定义
├── proxy.ts                    # 会话续期 + 路由保护（Next 16 的 middleware）
├── supabase/migrations/        # 数据库 SQL
└── .env.example                # 环境变量模板
```

## AI API 调用流程

```
POST /api/tasks（商品名称 + 图片数量）
  → zod 校验 + 鉴权 → INSERT tasks（PENDING）→ 201 返回任务 id
  → after() 后台：enqueue 进入进程内队列（并发上限 2）
  → Worker 取任务：UPDATE 状态为 PROCESSING
  → buildPrompt(商品名称) 生成中文电商摄影 Prompt
  → POST https://api.siliconflow.cn/v1/images/generations
      { model: "Kwai-Kolors/Kolors", prompt, image_size: "1024x1024", batch_size: 1 }
  → 提取响应中 images[].url（循环 image_count 次，每次一张）
  → UPDATE tasks：SUCCESS + image_urls 数组
  → 失败时：UPDATE tasks：FAILED + error_message（API 层已自动重试 1 次）
  → 前端详情页轮询刷新，展示图片
```

## 扩展到生产规模的架构设计

如果每天生成 10 万张图片，当前 demo 架构会遇到的瓶颈和演进方向：

| 方面 | Demo 现状 | 生产方案 |
|---|---|---|
| 异步任务队列 | tasks 表做持久化队列 + 进程内内存队列调度 | 独立队列系统（Redis + BullMQ / RabbitMQ / 云队列服务）。tasks 表只做状态存储，队列与业务解耦，支持多机、优先级、死信队列 |
| Worker | after() 内的进程内协程 | 独立 Worker 进程/容器集群（K8s Deployment / 云函数），按队列深度自动扩缩容，与 Web 层完全分离，生图崩溃不影响用户请求 |
| 重试机制 | API 层自动重试 1 次 + 用户手动重试 | 指数退避自动重试（1s/5s/30s，最多 N 次），超过阈值进死信队列人工介入；按错误类型区分可重试（网络/限流）与不可重试（参数/内容违规） |
| 第三方 API 限流 | 进程内并发上限 2 | 分布式限流（Redis 令牌桶）：按供应商配额全局限速；同时对接多家生图供应商做故障转移和成本路由 |
| 数据存储 | 图片临时 URL 直接存 Postgres | Worker 下载图片转存对象存储（S3/OSS/Supabase Storage），数据库存永久链接；CDN 加速分发；生命周期策略归档冷数据；图片元数据量大时库表按时间分区 |
| 用户状态查询 | 服务端渲染 + 3 秒 router.refresh() 轮询 | WebSocket / SSE 推送状态变更；列表接口走缓存与游标分页；只推"有变化"的任务，降低无效轮询 |
| 可观测性 | console.error | 结构化日志 + 任务级追踪（每次生图记录耗时/成本），失败率与队列深度告警 |

**多用户数据权限**（本 demo 已实现的部分）：Supabase Auth + RLS 是权限的第一道闸——所有查询都被数据库策略限制在 `auth.uid() = user_id` 内，即使应用层写出漏洞查询也无法越权。应用层再叠加：每次查询显式带 `user_id` 过滤、非属主统一返回 404（不暴露存在性）、接口全部自行鉴权（不依赖路由保护）。防越权的关键原则：**信任边界放在数据库层，应用层校验只是冗余防线**；若引入管理员/多角色，RLS 策略按角色扩展，避免在业务代码里散落权限判断。

## AI 工具使用说明

本项目在开发过程中使用了 Trae（AI 编程工具）辅助，具体使用方式：

- **需求拆解与方案设计**：由 AI 生成候选架构（认证方案、队列设计、数据库结构），人工评审后确定方案，再开始编码；
- **代码生成**：页面、接口、lib 层代码由 AI 生成，人工逐文件审查关键逻辑（RLS 策略、会话 Cookie 处理、after() 的使用条件、错误处理路径）；
- **技术核实**：用 AI 实测外部 API（SiliconFlow 响应结构、图片 URL 有效期）并查阅本地 Next.js 文档，纠正了"直接存第三方图片链接"的隐患；
- **人工决策**：账号映射方案（@demo.local）、图片不转存的取舍、并发上限取值等均由人工确认；
- **理解与可解释性**：代码中的中文注释标注了每个模块的职责与设计理由，核心链路（任务状态机、队列调度、权限隔离）见上文说明。
