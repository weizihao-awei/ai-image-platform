// 任务处理器：一个任务从 PROCESSING 到终态（SUCCESS / FAILED）的完整流水线
//
// 流程：置 PROCESSING → 读任务 → 生成 Prompt → 逐张调用生图 API → 全部成功写 URL
// 任何一步失败：置 FAILED 并记录原因（用户可在详情页看到并手动重试）

import { createClient } from "./supabase/server";
import { buildPrompt } from "./prompt";
import { generateImages } from "./siliconflow";

export async function processTask(taskId: string, userId: string): Promise<void> {
  // 以当前用户的身份操作数据库（Cookie 里的 JWT + RLS 保证只能改自己的任务）
  const supabase = await createClient();

  try {
    // 1. 标记为生成中
    const { error: statusErr } = await supabase
      .from("tasks")
      .update({ status: "PROCESSING", error_message: null })
      .eq("id", taskId)
      .eq("user_id", userId);
    if (statusErr) throw new Error(`更新任务状态失败：${statusErr.message}`);

    // 2. 读取任务内容
    const { data: task, error: fetchErr } = await supabase
      .from("tasks")
      .select("product_name, image_count")
      .eq("id", taskId)
      .eq("user_id", userId)
      .single();
    if (fetchErr || !task) throw new Error("任务不存在或已被删除");

    // 3. 一次 API 调用批量生成（Kolors 支持 batch_size 1–4，image_count 恰好在 1–4 范围内）
    const prompt = buildPrompt(task.product_name);
    const urls = await generateImages(prompt, task.image_count);

    // 4. 全部成功：写回结果
    const { error: saveErr } = await supabase
      .from("tasks")
      .update({ status: "SUCCESS", image_urls: urls, error_message: null })
      .eq("id", taskId)
      .eq("user_id", userId);
    if (saveErr) throw new Error(`保存生成结果失败：${saveErr.message}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    console.error(`[task-processor] 任务 ${taskId} 失败: ${message}`);

    // 5. 失败收尾：记录原因，等待用户手动重试
    //    如果连这次更新也失败（数据库整体异常），只能靠日志排查
    const { error: failErr } = await supabase
      .from("tasks")
      .update({ status: "FAILED", error_message: message })
      .eq("id", taskId)
      .eq("user_id", userId);
    if (failErr) {
      console.error(`[task-processor] 任务 ${taskId} 写入失败状态也失败了:`, failErr.message);
    }
  }
}
