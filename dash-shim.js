/* data/*.csv 를 읽어 window.dash 를 만들고, 준비되면 app.js 를 실행한다. */
(function () {
  var FILES = ['trade', 'rent', 'apt', 'poi', 'reb', 'listing', 'dev'];
  var OPTIONAL = ['macro']; /* 없어도 되는 파일 */

  function parseCSV(t) {
    var rows = [], row = [], f = '', q = false, i = 0;
    t = t.replace(/^﻿/, '');
    for (; i < t.length; i++) {
      var c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c !== '\r') f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    var h = rows.shift();
    return rows.filter(function (r) { return r.length === h.length; }).map(function (r) { var o = {}; h.forEach(function (k, j) { o[k] = r[j]; }); return o; });
  }

  var DB = {}, params = {}, draws = {};
  function runOne(name) { var d = draws[name]; if (!d) return; document.querySelectorAll('[data-draw="' + name + '"]').forEach(function (el) { try { d(el); } catch (e) { console.error(name, e); } }); }
  function runAll() { Object.keys(draws).forEach(runOne); }

  window.dash = {
    colors: ['#2f7d5b', '#c8962e', '#4f7cac', '#b5543c', '#8a6bb0', '#5aa7a3', '#9a9a4a', '#7a7a7a'],
    data: function (id) { return DB[id] ? { status: 'ok', data: DB[id], rows: DB[id] } : { status: 'missing', data: [] }; },
    params: function () { return Object.assign({}, params); },
    setParams: function (o) { Object.keys(o).forEach(function (k) { if (o[k] == null) delete params[k]; else params[k] = o[k]; }); runAll(); },
    resetParams: function () { params = {}; },
    draw: function (name, fn) { if (fn) { draws[name] = fn; runOne(name); } else runOne(name); },
    setLink: function () {}
  };
  var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(runAll, 150); });

  function load(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { no(new Error(src + ' 를 불러오지 못했습니다')); }; document.head.appendChild(s); }); }

  function fetchRetry(url, n) {
    return fetch(url).catch(function (e) {
      if (n <= 1) throw e;
      return new Promise(function (ok) { setTimeout(ok, 400); }).then(function () { return fetchRetry(url, n - 1); });
    });
  }

  Promise.all(FILES.concat(OPTIONAL).map(function (k) {
    return fetchRetry('data/' + k + '.csv', 3).then(function (r) { if (!r.ok) throw new Error('data/' + k + '.csv ' + r.status); return r.text(); }).then(function (txt) { DB[k] = parseCSV(txt); }).catch(function (e) { if (OPTIONAL.indexOf(k) >= 0) { DB[k] = []; return; } throw e; });
  })).then(function () { return load('app.js'); }).catch(function (e) {
    var m = document.createElement('p');
    m.style.cssText = 'padding:24px;color:#b3382c;font-size:15px';
    m.textContent = '데이터를 불러오지 못했습니다. 파일을 더블클릭해서 열었다면 README의 "로컬에서 열기"대로 http://localhost:8080 으로 여세요. (' + e.message + ')';
    document.getElementById('dash-root').prepend(m);
  });
})();
