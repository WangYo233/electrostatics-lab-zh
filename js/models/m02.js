'use strict';
// 02 路径与能量
(function (EL) {
  const V = EL.V, MH = EL.MH;
  const path = { key: 's', label: 's', unit: 'L', range: [-6, 6], pos: s => [s, 0, 0], d: () => [1, 0, 0] };
  EL.defModel({
    id: 2, code: '02', order: 2, file: '02', title: '路径与能量', short: '沿 x 轴的电势 V(s)、电势能 U(s) 与场强的切向分量 E∥(s)',
    view: '3d', R: 6, rMin: 0.25, perCharge: true,
    params: [
      { key: 'q1', label: '源电荷 Q₁（位于 (−d/2, 0, 0)）的电荷量 / Q', min: -2, max: 2, step: 0.1, val: 1 },
      { key: 'q2', label: '源电荷 Q₂（位于 (d/2, 0, 0)）的电荷量 / Q', min: -2, max: 2, step: 0.1, val: -1 },
      { key: 'q0', label: '试探电荷的电荷量 q₀ / Q', min: -2, max: 2, step: 0.1, val: 1, probe: true },
      { key: 'd', label: '两源电荷的间距 d / L', min: 1, max: 8, step: 0.1, val: 4 },
      { key: 's', label: '探针的弧长坐标 s / L', min: -6, max: 6, step: 0.05, val: 0, probe: true }
    ],
    hidden: { s0: null },
    display: { level: 0, spacing: 0.3, count: 1 },
    defaultLayers: { probe: true },
    probe: { path },
    paths: () => [path],
    sources: p => [{ p: [-p.d / 2, 0, 0], q: p.q1, label: 'Q1' }, { p: [p.d / 2, 0, 0], q: p.q2, label: 'Q2' }],
    stages: [
      { title: '沿路径取样', q: '沿 x 轴移动时，电势怎样变化？',
        obs: '沿有向弧长坐标 s 移动探针，同时观察探针的位置和曲线 V(s)。', rec: '在源电荷附近区域以外取三个位置，记录并比较各处的 V 和 |E|。',
        hint: '|E| 是电场强度矢量的大小，不能由 V 的正负判断 |E| 的大小。', preset: { q1: 1, q2: -1, q0: 1, d: 4, s: 1 } },
      { title: '电势曲线的斜率', q: '电势降低的方向与电场强度的方向一致吗？',
        obs: '在曲线的同一个连续段上，比较 V(s) 的斜率和带正负号的 E∥(s)。', rec: '分别在斜率为正和斜率为负的位置附近取点，检验 $E_\\parallel=-\\diff V/\\diff s$ 是否成立。',
        hint: '本模型中路径的弧长坐标就是 x 坐标，所以 $E_\\parallel=-\\diff V/\\diff s$。梯度残差来自有限差分的数值误差，不严格等于零。', preset: { s: 1 } },
      { title: '试探电荷变号', q: '改变试探电荷的电荷量 q₀，会改变源电荷产生的电势和电场强度吗？',
        obs: '保持源电荷和探针位置不变，让 q₀ 由正值变为零再变为负值。比较电势能 $U=q_0V$ 与电势、场强的变化。', rec: '写出 q₀ 变号前后 V、E 和 U 各怎样变化。',
        hint: 'U 与 q₀ 成正比；V 和 E 只由源电荷决定。q₀ 为零时，源电荷以外各处的 U 都为零。' },
      { title: '静电力做的功', q: '试探电荷从一个位置移到另一个位置，静电力做的功是多少？',
        obs: '先把探针移到起点，点击“标记为起点”，再沿曲线的同一个连续段把探针移到终点。', rec: '改变 q₀ 的正负，检验 $W=q_0(V_\\text{初}-V_\\text{末})=-\\Delta U$。',
        hint: '起点和终点都必须在定义域内。两点之间的路径经过源电荷附近的排除区域时，不能用两端点的电势差计算功，因为路径上有奇点。',
        actions: [{ label: '标记为起点', run: ctx => { ctx.hidden.s0 = ctx.p.s; } }] },
      { title: '奇点与读数', q: '在源电荷附近，为什么不能把读数当作零？',
        obs: '把探针移到 x=±d/2 附近，再把对应源电荷的电荷量设为零，比较排除区域与曲线的断开处。', rec: '区分三种情况：读数未定义、读数为零、源电荷已移除。再整理 E、V、U 之间的关系。',
        hint: '只有电荷量不为零的源电荷所在处才是奇点。曲线断开处是排除区域，它既不表示电势为零，也不是一条能越过奇点的实际路径。' }
    ],
    readings(ctx) {
      const p = ctx.p, F = ctx.F, s = F.sample(path.pos(p.s)), out = [];
      const Ep = s.ok ? s.E[0] : NaN, h = 1e-4, g = Math.abs(Ep + (F.V([p.s + h, 0, 0]) - F.V([p.s - h, 0, 0])) / (2 * h));
      out.push(['V(s)', s.V, 'kQ/L'], ['U(s)=q₀V', p.q0 * s.V, 'kQ²/L'], ['|E|', V.len(s.E), 'kQ/L²'], ['E∥(s)', Ep, 'kQ/L²']);
      if (ctx.stage === 1) out.push(['梯度残差 |E∥+dV/ds|', g, 'kQ/L²']);
      if (ctx.stage === 3) {
        const s0 = ctx.hidden.s0;
        if (s0 == null) out.push(['起点', '尚未标记起点', '']);
        else {
          const a = F.sample(path.pos(s0)), bad = MH.pathBlocked(F, path, s0, p.s);
          const dU = bad ? NaN : p.q0 * (s.V - a.V);
          out.push(['起点 s₀', s0, 'L'], ['V初', a.V, 'kQ/L'], ['V末', s.V, 'kQ/L'], ['ΔU', dU, 'kQ²/L'], ['W场=−ΔU', -dU, 'kQ²/L']);
          if (bad) out.push(['说明', '起点与终点之间的路径经过排除区域，不能用端点电势差计算功', '']);
        }
      }
      return out;
    },
    curves(ctx) {
      const d = MH.alongPath(ctx.F, path, 240), q0 = ctx.p.q0;
      return { x: d.xs, xLabel: 's / L', cur: ctx.p.s,
        series: [{ name: 'V(s)', y: d.Vs, color: EL.CHART.V }, { name: 'U(s)', y: d.Vs.map(v => q0 * v), color: EL.CHART.U }, { name: 'E∥(s)', y: d.Es, color: EL.CHART.E }],
        bands: ctx.sources.filter(s => s.q).map(s => [s.p[0] - ctx.rMin, s.p[0] + ctx.rMin]),
        note: '横轴为 s / L。各曲线纵轴的单位不同，请按颜色分别比较；灰色带为源电荷附近的排除区域。' };
    },
    extra(ctx) {
      const out = { lines: MH.pathLine(ctx.F, path) };
      MH.mark(out, [0, 0, 0], 'O');
      if (ctx.stage === 3 && ctx.hidden.s0 != null) MH.mark(out, path.pos(ctx.hidden.s0), '起点', EL.C.energy, 0.09);
      return out;
    },
    exercises: [
      { q: '起点电势 V初=3 kQ/L，终点电势 V末=1 kQ/L，试探电荷的电荷量 q₀=−2 Q，求静电力做的功 W（单位 kQ²/L）。', a: -4 },
      { q: '沿路径 dV/ds=−0.6 kQ/L²，求场强沿路径的分量 E∥（单位 kQ/L²）。', a: 0.6 },
      { q: '只改变试探电荷的正负，哪些量不变？', options: ['V 与 E', 'U 与 E', '只有 U'], a: 'V 与 E' },
      { q: '起点和终点的电势都有确定值，但路径经过一个电荷量不为零的点电荷。能否用两端点的电势差计算静电力做的功？', options: ['能', '不能，路径含奇点'], a: '不能，路径含奇点' }
    ]
  });
})(window.EL);
