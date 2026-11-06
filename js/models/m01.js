'use strict';
// 01 点电荷与偶极子
(function (EL) {
  const V = EL.V, MH = EL.MH;
  const probe = ['px', 'py', 'pz'];
  EL.defModel({
    id: 1, code: '01', order: 1, file: '01', title: '点电荷与偶极子', short: '单个点电荷、距离比、电偶极子与等势线截面',
    view: '3d', R: 6, rMin: 0.25, perCharge: true, editor: { max: 6, qRange: [-2, 2], xyz: 8 },
    params: [
      { key: 'n', label: '源电荷的个数 N', min: 1, max: 6, step: 1, val: 2, hideCustom: true },
      { key: 'd', label: '两源电荷的间距 d / L', min: 1, max: 8, step: 0.1, val: 4, hideCustom: true },
      { key: 'q1', label: '源电荷 Q₁ 的电荷量 / Q', min: -2, max: 2, step: 0.1, val: 1, hideCustom: true },
      { key: 'q2', label: '源电荷 Q₂ 的电荷量 / Q', min: -2, max: 2, step: 0.1, val: -1, hideCustom: true },
      { key: 'px', label: '探针的 x 坐标 / L', min: -6, max: 6, step: 0.05, val: 0, probe: true },
      { key: 'py', label: '探针的 y 坐标 / L', min: -6, max: 6, step: 0.05, val: 1, probe: true },
      { key: 'pz', label: '探针的 z 坐标 / L', min: -6, max: 6, step: 0.05, val: 0, probe: true }
    ],
    display: { level: 0, spacing: 0.25, count: 1 },
    probe: { free: probe },
    keyPts: p => [{ name: '原点 O（两源电荷连线的中点）', p: [0, 0, 0] }, { name: 'B 点 (d/2, 0, 0)', p: [p.d / 2, 0, 0] }, { name: 'P+ 点 (0, d/2, 0)', p: [0, p.d / 2, 0] }, { name: 'P− 点 (0, −d/2, 0)', p: [0, -p.d / 2, 0] }],
    sources(p) {
      const d = p.d, def = [[-d / 2, 0, 0], [d / 2, 0, 0], [0, 2, 0], [0, -2, 0], [0, 0, 2], [0, 0, -2]];
      const qs = [p.q1, p.q2, 1, 1, 1, 1];
      return def.slice(0, p.n).map((x, i) => ({ p: x, q: qs[i], label: 'Q' + (i + 1) }));
    },
    stages: [
      { title: '单个点电荷', q: '单个点电荷的等势面是什么形状？',
        obs: '令 Q₂ 的电荷量为零，只保留源电荷 Q₁。先写下预测，再依次显示电场线和等势面加以检验；也可以改变电荷量或添加源电荷。',
        rec: '记录 V(O) 和 |E(O)|。改变所选等势面的电势值，比较等势面的变化；添加源电荷后，重新检验单个点电荷的结论。',
        hint: '单个点电荷的电势为 $V=kq/r$。只有电势值与 q 同号且不为零时，等势面才是半径有限的球面。场强之比以读数为准。',
        preset: { n: 2, q1: 1, q2: 0, d: 4 }, display: { level: 0, spacing: 0.25, count: 2 } },
      { title: '距离与电势、场强', q: '到点电荷的距离加倍时，电势和场强各怎样变化？',
        obs: '保持标准位置，并令 Q₂ 的电荷量为零。O 点到 Q₁ 的距离为 d/2，B 点 (d/2, 0, 0) 到 Q₁ 的距离为 d。',
        rec: '比较两点的 V 与 |E|，再改变 d 或 Q₁ 的电荷量。改变源电荷的位置或增加源电荷后，这组距离比不再适用。',
        hint: '只有一个电荷量不为零的源电荷且保持标准位置时，V(O)/V(B) 等于 2，|E(O)|/|E(B)| 等于 4。电荷量为零时，这两个比值没有意义。',
        preset: { n: 2, q1: 1, q2: 0, d: 4 } },
      { title: '电偶极子', q: '电势为零的点，场强是否一定为零？',
        obs: '恢复标准的等量异号两个源电荷。比较中点 O 的电势与场强，再用等势线和三维等势面观察电势的空间分布。',
        rec: '找出 V(O) 为零而 |E(O)| 不为零的读数。改变电荷量或位置后，检验哪些结论仍然成立。',
        hint: '在标准的等量异号源电荷之间，两分场强在 O 点方向相同，而两源电荷在 O 点的电势相互抵消。零等势面是两源电荷连线的中垂面，它无界。因此电势为零不能推出场强为零。',
        preset: { n: 2, q1: 1, q2: -1, d: 4 }, display: { level: 0, spacing: 0.3, count: 1 } },
      { title: '等势线截面', q: '同一电势分布在不同高度的截面上怎样变化？', view: '2d',
        obs: '在三维视图或二维截面中，调节截面位置、电势值的偏移量和每个源电荷对应的等势面个数（1～5 个）。电场线和等势面可以分别显示。',
        rec: '比较不同高度截面上的等势线。某处没有等势线时，判断原因是该电势值无解、等势线超出视窗，还是该处在源电荷附近的未定义区域内。',
        hint: '等势线由当前源电荷的三维电势计算得到。三维视图显示空间中的电场线，二维截面显示电场强度在截面内的分量所形成的流线。等势面有几个连通部分，由实际的电势分布决定。',
        preset: { n: 2, q1: 1, q2: -1, d: 4 } },
      { title: '对称点检验', q: '关于 xz 平面对称的两点，哪些读数相同？',
        obs: '先在标准的两个源电荷下比较 P+ (0, d/2, z) 与 P− (0, −d/2, z)，再编辑源电荷坐标或增加源电荷，检验关于 xz 平面的反射对称是否仍然保持。',
        rec: '比较两点的 V、|E| 与 E_y，并说明当前的源电荷配置是否关于 xz 平面对称。',
        hint: '只有当源电荷的位置和电荷量都关于 xz 平面对称时，两点的 V 与 |E| 才相同，E_y 互为相反数。自定义的源电荷配置需要重新检验。',
        preset: { n: 2, q1: 1, q2: -1, d: 4 } }
    ],
    readings(ctx) {
      const p = ctx.p, S = ctx.sample, O = S([0, 0, 0]), out = [];
      if (ctx.stage === 0) {
        const one = ctx.sources.filter(s => s.q);
        const R = one.length === 1 && ctx.levels.length ? one[0].q / ctx.levels.find(v => v * one[0].q > 0) : NaN;
        out.push(['V(O)', O.V, 'kQ/L'], ['|E(O)|', V.len(O.E), 'kQ/L²'], ['第一个等势面（球面）的半径', R > ctx.rMin ? R : NaN, 'L']);
      } else if (ctx.stage === 1) {
        const B = S([p.d / 2, 0, 0]);
        out.push(['V(O)', O.V, 'kQ/L'], ['|E(O)|', V.len(O.E), 'kQ/L²'], ['V(B)', B.V, 'kQ/L'], ['|E(B)|', V.len(B.E), 'kQ/L²'],
          ['V(O)/V(B)', O.V / B.V, ''], ['|E(O)|/|E(B)|', V.len(O.E) / V.len(B.E), '']);
      } else if (ctx.stage === 2) {
        out.push(['V(O)', O.V, 'kQ/L'], ['|E(O)|', V.len(O.E), 'kQ/L²'], ['E(O)', O.E, 'kQ/L²']);
      } else if (ctx.stage === 3) {
        out.push(['第一个等势面的电势', ctx.levels[0], 'kQ/L'], ['截面', ctx.st.plane + ' 平面，' + ctx.planeName + '=' + EL.U.fmt(ctx.st.planePos), '']);
      } else {
        const z = ctx.st.plane === 'xy' ? ctx.st.planePos : 0;
        const a = S([0, p.d / 2, z]), b = S([0, -p.d / 2, z]);
        out.push(['V(P+)', a.V, 'kQ/L'], ['V(P−)', b.V, 'kQ/L'], ['|E(P+)|', V.len(a.E), 'kQ/L²'], ['|E(P−)|', V.len(b.E), 'kQ/L²'],
          ['Ey(P+)', a.E[1], 'kQ/L²'], ['Ey(P−)', b.E[1], 'kQ/L²']);
      }
      return out;
    },
    extra(ctx) {
      const p = ctx.p, out = {};
      MH.mark(out, [0, 0, 0], 'O');
      if (ctx.stage === 1) MH.mark(out, [p.d / 2, 0, 0], 'B');
      if (ctx.stage === 4) {
        const z = ctx.st.plane === 'xy' ? ctx.st.planePos : 0;
        MH.mark(out, [0, p.d / 2, z], 'P+', EL.C.probe); MH.mark(out, [0, -p.d / 2, z], 'P−', EL.C.probe);
      }
      return out;
    },
    exercises: [
      { q: '单个点电荷的电荷量 q=+1 Q，求距它 2 L 处的电势 V（单位 kQ/L）。', a: 0.5 },
      { q: '到单个点电荷的距离由 2 L 变为 4 L，求新场强与原场强之比。', a: 0.25 },
      { q: '等量异号的两个点电荷连线的中点 O 处，电势和场强满足哪种情况？', options: ['V=0，E≠0', 'V=0，E=0', 'V≠0，E=0'], a: 'V=0，E≠0' },
      { q: '单个点电荷的电荷量 q=+1 Q，电势为 0.5 kQ/L 的等势面被与点电荷相距 1 L 的平面截得一个圆，求该圆的半径（单位 L）。', a: Math.sqrt(3) }
    ]
  });
})(window.EL);
