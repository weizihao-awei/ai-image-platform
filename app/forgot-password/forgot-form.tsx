"use client";

// 忘记密码（第一步：发送重置邮件）：
// 输入注册邮箱 → 邮箱收到重置链接 → 点击链接兑换会话 → 进入 /reset-password 设置新密码
// 防枚举：无论邮箱是否存在，界面表现一致

import { useActionState } from "react";
import { requestPasswordReset, type AuthState } from "@/app/actions/auth";

const INITIAL: AuthState = {};

export function ForgotForm() {
  const [reqState, reqAction, reqPending] = useActionState(requestPasswordReset, INITIAL);

  return (
    <form action={reqAction} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm text-zinc-700">
          注册邮箱
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="you@example.com"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        />
      </div>

      {reqState?.error && <p className="text-sm text-red-600">{reqState.error}</p>}
      {reqState?.notice && <p className="text-sm text-green-700">{reqState.notice}</p>}

      <button
        type="submit"
        disabled={reqPending}
        className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {reqPending ? "发送中…" : "发送重置邮件"}
      </button>
    </form>
  );
}
