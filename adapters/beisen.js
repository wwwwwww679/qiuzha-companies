// 北森 ATS 适配器（最小实现，失败回退 generic）
const generic = require('./generic');

function extract(html, seed, ctx) {
  if (!html || !/position|职位|招聘|beisen/i.test(html)) return generic.extract(html, seed, ctx);
  // 北森页面结构差异大，统一交给 generic 记录来源，AI 补全
  return generic.extract(html, seed, ctx);
}

module.exports = { extract };
