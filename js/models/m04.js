'use strict';
// 03 正四面体：按“三维场强合成 → 由合场强方向判断电势变化 → 与计算对照”的顺序探究投稿案例
// 顶点 T1、T2、T3、T4 依次对应例题中的 A、B、C、D；P 为棱 T1T2（AB）的中点，M 为面 T1T2T3（ABC）的中心
(function (EL) {
  const V = EL.V, MH = EL.MH, s3 = Math.sqrt(3), D2R = 180 / Math.PI;
  const FACES = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];
  const verts = a => [[a, a, a], [a, -a, -a], [-a, a, -a], [-a, -a, a]];
  const midP = a => V.lerp(verts(a)[0], verts(a)[1], 0.5);
  const cenM = a => { const v = verts(a); return V.mul(V.add(V.add(v[0], v[1]), v[2]), 1 / 3); };
  const path = { key: 'lam', label: 'λ', unit: 'L', range: [-2, 2], pos: l => [l / s3, l / s3, l / s3], d: () => [1 / s3, 1 / s3, 1 / s3] };
  // 由 P 到 C（T3）的线段：u=0 为 P，u=1/3 为 M，u=1 为 C
  const pathPC = a => { const P = midP(a), C = verts(a)[2], d = V.sub(C, P); return { key: 'u', label: 'u', unit: '', range: [0, 1], pos: u => V.addS(P, d, u), d: () => d }; };
  const curPath = p => p.pc ? pathPC(p.a) : path;
  const ang = (u, v) => V.len(u) > 1e-12 && V.len(v) > 1e-12 ? Math.acos(EL.U.clamp(V.dot(u, v) / V.len(u) / V.len(v), -1, 1)) * D2R : NaN;
  const base = { alt: false, f: 1, customProbe: false, pc: false };
  const paper = { alt: true, f: 1, a: 2, q: 1, q0: 1, customProbe: false, pc: true };
  const probeLines = on => ({ label: on ? '显示探针到各源电荷的连线' : '隐藏探针到各源电荷的连线', run: ctx => { ctx.st.geo.probeLines = on; } });
  const wizard = { label: '开始合成向导', run: () => { const A = EL.App; if (A.setMode) A.setMode('analyze'); if (A.startWizard) A.startWizard(); } };
  EL.defModel({
    id: 4, code: '03', order: 3, file: '04', title: '正四面体', short: '棱中点 P 与面中心 M 的三维场强合成、由合场强方向判断电势变化、与计算结果对照',
    view: '3d', R: 6, rMin: 0.2, perCharge: true, editor: { max: 24, qRange: [-10, 10], xyz: 6, placements: p => MH.placements(verts(p.a), FACES, s3 * p.a) },
    params: [
      { key: 'a', label: '顶点坐标的尺度 a / L（棱长 ℓ=2√2a）', min: 0.5, max: 4, step: 0.05, val: 2 },
      { key: 'q', label: '源电荷的电荷量 q / Q', min: -2, max: 2, step: 0.1, val: 1 },
      { key: 'f', label: 'T1 电荷量的倍数 f', min: 0, max: 2, step: 0.05, val: 1 },
      { key: 'q0', label: '试探电荷的电荷量 q₀ / Q', min: -2, max: 2, step: 0.1, val: 1, probe: true },
      { key: 'lam', label: '探针在轴上的位置 λ / L', min: -2, max: 2, step: 0.05, val: 0, show: p => !p.customProbe && !p.pc, probe: true },
      { key: 'u', label: '探针在线段 PC 上的位置 u（P 为 0，M 为 1/3，C 为 1）', min: 0, max: 0.95, step: 0.01, val: 0, show: p => !p.customProbe && p.pc, probe: true },
      ...MH.customProbe(6)
    ],
    toggles: [{ key: 'alt', label: '交替电荷（T1、T3 为 −q，T2、T4 为 +q）', val: false }, { key: 'faces', label: '显示着色的表面', val: true },
      { key: 'pc', label: '探针沿线段 PC 移动（由棱 T1T2 的中点 P 到顶点 T3）', val: false, probe: true }, MH.customToggle],
    display: { level: 0, spacing: 0.3, count: 1 },
    probe: { pathFn: p => curPath(p), free: ['px', 'py', 'pz'], customKey: 'customProbe', fromStage: 0,
      nameFn: () => { const p = EL.App.st && EL.App.st.p; if (!p || !p.pc) return 'X'; return Math.abs(p.u) < 1e-6 ? 'P' : Math.abs(p.u - 1 / 3) < 1e-6 ? 'M' : 'X'; } },
    paths: p => [path, pathPC(p.a)],
    sources: p => verts(p.a).map((x, i) => ({ p: x, q: (p.alt && i % 2 === 0 ? -1 : 1) * (i === 0 ? p.q * p.f : p.q), label: 'T' + (i + 1) })),
    keyPts: p => { const v = verts(p.a); return [{ name: '棱 T1T2（AB）的中点 P', p: midP(p.a) }, { name: '面 T1T2T3（ABC）的中心 M', p: cenM(p.a) },
      { name: '面 T1T3T4（ACD）的中心 N', p: V.mul(V.add(V.add(v[0], v[2]), v[3]), 1 / 3) }, { name: '中心 O', p: [0, 0, 0] }, { name: '棱 T3T4 的中点', p: V.lerp(v[2], v[3], 0.5) }]; },
    stages: [
      { title: '构型与对称', q: 'P、M 两点到四个源电荷的距离各有什么关系？哪些分场强大小相等？',
        obs: '顶点 T1、T2、T3、T4 依次对应例题中的 A、B、C、D：T1、T3 带 −q，T2、T4 带 +q。P 是棱 T1T2 的中点，M 是面 T1T2T3 的中心（内切球的切点）。探针已放在 P，点击“显示探针到各源电荷的连线”读出各段距离；再把 u 改为 1/3，探针移到 M。',
        rec: '用棱长 ℓ 写出 P 到四个顶点的距离和 M 到四个顶点的距离，并指出哪几个分场强大小相等。',
        hint: 'P 到 T1、T2 的距离都是 ℓ/2，到 T3、T4 的距离都是 √3ℓ/2。M 到 T1、T2、T3 的距离都是 ℓ/√3，到 T4 的距离是正四面体的高 √(2/3)ℓ。距离相等、电荷量大小相等的源电荷，分场强大小相等。',
        teacher: '先让学生只用几何关系判断，不看场强读数。坐标尺度 a 与棱长的关系是 ℓ=2√2a，读数区同时给出两种长度。',
        preset: Object.assign({}, paper, { u: 0 }), layers: { probe: true }, actions: [probeLines(true), probeLines(false)] },
      { title: 'P 点的场强合成', q: 'P 点的合场强为零吗？按怎样的顺序把四个分场强合成？',
        obs: '探针在 P。点击“开始合成向导”：先合成共线的 E_T1 与 E_T2，再在 T3、T4 与 P 所在的平面内合成 E_T3 与 E_T4，最后合成两个部分和。',
        rec: '记录两个部分和的大小与方向、两个部分和的夹角，以及合场强 |E(P)| 与 kq/ℓ² 的比值。',
        hint: 'E_T1 与 E_T2 都由 T2 指向 T1，部分和为 8kq/ℓ²。E_T3 与 E_T4 大小都是 4kq/(3ℓ²)，部分和为 8kq/(3√3ℓ²)，方向由 T4 指向 T3。对棱 T1T2 与 T3T4 互相垂直，所以 $|\\vec E(P)|=\\frac{16\\sqrt{21}}{9}\\frac{kq}{\\ell^2}$，不为零。',
        teacher: '这一步针对“投影偏差”：学生常因 P 在图上看起来居中而认为合场强为零。例题选项 B 由此排除。',
        preset: Object.assign({}, paper, { u: 0 }), layers: { probe: true }, actions: [wizard] },
      { title: 'M 点的场强合成', q: '面 T1T2T3 的中心 M 处，合场强垂直于这个面吗？',
        obs: '探针已移到 M（u=1/3）。点击“开始合成向导”：先在面 T1T2T3 内合成三个大小相等的分场强，再与垂直于该面的 E_T4 合成。',
        rec: '记录面内部分和与垂直分量的大小、合场强与面 T1T2T3 法线的夹角。',
        hint: '面内三个分场强的大小都是 3kq/ℓ²，矢量和为 6kq/ℓ²，沿该面指向棱 T1T3。E_T4 垂直于该面，大小为 1.5kq/ℓ²。合场强与法线的夹角为 arctan 4，约 76°，所以合场强不垂直于面 T1T2T3。',
        teacher: '对应例题选项 C。可以让学生先猜“只有 T4 的分场强离开平面”，再由面内部分和不为零得出结论。',
        preset: Object.assign({}, paper, { u: 1 / 3 }), layers: { probe: true }, actions: [wizard] },
      { title: '由合场强方向判断电势', q: '正试探电荷由 P 移向 C（T3）时，电势升高还是降低？静电力做正功还是负功？',
        obs: '探针沿线段 PC 移动，先不看曲线。拖动 u，观察合场强与位移方向的夹角；M 在这条线段上（u=1/3）。',
        rec: '记录几个位置上合场强与 PC 方向的夹角，据此预测 V(P) 与 V(M) 的大小关系，以及正电荷由 P 移到 M 时静电力做功的正负。',
        hint: '沿场强方向电势降低。合场强与位移的夹角小于 90° 时，静电力对正电荷做正功，电势能减少。P 处的夹角约为 84°，接近直角，要读数而不要目测。',
        teacher: '对应例题选项 A、D。M 是三角形 T1T2T3 的重心，在中线 CP 上，所以由 P 到 C 的路径经过 M。',
        preset: Object.assign({}, paper, { u: 0 }), layers: { probe: true } },
      { title: '与计算结果对照', q: '代入 $V=\\sum kq_i/r_i$ 算出的 V(P)、V(M) 是否支持上一步的预测？',
        obs: '读数区列出 P、M 到各顶点的距离和两点的电势。曲线 V(u) 上标出了 P 与 M，橙色竖线是探针的位置。',
        rec: '用距离写出 V(P) 与 V(M) 的表达式并算出数值，与读数和曲线比较，再写出 W(P→M)=q₀[V(P)−V(M)]。',
        hint: 'V(P)=kq(−2/ℓ+2/ℓ−2/(√3ℓ)+2/(√3ℓ))=0。V(M)=kq(−√3/ℓ+√(3/2)/ℓ)≈−0.507kq/ℓ。所以 V(P) 大于 V(M)，正电荷由 P 移到 M 时静电力做正功。P 处电势为零而场强不为零，说明电势为零并不能推出场强为零。',
        teacher: '让学生把“方向判断”和“距离代入”两种方法的结论并列写出。若两者矛盾，先检查夹角读数与距离。',
        preset: Object.assign({}, paper, { u: 1 / 3 }), layers: { probe: true } },
      { title: '反例：四个同号电荷', q: '四个顶点都带 +q 时，沿 PC 的电势还单调降低吗？V(P) 还大于 V(M) 吗？',
        obs: '交替电荷已关闭，四个顶点都带 +q。拖动 u，比较合场强与 PC 方向的夹角和 V(u) 曲线；再关闭“探针沿线段 PC 移动”，让探针沿轴经过中心 O。',
        rec: '记录 P 处的夹角、V(P) 与 V(M)，说明上一结论依赖哪一种电荷配置；再记录中心 O 的 V 与 |E|。',
        hint: '同号时 P 处的夹角约为 145°，电势沿 PC 先升高，因此 V(M) 大于 V(P)，结论反过来。中心 O 的四个分场强矢量和为零，但 $V(O)=4kq/(\\sqrt3 a)$ 不为零。',
        teacher: '用同一几何、不同电荷配置给结论划定范围：对称性只告诉我们哪些量相等，正负号决定合场强的方向。',
        preset: Object.assign({}, paper, { alt: false, u: 0 }), layers: { probe: true } }
    ],
    readings(ctx) {
      const p = ctx.p, S = ctx.sample, v = verts(p.a), l = 2 * Math.SQRT2 * p.a, O = S([0, 0, 0]);
      const out = [['V(O)', O.V, 'kQ/L'], ['|E(O)|', V.len(O.E), 'kQ/L²'], ['E(O)', O.E, 'kQ/L²']];
      if (!p.alt && p.f === 1 && !ctx.custom) out.push(['理论值 4kq/(√3a)', 4 * p.q / (s3 * p.a), 'kQ/L'], ['中心检验残差', Math.abs(O.V - 4 * p.q / (s3 * p.a)) + V.len(O.E), '']);
      const Pp = midP(p.a), Mp = cenM(p.a), P = S(Pp), M = S(Mp), n = V.norm(V.cross(V.sub(v[1], v[0]), V.sub(v[2], v[0])));
      out.push(['棱长 ℓ=2√2a', l, 'L']);
      if (ctx.stage === 0 || ctx.stage === 4) {
        out.push(['PT1=PT2（ℓ/2）', V.dist(Pp, v[0]), 'L'], ['PT3=PT4（√3ℓ/2）', V.dist(Pp, v[2]), 'L'],
          ['MT1=MT2=MT3（ℓ/√3）', V.dist(Mp, v[0]), 'L'], ['MT4（√(2/3)ℓ）', V.dist(Mp, v[3]), 'L']);
      }
      out.push(['V(P)', P.V, 'kQ/L'], ['V(M)', M.V, 'kQ/L'], ['V(P)−V(M)', P.V - M.V, 'kQ/L'], ['W场(P→M)=q₀[V(P)−V(M)]', p.q0 * (P.V - M.V), 'kQ²/L'],
        ['|E(P)|', V.len(P.E), 'kQ/L²'], ['|E(P)|·ℓ²/|kq|', V.len(P.E) * l * l / Math.abs(p.q || NaN), '']);
      if (p.alt && p.f === 1 && !ctx.custom) out.push(['理论值 16√21/9', 16 * Math.sqrt(21) / 9, '']);
      out.push(['|E(M)|', V.len(M.E), 'kQ/L²'], ['E(M) 与面 T1T2T3 法线的夹角', Math.min(ang(M.E, n), 180 - ang(M.E, n)), '°'],
        ['E(P) 与 PC 方向的夹角', ang(P.E, V.sub(v[2], Pp)), '°']);
      if (ctx.probe && ctx.probe.path) out.push(['探针处 E 与路径方向的夹角', ang(ctx.probe.s.E, ctx.probe.path.d(ctx.probe.t)), '°']);
      return out;
    },
    curves(ctx) {
      const p = ctx.p;
      if (p.customProbe) return null;
      const pt = curPath(p), d = MH.alongPath(ctx.F, pt, 200), q0 = p.q0;
      if (p.pc) {
        const S = ctx.sample, l = V.len(pt.d());
        return { x: d.xs, xLabel: 'u（由 P 到 C，无量纲；弧长为 u·√6a）', cur: p.u,
          series: [{ name: 'V(u)', y: d.Vs, color: EL.CHART.V }, { name: 'U(u)', y: d.Vs.map(x => q0 * x), color: EL.CHART.U }, { name: 'E∥(u)', y: d.Es, color: EL.CHART.E }],
          points: [{ x: 0, y: S(midP(p.a)).V, name: 'P', color: EL.CHART.mark }, { x: 1 / 3, y: S(cenM(p.a)).V, name: 'M', color: EL.CHART.mark }],
          note: '沿线段 PC 的电势、电势能与场强沿路径的分量。PC 的长度为 ' + EL.U.fmt(l, 4) + ' L；靠近 C 时进入排除邻域。' };
      }
      return { x: d.xs, xLabel: 'λ / L', cur: p.lam,
        series: [{ name: 'V(λ)', y: d.Vs, color: EL.CHART.V }, { name: 'U(λ)', y: d.Vs.map(v => q0 * v), color: EL.CHART.U }, { name: 'E∥(λ)', y: d.Es, color: EL.CHART.E }],
        note: '横轴为 λ / L，λ 是沿顶点 T1 与中心连线量得的有向弧长。' };
    },
    extra(ctx) {
      const p = ctx.p, vs = verts(p.a), out = MH.poly(vs, FACES, { faces: p.faces && ctx.layers.geom, opacity: 0.2 });
      if (!ctx.layers.geom) out.lines = [];
      MH.mark(out, [0, 0, 0], 'O');
      if (p.alt || p.pc) { MH.mark(out, midP(p.a), 'P', null, 0.06); MH.mark(out, cenM(p.a), 'M', null, 0.06); }
      if (!p.customProbe) out.lines.push(...MH.pathLine(ctx.F, curPath(p), EL.C.path, [0.18, 0.12]));
      return out;
    },
    exercises: [
      { q: 'a=2 L 时，中心到顶点的距离是多少（单位 L）？', a: 2 * s3 },
      { q: 'a=2 L、q=1 Q 时，求中心的电势 V(O)（单位 kQ/L）。', a: 2 / s3 },
      { q: '四个源电荷的电荷量同时变号后，中心的场强怎样？', options: ['仍为零', '变为非零', '无法判断'], a: '仍为零' },
      { q: '只把 T1 的电荷量由 +q 改为 −q 时，中心场强的方向怎样？', options: ['指向 T1', '背离 T1', '为零'], a: '指向 T1' },
      { q: 'T1、T3 带 −q，T2、T4 带 +q，a=2 L、q=1 Q 时，求棱 T1T2 的中点 P 的场强大小（单位 kQ/L²）。', a: Math.sqrt(1 + 1 / 27) / 4 },
      { q: 'T1、T3 带 −q，T2、T4 带 +q 时，正试探电荷由 P 移到面 T1T2T3 的中心 M，静电力做什么功？', options: ['正功', '负功', '不做功'], a: '正功' }
    ]
  });
})(window.EL);
