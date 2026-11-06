'use strict';
// 场景：探针、矢量合成、场矢量采样、动画轨迹与可拖动把手
(function (EL) {
  const V = EL.V, A = EL.App, C = EL.C;

  A.addProbe = function (c, sc) {
    const st = c.st;
    if (!c.probeVisible) return;
    const p = c.probe.pos, s = c.probe.s, R = c.bound;
    sc.spheres.push({ p, r: R * 0.016, color: C.probe });
    sc.glows.push({ p, r: R * 0.05, color: C.probe, a: 0.45, phase: 1.7 });
    sc.labels.push({ p, text: c.probe.name || 'P', cls: 'probe' });
    A.addGeoAids(c, sc);
    if (c.cs) { A.drawWizard(c, sc); return; }
    if (s.ok && !st.comp.show) sc.arrows.push({ p, v: V.mul(c.arrowVec(s.E), A.probeVecK(c)), color: C.probe, width: 2.6 });
    if (st.comp.show && c.F.parts) A.addComposition(c, sc);
  };

  // 探针矢量合成：各分场同一线性比例；共起点、首尾相接、两两合成、分组部分和、分场所在平面
  A.addComposition = function (c, sc) {
    const st = c.st, cp = st.comp, p = c.probe.pos, parts = c.F.parts(p).filter(x => x.q), R = c.bound, MH = EL.MH, out = {};
    if (!parts.length || !parts.every(x => x.E.every(isFinite))) return;
    const sum = parts.reduce((a, x) => a + V.len(x.E), 0), k = 0.3 * R / Math.max(1e-9, sum) * st.style.vecScale * 1.5 * A.probeVecK(c), S = v => V.mul(v, k);
    const show = cp.visible || parts.map(x => x.i), col = x => x.q > 0 ? C.pos : C.neg, cls = x => x.q > 0 ? 'pos' : 'neg';
    const tot = parts.reduce((a, x) => V.add(a, x.E), [0, 0, 0]);
    // 方向相同的分场强错开一点，标签交替放在箭头外侧与中部，避免重合
    const offs = EL.VA.offsets(parts.map(x => show.includes(x.i) ? x.E : [0, 0, 0]), R * 0.035);
    const lab = (q, v, text, cl, j) => (out.labels = out.labels || []).push({ p: V.addS(q, v, offs.rank[j] % 2 ? 0.55 : 1.06), text, cls: cl + ' vec', kind: 'vectors' });
    if (cp.method === 'chain') {
      let q = p;
      for (const x of parts) { if (!show.includes(x.i)) continue; MH.vec(out, q, S(x.E), col(x), 'E' + x.label, cls(x), 2); q = V.add(q, S(x.E)); }
      MH.vec(out, p, V.sub(q, p), C.sum, 'Σ（首尾相接）', 'sum', 3);
    } else parts.forEach((x, j) => { if (!show.includes(x.i)) return; const q = V.add(p, offs[j]); MH.vec(out, q, S(x.E), col(x), null, null, 2); lab(q, S(x.E), 'E' + x.label, cls(x), j); });
    const pick = cp.pick.map(i => parts.find(x => x.i === i)).filter(Boolean);
    if (pick.length === 2 && cp.method !== 'chain') {
      const a = S(pick[0].E), b = S(pick[1].E), s = V.add(a, b);
      if (cp.method === 'para') { MH.dash(out, V.add(p, a), V.add(p, s)); MH.dash(out, V.add(p, b), V.add(p, s)); }
      else MH.vec(out, V.add(p, a), b, C.guide, null, null, 1.6);
      MH.arc(out, p, a, b, R * 0.07);
      MH.vec(out, p, s, C.part, 'E' + pick[0].label + '+E' + pick[1].label, 'part', 2.6);
      if (cp.plane) {
        const n = V.cross(a, b);
        if (V.len(n) > 1e-9) {
          const u = V.norm(a), w = V.norm(V.cross(V.norm(n), u)), h = R * 0.32;
          MH.tri(out, [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => V.add(p, V.add(V.mul(u, x * h), V.mul(w, y * h)))), C.pot, 0.12);
        }
      }
    }
    // 分组部分和（例如按对称性成对合成）
    const G = gi => parts.filter(x => cp.groups[x.i] === gi);
    const g1 = G(1), g2 = G(2);
    if (g1.length && g2.length) {
      const s1 = g1.reduce((a, x) => V.add(a, x.E), [0, 0, 0]), s2 = g2.reduce((a, x) => V.add(a, x.E), [0, 0, 0]);
      MH.vec(out, p, S(s1), C.part, 'Σ₁', 'part', 2.6); MH.vec(out, p, S(s2), C.part, 'Σ₂', 'part', 2.6);
      MH.dash(out, V.add(p, S(s1)), V.add(p, S(V.add(s1, s2)))); MH.dash(out, V.add(p, S(s2)), V.add(p, S(V.add(s1, s2))));
      MH.arc(out, p, s1, s2, R * 0.1);
    }
    if (cp.total && cp.method !== 'chain') MH.vec(out, p, S(tot), C.sum, 'E 合', 'sum', 3);
    for (const key in out) sc[key] = (sc[key] || []).concat(out[key]);
  };

  // 场矢量采样（模型拓展）：长度经 |E|^(1/4) 压缩
  A.addVectors = function (c, sc) {
    const st = c.st, is2d = st.view === '2d', B = V.planeBasis(st.plane), R = c.bound, n = st.vecN || 3;
    const pts = [], m = is2d ? 2 * n - 1 : n;
    const g = i => -0.7 * R + 1.4 * R * i / Math.max(1, m - 1);
    if (is2d) for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) pts.push(V.onPlane(B, g(i), g(j), st.planePos));
    else for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) for (let k = 0; k < m; k++) pts.push([g(i), g(j), g(k)]);
    const S = pts.map(q => ({ q, s: c.F.sample(q) })).filter(o => o.s.ok);
    const w = S.map(o => { let E = o.s.E; if (is2d) E = V.addS(E, B.n, -V.dot(E, B.n)); return { o, E, m: Math.pow(V.len(E), 0.25) }; }).filter(x => x.m > 1e-6);
    if (!w.length) return;
    const med = w.map(x => x.m).sort((a, b) => a - b)[Math.floor(w.length / 2)];
    const cell = 1.4 * R / Math.max(1, m - 1);
    for (const x of w) {
      const t = Math.min(1, x.m / (2 * med)), len = cell * 0.4 * st.style.vecScale * (0.2 + 0.8 * t);
      sc.arrows.push({ p: x.o.q, v: V.mul(V.norm(x.E), len), color: C.vec, width: 2.2 });
    }
  };

  A.addTrails = function (c, sc) {
    const st = c.st;
    if (st.anim.trail && st.trail.length > 1) sc.lines.push({ pts: st.trail, color: [...C.probe, 0.85], width: 1.6, dash: [0.12, 0.08] });
    if (st.anim.eTrail) for (const t of st.eTrail) sc.arrows.push({ p: t.p, v: t.v, color: [...C.field, 0.6], width: 1.2 });
    if (st.anim.sliceTrail) for (const segs of st.sliceTrail) sc.segs.push({ segs, color: C.trail, width: 1 });
  };

  // 可拖动把手：探针、扰动点、未绑定的自定义源
  A.handles = function (c) {
    const st = c.st, hs = [], is2d = st.view === '2d', B = V.planeBasis(st.plane);
    const set = obj => { Object.assign(st.p, obj); };
    if (c.probeVisible && !c.probe.fixed) {
      const pr = c.probe;
      if (pr.path) {
        const path = pr.path;
        hs.push({ p: pr.pos, kind: 'probe', move: q => {
          let best = path.range[0], bd = Infinity;
          for (let i = 0; i <= 400; i++) { const t = path.range[0] + (path.range[1] - path.range[0]) * i / 400, d = V.dist(path.pos(t), q); if (d < bd) { bd = d; best = t; } }
          const prm = c.m.params.find(x => x.key === path.key), stp = prm ? prm.step : 0.01;
          st.p[path.key] = +(Math.round(best / stp) * stp).toFixed(4);
        } });
      } else {
        const keys = pr.free, lim = c.m.params.find(x => x.key === keys[0]);
        hs.push({ p: pr.pos, kind: 'probe', move: q => {
          if (is2d) { const d = V.dot(q, B.n) - V.dot(pr.pos, B.n); q = V.addS(q, B.n, -d); }
          keys.forEach((k, i) => { st.p[k] = +EL.U.clamp(q[i], lim.min, lim.max).toFixed(3); });
        } });
      }
    }
    if (c.m.handles) for (const h of c.m.handles(c)) hs.push({ p: h.p, plane: h.plane, kind: 'model', move: q => h.move(q, set) });
    if (c.m.editor && st.layers.charges) c.sources.forEach((s, i) => {
      const cs = st.custom && st.custom[i];
      if (cs && cs.bind) return;
      hs.push({ p: is2d ? V.addS(s.p, B.n, -(V.dot(s.p, B.n) - st.planePos)) : s.p, kind: 'source', move: q => {
        A.ensureCustom(c);
        const src = st.custom[i];
        if (!src) return;
        if (is2d) q = V.addS(q, B.n, V.dot(src.p, B.n) - V.dot(q, B.n));
        const lim = c.m.editor.xyz;
        src.p = q.map(x => +EL.U.clamp(x, -lim, lim).toFixed(2));
      } });
    });
    return hs;
  };

  // 从标准配置切换为自定义配置
  A.ensureCustom = function (c) {
    const st = c.st;
    if (st.custom) return false;
    st.custom = c.sources.map((s, i) => ({ p: s.p.slice(), q: s.q, label: s.label || 'Q' + (i + 1) }));
    EL.U.toast('已切换为自定义配置；原模型的对称性需要重新检验。');
    return true;
  };
})(window.EL);
