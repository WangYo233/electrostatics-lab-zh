'use strict';
// 右侧工具面板：场与等势、动画、矢量合成、几何背景
(function (EL) {
  const U = EL.U, h = U.h, K = EL.UI, A = EL.App, V = EL.V;

  A.pDisplay = function (c) {
    const st = c.st, m = c.m, is2d = st.view === '2d', L = st.layers, fx = A.r.fx;
    const names = Object.assign({}, m.layerNames || {});
    if (is2d) names.contours = '等势线';
    const allow = k => {
      const surfOk = !is2d && !(m.analytic && m.subs[st.sub].surf(c.subP, 1) === null && m.subs[st.sub].surf(c.subP, -1) === null);
      if (k === 'surfaces') return surfOk;
      if (k === 'surfLabels') return surfOk && L.surfaces;
      if (k === 'vectors' || k === 'frame') return !!m.analytic;
      if (k === 'geom') return m.id !== 1 && m.id !== 2;
      if (k === 'probe') return A.hasProbe(m);
      return true;
    };
    const setL = (k, v) => { L[k] = v; if (k === 'probe' && !v) { st.comp.show = false; if (st.wiz.on) A.stopWizard(); } A.update(); A.renderPanel(); A.renderStageBar(); if (k === 'lines' && v) A.r.playReveal(); };
    const out = [K.group('视图', K.seg([['3d', '三维'], ['2d', '二维截面']], st.view, v => { st.view = v; A.resetCamera(); A.update(); A.renderPanel(); }),
      K.tip(is2d ? '二维视图显示截面上的等势线，以及电场强度在截面内的分量；不在截面上的源电荷显示为浅色投影。' : '三维视图显示空间中的电场线；截面等势线画在所选的截面上。'))];
    // 复选框写被显示的对象：“显示 + 对象”
    out.push(K.group('显示内容', ...A.LAYERS.filter(([k]) => allow(k)).map(([k, n]) => K.check('显示' + (names[k] || n), L[k], v => setL(k, v)))));
    if (L.contours || (L.surfaces && !is2d)) {
      const R = Math.round(Math.max(c.bound, A.isoDomain(c)) * 10) / 10, g = [];
      if (L.contours || is2d) {
        g.push(K.select('截面方向', [['xy', '平行于 xy 平面'], ['xz', '平行于 xz 平面'], ['yz', '平行于 yz 平面']], st.plane, v => { st.plane = v; st.sliceTrail = []; A.resetCamera(); A.update(); A.renderPanel(); }));
        // 播放键放进滑块所在的行，与右侧的数字框对齐
        const sOn = st.anim.on && st.anim.target === 'slice', sl = K.slider({ label: '截面位置 ' + c.planeName + ' / L', min: -R, max: R, step: 0.05, val: +st.planePos.toFixed(2), on: (v, live) => {
          // 手动拖动截面时结束截面动画（拖动中不重建面板，松开后再刷新播放键）
          const an = st.anim;
          if (an.target === 'slice' && (an.on || an.paused)) { an.on = false; an.paused = false; cancelAnimationFrame(A.raf); A.sliceDragStop = true; }
          st.planePos = v; A.update();
          if (!live && A.sliceDragStop) { A.sliceDragStop = false; A.renderPanel(); }
        } });
        U.$('.row', sl).append(K.btn(sOn ? '⏸' : '⏵', () => { A.toggleAnim(sOn ? null : 'slice'); }, 'mini play', sOn ? '暂停截面往返扫描' : '播放截面往返扫描'));
        g.push(h('div.ctl-play', null, sl));
      }
      g.push(K.slider({ label: m.perCharge ? '每个源的等势层数' : '等势层数', min: 1, max: 5, step: 1, val: st.count, on: v => { st.count = v; A.update(); } }));
      g.push(K.slider({ label: '层值偏移 V₀ / (kQ/L)', min: -5, max: 5, step: 0.05, val: st.level, on: v => { st.level = v; A.update(); } }));
      g.push(K.slider({ label: '层间隔 ΔV / (kQ/L)', min: 0.05, max: 2, step: 0.05, val: st.spacing, on: v => { st.spacing = v; A.update(); } }));
      if (c.probeVisible) g.push(K.check('增加过探针的等势层', !!st.probeLevel, v => { st.probeLevel = v; A.update(); A.renderPanel(); }),
        st.probeLevel && c.probeLevel != null ? h('p.note', null, '过探针的层值 V = ' + U.fmt(c.probeLevel, 5) + '。在零场点处，这一层等势面收缩成一点。') : null);
      g.push(h('p.note', null, '各层的电势值：' + c.levels.map(v => U.fmt(v, 3)).join('，') + '（单位 kQ/L）。'), K.tip('无界的等势面在边界处截断，并用虚线画出边界框。'));
      out.push(K.group('截面与等势线', ...g));
    }
    if (L.lines || L.flow) out.push(K.group(L.lines ? '电场线' : '电场线条数',
      K.slider({ label: m.analytic ? '电场线起点数' : '每个源的电场线条数', min: m.analytic ? 6 : 2, max: m.analytic ? 48 : 32, step: 1, val: st.seeds, on: v => { st.seeds = v; A.update(); } }),
      m.analytic ? null : K.tip('电场线条数与 |q| 成正比，疏密反映场强的大小。')));
    if (L.flow) out.push(K.group('流动粒子',
      h('div.btns', null, K.btn(fx.paused ? '⏵ 继续流动' : '⏸ 暂停流动', () => A.setFx('paused', !fx.paused), 'mini')),
      K.seg([['sqrt', '速度∝√|E|'], ['linear', '速度∝|E|']], fx.map, v => A.setFx('map', v)),
      K.slider({ label: '流动速度', min: 0.2, max: 3, step: 0.1, val: fx.speed, on: v => { fx.speed = v; U.store.set('fx', fx); } }),
      K.slider({ label: '粒子密度', min: 0.3, max: 2, step: 0.1, val: fx.density, on: (v, l) => { fx.density = v; if (!l) A.setFx('density', v); } }),
      K.tip('光点沿电场线方向移动，越快表示场强越大。光点不是带电粒子的轨迹。')));
    if (L.vectors && m.analytic) out.push(K.group('场强矢量采样', K.slider({ label: '每轴采样点数', min: 3, max: 6, step: 1, val: st.vecN || 3, on: v => { st.vecN = v; A.update(); } })));
    if (L.lines || L.flow || L.contours || L.surfaces) out.push(K.group('计算精度', K.seg([['fast', '快速'], ['fine', '精细']], st.quality, v => { st.quality = v; A.update(); A.renderPanel(); })));
    return out;
  };

  // 动画：可移动对象与路径
  A.animTargets = function (c) {
    const t = [], m = c.m, st = c.st;
    // 二维视图中截面位置决定所画的电场线与等势线，即使没有打开等势线也可以扫描截面
    if (st.layers.contours || st.view === '2d') t.push(['slice', '截面（往返移动）']);
    if (c.probeVisible && c.probe.path) t.push(['path', '探针（沿模型指定的路径 ' + c.probe.path.label + '）']);
    else if (c.probeVisible && c.probe.free) t.push(['probe', '探针 P']);
    if (m.editor && (m.id === 1 || m.id === 7)) c.sources.forEach((s, i) => { if (!(st.custom && st.custom[i] && st.custom[i].bind)) t.push(['src' + i, '源电荷 ' + s.label]); });
    for (const q of A.sweepParams(c)) t.push(['par:' + q.key, '参数扫描：' + q.label.replace(/<[^>]+>/g, '')]);
    return t;
  };
  // 可以扫描的模型参数：面板中可见、与探针无关的数值参数
  A.sweepParams = function (c) {
    const m = c.m, st = c.st, free = (m.probe && m.probe.free) || [];
    return m.params.filter(q => !q.probe && !free.includes(q.key) && (!q.sub || q.sub === st.sub) && (!q.show || q.show(st.p, st)) && !(q.hideCustom && st.custom) && q.max > q.min);
  };
  A.pAnim = function (c) {
    const a = c.st.anim, T = A.animTargets(c);
    if (!T.length) return [K.note('打开探针或截面等势线后，才能设置动画。')];
    if (!T.some(x => x[0] === a.target)) { A.stopAnim(); a.target = T[0][0]; }
    const freeMotion = /^(probe|src)/.test(a.target), running = a.on, paused = !a.on && a.paused;
    // 控制行：开始（或继续）/ 暂停、停止并复位、清除轨迹，三个按钮等宽排成一行
    const ctlRow = h('div.btns.anim-ctl', { style: 'display:grid;grid-template-columns:repeat(3,1fr);align-items:stretch' },
      K.btn(running ? '⏸ 暂停动画' : paused ? '⏵ 继续动画' : '⏵ 开始动画', () => A.toggleAnim(running ? null : a.target), 'primary'),
      Object.assign(K.btn('⏹ 停止动画', () => A.resetAnim(), '', '停止动画，并回到开始前的配置'), { disabled: !running && !paused }),
      K.btn('清除轨迹', () => { const s = c.st; s.trail = []; s.eTrail = []; s.sliceTrail = []; A.update(); }));
    return [K.group('动画设置',
      K.select('移动对象', T, a.target, v => { A.stopAnim(); a.target = v; A.renderPanel(); }),
      freeMotion ? K.select('移动路径', [['x', '沿 x 方向往返'], ['xy', '在 xy 平面内做圆周运动'], ['xz', '在 xz 平面内做圆周运动']], a.path, v => { A.stopAnim(); a.path = v; }) : null,
      freeMotion ? K.slider({ label: '移动幅度 / L', min: 0.1, max: 4, step: 0.1, val: a.r, on: v => { a.r = v; } }) : null,
      // 改变周期时保持当前相位，动画不跳变
      K.slider({ label: '周期 T / s', min: 3, max: 60, step: 1, val: a.period, on: v => { if (a.on) { const now = performance.now(); a.t0 = now - (now - a.t0) * v / a.period; } else if (a.paused) a.elapsed *= v / a.period; a.period = v; } }),
      ctlRow,
      K.check('显示位置轨迹', a.trail, v => { a.trail = v; A.update(); }), K.check('显示场强箭头轨迹', a.eTrail, v => { a.eTrail = v; A.update(); }),
      K.check('显示等势线轨迹', a.sliceTrail, v => { a.sliceTrail = v; A.update(); })),
    K.tip('动画表示一系列静电配置，不是带电粒子的运动。暂停后可以继续；停止后回到开始前的配置。')];
  };

  A.pComp = function (c) {
    const st = c.st, cp = st.comp, parts = c.F.parts(c.probe.pos).filter(x => x.q);
    if (!c.probeVisible) return [K.btn('打开探针', () => A.progress(3), 'primary')];
    if (!parts.every(x => x.E.every(isFinite))) return [K.note('探针位于源电荷的排除邻域内，无法合成分场强。')];
    cp.visible = cp.visible || parts.map(x => x.i);
    const re = () => { A.update(); A.renderComp(); };
    // 用“显示”列中勾选的分场强启动场强合成向导（与向导的“开始合成”一致）
    const startBtn = h('div.btns', null, K.btn(st.wiz.on ? '退出合成向导' : '开始合成', () => {
      if (st.wiz.on) { A.stopWizard(); A.renderComp(); return; }
      const sel = cp.visible.filter(i => parts.some(x => x.i === i));
      A.startWizard(null, sel.length === parts.length ? null : sel);
      if (A.renderWizBox) A.renderWizBox();
      A.renderComp();
    }, 'primary', '按“显示”列中勾选的分场强，在画板下方逐步合成'));
    const out = [startBtn, K.check('显示分场强', cp.show, v => { cp.show = v; A.update(); }),
      K.seg([['para', '平行四边形定则'], ['tri', '三角形定则'], ['chain', '首尾相接']], cp.method, v => { cp.method = v; cp.show = true; re(); })];
    out.push(h('table.src', null, h('thead', null, h('tr', null, ...['显示', '分场强', '|E_i|', '方向', '两两', '分组'].map(t => h('th', { html: U.rich(t) })))),
      h('tbody', null, parts.map(x => h('tr', null,
        h('td', null, K.check('', cp.visible.includes(x.i), v => { cp.visible = v ? cp.visible.concat(x.i) : cp.visible.filter(i => i !== x.i); A.update(); })),
        h('td', { html: U.rich('E_' + x.label) }), h('td', null, EL.VA.cell(V.len(x.E))), h('td', null, U.fmtVec(V.norm(x.E), 3)),
        h('td', null, h('input', { type: 'checkbox', 'aria-label': '让 E' + x.label + ' 参与两两合成', checked: cp.pick.includes(x.i), onchange: e => { cp.pick = e.target.checked ? cp.pick.concat(x.i).slice(-2) : cp.pick.filter(i => i !== x.i); cp.show = true; re(); } })),
        h('td', null, h('select', { 'aria-label': '选择 E' + x.label + ' 所属的分组', onchange: e => { cp.groups[x.i] = +e.target.value || 0; cp.show = true; re(); } },
          ...[[0, '—'], [1, 'Σ₁'], [2, 'Σ₂']].map(([v, t]) => h('option', { value: v, selected: (cp.groups[x.i] || 0) === v }, t)))))))));
    // 分组：按对称性先合成部分和，再合成总场
    const g = [1, 2].map(gi => parts.filter(x => cp.groups[x.i] === gi));
    if (g[0].length && g[1].length) {
      const s1 = g[0].reduce((a, x) => V.add(a, x.E), [0, 0, 0]), s2 = g[1].reduce((a, x) => V.add(a, x.E), [0, 0, 0]);
      const th = Math.acos(U.clamp(V.dot(s1, s2) / (V.len(s1) * V.len(s2)), -1, 1)) * 180 / Math.PI;
      out.push(K.group('分组部分和',
        h('p', null, 'Σ₁ = ' + g[0].map(x => 'E' + x.label).join('+') + '，|Σ₁| = ' + EL.VA.cell(V.len(s1))),
        h('p', null, 'Σ₂ = ' + g[1].map(x => 'E' + x.label).join('+') + '，|Σ₂| = ' + EL.VA.cell(V.len(s2))),
        h('p', null, 'Σ₁ 与 Σ₂ 的夹角为 ' + U.fmt(th, 4) + '°' + (Math.abs(th - 90) < 0.05 ? '，两者互相垂直。' : '。'))));
    } else out.push(K.tip('在“分组”列中把对称的分场强分别放进 Σ₁ 和 Σ₂，先求出两组的部分和，再合成。', 'ⓘ 分组合成'));
    const pick = cp.pick.map(i => parts.find(x => x.i === i)).filter(Boolean);
    if (pick.length === 2) {
      const a = pick[0].E, b = pick[1].E, la = V.len(a), lb = V.len(b), cs = U.clamp(V.dot(a, b) / (la * lb), -1, 1), deg = Math.acos(cs) * 180 / Math.PI;
      const ex = K.exactTrig(deg), m2 = la * la + lb * lb + 2 * la * lb * cs, n = V.cross(a, b);
      const others = parts.filter(x => !pick.includes(x)).map(x => 'E' + x.label + ' 与该平面的夹角为 ' + U.fmt(Math.asin(U.clamp(Math.abs(V.dot(V.norm(x.E), V.norm(n))), 0, 1)) * 180 / Math.PI, 3) + '°');
      out.push(K.group('两两合成：E' + pick[0].label + ' 与 E' + pick[1].label,
        K.check('显示所在平面', cp.plane, v => { cp.plane = v; A.update(); }),
        V.len(n) > 1e-12 ? K.btn('正视该平面', () => A.alignView(n), 'mini') : null,
        others.length && V.len(n) > 1e-12 ? h('p.note', null, others.join('；') + '（夹角为 0° 表示共面）。') : null,
        h('p', null, '夹角 θ = ' + U.fmt(deg, 4) + '°'),
        h('p', null, 'cos θ = ' + (ex ? ex.cos + '（精确值）' : U.fmt(cs, 4) + '（近似值）') + '，sin θ = ' + (ex ? ex.sin : U.fmt(Math.sin(deg * Math.PI / 180), 4))),
        h('div.formula', { html: EL.texBlock(String.raw`|\vec E_1+\vec E_2|^2=E_1^2+E_2^2+2E_1E_2\cos\theta`) }),
        h('p', null, '|E' + pick[0].label + '+E' + pick[1].label + '| = √' + U.fmt(m2, 5) + ' = ' + EL.VA.cell(Math.sqrt(m2)) + ' kQ/L²')));
    } else out.push(K.note('在“两两”列中勾选两个分场强，即可查看它们的合成。'));
    const tot = parts.reduce((s, x) => V.add(s, x.E), [0, 0, 0]);
    out.push(K.group('合场强', K.check('显示合场强 E合', cp.total, v => { cp.total = v; cp.show = true; A.update(); }),
      h('p', null, 'E合 = ' + U.fmtVec(tot, 4) + '，|E合| = ' + EL.VA.cell(V.len(tot)) + ' kQ/L²')));
    return out;
  };

  A.bgEditor = function (c) {
    const st = c.st, bgs = st.hidden.bgs, G = EL.GEO;
    let type = 'cube';
    const list = bgs.map((s, bi) => {
      const b = G.build(s), dim = G.TYPES[s.type].dim;
      let sp = 0, q = 1;
      const upd = (k, v) => { s[k] = v; A.update(); };
      return h('div.bg', null, h('div.bg-h', null, h('b', null, (bi + 1) + '. ' + G.TYPES[s.type].name),
        K.btn('显示特殊点', () => { st.showSpecial = st.showSpecial === bi ? -1 : bi; A.update(); }, 'mini', '显示或隐藏这个背景的特殊点'),
        K.btn('删除背景', () => { bgs.splice(bi, 1); st.custom.forEach(x => { if (x.bind) { if (x.bind.bg === bi) { x.bind = null; } else if (x.bind.bg > bi) x.bind.bg--; } }); A.update(); A.renderPanel(); }, 'mini')),
        h('div.row.wrap', null, ...[['w', s.type === 'circle' || s.type === 'sphere' ? '直径' : '宽'], ['l', '长'], ['h', '高'], ['x', 'x'], ['y', 'y'], ['z', 'z']]
          .filter(([k]) => !(k === 'l' && !['rect', 'triangle', 'pyramid', 'prism'].includes(s.type)) && !(k === 'h' && !['pyramid', 'prism'].includes(s.type)))
          .map(([k, n]) => h('label.mini', null, n, K.cell(s[k], 0.1, v => { upd(k, k === 'w' || k === 'l' || k === 'h' ? Math.max(0.1, v) : v); A.renderPanel(); }, 3.4)))),
        h('div.row.wrap', null, K.select('', b.special.map((x, i) => [i, x.name]), 0, v => { sp = +v; }), h('label.mini', null, 'q', K.cell(1, 0.1, v => { q = v; }, 3)),
          K.btn('在特殊点放电荷', () => {
            if (st.custom.length >= 16) return U.toast('最多只能放置 16 个点电荷。');
            const x = b.special[sp];
            st.custom.push({ p: x.p.slice(), q, label: 'Q' + (st.custom.length + 1), bind: { bg: bi, key: x.key } });
            A.update(); A.renderPanel();
          }, 'mini')),
        dim === 2 ? h('p.note', null, '这个平面图形位于 z = ' + (s.z || 0) + ' 的平面内。') : null);
    });
    return K.group('几何背景',
      h('div.row', null, K.select('', Object.keys(G.TYPES).map(k => [k, G.TYPES[k].name]), type, v => { type = v; }),
        K.btn('添加背景', () => { bgs.push({ type, w: 4, l: 3, h: 3, x: 0, y: 0, z: 0 }); st.layers.geom = true; A.update(); A.renderPanel(); })),
      ...list, K.tip('几何背景只作参照。绑定在特殊点上的电荷随背景移动。'));
  };
})(window.EL);
