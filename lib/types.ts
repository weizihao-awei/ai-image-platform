// 与数据库 tasks 表对应的类型定义（手动维护，字段与 0001_init.sql 保持一致）

export const TASK_STATUSES = ["PENDING", "PROCESSING", "SUCCESS", "FAILED"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type Task = {
  id: string;
  user_id: string;
  product_name: string;
  status: TaskStatus;
  image_count: number;
  image_urls: string[];
  retry_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};
