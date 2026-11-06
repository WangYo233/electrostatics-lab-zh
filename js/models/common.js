'use strict';
// 模型注册、配色约定与模型共用工具
(function (EL) {
  const V = EL.V;
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
  // 色盲友好配色：以 Okabe–Ito 色板为基础。正负号同时用“橙/蓝”色相与“+/−”符号、明度差区分；
  // 零层用中性色并直接标注数值，不依赖红绿对比。dark=演示工作室，light=投影/打印。
  EL.THEMES = {
    dark: {
      name: '深色工作室', bg: [0.043, 0.071, 0.118], bgCss: 'radial-gradient(120% 90% at 50% 35%, #16233a 0%, #0b1220 62%, #070c16 100%)',
      pos: hex('#F28E2B'), neg: hex('#4FA3E0'), zero: hex('#C9D3E0'), field: hex('#8FB8DE'), flow: hex('#DCEBFA'),
      probe: hex('#F0E442'), energy: hex('#E58FC0'), pot: hex('#3FC1A4'), path: hex('#E8EEF6'), sum: hex('#FFFFFF'), part: hex('#B9A3F0'),
      geom: hex('#7F93AD'), edge: [0.62, 0.7, 0.8, 0.75], ring: [0.62, 0.7, 0.8, 0.85], mark: hex('#D8E1EC'), frame: [0.55, 0.62, 0.72, 0.35],
      axis: [0.6, 0.67, 0.76, 0.5], grid: [0.5, 0.6, 0.72, 0.09], gridMajor: [0.55, 0.65, 0.78, 0.18], guide: [0.8, 0.85, 0.92, 0.6], vec: hex('#A9C9F0'),
      plane: [0.55, 0.7, 0.9, 0.06], trail: [0.6, 0.68, 0.78, 0.5], conductor: hex('#9AA8BA'), zeroSrc: hex('#6B7A8F'), ang: hex('#F5D491'), fog: 0.55, lbl: 'dark'
    },
    light: {
      name: '浅色投影', bg: [0.972, 0.978, 0.988], bgCss: 'radial-gradient(120% 90% at 50% 30%, #ffffff 0%, #f3f6fa 70%, #e9eef5 100%)',
      pos: hex('#D55E00'), neg: hex('#0072B2'), zero: hex('#4A5566'), field: hex('#5B84AE'), flow: hex('#1F4E79'),
      probe: hex('#CC79A7'), energy: hex('#E69F00'), pot: hex('#009E73'), path: hex('#22303F'), sum: hex('#111821'), part: hex('#6A4FB0'),
      geom: hex('#7A8799'), edge: [0.3, 0.36, 0.44, 0.8], ring: [0.36, 0.42, 0.5, 0.9], mark: hex('#2E3A48'), frame: [0.4, 0.46, 0.54, 0.4],
      axis: [0.35, 0.4, 0.48, 0.5], grid: [0.3, 0.38, 0.48, 0.07], gridMajor: [0.3, 0.38, 0.48, 0.15], guide: [0.3, 0.33, 0.4, 0.7], vec: hex('#1D3F66'),
      plane: [0.3, 0.45, 0.62, 0.06], trail: [0.45, 0.5, 0.58, 0.5], conductor: hex('#8C99AA'), zeroSrc: hex('#9AA4B2'), ang: hex('#8A6D00'), fog: 0.25, lbl: 'light'
    }
  };
  EL.C = {};
  EL.setTheme = function (k) { EL.theme = EL.THEMES[k] ? k : 'dark'; for (const x in EL.C) delete EL.C[x]; Object.assign(EL.C, EL.THEMES[EL.theme]); };
  EL.setTheme('dark');
  // 曲线图始终画在浅色面板上，使用固定的色盲友好色
  EL.CHART = { V: hex('#0072B2'), U: hex('#D55E00'), E: hex('#009E73'), alt: hex('#CC79A7'), mark: hex('#111821') };
  EL.MODELS = [];
  EL.model = id => EL.MODELS.find(m => String(m.id) === String(id));
  EL.defModel = m => { EL.MODELS.push(m); return m; };


  const MH = {};
  // 多面体：棱为线，面为半透明网格
  MH.poly = function (verts, faces, o) {
    o = o || {};
    const out = { lines: [], meshes: [] };
    const edges = EL.GEO.edgesOf(faces);
    for (const e of edges) out.lines.push({ pts: [verts[e[0]], verts[e[1]]], color: o.edge || EL.C.edge, width: o.edgeWidth || 1.4 });
    if (o.faces !== false) {
      const cols = o.faceColors || [EL.C.geom, EL.C.pot];
      faces.forEach((f, i) => {
        const c = cols[i % cols.length];
        out.meshes.push({ mesh: EL.ISO.polygon(f.map(k => verts[k])), color: [c[0], c[1], c[2], o.opacity == null ? 0.18 : o.opacity] });
      });
    }
    return out;
  };
  // 标记点（小球 + 标签）
  MH.mark = function (out, p, text, color, r) {
    out.spheres = out.spheres || []; out.labels = out.labels || [];
    out.spheres.push({ p, r: r || 0.07, color: color || EL.C.mark });
    if (text) out.labels.push({ p, text, cls: 'pt' });
  };
  MH.merge = function (...parts) {
    const out = {};
    for (const p of parts) if (p) for (const k in p) out[k] = (out[k] || []).concat(p[k]);
    return out;
  };
  // 沿路径采样 V、E∥（E∥ 按单位弧长）
  MH.alongPath = function (F, path, n) {
    const xs = [], Vs = [], Es = [];
    for (let i = 0; i <= n; i++) {
      const t = path.range[0] + (path.range[1] - path.range[0]) * i / n;
      const p = path.pos(t), s = F.sample(p), d = path.d(t), dl = V.len(d);
      xs.push(t); Vs.push(s.ok ? s.V : NaN); Es.push(s.ok ? V.dot(s.E, d) / dl : NaN);
    }
    return { xs, Vs, Es };
  };
  MH.Epar = function (F, path, t) {
    const s = F.sample(path.pos(t)), d = path.d(t);
    return s.ok ? V.dot(s.E, d) / V.len(d) : NaN;
  };
  // 路径上 [a,b] 是否穿过排除邻域
  MH.pathBlocked = function (F, path, a, b) {
    const n = 200;
    let prev = path.pos(a);
    for (let i = 1; i <= n; i++) {
      const p = path.pos(a + (b - a) * i / n);
      if (F.segBlocked(prev, p)) return true;
      prev = p;
    }
    return false;
  };
  // 路径折线（越过排除邻域时断开）
  MH.pathLine = function (F, path, color, dash) {
    const lines = [], n = 240;
    let cur = [];
    for (let i = 0; i <= n; i++) {
      const p = path.pos(path.range[0] + (path.range[1] - path.range[0]) * i / n);
      if (F.blocked(p)) { if (cur.length > 1) lines.push(cur); cur = []; continue; }
      cur.push(p);
    }
    if (cur.length > 1) lines.push(cur);
    return lines.map(pts => ({ pts, color: color || EL.C.path, width: 2, dash }));
  };
  MH.sgn = x => x > 0 ? '+' : x < 0 ? '−' : '';
  // 模型 04–06：“模型指定路径 / 自定义探针位置”
  MH.customProbe = R => [
    { key: 'px', label: '探针的 x 坐标 / L', min: -R, max: R, step: 0.05, val: 0.5, show: p => p.customProbe },
    { key: 'py', label: '探针的 y 坐标 / L', min: -R, max: R, step: 0.05, val: 0.5, show: p => p.customProbe },
    { key: 'pz', label: '探针的 z 坐标 / L', min: -R, max: R, step: 0.05, val: 0.5, show: p => p.customProbe }
  ];
  MH.customToggle = { key: 'customProbe', label: '自定义探针位置（不勾选时，探针沿模型指定的路径移动）', val: false, probe: true };

  // ---- 教学构造：带标签矢量、角弧、直角标记、高亮平面（“先添加、后隐藏”的构造对象）----
  MH.vec = function (out, p, v, color, text, cls, width) {
    if (!(V.len(v) > 1e-9)) return;
    (out.arrows = out.arrows || []).push({ p, v, color, width: width || 2.4 });
    if (text) (out.labels = out.labels || []).push({ p: V.addS(p, v, 1.06), text, cls: (cls || '') + ' vec', kind: 'vectors' });
  };
  MH.dash = (out, a, b, color) => (out.lines = out.lines || []).push({ pts: [a, b], color: color || EL.C.guide, width: 1.2, dash: [0.1, 0.07] });
  // 以 o 为顶点、在 u、v 方向之间画角弧并标注度数
  MH.arc = function (out, o, u, v, r, text, color) {
    const a = V.norm(u), b0 = V.norm(v), th = Math.acos(EL.U.clamp(V.dot(a, b0), -1, 1));
    if (!(th > 1e-3)) return th;
    let w = V.sub(b0, V.mul(a, Math.cos(th)));
    w = V.len(w) > 1e-6 ? V.norm(w) : V.perp(a);
    const pts = [];
    for (let i = 0; i <= 40; i++) { const t = th * i / 40; pts.push(V.add(o, V.add(V.mul(a, r * Math.cos(t)), V.mul(w, r * Math.sin(t))))); }
    (out.lines = out.lines || []).push({ pts, color: color || EL.C.ang, width: 1.6 });
    const m = V.add(o, V.add(V.mul(a, 1.25 * r * Math.cos(th / 2)), V.mul(w, 1.25 * r * Math.sin(th / 2))));
    (out.labels = out.labels || []).push({ p: m, text: text != null ? text : (th * 180 / Math.PI).toFixed(1) + '°', cls: 'ang', kind: 'angles' });
    return th;
  };
  MH.right = function (out, o, u, v, s, color) {
    const a = V.mul(V.norm(u), s), b = V.mul(V.norm(v), s);
    (out.lines = out.lines || []).push({ pts: [V.add(o, a), V.add(V.add(o, a), b), V.add(o, b)], color: color || EL.C.ang, width: 1.4 });
  };
  MH.tri = function (out, pts, color, alpha) {
    (out.meshes = out.meshes || []).push({ mesh: EL.ISO.polygon(pts), color: [...(color || EL.C.pot), alpha == null ? 0.2 : alpha], lit: false });
    for (let i = 0; i < pts.length; i++) (out.lines = out.lines || []).push({ pts: [pts[i], pts[(i + 1) % pts.length]], color: [...(color || EL.C.pot), 0.95], width: 2 });
  };
  // 源与探针面板的放置位置：顶点、面心、中心、外部
  MH.placements = function (verts, faces, outR) {
    const out = verts.map((p, i) => ({ name: '顶点 ' + (i + 1), p }));
    faces.forEach((f, i) => out.push({ name: '面心 ' + (i + 1), p: V.mul(f.reduce((s, k) => V.add(s, verts[k]), [0, 0, 0]), 1 / f.length) }));
    out.push({ name: '中心（内部）', p: [0, 0, 0] }, { name: '外部点（x 轴上，到中心的距离为外接球半径的 1.8 倍）', p: [1.8 * outR, 0, 0] });
    return out;
  };
  EL.MH = MH;
})(window.EL);
