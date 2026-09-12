# AI 图片生成平台 — 实现计划（v2）

## 背景

- 按任务书实现完整业务闭环。用户要求：**并发按 demo 级别**；**多用户认证（账号+密码，无邮箱、无找回机制）**；任务书第 7 节的架构概念（异步队列/Worker/重试/限流/数据存储/状态查询）**用轻量方式尽量真实落地，不过度设计**。
- 已实测 SiliconFlow Kolors API（约 3 秒/张）。图片 URL 为 1 小时有效的临时链接，**按用户决定不转存**，直接存 URL（README 中如实说明该限制及生产方案）。
- 起点：脚手架保留，业务代码全新编写，Supabase 无表。

## 关键架构决策

1. **认证**：Supabase Auth，用户输入「账号 + 密码」。内部映射 `账号@demo.local` 作为 Supabase 的 email 字段（Supabase 原生只支持邮箱标识，这样改动能最小且完整保留 RLS 的 `auth.uid()` 隔离）。账号规则：3~20 位字母/数字/下划线；密码 ≥6 位。注册即登录。**前置设置：Supabase Dashboard 关闭「邮箱确认」**（假邮箱必须关，否则无法登录）。无找回机制，README 如实说明。
2. **数据权限**：RLS `auth.uid() = user_id`（数据库强制）+ 代码层按 `user_id` 过滤；API 路由自行 `getUser()`，未登录返回 401 JSON。
3. **异步任务队列 + Worker（demo 级实现）**：两层——① `tasks` 表即持久化队列（PENDING 行不会丢）；② `lib/queue.ts` 进程内轻量队列：`enqueue()` 入内存队列，`pump()` 循环取任务执行，**并发上限 2**（既是 Worker 调度器也是第三方 API 并发限流）。创建/重试接口落库后 `after(() => enqueue(...))` 立即返回。README 说明：进程内队列是单实例 demo 方案，生产换 Redis/BullMQ + 独立 Worker。
4. **重试机制（两层）**：① API 调用层——`lib/siliconflow.ts` 内置自动重试（失败后 2 秒重试 1 次，网络/5xx 才重试）；② 业务层——FAILED 后用户点「重新生成」，`retry_count+1`、状态回 PROCESSING，同一行更新不产生重复任务。
5. **数据存储**：任务元数据 + 图片 URL 存 Postgres（`image_urls jsonb`）。图片二进制不落我们这里（demo 决策），README 给出生产方案（对象存储 + CDN + 生命周期管理）。
6. **用户状态查询**：列表/详情页 Server Component 渲染 + `components/auto-refresh.tsx` 定时 `router.refresh()`（3 秒，仅存在 PENDING/PROCESSING 任务时启用，终态停止）；另提供 `GET /api/tasks`、`GET /api/tasks/[id]` REST 接口供程序化查询/演示。
7. **校验**：`lib/validation.ts` zod schema（任务创建 + 账号/密码）前端表单与服务端共用。
8. **UI**：全中文简洁风格；原生 `<img>`（eslint 关闭 `@next/next/no-img-element`）。

## 数据库

`supabase/migrations/0001_init.sql`（幂等写法，Supabase SQL Editor 执行一次）：
- `tasks` 表：`id uuid PK default gen_random_uuid()`、`user_id uuid not null references auth.users(id) on delete cascade`、`product_name text`、`status text check in (PENDING/PROCESSING/SUCCESS/FAILED) default 'PENDING'`、`image_count int check 1~4`、`image_urls jsonb default '[]'`、`retry_count int default 0`、`error_message text`、`created_at/updated_at timestamptz default now()`
- 索引 `(user_id, created_at desc)`；RLS 启用 + `all using (auth.uid() = user_id) with check (auth.uid() = user_id)`；`updated_at` 自动更新触发器

## 文件清单

