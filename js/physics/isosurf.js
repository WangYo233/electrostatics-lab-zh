'use strict';
// 截面等势线（marching squares）与三维等势面（marching tetrahedra）
(function (EL) {
  const V = EL.V;
  const ISO = {};

  // 在截面 B（法向位置 pos）上提取 levels 的等值线，返回 [{level, segs:[[p,q],...]}]
  ISO.contours = function (f, B, pos, half, res, levels, keep) {
    const r = ISO.contours0(f, B, pos, half, res, levels);
    if (keep) r.forEach(g => { g.segs = g.segs.filter(s => keep(s[0]) && keep(s[1])); });
    const edge = half * (1 - 1.2 / res);
    r.forEach(g => { g.clipped = g.segs.some(s => s.some(q => Math.abs(V.dot(q, B.u)) > edge || Math.abs(V.dot(q, B.v)) > edge)); });
    return r;
  };
  ISO.contours0 = function (f, B, pos, half, res, levels) {
    const n = res, h = 2 * half / n, N1 = n + 1;
    const g = new Float64Array(N1 * N1);
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) g[j * N1 + i] = f(V.onPlane(B, -half + i * h, -half + j * h, pos));
    const P = (a, b) => V.onPlane(B, a, b, pos);
    return levels.map(L => {
      const segs = [];
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const v0 = g[j * N1 + i], v1 = g[j * N1 + i + 1], v2 = g[(j + 1) * N1 + i + 1], v3 = g[(j + 1) * N1 + i];
        if (!(isFinite(v0) && isFinite(v1) && isFinite(v2) && isFinite(v3))) continue;
        const c = (v0 > L ? 1 : 0) | (v1 > L ? 2 : 0) | (v2 > L ? 4 : 0) | (v3 > L ? 8 : 0);
        if (c === 0 || c === 15) continue;
        const x0 = -half + i * h, y0 = -half + j * h;
        const e = [
          () => P(x0 + h * (L - v0) / (v1 - v0), y0),
          () => P(x0 + h, y0 + h * (L - v1) / (v2 - v1)),
          () => P(x0 + h * (L - v3) / (v2 - v3), y0 + h),
          () => P(x0, y0 + h * (L - v0) / (v3 - v0))
        ];
        const add = (a, b) => segs.push([e[a](), e[b]()]);
        const mid = (v0 + v1 + v2 + v3) / 4 > L;
        switch (c) {
          case 1: case 14: add(3, 0); break;
          case 2: case 13: add(0, 1); break;
          case 3: case 12: add(3, 1); break;
          case 4: case 11: add(1, 2); break;
          case 6: case 9: add(0, 2); break;
          case 7: case 8: add(3, 2); break;
          case 5: if (mid) { add(3, 2); add(0, 1); } else { add(3, 0); add(1, 2); } break;
          case 10: if (mid) { add(3, 0); add(1, 2); } else { add(3, 2); add(0, 1); } break;
        }
      }
      return { level: L, segs };
    });
  };

  // 立方体剖分为 6 个四面体（沿主对角线 0–6）
  const CUBE = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const TETS = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];

  // 采样 f 于 [-half,half]^3（中心 c），提取各层等势面；返回 [{level, pos:Float32Array, nrm:Float32Array, count, clipped}]
  // o.grad(p)：∇f 的解析值。顶点沿梯度做一步牛顿投影到真实等势面上，并用该点的梯度作逐顶点法向，
  // 因而曲面光滑（不是一块块平面拼接）。o.keep(p)：剔除排除邻域内的面片。
  ISO.surfaces = function (f, c, half, res, levels, o) {
    o = o || {};
    const n = res, N1 = n + 1, h = 2 * half / n, g = new Float64Array(N1 * N1 * N1);
    const X = i => c[0] - half + i * h, Y = j => c[1] - half + j * h, Z = k => c[2] - half + k * h;
    for (let k = 0; k <= n; k++) for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) g[(k * N1 + j) * N1 + i] = f([X(i), Y(j), Z(k)]);
    const grad = o.grad || (p => {
      const e = h * 0.25;
      return [(f([p[0] + e, p[1], p[2]]) - f([p[0] - e, p[1], p[2]])) / (2 * e), (f([p[0], p[1] + e, p[2]]) - f([p[0], p[1] - e, p[2]])) / (2 * e), (f([p[0], p[1], p[2] + e]) - f([p[0], p[1], p[2] - e])) / (2 * e)];
    });
    const edge = half - h * 0.51, inBox = p => Math.abs(p[0] - c[0]) <= half && Math.abs(p[1] - c[1]) <= half && Math.abs(p[2] - c[2]) <= half;
    return levels.map(L => {
      const pos = [], nrm = [];
      const cp = new Array(8), cv = new Array(8), memo = new Map();
      let clipped = false;
      // 顶点投影与法向（同一位置只算一次）
      const fix = p => {
        const key = p[0].toFixed(5) + ',' + p[1].toFixed(5) + ',' + p[2].toFixed(5);
        let r = memo.get(key);
        if (r) return r;
        let q = p, gr = grad(q);
        const g2 = V.dot(gr, gr);
        if (g2 > 1e-18) {
          const d = (f(q) - L) / g2, step = V.mul(gr, -d);
          if (V.len(step) < h * 0.5) { const q2 = V.add(q, step); if (inBox(q2)) { q = q2; gr = grad(q); } }
        }
        r = { p: q, n: V.len(gr) > 0 ? V.mul(V.norm(gr), -1) : null };
        memo.set(key, r);
        return r;
      };
      const emit = (a, b, d) => {
        const A = fix(a), Bv = fix(b), D = fix(d);
        if (o.keep && !(o.keep(A.p) && o.keep(Bv.p) && o.keep(D.p))) return;
        if ([A.p, Bv.p, D.p].some(q => Math.abs(q[0] - c[0]) > edge || Math.abs(q[1] - c[1]) > edge || Math.abs(q[2] - c[2]) > edge)) clipped = true;
        const fn = V.cross(V.sub(Bv.p, A.p), V.sub(D.p, A.p));
        const nn = A.n || V.norm(fn);
        let P2 = Bv, P3 = D;
        if (V.dot(fn, nn) < 0) { P2 = D; P3 = Bv; }
        for (const q of [A, P2, P3]) { pos.push(...q.p); nrm.push(...(q.n || nn)); }
      };
      for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        let ok = true, above = 0;
        for (let q = 0; q < 8; q++) {
          const o = CUBE[q], v = g[((k + o[2]) * N1 + j + o[1]) * N1 + i + o[0]];
          if (!isFinite(v)) { ok = false; break; }
          cv[q] = v; if (v > L) above++;
        }
        if (!ok || above === 0 || above === 8) continue;
        for (let q = 0; q < 8; q++) { const off = CUBE[q]; cp[q] = [X(i + off[0]), Y(j + off[1]), Z(k + off[2])]; }
        for (const T of TETS) {
          const ins = [], out = [];
          for (const q of T) (cv[q] > L ? ins : out).push(q);
          if (!ins.length || !out.length) continue;
          const X2 = (a, b) => V.lerp(cp[a], cp[b], (L - cv[a]) / (cv[b] - cv[a]));
          if (ins.length === 1) emit(X2(ins[0], out[0]), X2(ins[0], out[1]), X2(ins[0], out[2]));
          else if (ins.length === 3) emit(X2(out[0], ins[0]), X2(out[0], ins[1]), X2(out[0], ins[2]));
          else {
            const a = X2(ins[0], out[0]), b = X2(ins[0], out[1]), d = X2(ins[1], out[1]), e = X2(ins[1], out[0]);
            emit(a, b, d); emit(a, d, e);
          }
        }
      }
      return { level: L, pos: new Float32Array(pos), nrm: new Float32Array(nrm), count: pos.length / 3, clipped };
    });
  };

  // ---- 解析网格 ----
  ISO.sphere = function (c, r, lat) {
    lat = lat || 32;
    const lon = lat * 2, pos = [], nrm = [];
    const P = (i, j) => { const th = Math.PI * j / lat, ph = 2 * Math.PI * i / lon; return [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)]; };
    for (let j = 0; j < lat; j++) for (let i = 0; i < lon; i++) {
      const a = P(i, j), b = P(i + 1, j), d = P(i + 1, j + 1), e = P(i, j + 1);
      for (const q of [a, b, d, a, d, e]) { pos.push(c[0] + r * q[0], c[1] + r * q[1], c[2] + r * q[2]); nrm.push(...q); }
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), count: pos.length / 3 };
  };
  // 沿 z 轴的圆柱侧面（无端盖）
  ISO.cylinder = function (r, z0, z1, seg) {
    seg = seg || 64;
    const pos = [], nrm = [];
    for (let i = 0; i < seg; i++) {
      const a = 2 * Math.PI * i / seg, b = 2 * Math.PI * (i + 1) / seg;
      const ca = [Math.cos(a), Math.sin(a), 0], cb = [Math.cos(b), Math.sin(b), 0];
      const p = (q, z) => [r * q[0], r * q[1], z];
      for (const [q, z] of [[ca, z0], [cb, z0], [cb, z1], [ca, z0], [cb, z1], [ca, z1]]) { pos.push(...p(q, z)); nrm.push(...q); }
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), count: pos.length / 3 };
  };
  // 多边形扇形三角化（凸多边形）
  ISO.polygon = function (pts) {
    const pos = [], nrm = [];
    const nm = V.norm(V.cross(V.sub(pts[1], pts[0]), V.sub(pts[2], pts[0])));
    for (let i = 1; i < pts.length - 1; i++) for (const q of [pts[0], pts[i], pts[i + 1]]) { pos.push(...q); nrm.push(...nm); }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), count: pos.length / 3 };
  };
  ISO.merge = function (list) {
    const n = list.reduce((s, m) => s + m.pos.length, 0), pos = new Float32Array(n), nrm = new Float32Array(n);
    let o = 0;
    for (const m of list) { pos.set(m.pos, o); nrm.set(m.nrm, o); o += m.pos.length; }
    return { pos, nrm, count: n / 3 };
  };

  EL.ISO = ISO;
})(window.EL);
