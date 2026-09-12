import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { AutoRefresh } from "@/components/auto-refresh";
import { RetryButton } from "@/components/retry-button";
import type { Task } from "@/lib/types";

export const metadata = { title: "任务详情 - AI 图片生成平台" };

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // Next.js 16：params 是 Promise

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  // 查不到（不存在 / 不是自己的任务）统一 404，不暴露任务存在性
  if (!data) notFound();
  const task = data as Task;

  const isActive = task.status === "PENDING" || task.status === "PROCESSING";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <AutoRefresh enabled={isActive} />

      {/* 面包屑 */}
      <div className="text-sm text-zinc-500">
        <Link href="/tasks" className="hover:text-zinc-900">
          任务列表
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-zinc-900">任务详情</span>
      </div>

      {/* 基本信息 */}
      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold">{task.product_name}</h1>
          <StatusBadge status={task.status} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-zinc-500">图片数量</dt>
            <dd>{task.image_count} 张</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-zinc-500">重试次数</dt>
            <dd>{task.retry_count}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-zinc-500">创建时间</dt>
            <dd>{formatTime(task.created_at)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-zinc-500">更新时间</dt>
            <dd>{formatTime(task.updated_at)}</dd>
          </div>
        </dl>
      </div>

      {/* 生成结果 */}
      {task.status === "SUCCESS" && (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="font-medium">生成结果（{task.image_urls.length} 张）</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {task.image_urls.map((url, index) => (
              <figure key={url} className="space-y-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${task.product_name} 生成图片 ${index + 1}`}
                  className="aspect-square w-full rounded-xl border border-zinc-200 object-cover"
                />
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-xs text-blue-600 hover:underline"
                  title={url}
                >
                  图片地址：{url}
                </a>
              </figure>
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            生成时间：{formatTime(task.updated_at)} · 图片链接由第三方生成服务提供，约 1
            小时后可能失效（demo 限制，README 有说明）
          </p>
        </div>
      )}

      {/* 失败信息 + 重试 */}
      {task.status === "FAILED" && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
          <h2 className="font-medium text-red-700">生成失败</h2>
          <p className="mt-2 text-sm text-red-600">
            失败原因：{task.error_message ?? "未知错误"}
          </p>
          <div className="mt-4">
            <RetryButton taskId={task.id} />
          </div>
        </div>
      )}

      {/* 进行中提示 */}
      {isActive && (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          {task.status === "PENDING"
            ? "任务已进入队列，等待生成…（页面会自动刷新）"
            : "AI 正在生成图片，请稍候…（页面会自动刷新）"}
        </div>
      )}
    </div>
  );
}
