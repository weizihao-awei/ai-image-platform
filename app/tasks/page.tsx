import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { AutoRefresh } from "@/components/auto-refresh";
import type { Task } from "@/lib/types";

export const metadata = { title: "任务列表 - AI 图片生成平台" };

// 时间展示：服务端渲染一次即可，用固定时区避免任何本地化差异
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login"); // proxy 已挡，这里兜底

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const list = (tasks ?? []) as Task[];
  const hasActive = list.some((t) => t.status === "PENDING" || t.status === "PROCESSING");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <AutoRefresh enabled={hasActive} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">任务列表</h1>
        <Link
          href="/tasks/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          新建任务
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-zinc-500">
          <p>还没有任务</p>
          <Link href="/tasks/new" className="text-sm text-zinc-900 underline">
            创建第一个图片生成任务
          </Link>
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
    </div>
  );
}
