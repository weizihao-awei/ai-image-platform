-- =====================================================================
-- AI 图片生成平台 初始化脚本（幂等，可重复执行）
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴全部内容 → Run
-- =====================================================================

-- ---------- 任务表 ----------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade, -- 任务所属用户
  product_name text not null,                          -- 商品名称
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED')),
  image_count int not null default 1 check (image_count between 1 and 4),
  image_urls jsonb not null default '[]'::jsonb,       -- 生成的图片 URL 数组
  retry_count int not null default 0,                  -- 手动重试次数
  error_message text,                                  -- 失败原因
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 常用查询：按用户查列表、按时间倒序
create index if not exists idx_tasks_user_created
  on public.tasks (user_id, created_at desc);

-- ---------- updated_at 自动更新 ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------- 行级安全（RLS）：用户只能访问自己的任务 ----------
-- 注意：服务端代码用的是带用户 JWT 的客户端，auth.uid() 即当前登录用户
alter table public.tasks enable row level security;

drop policy if exists "tasks_owner_all" on public.tasks;
create policy "tasks_owner_all"
  on public.tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
