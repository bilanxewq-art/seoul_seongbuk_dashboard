(function () {
  var root = document.querySelector('.sb');
  var C = dash.colors;
  root.style.setProperty('--dash-c0', C[0]); root.style.setProperty('--dash-c1', C[1]); root.style.setProperty('--dash-c2', C[2]);
  var nf = d3.format(',');
  var S = { rank: 'n', period: 'M', tab: 't', sel: null, saved: [], added: [], idx: 'sale_idx' };
  var DAY = 86400000;
  var TODAY_MAX = '2026-10-31';

  function D(id) { var g = dash.data(id); return g.status === 'ok' ? g.data : null; }
  function won(m) { if (m == null || isNaN(m)) return '—'; if (m >= 10000) return (Math.round(m / 100) / 100).toFixed(2).replace(/\.?0+$/, '') + '억'; return nf(Math.round(m)) + '만'; }
  function med(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); var n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
  function ymd(t) { return new Date(t).toISOString().slice(0, 10); }
  function ptime(s) { return Date.parse(s + 'T00:00:00Z'); }
  function monday(s) { var t = ptime(s), w = (new Date(t).getUTCDay() + 6) % 7; return ymd(t - w * DAY); }
  function hav(a, b, c, d) { var R = 6371000, r = Math.PI / 180, x = (d - b) * r * Math.cos((a + c) / 2 * r), y = (c - a) * r; return Math.sqrt(x * x + y * y) * R; }
  function dist(m) { return m >= 1000 ? (m / 1000).toFixed(1) + 'km' : Math.round(m / 10) * 10 + 'm'; }
  function walk(m) { return '도보 ' + Math.max(1, Math.round(m / 80)) + '분'; }

  var cache = {};
  function trades() {
    var r = D('trade'); if (!r) return null; if (cache.t && cache.tr === r) return cache.t;
    cache.tr = r; return (cache.t = r.map(function (x) { var a = +x.area, p = +x.price; return { apt: x.apt, dong: x.dong, built: x.built, area: a, floor: x.floor, price: p, date: x.date, py: p / (a / 3.3058) }; }).filter(function (x) { return x.area >= 20; }));
  }
  function rents() {
    var r = D('rent'); if (!r) return null; if (cache.r && cache.rr === r) return cache.r;
    cache.rr = r; return (cache.r = r.map(function (x) { var a = +x.area, dp = +x.deposit, mo = +x.monthly; return { apt: x.apt, dong: x.dong, built: x.built, area: a, floor: x.floor, dep: dp, mo: mo, date: x.date, kind: mo > 0 ? 'w' : 'j', py: dp / (a / 3.3058) }; }).filter(function (x) { return x.area >= 20; }));
  }
  function P() {
    var p = dash.params(), end = p.end || TODAY_MAX;
    if (end > TODAY_MAX) end = TODAY_MAX;
    var start = p.start || ymd(ptime(end) - (S.period === 'W' ? 12 * 7 - 1 : 182) * DAY);
    if (start > end) start = end;
    return { dong: p.dong || '', start: start, end: end };
  }
  function inP(x, p) { return x.date >= p.start && x.date <= p.end && (!p.dong || x.dong === p.dong); }
  function prevP(p) {
    var len = Math.round((ptime(p.end) - ptime(p.start)) / DAY) + 1;
    return { dong: p.dong, start: ymd(ptime(p.start) - len * DAY), end: ymd(ptime(p.start) - DAY) };
  }
  function redraw() { for (var i = 0; i < arguments.length; i++) dash.draw(arguments[i]); }
  var ALL = ['lede', 'dongsel', 'savedchips', 'k_tn', 'k_tn_s', 'k_py', 'k_py_s', 'k_jd', 'k_jd_s', 'k_wd', 'k_wd_s', 'cap1', 'cap2', 'cap3', 'cap4', 'ch_price', 'ch_vol', 'dongtable', 'toplist', 'topmap', 'topdetail', 'listings', 'loctitle', 'locsub', 'locmap', 'locsum', 'locgrid'];

  /* ---------- controls ---------- */
  var fs = document.getElementById('f-start'), fe = document.getElementById('f-end');
  function syncCtrl() {
    var p = P();
    if (document.activeElement !== fs) fs.value = p.start;
    if (document.activeElement !== fe) fe.value = p.end;
    document.getElementById('p-w').setAttribute('aria-pressed', S.period === 'W');
    document.getElementById('p-m').setAttribute('aria-pressed', S.period === 'M');
    ['t', 'j', 'w'].forEach(function (k) { document.getElementById('tt-' + k).setAttribute('aria-pressed', S.tab === k); });
    document.getElementById('rk-n').setAttribute('aria-pressed', S.rank === 'n'); document.getElementById('rk-p').setAttribute('aria-pressed', S.rank === 'p');
    ['sale', 'jeonse', 'wolse'].forEach(function (k) { document.getElementById('ix-' + k).setAttribute('aria-pressed', S.idx === k + '_idx'); });
  }
  function applyDates(el, key) {
    el.addEventListener('change', function () { if (el.value && el.validity.valid) { var o = {}; o[key] = el.value; dash.setParams(o); } });
    el.addEventListener('blur', syncCtrl);
  }
  applyDates(fs, 'start'); applyDates(fe, 'end');
  document.getElementById('p-w').addEventListener('click', function () { S.period = 'W'; dash.setParams({ start: null }); syncCtrl(); redraw.apply(null, ALL); });
  document.getElementById('p-m').addEventListener('click', function () { S.period = 'M'; dash.setParams({ start: null }); syncCtrl(); redraw.apply(null, ALL); });
  document.getElementById('f-reset').addEventListener('click', function () { dash.resetParams(); dash.setParams({ start: null, end: null, dong: null }); S.period = 'M'; syncCtrl(); redraw.apply(null, ALL); });
  document.getElementById('f-save').addEventListener('click', function () { var p = P(); S.saved.push({ start: p.start, end: p.end, period: S.period }); redraw('savedchips'); });
  [['t', 'tt-t'], ['j', 'tt-j'], ['w', 'tt-w']].forEach(function (a) { document.getElementById(a[1]).addEventListener('click', function () { S.tab = a[0]; S.sel = null; syncCtrl(); redraw('cap4', 'toplist', 'topmap', 'topdetail', 'loctitle', 'locsub', 'locmap', 'locsum', 'locgrid'); }); });
  [['n', 'rk-n'], ['p', 'rk-p']].forEach(function (z) { document.getElementById(z[1]).addEventListener('click', function () { S.rank = z[0]; S.sel = null; syncCtrl(); redraw('cap4', 'toplist', 'topmap', 'topdetail', 'loctitle', 'locsub', 'locmap', 'locsum', 'locgrid'); }); });
  [['sale_idx', 'ix-sale'], ['jeonse_idx', 'ix-jeonse'], ['wolse_idx', 'ix-wolse']].forEach(function (a) { document.getElementById(a[1]).addEventListener('click', function () { S.idx = a[0]; syncCtrl(); redraw('ch_idx'); }); });
  document.getElementById('a-add').addEventListener('click', function () {
    var v = function (id) { return document.getElementById(id).value; };
    var t = v('a-type'), apt = v('a-apt'); if (!apt) return;
    var pr = +v('a-price') || 0, mo = +v('a-mo') || 0, ar = +v('a-area') || 0;
    var a = (D('apt') || []).filter(function (x) { return x.apt + '|' + x.dong === apt; })[0];
    if (!a) return;
    S.added.push({ id: 'N' + (S.added.length + 1), title: a.apt + (ar ? ' ' + Math.round(ar) + '㎡ ' : ' ') + t, apt: a.apt, dong: a.dong, type: t, area: ar, floor: '', price: t === '매매' ? pr : 0, deposit: t === '매매' ? 0 : pr, monthly: mo, memo: v('a-memo') || '신규 등록' });
    document.getElementById('a-memo').value = '';
    redraw('listings');
  });

  /* ---------- drawings: header / controls ---------- */
  function empty(el) { el.replaceChildren(); el.textContent = '—'; }
  dash.draw('dongsel', function (sel) {
    var a = D('apt'); sel.replaceChildren(new Option('성북구 전체', ''));
    if (a) { d3.group(a, function (x) { return x.dong; }).forEach(function (v, k) { sel.appendChild(new Option(k, k)); }); }
    var arr = Array.from(sel.options).slice(1).sort(function (x, y) { return x.value.localeCompare(y.value, 'ko'); }); arr.forEach(function (o) { sel.appendChild(o); });
    sel.value = dash.params().dong || '';
    sel.onchange = function () { dash.setParams({ dong: sel.value || null }); S.sel = null; redraw.apply(null, ALL); };
    syncCtrl();
  });
  dash.draw('savedchips', function (el) {
    el.replaceChildren();
    if (!S.saved.length) { var m = document.createElement('span'); m.className = 'muted'; m.textContent = '저장한 기간이 없습니다'; el.appendChild(m); return; }
    S.saved.forEach(function (s, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip';
      b.textContent = (s.period === 'W' ? '주간 ' : '월간 ') + s.start.slice(2) + ' ~ ' + s.end.slice(2);
      b.onclick = function () { S.period = s.period; dash.setParams({ start: s.start, end: s.end }); syncCtrl(); redraw.apply(null, ALL); };
      var x = document.createElement('button'); x.type = 'button'; x.className = 'chip'; x.textContent = '×'; x.setAttribute('aria-label', '저장한 기간 삭제');
      x.onclick = function () { S.saved.splice(i, 1); redraw('savedchips'); };
      el.append(b, x);
    });
  });
  dash.draw('lede', function (el) {
    var t = trades(), r = rents(); if (!t || !r) { empty(el); return; }
    var p = P(), tt = t.filter(function (x) { return inP(x, p); }), pv = t.filter(function (x) { return inP(x, prevP(p)); });
    var m = med(tt.map(function (x) { return x.py; })), m0 = med(pv.map(function (x) { return x.py; }));
    var ch = m != null && m0 && prevOk(prevP(p)) ? ((m / m0 - 1) * 100) : null;
    el.textContent = (p.dong || '성북구 전체') + ' · ' + p.start + ' ~ ' + p.end + ' 동안 아파트 매매 ' + nf(tt.length) + '건이 신고되었고 평당 중위 매매가는 ' + (m ? nf(Math.round(m)) : '—') + '만원입니다' + (ch == null ? '.' : ', 직전 같은 기간보다 ' + (ch >= 0 ? '+' : '') + ch.toFixed(1) + '% 변했습니다.');
  });

  /* ---------- KPI ---------- */
  function delta(a, b, unit) { if (a == null || b == null || !b) return '직전 기간 자료 없음'; var d = (a / b - 1) * 100; return '직전 기간 대비 ' + (d >= 0 ? '+' : '') + d.toFixed(1) + '%'; }
  function dataMin() {
    var t = trades(), r = rents(), m = null;
    t.concat(r).forEach(function (x) { if (m === null || x.date < m) m = x.date; });
    return m ? m.slice(0, 7) + '-01' : null;
  }
  function prevOk(q) { var m = dataMin(); return m !== null && q.start >= m; }
  function kp(name, fn) {
    dash.draw(name, function (el) {
      var t = trades(), r = rents(); if (!t || !r) { empty(el); return; }
      var p = P(), q = prevP(p);
      if (/_s$/.test(name) && !prevOk(q)) { el.textContent = '비교 불가'; return; }
      el.textContent = fn(t, r, p, q);
    });
  }
  kp('k_tn', function (t, r, p) { return nf(t.filter(function (x) { return inP(x, p); }).length); });
  kp('k_tn_s', function (t, r, p, q) { var a = t.filter(function (x) { return inP(x, p); }).length, b = t.filter(function (x) { return inP(x, q); }).length; return delta(a, b); });
  kp('k_py', function (t, r, p) { var m = med(t.filter(function (x) { return inP(x, p); }).map(function (x) { return x.py; })); return m ? nf(Math.round(m)) : '—'; });
  kp('k_py_s', function (t, r, p, q) { var f = function (z) { return med(t.filter(function (x) { return inP(x, z); }).map(function (x) { return x.py; })); }; return delta(f(p), f(q)); });
  function rk(r, kind, p) { return r.filter(function (x) { return x.kind === kind && inP(x, p); }); }
  kp('k_jd', function (t, r, p) { var a = rk(r, 'j', p); return nf(a.length) + '건 · ' + won(med(a.map(function (x) { return x.dep; }))); });
  kp('k_jd_s', function (t, r, p, q) { return delta(med(rk(r, 'j', p).map(function (x) { return x.dep; })), med(rk(r, 'j', q).map(function (x) { return x.dep; }))); });
  function ratioOf(t, r, z) {
    var s = med(t.filter(function (x) { return inP(x, z); }).map(function (x) { return x.py; })), j = med(rk(r, 'j', z).map(function (x) { return x.py; }));
    return s && j ? j / s * 100 : null;
  }
  kp('k_ratio', function (t, r, p) { var v = ratioOf(t, r, p); return v == null ? '—' : v.toFixed(1); });
  kp('k_ratio_s', function (t, r, p, q) { var a = ratioOf(t, r, p), b = ratioOf(t, r, q); if (a == null || b == null) return '직전 기간 자료 없음'; var d = a - b; return '직전 기간 대비 ' + (d >= 0 ? '+' : '') + d.toFixed(1) + '%p'; });
  kp('k_wd', function (t, r, p) { var a = rk(r, 'w', p); return nf(a.length) + '건 · ' + won(med(a.map(function (x) { return x.dep; }))) + '/' + nf(Math.round(med(a.map(function (x) { return x.mo; })) || 0)); });
  kp('k_wd_s', function (t, r, p, q) { return delta(med(rk(r, 'w', p).map(function (x) { return x.mo; })), med(rk(r, 'w', q).map(function (x) { return x.mo; }))) + ' (월세 기준)'; });

  /* ---------- chart helpers ---------- */
  function mk(el, w, h) { el.replaceChildren(); var s = d3.select(el).append('svg').attr('viewBox', '0 0 ' + w + ' ' + h).attr('width', '100%').attr('role', 'img'); var tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; el.appendChild(tip); return { svg: s, tip: tip }; }
  function tipShow(el, tip, lines, x, y) { tip.replaceChildren(); lines.forEach(function (l) { var d = document.createElement('div'); if (l[1]) d.className = l[1]; d.textContent = l[0]; tip.appendChild(d); }); tip.hidden = false; var mx = el.clientWidth - tip.offsetWidth - 4; tip.style.left = Math.max(0, Math.min(x + 12, mx)) + 'px'; tip.style.top = Math.max(0, y - 10) + 'px'; }
  function ax(sel) { return sel.attr('font-size', 11).attr('font-family', null).style('fill', 'var(--color-fg-muted)'); }
  function buckets(p) {
    var out = [], key;
    if (S.period === 'W') { var t = ptime(monday(p.start)), e = ptime(p.end); for (; t <= e; t += 7 * DAY) out.push(ymd(t)); key = function (d) { return monday(d); }; }
    else { var y = +p.start.slice(0, 4), m = +p.start.slice(5, 7), ey = +p.end.slice(0, 4), em = +p.end.slice(5, 7); for (; y < ey || (y === ey && m <= em); ) { out.push(y + '-' + (m < 10 ? '0' : '') + m); m++; if (m > 12) { m = 1; y++; } } key = function (d) { return d.slice(0, 7); }; }
    return { keys: out, key: key, label: function (k) { return S.period === 'W' ? k.slice(5).replace('-', '.') : k.slice(2).replace('-', '.'); } };
  }
  function periodWord() { return S.period === 'W' ? '주간 (월요일 시작)' : '월간'; }
  ['cap1', 'cap2'].forEach(function (n) { dash.draw(n, function (el) { var p = P(); el.textContent = (p.dong || '성북구 전체') + ' · ' + periodWord() + ' · ' + p.start + ' ~ ' + p.end + (n === 'cap1' ? ' · 단위 만원/평' : ' · 단위 건'); }); });

  dash.draw('ch_price', function (el) {
    var t = trades(), r = rents(); if (!t || !r) { empty(el); return; }
    var p = P(), bk = buckets(p), w = Math.max(280, el.clientWidth), h = 250, mg = { l: 48, r: 12, t: 12, b: 26 };
    var ts = d3.group(t.filter(function (x) { return inP(x, p); }), function (x) { return bk.key(x.date); });
    var js = d3.group(r.filter(function (x) { return x.kind === 'j' && inP(x, p); }), function (x) { return bk.key(x.date); });
    var rows = bk.keys.map(function (k) { return { k: k, s: med((ts.get(k) || []).map(function (x) { return x.py; })), j: med((js.get(k) || []).map(function (x) { return x.py; })), sn: (ts.get(k) || []).length, jn: (js.get(k) || []).length }; });
    var vals = rows.reduce(function (a, x) { if (x.s) a.push(x.s); if (x.j) a.push(x.j); return a; }, []);
    if (!vals.length) { empty(el); return; }
    var o = mk(el, w, h), svg = o.svg;
    var x = d3.scalePoint(bk.keys, [mg.l + 8, w - mg.r - 8]).padding(0.2);
    var y = d3.scaleLinear([Math.floor(d3.min(vals) * 0.9 / 100) * 100, Math.ceil(d3.max(vals) * 1.05 / 100) * 100], [h - mg.b, mg.t]).nice();
    svg.append('g').selectAll('line').data(y.ticks(5)).join('line').attr('x1', mg.l).attr('x2', w - mg.r).attr('y1', y).attr('y2', y).style('stroke', 'var(--cds-chart-grid)');
    ax(svg.append('g').selectAll('text').data(y.ticks(5)).join('text').attr('x', mg.l - 8).attr('y', y).attr('dy', '0.32em').attr('text-anchor', 'end').text(nf));
    var step = Math.ceil(bk.keys.length / Math.max(3, Math.floor(w / 62)));
    ax(svg.append('g').selectAll('text').data(bk.keys.filter(function (d, i) { return (bk.keys.length - 1 - i) % step === 0; })).join('text').attr('x', x).attr('y', h - 6).attr('text-anchor', 'middle').text(bk.label));
    [['s', C[0]], ['j', C[1]]].forEach(function (z) {
      var ln = d3.line().defined(function (d) { return d[z[0]] != null; }).x(function (d) { return x(d.k); }).y(function (d) { return y(d[z[0]]); });
      svg.append('path').datum(rows).attr('d', ln).attr('fill', 'none').attr('stroke', z[1]).attr('stroke-width', 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
      svg.append('g').selectAll('circle').data(rows.filter(function (d) { return d[z[0]] != null; })).join('circle').attr('cx', function (d) { return x(d.k); }).attr('cy', function (d) { return y(d[z[0]]); }).attr('r', 2.5).attr('fill', z[1]);
    });
    var rule = svg.append('line').attr('y1', mg.t).attr('y2', h - mg.b).style('stroke', 'var(--cds-chart-reference)').attr('opacity', 0);
    svg.on('pointermove', function (ev) {
      var q = d3.pointer(ev, svg.node()), i = d3.bisectCenter(bk.keys.map(x), q[0]), d = rows[Math.max(0, Math.min(rows.length - 1, i))];
      rule.attr('x1', x(d.k)).attr('x2', x(d.k)).attr('opacity', 1);
      tipShow(el, o.tip, [[bk.label(d.k), 't'], ['매매 ' + (d.s ? nf(Math.round(d.s)) : '—') + ' (' + d.sn + '건)'], ['전세 ' + (d.j ? nf(Math.round(d.j)) : '—') + ' (' + d.jn + '건)']], x(d.k), q[1]);
    }).on('pointerleave', function () { rule.attr('opacity', 0); o.tip.hidden = true; });
  });

  dash.draw('ch_vol', function (el) {
    var t = trades(), r = rents(); if (!t || !r) { empty(el); return; }
    var p = P(), bk = buckets(p), w = Math.max(280, el.clientWidth), h = 250, mg = { l: 40, r: 8, t: 12, b: 26 };
    var cnt = {}; bk.keys.forEach(function (k) { cnt[k] = { k: k, t: 0, j: 0, w: 0 }; });
    t.filter(function (x) { return inP(x, p); }).forEach(function (x) { var c = cnt[bk.key(x.date)]; if (c) c.t++; });
    r.filter(function (x) { return inP(x, p); }).forEach(function (x) { var c = cnt[bk.key(x.date)]; if (c) c[x.kind]++; });
    var rows = bk.keys.map(function (k) { return cnt[k]; });
    var mx = d3.max(rows, function (d) { return d.t + d.j + d.w; });
    if (!mx) { empty(el); return; }
    var o = mk(el, w, h), svg = o.svg;
    var x = d3.scaleBand(bk.keys, [mg.l, w - mg.r]).padding(0.2), y = d3.scaleLinear([0, mx], [h - mg.b, mg.t]).nice();
    svg.append('g').selectAll('line').data(y.ticks(4)).join('line').attr('x1', mg.l).attr('x2', w - mg.r).attr('y1', y).attr('y2', y).style('stroke', 'var(--cds-chart-grid)');
    ax(svg.append('g').selectAll('text').data(y.ticks(4)).join('text').attr('x', mg.l - 8).attr('y', y).attr('dy', '0.32em').attr('text-anchor', 'end').text(nf));
    var step = Math.ceil(bk.keys.length / Math.max(3, Math.floor(w / 62)));
    ax(svg.append('g').selectAll('text').data(bk.keys.filter(function (d, i) { return (bk.keys.length - 1 - i) % step === 0; })).join('text').attr('x', function (d) { return x(d) + x.bandwidth() / 2; }).attr('y', h - 6).attr('text-anchor', 'middle').text(bk.label));
    var stack = d3.stack().keys(['t', 'j', 'w'])(rows), cols = [C[0], C[1], C[2]];
    stack.forEach(function (s, i) { svg.append('g').selectAll('rect').data(s).join('rect').attr('x', function (d) { return x(d.data.k); }).attr('width', Math.min(x.bandwidth(), 34)).attr('y', function (d) { return y(d[1]); }).attr('height', function (d) { return Math.max(0, y(d[0]) - y(d[1])); }).attr('fill', cols[i]); });
    svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', function (d) { return x(d.k); }).attr('width', x.bandwidth()).attr('y', mg.t).attr('height', h - mg.b - mg.t).attr('fill', 'transparent')
      .on('pointermove', function (ev, d) { var q = d3.pointer(ev, el); tipShow(el, o.tip, [[bk.label(d.k), 't'], ['매매 ' + d.t + '건'], ['전세 ' + d.j + '건'], ['월세 ' + d.w + '건']], q[0], q[1]); })
      .on('pointerleave', function () { o.tip.hidden = true; });
  });

  /* ---------- REB index ---------- */
  function rebSeries(series, region) { var r = D('reb'); if (!r) return null; return r.filter(function (x) { return x.series === series && x.region === region; }).map(function (x) { return { ym: x.ym, v: +x.val }; }).sort(function (a, b) { return a.ym < b.ym ? -1 : 1; }); }
  function ymLabel(s) { return s.slice(2, 4) + '.' + s.slice(4); }
  dash.draw('ch_idx', function (el) {
    var A = rebSeries(S.idx, '성북구'); if (!A || !A.length) { empty(el); return; }
    var B = rebSeries(S.idx, '서울'), N = rebSeries(S.idx, '전국'), w = Math.max(280, el.clientWidth), h = 250, mg = { l: 44, r: 40, t: 12, b: 26 };
    var o = mk(el, w, h), svg = o.svg, keys = A.map(function (d) { return d.ym; });
    var all = A.concat(B, N).map(function (d) { return d.v; });
    var x = d3.scalePoint(keys, [mg.l, w - mg.r]), y = d3.scaleLinear([d3.min(all) - 1, d3.max(all) + 1], [h - mg.b, mg.t]).nice();
    svg.append('g').selectAll('line').data(y.ticks(5)).join('line').attr('x1', mg.l).attr('x2', w - mg.r).attr('y1', y).attr('y2', y).style('stroke', 'var(--cds-chart-grid)');
    ax(svg.append('g').selectAll('text').data(y.ticks(5)).join('text').attr('x', mg.l - 8).attr('y', y).attr('dy', '0.32em').attr('text-anchor', 'end').text(function (v) { return v.toFixed(0); }));
    var st = Math.ceil(keys.length / Math.max(3, Math.floor(w / 58)));
    ax(svg.append('g').selectAll('text').data(keys.filter(function (d, i) { return (keys.length - 1 - i) % st === 0; })).join('text').attr('x', x).attr('y', h - 6).attr('text-anchor', 'middle').text(ymLabel));
    [[N, 'var(--cds-chart-muted)'], [B, C[1]], [A, C[0]]].forEach(function (z) {
      var ln = d3.line().x(function (d) { return x(d.ym); }).y(function (d) { return y(d.v); });
      svg.append('path').datum(z[0]).attr('d', ln).attr('fill', 'none').attr('stroke', z[1]).attr('stroke-width', z[1] === C[0] ? 2.5 : 1.8).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
      var l = z[0][z[0].length - 1]; svg.append('circle').attr('cx', x(l.ym)).attr('cy', y(l.v)).attr('r', 3.5).attr('fill', z[1]);
      svg.append('text').attr('x', x(l.ym) + 6).attr('y', y(l.v)).attr('dy', '0.32em').attr('font-size', 11).style('fill', 'var(--color-fg)').text(l.v.toFixed(1));
    });
    var rule = svg.append('line').attr('y1', mg.t).attr('y2', h - mg.b).style('stroke', 'var(--cds-chart-reference)').attr('opacity', 0);
    svg.on('pointermove', function (ev) {
      var q = d3.pointer(ev, svg.node()), i = Math.max(0, Math.min(keys.length - 1, d3.bisectCenter(keys.map(x), q[0]))), k = keys[i];
      var g = function (arr) { var f = arr.filter(function (d) { return d.ym === k; })[0]; return f ? f.v.toFixed(1) : '—'; };
      rule.attr('x1', x(k)).attr('x2', x(k)).attr('opacity', 1);
      tipShow(el, o.tip, [[ymLabel(k), 't'], ['성북구 ' + g(A)], ['서울 ' + g(B)], ['전국 ' + g(N)]], x(k), q[1]);
    }).on('pointerleave', function () { rule.attr('opacity', 0); o.tip.hidden = true; });
  });
  dash.draw('ch_rebdeals', function (el) {
    var A = rebSeries('deals', '성북구'); if (!A || !A.length) { empty(el); return; }
    var w = Math.max(280, el.clientWidth), h = 250, mg = { l: 44, r: 8, t: 14, b: 26 }, o = mk(el, w, h), svg = o.svg, keys = A.map(function (d) { return d.ym; });
    var x = d3.scaleBand(keys, [mg.l, w - mg.r]).padding(0.2), y = d3.scaleLinear([0, d3.max(A, function (d) { return d.v; })], [h - mg.b, mg.t]).nice();
    svg.append('g').selectAll('line').data(y.ticks(4)).join('line').attr('x1', mg.l).attr('x2', w - mg.r).attr('y1', y).attr('y2', y).style('stroke', 'var(--cds-chart-grid)');
    ax(svg.append('g').selectAll('text').data(y.ticks(4)).join('text').attr('x', mg.l - 8).attr('y', y).attr('dy', '0.32em').attr('text-anchor', 'end').text(nf));
    var st = Math.ceil(keys.length / Math.max(3, Math.floor(w / 58)));
    ax(svg.append('g').selectAll('text').data(keys.filter(function (d, i) { return (keys.length - 1 - i) % st === 0; })).join('text').attr('x', function (d) { return x(d) + x.bandwidth() / 2; }).attr('y', h - 6).attr('text-anchor', 'middle').text(ymLabel));
    svg.append('g').selectAll('rect').data(A).join('rect').attr('x', function (d) { return x(d.ym); }).attr('width', Math.min(x.bandwidth(), 22)).attr('y', function (d) { return y(d.v); }).attr('height', function (d) { return y(0) - y(d.v); }).attr('rx', 2).attr('fill', function (d, i) { return i === A.length - 1 ? C[0] : 'var(--cds-chart-muted)'; })
      .on('pointermove', function (ev, d) { var q = d3.pointer(ev, el); tipShow(el, o.tip, [[ymLabel(d.ym), 't'], [nf(d.v) + '건']], q[0], q[1]); }).on('pointerleave', function () { o.tip.hidden = true; });
  });

  /* ---------- dong table ---------- */
  dash.draw('cap3', function (el) { var p = P(); el.textContent = p.start + ' ~ ' + p.end + ' 동안 신고된 실거래 기준 · 동 구분 없이 비교'; });
  dash.draw('dongtable', function (tb) {
    var t = trades(), r = rents(); tb.replaceChildren(); if (!t || !r) return;
    var p = P(), q = { dong: '', start: p.start, end: p.end }, names = {};
    t.concat(r).forEach(function (x) { names[x.dong] = 1; });
    var rows = Object.keys(names).map(function (d) {
      var f = { dong: d, start: p.start, end: p.end }, tt = t.filter(function (x) { return inP(x, f); }), jj = r.filter(function (x) { return x.kind === 'j' && inP(x, f); }), ww = r.filter(function (x) { return x.kind === 'w' && inP(x, f); });
      return { d: d, tn: tt.length, py: med(tt.map(function (x) { return x.py; })), jpy: med(jj.map(function (x) { return x.py; })), jn: jj.length, jd: med(jj.map(function (x) { return x.dep; })), wn: ww.length, wd: med(ww.map(function (x) { return x.dep; })), wm: med(ww.map(function (x) { return x.mo; })) };
    }).filter(function (x) { return x.tn + x.jn + x.wn > 0; }).sort(function (a, b) { return (b.py || 0) - (a.py || 0); });
    rows.forEach(function (x) {
      var tr = document.createElement('tr'); tr.setAttribute('data-key', x.d); if (x.d === p.dong) tr.style.background = 'var(--color-bg)';
      [x.d, nf(x.tn), x.py ? nf(Math.round(x.py)) : '—', nf(x.jn), x.jd ? won(x.jd) : '—', x.py && x.jpy ? (x.jpy / x.py * 100).toFixed(1) + '%' : '—', nf(x.wn), x.wd ? won(x.wd) + '/' + nf(Math.round(x.wm)) : '—'].forEach(function (c) { var td = document.createElement('td'); td.textContent = c; tr.appendChild(td); });
      tb.appendChild(tr);
    });
    tb.onclick = function (ev) { var tr = ev.target.closest('tr[data-key]'); if (!tr) return; dash.setParams({ dong: tr.getAttribute('data-key') === dash.params().dong ? null : tr.getAttribute('data-key') }); S.sel = null; syncCtrl(); redraw.apply(null, ALL); };
  });

  /* ---------- Top 10 ---------- */
  function aptInfo() { var a = D('apt'); if (!a) return null; if (cache.a && cache.ar === a) return cache.a; cache.ar = a; var m = {}; a.forEach(function (x) { var la = +x.lat, lo = +x.lon; if (x.loc !== '정확') { var h = 0, s = x.apt + x.dong; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997; la += ((h % 31) - 15) * 0.00028; lo += ((Math.floor(h / 31) % 31) - 15) * 0.00034; } m[x.apt + '|' + x.dong] = { apt: x.apt, dong: x.dong, lat: la, lon: lo, loc: x.loc, built: x.built, name: x.name || x.apt, hidden: x.loc === '숨김' }; }); return (cache.a = m); }
  function recent3(p) { var d = new Date(ptime(p.end)); d.setUTCMonth(d.getUTCMonth() - 3); d.setUTCDate(d.getUTCDate() + 1); return { dong: p.dong, start: ymd(d.getTime()), end: p.end }; }
  function pyVal(x, tab) {
    var py = x.area / 3.3058;
    if (tab === 't') return x.price / py;
    if (tab === 'j') return x.dep / py;
    return (x.dep + x.mo * 12 / 0.055) / py; /* 월세: 보증금 + 월세×12÷5.5% */
  }
  function ranking() {
    var t = trades(), r = rents(); if (!t || !r) return null;
    var p = P(), byPrice = S.rank === 'p', win = byPrice ? recent3(p) : p;
    var src = S.tab === 't' ? t : r.filter(function (x) { return x.kind === S.tab; });
    var g = d3.group(src.filter(function (x) { return inP(x, win); }), function (x) { return x.apt + '|' + x.dong; });
    var arr = Array.from(g, function (e) { var rs = e[1].slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }); return { key: e[0], apt: rs[0].apt, dong: rs[0].dong, n: rs.length, last: rs[0], rs: rs, py: med(rs.map(function (x) { return pyVal(x, S.tab); })) }; });
    if (byPrice) arr = arr.filter(function (x) { return x.n >= 3; }).sort(function (a, b) { return b.py - a.py; });
    else arr.sort(function (a, b) { return b.n - a.n; });
    var info = aptInfo();
    if (info) arr = arr.filter(function (x) { return !(info[x.key] && info[x.key].hidden); });
    return arr.slice(0, 10);
  }
  function nameOf(x) { var i = aptInfo(); return (i && i[x.key] && i[x.key].name) || x.apt; }
  function priceTxt(x, tab) { return tab === 't' ? won(x.price) : (tab === 'j' || x.kind === 'j') ? won(x.dep) : won(x.dep) + '/' + nf(x.mo); }
  var TABN = { t: '매매', j: '전세', w: '월세' };
  dash.draw('cap4', function (el) {
    var p = P(), w = recent3(p);
    el.textContent = (p.dong || '성북구 전체') + ' · ' + (S.rank === 'p' ? w.start + ' ~ ' + w.end + ' (최근 3개월) 거래 3건 이상인 단지를 전용 3.3㎡당 ' + (S.tab === 'w' ? '환산가(보증금 + 월세×12÷5.5%)' : TABN[S.tab] + '가') + ' 중위값이 높은 순으로 보여 줍니다.' : p.start + ' ~ ' + p.end + ' 신고된 ' + TABN[S.tab] + ' 거래가 많은 단지 순위입니다.') + ' 단지를 누르면 위치와 최근 실거래가가 지도에 표시됩니다.';
  });
  function curSel() {
    var rk = ranking(); if (!rk) return null;
    if (S.sel && S.sel.src === 'list') return S.sel;
    if (S.sel && S.sel.src === 'top') { var f = rk.filter(function (x) { return x.key === S.sel.key; })[0]; if (f) return S.sel; }
    return rk.length ? { src: 'top', key: rk[0].key } : null;
  }
  dash.draw('toplist', function (el) {
    var rk = ranking(); el.replaceChildren(); if (!rk) { el.textContent = '—'; return; }
    if (!rk.length) { var m = document.createElement('p'); m.className = 'muted'; m.textContent = '선택한 조건에 거래가 없습니다. 기간이나 동을 바꿔 보세요.'; el.appendChild(m); return; }
    var sel = curSel();
    rk.forEach(function (x, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'toprow'; b.setAttribute('aria-pressed', !!(sel && sel.key === x.key));
      var a = document.createElement('span'); a.className = 'rk'; a.textContent = i + 1;
      var n = document.createElement('span'); var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = nameOf(x); var sb = document.createElement('div'); sb.className = 'muted'; sb.textContent = x.dong + ' · ' + x.n + '건 · 최근 ' + x.last.date.slice(5) + (S.rank === 'p' ? ' · 평당 ' + nf(Math.round(x.py)) + '만원' : ''); n.append(nm, sb);
      var pr = document.createElement('span'); pr.className = 'pr'; pr.textContent = priceTxt(x.last, S.tab); var ps = document.createElement('div'); ps.className = 'muted'; ps.textContent = Math.round(x.last.area) + '㎡'; pr.appendChild(ps);
      b.append(a, n, pr);
      b.onclick = function () { S.sel = { src: 'top', key: x.key }; redraw('toplist', 'topmap', 'topdetail', 'loctitle', 'locsub', 'locmap', 'locsum', 'locgrid', 'listings'); };
      el.appendChild(b);
    });
  });

  var BB = { la0: 37.575, la1: 37.635, lo0: 126.985, lo1: 127.075 };
  function proj(w, h, b) { var kx = Math.cos(37.6 * Math.PI / 180), dx = (b.lo1 - b.lo0) * kx, dy = b.la1 - b.la0, s = Math.min((w - 20) / dx, (h - 20) / dy); return { x: function (lo) { return (w - dx * s) / 2 + (lo - b.lo0) * kx * s; }, y: function (la) { return (h + dy * s) / 2 - (la - b.la0) * s; }, s: s }; }
  var DONGPOS = [['길음동', 37.6085, 127.0202], ['돈암동', 37.5950, 127.0160], ['보문동', 37.5830, 127.0190], ['성북동', 37.5970, 126.9950], ['정릉동', 37.6130, 127.0050], ['안암동', 37.5850, 127.0300], ['종암동', 37.6010, 127.0320], ['하월곡동', 37.6044, 127.0376], ['상월곡동', 37.6062, 127.0440], ['석관동', 37.6100, 127.0600], ['장위동', 37.6160, 127.0503]];
  function baseMap(svg, w, h, pj, poi) {
    svg.append('rect').attr('width', w).attr('height', h).attr('fill', 'transparent');
    var g = svg.append('g');
    g.selectAll('text.dn').data(DONGPOS).join('text').attr('x', function (d) { return pj.x(d[2]); }).attr('y', function (d) { return pj.y(d[1]); }).attr('text-anchor', 'middle').attr('font-size', 12).attr('font-weight', 600).style('fill', 'var(--color-fg-muted)').attr('opacity', .45).text(function (d) { return d[0]; });
    if (poi) {
      var st = poi.filter(function (x) { return x.kind === 'subway' && +x.lat > BB.la0 && +x.lat < BB.la1 && +x.lon > BB.lo0 && +x.lon < BB.lo1; });
      g.selectAll('rect.st').data(st).join('rect').attr('x', function (d) { return pj.x(+d.lon) - 3; }).attr('y', function (d) { return pj.y(+d.lat) - 3; }).attr('width', 6).attr('height', 6).attr('rx', 1).style('fill', 'var(--color-fg-muted)').attr('opacity', .7);
      g.selectAll('text.st').data(st).join('text').attr('x', function (d) { return pj.x(+d.lon) + 6; }).attr('y', function (d) { return pj.y(+d.lat) + 3; }).attr('font-size', 9.5).style('fill', 'var(--color-fg-muted)').text(function (d) { return d.name; });
    }
  }
  function svgTop(el) {
    var info = aptInfo(), rk = ranking(), poi = D('poi'); el.replaceChildren(); if (!info || !rk || !poi) { el.textContent = '—'; return; }
    var w = Math.max(280, el.clientWidth), h = Math.round(w * 0.82), pj = proj(w, h, BB), sel = curSel();
    var wrap = document.createElement('div'); wrap.className = 'map'; el.appendChild(wrap);
    var svg = d3.select(wrap).append('svg').attr('viewBox', '0 0 ' + w + ' ' + h).attr('width', '100%').attr('role', 'img').attr('aria-label', 'Top 10 아파트 위치도');
    baseMap(svg, w, h, pj, poi);
    var pts = rk.map(function (x, i) { var a = info[x.key]; return a ? { x: x, a: a, i: i } : null; }).filter(Boolean);
    var gs = svg.append('g').selectAll('g').data(pts).join('g').attr('transform', function (d) { return 'translate(' + pj.x(d.a.lon) + ',' + pj.y(d.a.lat) + ')'; }).style('cursor', 'pointer');
    gs.append('circle').attr('r', function (d) { return sel && sel.key === d.x.key ? 13 : 10; }).attr('fill', function (d) { return sel && sel.key === d.x.key ? C[0] : 'var(--color-panel)'; }).attr('stroke', C[0]).attr('stroke-width', 2);
    gs.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').attr('font-size', 11).attr('font-weight', 700).style('fill', function (d) { return sel && sel.key === d.x.key ? '#fff' : 'var(--color-fg)'; }).text(function (d) { return d.i + 1; });
    var sd = pts.filter(function (d) { return sel && sel.key === d.x.key; })[0];
    if (sd) {
      var lab = nameOf(sd.x) + ' · ' + priceTxt(sd.x.last, S.tab), lw = lab.length * 12 + 16, px = pj.x(sd.a.lon), py = pj.y(sd.a.lat), lx = Math.max(4, Math.min(w - lw - 4, px - lw / 2)), ly = py - 44 < 4 ? py + 20 : py - 44;
      var g2 = svg.append('g');
      g2.append('rect').attr('x', lx).attr('y', ly).attr('width', lw).attr('height', 24).attr('rx', 6).style('fill', 'var(--cds-surface-popover)').style('stroke', 'var(--cds-border)');
      g2.append('text').attr('x', lx + 8).attr('y', ly + 16).attr('font-size', 12).attr('font-weight', 600).style('fill', 'var(--color-fg)').text(lab);
    }
    gs.on('click', function (ev, d) { S.sel = { src: 'top', key: d.x.key }; redraw('toplist', 'topmap', 'topdetail', 'loctitle', 'locsub', 'locmap', 'locsum', 'locgrid'); });
    var cap = document.createElement('p'); cap.className = 'muted'; cap.textContent = '사각형은 지하철역입니다. 숫자는 순위이며, 정확한 좌표를 못 찾은 단지는 해당 동 안의 대략 위치로 표시합니다.'; el.appendChild(cap);
  }
  dash.draw('topdetail', function (el) {
    var rk = ranking(); el.replaceChildren(); if (!rk || !rk.length) return;
    var sel = curSel(), x = rk.filter(function (z) { return sel && z.key === sel.key; })[0] || rk[0], info = aptInfo(), a = info && info[x.key];
    var h = document.createElement('h3'); h.textContent = nameOf(x) + ' · ' + x.dong + (a && a.built ? ' · ' + a.built + '년 준공' : ''); h.style.marginTop = '12px';
    var m = document.createElement('p'); m.className = 'muted'; m.textContent = '최근 실거래 (' + TABN[S.tab] + ') · 위치 ' + (a ? a.loc : '—'); el.append(h, m);
    var wrap = document.createElement('div'); wrap.className = 'tblwrap'; var tb = document.createElement('table');
    var th = document.createElement('thead'), tr0 = document.createElement('tr'); ['계약일', '전용', '층', S.tab === 't' ? '거래가' : S.tab === 'j' ? '보증금' : '보증금/월세'].forEach(function (c) { var e = document.createElement('th'); e.textContent = c; tr0.appendChild(e); }); th.appendChild(tr0); tb.appendChild(th);
    var bd = document.createElement('tbody'); x.rs.slice(0, 6).forEach(function (r) { var tr = document.createElement('tr'); [r.date, Math.round(r.area) + '㎡', r.floor + '층', priceTxt(r, S.tab)].forEach(function (c) { var td = document.createElement('td'); td.textContent = c; tr.appendChild(td); }); bd.appendChild(tr); });
    tb.appendChild(bd); wrap.appendChild(tb); el.appendChild(wrap);
  });

  /* ---------- listings ---------- */
  dash.draw('aptsel', function (sel) {
    var a = D('apt'); sel.replaceChildren(); if (!a) return;
    a.filter(function (x) { return x.loc !== '숨김'; }).sort(function (x, y) { return (x.dong + x.apt).localeCompare(y.dong + y.apt, 'ko'); }).forEach(function (x) { sel.appendChild(new Option(x.dong + ' ' + (x.name || x.apt), x.apt + '|' + x.dong)); });
  });
  function allListings() { var l = D('listing') || []; return l.map(function (x) { return { id: x.id, title: x.title, apt: x.apt, dong: x.dong, type: x.type, area: x.area, floor: x.floor, price: +x.price, deposit: +x.deposit, monthly: +x.monthly, memo: x.memo }; }).concat(S.added); }
  function lprice(l) { return l.type === '매매' ? won(l.price) : l.type === '전세' ? won(l.deposit) : won(l.deposit) + ' / ' + nf(l.monthly); }
  dash.draw('listings', function (el) {
    el.replaceChildren(); var L = allListings(); if (!D('listing')) { el.textContent = '—'; return; }
    var sel = S.sel && S.sel.src === 'list' ? S.sel.key : null;
    L.forEach(function (l) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'lcard'; b.setAttribute('aria-pressed', sel === l.id);
      var p = document.createElement('span'); p.className = 'pill t'; p.textContent = l.type + ' · 예시';
      var t = document.createElement('b'); t.textContent = l.title;
      var pr = document.createElement('div'); pr.style.cssText = 'font-family:var(--font-anthropic-serif);font-size:1.4rem'; pr.textContent = lprice(l);
      var m = document.createElement('span'); m.className = 'muted'; m.textContent = l.dong + (l.floor ? ' · ' + l.floor + '층' : '') + ' · ' + l.memo;
      b.append(p, t, pr, m);
      b.onclick = function () { S.sel = { src: 'list', key: l.id, apt: l.apt, dong: l.dong, title: l.title }; redraw('toplist', 'topmap', 'topdetail', 'listings', 'loctitle', 'locsub', 'locmap', 'locsum', 'locgrid'); document.getElementById('sec-loc').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      el.appendChild(b);
    });
  });

  /* ---------- location analysis ---------- */
  function locTarget() {
    var info = aptInfo(); if (!info) return null; var s = curSel(); if (!s) return null;
    if (s.src === 'list') return info[s.apt + '|' + s.dong] ? { a: info[s.apt + '|' + s.dong], label: s.title } : null;
    return info[s.key] ? { a: info[s.key], label: null } : null;
  }
  dash.draw('loctitle', function (el) { var t = locTarget(); el.textContent = t ? '입지분석 · ' + (t.label || t.a.apt) : '입지분석'; });
  dash.draw('locsub', function (el) { var t = locTarget(); if (!t) { el.textContent = '—'; return; } el.textContent = t.a.dong + ' · ' + (t.a.built ? t.a.built + '년 준공 · ' : '') + '위치 ' + t.a.loc + ' · Top 10 또는 추천매물에서 단지를 고르면 바뀝니다.'; });
  function near(poi, a, pred, n) { return poi.filter(pred).map(function (x) { return { n: x.name, d: hav(a.lat, a.lon, +x.lat, +x.lon), sub: x.sub, lat: +x.lat, lon: +x.lon }; }).sort(function (u, v) { return u.d - v.d; }).slice(0, n); }
  function svgLoc(el) {
    var t = locTarget(), poi = D('poi'); el.replaceChildren(); if (!t || !poi) { el.textContent = '—'; return; }
    var a = t.a, w = Math.max(280, el.clientWidth), h = Math.round(w * 0.8), dl = 0.0105, dn = dl / Math.cos(37.6 * Math.PI / 180) * 1.0, b = { la0: a.lat - dl, la1: a.lat + dl, lo0: a.lon - dn, lo1: a.lon + dn }, pj = proj(w, h, b);
    var svg = d3.select(el).append('svg').attr('viewBox', '0 0 ' + w + ' ' + h).attr('width', '100%').attr('role', 'img').attr('aria-label', '주변 시설 지도').style('background', 'var(--color-bg)').style('border', '1px solid var(--color-border-line)').style('border-radius', 'var(--cds-radius)');
    [500, 1000].forEach(function (r) { svg.append('circle').attr('cx', pj.x(a.lon)).attr('cy', pj.y(a.lat)).attr('r', r * pj.s / (111000 * 1)).attr('fill', 'none').style('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '4 4'); svg.append('text').attr('x', pj.x(a.lon) + 4).attr('y', pj.y(a.lat) - r * pj.s / 111000 - 3).attr('font-size', 10).style('fill', 'var(--color-fg-muted)').text(r >= 1000 ? '1km' : '500m'); });
    var kinds = { subway: [C[0], '지하철'], school: [C[2], '학교'], shop: [C[3] || C[1], '상권'], gov: ['var(--color-fg-muted)', '관공서'] };
    var pts = poi.filter(function (x) { return kinds[x.kind] && hav(a.lat, a.lon, +x.lat, +x.lon) < 1100 && (x.kind !== 'school' || true); });
    svg.append('g').selectAll('circle').data(pts).join('circle').attr('cx', function (d) { return pj.x(+d.lon); }).attr('cy', function (d) { return pj.y(+d.lat); }).attr('r', function (d) { return d.kind === 'subway' ? 5 : 3.5; }).attr('fill', function (d) { return kinds[d.kind][0]; }).attr('opacity', .85);
    svg.append('g').selectAll('text').data(pts.filter(function (d) { return d.kind === 'subway' || d.sub === '백화점' || d.sub === '고등학교'; })).join('text').attr('x', function (d) { return pj.x(+d.lon) + 7; }).attr('y', function (d) { return pj.y(+d.lat) + 3; }).attr('font-size', 10).style('fill', 'var(--color-fg)').text(function (d) { return d.name; });
    svg.append('path').attr('transform', 'translate(' + pj.x(a.lon) + ',' + pj.y(a.lat) + ')').attr('d', 'M0 0 L-9 -16 A10 10 0 1 1 9 -16 Z').attr('fill', '#c8962e').attr('stroke', '#fff').attr('stroke-width', 1.5);
    var lg = document.createElement('div'); lg.className = 'legend'; lg.style.marginTop = '6px';
    [['지하철', kinds.subway[0]], ['학교', kinds.school[0]], ['상권·병원', kinds.shop[0]], ['관공서', kinds.gov[0]], ['이 단지', '#c8962e']].forEach(function (z) { var s = document.createElement('span'); var i = document.createElement('i'); i.style.background = z[1]; s.append(i, z[0]); lg.appendChild(s); });
    el.appendChild(lg);
  }
  function sec(title, items, extra) {
    var s = document.createElement('section'); var h = document.createElement('h3'); h.textContent = title; s.appendChild(h);
    items.forEach(function (it) { if (it.sub) { var q = document.createElement('div'); q.className = 'sub'; q.textContent = it.sub; s.appendChild(q); } var ul = document.createElement('ul'); (it.rows || []).forEach(function (r) { var li = document.createElement('li'); var a = document.createElement('span'); a.textContent = r[0]; var b = document.createElement('span'); b.textContent = r[1]; li.append(a, b); ul.appendChild(li); }); if (!(it.rows || []).length) { var li = document.createElement('li'); li.textContent = '반경 내 정보 없음'; ul.appendChild(li); } s.appendChild(ul); });
    return s;
  }
  var fm = function (x) { return [x.n, dist(x.d) + ' · ' + walk(x.d)]; };
  dash.draw('locsum', function (el) {
    var t = locTarget(), poi = D('poi'); el.replaceChildren(); if (!t || !poi) { el.textContent = '—'; return; }
    var a = t.a, sub = near(poi, a, function (x) { return x.kind === 'subway'; }, 1)[0], sc = near(poi, a, function (x) { return x.kind === 'school' && x.sub === '초등학교'; }, 1)[0], ds = near(poi, a, function (x) { return x.sub === '백화점'; }, 1)[0];
    var bus = poi.filter(function (x) { return x.kind === 'bus' && hav(a.lat, a.lon, +x.lat, +x.lon) <= 300; }).length;
    var s = document.createElement('section'); var h = document.createElement('h3'); h.textContent = '한눈에 보기'; s.appendChild(h);
    var ul = document.createElement('ul'); [['가장 가까운 지하철', sub ? sub.n + ' ' + dist(sub.d) : '—'], ['300m 안 버스정류장', bus + '곳'], ['가장 가까운 초등학교', sc ? sc.n + ' ' + dist(sc.d) : '—'], ['가장 가까운 백화점', ds ? ds.n + ' ' + dist(ds.d) : '—']].forEach(function (r) { var li = document.createElement('li'); var x = document.createElement('span'); x.textContent = r[0]; var y = document.createElement('span'); y.textContent = r[1]; li.append(x, y); ul.appendChild(li); });
    s.appendChild(ul); el.appendChild(s);
  });
  dash.draw('locgrid', function (el) {
    var t = locTarget(), poi = D('poi'), dev = D('dev'); el.replaceChildren(); if (!t || !poi) { el.textContent = '—'; return; }
    var a = t.a;
    var ktx = near(poi, a, function (x) { return x.kind === 'ktx'; }, 3);
    var sw = near(poi, a, function (x) { return x.kind === 'subway'; }, 4);
    var busAll = poi.filter(function (x) { return x.kind === 'bus'; }).map(function (x) { return { n: x.name, d: hav(a.lat, a.lon, +x.lat, +x.lon) }; });
    var b300 = busAll.filter(function (x) { return x.d <= 300; }), b500 = busAll.filter(function (x) { return x.d <= 500; });
    var bn = busAll.sort(function (u, v) { return u.d - v.d; }); var seen = {}; var busn = bn.filter(function (x) { if (seen[x.n]) return false; seen[x.n] = 1; return true; }).slice(0, 4);
    el.appendChild(sec('교통', [{ sub: 'KTX · 광역철도', rows: ktx.map(fm) }, { sub: '지하철', rows: sw.map(fm) }, { sub: '버스', rows: [['300m 안 정류장', b300.length + '곳'], ['500m 안 정류장', b500.length + '곳']].concat(busn.map(fm)) }]));
    var es = near(poi, a, function (x) { return x.kind === 'school' && x.sub === '초등학교'; }, 3), ms = near(poi, a, function (x) { return x.kind === 'school' && x.sub === '중학교'; }, 3), hs = near(poi, a, function (x) { return x.kind === 'school' && x.sub === '고등학교'; }, 3);
    el.appendChild(sec('학군', [{ sub: '초등학교', rows: es.map(fm) }, { sub: '중학교', rows: ms.map(fm) }, { sub: '고등학교', rows: hs.map(fm) }]));
    var q = function (s, n) { return near(poi, a, function (x) { return x.sub === s; }, n).map(fm); };
    el.appendChild(sec('상권·생활', [{ sub: '백화점', rows: q('백화점', 2) }, { sub: '마트·쇼핑', rows: q('마트·쇼핑', 3) }, { sub: '커피숍', rows: q('커피숍', 3) }, { sub: '관공서', rows: q('관공서', 3) }, { sub: '병원', rows: q('병원', 2) }]));
    var dv = (dev || []).filter(function (x) { return x.area === '성북구 전역' || x.area.indexOf(a.dong.replace('동', '')) >= 0; });
    var s = document.createElement('section'); var h = document.createElement('h3'); h.textContent = '주변 개발계획'; s.appendChild(h);
    dv.forEach(function (x) { var d = document.createElement('div'); d.style.cssText = 'display:flex;flex-direction:column;gap:3px'; var tp = document.createElement('div'); var p1 = document.createElement('span'); p1.className = 'pill t'; p1.textContent = x.category; var p2 = document.createElement('span'); p2.className = 'pill'; p2.textContent = x.status; p2.style.marginLeft = '6px'; tp.append(p1, p2); var b = document.createElement('b'); b.textContent = x.title; var n = document.createElement('span'); n.className = 'muted'; n.textContent = x.note; d.append(tp, b, n); s.appendChild(d); });
    el.appendChild(s);
  });

  /* ---------- 카카오맵 (키가 없거나 불러오지 못하면 위의 약식 위치도가 대신 보임) ---------- */
  var K = { ok: false, tried: false };
  function kakaoInit() {
    var key = (window.APP_CONFIG || {}).kakaoJsKey;
    if (!key || K.tried) return;
    K.tried = true;
    var s = document.createElement('script');
    s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(key) + '&autoload=false';
    s.onload = function () { try { kakao.maps.load(function () { K.ok = true; redraw('topmap', 'locmap'); }); } catch (e) { console.warn('카카오맵 초기화 실패', e); } };
    s.onerror = function () { console.warn('카카오맵을 불러오지 못해 약식 위치도를 보여 줍니다. 키와 등록 도메인을 확인하세요.'); };
    document.head.appendChild(s);
  }
  function kDiv(cls, txt) { var d = document.createElement('div'); d.className = cls; if (txt != null) d.textContent = txt; return d; }
  function kOver(map, lat, lon, node, z, yA) { var o = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(lat, lon), content: node, xAnchor: 0.5, yAnchor: yA == null ? 0.5 : yA, zIndex: z || 1 }); o.setMap(map); return o; }
  function legendFor(el, items) { var lg = document.createElement('div'); lg.className = 'legend'; lg.style.marginTop = '6px'; items.forEach(function (z) { var s = document.createElement('span'); var i = document.createElement('i'); i.style.background = z[1]; s.append(i, z[0]); lg.appendChild(s); }); el.appendChild(lg); }
  function kakaoTop(el) {
    var info = aptInfo(), rk = ranking(), poi = D('poi'); el.replaceChildren(); if (!info || !rk || !poi) { el.textContent = '—'; return; }
    var w = Math.max(280, el.clientWidth), box = kDiv('kmap'); box.style.height = Math.round(w * 0.82) + 'px'; el.appendChild(box);
    var map = new kakao.maps.Map(box, { center: new kakao.maps.LatLng(37.6, 127.03), level: 6 }), b = new kakao.maps.LatLngBounds(), sel = curSel();
    poi.filter(function (x) { return x.kind === 'subway' && +x.lat > BB.la0 && +x.lat < BB.la1 && +x.lon > BB.lo0 && +x.lon < BB.lo1; }).forEach(function (x) { var n = kDiv('kst'); n.append(kDiv('ksq'), document.createTextNode(x.name)); kOver(map, +x.lat, +x.lon, n, 1); });
    rk.forEach(function (x, i) {
      var a = info[x.key]; if (!a) return;
      var on = !!(sel && sel.key === x.key), n = kDiv('kmk' + (on ? ' on' : ''), i + 1);
      n.setAttribute('role', 'button'); n.setAttribute('aria-label', (i + 1) + '위 ' + nameOf(x));
      n.onclick = function () { S.sel = { src: 'top', key: x.key }; redraw('toplist', 'topmap', 'topdetail', 'loctitle', 'locsub', 'locmap', 'locsum', 'locgrid'); };
      kOver(map, a.lat, a.lon, n, on ? 6 : 4); b.extend(new kakao.maps.LatLng(a.lat, a.lon));
      if (on) kOver(map, a.lat, a.lon, kDiv('klab', nameOf(x) + ' · ' + priceTxt(x.last, S.tab)), 7, 2.0);
    });
    if (rk.length) map.setBounds(b, 50, 40, 50, 40);
    var cap = document.createElement('p'); cap.className = 'muted'; cap.textContent = '숫자는 순위, 사각형은 지하철역입니다. 지도: 카카오맵. 위치가 "대략"으로 표시된 단지는 동 안의 근사 위치입니다.'; el.appendChild(cap);
  }
  function kakaoLoc(el) {
    var t = locTarget(), poi = D('poi'); el.replaceChildren(); if (!t || !poi) { el.textContent = '—'; return; }
    var a = t.a, w = Math.max(280, el.clientWidth), box = kDiv('kmap'); box.style.height = Math.round(w * 0.8) + 'px'; el.appendChild(box);
    var c = new kakao.maps.LatLng(a.lat, a.lon), map = new kakao.maps.Map(box, { center: c, level: 5 });
    [500, 1000].forEach(function (r) { new kakao.maps.Circle({ center: c, radius: r, strokeWeight: 1.5, strokeColor: '#c8962e', strokeOpacity: 0.9, strokeStyle: 'dashed', fillColor: '#c8962e', fillOpacity: 0.04 }).setMap(map); });
    var kinds = { subway: C[0], school: C[2], shop: C[3] || C[1], gov: '#7a7a7a' };
    poi.filter(function (x) { return kinds[x.kind] && hav(a.lat, a.lon, +x.lat, +x.lon) < 1100; }).forEach(function (x) {
      var n = kDiv(x.kind === 'subway' ? 'kst' : 'kdot'); n.title = x.name;
      if (x.kind === 'subway') { var sq = kDiv('ksq'); sq.style.background = kinds.subway; n.append(sq, document.createTextNode(x.name)); }
      else { n.style.background = kinds[x.kind]; if (x.sub === '백화점' || x.sub === '고등학교') { var l = kDiv('kst'); l.append(document.createTextNode(x.name)); n.appendChild(l); } }
      kOver(map, +x.lat, +x.lon, n, 2);
    });
    kOver(map, a.lat, a.lon, kDiv('kpin'), 8, 1);
    legendFor(el, [['지하철', kinds.subway], ['학교', kinds.school], ['상권·병원', kinds.shop], ['관공서', kinds.gov], ['이 단지', '#c8962e']]);
  }
  dash.draw('topmap', function (el) { if (K.ok) { try { kakaoTop(el); return; } catch (e) { console.warn('카카오맵 오류, 약식 위치도로 대체', e); K.ok = false; } } svgTop(el); });
  dash.draw('locmap', function (el) { if (K.ok) { try { kakaoLoc(el); return; } catch (e) { console.warn('카카오맵 오류, 약식 위치도로 대체', e); K.ok = false; } } svgLoc(el); });
  kakaoInit();

  /* ---------- 금리·미분양 카드 (data/macro.csv 에 값이 있을 때만 보임) ---------- */
  var MACRO = [['base_rate', '한국은행 기준금리', '%', 2], ['mortgage', '주택담보대출 금리 (신규)', '%', 2], ['unsold', '성북구 미분양', '호', 0]];
  dash.draw('macro', function (el) {
    var rows = D('macro') || []; el.replaceChildren();
    var cards = MACRO.map(function (m) {
      var rs = rows.filter(function (r) { return r.series === m[0]; }).sort(function (x, y) { return x.ym < y.ym ? -1 : 1; });
      return rs.length ? { m: m, last: rs[rs.length - 1], prev: rs.length > 1 ? rs[rs.length - 2] : null } : null;
    }).filter(Boolean);
    el.hidden = !cards.length; if (!cards.length) return;
    cards.forEach(function (c) {
      var k = kDiv('kpi'), v = +c.last.val, pv = c.prev ? +c.prev.val : null;
      var lab = kDiv('muted', c.m[1]), val = kDiv('v'); val.textContent = v.toFixed(c.m[3]); var u = document.createElement('small'); u.textContent = c.m[2]; val.appendChild(u);
      var d = pv == null ? '전월 자료 없음' : '전월 대비 ' + (v - pv >= 0 ? '+' : '') + (v - pv).toFixed(c.m[3]) + (c.m[2] === '%' ? '%p' : c.m[2]);
      k.append(lab, val, kDiv('muted', c.last.ym.slice(0, 4) + '.' + c.last.ym.slice(4, 6) + ' 기준 · ' + d));
      el.appendChild(k);
    });
  });

  syncCtrl();
})();

document.getElementById('print-btn').addEventListener('click', function () { window.print(); });
