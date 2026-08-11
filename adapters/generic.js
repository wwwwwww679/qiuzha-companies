// 通用适配器：无 LLM 时产出「待核验」候选（仅记录来源与证据片段）；
// 有 LLM 时由 lib/llm.js 补充抽取岗位明细。绝不编造实时事实。
function extract(html, seed, ctx) {
  const finalUrl = (ctx && ctx.finalUrl) || seed.careerUrl;

  const text = (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

  // 尝试从页面里找招聘相关链接，作为证据
  const links = [];
  const re = /href=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html || '')) !== null && links.length < 20) {
    const h = m[1];
    if (/job|career|recruit|campus|zhaopin|apply/i.test(h)) links.push(h);
  }

  const candidate = {
    name: seed.name,
    roles: [],
    city: seed.city || null,
    recruit: seed.recruit || '校招',
    target: seed.target || null,
    deadline: null,
    link: finalUrl,
    notice: '规则解析未抽取到岗位明细，待 AI/人工核验',
    status: '待核验',
    source: seed.sourceType || 'generic',
    evidence: text,
    foundLinks: links.slice(0, 5)
  };
  return [candidate];
}

module.exports = { extract };
