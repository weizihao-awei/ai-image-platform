// SiliconFlow 生图 API 客户端
// 文档：https://docs.siliconflow.cn（模型：Kwai-Kolors/Kolors）
//
// 注意：API 返回的图片 URL 是 1 小时有效的临时预签名链接（demo 直接存这个 URL，
// README 中说明了生产环境应转存到对象存储）

const API_URL = "https://api.siliconflow.cn/v1/images/generations";
const MODEL = "Kwai-Kolors/Kolors";
const IMAGE_SIZE = "1024x1024";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2; // 自动重试 1 次
const RETRY_DELAY_MS = 2_000;

export class SiliconFlowError extends Error {
  /** 是否值得重试（网络异常/服务端错误可重试；参数错误重试没意义） */
  retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "SiliconFlowError";
    this.retryable = retryable;
  }
}

/**
 * 生成一张图片，返回图片临时 URL
 * 内置自动重试：网络异常 / 服务端 5xx 时等待 2 秒再试一次
 */
export async function generateImage(prompt: string): Promise<string> {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    throw new SiliconFlowError("缺少 SILICONFLOW_API_KEY 环境变量", false);
  }

  let lastError: SiliconFlowError = new SiliconFlowError("生成失败", true);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          prompt,
          image_size: IMAGE_SIZE,
          batch_size: 1, // 一次一张，多张由调用方循环（失败时语义更清晰）
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (res.ok) {
        const data = await res.json();
        const url: string | undefined = data?.images?.[0]?.url;
        if (!url) {
          throw new SiliconFlowError("API 响应中没有图片 URL", false);
        }
        return url;
      }

      // 4xx：请求本身有问题（key 无效、参数错误等），重试无意义
      const body = await res.text().catch(() => "");
      if (res.status >= 400 && res.status < 500) {
        throw new SiliconFlowError(
          `生图 API 请求被拒绝（HTTP ${res.status}）${body ? `：${body.slice(0, 200)}` : ""}`,
          false,
        );
      }

      // 5xx：服务端问题，可重试
      lastError = new SiliconFlowError(`生图 API 服务端错误（HTTP ${res.status}）`, true);
    } catch (err) {
      // 已经包装成 SiliconFlowError 的：不可重试的直接抛出，可重试的记录后继续
      if (err instanceof SiliconFlowError) {
        if (!err.retryable) throw err;
        lastError = err;
      } else {
        // fetch 网络异常、超时等
        lastError = new SiliconFlowError(
          err instanceof Error ? `网络异常：${err.message}` : "网络异常",
          true,
        );
      }
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  throw lastError;
}
