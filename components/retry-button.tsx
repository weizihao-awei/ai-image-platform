"use client";

// 重新生成按钮（客户端组件）：调重试接口，成功后刷新页面
// 失败原因展示在按钮下方，不用弹窗

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RetryButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/retry`, { method: "POST" });
      if (res.ok) {
        router.refresh(); // 状态已回 PENDING，刷新后自动轮询接管
        return;
      }
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "重试失败，请稍后重试");
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleRetry}
        disabled={loading}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "提交中…" : "重新生成"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
