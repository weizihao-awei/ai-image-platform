"use server";

// 认证相关的 Server Actions：注册 / 登录 / 退出 / 找回密码
//
// 方案：Supabase Auth 邮箱+密码 + 邮件链接认证：
// - 注册后 Supabase 发送确认邮件，用户点击邮件里的链接完成验证并自动登录
//   （链接落到 /auth/callback，用 code 兑换会话后跳回任务列表）
// - 忘记密码：发送重置邮件，点链接进入 /reset-password 设置新密码
// - 认证邮件由 Supabase 内置发件服务代发，开发者无需配置 SMTP（限流约 2 封/小时）

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authSchema, emailSchema, passwordSchema, firstError } from "@/lib/validation";

export type AuthState = { error?: string; notice?: string };

/** 注册：发送确认邮件（session 为 null 是正常的，等用户点邮件里的链接） */
export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // 已注册过的邮箱再注册：Supabase 返回 422，明确引导去登录/找回
    if (error.status === 422 || /already/i.test(error.message)) {
      return { error: "该邮箱已注册，请直接登录；忘记密码可在登录页使用找回功能" };
    }
    return { error: "注册失败，请稍后重试" };
  }

  // 开启"邮箱确认"时：新用户返回 session = null（等点邮件链接）；
  // 未开启时会直接拿到 session，直接进入系统
  if (!data.session) {
    return {
      notice: "注册请求已提交！请到邮箱点击确认邮件完成注册（注意垃圾箱）",
    };
  }
  redirect("/tasks");
}

/** 登录 */
export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // 区分"邮箱没验证"和"密码错"，提示更准确
    if (/not confirmed/i.test(error.message)) {
      return { error: "该邮箱尚未完成验证，请先点击注册邮件里的确认链接" };
    }
    return { error: "邮箱或密码错误" };
  }

  redirect("/tasks");
}

/** 忘记密码：发送重置邮件（无论邮箱是否存在都返回同样结果，防枚举） */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    // 邮件里的链接会先到 /auth/callback 兑换会话，再跳到设置新密码页
    redirectTo: `${await getOrigin()}/auth/callback?next=/reset-password`,
  });
  if (error) {
    console.error("[requestPasswordReset] 发送失败:", error.message);
    return { error: "发送失败，可能是请求过于频繁，请一小时后再试" };
  }

  return { notice: "重置邮件已发送！请到邮箱点击重置链接（注意垃圾箱）" };
}

/** 设置新密码（要求当前已有会话：重置链接在 /auth/callback 兑换过） */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) return { error: "两次输入的密码不一致" };

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: "设置新密码失败，请重试" };

  redirect("/tasks");
}

/** 退出登录（布局里的"退出"按钮直接用 form action 调用） */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** 从请求头推断当前站点地址（用于构造邮件回跳 URL） */
async function getOrigin(): Promise<string> {
  const headersList = await headers();
  return (
    headersList.get("origin") ?? `http://${headersList.get("host") ?? "localhost:3000"}`
  );
}
