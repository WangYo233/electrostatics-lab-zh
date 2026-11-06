'use strict';
// 首页立体知识图谱（Canvas 2D，自行做三维旋转投影，无外部库）。
// 从根节点“静电场”开始，点击节点逐层展开；拖动旋转，滚轮缩放；模型节点打开实验室或例题页。
// 布局：每个可见节点占一行（树的先序），层级决定横向位置与纵深；默认视角下各行标签互不遮挡。
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
  var cv = host.querySelector('canvas'), g = cv.getContext('2d'), list = host.querySelector('.kg-list');
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
  // ---------- 布局（世界坐标以 CSS 像素计；z 为纵深） ----------
  // 横向树：每层一列，列宽按该层最长标签实测；叶（含未展开的节点）各占一行，父节点在子节点的中间高度。
  // 纵深：各层前后错开，行间也略有错开；拖动旋转时可以看到层次的立体排列。
  var W = 0, H = 0, small = false, ROW = 30, colX = [];
  var FONT = { 0: 'bold 17px', 1: '600 14.5px', 2: '13.5px', 3: '13px' };
  var FAM = ' "Microsoft YaHei", "PingFang SC", sans-serif';
  function font(n) { return (small ? ['bold 15px', '600 13px', '12.5px', '12px'][n.level] : FONT[n.level]) + FAM; }
  function txt(n) { return n.label + (n.href ? ' →' : n.kids.length ? (n.open ? ' −' : ' +') : ''); }
  function labelW(n) { g.font = font(n); return g.measureText(txt(n)).width + 14; }
  function layout() {
    var vis = nodes.filter(function (n) { return n === root || visible(n); });
    var maxW = [0, 0, 0, 0]; vis.forEach(function (n) { maxW[n.level] = Math.max(maxW[n.level], labelW(n)); });
    var gap = small ? 26 : 38, x = 0, deep = 0; colX = [];
    vis.forEach(function (n) { deep = Math.max(deep, n.level); });
    for (var L = 0; L < 4; L++) { colX[L] = x; x += 14 + maxW[L] + gap; }
    var need = colX[deep] + 14 + maxW[deep] + 40;
    // 画布放不下横向树时改为缩进式（每个节点一行，按层缩进），并按行数加高画布
    outline = need > W * 0.97;
    var slot = 0;
    if (outline) {
      vis.forEach(function (n) { n.row = 0; });
      (function lay(n) { n.row = slot++; if (n.open) n.kids.forEach(lay); })(root);
      ROW = small ? 29 : 30;
      for (L = 0; L < 4; L++) colX[L] = L * (small ? 20 : 26);
      var want = Math.max(baseH, Math.ceil(slot * ROW + 40)) + 'px';
      if (cv.style.height !== want) cv.style.height = want;
    } else {
      if (cv.style.height) cv.style.height = '';
      (function lay(n) {
        if (n.open && n.kids.length) { n.kids.forEach(lay); n.row = (n.kids[0].row + n.kids[n.kids.length - 1].row) / 2; }
        else n.row = slot++;
      })(root);
      ROW = Math.max(small ? 25 : 27, Math.min(46, (H - 44) / Math.max(1, slot)));
    }
    var mid = (slot - 1) / 2;
    nodes.forEach(function (n) {
      var row = n.row === undefined ? 0 : n.row;
      // 深层略向前（z 为负），行间前后交错，表现立体层次；默认俯仰角为 0，同一行的节点仍在同一高度
      // y 按纵深做透视补偿，使默认视角下各行等距、标签不叠压
      var z = -30 * n.level + 12 * Math.sin(row * 1.9);
      n.t = [colX[n.level], (mid - row) * ROW * (CAM + z) / CAM, z];
    });
    nodes.forEach(function (n) { if (!(n === root || visible(n))) delete n.row; });
    var right = outline ? Math.max.apply(null, vis.map(function (n) { return colX[n.level] + labelW(n) + 14; })) : colX[deep] + 14 + maxW[deep];
    ctrT = [(right - 16) / 2, 0, 0];
  }

  // ---------- 视图 ----------
  var YAW0 = 0.2, PITCH0 = 0, CAM = 900, outline = false, baseH = 320;
  var yaw = YAW0, pitch = PITCH0, zoom = 1, hover = null, focusN = null, proj = [];
  var ctr = [0, 0, 0], ctrT = [0, 0, 0];
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    if (!cv.style.height) baseH = cv.clientHeight;
    W = cv.clientWidth; H = cv.clientHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); small = W < 560;
    layout(); ctr = ctrT.slice(); kick();
  }
  function project(p) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var px = p[0] - ctr[0], py = p[1] - ctr[1], pz = p[2] - ctr[2];
    var x = cy * px - sy * pz, z = sy * px + cy * pz, y = cp * py - sp * z; z = sp * py + cp * z;
    var s = CAM / (CAM + z) * zoom;
    return { x: W / 2 + x * s, y: H / 2 - y * s, z: z, s: CAM / (CAM + z) };
  }

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
      var q2 = project(n.parent.p), mx = (q2.x + o.q.x) / 2;
      g.strokeStyle = 'rgba(150,172,210,' + (0.55 * n.a) + ')'; g.lineWidth = n.level === 1 ? 1.6 : 1.2;
      g.beginPath(); g.moveTo(q2.x, q2.y); g.bezierCurveTo(mx, q2.y, mx, o.q.y, o.q.x, o.q.y); g.stroke();
    });
    proj.sort(function (a, b) { return b.q.z - a.q.z; });
    proj.forEach(function (o) {
      var n = o.n, q = o.q, r = [10, 7.5, 6, 5.5][n.level] * Math.max(0.8, Math.min(1.25, q.s)), hot = n === hover || n === focusN;
      g.globalAlpha = n.a;
      g.fillStyle = COL[n.level];
      if (n.level === 3) g.fillRect(q.x - r, q.y - r, 2 * r, 2 * r);
      else { g.beginPath(); g.arc(q.x, q.y, r, 0, 7); g.fill(); }
      if (n.kids.length && !n.open) { g.strokeStyle = COL[n.level]; g.lineWidth = 1.5; g.beginPath(); g.arc(q.x, q.y, r + 4, 0, 7); g.stroke(); }
      if (hot) { g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.arc(q.x, q.y, r + 7, 0, 7); g.stroke(); }
      // 标签在节点右侧，深色底，文字 #eef3fa（对比度大于 12）
      var t = txt(n), th = n.level === 0 ? 24 : 21; g.font = font(n);
      var tw = g.measureText(t).width + 14, lx = q.x + r + 6, ly = q.y - th / 2;
      rr(lx, ly, tw, th, 5); g.fillStyle = 'rgba(9,15,28,0.92)'; g.fill();
      g.strokeStyle = hot ? '#ffffff' : COL[n.level]; g.lineWidth = hot ? 1.6 : 1; g.stroke();
      g.fillStyle = '#eef3fa'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(t, lx + 7, q.y + 0.5);
      g.globalAlpha = 1;
      o.box = [q.x - r - 4, Math.min(q.y - r - 4, ly), lx + tw, Math.max(q.y + r + 4, ly + th)];
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
    for (var j = 0; j < 3; j++) { var dc = ctrT[j] - ctr[j]; ctr[j] += dc * f; if (Math.abs(dc) > 0.05) moving = true; }
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
  function reset() { collapse(root); yaw = YAW0; pitch = PITCH0; zoom = 1; changed(); }

  // ---------- 指针、滚轮、键盘 ----------
  function pick(e) {
    var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    for (var i = proj.length - 1; i >= 0; i--) { var b = proj[i].box; if (b && proj[i].n.a > 0.5 && x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return proj[i].n; }
    return null;
  }
  cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }; cv.setPointerCapture(e.pointerId); kick(); });
  cv.addEventListener('pointermove', function (e) {
    if (drag) {
      yaw = Math.max(-1.3, Math.min(1.3, yaw + (e.clientX - drag.x) * 0.006));
      pitch = Math.max(-1.1, Math.min(1.1, pitch + (e.clientY - drag.y) * 0.006));
      drag.x = e.clientX; drag.y = e.clientY; return;
    }
    var h = pick(e); if (h !== hover) { hover = h; cv.style.cursor = h ? 'pointer' : 'grab'; draw(); }
  });
  cv.addEventListener('pointerup', function (e) {
    var d = drag; drag = null; if (!d) return;
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 5) { var n = pick(e); if (n) toggle(n); }
  });
  cv.addEventListener('pointercancel', function () { drag = null; });
  cv.addEventListener('pointerleave', function () { if (hover) { hover = null; draw(); } });
  cv.addEventListener('wheel', function (e) {
    e.preventDefault(); zoom = Math.max(0.5, Math.min(2.2, zoom * Math.exp(-e.deltaY * 0.0012))); draw();
  }, { passive: false });
  cv.addEventListener('keydown', function (e) {
    var k = e.key, used = true;
    if (k === 'ArrowLeft') yaw = Math.max(-1.3, yaw - 0.12); else if (k === 'ArrowRight') yaw = Math.min(1.3, yaw + 0.12);
    else if (k === 'ArrowUp') pitch = Math.max(-1.1, pitch - 0.12); else if (k === 'ArrowDown') pitch = Math.min(1.1, pitch + 0.12);
    else if (k === '+' || k === '=') zoom = Math.min(2.2, zoom * 1.15); else if (k === '-') zoom = Math.max(0.5, zoom / 1.15);
    else used = false;
    if (used) { e.preventDefault(); draw(); }
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
  if (window.ResizeObserver) new ResizeObserver(resize).observe(cv); else window.addEventListener('resize', resize);
  resize();
})();
