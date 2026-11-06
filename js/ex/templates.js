'use strict';
// 例题模块：几何模板（边长 a=1 的单位模型）、点的定义与解析
(function (EL) {
  const V = EL.V, X = EL.EX = EL.EX || {};
  const s3 = Math.sqrt(3), s6 = Math.sqrt(6);
  const avg = ps => V.mul(ps.reduce((s, p) => V.add(s, p), [0, 0, 0]), 1 / ps.length);
  const edgesOf = faces => { const m = new Map(); faces.forEach(f => f.forEach((a, i) => { const b = f[(i + 1) % f.length], k = [a, b].sort().join(''); if (!m.has(k)) m.set(k, [a, b].sort()); })); return [...m.values()]; };

  // 正四面体：面 BCD 水平，A 在上；内切球心在原点
  function tetra() {
    const h = s6 / 3, R = 1 / s3, z0 = -h / 4, at = a => [R * Math.cos(a), R * Math.sin(a), z0];
    const v = { A: [0, 0, h + z0], B: at(-Math.PI / 2), C: at(Math.PI / 6), D: at(5 * Math.PI / 6) };
    return { v, faces: [['A', 'B', 'C'], ['A', 'C', 'D'], ['A', 'D', 'B'], ['B', 'C', 'D']], sphere: h / 4, center: [0, 0, 0], faceNote: '（内切球与该面的切点）' };
  }
  function cube() {
    const H = 0.5, v = { A: [-H, -H, -H], B: [H, -H, -H], C: [H, H, -H], D: [-H, H, -H], 'A′': [-H, -H, H], 'B′': [H, -H, H], 'C′': [H, H, H], 'D′': [-H, H, H] };
    return { v, faces: [['A', 'B', 'C', 'D'], ['A′', 'B′', 'C′', 'D′'], ['A', 'B', 'B′', 'A′'], ['B', 'C', 'C′', 'B′'], ['C', 'D', 'D′', 'C′'], ['D', 'A', 'A′', 'D′']], center: [0, 0, 0] };
  }
  function octa() {
    const r = 1 / Math.SQRT2, v = { A: [r, 0, 0], B: [0, r, 0], C: [-r, 0, 0], D: [0, -r, 0], E: [0, 0, r], F: [0, 0, -r] };
    const fs = []; for (const t of ['E', 'F']) for (const [a, b] of [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A']]) fs.push([t, a, b]);
    return { v, faces: fs, sphere: 1 / s6, center: [0, 0, 0], faceNote: '（内切球与该面的切点）' };
  }
  function tri() { const R = 1 / s3, at = a => [R * Math.cos(a), R * Math.sin(a), 0]; return { v: { A: at(Math.PI / 2), B: at(Math.PI / 2 + 2 * Math.PI / 3), C: at(Math.PI / 2 + 4 * Math.PI / 3) }, faces: [['A', 'B', 'C']], center: [0, 0, 0], flat: true }; }
  function square() { const H = 0.5; return { v: { A: [-H, -H, 0], B: [H, -H, 0], C: [H, H, 0], D: [-H, H, 0] }, faces: [['A', 'B', 'C', 'D']], center: [0, 0, 0], flat: true }; }
  function pair() { return { v: { A: [-0.5, 0, 0], B: [0.5, 0, 0] }, faces: [], edges: [['A', 'B']], center: [0, 0, 0] }; }
  X.TEMPLATES = {
    tetra: { name: '正四面体', make: tetra, desc: '棱长为 a 的正四面体 ABCD' },
    cube: { name: '正方体', make: cube, desc: '棱长为 a 的正方体 ABCD-A′B′C′D′' },
    octa: { name: '正八面体', make: octa, desc: '棱长为 a 的正八面体（E、F 为上下顶点）' },
    tri: { name: '等边三角形', make: tri, desc: '边长为 a 的等边三角形 ABC' },
    square: { name: '正方形', make: square, desc: '边长为 a 的正方形 ABCD' },
    pair: { name: '两个点电荷', make: pair, desc: '相距为 a 的两点 A、B' }
  };
  X.geo = function (tid) {
    const g = X.TEMPLATES[tid].make();
    g.edges = g.edges || edgesOf(g.faces);
    g.labels = Object.keys(g.v);
    return g;
  };
  // 点的定义 → 坐标与文字。def: {t:'v',a} | {t:'mid',a,b} | {t:'face',f:[..]} | {t:'center'} | {t:'div',a,b,k} | {t:'xyz',p}
  // 自主探究另有 {t:'sp', bg, key}：第 bg 个几何背景的特殊点（EL.GEO.special）。引用的点不存在时返回 null
  X.pointPos = function (g, def, pts) {
    const P = n => g.v[n] || (pts && pts[n] && X.pointPos(g, pts[n].def, pts));
    const two = (a, b, k) => { const p = P(a), q = P(b); return p && q ? V.lerp(p, q, k) : null; };
    switch (def.t) {
      case 'v': return g.v[def.a] || null;
      case 'mid': return two(def.a, def.b, 0.5);
      case 'face': { const ps = def.f.map(P); return ps.every(Boolean) ? avg(ps) : null; }
      case 'center': return g.center.slice();
      case 'div': return two(def.a, def.b, def.k);
      case 'xyz': return def.p.slice();
      case 'sp': { const b = g.bgs && g.bgs[def.bg], s = b && b.special.find(x => x.key === def.key); return s ? s.p.slice() : null; }
    }
    return [0, 0, 0];
  };
  X.pointText = function (g, def) {
    const u = g.unit || 'a';
    switch (def.t) {
      case 'v': return '顶点 ' + def.a;
      case 'mid': return '线段 ' + def.a + def.b + ' 的中点';
      case 'face': return (g.flat ? (def.f.length === 3 ? '三角形 ' : '正方形 ') : '面 ') + def.f.join('') + ' 的中心' + (g.faceNote || '');
      case 'center': return g.kind && g.kind !== 'tpl' ? '原点 O' : '模型的中心';
      case 'div': return '线段 ' + def.a + def.b + ' 上满足 ' + def.a + 'X : ' + def.a + def.b + ' = ' + EL.U.fmt(def.k, 3) + ' 的点';
      case 'xyz': return '坐标 (' + def.p.map(x => EL.U.fmt(x, 3)).join(', ') + ')·' + u + ' 处';
      case 'sp': { const b = g.bgs && g.bgs[def.bg], s = b && b.special.find(x => x.key === def.key); return s ? '背景 ' + (def.bg + 1) + '（' + EL.GEO.TYPES[b.type].name + '）的' + s.name : '已删除的背景特殊点'; }
    }
    return '';
  };
  // 候选关键点：棱中点、面中心、中心（其他模型由 models.js 的 X.candidatesOf 给出）
  X.candidates = function (g) {
    if (g.kind && g.kind !== 'tpl') return X.candidatesOf(g);
    const out = [];
    g.edges.forEach(([a, b]) => out.push({ def: { t: 'mid', a, b }, text: a + b + ' 的中点' }));
    g.faces.forEach(f => { if (f.length >= 3 && !g.flat) out.push({ def: { t: 'face', f }, text: '面 ' + f.join('') + ' 的中心' }); });
    if (g.faces.length && g.flat) out.push({ def: { t: 'face', f: g.faces[0] }, text: '模型的中心' });
    else out.push({ def: { t: 'center' }, text: '模型的中心' });
    return out;
  };
  // 电荷量文字：1 → Q，-1 → −Q，2 → 2Q，0.5 → Q/2
  X.qText = function (q, unit) {
    unit = unit || 'Q';
    const s = q < 0 ? '−' : '+', a = Math.abs(q);
    for (let d = 1; d <= 12; d++) {
      const n = Math.round(a * d);
      if (n && Math.abs(n / d - a) < 1e-9) return s + (n === 1 ? '' : n) + unit + (d === 1 ? '' : '/' + d);
    }
    return s + EL.U.fmt(a, 3) + unit;
  };
})(window.EL);
