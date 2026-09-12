// 进程内轻量任务队列（demo 级"队列 + Worker + 限流"三合一）
//
// 设计：
// - tasks 表是持久化队列：任务先进数据库（PENDING），进程重启也不会丢
// - 这里只做"执行调度"：从内存队列取任务跑，最多同时跑 MAX_CONCURRENT 个
// - MAX_CONCURRENT 同时起到第三方 API 并发限流的作用
//
// 局限（README 有说明）：单实例内存队列，生产环境应换成 Redis/BullMQ + 独立 Worker

import { processTask } from "./task-processor";

type Job = { taskId: string; userId: string };

const MAX_CONCURRENT = 2;

const queue: Job[] = [];
let active = 0;
let pumping = false;

/** 把任务放进执行队列，立即返回；由 pump 在后台消化 */
export function enqueue(job: Job): void {
  queue.push(job);
  pump();
}

function pump(): void {
  if (pumping) return;
  pumping = true;
  try {
    // 只要还有空闲并发额度且队列里有任务，就继续取
    while (active < MAX_CONCURRENT && queue.length > 0) {
      const job = queue.shift();
      if (!job) break;
      active++;
      runJob(job).finally(() => {
        active--;
        // 异步完成后回到这里，把队列里剩下的任务继续调度起来
        pump();
      });
    }
  } finally {
    pumping = false;
  }
}

async function runJob(job: Job): Promise<void> {
  try {
    await processTask(job.taskId, job.userId);
  } catch (err) {
    // processTask 内部已经全量兜底，这里是最后一道防线
    console.error(`[queue] 任务 ${job.taskId} 处理异常:`, err);
  }
}
