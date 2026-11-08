'use strict';
// 画板下方：实时读数、同步函数曲线、学习记录表
(function (EL) {
  const U = EL.U, h = U.h, K = EL.UI, A = EL.App;

  const fmtV = v => Array.isArray(v) ? U.fmtVec(v) : typeof v === 'number' ? U.fmt(v) : String(v);
  A.prevRd = {};
  // 完整读数（分析工作区）与浮动读数（画板左上角，精选 6 项）；数值变化时短暂高亮
  A.renderReadings = function (c) {
    const all = A.readings(c), prev = A.prevRd, next = {};
    const flash = (el, k, val) => { next[k] = val; if (prev[k] != null && prev[k] !== val && !A.st.anim.on) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } };
    const rows = all.map(([k, v, u]) => {
      if (v === '' && u === '') return h('div.rd-h', { html: U.rich(k) });
      const val = fmtV(v), el = h('div.rd', null, h('span.k', { html: U.rich(k) }), h('span', { class: 'v' + (val === '未定义' ? ' undef' : '') }, val), h('span.u', null, u || ''));
      flash(el, 'r:' + k, val);
      return el;
    });
    U.$('#readings').replaceChildren(...rows);
    const pi = all.findIndex(r => /^— (探针|观察点) /.test(r[0]));
    let pick = pi >= 0 ? all.slice(pi + 1).filter(r => /^(V\(\w\)|\|E\(\w\)\||U\(\w|E∥|路径参数)/.test(r[0])) : [];
    pick = all.filter(r => r[1] !== '' && !String(r[0]).startsWith('—')).slice(0, Math.max(0, 6 - pick.length)).concat(pick).slice(0, 6);
    const hw = U.$('#hudWiz'); hw.hidden = !(c.probeVisible && !c.cs && A.wizData(c));
    U.$('#hudBody').replaceChildren(...(pick.length ? pick.map(([k, v, u]) => {
      const val = fmtV(v), el = h('div.r', null, h('span', { html: U.rich(k) }), h('span', { class: val === '未定义' ? 'undef' : '' }, val + (u ? ' ' + u : '')));
      flash(el, 'h:' + k, val);
      return el;
    }) : [h('div.r', null, h('span', null, '打开探针后，这里显示读数。'))]));
    A.prevRd = next;
  };

  // ---- 同步曲线 ----
  // 纵轴按单位分组：同一单位共用一根纵轴；不同单位分别画在左、右两侧（多于两种单位时向外再加一根）。
  // 刻度取 1、2、5 × 10ⁿ；各纵轴都含 0 时让 0 与网格线对齐。曲线重合时，后画的一条用虚线，先画的一条加粗，两条都能看见。
  const UNIT = { V: 'kQ/L', U: 'kQ²/L', E: 'kQ/L²' };
  let curveZoom = 1;
  const unitOf = (s, d) => s.unit || d.yUnit || UNIT[String(s.name).trim()[0]] || ((d.note || '').match(/纵轴为[^/]*\/\s*\(([^)]+)\)/) || [])[1] || '';
  const niceStep = raw => {
    if (!(raw > 0) || !isFinite(raw)) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  };
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const fmtTick = (v, step) => {
    if (Math.abs(v) < step * 1e-6) return '0';
    const e = Math.floor(Math.log10(step));
    let s;
    if (e >= 4 || e <= -4) {
      const p = Math.floor(Math.log10(Math.abs(v))), m = v / Math.pow(10, p);
      s = (+m.toFixed(Math.max(0, p - e))) + '×10' + String(p).split('').map(ch => SUP[ch]).join('');
    } else s = v.toFixed(Math.max(0, -e));
    return s.replace('-', '−');
  };
  // 稳健范围：折线去掉 3% 的极端尖峰并包含 0；散点只加少量留白
  const rangeOf = (vals, scatter) => {
    const ys = vals.filter(isFinite);
    if (!ys.length) return null;
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (!scatter) {
      if (ys.length > 10) { const s = ys.slice().sort((a, b) => a - b), q = k => s[Math.floor(k * (s.length - 1))]; lo = q(0.03); hi = q(0.97); }
      lo = Math.min(lo, 0); hi = Math.max(hi, 0);
    }
    if (hi - lo < 1e-12) { const e = Math.abs(hi) * 0.1 || 1; lo -= e; hi += e; }
    if (scatter) { const p = (hi - lo) * 0.08; lo -= p; hi += p; }
    return [lo, hi];
  };

  A.renderCurves = function (c) {
    const box = U.$('#curveBox'), d = c && c.m.curves ? c.m.curves(c) : null;
    box.hidden = !d;
    if (!d || document.body.dataset.mode !== 'analyze' || !box.open) return;
    const cv = U.$('#curves'), dpr = window.devicePixelRatio || 1;
    cv.style.height = (document.fullscreenElement === U.$('#curveBox') ? '74vh' : Math.round(210 * curveZoom) + 'px');
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const dark = EL.theme === 'dark', FONT = (document.fullscreenElement === U.$('#curveBox') ? '14px' : '11px') + ' "Times New Roman", "Microsoft YaHei", sans-serif', INK = dark ? '#e3eaf3' : '#263446', GRID = dark ? '#48576c' : '#d2d9e2', AXIS = dark ? '#9baabd' : '#7d8998';
    g.font = FONT;
    const series = d.series.map((s, i) => Object.assign({}, s, { i, col: U.rgb(s.color), unit: unitOf(s, d) }));

    // 1. 按单位分组，求每组的稳健范围
    const groups = [];
    for (const s of series) {
      let gr = groups.find(x => x.unit === s.unit);
      if (!gr) { gr = { unit: s.unit, series: [] }; groups.push(gr); }
      gr.series.push(s); s.g = gr;
    }
    for (const gr of groups) {
      const vals = gr.series.flatMap(s => s.y);
      if (gr === series[0].g) for (const p of d.points || []) vals.push(p.y);
      gr.r = rangeOf(vals, d.scatter);
    }
    const live = groups.filter(gr => gr.r);
    if (!live.length) { U.$('#curveLegend').replaceChildren(h('span.muted', null, '当前参数下没有可画的数值。')); return; }

    // 2. 纵轴刻度：先按目标格数取 1–2–5 步长；各轴都含 0 时统一格数，使 0 和网格线对齐
    const T = 20, B = 32, plotH = H - T - B, target = Math.max(3, Math.min(6, Math.floor(plotH / 34)));
    const allZero = live.every(gr => gr.r[0] <= 0 && gr.r[1] >= 0);
    for (let n = target; n >= 2; n--) {
      for (const gr of live) gr.step = niceStep((gr.r[1] - gr.r[0]) / n);
      if (allZero) {
        const below = Math.max(...live.map(gr => Math.ceil(-gr.r[0] / gr.step - 1e-9))), above = Math.max(...live.map(gr => Math.ceil(gr.r[1] / gr.step - 1e-9)));
        for (const gr of live) { gr.lo = -below * gr.step; gr.hi = above * gr.step; }
      } else for (const gr of live) { gr.lo = Math.floor(gr.r[0] / gr.step + 1e-9) * gr.step; gr.hi = Math.ceil(gr.r[1] / gr.step - 1e-9) * gr.step; }
      if (live.every(gr => (gr.hi - gr.lo) / gr.step <= target + 2)) break;
    }
    for (const gr of live) {
      gr.ticks = [];
      for (let v = gr.lo, k = 0; v <= gr.hi + gr.step * 1e-6 && k < 40; v = gr.lo + (++k) * gr.step) gr.ticks.push(v);
      gr.labels = gr.ticks.map(v => fmtTick(v, gr.step));
      gr.col = gr.series.length === 1 ? gr.series[0].col : INK;
      gr.w = Math.ceil(Math.max(g.measureText(gr.unit).width, ...gr.labels.map(t => g.measureText(t).width))) + 12;
    }
    // 3. 纵轴位置：第 1 组在左，第 2 组在右，其余交替向外
    live.forEach((gr, i) => { gr.side = i % 2 ? 'R' : 'L'; });
    const Ls = live.filter(gr => gr.side === 'L'), Rs = live.filter(gr => gr.side === 'R');
    const L = Math.max(30, Ls.reduce((a, gr) => a + gr.w, 0) + 4), R = W - Math.max(12, Rs.reduce((a, gr) => a + gr.w, 0) + 4);
    let acc = L; for (const gr of Ls) { gr.x = acc; acc -= gr.w; }
    acc = R; for (const gr of Rs) { gr.x = acc; acc += gr.w; }
    const plotW = R - L;
    if (plotW < 60) return;
    for (const gr of live) gr.Y = y => T + (gr.hi - y) / (gr.hi - gr.lo) * plotH;

    // 4. 横轴：1–2–5 刻度，标签间距不少于约 56 px
    const x0 = Math.min(...d.x), x1 = Math.max(...d.x), xs = x1 - x0 || 1;
    const X = x => L + (x - x0) / xs * plotW;
    let xstep = niceStep(xs / Math.max(2, Math.floor(plotW / 56)));
    if (d.scatter) xstep = Math.max(1, Math.round(xstep));
    const xticks = [];
    for (let v = Math.ceil(x0 / xstep - 1e-9) * xstep; v <= x1 + xstep * 1e-6; v += xstep) xticks.push(+v.toFixed(10));

    // 5. 排除区域、网格线、零线
    g.save(); g.beginPath(); g.rect(L, T, plotW, plotH); g.clip();
    g.fillStyle = 'rgba(120,130,140,0.16)';
    for (const [a, b] of d.bands || []) g.fillRect(X(a), T, X(b) - X(a), plotH);
    g.strokeStyle = GRID; g.lineWidth = 1;
    const prim = live[0];
    g.beginPath();
    for (const v of prim.ticks) { const y = Math.round(prim.Y(v)) + 0.5; g.moveTo(L, y); g.lineTo(R, y); }
    for (const v of xticks) { const x = Math.round(X(v)) + 0.5; g.moveTo(x, T); g.lineTo(x, T + plotH); }
    g.stroke();
    const zeros = new Set();
    for (const gr of live) if (gr.lo < 0 && gr.hi > 0) zeros.add(Math.round(gr.Y(0)));
    g.strokeStyle = '#7d8996'; g.lineWidth = 1;
    for (const y of zeros) { g.beginPath(); g.moveTo(L, y + 0.5); g.lineTo(R, y + 0.5); g.stroke(); }
    g.restore();

    // 6. 坐标轴与刻度标签（标签颜色与该轴曲线一致；单位写在轴顶）
    g.strokeStyle = AXIS; g.lineWidth = 1;
    g.beginPath(); g.moveTo(L, T + plotH + 0.5); g.lineTo(R, T + plotH + 0.5); g.stroke();
    g.textBaseline = 'middle';
    for (const gr of live) {
      const left = gr.side === 'L', ax = Math.round(gr.x) + 0.5;
      g.strokeStyle = AXIS; g.beginPath(); g.moveTo(ax, T); g.lineTo(ax, T + plotH);
      let lastY = -1e9;
      gr.ticks.forEach(v => { const y = gr.Y(v); g.moveTo(ax, y); g.lineTo(ax + (left ? -4 : 4), y); });
      g.stroke();
      g.fillStyle = gr.col; g.textAlign = left ? 'right' : 'left';
      gr.ticks.forEach((v, k) => { const y = gr.Y(v); if (Math.abs(y - lastY) < 12) return; lastY = y; g.fillText(gr.labels[k], ax + (left ? -6 : 6), y); });
      g.textBaseline = 'alphabetic'; g.fillText(gr.unit, ax + (left ? -6 : 6), T - 7); g.textBaseline = 'middle';
    }
    g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'top';
    let lastX = -1e9;
    for (const v of xticks) {
      const x = X(v), t = fmtTick(v, xstep), w = g.measureText(t).width;
      g.beginPath(); g.strokeStyle = AXIS; g.moveTo(Math.round(x) + 0.5, T + plotH); g.lineTo(Math.round(x) + 0.5, T + plotH + 4); g.stroke();
      if (x - w / 2 < lastX + 6) continue;
      g.fillText(t, x, T + plotH + 6); lastX = x + w / 2;
    }
    g.textBaseline = 'alphabetic';
    g.fillText(d.xLabel, (L + R) / 2, H - 3);

    // 7. 曲线：先算屏幕坐标，判断哪些曲线与前面的曲线重合
    const pts = series.map(s => {
      const gr = s.g; if (!gr.r) return null;
      const span = gr.hi - gr.lo;
      return d.x.map((x, i) => { const y = s.y[i]; return isFinite(y) && y > gr.lo - 2 * span && y < gr.hi + 2 * span ? [X(x), gr.Y(y)] : null; });
    });
    series.forEach((s, si) => {
      s.over = null;
      if (!pts[si] || d.scatter) return;
      for (let j = 0; j < si && !s.over; j++) {
        if (!pts[j]) continue;
        let n = 0, same = 0;
        pts[si].forEach((p, k) => { const q = pts[j][k]; if (p && q) { n++; if (Math.abs(p[1] - q[1]) < 1.5) same++; } });
        if (n && same / n > 0.85) s.over = series[j];
      }
    });
    const covered = new Set(series.filter(s => s.over).map(s => s.over));
    g.save(); g.beginPath(); g.rect(L, T - 1, plotW, plotH + 2); g.clip();
    // 散点：第 1 组画成空心圆环并最后画，数值相近时也不会被其他标记盖住
    const marker = (k, x, y) => {
      g.beginPath();
      if (k % 3 === 0) { g.lineWidth = 2; g.arc(x, y, 4.6, 0, 7); g.stroke(); return; }
      if (k % 3 === 1) g.rect(x - 3, y - 3, 6, 6);
      else { g.moveTo(x, y - 4); g.lineTo(x + 3.8, y + 3); g.lineTo(x - 3.8, y + 3); g.closePath(); }
      g.fill();
    };
    if (d.scatter) for (let si = series.length - 1; si >= 0; si--) { const P = pts[si]; if (!P) continue; g.strokeStyle = g.fillStyle = series[si].col; P.forEach(p => p && marker(si, p[0], p[1])); }
    series.forEach((s, si) => {
      const P = pts[si]; if (!P) return;
      g.strokeStyle = s.col; g.fillStyle = s.col;
      if (d.scatter) return;
      g.lineWidth = covered.has(s) ? 3.6 : 2; g.setLineDash(s.over ? [7, 5] : []); g.lineJoin = 'round';
      g.beginPath();
      let pen = false;
      for (const p of P) { if (!p) { pen = false; continue; } if (pen) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); pen = true; }
      g.stroke();
    });
    g.setLineDash([]);
    // 当前构型（散点图）
    const g0 = series[0].g;
    if (g0.r) for (const p of d.points || []) {
      if (!isFinite(p.y)) continue;
      const px = X(p.x), py = g0.Y(p.y);
      g.fillStyle = U.rgb(p.color); g.strokeStyle = '#fff'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(px, py, 5.5, 0, 7); g.fill(); g.stroke();
      g.fillStyle = INK; g.textAlign = px > (L + R) / 2 ? 'right' : 'left'; g.fillText(p.name, px + (px > (L + R) / 2 ? -8 : 8), py - 7);
    }
    // 当前位置：竖直虚线，并在每条曲线上标出当前值
    if (d.cur != null && isFinite(d.cur) && !d.scatter) {
      const cx = X(d.cur);
      g.strokeStyle = '#4b5563'; g.lineWidth = 1; g.setLineDash([4, 3]);
      g.beginPath(); g.moveTo(Math.round(cx) + 0.5, T); g.lineTo(Math.round(cx) + 0.5, T + plotH); g.stroke(); g.setLineDash([]);
      series.forEach((s, si) => {
        if (!pts[si]) return;
        let k = 0, best = Infinity;
        d.x.forEach((x, i) => { const e = Math.abs(x - d.cur); if (e < best) { best = e; k = i; } });
        const p = pts[si][k]; if (!p) return;
        g.fillStyle = s.col; g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.beginPath(); g.arc(p[0], p[1], 3.6, 0, 7); g.fill(); g.stroke();
      });
    }
    g.restore();
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', '同步曲线：横轴为 ' + d.xLabel + '；' + series.map(s => s.name + (s.unit ? '（' + s.unit + '）' : '')).join('，') + '。');

    // 8. 图例：线型与颜色、所在纵轴与单位；重合的曲线写明
    const multi = live.length > 1, sideName = s => !multi || !s.g.r ? '' : s.g.side === 'L' ? (s.g === live[0] ? '左轴' : '左侧外轴') : (s.g === live[1] ? '右轴' : '右侧外轴');
    const sw = s => d.scatter ? (s.i % 3 === 0 ? 'background:transparent;border:2px solid ' + s.col + ';box-sizing:border-box;height:9px;width:9px;border-radius:50%' : 'background:' + s.col + ';height:7px;width:7px;border-radius:' + (s.i % 3 === 1 ? '1px' : '0'))
      : s.over ? 'background:repeating-linear-gradient(90deg,' + s.col + ' 0 5px,transparent 5px 8px)' : 'background:' + s.col + (covered.has(s) ? ';height:4px' : '');
    const items = series.map(s => h('span', null, h('i', { style: sw(s) }), s.name,
      h('span.muted', null, [sideName(s), s.unit].filter(Boolean).length ? '（' + [sideName(s), s.unit].filter(Boolean).join('，') + '）' : ''),
      s.over ? h('span.muted', null, '，与 ' + s.over.name + ' 重合，用虚线画出') : null));
    if ((d.bands || []).length) items.push(h('span', null, h('i', { style: 'background:rgba(120,130,140,0.35);height:9px' }), '源电荷附近的排除区域'));
    if (d.cur != null && !d.scatter) items.push(h('span', null, h('i', { style: 'background:repeating-linear-gradient(90deg,#4b5563 0 3px,transparent 3px 5px)' }), '当前位置'));
    U.$('#curveLegend').replaceChildren(...items, d.note ? h('span.muted', null, d.note) : null);
  };

  // ---- 学习记录：保存在本浏览器，可导出 CSV ----
  // 浏览器存储不可用时，记录暂存在本页内存中，并提示导出
  const recKey = () => 'records:' + A.st.model.id, mem = {};
  const loadRecs = () => { const r = U.store.get(recKey(), null); return Array.isArray(r) ? r : (mem[recKey()] || []); };
  const saveRecs = recs => { mem[recKey()] = recs; return U.store.set(recKey(), recs); };
  const COLS = ['配置 / 位置', '预测', '实测 V、E', '解释 / 结论'];

  // 读取当前配置与读数，追加一行；分析工作区与记录工作区的“记录当前读数”都调用这里
  A.recordReading = function () {
    const c = A.c;
    if (!c) return false;
    const st = c.st, s = c.probe && c.probe.s ? c.probe.s : null;
    const cfg = '阶段 ' + (st.stage + 1) + '「' + c.m.stages[st.stage].title + '」；' + (c.m.analytic ? EL.SUB08[st.sub].name + ' ' : '') +
      Object.entries(st.p).filter(([k, v]) => typeof v === 'number' && !/^p[xyz]$/.test(k) && (!c.m.analytic || k.startsWith(st.sub) || k === 'range')).map(([k, v]) => k.replace(/^.*:/, '') + '=' + U.fmt(v, 4)).join('，') +
      (st.custom ? '；自定义源 ' + c.sources.map(x => x.label + '(' + x.q + ')@' + U.fmtVec(x.p, 3)).join(' ') : '') +
      (c.probe && c.probeVisible ? '；P=' + U.fmtVec(c.probe.pos, 3) : '');
    const meas = s && c.probeVisible ? (s.ok === false || !isFinite(s.V) ? '该点的电势与场强未定义' : 'V=' + U.fmt(s.V) + ' kQ/L，|E|=' + U.fmt(EL.V.len(s.E)) + ' kQ/L²，E=' + U.fmtVec(s.E))
      : A.readings(c).filter(r => r[1] !== '' && !String(r[0]).startsWith('—')).slice(0, 3).map(r => String(r[0]).replace(/<[^>]+>/g, '') + '=' + fmtV(r[1]) + (r[2] ? ' ' + r[2] : '')).join('，');
    const recs = loadRecs();
    recs.push([cfg, '', meas, '']);
    const ok = saveRecs(recs);
    A.renderRecords();
    U.toast(ok ? '已记录第 ' + recs.length + ' 行读数。可以在“记录”工作区查看并补充预测与结论。'
      : '已记录第 ' + recs.length + ' 行读数，但浏览器存储不可用，关闭页面后记录会丢失；请导出 CSV 文件保存。', 3200);
    return ok;
  };

  if (U.$('#curveZoomIn')) U.$('#curveZoomIn').addEventListener('click', () => { curveZoom = Math.min(2.8, curveZoom + 0.25); if (A.c) A.renderCurves(A.c); });
  if (U.$('#curveZoomOut')) U.$('#curveZoomOut').addEventListener('click', () => { curveZoom = Math.max(1, curveZoom - 0.25); if (A.c) A.renderCurves(A.c); });
  if (U.$('#curveFull')) {
    U.$('#curveFull').addEventListener('click', () => { const el = U.$('#curveBox'); document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen && el.requestFullscreen(); });
    document.addEventListener('fullscreenchange', () => { if (A.c) A.renderCurves(A.c); });
  }
  A.renderRecords = function () {
    const recs = loadRecs(), save = () => saveRecs(recs);
    // textarea 的内容要写到 value 属性（setAttribute('value') 对 textarea 无效）
    const cell = (r, k) => { const t = h('textarea', { rows: 2, 'aria-label': COLS[k], oninput: e => { r[k] = e.target.value; save(); } }); t.value = r[k] || ''; return h('td', null, t); };
    const tb = recs.map((r, i) => h('tr', null, ...COLS.map((_, k) => cell(r, k)),
      h('td', null, K.btn('×', () => { recs.splice(i, 1); save(); A.renderRecords(); }, 'mini', '删除这一行'))));
    U.$('#records').replaceChildren(
      recs.length ? h('table.rec', null, h('thead', null, h('tr', null, ...COLS.map(t => h('th', null, t)), h('th'))), h('tbody', null, tb))
        : h('p.note', null, '还没有记录。在“分析”或这里点“记录当前读数”，当前配置与读数会写入新的一行。'),
      h('div.btns', null,
        K.btn('记录当前读数', () => A.recordReading(), 'primary'),
        K.btn('添加空行', () => { recs.push(['', '', '', '']); save(); A.renderRecords(); }),
        K.btn('导出 CSV', () => U.download('学习记录_' + A.st.model.code + '_' + A.st.model.title + '.csv', U.csv([COLS].concat(recs)), 'text/csv;charset=utf-8')),
        K.btn('清除记录', () => { if (confirm('要清除本模型的全部学习记录吗？')) { U.store.del(recKey()); delete mem[recKey()]; A.renderRecords(); } })));
  };
})(window.EL);
