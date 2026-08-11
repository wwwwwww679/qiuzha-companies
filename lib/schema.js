// PRD 7.3 AI 输出校验：日期必须可解析，字段完整性检查；失败进 pending-review。
function parseableDate(s) {
  if (s === null || s === undefined) return null;
  const str = String(s).trim();
  if (!str) return null;
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(str);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  return true;
}

function validateRecord(r) {
  const errors = [];
  if (!r || typeof r !== 'object') return { ok: false, errors: ['record not object'] };
  if (!r.n || typeof r.n !== 'string') errors.push('缺少公司名 n');
  if (!r.link && (!Array.isArray(r.roles) || r.roles.length === 0)) errors.push('缺少 link 或 roles');
  if (r.deadline !== null && r.deadline !== undefined && !parseableDate(r.deadline)) {
    errors.push('deadline 不可解析: ' + r.deadline);
  }
  if (!r.sourceUrl) errors.push('缺少 sourceUrl');
  return { ok: errors.length === 0, errors };
}

module.exports = { validateRecord, parseableDate };
