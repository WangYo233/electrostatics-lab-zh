'use strict';
// 首页层级知识图谱（Canvas 2D）。节点按树的层级纵向对齐，并用直线连接父子节点。
// 点击节点逐层展开，拖动画布平移，滚轮缩放；模型节点打开实验室或例题页。
// 旁边的列表与图谱同步，可用 Tab 与 Enter 操作，是图谱的可访问替代。
(function () {
  var M = {
    1: ['01', '点电荷与偶极子'], 2: ['02', '路径与能量'], 4: ['03', '正四面体'], 6: ['04', '正六面体'], 5: ['05', '正八面体'],
    7: ['06', '自主探究'], 8: ['拓展 1', '解析场模型'], 3: ['拓展 2', '圆盘电荷'], ex: ['例题', '例题探究']
  };
  // [名称, 子节点]；数字或 'ex' 为模型叶节点
  var TREE = ['静电场', [
    ['电场强度', [
      ['点电荷的场强', [1]],
      ['电场线', [1, 7]],
      ['线电荷与带电面', [8]]
    ]],
    ['电势', [
      ['等势面', [1, 4]],
      ['电势零点', [1, 8]],
      ['场强与电势的关系', [2]]
    ]],
    ['电势能与功', [
      ['静电力做的功', [2, 6, 5]],
      ['相互作用能', [3]]
    ]],
    ['叠加原理与三维矢量合成', [
      ['场强的矢量和', [4, 7]],
      ['电势的代数和', [4, 1]],
      ['电偶极子', [1]]
    ]],
    ['对称性', [
      ['旋转对称：中心场强为零', [4, 'ex']],
      ['反演对称', [6]],
      ['反射对称', [5, 'ex']]
    ]],
    ['导体与电介质', [
      ['导体的静电平衡', [8]],
      ['电介质中的电场', [8]]
    ]]
  ]];

  var host = document.getElementById('kg'); if (!host) return;
  var cv = host.querySelector('canvas'), wrap = host.querySelector('.kg-canvas-wrap'), g = cv.getContext('2d'), list = host.querySelector('.kg-list');
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 建树 ----------
  var nodes = [], seq = 0;
  function make(def, parent, level) {
    var n = { id: 'kg' + (seq++), parent: parent, level: level, kids: [], open: false, p: [0, 0, 0], a: 0, t: [0, 0, 0] };
    if (Array.isArray(def)) { n.label = def[0]; (def[1] || []).forEach(function (c) { n.kids.push(make(c, n, level + 1)); }); }
    else { var x = M[def]; n.label = x[0] + ' ' + x[1]; n.href = def === 'ex' ? 'examples.html' : 'lab.html?m=' + def; }
    nodes.push(n); return n;
  }
  var root = make(TREE, null, 0); root.a = 1;
  function visible(n) { for (var p = n.parent; p; p = p.parent) if (!p.open) return false; return true; }
  // ---------- Top-down tree layout ----------
  var W = 0, H = 0, viewportW = 0, small = false, baseH = 460, baseHSet = false;
  var FONT = { 0: 'bold 17px', 1: '600 14px', 2: '13px', 3: '12px' };
  var FAM = ' "Microsoft YaHei", "PingFang SC", sans-serif';
  var zoom = 1, hover = null, focusN = null, proj = [], ctr = [0, 0, 0];
  function font(n) { return (small ? ['bold 15px', '600 12px', '11.5px', '11px'][n.level] : FONT[n.level]) + FAM; }
  function txt(n) { return n.label + (n.href ? ' →' : n.kids.length ? (n.open ? ' −' : ' +') : ''); }
  function wrapLabel(n, maxWidth) {
    g.font = font(n);
    var words = txt(n).match(/\S+|\s+/g) || [txt(n)], lines = [], line = '';
    words.forEach(function (word) {
      if (/^\s+$/.test(word) && !line) return;
      if (g.measureText(line + word).width <= maxWidth) { line += word; return; }
      if (line.trim()) lines.push(line.trim());
      line = '';
      if (g.measureText(word).width <= maxWidth) { line = word.trimStart(); return; }
      Array.from(word).forEach(function (ch) { if (line && g.measureText(line + ch).width > maxWidth) { lines.push(line); line = ch; } else line += ch; });
    });
    if (line.trim()) lines.push(line.trim());
    n.lines = lines.length ? lines : [''];
    n.textW = Math.min(maxWidth, Math.max.apply(null, n.lines.map(function (s) { return g.measureText(s).width; })));
  }
  function layout() {
    cv.style.width = '';
    cv.style.height = '';
    viewportW = wrap.clientWidth; small = viewportW < 560;
    if (!baseHSet) { baseH = parseFloat(getComputedStyle(cv).height) || 460; baseHSet = true; }
    var vis = nodes.filter(function (n) { return n === root || visible(n); }), deep = 0, slots = 0;
    function assign(n) {
      deep = Math.max(deep, n.level);
      if (n.open && n.kids.length) {
        n.kids.forEach(assign); n.first = n.kids[0].first; n.last = n.kids[n.kids.length - 1].last;
      } else { n.first = n.last = slots++; }
    }
    assign(root);
    var byLevel = [];
    vis.forEach(function (n) { (byLevel[n.level] || (byLevel[n.level] = [])).push(n); });
    byLevel.forEach(function (row) { row.forEach(function (n) { g.font = font(n); n.boxW = Math.min(210, Math.max(72, g.measureText(txt(n)).width + 16)); wrapLabel(n, n.boxW - 12); n.lineH = small ? 12 : 14; n.boxH = n.lines.length * n.lineH + 8; }); });
    var cols = [], x = 18;
    byLevel.forEach(function (row, level) { var radius = level ? 8 : 12, width = row.reduce(function (m, n) { return Math.max(m, n.boxW); }, 0); cols[level] = { x: x + radius, width: width }; x += radius * 2 + width + 34; });
    var desiredW = Math.max(viewportW, x + 8);
    cv.style.width = desiredW > viewportW + 1 ? desiredW + 'px' : ''; W = cv.clientWidth;
    var unit = Math.max(78, small ? 82 : 92);
    vis.forEach(function (n) { n.x = cols[n.level].x; n.y = 25 + (n.first + n.last + 1) * unit / 2; });
    var needH = Math.max(baseH, (slots + 1) * unit + 24);
    cv.style.height = Math.max(baseH, needH) + 'px'; H = cv.clientHeight;
    byLevel.forEach(function (row, level) { row.forEach(function (n) { n.radius = level ? 8 : 12; n.t = [n.x - W / 2, H / 2 - n.y, 0]; }); });
  }
  function resize() { layout(); var dpr = window.devicePixelRatio || 1; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); kick(); }
  function project(p) { return { x: W / 2 + (p[0] - ctr[0]) * zoom, y: H / 2 - (p[1] - ctr[1]) * zoom, z: 0, s: zoom }; }

  // ---------- 绘制 ----------
  // 颜色：根为靛蓝，分支为橙，概念为蓝，模型为浅灰白；另用形状区分（圆、圆、小圆、方块）
  var COL = ['#8a9bff', '#e8833a', '#4aa8e8', '#e3e9f3'];
  function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function draw() {
    g.clearRect(0, 0, W, H);
    proj = [];
    nodes.forEach(function (n) { if (n.a > 0.02) proj.push({ n: n, q: project(n.p) }); });
    proj.forEach(function (o) {
      var n = o.n; if (!n.parent) return;
      var q2 = project(n.parent.p);
      var dx = o.q.x - q2.x, dy = o.q.y - q2.y, len = Math.max(1, Math.hypot(dx, dy)), ux = dx / len, uy = dy / len;
      g.strokeStyle = 'rgba(150,172,210,' + (0.65 * n.a) + ')'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(q2.x + ux * n.parent.radius * zoom, q2.y + uy * n.parent.radius * zoom); g.lineTo(o.q.x - ux * n.radius * zoom, o.q.y - uy * n.radius * zoom); g.stroke();
    });
    proj.forEach(function (o) {
      var n = o.n, q = o.q, r = n.radius * zoom, hot = n === hover || n === focusN;
      g.globalAlpha = n.a;
      g.fillStyle = COL[n.level];
      g.beginPath(); g.arc(q.x, q.y, r, 0, Math.PI * 2); g.fill();
      if (n.kids.length && !n.open) { g.strokeStyle = COL[n.level]; g.lineWidth = 1.5 * zoom; g.beginPath(); g.arc(q.x, q.y, r + 4 * zoom, 0, Math.PI * 2); g.stroke(); }
      if (hot) { g.strokeStyle = '#ffffff'; g.lineWidth = 2 * zoom; g.beginPath(); g.arc(q.x, q.y, r + 7 * zoom, 0, Math.PI * 2); g.stroke(); }
      var tw = n.boxW * zoom, th = n.boxH * zoom, lx = q.x + r + 6 * zoom, ly = q.y - th / 2;
      rr(lx, ly, tw, th, 5 * zoom); g.fillStyle = 'rgba(9,15,28,0.94)'; g.fill();
      g.strokeStyle = hot ? '#ffffff' : COL[n.level]; g.lineWidth = hot ? 1.6 : 1; g.stroke();
      g.fillStyle = '#f4f7fc'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(n).replace(/([\d.]+)px/, function (_, px) { return (parseFloat(px) * zoom) + 'px'; });
      n.lines.forEach(function (s, i) { g.fillText(s, lx + tw / 2, ly + 4 * zoom + (i + 0.5) * n.lineH * zoom, Math.max(1, tw - 12 * zoom)); });
      g.globalAlpha = 1;
      o.box = [q.x - r - 4 * zoom, Math.min(q.y - r - 4 * zoom, ly), lx + tw, Math.max(q.y + r + 4 * zoom, ly + th)];
    });
  }
  // ---------- 动画（按需运行） ----------
  var running = false, last = 0, drag = null;
  function kick() { if (!running) { running = true; last = 0; requestAnimationFrame(tick); } }
  function tick(t) {
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016; last = t;
    var f = still ? 1 : 1 - Math.exp(-dt * 7), moving = false;
    nodes.forEach(function (n) {
      // 展开：子节点从父节点处移出并淡入；收起：移回父节点并淡出
      var on = n === root || visible(n), tp = on ? n.t : n.parent.p, ta = on ? 1 : 0;
      for (var i = 0; i < 3; i++) { var d = tp[i] - n.p[i]; n.p[i] += d * f; if (Math.abs(d) > 0.05) moving = true; }
      var da = ta - n.a; n.a += da * f; if (Math.abs(da) > 1e-3) moving = true;
    });
    draw();
    if (moving || drag) requestAnimationFrame(tick); else running = false;
  }

  // ---------- 状态操作 ----------
  // 分支层只同时展开一个（手风琴式），画面放得下，标签不互相遮挡
  function collapse(n) { n.open = false; n.kids.forEach(collapse); }
  function open(n) {
    if (n.level === 1) root.kids.forEach(function (c) { if (c !== n) collapse(c); });
    n.open = true;
  }
  function changed(n) { layout(); sync(n); kick(); }
  function toggle(n) {
    if (n.href) { location.href = n.href; return; }
    if (n.open) collapse(n); else open(n);
    changed(n);
  }
  // 展开下一层：根 → 第一个分支（或当前打开的分支）→ 它的全部概念 → 下一个分支
  function expandLayer() {
    var b = null; root.kids.forEach(function (c) { if (c.open) b = c; });
    if (!root.open) root.open = true;
    else if (!b) open(root.kids[0]);
    else if (b.kids.some(function (c) { return !c.open; })) b.kids.forEach(function (c) { c.open = true; });
    else open(root.kids[(root.kids.indexOf(b) + 1) % root.kids.length]);
    changed();
  }
  function reset() { collapse(root); ctr = [0, 0, 0]; zoom = 1; changed(); }

  // ---------- 指针、滚轮、键盘 ----------
  function pick(e) {
    var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    for (var i = proj.length - 1; i >= 0; i--) { var b = proj[i].box; if (b && proj[i].n.a > 0.5 && x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return proj[i].n; }
    return null;
  }
  cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', function (e) {
    if (drag) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 5) drag.moved = true;
      ctr[0] -= dx / zoom; ctr[1] += dy / zoom; draw();
      drag.x = e.clientX; drag.y = e.clientY; return;
    }
    var h = pick(e); if (h !== hover) { hover = h; cv.style.cursor = h ? 'pointer' : 'grab'; draw(); }
  });
  cv.addEventListener('pointerup', function (e) {
    var d = drag; drag = null; if (!d) return;
    if (!d.moved) { var n = pick(e); if (n) toggle(n); }
  });
  cv.addEventListener('pointercancel', function () { drag = null; });
  cv.addEventListener('pointerleave', function () { if (hover) { hover = null; draw(); } });
  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    var next = Math.max(0.55, Math.min(2.8, zoom * Math.exp(-e.deltaY * 0.002)));
    var wx = ctr[0] + (x - W / 2) / zoom, wy = ctr[1] - (y - H / 2) / zoom;
    ctr[0] = wx - (x - W / 2) / next; ctr[1] = wy + (y - H / 2) / next; zoom = next; kick();
  }, { passive: false });
  cv.addEventListener('keydown', function (e) {
    var k = e.key, used = true;
    if (k === 'ArrowLeft') ctr[0] -= 24 / zoom; else if (k === 'ArrowRight') ctr[0] += 24 / zoom;
    else if (k === 'ArrowUp') ctr[1] += 24 / zoom; else if (k === 'ArrowDown') ctr[1] -= 24 / zoom;
    else if (k === '+' || k === '=') zoom = Math.min(2.8, zoom * 1.15); else if (k === '-') zoom = Math.max(0.55, zoom / 1.15);
    else used = false;
    if (used) { e.preventDefault(); kick(); }
  });
  host.querySelector('[data-kg=more]').addEventListener('click', expandLayer);
  host.querySelector('[data-kg=reset]').addEventListener('click', reset);

  // ---------- 可访问列表（与图谱同步，Tab 可达） ----------
  function item(n) {
    var li = document.createElement('li'), el;
    if (n.href) { el = document.createElement('a'); el.href = n.href; el.textContent = n.label + ' →'; }
    else {
      el = document.createElement('button'); el.type = 'button'; el.textContent = n.label;
      if (n.kids.length) el.setAttribute('aria-expanded', String(n.open));
      el.addEventListener('click', function () { toggle(n); });
    }
    el.className = 'kg-i l' + n.level; el.dataset.id = n.id;
    el.addEventListener('focus', function () { focusN = n; draw(); });
    el.addEventListener('blur', function () { if (focusN === n) { focusN = null; draw(); } });
    li.appendChild(el);
    if (n.open && n.kids.length) { var ul = document.createElement('ul'); n.kids.forEach(function (c) { ul.appendChild(item(c)); }); li.appendChild(ul); }
    return li;
  }
  // 重建列表；焦点原在列表中时，重建后放回同一节点
  function sync(keep) {
    var had = list.contains(document.activeElement);
    list.textContent = '';
    list.appendChild(item(root));
    if (keep && had) { var el = list.querySelector('[data-id="' + keep.id + '"]'); if (el) el.focus(); }
  }

  sync();
  // 供版面检查读取（只读）：当前可见节点的标签框
  host.kgBoxes = function () { return proj.filter(function (o) { return o.n.a > 0.5 && o.box; }).map(function (o) { return { label: o.n.label, box: o.box }; }); };
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap); else window.addEventListener('resize', resize);
  resize();
})();
