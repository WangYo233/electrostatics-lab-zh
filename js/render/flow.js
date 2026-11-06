'use strict';
// 场线流动粒子：沿已积分的电场线按场强推进，表现场的方向与相对强弱
// 只是场线的动态显示，不是带电粒子的动力学轨迹
(function (EL) {
  const V = EL.V;

  function Flow() { this.src = null; this.lines = []; this.parts = []; this.n = 0; }

  // lines: [{pts, speed[]}]；speed 为各顶点的相对速度（已按中位场强归一）
  Flow.prototype.set = function (data, density) {
    if (data === this.src && density === this.density) return;
    this.src = data; this.density = density;
    this.lines = []; this.parts = []; this.n = 0;
    if (!data) return;
    let total = 0;
    for (const L of data.lines) {
      const pts = L.pts, s = [0];
      for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + V.dist(pts[i - 1], pts[i]));
      const len = s[s.length - 1];
      if (len <= 0) continue;
      this.lines.push({ pts, s, len, sp: L.speed });
      total += len;
    }
    const budget = Math.round(1400 * density), spacing = Math.max(total / budget, data.bound * 0.06);
    this.lines.forEach((L, li) => {
      const n = Math.max(1, Math.round(L.len / spacing));
      for (let k = 0; k < n; k++) this.parts.push({ li, u: (k + Math.random() * 0.8) / n * L.len, seg: 0 });
    });
    this.n = this.parts.length;
    this.pos = new Float32Array(this.n * 3); this.col = new Float32Array(this.n * 4); this.size = new Float32Array(this.n);
    // 基准速度（“流动速度”为 1 时每秒前进 0.055 倍显示范围）；原为 0.11，减慢一半便于观察
    this.base = data.bound * 0.055;
  };

  // 推进并写入顶点数组；dt 为秒
  Flow.prototype.step = function (dt, speed, color) {
    const k = this.base * speed, n = Math.min(this.n, this.parts.length);
    for (let i = 0; i < n; i++) {
      const P = this.parts[i], L = this.lines[P.li];
      if (!L) continue;
      let j = P.seg;
      if (L.s[j] > P.u) j = 0;
      while (j < L.s.length - 2 && L.s[j + 1] < P.u) j++;
      const sp = L.sp ? L.sp[j] : 1;
      P.u += dt * k * sp;
      if (P.u >= L.len) { P.u -= L.len; j = 0; }
      while (j < L.s.length - 2 && L.s[j + 1] < P.u) j++;
      P.seg = j;
      const seg = L.s[j + 1] - L.s[j], t = seg > 0 ? (P.u - L.s[j]) / seg : 0;
      const a = L.pts[j], b = L.pts[j + 1];
      this.pos[i * 3] = a[0] + (b[0] - a[0]) * t; this.pos[i * 3 + 1] = a[1] + (b[1] - a[1]) * t; this.pos[i * 3 + 2] = a[2] + (b[2] - a[2]) * t;
      // 线首尾淡入淡出，避免在源处突然出现
      const f = P.u / L.len, fade = Math.min(1, f * 8, (1 - f) * 8);
      this.col[i * 4] = color[0]; this.col[i * 4 + 1] = color[1]; this.col[i * 4 + 2] = color[2];
      this.col[i * 4 + 3] = 0.9 * fade * (0.55 + 0.45 * Math.min(1, sp));
      this.size[i] = 0.9 + 0.5 * Math.min(1.5, sp);
    }
  };

  // 顶点相对速度。粒子沿电场线、顺着 E 的方向运动（从正源到负源或无穷远）。
  // mode 'linear'：速度 ∝ |E|（以场线上各点 |E| 的中位数为基准 1），上下限幅 [0.08, 6]，近源处被限幅；
  // mode 'sqrt'  ：速度 ∝ √|E|，压缩强弱差别，便于同时看清近源与远处的流动；限幅 [0.25, 3]。
  // 两种模式都只表示方向与相对强弱，不是带电粒子的真实运动。
  Flow.speeds = function (F, lines, mode) {
    const all = [], lin = mode === 'linear';
    const out = lines.map(pts => pts.map(p => { const s = F.sample(p), m = s.ok ? V.len(s.E) : NaN; if (isFinite(m)) all.push(m); return m; }));
    all.sort((a, b) => a - b);
    const med = all.length ? all[Math.floor(all.length / 2)] || 1 : 1;
    const f = m => !isFinite(m) ? (lin ? 6 : 3) : lin ? Math.min(6, Math.max(0.08, m / med)) : Math.min(3, Math.max(0.25, Math.sqrt(m / med)));
    return lines.map((pts, i) => ({ pts, speed: out[i].map(f) }));
  };

  EL.Flow = Flow;
})(window.EL);
