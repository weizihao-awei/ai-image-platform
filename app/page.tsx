import { redirect } from "next/navigation";

// 首页直接跳转到任务列表
export default function Home() {
  redirect("/tasks");
}
