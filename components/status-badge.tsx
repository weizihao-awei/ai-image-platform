// 任务状态徽章（服务端组件即可，无需交互）
// PENDING 灰 / PROCESSING 蓝（带呼吸动画）/ SUCCESS 绿 / FAILED 红

import type { TaskStatus } from "@/lib/types";

const CONFIG: Record<TaskStatus, { label: string; className: string }> = {
  PENDING: { label: "等待生成", className: "bg-zinc-100 text-zinc-600" },
  PROCESSING: {
    label: "生成中",
    className: "bg-blue-50 text-blue-600 animate-pulse",
  },
  SUCCESS: { label: "成功", className: "bg-green-50 text-green-700" },
  FAILED: { label: "失败", className: "bg-red-50 text-red-600" },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const config = CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
