'use strict';
// 正八面体顶点电荷（内部 ID 5，导航序号 05）：P 点与切点的三维场强合成、由合场强方向判断两切点间的电势变化、与计算结果对照
(function (EL) {
  const V = EL.V, MH = EL.MH, s3 = Math.sqrt(3), D2R = 180 / Math.PI;
  // 顶点顺序：M N F Q P R
  const verts = a => [[0, 0, a], [-a, 0, 0], [0, 0, -a], [a, 0, 0], [0, a, 0], [0, -a, 0]];
  const FACES = [[4, 0, 1], [3, 5, 2], [4, 0, 3], [4, 2, 1], [4, 2, 3], [5, 0, 1], [5, 0, 3], [5, 2, 1]];
  const mkPath = a => { const r = a / s3; return { key: 'tau', label: 'τ', unit: '', range: [-1, 1], pos: t => [-t * r / s3, t * r / s3, t * r / s3], d: () => [-r / s3, r / s3, r / s3] }; };
  const ang = (u, v) => V.len(u) > 1e-12 && V.len(v) > 1e-12 ? Math.acos(EL.U.clamp(V.dot(u, v) / V.len(u) / V.len(v), -1, 1)) * D2R : NaN;
  const base = { mode: true, removeM: false, a: 2, q: 1, q0: 1, customProbe: false, field: false };
  const atP = a => ({ customProbe: true, px: 0, py: a, pz: 0 });
  const probeLines = on => ({ label: on ? '显示探针到各源电荷的连线' : '隐藏探针到各源电荷的连线', run: ctx => { ctx.st.geo.probeLines = on; } });
  const wizard = { label: '开始合成向导', run: () => { const A = EL.App; if (A.setMode) A.setMode('analyze'); if (A.startWizard) A.startWizard(); } };
  const toP = { label: '探针放到 P', run: ctx => ctx.set(atP(ctx.p.a)) };
  const toT = { label: '探针放到切点 T_PMN', run: ctx => ctx.set({ customProbe: false, mode: true, tau: 1 }) };
  EL.defModel({
    id: 5, code: '05', order: 5, file: '05', title: '正八面体', short: 'P 点与内切球切点的三维场强合成、两切点间电势的变化与 P、R 的反射对称',
    view: '3d', R: 6, rMin: 0.2, perCharge: true, editor: { max: 24, qRange: [-10, 10], xyz: 6, placements: p => MH.placements(verts(p.a), FACES, p.a) },
    params: [
      { key: 'a', label: '中心到顶点的距离 a / L', min: 1, max: 4, step: 0.05, val: 2 },
      { key: 'q', label: '源电荷电荷量的大小 q / Q', min: 0.1, max: 2, step: 0.1, val: 1 },
      { key: 'q0', label: '试探电荷的电荷量 q₀ / Q', min: -2, max: 2, step: 0.1, val: -1, probe: true },
      { key: 'tau', label: '路径参数 τ（由 +1 到 −1）', min: -1, max: 1, step: 0.02, val: 0, show: p => p.mode && !p.customProbe, probe: true },
      ...MH.customProbe(6)
    ],
    toggles: [{ key: 'mode', label: '探针沿内切球的直径移动', val: false }, { key: 'removeM', label: '移除顶点 M 上的源电荷', val: false },
      { key: 'sphere', label: '显示内切球', val: true }, { key: 'faces', label: '显示着色的表面', val: true }, { key: 'field', label: '显示 P、R 和两切点处的场强矢量', val: false }, MH.customToggle],
    display: { level: 0, spacing: 0.3, count: 1 },
    probe: { pathFn: p => mkPath(p.a), free: ['px', 'py', 'pz'], customKey: 'customProbe', fromStage: 0, when: p => p.mode || p.customProbe,
      nameFn: () => { const p = EL.App.st && EL.App.st.p; return p && Math.abs(p.tau - 1) < 1e-6 ? 'T_PMN' : p && Math.abs(p.tau + 1) < 1e-6 ? 'T_QRF' : 'X'; } },
    paths: p => [mkPath(p.a)],
    keyPts: p => { const v = verts(p.a); return [{ name: '中心 O', p: [0, 0, 0] }, { name: '不带电的顶点 P', p: v[4] }, { name: '不带电的顶点 R', p: v[5] }, { name: '面 PMN 上的切点 T_PMN', p: [-p.a / 3, p.a / 3, p.a / 3] }, { name: '面 QRF 上的切点 T_QRF', p: [p.a / 3, -p.a / 3, -p.a / 3] }]; },
    sources(p) {
      const v = verts(p.a);
      return [{ p: v[0], q: p.removeM ? 0 : p.q, label: 'M' }, { p: v[1], q: p.q, label: 'N' }, { p: v[2], q: -p.q, label: 'F' }, { p: v[3], q: -p.q, label: 'Q' }];
    },
    stages: [
      { title: '构型与对称', q: 'P 和切点 T_PMN 到四个源电荷的距离各有什么关系？',
        obs: 'M、N 带 +q，F、Q 带 −q，四个带电顶点都在平面 y=0 内；P、R 不带电。探针已放在 P，点击“显示探针到各源电荷的连线”读出距离；再点击“探针放到切点 T_PMN”。',
        rec: '用 a 写出 P 到四个源电荷的距离、T_PMN 到 M、N 和到 F、Q 的距离，并指出哪几个分场强大小相等。',
        hint: 'P 到四个源电荷的距离都是 √2a。T_PMN 是面 PMN 的中心，到 M、N 的距离都是 √6a/3，到 F、Q 的距离都是 √2a。中心 O 到四个源电荷的距离都是 a。',
        teacher: '先让学生用几何关系判断，再读连线上的距离核对。注意 P、R 关于平面 y=0 互为镜像。',
        preset: Object.assign({}, base, atP(2)), layers: { probe: true }, actions: [probeLines(true), probeLines(false), toT, toP] },
      { title: 'P 点与切点的场强合成', q: 'P 点的合场强沿什么方向？切点 T_PMN 的合场强又怎样合成？',
        obs: '探针在 P。点击“开始合成向导”：先合成 E_M 与 E_N，再合成 E_F 与 E_Q，最后合成两个部分和。完成后点击“探针放到切点 T_PMN”，重复一次。',
        rec: '记录 P 处两个部分和的大小与夹角、合场强的大小和方向；记录 T_PMN 处两个部分和的大小与合场强。',
        hint: 'P 处四个分场强大小都是 kq/(2a²)，两个部分和大小相等，其关系由合成向导中的场源距离推导（109.5°仅作数值核对），合场强大小为 kq/a²，平行于 MQ，与 PR 垂直。T_PMN 处 M、N 的部分和大于 F、Q 的部分和，合场强指向八面体内部，与由 T_PMN 到 T_QRF 的方向夹角约为 66°。',
        teacher: '强调“大小相等的分场强先两两合成”。P 处的合场强垂直于 PR 是下一步比较 V(P)、V(R) 的依据。',
        preset: Object.assign({}, base, atP(2)), layers: { probe: true }, actions: [wizard, toT, toP] },
      { title: '由合场强方向判断电势', q: '正试探电荷沿内切球的直径由 T_PMN 移到 T_QRF，电势升高还是降低？由 P 移到 R 呢？',
        obs: '探针沿内切球的直径移动，先不看曲线。把 τ 由 +1 拖到 −1，观察合场强与位移方向的夹角。',
        rec: '记录几个位置上合场强与位移方向的夹角，预测两切点电势的高低和静电力对正电荷做功的正负；再根据 P 处的合场强方向，预测 V(P) 与 V(R) 的关系。',
        hint: '沿场强方向电势降低。两切点之间夹角始终小于 90°（约 35° 到 66°），所以电势单调降低，静电力对正电荷做正功。y 轴上合场强没有 y 分量，与 PR 垂直，所以 P、R 等势。',
        teacher: '同一个模型里给出两种情形：夹角为锐角时电势降低，夹角为直角时电势不变。',
        preset: Object.assign({}, base, { tau: 1 }), layers: { probe: true } },
      { title: '与计算结果对照', q: '代入 $V=\\sum kq_i/r_i$ 算出的两切点电势和功，是否与预测一致？',
        obs: '读数区给出两切点的电势、两切点间静电力做的功和 P、R 的电势；曲线区给出沿直径的 V(t)。改变 q₀ 的正负再看一次。',
        rec: '用距离写出 V(T_PMN) 的表达式并算出数值，与读数和曲线比较；写出 $W=q_0[V(T_{PMN})-V(T_{QRF})]$，说明 q₀ 变号后哪些量改变。',
        hint: '$V(T_{PMN})=kq(2\\cdot\\frac{3}{\\sqrt6 a}-2\\cdot\\frac{1}{\\sqrt2 a})=(\\sqrt6-\\sqrt2)\\frac{kq}{a}$。由反演反对称，$V(T_{QRF})=-V(T_{PMN})$。P 到四个源电荷等距，正负电荷量之和为零，所以 V(P)=V(R)=0。',
        teacher: '改变 q₀ 只改变 U 与 W，不改变源电荷产生的 V 和 E。',
        preset: Object.assign({}, base, { tau: 0 }), layers: { probe: true } },
      { title: '扰动：移除 M', q: '移除 M 上的源电荷后，哪些结论仍然成立？',
        obs: '已移除 M 上的源电荷。比较两切点的电势、两切点间电势的变化，以及 P、R 两点的电势。',
        rec: '分别检验 P、R 是否仍然等势、两切点的电势是否仍互为相反数，以及两切点之间电势是否仍单调降低；引用读数说明。',
        hint: '移除 M 后，关于中心反演时电荷变号的对称性被破坏，两切点的电势不再互为相反数。三个剩余的源电荷仍在平面 y=0 内，关于该平面的反射对称仍然保持，所以 P、R 仍然等势。',
        teacher: '要求学生分别说明两种对称：不要笼统地说“对称性都消失了”。',
        preset: Object.assign({}, base, { removeM: true, tau: 1 }), layers: { probe: true } }
    ],
    readings(ctx) {
      const p = ctx.p, S = ctx.sample, v = verts(p.a), path = mkPath(p.a), out = [];
      const O = S([0, 0, 0]), P = S(v[4]), R = S(v[5]);
      out.push(['V(O)', O.V, 'kQ/L'], ['E(O)', O.E, 'kQ/L²'], ['V(P)', P.V, 'kQ/L'], ['V(R)', R.V, 'kQ/L'], ['ΔV(P,R)=V(R)−V(P)', R.V - P.V, 'kQ/L'], ['ΔU(P→R)=q₀ΔV', p.q0 * (R.V - P.V), 'kQ²/L'],
        ['|E(P)|', V.len(P.E), 'kQ/L²'], ['E(P) 与 PR 方向的夹角', ang(P.E, V.sub(v[5], v[4])), '°']);
      if (!p.removeM) out.push(['理论值 kq/a²', p.q / (p.a * p.a), 'kQ/L²']);
      if (ctx.probe && ctx.probeVisible && (ctx.stage === 0 || ctx.stage === 3)) for (const s of ctx.sources) if (s.q) out.push(['探针到 ' + s.label + ' 的距离', V.dist(ctx.probe.pos, s.p), 'L']);
      if (p.mode) {
        const a = S(path.pos(1)), b = S(path.pos(-1)), W = p.q0 * (a.V - b.V);
        out.push(['V(T_PMN)', a.V, 'kQ/L'], ['V(T_QRF)', b.V, 'kQ/L'], ['W场（τ: +1→−1）', W, 'kQ²/L'], ['ΔU_T=−W', -W, 'kQ²/L'],
          ['反演反对称残差 |V(−0.7)+V(0.7)|', Math.abs(S(path.pos(-0.7)).V + S(path.pos(0.7)).V), 'kQ/L'], ['内切球半径 a/√3', p.a / s3, 'L'], ['当前弧长 t=τa/√3', p.tau * p.a / s3, 'L']);
        if (!p.removeM) out.push(['理论值 (√6−√2)kq/a', (Math.sqrt(6) - Math.SQRT2) * p.q / p.a, 'kQ/L']);
        if (ctx.probe && ctx.probe.path) out.push(['探针处 E 与位移方向（τ 减小）的夹角', ang(ctx.probe.s.E, V.mul(path.d(p.tau), -1)), '°']);
      }
      return out;
    },
    curves(ctx) {
      const p = ctx.p;
      if (!p.mode || p.customProbe) return null;
      const path = mkPath(p.a), d = MH.alongPath(ctx.F, path, 200), r = p.a / s3;
      return { x: d.xs.map(t => t * r), xLabel: 't / L（t=τa/√3）', cur: p.tau * r,
        series: [{ name: 'V(t)', y: d.Vs, color: EL.CHART.V }, { name: 'U(t)', y: d.Vs.map(v => p.q0 * v), color: EL.CHART.U }, { name: 'E∥(t)', y: d.Es, color: EL.CHART.E }],
        points: [{ x: r, y: ctx.sample(path.pos(1)).V, name: 'T_PMN', color: EL.CHART.mark }, { x: -r, y: ctx.sample(path.pos(-1)).V, name: 'T_QRF', color: EL.CHART.mark }],
        note: '沿内切球直径的电势、电势能与场强沿 t 增大方向的分量。τ=+1 对应面 PMN 上的切点。' };
    },
    extra(ctx) {
      const p = ctx.p, v = verts(p.a), out = MH.poly(v, FACES, { faces: p.faces && ctx.layers.geom, opacity: 0.16 });
      if (!ctx.layers.geom) out.lines = [];
      MH.mark(out, [0, 0, 0], 'O'); MH.mark(out, v[4], 'P'); MH.mark(out, v[5], 'R');
      const path = mkPath(p.a), T1 = path.pos(1), T2 = path.pos(-1);
      if (p.mode) {
        if (p.sphere && ctx.layers.geom) out.meshes.push({ mesh: ctx.cached('insph' + p.a, () => EL.ISO.sphere([0, 0, 0], p.a / s3, 28)), color: [EL.C.pot[0], EL.C.pot[1], EL.C.pot[2], 0.12] });
        MH.mark(out, T1, 'T_PMN', EL.C.energy); MH.mark(out, T2, 'T_QRF', EL.C.energy);
        out.lines.push(...MH.pathLine(ctx.F, path, EL.C.path));
      }
      if (p.field) {
        out.arrows = [];
        for (const q of [v[4], v[5], T1, T2]) { const s = ctx.sample(q); if (s.ok) out.arrows.push({ p: q, v: ctx.arrowVec(s.E), color: EL.C.vec, width: 2.2 }); }
      }
      return out;
    },
    exercises: [
      { q: 'a=3 L 时，求内切球的半径（单位 L）。', a: s3 },
      { q: 'a=√3 L，沿路径 dV/dτ=−2 kQ/L，求场强沿路径的分量 E∥（单位 kQ/L²）。', a: 2 },
      { q: '移除 M 上的源电荷后，P、R 两点的电势怎样？', options: ['仍相等', '不再相等', '都为零'], a: '仍相等' },
      { q: '两切点的电势分别为 +2 kQ/L（τ=+1 处）和 −2 kQ/L（τ=−1 处），q₀=−1 Q，求试探电荷由 τ=+1 移到 τ=−1 的过程中静电力做的功 W（单位 kQ²/L）。', a: -4 },
      { q: 'a=2 L、q=1 Q 时，求不带电顶点 P 处的场强大小（单位 kQ/L²）。', a: 0.25 }
    ]
  });
})(window.EL);
