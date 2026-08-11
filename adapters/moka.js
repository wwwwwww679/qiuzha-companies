// Moka ATS 适配器（最小实现，失败回退 generic）
const generic = require('./generic');

function extract(html, seed, ctx) {
  if (!html || !/moka|职位|招聘/i.test(html)) return generic.extract(html, seed, ctx);
  return generic.extract(html, seed, ctx);
}

module.exports = { extract };
