'use strict';
// 正六面体面心电荷（内部 ID 6，导航序号 04）：沿体对角线 A′C 的三维场强合成、由合场强方向判断电势、与计算结果对照
(function (EL) {
  const V = EL.V, MH = EL.MH, s3 = Math.sqrt(3), D2R = 180 / Math.PI;
  const NAMES = ['A', 'B', 'C', 'D', 'A′', 'B′', 'C′', 'D′'];
  const verts = a => [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]].map(v => V.mul(v, a / 2));
  const FACES = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
  const pathA = a => ({ key: 's', label: 's', unit: '', range: [0, 1], pos: s => V.mul([1, 1, 1], -a / 2 + a * s), d: () => [a, a, a] });
  const pathB = a => ({ key: 't', label: 't', unit: '', range: [0, 1], pos: t => [-a / 2 + a * t, a / 2 - a * t, a / 2 - a * t], d: () => [a, -a, -a] });
  const ang = (u, v) => V.len(u) > 1e-12 && V.len(v) > 1e-12 ? Math.acos(EL.U.clamp(V.dot(u, v) / V.len(u) / V.len(v), -1, 1)) * D2R : NaN;
  const base = { removeGH: false, useB: false, a: 2, q: 1, q0: 1, customProbe: false, field: false };
  const probeLines = on => ({ label: on ? '显示探针到各源电荷的连线' : '隐藏探针到各源电荷的连线', run: ctx => { ctx.st.geo.probeLines = on; } });
  const wizard = { label: '开始合成向导', run: () => { const A = EL.App; if (A.setMode) A.setMode('analyze'); if (A.startWizard) A.startWizard(); } };
  const freeProbe = { label: '改用自由探针', run: ctx => { const x = pathA(ctx.p.a).pos(ctx.p.s); ctx.set({ customProbe: true, px: +x[0].toFixed(3), py: +x[1].toFixed(3), pz: +(x[2] + 0.4).toFixed(3) }); } };
  const backToPath = { label: '回到路径点', run: ctx => ctx.set({ customProbe: false }) };
  EL.defModel({
    id: 6, code: '04', order: 4, file: '06', title: '正六面体', short: '面心上的点电荷：体对角线 A′C 上的场强合成、合场强与路径的夹角、电势曲线与扰动',
    view: '3d', R: 6, rMin: 0.2, perCharge: true, editor: { max: 24, qRange: [-10, 10], xyz: 6, placements: p => MH.placements(verts(p.a), FACES, s3 * p.a / 2) },
    params: [
      { key: 'a', label: '棱长 a / L', min: 1, max: 5, step: 0.05, val: 2 },
      { key: 'q', label: '源电荷的电荷量 q / Q', min: -2, max: 2, step: 0.1, val: 1 },
      { key: 'q0', label: '路径 A 上试探电荷的电荷量 q₀ / Q', min: -2, max: 2, step: 0.1, val: -1, show: p => !p.useB, probe: true },
      { key: 'q0B', label: '路径 B 上试探电荷的电荷量 q₀B / Q', min: -2, max: 2, step: 0.1, val: 1, show: p => p.useB, probe: true },
      { key: 's', label: '路径 A 的参数 s（由 A′ 到 C）', min: 0, max: 1, step: 0.01, val: 0, show: p => !p.useB && !p.customProbe, probe: true },
      { key: 't', label: '路径 B 的参数 t（由 D 到 B′）', min: 0, max: 1, step: 0.01, val: 0, show: p => p.useB && !p.customProbe, probe: true },
      ...MH.customProbe(6)
    ],
    toggles: [{ key: 'useB', label: '探针沿路径 B（由 D 到 B′）移动', val: false }, { key: 'removeGH', label: '移除 G、H 上的源电荷', val: false },
      { key: 'faces', label: '显示着色的表面', val: true }, { key: 'field', label: '显示 D、B′ 处的场强矢量', val: false }, MH.customToggle],
    display: { level: 0, spacing: 0.3, count: 1 },
    probe: { pathFn: p => p.useB ? pathB(p.a) : pathA(p.a), free: ['px', 'py', 'pz'], customKey: 'customProbe', fromStage: 0, nameFn: () => 'S' },
    paths: p => [pathA(p.a), pathB(p.a)],
    keyPts: p => { const v = verts(p.a); return [{ name: '中心 O', p: [0, 0, 0] }, { name: '顶点 A', p: v[0] }, { name: '顶点 C', p: v[2] }, { name: '顶点 D', p: v[3] }, { name: '顶点 A′', p: v[4] }, { name: '顶点 B′', p: v[5] }]; },
    sources(p) {
      const h = p.a / 2, g = p.removeGH ? 0 : -p.q;
      return [{ p: [0, 0, h], q: p.q, label: 'E' }, { p: [0, 0, -h], q: p.q, label: 'F' }, { p: [-h, 0, 0], q: g, label: 'G' }, { p: [h, 0, 0], q: g, label: 'H' }];
    },
    stages: [
      { title: '构型与对称', q: '体对角线 A′C 上的一点 S 到四个源电荷的距离有什么关系？',
        obs: '上、下两个面的中心 E、F 带 +q，左、右两个面的中心 G、H 带 −q；彩色的面只是几何参照，本身不带电。探针（路径点 S）在体对角线 A′C 上，点击“显示探针到各源电荷的连线”读出距离，再拖动 s。',
        rec: '记录 S 在两三个位置时到 E、F、G、H 的距离，找出始终相等的两对距离，并写出每一对源电荷的电荷量。',
        hint: 'S 的三个坐标相等，所以把 x 与 z 互换时 S 不动，而 E 与 H、F 与 G 互换位置。因此 SE=SH、SF=SG，每一对都是一正一负、电荷量大小相等的源电荷。',
        teacher: '让学生先用坐标对称说明距离相等，再用连线读数核对。A′C 是体对角线，长度为 √3a。',
        preset: Object.assign({}, base, { s: 0.25 }), layers: { probe: true }, actions: [probeLines(true), probeLines(false)] },
      { title: '路径点的场强合成', q: '路径点 S 的合场强指向哪里？它与体对角线 A′C 是什么关系？',
        obs: '探针在 s=0.25。点击“开始合成向导”：先合成距离相等的 E_F 与 E_G，再合成 E_E 与 E_H，最后合成两个部分和。',
        rec: '记录两个部分和的大小与方向、合场强的大小，以及合场强与 A′C 方向的夹角。',
        hint: 'F、G 距离相等、电荷量相反，部分和沿 F 指向 G 的方向；E、H 的部分和沿 E 指向 H 的方向。这两个方向都与体对角线方向 (1,1,1) 垂直，所以合场强垂直于 A′C。',
        teacher: '合场强不为零，但方向与路径垂直。这正是下一步判断电势的依据。',
        preset: Object.assign({}, base, { s: 0.25 }), layers: { probe: true }, actions: [wizard] },
      { title: '由合场强方向判断电势', q: '正试探电荷沿 A′C 由 A′ 移到 C，电势怎样变化？静电力做功吗？',
        obs: '拖动 s，观察合场强与位移方向的夹角，先不看曲线。再点击“改用自由探针”，在空间中任意拖动自由探针 P，比较它沿场强方向移动一小段后电势的变化。',
        rec: '记录路径上几个位置的夹角，预测 V(s) 曲线的形状，以及由 A′ 到 C 静电力做的功；记录自由探针的“沿 E 移动 0.05 L 后的电势变化”。',
        hint: '在每一点，静电力做功的快慢由场强与位移夹角的余弦决定。夹角处处为 90° 时，静电力不做功，电势沿路径不变。自由探针沿 E 移动后电势总是降低，说明场强由高电势处指向低电势处。',
        teacher: '常见错误是认为沿体对角线电势单调变化。这里的合场强不为零，但始终与路径垂直。',
        preset: Object.assign({}, base, { s: 0.25 }), layers: { probe: true }, actions: [freeProbe, backToPath] },
      { title: '与计算结果对照', q: '用距离代入 $V=\\sum kq_i/r_i$ 算出的 V(s) 是否与预测一致？',
        obs: '读数区列出路径点 S 到四个源电荷的距离和按公式算出的电势；曲线区给出 V(s) 与场强沿路径的分量 E∥(s)。',
        rec: '任取一个 s，用距离写出 V(S) 的表达式并算出数值；记录 V(A′)、V(C) 与由 A′ 到 C 静电力做的功，并改变 q₀ 检验功仍为零。',
        hint: 'SE=SH、SF=SG，所以 $V=kq(1/SE+1/SF-1/SG-1/SH)=0$。V(s) 是一条水平直线，E∥(s) 处处为零，与由夹角作出的预测一致。',
        teacher: '提醒学生区分“电势为零”和“场强为零”：路径上电势处处为零，但只有中心 O 的场强为零。',
        preset: Object.assign({}, base, { s: 0.25 }), layers: { probe: true } },
      { title: '扰动：移除 G、H', q: '只保留 E、F 两个正电荷时，沿 A′C 的电势还不变吗？',
        obs: '已移除 G、H 上的源电荷。拖动 s，先观察合场强与位移方向的夹角怎样变化，再看 V(s) 曲线。',
        rec: '记录 s 小于 0.5 和大于 0.5 时的夹角范围、V(A′)、V(O)、V(C)，以及由 A′ 到 O 和由 O 到 C 两段静电力对正电荷做功的正负。',
        hint: '前半段夹角大于 90°，电势升高；后半段夹角小于 90°，电势降低。V(s) 在中心 O 达到最大值，所以电势沿 A′C 不单调。A′ 与 C 关于中心对称，两端电势相等，全程做功仍为零。',
        teacher: '同一路径，去掉一对源电荷后对称条件改变，电势曲线由水平直线变为先升后降。用它说明结论依赖电荷配置。',
        preset: Object.assign({}, base, { removeGH: true, s: 0.25 }), layers: { probe: true } },
      { title: '拓展：路径 B 与中心反演', q: '移除 G、H 前后，顶点 D 与 B′ 的场强是否都大小相等、方向相反？',
        obs: '探针沿另一条体对角线 DB′ 移动。先保留四个源电荷，再移除 G、H，分别比较 D 与 B′ 处场强的大小和两个场强矢量的和。',
        rec: '记录两点场强的大小、两场强矢量和的大小，以及由 D 到 B′ 静电力做的功，说明两种情形下的结论和原因。',
        hint: 'D 与 B′ 关于中心对称。E、F 是一对同号源电荷，G、H 也是一对同号源电荷，关于中心反演时每一对都互换位置。所以电势关于中心是偶函数，场强是奇函数。',
        teacher: '可作课后任务。两场强大小相等还不足以说明方向相反，要检验两场强的矢量和是否为零。',
        preset: Object.assign({}, base, { useB: true, q0B: 1, t: 0.25, field: true }), layers: { probe: true } }
    ],
    readings(ctx) {
      const p = ctx.p, S = ctx.sample, v = verts(p.a), out = [];
      const A = S(v[0]), C = S(v[2]), Ap = S(v[4]), D = S(v[3]), Bp = S(v[5]), O = S([0, 0, 0]);
      if (ctx.stage === 0) out.push(['V(A)', A.V, 'kQ/L'], ['ΔV(A,C)=V(C)−V(A)', C.V - A.V, 'kQ/L']);
      if (ctx.probe && !p.customProbe && !p.useB && ctx.probeVisible) {
        const x = ctx.probe.pos, r = ctx.sources.map(s => [s.label, V.dist(x, s.p), s.q]);
        for (const [n, d] of r) out.push(['S' + n, d, 'L']);
        out.push(['Σkqᵢ/rᵢ（按距离计算）', r.reduce((t, [, d, q]) => t + (q ? q / d : 0), 0), 'kQ/L'], ['E(S) 与 A′C 方向的夹角', ang(ctx.probe.s.E, [1, 1, 1]), '°']);
      }
      if (!p.useB) out.push(['V(A′)', Ap.V, 'kQ/L'], ['V(O)', O.V, 'kQ/L'], ['V(C)', C.V, 'kQ/L'], ['ΔU(A′→C)=q₀[V(C)−V(A′)]', p.q0 * (C.V - Ap.V), 'kQ²/L'],
        ['W场(A′→O)=q₀[V(A′)−V(O)]', p.q0 * (Ap.V - O.V), 'kQ²/L'], ['W场(O→C)=q₀[V(O)−V(C)]', p.q0 * (O.V - C.V), 'kQ²/L']);
      if (p.customProbe && ctx.probe && ctx.probe.s.ok && V.len(ctx.probe.s.E) > 1e-9) {
        const y = S(V.addS(ctx.probe.pos, V.norm(ctx.probe.s.E), 0.05));
        out.push(['沿 E 移动 0.05 L 后的电势变化', y.ok ? y.V - ctx.probe.s.V : NaN, 'kQ/L']);
      }
      if (p.useB) {
        out.push(['W场(D→B′)=q₀B[V(D)−V(B′)]', p.q0B * (D.V - Bp.V), 'kQ²/L'], ['|E(D)|', V.len(D.E), 'kQ/L²'], ['|E(B′)|', V.len(Bp.E), 'kQ/L²'],
          ['|E(D)+E(B′)|', V.len(V.add(D.E, Bp.E)), 'kQ/L²']);
      }
      out.push(['路径长度 √3a', s3 * p.a, 'L']);
      return out;
    },
    curves(ctx) {
      const p = ctx.p;
      if (p.customProbe) return null;
      const path = p.useB ? pathB(p.a) : pathA(p.a), d = MH.alongPath(ctx.F, path, 200), q0 = p.useB ? p.q0B : p.q0;
      return { x: d.xs, xLabel: p.useB ? 't（由 D 到 B′，无量纲）' : 's（由 A′ 到 C，无量纲）', cur: p.useB ? p.t : p.s,
        series: [{ name: 'V', y: d.Vs, color: EL.CHART.V }, { name: 'U', y: d.Vs.map(v => q0 * v), color: EL.CHART.U }, { name: 'E∥', y: d.Es, color: EL.CHART.E }],
        points: p.useB ? [] : [{ x: 0.5, y: ctx.sample([0, 0, 0]).V, name: 'O', color: EL.CHART.mark }],
        note: (p.useB ? '路径 B' : '路径 A') + '上的电势 V、电势能 U 与场强沿路径的分量 E∥（按单位弧长）。横轴为无量纲的路径参数，弧长等于参数乘以 √3a。' };
    },
    extra(ctx) {
      const p = ctx.p, v = verts(p.a), out = MH.poly(v, FACES, { faces: p.faces && ctx.layers.geom, opacity: 0.12 });
      if (!ctx.layers.geom) out.lines = [];
      v.forEach((q, i) => { if (![1, 6, 7].includes(i)) MH.mark(out, q, NAMES[i], null, 0.06); });
      MH.mark(out, [0, 0, 0], 'O', null, 0.05);
      out.lines.push(...MH.pathLine(ctx.F, pathA(p.a), EL.C.path), ...MH.pathLine(ctx.F, pathB(p.a), EL.C.energy, [0.2, 0.14]));
      if (p.field) {
        out.arrows = [];
        for (const q of [v[3], v[5]]) { const s = ctx.sample(q); if (s.ok) out.arrows.push({ p: q, v: ctx.arrowVec(s.E), color: EL.C.vec, width: 2.4 }); }
      }
      return out;
    },
    exercises: [
      { q: 'a=2 L 时，每条体对角线的长度是多少（单位 L）？', a: 2 * s3 },
      { q: 'a=2 L，沿路径 A 有 dV/ds=−2√3 kQ/L，求场强沿路径 A 的分量 E∥（单位 kQ/L²）。', a: 1 },
      { q: '四个源电荷都存在时，正试探电荷沿体对角线由 A′ 移到 C，静电力做的功怎样？', options: ['为零', '为正', '为负'], a: '为零' },
      { q: '只保留 E、F 上的源电荷时，沿体对角线 A′C 的电势怎样变化？', options: ['先升高后降低', '单调降低', '保持不变'], a: '先升高后降低' },
      { q: '只保留 E、F 上的源电荷时，D 与 B′ 处的场强矢量有什么关系？', options: ['等大反向', '完全相同', '大小不等'], a: '等大反向' },
      { q: '图中彩色的面起什么作用？', options: ['几何参照，不连续带电', '均匀带电面', '导体屏蔽'], a: '几何参照，不连续带电' }
    ]
  });
})(window.EL);
