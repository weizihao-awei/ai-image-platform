import { LoginForm } from "./login-form";

export const metadata = { title: "登录 - AI 图片生成平台" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // /auth/callback 兑换失败会带 ?error=auth 重定向回这里
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">AI 图片生成平台</h1>
        <p className="mt-1 text-sm text-zinc-500">使用邮箱登录，没有账号可在下方注册</p>
        <LoginForm authError={error} />
      </div>
    </div>
  );
}
