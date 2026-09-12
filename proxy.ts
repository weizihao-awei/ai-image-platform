// Proxy（Next.js 16 中由 middleware 更名而来）
// 职责：
// 1. 每个请求进来先刷新一次 Supabase 会话（access token 快过期时自动续期）
// 2. 做乐观路由保护：未登录访问 /tasks/** 跳登录页；已登录访问 /login 跳任务列表
//
// 注意：
// - 这里只是"乐观检查"，真正的数据安全由 RLS + 各页面/API 内部的 getUser() 保证
// - matcher 排除了 /api（API 路由自己返回 401 JSON，不能被重定向）和静态资源
// - 但不能排除 /login 本身：登录 Server Action 是对该页面路由的 POST 请求

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // 缺配置时直接放行，让页面/接口自己给出明确报错
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // 把续期后的会话 Cookie 同时写进请求上下文和响应
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // 触发一次用户查询：会话有效则拿到用户，无效/过期则由上面的 setAll 完成续期
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && pathname.startsWith("/tasks")) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/tasks", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
