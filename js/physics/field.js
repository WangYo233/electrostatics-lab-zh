'use strict';
// 静电场内核：点电荷叠加（k=1）与通用场对象接口
// 场对象 F：{ sample(p)->{V,E,ok}, V(p), blocked(p), sources, kind }
(function (EL) {
  const V = EL.V;
  const P = {};

  // 点电荷集合。rMin 内电势、场强未定义（返回 NaN），q=0 的源不产生奇点
  P.pointField = function (sources, rMin, k) {
    k = k == null ? 1 : k;
    const src = sources.filter(s => s.q !== 0 && isFinite(s.q));
    const F = { kind: 'points', sources: src, rMin };
    F.sample = function (p) {
      let Vt = 0, Ex = 0, Ey = 0, Ez = 0;
      for (const s of src) {
        const dx = p[0] - s.p[0], dy = p[1] - s.p[1], dz = p[2] - s.p[2];
        const r2 = dx * dx + dy * dy + dz * dz, r = Math.sqrt(r2);
        if (r <= rMin) return { V: NaN, E: [NaN, NaN, NaN], ok: false };
        const kq = k * s.q, inv3 = kq / (r2 * r);
        Vt += kq / r; Ex += dx * inv3; Ey += dy * inv3; Ez += dz * inv3;
      }
      return { V: Vt, E: [Ex, Ey, Ez], ok: true };
    };
    F.V = function (p) {
      let Vt = 0;
      for (const s of src) {
        const r = Math.hypot(p[0] - s.p[0], p[1] - s.p[1], p[2] - s.p[2]);
        if (r <= rMin) return NaN;
        Vt += k * s.q / r;
      }
      return Vt;
    };
    // 各源原始分场（用于探针矢量合成）
    F.parts = function (p) {
      return sources.map((s, i) => {
        if (!s.q) return { i, label: s.label, q: 0, E: [0, 0, 0] };
        const d = V.sub(p, s.p), r = V.len(d);
        if (r <= rMin) return { i, label: s.label, q: s.q, E: [NaN, NaN, NaN] };
        return { i, label: s.label, q: s.q, E: V.mul(d, k * s.q / (r * r * r)) };
      });
    };
    // 用于提取等势线/面的连续化电势：r<rMin 时取 rMin，使网格上处处有值、曲面连续不破洞；
    // 提取后再剔除落在排除邻域内的面片，读数仍按“未定义”处理
    F.Vs = function (p) {
      let Vt = 0;
      for (const s of src) Vt += k * s.q / Math.max(rMin * 0.6, Math.hypot(p[0] - s.p[0], p[1] - s.p[1], p[2] - s.p[2]));
      return Vt;
    };
    // -∇V 的解析值（连续化区域外即 E），用于曲面法向与投影
    F.gradVs = function (p) {
      let gx = 0, gy = 0, gz = 0;
      for (const s of src) {
        const dx = p[0] - s.p[0], dy = p[1] - s.p[1], dz = p[2] - s.p[2], r = Math.max(rMin * 0.6, Math.hypot(dx, dy, dz)), c = -k * s.q / (r * r * r);
        gx += c * dx; gy += c * dy; gz += c * dz;
      }
      return [gx, gy, gz];
    };
    F.blocked = p => src.some(s => V.dist(p, s.p) <= rMin);
    // 线段 a→b 是否穿过某个排除邻域
    F.segBlocked = function (a, b) {
      const ab = V.sub(b, a), L2 = V.dot(ab, ab);
      for (const s of src) {
        const t = L2 > 0 ? EL.U.clamp(V.dot(V.sub(s.p, a), ab) / L2, 0, 1) : 0;
        if (V.dist(V.addS(a, ab, t), s.p) <= rMin) return true;
      }
      return false;
    };
    return F;
  };

  // 由解析函数构造场对象：fn(p) -> {V, E, region}
  P.analyticField = function (fn, opts) {
    const F = Object.assign({ kind: 'analytic', sources: [], rMin: 0 }, opts || {});
    F.sample = function (p) {
      const r = fn(p);
      const ok = isFinite(r.V) && r.E.every(isFinite);
      return { V: r.V, E: r.E, ok, region: r.region };
    };
    F.V = p => fn(p).V;
    F.Vs = p => { const v = fn(p).V; return isFinite(v) ? v : 0; };
    F.gradVs = p => { const r = fn(p); return r.E.every(isFinite) ? V.mul(r.E, -1) : [NaN, NaN, NaN]; };
    F.blocked = p => !F.sample(p).ok;
    F.segBlocked = (a, b) => F.blocked(b);
    F.parts = () => [];
    return F;
  };

  // 等势层值。perCharge：每个非零源按符号累计生成 n 层；否则以 center 为中心的固定总层数
  P.levels = function (sources, n, center, spacing, perCharge) {
    n = EL.U.clamp(Math.round(n), 1, 5);
    const out = [];
    if (!perCharge) {
      for (let i = 0; i < n; i++) out.push(center + (i - (n - 1) / 2) * spacing);
      return out;
    }
    const ord = { 1: 0, '-1': 0 };
    let pos = false, neg = false;
    for (const s of sources) {
      if (!s.q) continue;
      const sg = s.q > 0 ? 1 : -1;
      if (sg > 0) pos = true; else neg = true;
      for (let i = 0; i < n; i++) out.push(center + sg * (++ord[sg]) * spacing);
    }
    if (pos && neg && !out.some(v => Math.abs(v) < 1e-12)) out.push(0);
    if (!out.length) out.push(center);
    return Array.from(new Set(out.map(v => +v.toFixed(10)))).sort((a, b) => a - b);
  };

  EL.Phys = P;
})(window.EL);
