"use client";

// 新建任务弹窗（客户端组件）
// - 原来是独立页面 /tasks/new，改为列表页内的 Modal 弹窗
// - 提交接口只负责落库 PENDING，图片生成由后台队列异步执行，所以成功后
//   立即关闭弹窗 + 显示自动消失的提示 + 刷新列表，不跳转详情页
// - 校验沿用 lib/validation.ts 的共享 schema，规则前后端只写一份

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { taskCreateSchema, firstError } from "@/lib/validation";

const COUNT_OPTIONS = [1, 2, 3, 4];
const TOAST_DURATION_MS = 3000; // 成功提示自动消失时长

export function NewTaskDialog({
  variant = "button", // button：头部主按钮；link：空列表引导链接
}: {
  variant?: "button" | "link";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 提示 TOAST_DURATION_MS 后自动消失
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  // 弹窗打开时：Esc 关闭 + 锁定背景滚动
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, submitting]);

  function close() {
    if (submitting) return; // 提交中不允许关闭，避免状态错乱
    setOpen(false);
    setError(null);
    setCount(1);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    // 第一层校验：前端（与服务端同一份 schema）
    const parsed = taskCreateSchema.safeParse({
      product_name: formData.get("product_name"),
      image_count: formData.get("image_count"),
    });
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }

    // 第二层校验在服务端 API 里（这里绕不过去，直接 curl 也会被拦）
    setSubmitting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (res.status === 201) {
        // 新任务按创建时间倒序排在第一页，回到第 1 页并刷新列表，
        // 弹窗关闭 + 提示自动消失，进度交给列表页的自动轮询展示
        setOpen(false);
        setCount(1);
        setToast("任务创建成功，已加入生成队列");
        router.push("/tasks");
        router.refresh();
        return;
      }
      if (res.status === 401) {
        router.push("/login"); // 会话过期
        return;
      }
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "创建失败，请稍后重试");
    } catch {
      setError("网络异常，请检查网络后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {variant === "button" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          新建任务
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-zinc-900 underline"
        >
          创建第一个图片生成任务
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-900/40 p-4"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="新建图片生成任务"
            className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">新建图片生成任务</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  输入商品名称，AI 将为它生成电商商品图
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="关闭"
                className="-mr-1 -mt-1 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              <div>
                <label htmlFor="product_name" className="block text-sm text-zinc-700">
                  商品名称
                </label>
                <input
                  id="product_name"
                  name="product_name"
                  required
                  maxLength={50}
                  placeholder="例如：防晒衣、运动鞋"
                  className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                />
              </div>

              <div>
                <span className="block text-sm text-zinc-700">图片数量</span>
                <div className="mt-1.5 flex gap-2">
                  {COUNT_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCount(n)}
                      className={`h-10 w-12 rounded-lg border text-sm transition-colors ${
                        count === n
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 text-zinc-700 hover:border-zinc-900"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {/* 数量随表单一起提交，保证 schema 校验完整 */}
                <input type="hidden" name="image_count" value={count} />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "创建中…" : "开始生成"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 成功提示：自动消失，无需手动关闭 */}
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </>
  );
}
