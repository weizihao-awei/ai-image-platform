"use client";

// 登录/注册双 Tab 表单（客户端组件）
// - 注册成功后不直接登录：提示去邮箱点确认邮件（链接认证）
// - useActionState 提供错误回显和提交中的 pending 状态
// - 提交中禁用按钮，防止重复提交

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "@/app/actions/auth";

const INITIAL: AuthState = {};

export function LoginForm({ authError }: { authError?: string }) {
  const [tab, setTab] = useState<"login" | "register">("login");

  // 每个 action 一套独立的状态（state / action / pending）
  const [loginState, loginAction, loginPending] = useActionState(signIn, INITIAL);
  const [regState, regAction, regPending] = useActionState(signUp, INITIAL);

  return (
    <div className="mt-6">
      {/* 邮件链接兑换失败等情况的提示（从 /auth/callback 重定向过来） */}
      {authError === "auth" && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          链接无效或已过期，请重新操作
        </p>
      )}

      {/* Tab 切换 */}
      <div className="grid grid-cols-2 rounded-lg bg-zinc-100 p-1 text-sm">
        {(
          [
            ["login", "登录"],
            ["register", "注册"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-md py-1.5 transition-colors ${
              tab === key
                ? "bg-white font-medium text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        action={tab === "login" ? loginAction : regAction}
        className="mt-5 space-y-4"
      >
        <div>
          <label htmlFor="email" className="block text-sm text-zinc-700">
            邮箱
          </label>
          <input
            key={`email-${tab}`} // 切 Tab 时重挂载，清掉浏览器自动填充的值
            id="email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete={tab === "login" ? "email" : "off"}
            // 注册 Tab 阻止自动填充：Chrome 会无视 autocomplete="off"，
            // 但不会填充 readOnly 字段，聚焦时再移除 readOnly 恢复输入
            readOnly={tab === "register"}
            onFocus={(e) =>
              tab === "register" && e.currentTarget.removeAttribute("readonly")
            }
            placeholder="you@example.com"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm text-zinc-700">
              密码
            </label>
            {tab === "login" && (
              <a
                href="/forgot-password"
                className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline"
              >
                忘记密码？
              </a>
            )}
          </div>
          <input
            key={`password-${tab}`} // 切 Tab 时重挂载，清掉浏览器自动填充的值
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            maxLength={72}
            autoComplete={tab === "login" ? "current-password" : "new-password"}
            readOnly={tab === "register"}
            onFocus={(e) =>
              tab === "register" && e.currentTarget.removeAttribute("readonly")
            }
            placeholder="至少 6 位"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </div>

        {tab === "login" ? (
          loginState?.error && <p className="text-sm text-red-600">{loginState.error}</p>
        ) : (
          <>
            {regState?.error && <p className="text-sm text-red-600">{regState.error}</p>}
            {regState?.notice && (
              <p className="text-sm text-green-700">{regState.notice}</p>
            )}
          </>
        )}

        <button
          type="submit"
          disabled={loginPending || regPending}
          className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {(tab === "login" ? loginPending : regPending) ? "请稍候…" : tab === "login" ? "登录" : "注册"}
        </button>
      </form>
    </div>
  );
}
