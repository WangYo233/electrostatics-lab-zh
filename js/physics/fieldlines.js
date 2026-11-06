'use strict';
// 电场线：自适应 RK4 沿单位方向（按弧长）积分；二维切片时积分截面切向场
(function (EL) {
  const V = EL.V, U = EL.U;
  const FL = {};

  function dirFn(F, B, sgn) {
    return function (q) {
      const s = F.sample(q);
      if (!s.ok) return null;
      let e = s.E;
      if (B) e = V.addS(e, B.n, -V.dot(e, B.n));
      const L = V.len(e);
      if (!(L > 1e-10)) return null;
      return V.mul(e, sgn / L);
    };
  }

  // 从 p0 出发沿 sgn·E 方向积分，返回点列
  FL.trace = function (F, p0, sgn, o) {
    const d = dirFn(F, o.B, sgn), bound = o.bound, step = o.step;
    const pts = [p0.slice()], arc = [0];
    let p = p0.slice(), h = step, k1 = d(p);
    if (!k1) return pts;
    for (let i = 0; i < o.maxSteps; i++) {
      let np = null;
      for (let tries = 0; tries < 12; tries++) {
        const k2 = d(V.addS(p, k1, h / 2)), k3 = k2 && d(V.addS(p, k2, h / 2)), k4 = k3 && d(V.addS(p, k3, h));
        if (!k4) { h /= 2; continue; }
        if (V.dot(k1, k4) < 0.995 && h > step / 64) { h /= 2; continue; }
        np = [0, 1, 2].map(j => p[j] + h * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]) / 6);
        break;
      }
      if (!np || F.segBlocked(p, np)) break;
      if (Math.abs(np[0]) > bound || Math.abs(np[1]) > bound || Math.abs(np[2]) > bound) {
        // 截到边界后停止
        let t = 1;
        for (let j = 0; j < 3; j++) if (Math.abs(np[j]) > bound) t = Math.min(t, (Math.sign(np[j]) * bound - p[j]) / (np[j] - p[j]));
        pts.push(V.lerp(p, np, Math.max(0, t)));
        break;
      }
      pts.push(np);
      arc.push(arc[arc.length - 1] + h);
      // 停滞检测：来回振荡时弧长增长而位移不增长（切向场零点附近）
      const m = pts.length - 40;
      if (m >= 0 && V.dist(np, pts[m]) < 0.25 * (arc[arc.length - 1] - arc[m])) break;
      p = np;
      k1 = d(p);
      if (!k1) break;
      h = Math.min(step, h * 1.6);
    }
    return pts;
  };

  // n 个方向：成对的对跖方向，前三对为坐标轴，其余黄金角螺旋
  FL.sphereDirs = function (n) {
    const half = Math.ceil(n / 2), out = [], ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < half; i++) {
      let d;
      if (n >= 6 && i < 3) d = [[1, 0, 0], [0, 1, 0], [0, 0, 1]][i];
      else {
        const zd = (i + 0.5) / half, r = Math.sqrt(1 - zd * zd), a = ga * i;
        d = [r * Math.cos(a), r * Math.sin(a), zd];
      }
      out.push(d, V.mul(d, -1));
    }
    return out.slice(0, Math.max(2, n % 2 ? n + 1 : n));
  };

  // 点电荷场线。o: {seeds, bound, step, maxSteps, B(截面基，可选), planePos}
  // 1) 每个源的场线数与 |q| 成正比（以最小 |q| 为基准，场线疏密反映通量）；
  // 2) 从正源出发顺着 E 积分；到达负源时把终点接到源心；
  // 3) 从负源逆着 E 积分时，若另一端回到某个正源，说明这条线已经由正源画过，舍去，避免重合；
  //    只保留来自无穷远（显示边界）的线。只有负源时全部保留。
  FL.pointLines = function (F, o) {
    const n0 = U.clamp(Math.round(o.seeds), 2, 64), lines = [];
    const r0 = Math.max(1.35 * F.rMin, 1e-3), snap = Math.max(2.2 * F.rMin, r0 * 1.4);
    const B = o.B;
    const inPlane = s => !B || Math.abs(V.dot(s.p, B.n) - o.planePos) < 1e-6;
    const planar = [], off = [];
    for (const s of F.sources) (inPlane(s) ? planar : off).push(s);
    const qmin = Math.min(...F.sources.map(s => Math.abs(s.q)).filter(x => x > 0), Infinity);
    const nearSrc = (p, sign) => F.sources.find(s => Math.sign(s.q) === sign && V.dist(p, s.p) < snap);
    const hasPos = F.sources.some(s => s.q > 0);
    const order = planar.slice().sort((a, b) => b.q - a.q);
    for (const s of order) {
      const n = U.clamp(Math.round(n0 * Math.abs(s.q) / qmin), 2, 4 * n0);
      const dirs = B
        ? Array.from({ length: n }, (_, i) => { const a = 2 * Math.PI * (i + 0.5) / n; return V.add(V.mul(B.u, Math.cos(a)), V.mul(B.v, Math.sin(a))); })
        : FL.sphereDirs(n);
      const sg = s.q > 0 ? 1 : -1;
      for (const d of dirs) {
        const line = FL.trace(F, V.addS(s.p, d, r0), sg, o);
        const end = line[line.length - 1], sink = nearSrc(end, -sg);
        if (sg < 0 && hasPos && sink) continue;
        if (sink) line.push(sink.p.slice());
        line.unshift(s.p.slice());
        if (sg < 0) line.reverse();
        if (line.length > 2) lines.push(line);
      }
    }
    if (B && off.length) lines.push(...FL.gridLines(F, o, n0 * Math.max(1, off.length), lines));
    return lines;
  };

  // 有源离开截面：边界与网格播种的切向流线，用占据网格去重
  FL.gridLines = function (F, o, count, existing) {
    const B = o.B, bd = o.bound, g = U.clamp(Math.ceil(Math.sqrt(count)), 3, 10);
    const cells = Math.max(24, g * 8), cs = 2 * bd / cells, occ = new Set();
    const key = p => Math.floor((V.dot(p, B.u) + bd) / cs) + ',' + Math.floor((V.dot(p, B.v) + bd) / cs);
    const mark = line => line.forEach(p => occ.add(key(p)));
    existing.forEach(mark);
    const seeds = [];
    for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) seeds.push([-bd + (i + 0.5) * 2 * bd / g, -bd + (j + 0.5) * 2 * bd / g]);
    const m = Math.max(4, Math.round(count / 2));
    for (let i = 0; i < m; i++) {
      const t = -bd + (i + 0.5) * 2 * bd / m, e = bd * 0.98;
      seeds.push([t, -e], [t, e], [-e, t], [e, t]);
    }
    const out = [];
    for (const [a, b] of seeds) {
      const p = V.onPlane(B, a, b, o.planePos);
      if (occ.has(key(p)) || F.blocked(p)) continue;
      const fw = FL.trace(F, p, 1, o), bw = FL.trace(F, p, -1, o);
      const line = bw.reverse().concat(fw.slice(1));
      if (line.length > 3) { out.push(line); mark(line); }
    }
    return out;
  };

  // 从给定种子双向积分（解析模型）
  FL.seedLines = function (F, seeds, o) {
    const out = [];
    for (const p of seeds) {
      if (F.blocked(p)) continue;
      const fw = FL.trace(F, p, 1, o), bw = FL.trace(F, p, -1, o);
      const line = bw.reverse().concat(fw.slice(1));
      if (line.length > 3) out.push(line);
    }
    return out;
  };

  // 线上按弧长比例取箭头位置与方向
  FL.arrowAt = function (line, frac) {
    let L = 0;
    for (let i = 1; i < line.length; i++) L += V.dist(line[i - 1], line[i]);
    let target = L * frac, acc = 0;
    for (let i = 1; i < line.length; i++) {
      const s = V.dist(line[i - 1], line[i]);
      if (acc + s >= target && s > 0) return { p: V.lerp(line[i - 1], line[i], (target - acc) / s), d: V.norm(V.sub(line[i], line[i - 1])), L };
      acc += s;
    }
    return null;
  };

  EL.FL = FL;
})(window.EL);
