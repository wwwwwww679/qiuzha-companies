// tupu360 校招 ATS 适配器（IQVIA 等使用；最小实现，主要依赖 LLM 补全）
const generic = require('./generic');

function extract(html, seed, ctx) {
  if (!html) return generic.extract(html, seed, ctx);
  // tupu360 校招页通常含职位卡片，结构不固定，先记录来源，AI 补全
  return generic.extract(html, seed, ctx);
}

module.exports = { extract };
