// Prompt 生成：把用户输入的商品名称扩展成一条高质量的生图 Prompt
// demo 用模板实现（零成本、结果稳定）；生产可换成 LLM 动态改写

export function buildPrompt(productName: string): string {
  return [
    `电商商品主图摄影：${productName}`,
    "商业级产品摄影",
    "柔和均匀的棚拍灯光",
    "干净简洁的浅色纯色背景",
    "商品主体突出、构图居中",
    "真实材质细节",
    "超高清画质",
  ].join("，");
}
