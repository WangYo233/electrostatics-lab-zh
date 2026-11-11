'use strict';
// 例题模块：三维画板（模型、电荷、关键点、电场线、构造对象）与示意图 SVG
(function (EL) {
  const V = EL.V, U = EL.U, X = EL.EX, MH = EL.MH, VA = EL.VA;
  const AD = 3;
  // 模型坐标 → 画板坐标：按题目的尺度（R.ext）缩放，使不同模型在画板中大小相近
  let SC = AD;
  const M = p => V.mul(p, SC);
  const W = X.W = { AD, M, layers: { geom: true, sphere: true, lines: false, flow: false, labels: true }, appearance: U.store.get('ex:appearance', {}), cache: new Map() };
  const cached = (k, f) => { if (!W.cache.has(k)) { if (W.cache.size > 40) W.cache.delete(W.cache.keys().next().value); W.cache.set(k, f()); } return W.cache.get(k); };

  W.init = function () {
    W.r = new EL.Renderer(U.$('#gl'), U.$('#labels'));
    const fx = U.store.get('ex:fx', {});
    W.r.fx.glow = fx.glow !== false;
    W.r.fx.reveal = !!fx.reveal;
    W.r.cam.reset(AD * 1.2, false);
    W.r.cam.attach(U.$('#gl'), { change: () => W.r.draw(), pick: () => null });
    new ResizeObserver(() => W.r.draw()).observe(U.$('#stage'));
    W.setTheme(U.store.get('theme', 'dark'));
  };
  W.setTheme = function (k) {
    EL.setTheme(k); U.store.set('theme', k);
    const ov = U.store.get('colors:' + EL.theme, {}); for (const c in ov) EL.C[c] = U.hex(ov[c]);
    const s = U.$('#stage'); s.dataset.theme = EL.C.lbl; s.style.background = EL.C.bgCss;
    U.$('#caption').dataset.theme = EL.C.lbl;
    s.querySelectorAll('.caption,.tools,.stagebar,.hud').forEach(e => e.classList.add('glass'));
    if (W.last) W.show(...W.last);
  };
  W.align = function (n, points) {
    const cam = W.r.cam;
    if (n === 'reset') return cam.reset(AD * 1.2, false, true);
    let d = V.norm(n);
    if (V.dot(d, V.sub(cam.eye(), cam.target)) < 0) d = V.mul(d, -1);
    cam.tween({ theta: Math.atan2(d[1], d[0]), phi: U.clamp(Math.asin(U.clamp(d[2], -1, 1)), -1.5, 1.5), ...(points ? cam.frame(points) : { target: [0, 0, 0] }) }, 700);
  };

  W.pickContext = function (x, y) {
    const sol = W.last && W.last[1];
    if (!sol) return { type: 'scene', key: 'geometry', title: '画板设置' };
    const R = sol.R, cam = W.r.cam;
    cam.matrices();
    const near = (items, limit) => items.map(o => {
      const p = cam.toScreen(M(o.p));
      return p ? { o, d: Math.hypot(p[0] - x, p[1] - y), z: p[2] } : null;
    }).filter(o => o && o.z <= 1).sort((a, b) => a.d - b.d)[0];
    const source = near(R.sources.map(s => ({ type: 'charge', key: s.label, title: s.label + ' 电荷', p: s.p, q: s.q })), 32);
    if (source && source.d <= 32) return source.o;
    const pts = Object.keys(R.pts).filter(n => R.pts[n].p && !R.pts[n].vertex && !R.sources.some(s => s.label === n)).map(n => ({ type: 'point', key: 'point:' + n, title: '探针 ' + n, p: R.pts[n].p }));
    const point = near(pts, 28);
    if (point && point.d <= 28) return point.o;
    const geom = R.g, anchors = [];
    Object.keys(geom.v || {}).forEach(n => anchors.push({ p: geom.v[n] }));
    (geom.faces || []).forEach(fc => {
      const ps = fc.map(n => geom.v[n]).filter(Boolean);
      if (ps.length) anchors.push({ p: ps.reduce((a, p) => V.add(a, p), [0, 0, 0]).map(v => v / ps.length) });
    });
    const surface = near(anchors, 42);
    return surface && surface.d <= 42 ? { type: 'geometry', key: 'geometry', title: '几何背景' } : { type: 'scene', key: 'geometry', title: '画板设置' };
  };

  // f：{kind:'plan', plan, k} | {kind:'path', a, b, s} | {kind:'terms', at:[...]} | {kind:'point', at}
  W.show = function (pb, sol, f) {
    W.last = [pb, sol, f];
    const R = sol.R, g = sol.R.g, C = EL.C, L = W.layers, geomLook = W.appearance.geometry || {}, geomColor = geomLook.color ? U.hex(geomLook.color) : C.geom, out = { lines: [], segs: [], meshes: [], spheres: [], arrows: [], labels: [], glows: [] };
    SC = AD / (R.ext || 1);
    const hide = f && f.hide, key = X.kindOf(pb) === 'tpl' ? pb.tpl : JSON.stringify([pb.bgs, pb.sub, pb.sp, pb.disk]);
    if (L.geom) {
      g.edges.forEach(([a, b]) => out.lines.push({ pts: [M(g.v[a]), M(g.v[b])], color: C.edge, width: 1.6 }));
      g.faces.forEach((fc, i) => out.meshes.push({ mesh: cached('f' + key + i, () => EL.ISO.polygon(fc.map(n => M(g.v[n])))), color: [...geomColor, geomLook.color ? 0.2 : hide ? 0.04 : 0.08] }));
      if (g.sphere && L.sphere && !hide) out.meshes.push({ mesh: cached('s' + key, () => EL.ISO.sphere(M(g.center), g.sphere * SC, 30)), color: [...C.pot, 0.1] });
      const D = g.draw;
      if (D) {
        D.segs.forEach(s => out.lines.push({ pts: s.map(M), color: C.ring, width: 1.5 }));
        D.loops.forEach(s => out.lines.push({ pts: s.map(M), color: C.ring, width: 1.5 }));
        D.polys.forEach((s, i) => out.meshes.push({ mesh: cached('p' + key + i + SC, () => EL.ISO.polygon(s.map(M))), color: [...geomColor, geomLook.color ? 0.2 : hide ? 0.04 : 0.08] }));
        D.balls.forEach((b, i) => out.meshes.push({ mesh: cached('b' + key + i + SC, () => EL.ISO.sphere(M(b.c), b.r * SC, 30)), color: [...geomColor, 0.1] }));
      }
      if (R.analytic) W.fieldGeom(pb, R, out, key);
    }
    const src = R.sources.map(s => ({ p: M(s.p), q: s.q, label: s.label }));
    if ((L.lines || L.flow) && !hide && (src.length || R.analytic)) {
      let F, lines;
      const lk = 'L' + key + JSON.stringify(src.map(s => [s.p, s.q]));
      if (R.analytic) {
        const sub = EL.SUB08[pb.sub], bd = R.ext * 1.6;
        F = EL.Phys.analyticField(x => sub.fn(pb.sp, x));
        const raw = cached(lk, () => EL.FL.seedLines(F, sub.seeds(pb.sp, bd, 18), { bound: bd, step: bd / 70, maxSteps: 500 }));
        lines = raw.map(l => l.map(M));
        F = EL.Phys.analyticField(x => sub.fn(pb.sp, V.mul(x, 1 / SC)));
      } else {
        F = EL.Phys.pointField(src, 0.15);
        lines = cached(lk, () => EL.FL.pointLines(F, { seeds: 10, bound: AD * 1.6, step: AD * 1.6 * 0.016, maxSteps: 1400 }));
      }
      if (L.lines) lines.forEach(l => {
        out.lines.push({ pts: l, color: [...C.field, 0.7], width: 1.1, reveal: W.r.fx.reveal });
        const a = EL.FL.arrowAt(l, 0.45);
        if (a && a.L > AD * 0.08) { const size = AD * 0.1; out.arrows.push({ p: V.addS(a.p, a.d, -size / 2), v: V.mul(a.d, size), color: [...C.field, 0.82], width: 1.5, head: size, reveal: W.r.fx.reveal }); }
      });
      if (L.flow) out.flow = cached('F' + lk, () => ({ lines: EL.Flow.speeds(F, lines, 'sqrt'), bound: AD * 1.6 }));
    }
    const rr = AD * 0.05;
    for (const s of src) {
      const look = W.appearance[s.label] || {}, col = look.color ? U.hex(look.color) : s.q > 0 ? C.pos : C.neg, size = look.size || 1;
      out.spheres.push({ p: s.p, r: rr * size, color: col }); if (W.r.fx.glow) out.glows.push({ p: s.p, r: rr * size * 3, color: col, a: 0.45 });
      if (L.labels) out.labels.push({ p: s.p, text: s.label + ' ' + X.qText(s.q).replace('+', '+ ').replace('−', '− '), cls: s.q > 0 ? 'pos' : 'neg' });
    }
    const focusedPts = f && f.kind === 'plan' ? new Set([f.plan.d.pn]) : f && f.kind === 'terms' ? new Set(f.at) : f && f.kind === 'path' ? new Set([f.a, f.b]) : f && f.kind === 'point' ? new Set([f.at]) : f && f.kind === 'probe' ? new Set(f.names || []) : null;
    for (const n in R.pts) {
      const P = R.pts[n];
      if (!P.p || R.sources.some(s => s.label === n)) continue;
      if (focusedPts && !focusedPts.has(n)) continue;
      if (P.vertex) { if (L.labels) out.labels.push({ p: M(P.p), text: n, cls: 'pt' }); continue; }
      const look = W.appearance['point:' + n] || {};
      MH.mark(out, M(P.p), L.labels ? n : null, look.color ? U.hex(look.color) : C.mark, AD * 0.022 * (look.size || 1));
    }
    if (f && f.kind === 'plan' && f.plan) VA.draw(f.plan, f.k, out, { MH, C, map: M, step: f.step, R: AD * 1.15 });
    if (f && f.kind === 'path') {
      const a = R.pts[f.a].p, b = R.pts[f.b].p, p = V.lerp(a, b, f.s), s = R.field(p);
      out.lines.push({ pts: [M(a), M(b)], color: C.path, width: 1.6, dash: [0.12, 0.08] });
      MH.mark(out, M(p), 'X', C.probe, AD * 0.025);
      if (s.ok) {
        const T = s.E, t = V.norm(V.sub(b, a)), k = AD * 0.4 / Math.max(1e-9, V.len(T));
        MH.vec(out, M(p), V.mul(T, k), C.sum, 'E', 'sum', 3); MH.vec(out, M(p), V.mul(t, AD * 0.3), C.path, '路径方向', 'pt', 1.6);
        if (V.len(T) > 1e-12) MH.arc(out, M(p), T, t, AD * 0.12);
      }
    }
    if (f && f.kind === 'terms') for (const n of f.at) {
      const p = R.pts[n].p;
      for (const s of R.sources) { MH.dash(out, M(p), M(s.p), C.guide); out.labels.push({ p: V.lerp(M(p), M(s.p), 0.5), text: 'r=' + VA.f4(V.dist(p, s.p)) + ' ' + R.units.L, cls: 'pt' }); }
    }
    // 解析场：在观察点画合场强（统一长度）并标出所在区域
    if (f && f.kind === 'probe') for (const p of f.pts) {
      const s = R.field(p);
      out.glows.push({ p: M(p), r: AD * 0.07, color: C.probe, a: 0.6 });
      if (s.E.every(isFinite) && V.len(s.E) > 1e-12) MH.vec(out, M(p), V.mul(V.norm(s.E), AD * 0.35), C.sum, 'E', 'sum', 3);
      if (s.region && L.labels) out.labels.push({ p: V.add(M(p), [0, 0, -AD * 0.12]), text: s.region, cls: 'pt' });
    }
    // 圆盘：电荷两两连线（总相互作用能的各项）
    if (f && f.kind === 'pairs') {
      const S = R.sources;
      for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) out.lines.push({ pts: [M(S[i].p), M(S[j].p)], color: [...C.energy, 0.55], width: 1.2, dash: [0.1, 0.07] });
    }
    if (f && f.kind === 'point') { const P = R.pts[f.at]; if (P && P.p) out.glows.push({ p: M(P.p), r: AD * 0.08, color: C.probe, a: 0.6 }); }
    W.r.setScene(out);
  };
  // 解析场模型的几何：点电荷、z 轴上的线电荷、z=0 平面、球
  W.fieldGeom = function (pb, R, out, key) {
    const C = EL.C, sp = pb.sp, r = R.ext * 1.3, g = EL.SUB08[pb.sub].geom, op = 0.12;
    if (g === 'point') out.spheres.push({ p: [0, 0, 0], r: AD * 0.05, color: sp.q >= 0 ? C.pos : C.neg });
    if (g === 'line') out.lines.push({ pts: [M([0, 0, -r]), M([0, 0, r])], color: sp.lambda >= 0 ? C.pos : C.neg, width: 4 });
    if (g === 'plane') out.meshes.push({ mesh: cached('pl' + key, () => EL.ISO.polygon([[-r, -r, 0], [r, -r, 0], [r, r, 0], [-r, r, 0]].map(M))), color: [...(pb.sub === 'infinite-plane' ? (sp.sigma >= 0 ? C.pos : C.neg) : (W.appearance.geometry && W.appearance.geometry.color ? U.hex(W.appearance.geometry.color) : C.geom)), op] });
    if (g === 'sphere') out.meshes.push({ mesh: cached('sp' + key, () => EL.ISO.sphere([0, 0, 0], sp.a * SC, 30)), color: [...(pb.sub === 'conductor-sphere' ? C.conductor : C.pot), 0.16] });
    const axes = [[[-r, 0, 0], [r, 0, 0], 'x'], [[0, -r, 0], [0, r, 0], 'y'], [[0, 0, -r], [0, 0, r], 'z']];
    axes.forEach(([a, b, n]) => { out.lines.push({ pts: [M(a), M(b)], color: C.axis, width: 1 }); if (W.layers.labels) out.labels.push({ p: M(b), text: n, cls: 'pt' }); });
  };

  // 打印用示意图（浅色）
  X.svg = function (pb, R) {
    const g = R.g, th = -0.95, ph = 0.42, e = [Math.cos(ph) * Math.cos(th), Math.cos(ph) * Math.sin(th), Math.sin(ph)];
    const z = V.norm(e), x = V.norm(V.cross([0, 0, 1], z)), y = V.cross(z, x), Pj = p => g.flat ? [p[0], p[1]] : [V.dot(p, x), V.dot(p, y)];
    const D = g.draw || { segs: [], loops: [], polys: [], balls: [] }, sc = R.ext * 1.2;
    const extra = R.analytic ? [[sc, 0, 0], [-sc, 0, 0], [0, 0, sc], [0, 0, -sc]] : [];
    const all = Object.values(R.pts).filter(q => q.p).map(q => Pj(q.p)).concat(D.loops.flat().concat(D.segs.flat(), extra).map(Pj)), xs = all.map(q => q[0]), ys = all.map(q => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), sp = Math.max(x1 - x0, y1 - y0, 0.5), Wd = 320, Ht = 240, s = Math.min(Wd, Ht) * 0.72 / sp;
    const S = p => { const q = Pj(p); return [((q[0] - (x0 + x1) / 2) * s + Wd / 2).toFixed(1), (Ht / 2 - (q[1] - (y0 + y1) / 2) * s).toFixed(1)]; };
    const ln = (a, b, c, w, d) => { const p = S(a), q = S(b); return '<line x1="' + p[0] + '" y1="' + p[1] + '" x2="' + q[0] + '" y2="' + q[1] + '" stroke="' + c + '" stroke-width="' + w + '"' + (d ? ' stroke-dasharray="4 3"' : '') + '/>'; };
    let o = '';
    g.edges.forEach(([a, b]) => { o += ln(g.v[a], g.v[b], '#7A8799', 1.4); });
    D.segs.forEach(q => { o += ln(q[0], q[1], '#7A8799', 1.4); });
    D.loops.forEach(L => { o += '<polyline fill="none" stroke="#7A8799" stroke-width="1.4" points="' + L.map(p => S(p).join(',')).join(' ') + '"/>'; });
    if (R.analytic) {
      const ge = EL.SUB08[pb.sub].geom;
      [['x', [sc, 0, 0]], ['y', [0, sc, 0]], ['z', [0, 0, sc]]].forEach(([n, p]) => { o += ln(V.mul(p, -1), p, '#9AA6B2', 1, true); const q = S(p); o += '<text x="' + (+q[0] + 4) + '" y="' + q[1] + '" font-size="12" fill="#6a7a90">' + n + '</text>'; });
      if (ge === 'line') o += ln([0, 0, -sc], [0, 0, sc], pb.sp.lambda >= 0 ? '#D55E00' : '#0072B2', 3);
      if (ge === 'point') { const q = S([0, 0, 0]); o += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="6" fill="' + (pb.sp.q >= 0 ? '#D55E00' : '#0072B2') + '"/>'; }
      if (ge === 'plane') o += '<polygon fill="#7A8799" fill-opacity=".15" stroke="#7A8799" points="' + [[-sc, -sc, 0], [sc, -sc, 0], [sc, sc, 0], [-sc, sc, 0]].map(p => S(p).join(',')).join(' ') + '"/>';
      if (ge === 'sphere') { const q = S([0, 0, 0]); o += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + (pb.sp.a * s).toFixed(1) + '" fill="#3FC1A4" fill-opacity=".12" stroke="#7A8799"/>'; }
    }
    const qOf = n => { const S0 = R.sources.find(x => x.label === n); return S0 ? S0.q : 0; };
    for (const n in R.pts) {
      const P = R.pts[n]; if (!P.p) continue;
      const q = S(P.p), c = qOf(n);
      o += c ? '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="6" fill="' + (c > 0 ? '#D55E00' : '#0072B2') + '"/>' : '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="2.8" fill="#142033"/>';
      o += '<text x="' + (+q[0] + 8) + '" y="' + (+q[1] - 6) + '" font-size="13" fill="#142033">' + U.esc(n + (c ? '(' + X.qText(c) + ')' : '')) + '</text>';
    }
    return '<svg viewBox="0 0 ' + Wd + ' ' + Ht + '" width="320" font-family="Times New Roman,Microsoft YaHei">' + o + '</svg>';
  };
})(window.EL);
