// 重试接口
// POST /api/tasks/[id]/retry   重新生成失败的任务
// 规则：只有属主且状态为 FAILED 的任务可以重试；
//      在同一行上更新（retry_count+1、状态回 PENDING），不产生重复任务

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enqueue } from "@/lib/queue";

export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  const { data: task, error: fetchErr } = await supabase
    .from("tasks")
    .select("status, retry_count")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !task) return Response.json({ error: "任务不存在" }, { status: 404 });
  if (task.status !== "FAILED") {
    return Response.json({ error: "只有失败的任务可以重试" }, { status: 409 });
  }

  const { error: updateErr } = await supabase
    .from("tasks")
    .update({
      status: "PENDING", // 回到队列入口，由后台队列接管，和新建任务走同一条路
      error_message: null,
      retry_count: task.retry_count + 1,
      image_urls: [],
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateErr) {
    console.error("[retry] 数据库更新失败:", updateErr.message);
    return Response.json({ error: "重试失败，请稍后重试" }, { status: 500 });
  }

  after(() => enqueue({ taskId: id, userId: user.id }));

  return Response.json({ ok: true });
}
