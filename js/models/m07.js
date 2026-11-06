'use strict';
// 07 自主探究：最多 16 个点电荷、几何背景与特殊点绑定
(function (EL) {
  const V = EL.V, MH = EL.MH;
  const step = (title, q, obs, rec, hint, layers) => ({ title, q, obs, rec, hint, layers });
  EL.defModel({
    id: 7, code: '06', order: 6, file: '07', title: '自主探究', short: '自由放置点电荷，绑定到几何背景的特殊点，在二维与三维之间切换',
    view: '2d', R: 6, rangeKey: 'range', rMin: 0.12, perCharge: true, alwaysCustom: true,
    editor: { max: 16, qRange: [-10, 10], xyz: 30, bind: true },
    initialSources: [{ p: [-2, 0, 0], q: 1 }, { p: [2, 0, 0], q: -1 }],
    params: [
      { key: 'range', label: '显示区域的半径 / L', min: 1, max: 30, step: 0.5, val: 6 },
      { key: 'px', label: '探针的 x 坐标 / L', min: -30, max: 30, step: 0.05, val: 0, probe: true },
      { key: 'py', label: '探针的 y 坐标 / L', min: -30, max: 30, step: 0.05, val: 1.5, probe: true },
      { key: 'pz', label: '探针的 z 坐标 / L', min: -30, max: 30, step: 0.05, val: 0, probe: true }
    ],
    hidden: { bgs: [] },
    display: { level: 0, spacing: 0.3, count: 2, seeds: 6 },
    probe: { free: ['px', 'py', 'pz'] },
    keyPts: () => [{ name: '原点 O', p: [0, 0, 0] }],
    sources: () => [],
    stages: [
      step('放置电荷', '你放置的点电荷会产生怎样的电场？先写下预测。',
        '在“模型”中添加或删除点电荷（最多 16 个），编辑它们的位置和电荷量。也可以先添加几何背景，再把点电荷放到顶点、棱的中点、面心或中心。',
        '记录所有电荷量不为零的源电荷的电荷量、三维坐标以及与背景的绑定情况。', '几何背景只是几何参照，不模拟导体或电介质。绑定只让点电荷随背景一起移动。',
        { charges: true, lines: false, contours: false, surfaces: false, probe: false }),
      step('电场线', '电场线从哪里出发，到哪里终止？',
        '显示电场线，比较二维截面与三维视图。二维截面显示电场强度在截面内的分量所形成的流线；三维视图中的电场线由空间中的电场强度逐步积分得到。', '记录每条电场线起止的源电荷以及电场线的疏密分布。',
        '由二维截面切换到三维视图，并不是把平面图旋转。不在截面上的源电荷，在二维截面中只通过电场强度在截面内的分量显示其影响。', { lines: true }),
      step('等势线与等势面', '等势线（等势面）与电场线有什么几何关系？',
        '显示截面上的等势线。在三维视图中可以选择 xy、xz 或 yz 截面，并显示等势面。每个点电荷可对应 1～5 个等势面；源电荷较多时，先选用快速精度。', '记录实际的等势面电势值、截面的方向与位置。',
        '在场强不为零的地方，电场线与等势面垂直。等势面电势值的个数与等势面连通部分的个数不一定相同。', { contours: true }),
      step('探针', '某一点的合场强怎样由各源电荷的分场强合成？',
        '拖动探针或输入它的坐标，切换到“分析”工作区的“矢量合成”，选择两个分场强，比较它们的夹角与合成结果。', '记录探针位置以及该点的 V、|E| 和各分场强。',
        '两分场强的合场强满足 $|\\vec E_1+\\vec E_2|^2=E_1^2+E_2^2+2E_1E_2\\cos\\theta$。作图时，各分场强从同一点画出，并使用同一比例。', { probe: true })
    ],
    readings(ctx) {
      const src = ctx.sources.filter(s => s.q);
      return [['电荷量不为零的源电荷个数', src.length, ''], ['总电荷量 Σq', src.reduce((a, s) => a + s.q, 0), 'Q'], ['几何背景的个数', ctx.hidden.bgs.length, '']];
    },
    extra(ctx) {
      const out = { lines: [], meshes: [], spheres: [], labels: [] };
      if (!ctx.layers.geom) return out;
      const is2d = ctx.st.view === '2d', B = V.planeBasis(ctx.st.plane), col = EL.C.ring;
      ctx.hidden.bgs.forEach((s, bi) => {
        const b = EL.GEO.build(s);
        if (is2d) {
          const segs = EL.GEO.slice(b, B, ctx.st.planePos);
          if (segs.length) out.lines.push(...segs.map(q => ({ pts: q, color: col, width: 1.6 })));
        } else if (b.sphere) {
          out.meshes.push({ mesh: ctx.cached('bgs' + JSON.stringify(s), () => EL.ISO.sphere(b.sphere.c, b.sphere.r, 28)), color: [...EL.C.geom, ctx.st.style.geomOpacity] });
        } else if (b.circle) {
          const c = [];
          for (let i = 0; i <= 96; i++) { const a = 2 * Math.PI * i / 96; c.push(V.add(b.circle.c, [b.circle.r * Math.cos(a), b.circle.r * Math.sin(a), 0])); }
          out.lines.push({ pts: c, color: col, width: 1.6 });
        } else {
          const m = MH.poly(b.verts, b.faces, { opacity: ctx.st.style.geomOpacity, faceColors: [EL.C.geom], edge: col });
          out.lines.push(...m.lines); out.meshes.push(...m.meshes);
        }
        if (ctx.showSpecial === bi) b.special.forEach(sp => out.spheres.push({ p: sp.p, r: 0.05, color: EL.C.probe }));
      });
      return out;
    },
    exercises: [
      { q: '源电荷位于 (0, 0, 2 L)，观察 z=0 的截面。计算截面上各点的场强时，应使用哪个源电荷坐标？', options: ['(0,0,2L)', '(0,0,0)', '截面上的投影点'], a: '(0,0,2L)' },
      { q: '电荷量 q=+1 Q 的源电荷位于 (0, 0, 2 L)，求原点 O 处场强的 z 分量 E_z（单位 kQ/L²）。', a: -0.25 },
      { q: '某点两个分场强分别为 (1, 0, 0) 和 (0, 1, 0)（单位 kQ/L²），求合场强的大小。', a: Math.SQRT2 },
      { q: '只添加一个封闭的多面体背景、不添加电荷，原有的电场会怎样？', options: ['不变，不模拟屏蔽', '内部场为零', '场强减半'], a: '不变，不模拟屏蔽' }
    ]
  });
})(window.EL);
