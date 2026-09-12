"use client";

// 创建任务表单（客户端组件）
// 数据流：zod 前端校验 → fetch POST /api/tasks → 成功后跳详情页
// 前后端共用 lib/validation.ts 的同一份 schema，规则只写一遍

import { useState } from "react";
import { useRouter } from "next/navigation";
import { taskCreateSchema, firstError } from "@/lib/validation";

const COUNT_OPTIONS = [1, 2, 3, 4];

export function TaskForm() {
  const router = useRouter();
  const [count, setCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const json = await res.json();
        router.push(`/tasks/${json.data.id}`);
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
    <form onSubmit={handleSubmit} className="space-y-5">
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
  );
}
