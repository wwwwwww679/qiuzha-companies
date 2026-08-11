// 9.2 Diff 规则：new / changed(保留上一版) / suspectedClosed(不立即删) / closed / errors(不覆盖可信旧值)
function stripMeta(c) {
  if (!c || typeof c !== 'object') return c;
  const { _prev, _validation, suspectedClosed, ...rest } = c;
  return rest;
}

function diffCompanies(baseline, discovered) {
  const map = new Map();
  (baseline || []).forEach(c => map.set(c.n, { ...c, _prev: null }));
  const events = { new: 0, changed: 0, suspectedClosed: 0, closed: 0 };

  (discovered || []).forEach(d => {
    const prev = map.get(d.n);
    if (!prev) {
      map.set(d.n, { ...d, _prev: null });
      events.new++;
      return;
    }
    const changed = JSON.stringify(stripMeta(prev)) !== JSON.stringify(stripMeta(d));
    if (!changed) return;

    const merged = { ...d, _prev: stripMeta(prev) };
    const looksClosed = d.status === 'closed'
      || (Array.isArray(d.roles) && d.roles.length === 0 && Array.isArray(prev.roles) && prev.roles.length > 0)
      || (prev.deadline && !d.deadline && (!d.status || d.status === '待核验'));

    if (looksClosed) {
      merged.suspectedClosed = true;
      events.suspectedClosed++;
    } else {
      events.changed++;
    }
    if (d.status === 'closed') events.closed++;
    map.set(d.n, merged);
  });

  return { merged: Array.from(map.values()), events };
}

module.exports = { diffCompanies, stripMeta };
