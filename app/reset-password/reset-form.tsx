"use client";

// 新密码表单（客户端组件）：新密码 + 确认密码，提交到 updatePassword Server Action

import { useActionState } from "react";
import { updatePassword, type AuthState } from "@/app/actions/auth";

const INITIAL: AuthState = {};

export function ResetForm() {
  const [state, action, pending] = useActionState(updatePassword, INITIAL);

  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm text-zinc-700">
          新密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          maxLength={72}
          autoComplete="new-password"
          placeholder="至少 6 位"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        />
      </div>

      <div>
        <label htmlFor="confirm" className="block text-sm text-zinc-700">
          确认新密码
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={6}
          maxLength={72}
          autoComplete="new-password"
          placeholder="再输入一次"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "提交中…" : "确认重置"}
      </button>
    </form>
  );
}
