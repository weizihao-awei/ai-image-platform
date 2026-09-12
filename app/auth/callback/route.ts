// 认证回调：邮件里的确认/重置链接都会落到这里
// 作用：用 URL 中的 code 向 Supabase 兑换登录会话（写入 Cookie），再跳往目标页
// - 注册确认邮件 → next 缺省为 "/" → 最终进入任务列表
// - 重置密码邮件 → next=/reset-password → 进入设置新密码页

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // next 只允许站内路径，防止开放重定向
      const safeNext = next.startsWith("/") ? next : "/";
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // code 缺失或兑换失败（链接过期/已使用）→ 回登录页
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
