'use strict';
// 08 模型拓展：六个解析静电模型（k=1，ε₀=1/(4π)，ε 为相对介电常数）
(function (EL) {
  const V = EL.V, P4 = 4 * Math.PI, NAN3 = [NaN, NaN, NaN];
  const golden = (n, f) => Array.from({ length: n }, (_, i) => { const t = (i + 0.5) / n, z = 1 - 2 * t, r = Math.sqrt(1 - z * z), a = i * Math.PI * (3 - Math.sqrt(5)); return f([r * Math.cos(a), r * Math.sin(a), z], i, t); });
  const disk = (n, R, zf) => Array.from({ length: n }, (_, i) => { const r = 0.8 * R * Math.sqrt(i / Math.max(1, n - 1)), a = i * 2.39996; return [r * Math.cos(a), r * Math.sin(a), zf(i)]; });

  const SUB = {
    point: { name: '点电荷', cat: '基准模型', params: [{ key: 'q', label: '点电荷的电荷量 q', min: -10, max: 10, step: 0.1, val: 1 }],
      fn: (p, x) => { const r = V.len(x); if (p.q === 0) return { V: 0, E: [0, 0, 0], region: '全空间' }; if (r < 1e-9) return { V: NaN, E: NAN3, region: '点电荷所在处（未定义）' }; return { V: p.q / r, E: V.mul(x, p.q / (r * r * r)), region: 'r>0' }; },
      seeds: (p, R, n) => golden(n, d => V.mul(d, 0.12 * R)), surf: (p, L) => p.q * L > 0 ? { sphere: p.q / L } : null, src: p => p.q, geom: 'point' },
    'infinite-line': { name: '无限长均匀线电荷', cat: '无限源', params: [{ key: 'lambda', label: '线电荷密度 λ', min: -10, max: 10, step: 0.1, val: 1 }, { key: 'r0', label: '电势零点的参考半径 ρ₀', min: 0.1, max: 10, step: 0.1, val: 1 }],
      fn: (p, x) => { const rho = Math.hypot(x[0], x[1]); if (rho < 1e-6) return { V: NaN, E: NAN3, region: '线电荷上（未定义）' }; return { V: -2 * p.lambda * Math.log(rho / p.r0), E: [2 * p.lambda * x[0] / (rho * rho), 2 * p.lambda * x[1] / (rho * rho), 0], region: 'ρ>0' }; },
      seeds: (p, R, n) => golden(n, (d, i, t) => [0.15 * R * Math.cos(i * 2.39996), 0.15 * R * Math.sin(i * 2.39996), 0.7 * R * (2 * t - 1)]),
      surf: (p, L) => p.lambda ? { cyl: p.r0 * Math.exp(-L / (2 * p.lambda)) } : null, src: p => p.lambda, geom: 'line' },
    'infinite-plane': { name: '无限大均匀带电面', cat: '无限源', params: [{ key: 'sigma', label: '面电荷密度 σ', min: -10, max: 10, step: 0.1, val: 1 }],
      fn: (p, x) => { if (Math.abs(x[2]) < 1e-9 && p.sigma) return { V: 0, E: NAN3, region: '带电面上（场强未定义）' }; return { V: -2 * Math.PI * p.sigma * Math.abs(x[2]), E: [0, 0, 2 * Math.PI * p.sigma * Math.sign(x[2])], region: x[2] > 0 ? 'z>0' : 'z<0' }; },
      seeds: (p, R, n) => disk(n, R, i => (i % 2 ? 1 : -1) * 0.08 * R), surf: (p, L) => p.sigma && -L / (2 * Math.PI * p.sigma) > 0 ? { planes: -L / (2 * Math.PI * p.sigma) } : null,
      src: p => p.sigma, geom: 'plane', stopAt: 'z0' },
    'conductor-sphere': { name: '孤立带电导体球', cat: '导体', params: [{ key: 'q', label: '导体球所带的总电荷量 q', min: -10, max: 10, step: 0.1, val: 1 }, { key: 'a', label: '球的半径 a', min: 0.1, max: 5, step: 0.05, val: 1 }],
      fn: (p, x) => { const r = V.len(x); if (Math.abs(r - p.a) < 1e-9) return { V: p.q / p.a, E: NAN3, region: '导体球面上（场强取单侧极限）' }; if (r < p.a) return { V: p.q / p.a, E: [0, 0, 0], region: '导体内部' }; return { V: p.q / r, E: V.mul(x, p.q / (r * r * r)), region: '球外' }; },
      seeds: (p, R, n) => golden(n, d => V.mul(d, 1.02 * p.a)), surf: (p, L) => p.q * L > 0 && p.q / L > p.a ? { sphere: p.q / L } : null, src: p => p.q, geom: 'sphere', inner: true },
    'dielectric-interface': { name: '两种介质的平面界面', cat: '介质', params: [{ key: 'e1', label: '介质 1（z>0）的相对介电常数 ε₁', min: 0.1, max: 100, step: 0.1, val: 2 }, { key: 'e2', label: '介质 2（z<0）的相对介电常数 ε₂', min: 0.1, max: 100, step: 0.1, val: 5 }, { key: 'D', label: '电位移的法向分量 D', min: -10, max: 10, step: 0.1, val: 1 }],
      fn: (p, x) => { const e = x[2] >= 0 ? p.e1 : p.e2, Ez = P4 * p.D / e; return { V: -Ez * x[2], E: [0, 0, Ez], region: x[2] >= 0 ? '介质 1（z>0）' : '介质 2（z<0）' }; },
      seeds: (p, R, n) => disk(n, R, () => -Math.sign(p.D || 1) * 0.85 * R), surf: () => null, src: p => p.D, geom: 'plane' },
    'dielectric-sphere': { name: '匀强外场中的介电球', cat: '介质', params: [{ key: 'ein', label: '球内介质的相对介电常数 ε_in', min: 0.1, max: 100, step: 0.1, val: 4 }, { key: 'eout', label: '球外介质的相对介电常数 ε_out', min: 0.1, max: 100, step: 0.1, val: 1 }, { key: 'a', label: '球的半径 a', min: 0.1, max: 5, step: 0.05, val: 1 }, { key: 'E0', label: '外加匀强电场的场强 E₀', min: -10, max: 10, step: 0.1, val: 1 }],
      fn: (p, x) => {
        const be = (p.ein - p.eout) / (p.ein + 2 * p.eout), C = 3 * p.eout / (p.ein + 2 * p.eout), r = V.len(x);
        if (r < p.a) return { V: -C * p.E0 * x[2], E: [0, 0, C * p.E0], region: '球内' };
        const b = be * p.E0 * Math.pow(p.a / r, 3), r2 = r * r;
        return { V: -p.E0 * x[2] + be * p.E0 * p.a * p.a * p.a * x[2] / (r2 * r), E: [3 * b * x[2] * x[0] / r2, 3 * b * x[2] * x[1] / r2, p.E0 + b * (3 * x[2] * x[2] / r2 - 1)], region: '球外' };
      },
      seeds: (p, R, n) => disk(n, R, () => -Math.sign(p.E0 || 1) * 0.85 * R), surf: () => null, src: p => p.E0, geom: 'sphere' }
  };
  EL.SUB08 = SUB;

  const params = [{ key: 'range', label: '显示区域的半宽 / L', min: 1, max: 20, step: 0.5, val: 5 }];
  for (const id in SUB) for (const q of SUB[id].params) params.push(Object.assign({}, q, { key: id + ':' + q.key, sub: id }));
  params.push({ key: 'px', label: '探针的 x 坐标 / L', min: -20, max: 20, step: 0.05, val: 2, probe: true }, { key: 'py', label: '探针的 y 坐标 / L', min: -20, max: 20, step: 0.05, val: 0, probe: true }, { key: 'pz', label: '探针的 z 坐标 / L', min: -20, max: 20, step: 0.05, val: 1, probe: true });

  EL.defModel({
    id: 8, code: '拓展 1', order: 7, ext: true, file: '08', title: '解析场模型', short: '无限长线电荷、无限大带电面、导体球与电介质的解析模型',
    view: '3d', R: 5, rangeKey: 'range', analytic: true, subs: SUB, sub: 'point', perCharge: false,
    params, display: { level: 0, spacing: 0.5, count: 3, seeds: 18, plane: 'xz' },
    defaultLayers: { geom: true, lines: true, contours: true, surfaces: false, vectors: false, frame: true, probe: true },
    probe: { free: ['px', 'py', 'pz'] },
    subParams(p, id) { const o = {}; for (const q of SUB[id].params) o[q.key] = p[id + ':' + q.key]; return o; },
    stages: [
      { title: '理论与模型', q: '改变场源的参数后，场强的空间分布和等势面怎样变化？', obs: '先阅读当前模型的理论，再观察几何背景、电场线和截面上的等势线。', rec: '写出预测：场强怎样随位置变化？电势零点选在哪里？', hint: '' },
      { title: '建立与调节', q: '改变场源的参数后，场强的空间分布和等势面怎样变化？', obs: '在“参数”中调节当前模型的物理参数，拖动探针或输入它的坐标，比较不同区域的读数。', rec: '按任务逐项记录探针的读数。', hint: '' },
      { title: '比较与记录', q: '改变场源的参数后，场强的空间分布和等势面怎样变化？', obs: '对照记录题检查结论；需要时，点击“反转场源正负”，比较场强方向的变化。', rec: '完成比较表和记录题，并写出结论成立的条件。', hint: '' }
    ],
    readings(ctx) {
      const s = ctx.probe && ctx.probe.s;
      return [['当前模型', SUB[ctx.sub].name, ''], ['所在区域', s && s.region ? s.region : '—', '']];
    },
    extra(ctx) {
      const r = ctx.bound, out = { lines: [], meshes: [], spheres: [] }, g = SUB[ctx.sub].geom, sp = ctx.subP, col = EL.C.ring;
      if (ctx.layers.frame) {
        const c = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(v => V.mul(v, r));
        [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(e => out.lines.push({ pts: [c[e[0]], c[e[1]]], color: EL.C.frame, width: 1 }));
      }
      if (!ctx.layers.geom) return out;
      const op = ctx.st.style.surfOpacity2;
      if (g === 'point') out.spheres.push({ p: [0, 0, 0], r: 0.1, color: sp.q >= 0 ? EL.C.pos : EL.C.neg });
      if (g === 'line') out.lines.push({ pts: [[0, 0, -r], [0, 0, r]], color: sp.lambda >= 0 ? EL.C.pos : EL.C.neg, width: 4 });
      if (g === 'plane') out.meshes.push({ mesh: ctx.cached('pl' + r, () => EL.ISO.polygon([[-r, -r, 0], [r, -r, 0], [r, r, 0], [-r, r, 0]])), color: [...(ctx.sub === 'infinite-plane' ? (sp.sigma >= 0 ? EL.C.pos : EL.C.neg) : EL.C.geom), op] });
      if (g === 'sphere') {
        out.meshes.push({ mesh: ctx.cached('sp' + sp.a, () => EL.ISO.sphere([0, 0, 0], sp.a, 30)), color: [...(ctx.sub === 'conductor-sphere' ? EL.C.conductor : EL.C.pot), op] });
        if (ctx.st.view === '2d') {
          const B = V.planeBasis(ctx.st.plane), h = ctx.st.planePos;
          if (Math.abs(h) < sp.a) { const rr = Math.sqrt(sp.a * sp.a - h * h), c = []; for (let i = 0; i <= 96; i++) { const t = 2 * Math.PI * i / 96; c.push(V.onPlane(B, rr * Math.cos(t), rr * Math.sin(t), h)); } out.lines.push({ pts: c, color: col, width: 1.8 }); }
        }
      }
      return out;
    },
    exercises: null
  });
})(window.EL);
