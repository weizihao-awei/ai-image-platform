import { TaskForm } from "./task-form";

export const metadata = { title: "新建任务 - AI 图片生成平台" };

export default function NewTaskPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <h1 className="text-xl font-semibold">新建图片生成任务</h1>
      <p className="mt-1 text-sm text-zinc-500">输入商品名称，AI 将为它生成电商商品图</p>
      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <TaskForm />
      </div>
    </div>
  );
}
