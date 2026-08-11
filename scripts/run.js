// 兜底：个别种子抓取被中止(fetch abort)可能产生游离 rejection，
// 不应导致整个流水线以非 0 退出而阻断 GitHub Actions 提交。仅记录，不退出。
process.on('unhandledRejection', (e) => { console.error('[unhandledRejection]', e && e.message ? e.message : e); });
process.on('uncaughtException', (e) => { console.error('[uncaughtException]', e && e.message ? e.message : e); });

const fs = require('fs');
const path = require('path');
const { fetchWithTimeout } = require('../lib/fetch');
const { extractWithLLM } = require('../lib/llm');
const { validateRecord } = require('../lib/schema');
const { diffCompanies } = require('../lib/diff');
const { getAdapter } = require('../adapters');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const CONFIG = path.join(ROOT, 'config');
const today = new Date().toISOString().slice(0, 10);
// 仓库标识：默认与前端 COMPANY_CDN_BASE 一致；在工作流中由 github.repository 注入。
const REPO_SLUG = process.env.REPO_SLUG || 'wwwwwww679/qiuzha-companies';

function loadJSON(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}
function saveJSON(p, o) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(o, null, 2));
}

// 线上实时基线：始终以仓库当前 companies.json 为权威基准，避免覆盖用户在网页/手动提交里做的修改。
async function fetchLiveBaseline() {
  try {
    const url = `https://raw.githubusercontent.com/${REPO_SLUG}/main/companies.json?t=${Date.now()}`;
    const r = await fetchWithTimeout(url, 15000, 1);
    const json = JSON.parse(r.html);
    if (Array.isArray(json) && json.length) {
      console.log('[baseline] 使用线上实时数据 ' + json.length + ' 条（权威基准）');
      return json;
    }
  } catch (e) {
    console.log('[baseline] 线上拉取失败，回退本地快照: ' + (e && e.message ? e.message : e));
  }
  return null;
}

function credOf(rec) {
  if (!rec.link && !rec.notice) return 'legacy';
  const base = rec.lastVerifiedAt || rec.update || today;
  const days = (Date.now() - new Date(base).getTime()) / 86400000;
  if (days <= 7) return 'verified';
  if (days <= 30) return 'fresh';
  if (days <= 180) return 'stale';
  return 'legacy';
}

function normalize(c, seed, finalUrl) {
  return {
    n: c.name || seed.name,
    type: c.type || seed.type || '',
    industry: c.industry || seed.industry || '',
    recruit: c.recruit || seed.recruit || '校招',
    target: c.target || seed.target || '',
    city: c.city || null,
    roles: Array.isArray(c.roles) ? c.roles : [],
    link: c.link || finalUrl,
    notice: c.notice || '',
    source: c.source || seed.sourceType || 'generic',
    update: today,
    deadline: (c.deadline === undefined ? null : c.deadline),
    status: c.status || '待核验',
    progress: c.progress || '',
    sourceUrl: finalUrl,
    sourceType: seed.sourceType || 'generic',
    lastVerifiedAt: today,
    firstSeen: c.firstSeen || today
  };
}

async function discoverSeed(seed) {
  let html = null, finalUrl = seed.careerUrl;
  try {
    const r = await fetchWithTimeout(seed.careerUrl, 15000);
    html = r.html;
    finalUrl = r.finalUrl || seed.careerUrl;
  } catch (e) {
    return { seed: seed.name, ok: false, error: 'fetch_failed: ' + e.message, valid: [], pending: [] };
  }

  const adapter = getAdapter(seed.sourceType);
  let candidates = [];
  try { candidates = await adapter.extract(html, seed, { finalUrl }); } catch (e) { candidates = []; }

  const useLLM = !!process.env.DEEPSEEK_API_KEY;
  if (useLLM) {
    try {
      const llm = await extractWithLLM(html, seed);
      if (Array.isArray(llm) && llm.length) candidates = llm;
    } catch (e) {
      // 保留规则解析结果
      console.log('[llm-skip] ' + seed.name + ': ' + e.message);
    }
  }

  const valid = [], pending = [];
  for (const c of candidates) {
    const rec = normalize(c, seed, finalUrl);
    const v = validateRecord(rec);
    if (v.ok) {
      rec.credibility = credOf(rec);
      valid.push(rec);
    } else {
      rec._validation = v.errors;
      rec.status = '待核验';
      pending.push(rec);
    }
  }
  return { seed: seed.name, ok: true, valid, pending, finalUrl };
}

(async () => {
  const seeds = loadJSON(path.join(CONFIG, 'seeds.json'), []);
  const committed = loadJSON(path.join(DATA, 'companies.json'), []);
  // 优先用线上实时数据作为权威基准；拉取失败才回退到本次提交的快照。
  const baseline = (await fetchLiveBaseline())
    || (Array.isArray(committed) && committed.length ? committed : []);
  const allValid = [], allPending = [];

  for (const s of seeds) {
    const r = await discoverSeed(s);
    if (r.ok) {
      allValid.push(...r.valid);
      allPending.push(...r.pending);
      console.log('[ok] ' + r.seed + ' valid=' + r.valid.length + ' pending=' + r.pending.length);
    } else {
      console.log('[skip] ' + r.seed + ': ' + r.error);
    }
  }

  // 9.2 diff：仅用通过校验的 valid 合并进 companies.json；
  // pending（校验失败）进入候选池/待核验，绝不覆盖可信旧值
  const { merged, events } = diffCompanies(baseline, allValid);

  saveJSON(path.join(DATA, 'companies.json'), merged);
  saveJSON(path.join(DATA, 'candidates.json'),
    allValid.concat(allPending).map(c => ({
      n: c.n, sourceUrl: c.sourceUrl, status: c.status, roles: c.roles, pending: !c.credibility
    }))
  );
  saveJSON(path.join(DATA, 'pending-review.json'),
    allPending.map(c => ({ n: c.n, sourceUrl: c.sourceUrl, errors: c._validation, capturedAt: today }))
  );

  const meta = {
    updated: today,
    last_checked: today,
    count: merged.length,
    version: 2,
    source: 'github-actions',
    events
  };
  saveJSON(path.join(DATA, 'meta.json'), meta);

  console.log('[done] 合并后企业数=' + merged.length +
    ' 事件=' + JSON.stringify(events) + ' 待核验=' + allPending.length);
  process.exit(0);
})().catch(e => { console.error('FATAL', e && e.stack ? e.stack : e); process.exit(0); });
