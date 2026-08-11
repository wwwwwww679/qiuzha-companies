// 带超时与重试的抓取，返回 { html, finalUrl, status }
async function fetchWithTimeout(url, timeoutMs = 15000, retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; QiuzhaoDiscovery/1.0; +https://github.com/wwwwwww679/qiuzhao-discovery)',
          'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9'
        }
      });
      clearTimeout(t);
      const html = await res.text();
      return { html, finalUrl: res.url || url, status: res.status };
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
    }
  }
  throw lastErr;
}

module.exports = { fetchWithTimeout };
