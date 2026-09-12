import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { AutoRefresh } from "@/components/auto-refresh";
import { NewTaskDialog } from "@/components/new-task-dialog";
import type { Task } from "@/lib/types";

export const metadata = { title: "任务列表 - AI 图片生成平台" };

const PAGE_SIZE = 5; // 每页任务数

// 时间展示：服务端渲染一次即可，用固定时区避免任何本地化差异
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams; // Next.js 16：searchParams 是 Promise

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login"); // proxy 已挡，这里兜底

  // 先查总数（head: true 不返回行，只要 count），算出总页数并夹紧当前页，
  // 避免手输 ?page=999 之类的越界页码
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), totalPages);

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1); // 分页区间（下标含两端）

  const list = (tasks ?? []) as Task[];
  const hasActive = list.some((t) => t.status === "PENDING" || t.status === "PROCESSING");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <AutoRefresh enabled={hasActive} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">任务列表</h1>
        <NewTaskDialog />
      </div>

      {list.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-zinc-500">
          <p>还没有任务</p>
          <NewTaskDialog variant="link" />
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
          {list.map((task) => (
            <li key={task.id} className="flex items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{task.product_name}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {formatTime(task.created_at)} · {task.image_count} 张
                  {task.retry_count > 0 && ` · 已重试 ${task.retry_count} 次`}
                </p>
              </div>
              <StatusBadge status={task.status} />
              <Link
                href={`/tasks/${task.id}`}
                className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm transition-colors hover:border-zinc-900"
              >
                查看详情
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* 分页控件：只有一页时不显示 */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link
              href={`/tasks?page=${page - 1}`}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 transition-colors hover:border-zinc-900"
            >
              上一页
            </Link>
          ) : (
            <span className="rounded-lg border border-zinc-200 px-3 py-1.5 text-zinc-300">
              上一页
            </span>
          )}
          <span className="text-zinc-500">
            第 {page} / {totalPages} 页 · 共 {total} 条
          </span>
          {page < totalPages ? (
            <Link
              href={`/tasks?page=${page + 1}`}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 transition-colors hover:border-zinc-900"
            >
              下一页
            </Link>
          ) : (
            <span className="rounded-lg border border-zinc-200 px-3 py-1.5 text-zinc-300">
              下一页
            </span>
          )}
        </div>
      )}
    </div>
  );
}
