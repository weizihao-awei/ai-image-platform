// 单任务接口
// GET /api/tasks/[id]   查询单个任务（轮询 / 程序化查询用）

import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });

  const { id } = await params; // Next.js 16：params 是 Promise

  const { data: task, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id) // 不是自己的任务查不到（RLS 也会拦）
    .single();

  // 查不到统一返回 404，不区分"不存在"和"别人的任务"，避免暴露数据存在性
  if (error || !task) return Response.json({ error: "任务不存在" }, { status: 404 });

  return Response.json({ data: task });
}
