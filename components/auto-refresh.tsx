"use client";

// 自动刷新组件：定时调用 router.refresh() 让服务端组件重新拉取数据
// - enabled：只有存在 PENDING/PROCESSING 任务时才开启轮询，进入终态自动停止
// - 渲染为 null，纯逻辑组件

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({
  enabled,
  intervalMs = 3000,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs, router]);

  return null;
}
