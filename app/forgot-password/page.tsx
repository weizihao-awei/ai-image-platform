import { ForgotForm } from "./forgot-form";

export const metadata = { title: "找回密码 - AI 图片生成平台" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">找回密码</h1>
        <p className="mt-1 text-sm text-zinc-500">
          输入注册邮箱，我们会发送重置链接
        </p>
        <ForgotForm />
      </div>
    </div>
  );
}
