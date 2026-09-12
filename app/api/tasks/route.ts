// 任务集合接口
// GET  /api/tasks        当前用户的任务列表
// POST /api/tasks        创建任务（落库后由后台队列异步生成图片，立即返回）

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { taskCreateSchema, firstError } from "@/lib/validation";
import { enqueue } from "@/lib/queue";

// Vercel 上本函数（含 after 里的后台生成）最长允许运行时间
export const maxDuration = 60;

/** 每个接口都要自行鉴权（proxy 不覆盖 /api），未登录返回 401 JSON */
async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getAuthUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id) // 代码层过滤 + RLS 双保险
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return Response.json({ error: "数据库查询失败" }, { status: 500 });
  return Response.json({ data });
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });

  // 服务端校验（与前端共用 lib/validation.ts 里的 schema）
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求体必须是合法的 JSON" }, { status: 400 });
  }

  const parsed = taskCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: firstError(parsed.error) }, { status: 422 });
  }

  // 落库：任务先以 PENDING 状态持久化（tasks 表同时是持久化队列）
  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      product_name: parsed.data.product_name,
      image_count: parsed.data.image_count,
      status: "PENDING",
    })
    .select("id")
    .single();

  if (error || !task) {
    console.error("[POST /api/tasks] 数据库写入失败:", error?.message);
    return Response.json({ error: "创建任务失败，请稍后重试" }, { status: 500 });
  }

  // 响应先行，图片生成放到后台队列执行
  // （after：在响应发送后继续执行，Vercel 上通过 waitUntil 保持函数存活）
  after(() => enqueue({ taskId: task.id, userId: user.id }));

  return Response.json({ data: task }, { status: 201 });
}
