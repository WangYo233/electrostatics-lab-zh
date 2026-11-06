'use strict';
// 由计算上下文组装渲染场景
(function (EL) {
  const V = EL.V, A = EL.App, C = EL.C, U = EL.U;
  const levelColor = (L, a) => { const c = L > 1e-12 ? C.pos : L < -1e-12 ? C.neg : C.zero; return [c[0], c[1], c[2], a == null ? 1 : a]; };
  A.levelColor = levelColor;

  A.lines = function (c) {
    const st = c.st, is2d = st.view === '2d', B = is2d ? V.planeBasis(st.plane) : null;
    const o = { seeds: st.seeds, bound: c.bound, step: c.bound * (st.quality === 'fine' ? 0.009 : 0.016), maxSteps: 1400, B, planePos: st.planePos };
    const key = ['L', c.m.id, st.sub, JSON.stringify(c.sources.map(s => [s.p, s.q])), JSON.stringify(c.subP || ''), st.seeds, c.bound, st.quality, is2d && st.plane, is2d && st.planePos].join('|');
    A.linesKey = key;
    return A.cached(key, () => {
      if (!c.m.analytic) return EL.FL.pointLines(c.F, o);
      const sub = c.m.subs[c.sub];
      let seeds;
      if (is2d) seeds = Array.from({ length: st.seeds }, (_, i) => { const a = 2 * Math.PI * (i + 0.5) / st.seeds; return V.onPlane(B, 0.7 * c.bound * Math.cos(a), 0.7 * c.bound * Math.sin(a), st.planePos); });
      else seeds = sub.seeds(c.subP, c.bound, st.seeds);
      return EL.FL.seedLines(c.F, seeds, Object.assign(o, { step: c.bound / 70, maxSteps: 500 }));
    });
  };

  // 等势结构的计算域：取足以容纳最外层闭合等势面的立方体（以源的分布和 Σ|q|/|V| 估计），
  // 使等势线、等势面完整显示；零电势面等无界曲面在计算域边界截断，并显示边界立方体
  A.isoDomain = function (c) {
    if (c.m.analytic) return c.bound;
    const nz = c.sources.filter(s => s.q), lv = c.levels.filter(v => Math.abs(v) > 1e-9);
    if (!nz.length) return c.bound;
    const ext = Math.max(...nz.map(s => Math.max(...s.p.map(Math.abs))));
    const Q = nz.reduce((a, s) => a + Math.abs(s.q), 0), Lmin = lv.length ? Math.min(...lv.map(Math.abs)) : Infinity;
    const need = ext + (isFinite(Lmin) ? Q / Lmin : 0) * 1.08 + 0.6;
    return Math.min(Math.max(c.bound, need), Math.max(3 * c.bound, 18));
  };
  const keepFn = c => c.m.analytic ? null : (q => !c.sources.some(s => s.q && V.dist(q, s.p) <= c.rMin));

  A.contours = function (c, res) {
    const st = c.st, B = V.planeBasis(st.plane), lv = st.anim.on ? c.levels.slice(0, Math.max(1, Math.min(2, c.levels.length))) : c.levels, half = A.isoDomain(c);
    const key = ['C', c.m.id, st.sub, JSON.stringify(c.sources.map(s => [s.p, s.q])), JSON.stringify(c.subP || ''), lv.join(','), st.plane, st.planePos, half, res].join('|');
    const r = Math.round(EL.U.clamp(res * half / c.bound, res, res * 2));
    return A.cached(key, () => Object.assign(EL.ISO.contours(q => c.F.Vs(q), B, st.planePos, half, r, lv, keepFn(c)), { half }));
  };

  // 三维等势面：单源与解析模型用精确曲面；多源用 marching tetrahedra，顶点投影到真实等势面、逐顶点法向（光滑）
  A.surfKey = c => ['S', c.m.id, c.sub, JSON.stringify(c.sources.map(s => [s.p, s.q])), JSON.stringify(c.subP || ''), c.levels.join(','), c.bound, c.st.quality].join('|');
  A.surfaces = function (c, done) {
    const key = A.surfKey(c);
    if (A.cache.has(key)) return A.cache.get(key);
    const R = c.bound;
    if (c.m.analytic) {
      const sub = c.m.subs[c.sub], out = [];
      out.half = R;
      for (const L of c.levels) {
        const s = sub.surf(c.subP, L);
        if (!s) continue;
        if (s.sphere) { out.push({ level: L, mesh: EL.ISO.sphere([0, 0, 0], s.sphere, 40) }); out.half = Math.max(out.half, s.sphere * 1.05); }
        if (s.cyl) { out.push({ level: L, mesh: EL.ISO.cylinder(s.cyl, -R, R, 80) }); out.clipped = true; }
        if (s.planes) { const z = s.planes; out.clipped = true; for (const zz of [z, -z]) if (z <= R) out.push({ level: L, mesh: EL.ISO.polygon([[-R, -R, zz], [R, -R, zz], [R, R, zz], [-R, R, zz]]) }); }
      }
      A.cache.set(key, out);
      return out;
    }
    const nz = c.sources.filter(s => s.q);
    if (nz.length === 1) {
      const s = nz[0], out = [];
      out.half = R;
      for (const L of c.levels) { const r = s.q / L; if (r > c.rMin) { out.push({ level: L, mesh: EL.ISO.sphere(s.p, r, 44), exact: true }); out.half = Math.max(out.half, Math.max(...s.p.map(Math.abs)) + r * 1.05); } }
      A.cache.set(key, out);
      return out;
    }
    if (A.surfPending === key) return null;
    A.surfPending = key;
    A.busy(true, '正在计算等势面…');
    setTimeout(() => {
      const half = A.isoDomain(c), base = c.st.quality === 'fine' ? 64 : 40;
      const res = Math.round(EL.U.clamp(base * Math.sqrt(half / R), base, base * 1.5));
      const ms = EL.ISO.surfaces(q => c.F.Vs(q), [0, 0, 0], half, res, c.levels, { grad: c.F.gradVs, keep: keepFn(c) });
      const meshes = ms.filter(m => m.count).map(m => ({ level: m.level, mesh: m }));
      meshes.half = half; meshes.clipped = ms.some(m => m.clipped);
      A.cache.set(key, meshes);
      if (A.surfPending === key) A.surfPending = null;
      A.busy(false);
      done && done();
    }, 30);
    return null;
  };
  // 边界立方体（截面上为边界正方形）
  A.boxLines = function (half, color, plane) {
    if (plane) {
      const q = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([a, b]) => V.onPlane(plane.B, a * half, b * half, plane.pos));
      return [{ pts: q, color, width: 1.2, dash: [half * 0.03, half * 0.02] }];
    }
    const k = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(v => V.mul(v, half));
    return [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].map(e => ({ pts: [k[e[0]], k[e[1]]], color, width: 1.2, dash: [half * 0.03, half * 0.02] }));
  };

  A.buildScene = function (c, onAsync) {
    const st = c.st, sty = st.style, is2d = st.view === '2d', B = V.planeBasis(st.plane), R = c.bound;
    const sc = { lines: [], segs: [], meshes: [], spheres: [], arrows: [], labels: [], glows: [], headSize: R * 0.042 };
    const push = o => { for (const k in o) if (o[k]) sc[k] = (sc[k] || []).concat(o[k]); };
    // 坐标轴（中性色 + 字母标注，不用红绿区分）与网格
    const hide = c.hide || new Set();
    if (sty.axes && !hide.has('axes')) {
      for (const [d, n] of [[[1, 0, 0], 'x'], [[0, 1, 0], 'y'], [[0, 0, 1], 'z']]) {
        if (is2d && Math.abs(V.dot(d, B.n)) > 0.5) continue;
        const o = is2d ? V.mul(B.n, st.planePos) : [0, 0, 0];
        sc.lines.push({ pts: [V.addS(o, d, -R), V.addS(o, d, R)], color: C.axis, width: 1 });
        sc.arrows.push({ p: V.addS(o, d, R * 0.94), v: V.mul(d, R * 0.06), color: C.axis, width: 1 });
        sc.labels.push({ p: V.addS(o, d, R * 1.03), text: n, cls: 'axis' });
      }
    }
    if (sty.grid && !hide.has('grid')) {
      const minor = [], major = [], n = Math.ceil(R), plane = is2d ? B : V.planeBasis('xy'), pp = is2d ? st.planePos : 0, stp = R > 12 ? 2 : 1;
      for (let i = -n; i <= n; i += stp) {
        const t = Math.abs(i) % (stp * 5) === 0 ? major : minor;
        t.push([V.onPlane(plane, i, -R, pp), V.onPlane(plane, i, R, pp)], [V.onPlane(plane, -R, i, pp), V.onPlane(plane, R, i, pp)]);
      }
      sc.segs.push({ segs: minor, color: C.grid, width: 1 }, { segs: major, color: C.gridMajor, width: 1 });
    }
    // 模型几何与附加元素
    if (c.m.extra) push(c.m.extra(c));
    // 电场线与流动粒子是两个独立的图层：流动粒子沿同一组场线运动，可以在不显示场线时单独显示
    const showLines = st.layers.lines && !hide.has('lines'), showFlow = st.layers.flow && !hide.has('flow');
    if (showLines || showFlow) {
      const lines = A.lines(c), w = sty.lineWidth;
      if (showLines) for (const L of lines) {
        sc.lines.push({ pts: L, color: [...C.field, 0.78], width: w, reveal: true });
        const a = EL.FL.arrowAt(L, 0.45);
        if (a && a.L > R * 0.08) { const h = Math.min(0.34, R * 0.045); sc.arrows.push({ p: V.addS(a.p, a.d, -h / 2), v: V.mul(a.d, h), color: C.field, width: w, head: h, reveal: true }); }
      }
      const fm = (A.r && A.r.fx.map) || 'sqrt';
      if (showFlow && !st.anim.on && !A.dragging) sc.flow = A.cached('F' + fm + A.linesKey, () => ({ lines: EL.Flow.speeds(c.F, lines, fm), bound: R }));
    }
    // 截面等势线（标注层值，正负另有 +/− 文字）与半透明截面
    if (st.layers.contours && !hide.has('contours')) {
      const res = st.anim.on ? 48 : st.quality === 'fine' ? 180 : 110, cg = A.contours(c, res), H = cg.half || R;
      for (const g of cg) {
        sc.segs.push({ segs: g.segs, color: levelColor(g.level, 0.95), width: sty.lineWidth + 0.7 });
        if (st.anim.on || !g.segs.length || !st.labels.levels) continue;
        let best = null, bs = -Infinity;
        for (const s of g.segs) { const m = V.lerp(s[0], s[1], 0.5), sc2 = V.dot(m, B.u) + 0.6 * V.dot(m, B.v); if (sc2 > bs && Math.abs(V.dot(m, B.u)) < H * 0.9 && Math.abs(V.dot(m, B.v)) < H * 0.9) { bs = sc2; best = m; } }
        if (best) sc.labels.push({ p: best, text: (g.level > 0 ? '+' : g.level < 0 ? '−' : '') + U.fmt(Math.abs(g.level), 3), cls: 'lv ' + (g.level > 1e-12 ? 'pos' : g.level < -1e-12 ? 'neg' : 'zero') });
      }
      // 截面范围：等势线被截断时画出边界正方形
      if (cg.some(g => g.clipped) || H > R * 1.01) sc.lines.push(...A.boxLines(H, C.frame, { B, pos: st.planePos }));
      if (!is2d) {
        const q = [[-H, -H], [H, -H], [H, H], [-H, H]].map(([a, b]) => V.onPlane(B, a, b, st.planePos));
        sc.meshes.push({ mesh: A.cached('plane' + st.plane + st.planePos + H, () => EL.ISO.polygon(q)), color: C.plane, lit: false });
      }
      c.viewHalf = Math.max(c.viewHalf || R, H);
    }
    // 等势面（仅三维）：完整显示；无界曲面在计算域边界截断，并显示边界立方体
    if (st.layers.surfaces && !is2d && !st.anim.on && !hide.has('surfaces')) {
      const surf = A.surfaces(c, onAsync);
      if (surf) {
        for (const s of surf) {
          sc.meshes.push({ mesh: s.mesh, color: levelColor(s.level, sty.surfOpacity) });
          if (st.layers.surfLabels && s.mesh.count) {
            const i = Math.floor(s.mesh.count / 2) * 3;
            sc.labels.push({ p: [s.mesh.pos[i], s.mesh.pos[i + 1], s.mesh.pos[i + 2]], text: 'V = ' + (+s.level.toPrecision(4)) + ' kQ/L', cls: 'lv' });
          }
        }
        if (surf.clipped) sc.lines.push(...A.boxLines(surf.half, C.frame));
        c.viewHalf = Math.max(c.viewHalf || R, surf.half || R);
        c.surfClipped = !!surf.clipped;
      }
    }
    A.addCharges(c, sc);
    A.addProbe(c, sc);
    if (st.layers.vectors) A.addVectors(c, sc);
    A.addTrails(c, sc);
    // 用户标注点
    for (const nt of st.notes) { sc.spheres.push({ p: nt.p, r: R * 0.012, color: C.ang }); sc.labels.push({ p: nt.p, text: '◆ ' + nt.text, cls: 'note', kind: 'note' }); }
    // 标注筛选
    const lb = st.labels, kindOf = l => l.kind || (/\b(pos|neg|zero)\b/.test(l.cls) && !/\blv\b/.test(l.cls) && !/\b(vec|part|sum)\b/.test(l.cls) ? 'charges' : /\blv\b/.test(l.cls) ? 'levels' : /\baxis\b/.test(l.cls) ? 'axes' : /\b(part|sum|vec)\b/.test(l.cls) ? 'vectors' : /\bang\b/.test(l.cls) ? 'angles' : /\bpt\b/.test(l.cls) ? 'points' : 'other');
    sc.labels = sc.labels.filter(l => { const k = kindOf(l); return k === 'other' || k === 'note' || lb[k] !== false; });
    return sc;
  };

  A.addCharges = function (c, sc) {
    const st = c.st, is2d = st.view === '2d', B = V.planeBasis(st.plane), sty = st.style;
    if (!st.layers.charges) return;
    const r = c.bound * 0.011 * sty.chargeSize;
    for (const s of c.sources) {
      let p = s.p, off = false;
      if (is2d) { const d = V.dot(p, B.n) - st.planePos; off = Math.abs(d) > 1e-6; p = V.addS(p, B.n, -d); }
      const base = s.q > 0 ? C.pos : s.q < 0 ? C.neg : C.zeroSrc;
      const col = off ? V.lerp(base, C.bg, 0.45) : base;
      sc.spheres.push({ p, r: s.q ? r : r * 0.6, color: [...col, sty.chargeOpacity] });
      if (s.q) sc.glows.push({ p, r: r * (2.6 + 0.5 * Math.min(2, Math.abs(s.q))), color: base, a: off ? 0.25 : 0.5, phase: s.i || 0 });
      sc.labels.push({ p, text: (s.label || '') + (s.q ? ' ' + (s.q > 0 ? '+' : '−') : ' (0)') + (off ? '（投影）' : ''), cls: s.q > 0 ? 'pos' : s.q < 0 ? 'neg' : 'zero' });
    }
  };
})(window.EL);