| 文件 | 说明 |
|---|---|
| `supabase/migrations/0001_init.sql` | 新建（见上） |
| `lib/supabase/server.ts` | `@supabase/ssr` 的 `createServerClient` + `await cookies()`，getAll/setAll 模式，每请求新建实例 |
| `lib/validation.ts` | zod：`taskCreateSchema`（商品名 trim 后 1~50 字、数量 1~4）、`authSchema`（账号 3~20 位 `[a-zA-Z0-9_]`、密码 ≥6） |
| `lib/prompt.ts` | 商品名 → 中文电商商品图 Prompt 模板 |
| `lib/siliconflow.ts` | `generateImage(prompt)`：调 API（超时 30s）+ 自动重试 1 次（决策 4①），提取临时 URL，错误分类为可读信息 |
| `lib/queue.ts` | 进程内队列 + 并发限流（决策 3）：`enqueue(taskId, userId)`、`pump()`、`MAX_CONCURRENT = 2` |
| `lib/task-processor.ts` | `processTask(taskId, userId)`：置 PROCESSING → 逐张生成（循环单张，失败语义清晰）→ 全部成功 SUCCESS 写 URL 数组；任一失败 FAILED + error_message；全量 try/catch |
| `app/actions/auth.ts` | `'use server'`：signUp / signIn / signOut。账号→`@demo.local` 映射；redirect 不放进 try/catch；注册冲突（账号已存在）模糊提示防枚举 |
| `proxy.ts` | 根目录。官方 setAll 模式刷新会话 + 路由保护（未登录访问 `/tasks/**` → `/login`；已登录访问 `/login` → `/tasks`）；matcher 排除 `api`、`_next/static`、`_next/image`、favicon（不排除 `/login`，否则登录 Server Action 被跳过） |
| `app/api/tasks/route.ts` | `GET` 当前用户任务列表、`POST` 创建（zod 校验 → getUser → 落库 PENDING → `after(enqueue)` → 201）；`export const maxDuration = 60` |
| `app/api/tasks/[id]/route.ts` | `GET` 单任务（属主校验，不存在返回 404） |
| `app/api/tasks/[id]/retry/route.ts` | `POST` 重试：属主 + FAILED 校验 → `retry_count+1`、清空 error、状态 PROCESSING → `after(enqueue)` |
| `app/login/page.tsx` + `app/login/login-form.tsx` | 登录/注册双 Tab（client，`useActionState`，pending 禁用按钮防重复提交，错误内联展示） |
| `app/tasks/page.tsx` | 任务列表（Server Component：商品名、状态徽章、图片数量、创建时间、详情入口、新建按钮） |
| `app/tasks/new/page.tsx` + `app/tasks/new/task-form.tsx` | 创建表单（商品名称 + 数量 1~4） |
| `app/tasks/[id]/page.tsx` | 详情：状态徽章、图片网格、图片地址、生成时间、失败原因 + 重试按钮、retry_count 展示 |
| `components/status-badge.tsx` | 四态徽章（灰/蓝/绿/红，PROCESSING 带动画） |
| `components/auto-refresh.tsx` | 决策 6 的自动刷新组件 |
| `app/layout.tsx` | `lang="zh-CN"`、顶部导航（站名 + 当前账号 + 退出）、metadata |
| `app/page.tsx` | 改为 `redirect('/tasks')` |
| `eslint.config.mjs` | 关闭 `@next/next/no-img-element` |
| `.env.example` | `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SILICONFLOW_API_KEY` |
| `README.md` | 任务书 10 项：介绍、技术架构、本地启动、环境变量、数据库初始化、部署、目录说明、AI API 调用流程、生产规模架构思考（含 demo 内队列/限流如何演进为 Redis 队列/独立 Worker/分布式限流/对象存储）、AI 工具使用说明；如实说明：图片临时链接 1 小时失效（demo 决策）、账号映射假邮箱、进程内队列单实例限制 |

## 实施顺序

1. `0001_init.sql` + `.env.example`（提示用户：SQL Editor 执行 + Dashboard 关闭邮箱确认）
2. lib 基础层（server / validation / prompt / siliconflow / queue / task-processor）
3. 认证链路（proxy.ts → auth actions → login 页）→ 先验证注册/登录/登出可用
4. 任务 API（create / get / retry）
5. 页面（layout / 重定向 / 列表 / 新建 / 详情 + 公共组件）
6. eslint + README
7. 全流程验证（见下）

## 验证方案

1. `npm run dev`：注册账号 A、B；未登录访问 `/tasks` 跳 `/login`
2. A 创建任务（2 张）→ 详情页自动 PENDING→PROCESSING→SUCCESS，显示图片；连续创建 3 个任务观察队列串行/并发行为（并发 2）
3. 权限：B 看不到 A 的任务；B 直接访问 A 的任务 URL → 404；未登录 curl `GET /api/tasks` → 401
4. 重试：临时改错 SiliconFlow key → 任务 FAILED 且显示原因 → 恢复 key 后点重试 → SUCCESS 且 `retry_count=1`、任务总数不变
5. 校验：空名称/超长/数量 0 或 5 → 前后端均拦截（curl 直打 API 验证 422）
6. `npm run build` 通过 → 按 README 部署 Vercel + 配置环境变量
