'use strict';
// 例题模块：平台全部模型的目录与题目数据。离散模板（templates.js）之外另有三类：自主探究、解析场模型、圆盘电荷
// 题目 pb：{ id, title, model: 实验室模型 id, kind: 'tpl' | 'free' | 'field' | 'disk', pts, qs, stem?, note? }
//   tpl  ：tpl（模板名）, charges: {顶点: 系数}；长度单位 a
//   free ：srcs: [{label, p:[x,y,z], q, bind?: {bg, key}}]，bgs: [{type, w, l, h, x, y, z}]（EL.GEO.build 的参数）
//   field：sub（EL.SUB08 的键），sp: {参数}（λ、σ、q、a、ε、D、E₀ 等）
//   disk ：disk: {N, R, q, center, qc}（交给 EL.model(3).sources 与 readings 计算）
// 自主探究、解析场模型与圆盘电荷的长度单位为 L，单位制与实验室一致（k = 1）
(function (EL) {
  const V = EL.V, U = EL.U, X = EL.EX;
  const fmtP = p => '(' + p.map(x => U.fmt(x, 3)).join(', ') + ')';

  // ---- 模型编号与名称（与首页、实验室的分类和顺序一致）----
  X.TPL_MODEL = { pair: 1, tetra: 4, cube: 6, octa: 5, tri: 7, square: 7 };
  X.kindOf = pb => pb.kind || 'tpl';
  X.modelOf = pb => pb.model != null ? +pb.model : ({ free: 7, field: 8, disk: 3 })[X.kindOf(pb)] || X.TPL_MODEL[pb.tpl] || 0;
  X.LABS = {
    1: { code: '01', title: '点电荷与偶极子' }, 2: { code: '02', title: '路径与能量' },
    4: { code: '03', title: '正四面体' }, 6: { code: '04', title: '正六面体' }, 5: { code: '05', title: '正八面体' },
    7: { code: '06', title: '自主探究' }, 8: { code: '拓展 1', title: '解析场模型' }, 3: { code: '拓展 2', title: '圆盘电荷（雪花问题）' }
  };
  const GROUPS = [['一、基础模型', [1, 2]], ['二、对称模型', [4, 6, 5]], ['三、拓展与创作', [7, 8, 3]], ['四、例题与题目', []]];
  X.UNITS = { a: { E: 'kQ/a²', V: 'kQ/a', W: 'kQq/a', L: 'a' }, L: { E: 'kQ/L²', V: 'kQ/L', W: 'kQq/L', U: 'kQ²/L', L: 'L' }, none: { E: '', V: '', W: '', L: 'L' } };

  // ---- 出题目录：每个实验室模型下可选的出题对象 ----
  const alt = ls => Object.fromEntries(ls.map((n, i) => [n, i % 2 ? 1 : -1]));
  const tplItem = (model, tpl, desc) => ({ key: 'tpl:' + tpl + ':' + model, model, kind: 'tpl', name: X.TEMPLATES[tpl].name, desc: desc || X.TEMPLATES[tpl].desc, make: () => ({ tpl, charges: alt(X.geo(tpl).labels) }) });
  const defaults = sub => Object.fromEntries(EL.SUB08[sub].params.map(q => [q.key, q.val]));
  function items(id) {
    if (id === 1) return [tplItem(1, 'pair', '相距为 a 的两个点电荷 A、B，可以组成电偶极子')];
    if (id === 2) return [tplItem(2, 'pair', '相距为 a 的两个点电荷 A、B，适合出电势变化、电势比较和静电力做功的题')];
    if (id === 4) return [tplItem(4, 'tetra')];
    if (id === 6) return [tplItem(6, 'cube')];
    if (id === 5) return [tplItem(5, 'octa')];
    if (id === 7) return [{ key: 'free', model: 7, kind: 'free', name: '自由放置点电荷', desc: '最多 16 个点电荷，可添加几何背景并把电荷放在背景的特殊点上', make: () => ({ srcs: [{ label: 'Q1', p: [-1, 0, 0], q: 1 }, { label: 'Q2', p: [1, 0, 0], q: -1 }], bgs: [] }) },
      tplItem(7, 'tri', '边长为 a 的等边三角形 ABC 的三个顶点'), tplItem(7, 'square', '边长为 a 的正方形 ABCD 的四个顶点')];
    if (id === 8) return Object.keys(EL.SUB08).map(sub => ({ key: 'field:' + sub, model: 8, kind: 'field', name: EL.SUB08[sub].name, desc: EL.SUB08[sub].cat, make: () => ({ sub, sp: defaults(sub) }) }));
    if (id === 3) return [{ key: 'disk', model: 3, kind: 'disk', name: '圆盘内的同号点电荷', desc: 'N 个电荷等分圆周，或把一个电荷放在圆心', make: () => ({ disk: { N: 6, R: 2, q: 1, center: false, qc: 1 } }) }];
    return [];
  }
  X.catalog = () => GROUPS.map(([title, ids]) => ({ title, labs: ids.map(id => Object.assign({ id }, X.LABS[id], { items: items(id) })) }));
  X.itemKey = function (pb) {
    const k = X.kindOf(pb);
    return k === 'tpl' ? 'tpl:' + pb.tpl + ':' + X.modelOf(pb) : k === 'field' ? 'field:' + pb.sub : k;
  };
  X.itemOf = key => { for (const g of X.catalog()) for (const L of g.labs) for (const it of L.items) if (it.key === key) return it; return null; };
  X.firstItem = model => (items(+model)[0]) || null;
  // 按出题对象重置题目的模型数据（保留 id 与标题）
  X.applyItem = function (d, it) {
    for (const k of ['tpl', 'charges', 'srcs', 'bgs', 'sub', 'sp', 'disk']) delete d[k];
    Object.assign(d, { model: it.model, kind: it.kind }, it.make(), { pts: {}, qs: [] });
    return d;
  };
  X.modelName = function (pb) {
    const id = X.modelOf(pb), L = X.LABS[id], k = X.kindOf(pb);
    const v = k === 'tpl' ? ([4, 5, 6].includes(id) ? '' : X.TEMPLATES[pb.tpl].name) : k === 'field' ? EL.SUB08[pb.sub].name : k === 'free' ? '自由放置点电荷' : 'N = ' + pb.disk.N;
    return (L ? L.code + ' ' + L.title : '') + (v ? ' · ' + v : '');
  };
  X.valid = function (pb) {
    const k = X.kindOf(pb);
    if (k === 'tpl') return !!X.TEMPLATES[pb.tpl];
    if (k === 'free') return Array.isArray(pb.srcs);
    if (k === 'field') return !!(EL.SUB08[pb.sub] && pb.sp);
    if (k === 'disk') return !!(pb.disk && isFinite(pb.disk.N));
    return false;
  };

  // ---- 题库与按模型查找（实验室“例题探究”跳转用）----
  X.library = () => X.BUILTIN.concat(U.store.get('ex:mine', []));
  X.findByModel = (id, lib) => (lib || X.library()).find(pb => X.modelOf(pb) === +id) || null;
  // 选项字母：A、B、C、D
  X.letter = i => String.fromCharCode(65 + i);
  X.optLetter = (opts, v) => { const i = (opts || []).indexOf(v); return i < 0 ? '' : X.letter(i); };

  // ---- 圆盘电荷：直接调用实验室 03 模型（EL.model(3)）的 sources 与 readings ----
  X.diskParams = d => ({ N: d.N, R: d.R, q: d.q, phi: 0, center: !!d.center, qc: d.qc, manual: false, mx: 0, my: 0 });
  X.diskSources = d => EL.model(3).sources(X.diskParams(d)).map(s => Object.assign({}, s, { label: s.label === '中' ? 'Qc' : 'Q' + s.label }));
  X.diskEnergy = function (d) {
    const m = EL.model(3), p = X.diskParams(d), src = m.sources(p), rows = m.readings({ p, sources: src, rMin: m.rMin, hidden: { cands: [] } });
    const find = (re, i) => { const r = rows.find(x => re.test(x[0])); return r ? r[1] : rows[i][1]; };
    return { U: find(/^总相互作用能/, 0), pairs: find(/电荷对/, 1), theory: (rows.find(x => /理论值/.test(x[0])) || [0, NaN])[1], src };
  };

  // ---- 自主探究、解析场模型、圆盘电荷的几何（供 X.resolve 使用）----
  const circle = (c, r) => Array.from({ length: 97 }, (_, i) => { const a = 2 * Math.PI * i / 96; return V.add(c, [r * Math.cos(a), r * Math.sin(a), 0]); });
  X.srcPos = function (g, s) {
    if (s.bind) { const b = g.bgs[s.bind.bg], sp = b && b.special.find(x => x.key === s.bind.key); if (sp) return sp.p.slice(); }
    return s.p.slice();
  };
  X.build = function (pb) {
    const k = X.kindOf(pb), g = { kind: k, unit: 'L', v: {}, faces: [], edges: [], center: [0, 0, 0], labels: [], bgs: [], draw: { segs: [], loops: [], polys: [], balls: [] }, pb };
    if (k === 'free') {
      g.bgs = (pb.bgs || []).map(s => EL.GEO.build(s));
      for (const b of g.bgs) {
        b.edges.forEach(e => g.draw.segs.push([b.verts[e[0]], b.verts[e[1]]]));
        if (b.faces.length) b.faces.forEach(f => g.draw.polys.push(f.map(i => b.verts[i])));
        if (b.sphere) g.draw.balls.push({ c: b.sphere.c, r: b.sphere.r, role: 'geom' });
        if (b.circle) g.draw.loops.push(circle(b.circle.c, b.circle.r));
      }
      for (const s of pb.srcs || []) g.v[s.label] = X.srcPos(g, s);
    } else if (k === 'disk') {
      g.src = X.diskSources(pb.disk);
      for (const s of g.src) g.v[s.label] = s.p;
      g.draw.loops.push(circle([0, 0, 0], pb.disk.R));
    }
    g.labels = Object.keys(g.v);
    return g;
  };

  // ---- 候选关键点 ----
  const FIELD_PTS = {
    point: () => [[2, 0, 0], [1, 1, 0], [0, 0, 3], [1, 0, 0]],
    'infinite-line': p => [[2, 0, 0], [1, 0, 1], [0, 3, 0], [p.r0, 0, 0], [1, 1, 0]],
    'infinite-plane': () => [[0, 0, 1], [0, 0, 2], [0, 0, -1], [1, 0, 1]],
    'conductor-sphere': p => [[0, 0, 0], [p.a / 2, 0, 0], [2 * p.a, 0, 0], [0, 0, 3 * p.a], [2 * p.a, 2 * p.a, 0]],
    'dielectric-interface': () => [[0, 0, 1], [0, 0, -1], [1, 0, 2], [0, 0, -2]],
    'dielectric-sphere': p => [[0, 0, 0], [0, 0, p.a / 2], [0, 0, 2 * p.a], [2 * p.a, 0, 0]]
  };
  X.candidatesOf = function (g) {
    const pb = g.pb, out = [], seen = new Set(), add = (def, text) => { const k = JSON.stringify(def); if (!seen.has(k)) { seen.add(k); out.push({ def, text }); } };
    if (g.kind === 'field') {
      for (const p of FIELD_PTS[pb.sub](pb.sp)) {
        const r = EL.SUB08[pb.sub].fn(pb.sp, p), reg = /[一-龥]/.test(r.region || '') ? '，' + r.region : '';
        if (isFinite(r.V) && r.E.every(isFinite)) add({ t: 'xyz', p }, '坐标 ' + fmtP(p) + reg);
      }
      return out;
    }
    const ls = g.labels.filter(n => g.v[n]);
    if (!ls.some(n => V.len(g.v[n]) < 1e-9)) add({ t: 'center' }, '原点 O');
    for (let i = 0; i < ls.length && out.length < 12; i++) for (let j = i + 1; j < ls.length && out.length < 12; j++) {
      if (g.kind === 'disk' && j !== i + 1) continue;
      add({ t: 'mid', a: ls[i], b: ls[j] }, '线段 ' + ls[i] + ls[j] + ' 的中点');
    }
    if (g.kind === 'disk') { add({ t: 'xyz', p: [0, 0, pb.disk.R] }, '坐标 ' + fmtP([0, 0, pb.disk.R]) + '（圆心正上方）'); add({ t: 'xyz', p: [pb.disk.R / 2, 0, 0] }, '坐标 ' + fmtP([pb.disk.R / 2, 0, 0])); }
    g.bgs.forEach((b, bi) => b.special.forEach(s => add({ t: 'sp', bg: bi, key: s.key }, '背景 ' + (bi + 1) + '（' + EL.GEO.TYPES[b.type].name + '）的' + s.name)));
    return out;
  };

  // ---- 适用的问题类型 ----
  const BASE = ['E', 'Ezero', 'V', 'Vcmp', 'trend', 'W', 'angle'];
  X.qtypesFor = function (pb) {
    const k = X.kindOf(pb);
    if (k === 'disk') return ['U', 'pairs', 'Ucmp'].concat(BASE);
    if (k === 'field') return /^dielectric/.test(pb.sub) ? BASE.concat('bc') : BASE;
    return X.modelOf(pb) === 2 ? ['trend', 'W', 'Vcmp', 'V', 'E', 'Ezero', 'angle'] : BASE;
  };

  // ---- 题干 ----
  const BG_SIZE = s => {
    const L = x => U.fmt(x, 3) + ' L', T = EL.GEO.TYPES[s.type].name;
    switch (s.type) {
      case 'square': return '边长为 ' + L(s.w) + ' 的正方形（平行于 xy 平面）';
      case 'rect': return '长 ' + L(s.w) + '、宽 ' + L(s.l) + ' 的长方形（平行于 xy 平面）';
      case 'triangle': return '底边长 ' + L(s.w) + '、高 ' + L(s.l) + ' 的等腰三角形（平行于 xy 平面）';
      case 'circle': return '半径为 ' + L(s.w / 2) + ' 的圆（平行于 xy 平面）';
      case 'sphere': return '半径为 ' + L(s.w / 2) + ' 的球面';
      case 'pyramid': return '底面为 ' + L(s.w) + ' × ' + L(s.l) + ' 的长方形、高为 ' + L(s.h) + ' 的四棱锥';
      case 'prism': return '底面为 ' + L(s.w) + ' × ' + L(s.l) + ' 的长方形、高为 ' + L(s.h) + ' 的四棱柱';
    }
    return '外接球半径为 ' + L(s.w / 2) + ' 的' + T;
  };
  X.bgText = (s, i) => '背景 ' + (i + 1) + ' 是' + (s.type === 'pyramid' || s.type === 'prism' ? '底面中心' : '中心') + '在 ' + fmtP([s.x || 0, s.y || 0, s.z || 0]) + '、' + BG_SIZE(s);
  const ptsStem = (pb, R) => {
    const t = Object.keys(pb.pts || {}).map(n => {
      const def = pb.pts[n].def;
      if (def.t === 'xyz') return n + ' 点的坐标为 ' + fmtP(def.p);
      if (def.t === 'center') return n + ' 为原点';
      return n + ' 为' + R.pts[n].text;
    });
    return t.length ? t.join('，') + '。' : '';
  };
  const FIELD_STEM = {
    point: p => '在原点 O 放置电荷量为 ' + U.fmt(p.q) + ' Q 的点电荷，取无穷远处电势为零。',
    'infinite-line': p => '沿 z 轴放置一条无限长均匀带电直线，线电荷密度 λ = ' + U.fmt(p.lambda) + ' Q/L；取到 z 轴的距离为 ρ₀ = ' + U.fmt(p.r0) + ' L 处电势为零。',
    'infinite-plane': p => 'xy 平面（z = 0）是一个无限大均匀带电平面，面电荷密度 σ = ' + U.fmt(p.sigma) + ' Q/L²；取该平面的电势为零。',
    'conductor-sphere': p => '球心在原点 O、半径 a = ' + U.fmt(p.a) + ' L 的孤立导体球带电荷量 q = ' + U.fmt(p.q) + ' Q，处于静电平衡；取无穷远处电势为零。',
    'dielectric-interface': p => '平面 z = 0 把两种电介质分开：z 大于零一侧的相对介电常数 ε₁ = ' + U.fmt(p.e1) + '，z 小于零一侧的 ε₂ = ' + U.fmt(p.e2) + '。分界面上没有自由电荷，电位移垂直于分界面，z 分量 D = ' + U.fmt(p.D) + ' Q/L²；取分界面的电势为零。',
    'dielectric-sphere': p => '球心在原点 O、半径 a = ' + U.fmt(p.a) + ' L 的电介质球（相对介电常数 ε_in = ' + U.fmt(p.ein) + '）放在相对介电常数 ε_out = ' + U.fmt(p.eout) + ' 的介质中，远处是沿 z 方向、场强 E₀ = ' + U.fmt(p.E0) + ' kQ/L² 的匀强电场；取 z = 0 的平面（过球心）电势为零。'
  };
  X.stemOf = function (pb, R) {
    const k = X.kindOf(pb);
    if (k === 'field') return FIELD_STEM[pb.sub](pb.sp) + ptsStem(pb, R) + '计算时取 k = 1（即 ε₀ = 1/(4π)），ε 为相对介电常数，长度单位为 L；答案只写数值。';
    if (k === 'disk') {
      const d = pb.disk, n = d.center ? d.N - 1 : d.N;
      return '在 xy 平面内半径 R = ' + U.fmt(d.R) + ' L、圆心为原点 O 的圆盘中放置 ' + d.N + ' 个点电荷：' +
        (d.center ? '电荷量为 ' + X.qText(d.qc) + ' 的点电荷 Qc 位于圆心，其余 ' + n + ' 个' : '这 ' + n + ' 个') + '电荷量均为 ' + X.qText(d.q) + ' 的点电荷 Q1～Q' + n + ' 等分圆周，Q1 位于 x 轴正方向上。' +
        ptsStem(pb, R) + '取无穷远处电势为零。';
    }
    const by = (pb.srcs || []).filter(s => s.q).map(s => {
      const b = s.bind && R.g.bgs[s.bind.bg], sp = b && b.special.find(x => x.key === s.bind.key);
      return '在' + (sp ? '背景 ' + (s.bind.bg + 1) + ' 的' + sp.name + ' ' + fmtP(R.g.v[s.label]) + ' ' : ' ' + fmtP(R.g.v[s.label]) + ' ') + '处放置电荷量为 ' + X.qText(s.q) + ' 的点电荷 ' + s.label;
    });
    return '在空间直角坐标系 Oxyz 中（长度单位为 L），' + (pb.bgs && pb.bgs.length ? pb.bgs.map(X.bgText).join('；') + '（几何背景只作位置参照，不是导体或电介质）；' : '') +
      (by.length ? by.join('；') + '。' : '还没有放置电荷量不为零的点电荷。') + ptsStem(pb, R) + '取无穷远处电势为零。';
  };
})(window.EL);
