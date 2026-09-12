// Supabase 服务端客户端工厂（配合 @supabase/ssr 做基于 Cookie 的会话）
//
// 要点：
// 1. 每次请求调用 createClient() 新建实例，不在模块间共享（请求间会话可能不同）
// 2. 会话存在 Cookie 里：读取用 getAll，需要刷新会话时用 setAll 写回
// 3. 环境变量不带 NEXT_PUBLIC_ 前缀，只存在于服务端，不会进浏览器代码

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("缺少 Supabase 环境变量，请检查 .env.local 中的 SUPABASE_URL / SUPABASE_ANON_KEY");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Server Action / Route Handler 里可以直接写 Cookie；
        // 在只读渲染上下文中写 Cookie 会抛错，这里兜住不阻塞渲染
        // （会话刷新主要由 proxy.ts 负责）
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // 忽略：无写权限的上下文
        }
      },
    },
  });
}
