'use strict';
// 理论页右栏的“模型预览”：可拖动旋转的示意图，标注与本节核心公式中的符号一一对应
// 悬停或点击图例、图中标注、公式及符号说明中的符号，另外两处对应的元素同时高亮
(function (EL) {
  const V = EL.V, U = EL.U, A = EL.App, h = U.h;
  const C = { dim: '#8A6D00', vec: '#B4235A', vec2: '#2E7D32', ring: '#0072B2', note: '#22303F' };
  const ring = (o, r, u, v, n) => Array.from({ length: (n || 48) + 1 }, (_, i) => { const a = 2 * Math.PI * i / (n || 48); return V.add(o, V.add(V.mul(u || [1, 0, 0], r * Math.cos(a)), V.mul(v || [0, 1, 0], r * Math.sin(a)))); });
  const ex = [1, 0, 0], ey = [0, 1, 0], ez = [0, 0, 1];
  // 矢量显示长度：只表示方向，长度取固定的示意值
  const arrow = (from, dir, len) => V.add(from, V.mul(V.norm(dir), len));
  const Ei = (s, P) => { const d = V.sub(P, s.p), r = V.len(d); return r > 1e-9 ? V.mul(d, s.q / (r * r * r)) : [0, 0, 0]; };
  // 图例：k 键（与图中 data-k 相同）、s 符号（TeX）、d 说明、mt 公式中对应符号的文字（用于公式与图互相高亮）
  const L = (k, s, d, mt) => ({ k, s, d, mt: mt || [] });

  const SPEC = {
    1: c => {
      const p = c.p, q1 = [-p.d / 2, 0, 0], P = c.probe ? c.probe.pos : [0, 1, 0], rs = Math.max(0.6, p.d * 0.3);
      return { extra: { pts: [{ n: 'P', p: P, k: 'P' }], dims: [{ a: 'Q1', b: 'Q2', t: 'd', k: 'd' }],
        lines: [{ pts: [q1, P], t: 'R', k: 'R', col: C.vec, at: 0.55 }, { pts: ring(q1, rs, ex, ez), t: 'R_{sphere}', k: 'Rs', col: C.ring, at: 0.62, solid: true, w: 1 }] },
        legend: [L('Q1', 'Q_1', '场源电荷，位于 $(-d/2,0,0)$。', ['Q1', 'q']), L('Q2', 'Q_2', '场源电荷，位于 $(d/2,0,0)$。', ['Q2']), L('d', 'd', '两个场源电荷之间的距离。', ['d']),
          L('O', 'O', '坐标原点，两电荷连线的中点。', ['O']), L('B', 'B', '位于 $(d/2,0,0)$，用来比较距离加倍后的读数。', ['B']), L('P', 'P', '探针（观察点）。', []),
          L('R', 'R', '观察点到点电荷 $Q_1$ 的距离。', ['R']), L('Rs', 'R_{\\rm sphere}', '以 $Q_1$ 为球心的等势球面的半径（图中为示意）。', ['Rsphere'])] };
    },
    2: c => {
      const P = c.probe.pos, E = c.probe.s && c.probe.s.ok ? c.probe.s.E[0] : 1;
      return { extra: { pts: [{ n: 'P', p: P, k: 'P' }], dims: [{ a: 'Q1', b: 'Q2', t: 'd', k: 'd' }],
        lines: [{ pts: [[0, 0, 0], P], t: 's', k: 's', col: C.dim, solid: true, w: 2 }], vecs: [{ from: P, to: V.add(P, [Math.sign(E || 1) * 1.4, 0, 0]), t: 'E_{∥}', k: 'Epar', col: C.vec }] },
        legend: [L('Q1', 'Q_1', '场源电荷，位于 $(-d/2,0,0)$。', ['Q1']), L('Q2', 'Q_2', '场源电荷，位于 $(d/2,0,0)$。', ['Q2']), L('d', 'd', '两个场源电荷之间的距离。', ['d']),
          L('O', 'O', '坐标原点，对应 $s=0$。', ['O']), L('P', 'P', '探针（观察点），位于 $(s,0,0)$。', ['P']), L('s', 's', '沿 $x$ 轴量得的弧长坐标。', ['s', 'ds']),
          L('Epar', 'E_\\parallel', '场强沿路径前进方向（$+x$）的分量，箭头只表示方向。', ['E∥', 'E‖'])] };
    },
    3: c => {
      const s = c.sources, srcK = {};
      s.forEach(q => { if (/^\d+$/.test(q.label)) srcK[q.label] = 'q'; });
      const lines = s.length > 1 ? [{ pts: [s[0].p, s[1].p], t: 'R_{12}', k: 'Rij', col: C.vec, solid: true, at: 0.5 }] : [];
      return { extra: { srcK, lines },
        legend: [L('q', 'q', '圆周上每个点电荷的电荷量；共 $N$ 个，图中依次编号。', ['q', 'qi', 'qj', 'N']), L('O', 'O', '圆盘的圆心。', []), L('R', 'R', '圆盘半径，也是圆心到圆周上电荷的距离。', ['R']),
          L('Rij', 'R_{ij}', '第 $i$、$j$ 两个电荷之间的距离；图中画出 $R_{12}$。', ['Rij'])] };
    },
    4: c => {
      const a = c.p.a, s = c.sources.find(q => q.label === 'T2');
      return { extra: { dims: [{ a: 'O', b: 'T1', t: '√3a', k: 'R_OT' }, { a: 'O', b: 'M₁₂', t: 'a', k: 'a' }], vecs: s ? [{ from: [0, 0, 0], to: V.mul(s.p, 0.62), t: 'r_i', k: 'ri', col: C.vec }] : [] },
        legend: [L('T1', 'T_1', '顶点 $(a,a,a)$。', ['T1']), L('T2', 'T_2', '顶点 $(a,-a,-a)$。', ['T2']), L('T3', 'T_3', '顶点 $(-a,a,-a)$。', ['T3']), L('T4', 'T_4', '顶点 $(-a,-a,a)$。', ['T4']),
          L('O', 'O', '正四面体的中心（原点）。', ['O', 'E(O)', 'V(O)']), L('a', 'a', '坐标尺度：中心到棱中点 $M_{12}$ 的距离，棱长为 $2\\sqrt2\\,a$。', ['a']),
          L('R_OT', '\\sqrt3\\,a', '中心到每个顶点的距离 $R_{O,T_i}$。', ['RO,Ti', '3a', '3']), L('ri', '\\vec r_i', '第 $i$ 个顶点的位置矢量；图中画出 $\\vec r_2$ 的方向。', ['ri', 'r1']),
          L('M₁₂', 'M_{12}', '棱 $T_1T_2$ 的中点，交替电荷阶段的观察点。', [])] };
    },
    5: c => {
      const a = c.p.a, r = a / Math.sqrt(3), n = V.norm([-1, 1, 1]);
      return { extra: { dims: [{ a: 'O', b: 'P', t: 'a', k: 'a' }, { a: 'O', b: 'T_PMN', t: 'r_{in}', k: 'rin' }], notes: [{ at: V.mul(n, -r * 0.45), t: 'τ', k: 'tau', it: true }] },
        legend: [L('M', 'M,\\ N', '带 $+q$ 的顶点。', ['M', 'N']), L('F', 'F,\\ Q', '带 $-q$ 的顶点。', ['F', 'Q']), L('P', 'P,\\ R', '不带电的顶点，关于 $y=0$ 平面对称。', ['P', 'R']),
          L('O', 'O', '正八面体的中心。', []), L('a', 'a', '顶点到中心的距离。', ['a']), L('rin', 'r_{\\rm in}', '内切球的半径，等于 $a/\\sqrt3$。', ['rin']),
          L('T_PMN', 'T_{PMN}', '内切球与面 PMN 的切点，$\\tau=+1$。', ['TPMN']), L('T_QRF', 'T_{QRF}', '内切球与面 QRF 的切点，$\\tau=-1$。', ['TQRF']),
          L('tau', '\\tau', '沿两切点连线（虚线）的无量纲比例。', ['τ', 'dτ', 't', 'dt'])], srcK: { N: 'M', Q: 'F' }, ptK: { R: 'P' } };
    },
    6: c => {
      const hh = c.p.a / 2, E = c.sources.find(q => q.label === 'E');
      return { extra: { dims: [{ a: 'A', b: 'D', t: 'a', k: 'a' }], lines: [{ pts: [[-hh, -hh, -hh], [hh, hh, hh]], t: 'ℓ', k: 'l', col: C.vec, at: 0.72 }],
        vecs: E ? [{ from: [0, 0, 0], to: V.mul(E.p, 0.75), t: 'r_i', k: 'ri', col: C.vec2 }] : [] },
        legend: [L('E', 'E,\\ F', '上、下两个面的中心，带 $+q$。', ['E', 'F']), L('G', 'G,\\ H', '左、右两个面的中心，带 $-q$。', ['G', 'H']), L('ri', '\\vec r_i', '面中心的位置矢量；图中画出 E 的位置矢量。', ['ri']),
          L('O', 'O', '正方体的中心，反演中心。', []), L('a', 'a', '正方体的边长。', ['a']), L('l', '\\ell', '体对角线的长度 $\\sqrt3\\,a$；虚线为路径 A（A′ 到 C）。', ['ℓ', 'ell', 'l']),
          L('A′', 'A′,\\ C', '路径 A 的起点和终点。', ['A′', 'C']), L('D', 'D,\\ B′', '路径 B 的起点和终点，关于中心对称。', ['D', 'B′'])], srcK: { F: 'E', H: 'G' }, ptK: { C: 'A′', 'B′': 'D' } };
    },
    7: c => {
      const st = c.st, B = V.planeBasis(st.plane), R = Math.min(c.bound, 4) * 0.7, r0 = V.mul(B.n, st.planePos || 0);
      const P = c.probe ? c.probe.pos : [0, 1.5, 0], s = c.sources.filter(q => q.q).slice(0, 2);
      const rect = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([u, v]) => V.add(r0, V.add(V.mul(B.u, u * R), V.mul(B.v, v * R))));
      const vecs = [{ from: r0, to: V.add(r0, V.mul(B.u, R * 0.4)), t: 'e_1', k: 'e1', col: C.dim }, { from: r0, to: V.add(r0, V.mul(B.v, R * 0.4)), t: 'e_2', k: 'e2', col: C.dim }];
      s.forEach((q, i) => vecs.push({ from: P, to: arrow(P, Ei(q, P), 1.3), t: 'E_' + (i + 1), k: 'E' + (i + 1), col: i ? C.vec2 : C.vec }));
      return { extra: { pts: [{ n: 'r_0', p: r0, k: 'r0' }, { n: 'P', p: P, k: 'P' }], lines: [{ pts: rect, t: '截面', k: 'slice', col: C.ring, solid: true, w: 1, at: 0.1 }], vecs },
        legend: [L('slice', '(u,v)', '截面（蓝框）上的平面坐标；截面位置与“视图”中的设置一致。', ['u', 'v', 'Vslice']), L('r0', '\\vec r_0', '截面上的参考点。', ['r0']),
          L('e1', '\\vec e_1', '截面内的单位矢量。', ['e1']), L('e2', '\\vec e_2', '截面内与 $\\vec e_1$ 垂直的单位矢量。', ['e2']), L('P', 'P', '探针（观察点）。', []),
          L('E1', '\\vec E_1', '第一个场源电荷在 P 点产生的分场强，箭头只表示方向。', ['E1']), L('E2', '\\vec E_2', '第二个场源电荷在 P 点产生的分场强。', ['E2'])] };
    }
  };
  // 08 解析场模型的六个子模型
  const SPEC8 = {
    point: (c, sp) => { const P = [1.6, 0, 0.9]; return { extra: { pts: [{ n: 'P', p: P, k: 'P' }], lines: [{ pts: [[0, 0, 0], P], t: 'r', k: 'r', col: C.dim, solid: true }, { pts: ring([0, 0, 0], 1.1, ex, ez), t: 'r_{V*}', k: 'rv', col: C.ring, solid: true, w: 1, at: 0.6 }],
      vecs: [{ from: P, to: arrow(P, V.mul(P, sp.q || 1), 1), t: 'E', k: 'E', col: C.vec }] },
      legend: [L('q', 'q', '点电荷，位于原点。', ['q']), L('r', '\\vec r', '场点相对于点电荷的位置矢量，$r$ 是它的长度。', ['r']), L('E', '\\vec E', '场点的电场强度，沿径向。', ['E']),
        L('rv', 'r_{V_*}', '电势为 $V_*$ 的等势球面的半径（图中为示意）。', ['rV']), L('P', 'P', '场点。', [])] }; },
    'infinite-line': (c, sp) => { const P = [1.6, 0, 1], F = [0, 0, 1]; return { extra: { pts: [{ n: 'P', p: P, k: 'P' }], lines: [{ pts: [F, P], t: 'ρ', k: 'rho', col: C.dim, solid: true }, { pts: ring([0, 0, 0], Math.min(sp.r0, 2.5), ex, ey), t: 'ρ_0', k: 'rho0', col: C.ring, solid: true, w: 1, at: 0.68 }],
      vecs: [{ from: P, to: V.add(P, [0.9, 0, 0]), t: 'e_{ρ}', k: 'erho', col: C.vec }], notes: [{ at: [0, 0, -2.2], t: 'λ', k: 'lambda', it: true }] },
      legend: [L('lambda', '\\lambda', '沿 $z$ 轴的无限长线电荷的线电荷密度。', ['λ']), L('rho', '\\rho', '场点到 $z$ 轴的垂直距离。', ['ρ']), L('erho', '\\hat e_\\rho', '垂直于 $z$ 轴、背离 $z$ 轴的单位矢量。', ['eρ', 'e^ρ', 'e^']),
        L('rho0', '\\rho_0', '电势零点所在圆柱面的参考半径。', ['ρ0']), L('P', 'P', '场点。', [])] }; },
    'infinite-plane': (c, sp) => { const s = Math.sign(sp.sigma || 1), P = [0.8, 0.8, 1.4], Q = [0.8, 0.8, -1.4]; return { extra: { pts: [{ n: 'P', p: P, k: 'P' }, { n: 'P′', p: Q, k: 'P' }],
      dims: [{ a: [0.8, 0.8, 0], b: P, t: 'z', k: 'z' }], vecs: [{ from: P, to: V.add(P, [0, 0, s]), t: 'E', k: 'E', col: C.vec }, { from: Q, to: V.add(Q, [0, 0, -s]), t: 'E', k: 'E', col: C.vec }], notes: [{ at: [-2.1, 2.1, 0], t: 'σ', k: 'sigma', it: true }] },
      legend: [L('sigma', '\\sigma', '带电平面 $z=0$ 的面电荷密度。', ['σ']), L('z', 'z', '场点到带电平面的有向距离。', ['z', '|z|']), L('E', '\\vec E', '两侧的场强大小相等、方向相反，与距离无关。', ['E', 'E(z)']),
        L('P', 'P,\\ P′', '平面两侧关于平面对称的两个场点。', [])] }; },
    'conductor-sphere': (c, sp) => { const P = V.mul(V.norm([1, 0, 0.6]), sp.a * 1.8); return { extra: { pts: [{ n: 'P', p: P, k: 'P' }], dims: [{ a: [0, 0, 0], b: [0, -sp.a, 0], t: 'a', k: 'a' }],
      lines: [{ pts: [[0, 0, 0], P], t: 'r', k: 'r', col: C.dim, solid: true }], vecs: [{ from: P, to: arrow(P, V.mul(P, sp.q || 1), sp.a * 0.8), t: 'E', k: 'E', col: C.vec }], notes: [{ at: [0, 0, sp.a * 1.22], t: 'q', k: 'q', it: true }] },
      legend: [L('a', 'a', '导体球的半径。', ['a']), L('q', 'q', '导体球所带的总电荷量，分布在球面上。', ['q']), L('r', 'r', '场点到球心的距离。', ['r']), L('E', '\\vec E', '球外的场强，与电荷集中在球心时相同；球内为零。', ['E']), L('P', 'P', '球外的场点。', [])] }; },
    'dielectric-interface': (c, sp) => { const s = Math.sign(sp.D || 1), k1 = 1.6 / Math.max(sp.e1, sp.e2), P1 = [0.6, 0.6, 1.2], P2 = [0.6, 0.6, -1.2]; return { extra: { pts: [],
      vecs: [{ from: [-1.2, -1.2, -0.9], to: [-1.2, -1.2, -0.9 + s * 1.8], t: 'D', k: 'D', col: C.vec2 }, { from: P1, to: V.add(P1, [0, 0, s * 1.6 * Math.max(sp.e1, sp.e2) / sp.e1 * k1 * 0.9]), t: 'E_1', k: 'E1', col: C.vec }, { from: P2, to: V.add(P2, [0, 0, s * 1.6 * Math.max(sp.e1, sp.e2) / sp.e2 * k1 * 0.9]), t: 'E_2', k: 'E2', col: C.vec }],
      notes: [{ at: [-1.8, 1.8, 1.4], t: 'ε₁', k: 'e1', it: true }, { at: [-1.8, 1.8, -1.4], t: 'ε₂', k: 'e2', it: true }] },
      legend: [L('e1', '\\varepsilon_1', '介质 1（$z>0$）的相对介电常数。', ['ε1']), L('e2', '\\varepsilon_2', '介质 2（$z<0$）的相对介电常数。', ['ε2']), L('D', 'D', '电位移沿 $z$ 方向的分量，两侧相同。', ['D', 'D1n', 'D2n']),
        L('E1', '\\vec E_1', '介质 1 中的场强，长度与 $1/\\varepsilon_1$ 成正比。', ['E1', 'E1n']), L('E2', '\\vec E_2', '介质 2 中的场强，长度与 $1/\\varepsilon_2$ 成正比。', ['E2', 'E2n'])] }; },
    'dielectric-sphere': (c, sp) => { const a = sp.a, s = Math.sign(sp.E0 || 1), P = V.mul(V.norm([1, 0, 0.7]), a * 1.9), Cc = 3 * sp.eout / (sp.ein + 2 * sp.eout); return { extra: { pts: [{ n: 'P', p: P, k: 'P' }],
      dims: [{ a: [0, 0, 0], b: [0, -a, 0], t: 'a', k: 'a' }], lines: [{ pts: [[0, 0, 0], P], t: 'r', k: 'r', col: C.dim, solid: true }],
      vecs: [{ from: [-a * 2, 0, -s * a], to: [-a * 2, 0, s * a], t: 'E_0', k: 'E0', col: C.vec2 }, { from: [a * 0.25, 0, -s * a * 0.4 * Cc], to: [a * 0.25, 0, s * a * 0.4 * Cc + s * 0.01], t: 'E_{in}', k: 'Ein', col: C.vec }],
      notes: [{ at: [-a * 0.35, 0, a * 0.45], t: 'ε_{in}', k: 'ein', it: true }, { at: [a * 1.5, 0, -a * 1.3], t: 'ε_{out}', k: 'eout', it: true }] },
      legend: [L('E0', 'E_0', '远处外加匀强电场的场强，沿 $z$ 方向。', ['E0']), L('a', 'a', '电介质球的半径。', ['a']), L('ein', '\\varepsilon_{\\rm in}', '球内电介质的相对介电常数。', ['εin']),
        L('eout', '\\varepsilon_{\\rm out}', '球外电介质的相对介电常数。', ['εout']), L('Ein', '\\vec E_{\\rm in}', '球内的匀强电场，等于 $CE_0$。', ['Ein', 'C', 'CE0']), L('r', 'r', '场点到球心的距离，$z$ 是场点的 $z$ 坐标。', ['r', 'z']), L('P', 'P', '球外的场点。', [])] }; }
  };

  // 公式中符号的文字（MathML 文本，数学字母归一化为普通字母）
  const norm = s => String(s).normalize('NFKC').replace(/\s+/g, '').replace(/[⃗→]/g, '');
  let cur = null;   // { box, keys: Map(mt → k), legend }
  const mark = k => {
    if (!cur) return;
    const root = U.$('#theory');
    U.$$('.hl', root).forEach(e => e.classList.remove('hl'));
    if (cur.show) cur.show(k);
    if (!k) return;
    U.$$('[data-k="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]', root).forEach(e => e.classList.add('hl'));
    U.$$('#theoryBody math [data-mk="' + k + '"]').forEach(e => e.classList.add('hl'));
  };
  // 在公式与符号说明中，为与图例对应的符号加上 data-mk
  const tagMath = keys => {
    for (const mth of U.$$('#theoryBody .formula math, #theoryBody .where math')) {
      for (const el of mth.querySelectorAll('msub, msup, msubsup, mover, mi, mn')) {
        if (el.closest('[data-mk]')) continue;
        const k = keys.get(norm(el.textContent));
        if (k && !(el.tagName.toLowerCase() === 'mn' && el.parentElement.tagName.toLowerCase() !== 'msqrt')) el.setAttribute('data-mk', k);
      }
    }
  };

  A.renderPreview = function (host, c, t) {
    const m = c.m, fn = m.analytic ? SPEC8[c.sub] : SPEC[m.id];
    if (!host) return;
    if (!fn) { host.replaceChildren(); host.hidden = true; return; }
    host.hidden = false;
    let sp;
    try { sp = fn(c, c.subP); } catch (e) { host.replaceChildren(); host.hidden = true; return; }
    const extra = Object.assign({ srcK: sp.srcK }, sp.extra);
    // 关键点的键：同一图例项可对应多个点（例如 P、R）
    if (sp.ptK) extra.pts = (extra.pts || []).concat((t.pts ? t.pts(c.p) : []).filter(q => sp.ptK[q.n]).map(q => ({ n: q.n, p: q.p, k: sp.ptK[q.n] })));
    const flat = m.view === '2d' && m.id === 3;
    const V0 = { th: -0.95, ph: 0.42, z: 1 };
    const view = host._view && host._view.id === (m.id + ':' + c.sub) ? host._view : Object.assign({ id: m.id + ':' + c.sub }, V0);
    host._view = view;
    const fig = h('div.pv-fig', { tabindex: '0', role: 'img', 'aria-label': m.title + '的模型预览。' + (flat ? '' : '拖动或用方向键旋转，') + '滚轮或加减号缩放，双击恢复。' });
    // 画布：SVG 放在可缩放的图层里；缩放用 CSS 变换，不重新排版，转动时只重画 SVG
    const layer = h('div.pv-layer');
    fig.append(layer);
    let hot = null;
    const lk = new Set(sp.legend.map(x => x.k)), ptK = sp.ptK || {};
    const th = Object.assign({}, t, { pts: p => (t.pts ? t.pts(p) : []).filter(q => !ptK[q.n] && lk.has(q.n)) });
    const draw = () => {
      // 预览只画图例中出现的关键点，保证标注与公式符号一一对应；标注固定在点旁（pin），随模型一起转动
      layer.innerHTML = A.figure(c, th, { th0: view.th, ph0: view.ph, extra, fixed: !flat, pin: true, W: 300, aspect: flat ? 0.86 : 0.8, idp: 'pv' });
      if (hot) mark(hot);
    };
    const zl = h('span.pv-zl', { 'aria-live': 'polite' }, '100%');
    const zoomTo = z => { view.z = U.clamp(z, 0.6, 4); layer.style.transform = 'scale(' + view.z + ')'; zl.textContent = Math.round(view.z * 100) + '%'; };
    draw();
    // 旋转：拖动带惯性，方向键与双击复位用缓动动画；同一帧内多次请求只重画一次
    let raf = 0, vel = [0, 0], anim = null;
    const frame = () => {
      raf = 0;
      if (anim) {
        const k = Math.min(1, (performance.now() - anim.t0) / 320), e = 1 - Math.pow(1 - k, 3);
        view.th = anim.a.th + (anim.b.th - anim.a.th) * e; view.ph = anim.a.ph + (anim.b.ph - anim.a.ph) * e;
        if (anim.b.z != null) zoomTo(anim.a.z + (anim.b.z - anim.a.z) * e);
        if (k >= 1) anim = null;
      } else if (!drag && (Math.abs(vel[0]) > 1e-4 || Math.abs(vel[1]) > 1e-4)) {
        view.th += vel[0]; view.ph = U.clamp(view.ph + vel[1], -1.45, 1.45); vel = [vel[0] * 0.9, vel[1] * 0.9];
      } else if (!drag) { draw(); return; }
      draw();
      if (anim || (!drag && (Math.abs(vel[0]) > 1e-4 || Math.abs(vel[1]) > 1e-4))) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const ease = to => { anim = { t0: performance.now(), a: { th: view.th, ph: view.ph, z: view.z }, b: to }; vel = [0, 0]; kick(); };
    let drag = null;
    if (!flat) {
      fig.addEventListener('pointerdown', e => { if (e.button) return; drag = [e.clientX, e.clientY, performance.now()]; anim = null; vel = [0, 0]; try { fig.setPointerCapture(e.pointerId); } catch (er) { /* 合成事件 */ } fig.classList.add('drag'); });
      fig.addEventListener('pointermove', e => {
        if (!drag) return;
        const dt = -(e.clientX - drag[0]) * 0.01, dp = (e.clientY - drag[1]) * 0.01;
        view.th += dt; view.ph = U.clamp(view.ph + dp, -1.45, 1.45); vel = [dt, dp]; drag = [e.clientX, e.clientY, performance.now()];
        kick();
      });
      const up = () => { if (!drag) return; if (performance.now() - drag[2] > 80) vel = [0, 0]; drag = null; fig.classList.remove('drag'); kick(); };
      fig.addEventListener('pointerup', up); fig.addEventListener('pointercancel', up);
    }
    fig.addEventListener('dblclick', () => ease(Object.assign({}, V0)));
    fig.addEventListener('wheel', e => { e.preventDefault(); zoomTo(view.z * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    fig.addEventListener('keydown', e => {
      const d = flat ? null : { ArrowLeft: [0.35, 0], ArrowRight: [-0.35, 0], ArrowUp: [0, 0.25], ArrowDown: [0, -0.25] }[e.key];
      if (d) { e.preventDefault(); ease({ th: view.th + d[0], ph: U.clamp(view.ph + d[1], -1.45, 1.45) }); }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(view.z * 1.25); }
      if (e.key === '-') { e.preventDefault(); zoomTo(view.z / 1.25); }
      if (e.key === '0') { e.preventDefault(); zoomTo(1); }
    });
    // 缩放按键与全屏查看
    const big = () => { const on = !host.classList.contains('pv-big'); host.classList.toggle('pv-big', on); fs.textContent = on ? '收起' : '放大查看'; fs.setAttribute('aria-pressed', on); if (on) fig.focus(); };
    const fs = h('button.btn.mini', { type: 'button', 'aria-pressed': 'false', onclick: big }, '放大查看');
    const tools = h('div.pv-tools', null,
      h('button.btn.mini', { type: 'button', title: '缩小', 'aria-label': '缩小', onclick: () => zoomTo(view.z / 1.25) }, '−'), zl,
      h('button.btn.mini', { type: 'button', title: '放大', 'aria-label': '放大', onclick: () => zoomTo(view.z * 1.25) }, '+'),
      h('button.btn.mini', { type: 'button', title: '恢复视角与比例', onclick: () => ease(Object.assign({}, V0)) }, '复位'), fs);
    host.onkeydown = e => { if (e.key === 'Escape' && host.classList.contains('pv-big')) big(); };
    zoomTo(view.z || 1);
    // 图例：符号与说明
    // 图例：符号排成一行行的小标签，说明显示在下方（悬停、聚焦或点击的符号）
    const desc = h('p.pv-desc', { 'aria-live': 'polite' });
    const D0 = '悬停或点击符号，查看说明并在图中高亮。';
    const legend = h('ul.pv-leg', { 'aria-label': '图中符号' }, sp.legend.map(x => h('li', { 'data-k': x.k, tabindex: '0', role: 'button' }, h('span.pv-s', { html: EL.tex(x.s, false) }))));
    const byK = new Map(sp.legend.map(x => [x.k, x]));
    const keys = new Map();
    for (const x of sp.legend) for (const s of x.mt) if (!keys.has(norm(s))) keys.set(norm(s), x.k);
    host.replaceChildren(h('h2', null, '模型预览'), fig, tools, h('p.pv-tip', null, (flat ? '' : '拖动旋转，') + '滚轮缩放，双击复位。'), legend, desc);
    cur = { keys, show: k => { const x = byK.get(k); desc.innerHTML = x ? '<b>' + EL.tex(x.s, false) + '</b>　' + U.richMath(x.d) : D0; } };
    cur.show(null);
    tagMath(keys);
    // 悬停与点击：图例、图中元素、公式符号三处互相高亮；点击后保持高亮，再次点击取消
    let pinned = null;
    const keyOf = e => { const el = e.target.closest && e.target.closest('[data-k], [data-mk]'); return el ? el.getAttribute('data-k') || el.getAttribute('data-mk') : null; };
    const page = U.$('#theory');
    if (page._pvOff) page._pvOff();
    const over = e => { if (!e.target.closest('.pv, #theoryBody math')) return; const k = keyOf(e); hot = k || pinned; mark(hot); };
    const click = e => { if (!e.target.closest('.pv-leg, .pv-fig, #theoryBody math')) return; const k = keyOf(e); if (!k) return; pinned = pinned === k ? null : k; hot = pinned; mark(hot); };
    const focus = e => { if (e.target.closest && e.target.closest('.pv-leg li')) { hot = e.target.getAttribute('data-k'); mark(hot); } };
    page.addEventListener('mouseover', over); page.addEventListener('click', click); page.addEventListener('focusin', focus);
    page._pvOff = () => { page.removeEventListener('mouseover', over); page.removeEventListener('click', click); page.removeEventListener('focusin', focus); };
  };
  A.previewSpecs = { SPEC, SPEC8 };
})(window.EL);
