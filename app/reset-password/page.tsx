// 设置新密码页（服务端组件）：
// 用户从重置邮件的链接进入 —— 链接先在 /auth/callback 兑换 recovery 会话，
// 到这里时已是登录态，才能调用 updateUser 改密码；未登录则拒绝访问

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetForm } from "./reset-form";

export const metadata = { title: "设置新密码 - AI 图片生成平台" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // 没有有效会话 = 不是从重置链接正常进来的
  if (!data.user) redirect("/login?error=auth");

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">设置新密码</h1>
        <p className="mt-1 text-sm text-zinc-500">为 {data.user.email} 设置新密码</p>
        <ResetForm />
      </div>
    </div>
  );
}
