import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI 图片生成平台",
  description: "输入商品名称，AI 一键生成电商商品图",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // 布局里读取当前登录用户：用于导航栏展示账号和退出按钮
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;

  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900">
        {/* 顶部导航 */}
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
            <Link href="/tasks" className="text-base font-semibold">
              AI 图片生成平台
            </Link>
            {user ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="max-w-[220px] truncate text-zinc-500" title={email ?? undefined}>
                  {email}
                </span>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm transition-colors hover:border-zinc-900"
                  >
                    退出
                  </button>
                </form>
              </div>
            ) : (
              <Link href="/login" className="text-sm text-zinc-600 hover:text-zinc-900">
                登录
              </Link>
            )}
          </div>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
