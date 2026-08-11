// 调用 DeepSeek 从网页文本抽取结构化岗位记录。
// 严格遵守 PRD 7.3：仅输出页面存在的真实事实，未知字段为 null，禁止编造截止日期。
async function extractWithLLM(html, seed, timeoutMs = 60000) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('no DEEPSEEK_API_KEY');

  // 清洗 HTML 为纯文本并截断，避免超长 / 注入
  const text = (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000);

  const prompt = `你是招聘信息抽取器。从下面网页文本中抽取「${seed.name}」的校园招聘/实习岗位。\n要求：\n1. 只输出页面中确实出现的岗位信息，绝对不要编造岗位名、城市或截止日期。\n2. 每条记录字段：name(公司名), roles(岗位名数组), city(工作城市或null), recruit(校招/实习), target(届别如2027届或null), deadline(可解析日期 YYYY-MM-DD 或 null), link(岗位/官网链接), notice(备注或null), status(招聘中/未开始/已截止/待核验)。\n3. deadline 必须是 YYYY-MM-DD 格式或 null；若页面未明确写截止日则填 null。\n4. 输出严格的 JSON 数组，不要任何解释文字，不要 markdown 代码块。\n网页文本：\n${text}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: 'json_object' }
      })
    });
    clearTimeout(t);
    if (!res.ok) throw new Error('LLM HTTP ' + res.status);
    const data = await res.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error('empty LLM content');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.records)) return parsed.records;
    if (Array.isArray(parsed.jobs)) return parsed.jobs;
    throw new Error('LLM 输出非数组');
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

module.exports = { extractWithLLM };
