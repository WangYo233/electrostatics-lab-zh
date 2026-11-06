'use strict';
// 03 圆盘电荷：总相互作用能与候选构型比较（雪花问题）
(function (EL) {
  const V = EL.V, MH = EL.MH;
  const Uring = (n, q, R) => { if (n < 2) return 0; let s = 0; for (let m = 1; m < n; m++) s += 1 / Math.sin(Math.PI * m / n); return n * q * q * s / (4 * R); };
  const Ucenter = (n, q, qc, R) => Uring(n - 1, q, R) + (n - 1) * q * qc / R;

  function energy(src, rMin) {
    let U = 0, dmin = Infinity;
    for (let i = 0; i < src.length; i++) for (let j = i + 1; j < src.length; j++) {
      const r = V.dist(src[i].p, src[j].p);
      dmin = Math.min(dmin, r);
      U += src[i].q * src[j].q / r;
    }
    return { U: dmin <= rMin ? NaN : U, dmin };
  }
  function forces(src) {
    return src.map((a, i) => {
      let f = [0, 0, 0];
      src.forEach((b, j) => { if (i === j) return; const d = V.sub(a.p, b.p), r = V.len(d); f = V.addS(f, d, a.q * b.q / (r * r * r)); });
      return f;
    });
  }

  EL.defModel({
    id: 3, code: '拓展 2', order: 8, ext: true, file: '03', title: '圆盘电荷（雪花问题）', short: '总相互作用能、中心构型与局部扰动',
    view: '2d', lock2d: false, R: 6, rMin: 0.2, perCharge: false,
    params: [
      { key: 'N', label: '点电荷的总个数 N', min: 2, max: 12, step: 1, val: 6 },
      { key: 'R', label: '圆盘半径 R / L', min: 1, max: 8, step: 0.1, val: 4 },
      { key: 'q', label: '圆周上每个电荷的电荷量 q / Q', min: 0.1, max: 2, step: 0.1, val: 1 },
      { key: 'phi', label: '整体转角 φ / rad', min: -3.14, max: 3.14, step: 0.01, val: 0 },
      { key: 'qc', label: '中心电荷的电荷量 q_c / Q', min: -2, max: 2, step: 0.1, val: 1, show: p => p.center },
      { key: 'mx', label: '扰动电荷的 x 坐标 / L', min: -8, max: 8, step: 0.05, val: 4, show: p => p.manual },
      { key: 'my', label: '扰动电荷的 y 坐标 / L', min: -8, max: 8, step: 0.05, val: 0, show: p => p.manual }
    ],
    toggles: [
      { key: 'center', label: '把一个电荷放在圆心', val: false },
      { key: 'manual', label: '手动移动第 1 个电荷', val: false },
      { key: 'force', label: '显示每个电荷所受静电力的合力', val: true },
      { key: 'pairs', label: '显示第 1、2 个电荷的连线', val: true }
    ],
    hidden: { cands: [] },
    display: { level: 2, spacing: 0.3, count: 3, plane: 'xy' },
    layerNames: { geom: '圆周与辅助线' },
    probe: { free: null },
    sources(p) {
      const nr = p.center ? p.N - 1 : p.N, out = [];
      for (let i = 0; i < nr; i++) {
        const th = 2 * Math.PI * i / nr + p.phi;
        out.push({ p: [p.R * Math.cos(th), p.R * Math.sin(th), 0], q: p.q, label: String(i + 1) });
      }
      if (p.manual && out.length) out[0].p = [p.mx, p.my, 0];
      if (p.center) out.push({ p: [0, 0, 0], q: p.qc, label: '中' });
      return out;
    },
    handles(ctx) {
      if (!ctx.p.manual) return [];
      return [{ p: [ctx.p.mx, ctx.p.my, 0], plane: [0, 0, 1], move: (q, set) => {
        let x = q[0], y = q[1];
        const r = Math.hypot(x, y);
        if (r > ctx.p.R) { x *= ctx.p.R / r; y *= ctx.p.R / r; }
        set({ mx: +x.toFixed(3), my: +y.toFixed(3) });
      } }];
    },
    stages: [
      { title: '圆周等分构型', q: '计算总相互作用能时，应计入多少对电荷？',
        obs: '从同号电荷等分圆周的构型出发，观察第 1、2 个电荷的间距和总相互作用能。', rec: '用 N(N−1)/2 检验不重复的电荷对数，并说明为什么每一对只能计算一次。',
        hint: '总相互作用能为 $U=\\sum_{i<j}kq_iq_j/r_{ij}$。圆盘边界只限制电荷的位置，边界的约束力不计入静电相互作用能。', preset: { center: false, manual: false, pairs: true, N: 6, R: 4, q: 1, phi: 0 } },
      { title: '个数与尺度', q: '增加电荷个数或扩大圆盘时，总相互作用能怎样变化？',
        obs: '每次只改变 N、R、q 中的一个量，其余两个量保持不变。', rec: '在 N 相同时，比较 U 与 1/R、q² 的关系。比较不同 N 的结果时，要注明总电荷量也随之改变。',
        hint: '构型的形状不变时，总相互作用能与 1/R 成正比，与每个电荷电荷量的平方 q² 成正比。' },
      { title: '中心构型', q: '保持电荷总个数 N 不变，把一个电荷移到圆心，总相互作用能会降低吗？',
        obs: '把一个电荷放在圆心后，圆周上有 N−1 个电荷。先令中心电荷的电荷量等于 q，再比较两种构型。', rec: '比较时必须保持 N、R 和各电荷的电荷量相同。中心电荷变号的情形要单独解释。',
        hint: '圆心处电荷所受静电力的合力可能为零，但这一点本身不能证明构型稳定，更不能证明总相互作用能是全局最小。', preset: { center: true, manual: false },
        actions: [{ label: '令中心电荷等于 q', run: ctx => ctx.set({ qc: ctx.p.q }) }] },
      { title: '局部扰动', q: '对对称构型做局部扰动，能否降低总相互作用能？',
        obs: '勾选“手动移动第 1 个电荷”，在圆盘内拖动金色控制点；其余电荷保持原来的位置。', rec: '比较扰动前后的 U，并说明电荷所受静电力的合力不为零时，它与边界约束力的关系。',
        hint: '拖动只是在不同位置取样，不是模拟电荷的运动过程。扰动电荷进入其他电荷附近的排除区域时，总相互作用能未定义。', preset: { manual: true },
        actions: [{ label: '移回圆周', run: ctx => ctx.set({ mx: +(ctx.p.R * Math.cos(ctx.p.phi)).toFixed(3), my: +(ctx.p.R * Math.sin(ctx.p.phi)).toFixed(3) }) }] },
      { title: '构型比较', q: '这些比较能在多大程度上支持“能量最低”的结论？',
        obs: '分别保留圆周等分、中心和扰动三种构型的读数，在 N、R 和电荷量都相同的条件下比较。', rec: '引用至少两条可比的记录，写清“在已比较的构型中较低”与“全局最小”的区别。',
        hint: '有限个构型或局部扰动不能穷尽所有允许的构型。中心电荷的电荷量或电荷总个数不同的记录，不能当作同一问题的比较。',
        actions: [{ label: '保留当前读数', run: ctx => {
          const p = ctx.p, U = energy(ctx.sources, ctx.rMin).U;
          const name = p.manual ? '扰动构型' : p.center ? '圆周与中心构型' : '圆周等分构型';
          ctx.hidden.cands = [{ name, N: p.N, R: p.R, q: p.q, qc: p.center ? p.qc : '—', U }].concat(ctx.hidden.cands).slice(0, 6);
        } }] }
    ],
    readings(ctx) {
      const p = ctx.p, src = ctx.sources, e = energy(src, ctx.rMin), f = forces(src);
      const r12 = src.length > 1 ? V.dist(src[0].p, src[1].p) : NaN;
      const out = [['总相互作用能 U', e.U, 'kQ²/L'], ['无序电荷对 N(N−1)/2', src.length * (src.length - 1) / 2, ''],
        ['r₁₂', r12, 'L'], ['第 1、2 个电荷的相互作用能 kq²/r₁₂', src.length > 1 ? src[0].q * src[1].q / r12 : NaN, 'kQ²/L'],
        ['各电荷所受静电力合力的最大值 max|F|', Math.max(...f.map(V.len)), 'kQ²/L²'], ['圆周上的电荷个数', p.center ? p.N - 1 : p.N, ''], ['两电荷间的最小距离', e.dmin, 'L']];
      if (!p.manual) out.push(['规则构型理论值', p.center ? Ucenter(p.N, p.q, p.qc, p.R) : Uring(p.N, p.q, p.R), 'kQ²/L']);
      if (ctx.hidden.cands.length) out.push(['— 已保留的构型 —', '', '']);
      ctx.hidden.cands.forEach(c => out.push([c.name + '（N=' + c.N + '，R=' + c.R + '，q=' + c.q + '，q_c=' + c.qc + '）', c.U, 'kQ²/L']));
      return out;
    },
    curves(ctx) {
      const p = ctx.p, ns = [], u1 = [], u2 = [];
      for (let n = 2; n <= 12; n++) { ns.push(n); u1.push(Uring(n, p.q, p.R)); u2.push(Ucenter(n, p.q, p.center ? p.qc : p.q, p.R)); }
      return { x: ns, xLabel: 'N', cur: p.N, scatter: true,
        series: [{ name: '圆周等分', y: u1, color: EL.CHART.V }, { name: '圆周与中心', y: u2, color: EL.CHART.E }],
        points: [{ x: p.N, y: energy(ctx.sources, ctx.rMin).U, color: EL.CHART.U, name: '当前构型' }],
        note: '横轴为点电荷的总个数 N，纵轴为总相互作用能 U / (kQ²/L)。' };
    },
    extra(ctx) {
      const p = ctx.p, src = ctx.sources, out = { lines: [], arrows: [] };
      if (ctx.layers.geom) {
        const c = [];
        for (let i = 0; i <= 120; i++) { const a = 2 * Math.PI * i / 120; c.push([p.R * Math.cos(a), p.R * Math.sin(a), 0]); }
        out.lines.push({ pts: c, color: EL.C.ring, width: 1.5 });
        out.lines.push({ pts: [[0, 0, 0], [p.R * Math.cos(p.phi), p.R * Math.sin(p.phi), 0]], color: EL.C.guide, width: 1, dash: [0.15, 0.12] });
      }
      if (p.pairs && src.length > 1) out.lines.push({ pts: [src[0].p, src[1].p], color: EL.C.energy, width: 2, dash: [0.2, 0.12] });
      if (p.force) {
        const f = forces(src), mx = Math.max(1e-9, ...f.map(V.len));
        f.forEach((v, i) => { if (V.len(v) > 1e-9) out.arrows.push({ p: src[i].p, v: V.mul(v, 1.6 / mx), color: EL.C.sum, width: 2.2 }); });
      }
      if (p.manual) MH.mark(out, [p.mx, p.my, 0], '扰动电荷', EL.C.probe, 0.12);
      return out;
    },
    exercises: [
      { q: 'N=6 时，不重复的电荷对有多少对？', a: 15 },
      { q: '4 个电荷等分圆周构成正方形，R=1 L，q=1 Q，求总相互作用能（单位 kQ²/L）。', a: 2 * Math.SQRT2 + 1 },
      { q: '圆盘半径加倍，每个电荷的电荷量也加倍，构型形状不变，求新旧总相互作用能之比 U新/U原。', a: 2 },
      { q: '某构型在有限个已比较的构型中能量最低，由此可以得出什么结论？', options: ['仅在已比较候选中较低', '已证明全局最小', '必定稳定'], a: '仅在已比较候选中较低' }
    ]
  });
})(window.EL);
