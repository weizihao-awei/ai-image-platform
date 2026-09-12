// zod 校验 schema：前端表单和服务端 API 共用同一套规则
// 好处：规则只写一份，前后端不会出现"标准不一致"

import { z } from "zod";

/** 创建任务入参：商品名称 + 图片数量 */
export const taskCreateSchema = z.object({
  product_name: z
    .string()
    .trim() // 去掉首尾空格后再判断，纯空格也算空
    .min(1, "商品名称不能为空")
    .max(50, "商品名称最多 50 个字符"),
  image_count: z.coerce // 表单里拿到的是字符串，coerce 自动转数字
    .number()
    .int("图片数量必须是整数")
    .min(1, "图片数量至少 1 张")
    .max(4, "图片数量最多 4 张"),
});

/** 邮箱：去掉首尾空格 + 统一小写，再校验格式 */
export const emailSchema = z
  .string()
  .trim()
  .min(1, "请输入邮箱")
  .transform((value) => value.toLowerCase())
  .pipe(z.email("邮箱格式不正确"));

/** 登录/注册入参：邮箱 + 密码 */
export const authSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, "密码至少 6 位").max(72, "密码最多 72 位"),
});

/** 重置密码入参：新密码 */
export const passwordSchema = z
  .string()
  .min(6, "密码至少 6 位")
  .max(72, "密码最多 72 位");

/** 从 zod 错误里取第一条人话提示 */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "输入不合法";
}
