'use strict';
// 应用状态与计算上下文
(function (EL) {
  const V = EL.V, U = EL.U;
  const A = EL.App = {};

  A.defaultStyle = () => ({ lineWidth: 1.2, vecScale: 1, chargeOpacity: 1, chargeSize: 4, surfOpacity: 0.24, geomOpacity: 0.13, surfOpacity2: 0.28, axes: true, grid: false, probeVec: 1 });
  A.LAYERS = [
    ['charges', '电荷'], ['geom', '几何背景'], ['lines', '电场线'], ['flow', '流动粒子'], ['contours', '截面等势线'], ['surfaces', '等势面（仅三维）'],
    ['surfLabels', '等势面的电势值'], ['probe', '探针（观察点）'], ['vectors', '场强矢量采样'], ['frame', '视域边框']
  ];

  A.init = function (m) {
    const st = A.st = {
      model: m, stage: 0, p: {}, hidden: JSON.parse(JSON.stringify(m.hidden || {})), sub: m.sub || null,
      custom: null, view: m.view, plane: (m.display && m.display.plane) || 'xy', planePos: 0,
      layers: Object.assign({ charges: true, geom: true, lines: false, flow: false, contours: false, surfaces: false, surfLabels: false, probe: false, vectors: false, frame: false },
        m.defaultLayers || {}),
      level: 0, spacing: 0.3, count: 1, seeds: m.view === '2d' ? 8 : 12, quality: 'fast',
      style: A.defaultStyle(), anim: { on: false, target: 'probe', path: 'x', r: 1, period: 12, trail: true, eTrail: false, sliceTrail: false, t: 0 },
      comp: { show: false, pick: [], method: 'para', total: false, groups: {}, plane: false }, showSpecial: -1, trail: [], eTrail: [], sliceTrail: [],
      cs: 0, answers: {},
      // 标注：各类标签开关、用户标注点
      labels: { charges: true, points: true, levels: true, axes: true, vectors: true, angles: true, scale: 1 },
      notes: [],
      // 几何关系辅助：探针—源连线与距离、源—源连线、两源方向夹角
      geo: { probeLines: false, srcLines: false, angle: [] },
      // 场强合成向导
      wiz: { on: false, i: 0, ans: {}, hide: true }
    };
    for (const q of m.params) st.p[q.key] = q.val;
    for (const t of m.toggles || []) st.p[t.key] = t.val;
    Object.assign(st, m.display || {});
    if (m.initialSources) st.custom = m.initialSources.map((s, i) => ({ p: s.p.slice(), q: s.q, label: 'Q' + (i + 1) }));
    return st;
  };

  // 应用教学阶段：参数预设、视图与显示层
  A.applyStage = function (i, keepLayers) {
    const st = A.st, m = st.model, s = m.stages[i];
    st.stage = i;
    if (s.preset) { Object.assign(st.p, s.preset); if (!m.alwaysCustom) st.custom = null; }
    if (s.display) Object.assign(st, s.display);
    if (s.view) st.view = s.view;
    else if (m.stages.some(x => x.view)) st.view = m.view;
    if (s.layers) Object.assign(st.layers, s.layers);
    if (!keepLayers && m.id !== 7 && m.id !== 8) {
      st.layers.surfaces = false;
    }
    st.trail = []; st.eTrail = []; st.sliceTrail = [];
    if (st.wiz) st.wiz.on = false;
  };

  // ---- 撤销 / 恢复 ----
  // 记录可序列化的模型状态（参数、开关、显示层、源电荷、探针位置、阶段、外观、标注）。不记录视角、动画轨迹与合成向导的作答进度。
  // 提交时机：A.update 之后合并到同一轮事件末尾；拖动把手、播放动画、按住滑块（input 事件）期间不提交，松开（change）后提交一次。
  A.HIST_MAX = 100;
  A.hist = { u: [], r: [], cur: null, hold: false, t: 0 };
  const ANIM_KEYS = ['target', 'path', 'r', 'period', 'trail', 'eTrail', 'sliceTrail'];
  A.histState = function () {
    const st = A.st, an = {};
    for (const k of ANIM_KEYS) an[k] = st.anim[k];
    return JSON.stringify({ stage: st.stage, sub: st.sub, p: st.p, hidden: st.hidden, custom: st.custom, view: st.view, plane: st.plane, planePos: st.planePos,
      layers: st.layers, level: st.level, spacing: st.spacing, count: st.count, seeds: st.seeds, quality: st.quality, probeLevel: !!st.probeLevel, vecN: st.vecN || null,
      showSpecial: st.showSpecial, style: st.style, labels: st.labels, notes: st.notes, geo: st.geo, anim: an,
      comp: { show: st.comp.show, pick: st.comp.pick, method: st.comp.method, total: st.comp.total, groups: st.comp.groups, plane: st.comp.plane }, theme: EL.theme,
      colors: U.store.get('colors:' + EL.theme, {}) });
  };
  A.histReset = function () { const H = A.hist; H.u = []; H.r = []; H.cur = A.st ? A.histState() : null; A.histUI(); };
  A.histCommit = function () {
    const H = A.hist;
    if (!A.st || H.hold || A.dragging || A.st.anim.on) return;
    const s = A.histState();
    if (H.cur == null) { H.cur = s; return; }
    if (s === H.cur) return;
    H.u.push(H.cur); if (H.u.length > A.HIST_MAX) H.u.shift();
    H.r = []; H.cur = s;
    A.histUI();
  };
  // 同一次操作中多次调用 A.update 只记一步
  A.histSoon = function () { const H = A.hist; if (H.t) return; H.t = setTimeout(() => { H.t = 0; A.histCommit(); }, 0); };
  A.histApply = function (json) {
    const st = A.st, d = JSON.parse(json), H = A.hist;
    if (st.anim.on) { st.anim.on = false; cancelAnimationFrame(A.raf); }
    H.cur = json;                          // 先设定当前状态：恢复过程中的 A.update 不会再记一步
    const sub0 = st.sub, view0 = st.view, stage0 = st.stage;
    for (const k of ['stage', 'sub', 'hidden', 'custom', 'view', 'plane', 'planePos', 'level', 'spacing', 'count', 'seeds', 'quality', 'probeLevel', 'showSpecial', 'notes']) st[k] = d[k];
    if (d.vecN) st.vecN = d.vecN; else delete st.vecN;
    for (const k of Object.keys(st.p)) delete st.p[k];
    Object.assign(st.p, d.p);
    for (const k of ['layers', 'style', 'labels', 'geo', 'anim', 'comp']) Object.assign(st[k], d[k]);
    st.trail = []; st.eTrail = []; st.sliceTrail = [];
    if (st.stage !== stage0 || !st.layers.probe) st.wiz.on = false;
    if (d.theme && d.theme !== EL.theme && A.setTheme) A.setTheme(d.theme);
    if (d.colors && JSON.stringify(d.colors) !== JSON.stringify(U.store.get('colors:' + EL.theme, {}))) {
      if (Object.keys(d.colors).length) U.store.set('colors:' + EL.theme, d.colors); else U.store.del('colors:' + EL.theme);
      A.applyColors();
    }
    if (st.sub !== sub0) { A.cache.clear(); A.renderTheory(); A.renderExercises(); }
    A.applyLabelScale();
    A.update();
    if (st.view !== view0 || st.stage !== stage0) { A.resetCamera(); A.update(); }
    A.renderStage(); A.renderPanel(); A.renderCaption(true); A.renderDerive();
    if (document.body.dataset.mode === 'analyze') { A.renderReadings(A.c); A.renderCurves(A.c); A.renderWizBox(); A.renderGeo(); A.renderComp(); }
    A.r.draw();
    // 以恢复后的实际状态为当前状态，并取消恢复过程中排队的提交，避免多记一步、清空“恢复”
    if (H.t) { clearTimeout(H.t); H.t = 0; }
    H.cur = A.histState();
    A.histUI();
  };
  // 撤销前先提交尚未记录的改动（例如刚输入的数值），保证撤销的是最近一步
  A.histFlush = function () { const H = A.hist; if (H.t) { clearTimeout(H.t); H.t = 0; } H.hold = false; A.histCommit(); };
  A.undo = function () { const H = A.hist; if (!A.st) return; A.histFlush(); if (!H.u.length) return; H.r.push(H.cur); A.histApply(H.u.pop()); U.toast('已撤销上一步操作。'); };
  A.redo = function () { const H = A.hist; if (!A.st) return; A.histFlush(); if (!H.r.length) return; H.u.push(H.cur); A.histApply(H.r.pop()); U.toast('已恢复撤销的操作。'); };
  A.histUI = function () {
    const u = document.getElementById('btnUndo'), r = document.getElementById('btnRedo');
    if (u) { u.disabled = !A.hist.u.length; u.setAttribute('aria-label', '撤销（可撤销 ' + A.hist.u.length + ' 步）'); }
    if (r) { r.disabled = !A.hist.r.length; r.setAttribute('aria-label', '恢复（可恢复 ' + A.hist.r.length + ' 步）'); }
  };
  A.initHistory = function () {
    const H = A.hist, slow = t => t && (t.type === 'range' || t.type === 'color');
    // 按住滑块、拖动取色器期间（input 事件）不提交；松开（change 事件）后提交一次。捕获阶段先于控件自身的处理函数
    document.addEventListener('input', e => { if (slow(e.target)) H.hold = true; }, true);
    document.addEventListener('change', e => { if (slow(e.target)) H.hold = false; }, true);
    // 少数控件（例如标注字号）改动后不调用 A.update：在冒泡阶段补一次提交（状态未变时不记步）
    document.addEventListener('change', () => A.histSoon());
    document.addEventListener('click', () => A.histSoon());
    document.addEventListener('pointerup', () => { if (H.hold) setTimeout(() => { H.hold = false; A.histSoon(); }, 0); }, true);
    const u = document.getElementById('btnUndo'), r = document.getElementById('btnRedo');
    if (u) u.addEventListener('click', A.undo);
    if (r) r.addEventListener('click', A.redo);
    document.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const t = e.target, k = e.key.toLowerCase();
      // 文字与数值输入框保留浏览器自带的撤销
      if (t && (t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && !/^(range|checkbox|radio|color|button)$/.test(t.type)))) return;
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); A.undo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); A.redo(); }
    });
    if (H.t) { clearTimeout(H.t); H.t = 0; }
    A.histReset();
  };

  // ---- 分隔条：拖动调节抽屉、检查器与理论页目录栏的宽度 ----
  // 宽度按工作区分别保存在 U.store('split:<工作区>')；双击恢复默认；聚焦后用方向键调节（Shift 加大步长），Home / End 到最小 / 最大
  const SPLIT = {
    drawer: { name: '工具面板', min: 220, max: 520, def: () => 300, cssVar: '--drawer-u', grow: 1 },
    insp: { name: '检查器', min: 260, max: 760, def: m => ({ analyze: 420, record: 560 })[m] || 320, cssVar: '--insp-u', grow: -1 },
    side: { name: '目录栏', min: 240, max: 460, def: () => 300, cssVar: '--tp-side', grow: -1 }
  };
  const STAGE_MIN = 360;
  const splitHost = k => k === 'side' ? document.getElementById('theory') : document.querySelector('.work');
  const splitSaved = mode => U.store.get('split:' + mode, {}) || {};
  // 某一栏当前允许的最大宽度：保证画板（或理论正文）不小于 STAGE_MIN
  const splitMax = k => {
    const S = SPLIT[k], host = splitHost(k);
    if (!host) return S.max;
    if (k === 'side') return Math.max(S.min, Math.min(S.max, host.clientWidth - 40 - 24 - 420));
    const W = host.clientWidth, other = k === 'drawer' ? document.getElementById('inspector') : document.getElementById('drawer');
    return Math.max(S.min, Math.min(S.max, W - 56 - (other ? other.getBoundingClientRect().width : 0) - STAGE_MIN));
  };
  const splitWidth = (k, mode) => { const v = splitSaved(mode)[k]; return v != null ? v : SPLIT[k].def(mode); };
  A.applySplit = function (mode) {
    mode = mode || document.body.dataset.mode;
    const d = splitSaved(mode), work = document.querySelector('.work'), th = document.getElementById('theory');
    if (work) for (const k of ['drawer', 'insp']) { if (d[k] != null) work.style.setProperty(SPLIT[k].cssVar, d[k] + 'px'); else work.style.removeProperty(SPLIT[k].cssVar); }
    const side = splitSaved('theory').side;
    if (th) { if (side != null) th.style.setProperty('--tp-side', side + 'px'); else th.style.removeProperty('--tp-side'); }
    A.splitAria && A.splitAria();
  };
  A.setSplit = function (k, w, save) {
    const S = SPLIT[k], mode = k === 'side' ? 'theory' : document.body.dataset.mode, host = splitHost(k);
    w = Math.round(U.clamp(w, S.min, Math.max(S.min, splitMax(k))));
    host.style.setProperty(S.cssVar, w + 'px');
    if (save) { const d = splitSaved(mode); d[k] = w; U.store.set('split:' + mode, d); }
    A.splitAria();
    return w;
  };
  A.resetSplit = function (k) {
    const mode = k === 'side' ? 'theory' : document.body.dataset.mode, d = splitSaved(mode);
    delete d[k]; U.store.set('split:' + mode, d);
    A.applySplit();
    // 等栏宽过渡结束后重绘画板与曲线
    setTimeout(() => { if (A.r) A.r.draw(); if (A.c && A.renderCurves) A.renderCurves(A.c); A.splitAria(); }, 400);
  };
  A.splitAria = function () {
    const mode = document.body.dataset.mode;
    document.querySelectorAll('.splitter').forEach(el => {
      const k = el.dataset.split, S = SPLIT[k];
      el.setAttribute('aria-valuemin', S.min);
      el.setAttribute('aria-valuemax', Math.round(splitMax(k)));
      el.setAttribute('aria-valuenow', splitWidth(k, k === 'side' ? 'theory' : mode));
    });
  };
  A.initSplitters = function () {
    const mk = k => {
      const S = SPLIT[k];
      const el = U.h('div.splitter', { role: 'separator', tabindex: 0, 'aria-orientation': 'vertical', 'data-split': k,
        'aria-label': '调节' + S.name + '宽度', title: '拖动调节' + S.name + '宽度；双击恢复默认宽度' });
      let x0 = 0, w0 = 0, id = null;
      const cur = () => { const mode = k === 'side' ? 'theory' : document.body.dataset.mode; return splitWidth(k, mode); };
      el.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        e.preventDefault(); id = e.pointerId;
        try { el.setPointerCapture(id); } catch (er) { /* 没有可捕获的指针（例如脚本派发的事件）时照常拖动 */ }
        x0 = e.clientX;
        // 以目标宽度为起点（栏宽可能仍在过渡动画中，实测宽度不可靠）
        const v = parseFloat(getComputedStyle(splitHost(k)).getPropertyValue(S.cssVar));
        w0 = isFinite(v) ? v : cur();
        el.classList.add('dragging'); document.body.classList.add('resizing');
      });
      el.addEventListener('pointermove', e => { if (id !== e.pointerId) return; A.setSplit(k, w0 + S.grow * (e.clientX - x0), false); });
      const end = e => {
        if (id !== e.pointerId) return;
        id = null;
        A.setSplit(k, w0 + S.grow * (e.clientX - x0), true);
        requestAnimationFrame(() => { el.classList.remove('dragging'); document.body.classList.remove('resizing'); if (A.r) A.r.draw(); });
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('dblclick', () => A.resetSplit(k));
      el.addEventListener('keydown', e => {
        const step = e.shiftKey ? 48 : 16;
        let w = null;
        if (e.key === 'ArrowLeft') w = cur() - S.grow * step;
        else if (e.key === 'ArrowRight') w = cur() + S.grow * step;
        else if (e.key === 'Home') w = S.min;
        else if (e.key === 'End') w = splitMax(k);
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); A.resetSplit(k); return; }
        if (w == null) return;
        e.preventDefault(); e.stopPropagation();
        document.body.classList.add('resizing');
        A.setSplit(k, w, true);
        requestAnimationFrame(() => { document.body.classList.remove('resizing'); if (A.r) A.r.draw(); });
      });
      return el;
    };
    const work = document.querySelector('.work'), side = document.querySelector('.tp-side');
    if (work) work.append(mk('drawer'), mk('insp'));
    if (side) side.prepend(mk('side'));
    A.applySplit();
  };

  // 合成向导的步骤状态：带预测题的步骤在作答前不揭示其构造（先预测、后验证）
  A.stepState = function (c) {
    const st = A.st;
    if (!st.wiz.on || !c) return null;
    const steps = A.wizSteps(c);
    if (!steps) return null;
    const i = EL.U.clamp(st.wiz.i, 0, steps.length - 1), step = steps[i];
    const ans = st.wiz.ans[i];
    const revealed = !step.ask || ans != null;
    return { i, n: steps.length, step, steps, ans, revealed, k: revealed ? i : i - 1 };
  };

  A.cache = new Map();
  A.cached = function (key, fn) {
    if (!A.cache.has(key)) { if (A.cache.size > 80) A.cache.delete(A.cache.keys().next().value); A.cache.set(key, fn()); }
    return A.cache.get(key);
  };

  // 自定义源的实际位置（模型 07 可绑定到背景特殊点）
  A.resolveSources = function () {
    const st = A.st;
    return st.custom.map((s, i) => {
      let p = s.p;
      if (s.bind) {
        const bg = st.hidden.bgs && st.hidden.bgs[s.bind.bg];
        const sp = bg && EL.GEO.build(bg).special.find(x => x.key === s.bind.key);
        if (sp) p = sp.p; else s.bind = null;
      }
      return { p: p.slice(), q: s.q, label: s.label || 'Q' + (i + 1), i };
    });
  };

  A.ctx = function () {
    const st = A.st, m = st.model, p = st.p, c = { m, st, p, stage: st.stage, hidden: st.hidden, layers: st.layers, rMin: m.rMin || 0, custom: !!st.custom };
    c.set = obj => { Object.assign(p, obj); };
    c.cached = A.cached;
    if (m.analytic) {
      const sub = m.subs[st.sub];
      c.sub = st.sub; c.subP = m.subParams(p, st.sub);
      c.F = EL.Phys.analyticField(x => sub.fn(c.subP, x));
      if (sub.stopAt === 'z0') c.F.segBlocked = (a, b) => c.subP.sigma !== 0 && a[2] * b[2] <= 0;
      if (sub.inner) c.F.segBlocked = (a, b) => V.len(b) < c.subP.a;
      c.sources = [];
    } else {
      c.sources = st.custom ? A.resolveSources() : m.sources(p);
      c.F = EL.Phys.pointField(c.sources, m.rMin);
    }
    c.sample = q => c.F.sample(q);
    const R = m.rangeKey ? p[m.rangeKey] : m.R;
    c.bound = m.rangeKey ? R : Math.max(R, ...c.sources.map(s => Math.max(...s.p.map(Math.abs)) + 2));
    c.levels = m.analytic
      ? EL.Phys.levels([], st.count, st.level, st.spacing, false)
      : EL.Phys.levels(c.sources, st.count, st.level, st.spacing, m.perCharge);
    c.planeName = V.planeBasis(st.plane).nl;
    // 探针
    const pr = m.probe || {};
    const useCustom = pr.customKey && p[pr.customKey];
    let path = null;
    if (!useCustom) path = pr.path || (pr.pathFn && (!pr.when || pr.when(p, st)) ? pr.pathFn(p) : null);
    const fixed = !useCustom && !path && pr.fixedFn ? pr.fixedFn(p, st) : null;
    if (path) c.probe = { path, t: p[path.key], pos: path.pos(p[path.key]), name: pr.nameFn ? pr.nameFn() : 'P' };
    else if (fixed) c.probe = { pos: fixed.pos, name: fixed.name, fixed: true };
    else if (pr.free) c.probe = { pos: pr.free.map(k => p[k]), free: pr.free, name: 'P' };
    if (c.probe) { c.probe.s = c.F.sample(c.probe.pos); c.probe.own = !!pr.ownVectors; }
    // 构造步骤
    c.cs = A.stepState(c);
    c.hide = new Set();
    if (c.cs && c.cs.k >= 0 && c.cs.steps[c.cs.k].hide) c.cs.steps[c.cs.k].hide.forEach(x => c.hide.add(x));
    c.probeVisible = !!c.probe && st.layers.probe && (pr.fromStage == null || st.stage >= pr.fromStage || useCustom);
    // 过探针的等势面：把探针处的电势加入层值，拖动探针即可寻找曲面“收缩成一点”的位置（零场点）
    c.probeLevel = st.probeLevel && c.probeVisible && c.probe.s.ok ? +c.probe.s.V.toFixed(6) : null;
    if (c.probeLevel != null && !c.levels.some(v => Math.abs(v - c.probeLevel) < 1e-6)) c.levels = c.levels.concat(c.probeLevel).sort((a, b) => a - b);
    // 非线性压缩的显示箭头长度：弱场仍可见，定量以读数为准
    c.arrowVec = E => {
      const L = V.len(E);
      if (!(L > 0)) return [0, 0, 0];
      const s = Math.sqrt(L), len = Math.min(c.bound * 0.32, st.style.vecScale * c.bound * 0.16 * s / (1 + s));
      return V.mul(E, len / L);
    };
    c.showSpecial = st.showSpecial;
    return c;
  };

  // 当前阶段的完整读数：模型读数 + 探针读数
  A.readings = function (c) {
    const out = c.m.readings ? c.m.readings(c) : [];
    if (c.probe && (c.probeVisible || c.probe.path)) {
      const s = c.probe.s, q0 = c.p.q0;
      const n = c.probe.name || 'P';
      out.push([c.probe.fixed || c.probe.own ? '— 观察点 ' + n + ' —' : '— 探针 P —', '', '']);
      if (c.probe.path) out.push(['路径参数 ' + c.probe.path.label, c.probe.t, c.probe.path.unit]);
      out.push(['位置 ' + n, c.probe.pos, 'L'], ['V(' + n + ')', s.V, 'kQ/L']);
      if (q0 != null && c.m.id !== 6) out.push(['U(' + n + ')=q₀V', q0 * s.V, 'kQ²/L']);
      if (c.m.id === 6) out.push(['U(P)', (c.p.useB ? c.p.q0B : c.p.q0) * s.V, 'kQ²/L']);
      out.push(['|E(' + n + ')|', V.len(s.E), 'kQ/L²'], ['E(' + n + ')', s.E, 'kQ/L²']);
      if (c.probe.path) out.push(['E∥(' + n + ')', EL.MH.Epar(c.F, c.probe.path, c.probe.t), 'kQ/L²']);
      if (!s.ok) out.push(['说明', c.m.analytic ? '该位置在奇点或界面上，场强未定义；读数取单侧极限。' : '探针位于非零源电荷的排除邻域内，电势与场强未定义。', '']);
    }
    return out;
  };
})(window.EL);
