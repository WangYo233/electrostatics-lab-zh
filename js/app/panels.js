'use strict';
// 右侧工具面板：参数、显示、样式
(function (EL) {
  const U = EL.U, h = U.h, K = EL.UI, A = EL.App, V = EL.V;

  // 左侧工具栏：按“建模 → 显示 → 外观 → 动画”分类，每次只展开一类
  const IC = {
    params: '<svg viewBox="0 0 24 24"><circle cx="7" cy="12" r="3"/><circle cx="17" cy="12" r="3"/><path d="M10 12h4M7 5v4M7 15v4M17 5v4M17 15v4"/></svg>',
    display: '<svg viewBox="0 0 24 24"><path d="M3 12c3-5 6-7 9-7s6 2 9 7c-3 5-6 7-9 7s-6-2-9-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    style: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 3 0 4-1 3-2 3-5a9 9 0 0 0-9-7z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="11" cy="7" r="1.2"/><circle cx="16" cy="8.5" r="1.2"/></svg>',
    anim: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z"/></svg>'
  };
  A.TABS = [['params', '模型', '模型与参数'], ['display', '显示', '显示内容'], ['style', '外观', '外观与动效'], ['anim', '动画', '动画设置']];
  A.tab = 'params';

  A.renderPanel = function () {
    const c = A.c;
    U.$('#rail').replaceChildren(...A.TABS.map(t => {
      const b = h('button', { type: 'button', class: A.tab === t[0] && !A.drawerOff ? 'on' : '', title: t[2], 'aria-pressed': A.tab === t[0] && !A.drawerOff, onclick: () => {
        if (A.tab === t[0] && !A.drawerOff) A.drawerOff = true; else { A.tab = t[0]; A.drawerOff = false; }
        document.body.classList.toggle('drawer-off', !!A.drawerOff); A.renderPanel();
      } });
      b.innerHTML = IC[t[0]] + '<span>' + t[1] + '</span>' + (t[0] === 'anim' && c.st.anim.on ? '<i class="dot"></i>' : '');
      return b;
    }));
    U.$('#drawerTitle').textContent = A.TABS.find(t => t[0] === A.tab)[2];
    const f = { params: A.pParams, display: A.pDisplay, style: A.pStyle, anim: A.pAnim }[A.tab];
    U.$('#panel').replaceChildren(...[].concat(f(c)).filter(Boolean));
    A.renderComp();
  };
  // 矢量合成在“分析”工作区中
  A.renderComp = function () {
    const c = A.c, box = U.$('#compBox');
    box.hidden = !A.canCompose(c);
    if (!box.hidden && document.body.dataset.mode === 'analyze') U.$('#comp').replaceChildren(...[].concat(A.pComp(c)).filter(Boolean));
  };
  A.canCompose = c => !c.m.analytic && !!c.probe && c.sources.filter(s => s.q).length > 1;
  // 模型是否真的有探针（圆盘模型的 probe 为 {free:null}，没有探针）
  A.hasProbe = m => !!m.probe && !!(m.probe.free || m.probe.path || m.probe.pathFn || m.probe.fixedFn);

  // 参数变化：拖动中只重绘；松开后若影响控件可见性则重建面板
  A.onParam = function (key, v, live) {
    const st = A.st;
    st.p[key] = v;
    A.update();
    if (!live) { if (st.model.params.some(q => q.show)) A.renderPanel(); else A.renderComp(); }
  };

  A.pParams = function (c) {
    const st = c.st, m = c.m, out = [];
    if (m.analytic) {
      out.push(K.group('模型设置',
        K.select('解析模型', Object.keys(m.subs).map(k => [k, m.subs[k].cat + ' · ' + m.subs[k].name]), st.sub, v => { st.sub = v; A.onModelChange(); }),
        ...m.params.filter(q => q.sub === st.sub).map(q => K.slider(Object.assign({}, q, { val: st.p[q.key], on: (v, l) => A.onParam(q.key, v, l) }))),
        h('div.btns', null,
          K.btn('反转场源正负', () => { const s = m.subs[st.sub]; const k = st.sub + ':' + s.params.find(q => /^(q|lambda|sigma|D|E0)$/.test(q.key)).key; st.p[k] = -st.p[k]; A.update(); A.renderPanel(); }, '', '把场源电荷或外电场的正负反过来'),
          K.btn('恢复默认参数', () => { for (const q of m.params.filter(q => q.sub === st.sub)) st.p[q.key] = q.val; A.update(); A.renderPanel(); }))));
    }
    // 与探针相关的控件（探针坐标、路径参数、试探电荷、自定义探针）只在打开探针后出现
    const probeKeys = ((m.probe && m.probe.free) || []).concat(m.params.filter(q => q.probe).map(q => q.key));
    const probeOn = c.probeVisible || (!!c.probe && st.layers.probe);
    const sliders = m.params.filter(q => !q.sub && (!q.show || q.show(st.p, st)) && !(q.hideCustom && st.custom));
    const main = sliders.filter(q => !probeKeys.includes(q.key)), pr = sliders.filter(q => probeKeys.includes(q.key));
    const togs = (m.toggles || []).filter(t => !t.probe), ptogs = (m.toggles || []).filter(t => t.probe);
    if (main.length) out.push(K.group(m.analytic ? '视域' : '模型参数', ...main.map(q => K.slider(Object.assign({}, q, { val: st.p[q.key], on: (v, l) => A.onParam(q.key, v, l) })))));
    if (togs.length) out.push(K.group('模型选项', ...togs.map(t => K.check(t.label, st.p[t.key], v => { st.p[t.key] = v; A.update(); A.renderPanel(); }))));
    if (m.editor) out.push(A.sourceEditor(c));
    if (m.id === 7) out.push(A.bgEditor(c));
    if (A.hasProbe(m) && (pr.length || ptogs.length || m.probe.free)) {
      if (!probeOn) out.push(K.group('探针（观察点）', K.btn('打开探针', () => { st.layers.probe = true; A.update(); A.renderPanel(); A.renderStageBar(); }, 'primary')));
      else {
        const kp = A.keyPoints(c).filter(x => x.p);
        out.push(K.group('探针（观察点）',
          ...ptogs.map(t => K.check(t.label, st.p[t.key], v => { st.p[t.key] = v; A.update(); A.renderPanel(); })),
          ...pr.map(q => K.slider(Object.assign({}, q, { val: +(+st.p[q.key]).toFixed(3), on: (v, l) => A.onParam(q.key, v, l) }))),
          c.probe && c.probe.free && kp.length ? h('div.row.wrap', null, K.select('把探针放到关键点', [['', '请选择关键点……']].concat(kp.map((x, i) => [i, x.name])), '', v => {
            if (v === '') return;
            const q = kp[+v].p; c.probe.free.forEach((k, i) => { st.p[k] = +q[i].toFixed(4); }); A.update(); A.renderPanel();
          })) : null,
          K.slider({ label: '场强矢量的显示比例', min: 0.25, max: 4, step: 0.05, val: st.style.probeVec || 1, tip: '只改变探针处场强箭头与合成作图的显示长度，不改变读数。', on: v => { st.style.probeVec = v; A.update(); } }),
          K.note('也可以在画板中直接拖动探针。')));
      }
    }
    return out;
  };
  // 模型的关键点：用于“放到关键点”和标注点
  A.keyPoints = function (c) {
    const m = c.m, pts = m.keyPts ? m.keyPts(c.p, c) : [];
    return pts.concat(c.sources.filter(s => s.q).map(s => ({ name: '源电荷 ' + s.label + ' 附近（沿 x 方向偏移 0.5 L）', p: V.add(s.p, [0.5, 0, 0]) })));
  };

  A.sourceEditor = function (c) {
    const st = c.st, m = c.m, ed = m.editor;
    const removeCharge = i => { A.ensureCustom(c); st.custom.splice(i, 1); st.custom.forEach((s, j) => { s.label = 'Q' + (j + 1); }); A.update(); A.renderPanel(); };
    const rows = c.sources.map((s, i) => {
      const cs = st.custom && st.custom[i];
      const edit = (fn) => { A.ensureCustom(c); fn(st.custom[i]); A.update(); A.renderPanel(); };
      return h('tr', { tabindex: '0', onkeydown: e => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeCharge(i); } } }, h('td', null, s.label),
        h('td', null, K.cell(s.q, 0.1, v => edit(x => { x.q = U.clamp(v, ed.qRange[0], ed.qRange[1]); }))),
        ...[0, 1, 2].map(k => h('td', null, cs && cs.bind ? h('span.muted', null, U.fmt(s.p[k], 3)) : K.cell(+s.p[k].toFixed(3), 0.1, v => edit(x => { x.p[k] = U.clamp(v, -ed.xyz, ed.xyz); x.bind = null; })))),
        h('td', null, cs && cs.bind ? K.btn('解除绑定', () => edit(x => { x.p = s.p.slice(); x.bind = null; }), 'mini', '解除与背景特殊点的绑定，改为自由坐标') : null,
          K.btn('删除', () => removeCharge(i), 'mini', '删除此电荷；也可聚焦此行后按 Delete')));
    });
    const kids = [h('table.src', null, h('thead', null, h('tr', null, ...['源电荷', 'q', 'x', 'y', 'z', ''].map(t => h('th', null, t)))), h('tbody', null, rows))];
    kids.push(h('p.note', null, st.custom || m.alwaysCustom ? '当前为自定义配置，最多放置 ' + ed.max + ' 个源电荷，可以在画板中拖动电荷。' : '当前为标准配置；修改任一电荷后，转为自定义配置。'));
    const btns = [K.btn('添加电荷', () => {
      A.ensureCustom(c);
      if (st.custom.length >= ed.max) return U.toast('最多只能放置 ' + ed.max + ' 个源电荷。');
      st.custom.push({ p: [0, 0, 0], q: 1, label: 'Q' + (st.custom.length + 1) });
      A.update(); A.renderPanel();
    }), K.btn('删除末尾电荷', () => { A.ensureCustom(c); if (st.custom.length > 1) st.custom.pop(); A.update(); A.renderPanel(); })];
    if (!m.alwaysCustom) btns.push(K.btn('恢复标准配置', () => { st.custom = null; A.update(); A.renderPanel(); }));
    kids.push(h('div.btns', null, btns));
    if (ed.placements) {
      const pl = ed.placements(st.p);
      let sel = 0, q = 1;
      kids.push(h('div.place', null, K.select('放置位置', pl.map((x, i) => [i, x.name]), 0, v => { sel = +v; }),
        h('div.row', null, h('label', null, 'q'), K.cell(1, 0.1, v => { q = v; }), K.btn('在此添加电荷', () => {
          A.ensureCustom(c);
          if (st.custom.length >= ed.max) return U.toast('最多只能放置 ' + ed.max + ' 个源电荷。');
          st.custom.push({ p: pl[sel].p.map(x => +x.toFixed(4)), q: U.clamp(q, ed.qRange[0], ed.qRange[1]), label: 'Q' + (st.custom.length + 1) });
          A.update(); A.renderPanel();
        }))));
    }
    return K.group('场源电荷', ...kids);
  };

  // 外观：主题、模型颜色、标注、线条与透明度、动效
  A.COLOR_ROLES = [['pos', '正电荷与正电势层'], ['neg', '负电荷与负电势层'], ['zero', '零电势层'], ['field', '电场线'], ['flow', '流动粒子'], ['probe', '探针'], ['geom', '几何背景'], ['part', '部分和矢量'], ['ang', '角度标注']];
  A.pStyle = function (c) {
    const st = c.st, s = st.style, L = st.layers, lb = st.labels, set = (k, v) => { s[k] = v; A.update(); };
    const sl = (k, label, min, max, step) => K.slider({ label, min, max, step, val: s[k], on: v => set(k, v) });
    const sw = k => {
      const T = EL.THEMES[k], dot = (col, x) => h('i', { style: 'left:' + x + 'px;background:' + U.rgb(col) });
      return h('button', { type: 'button', class: 'swatch' + (EL.theme === k ? ' on' : ''), 'aria-pressed': EL.theme === k, onclick: () => A.setTheme(k) },
        h('div.sw-v', { style: 'background:' + T.bgCss }, dot(T.pos, 12), dot(T.neg, 32), dot(T.probe, 52), dot(T.zero, 72)), h('span', null, T.name));
    };
    const ov = U.store.get('colors:' + EL.theme, {});
    const colors = h('div.colors', null, A.COLOR_ROLES.map(([k, n]) => {
      const inp = h('input', { type: 'color', value: U.toHex(EL.C[k]), 'aria-label': n });
      inp.addEventListener('input', () => { ov[k] = inp.value; U.store.set('colors:' + EL.theme, ov); A.applyColors(); A.update(); });
      return h('label.color', null, inp, h('span', null, n));
    }));
    const notes = st.notes.map((nt, i) => h('div.row.wrap', null, h('span.note-dot'), h('span', null, nt.text + '（' + U.fmtVec(nt.p, 3) + '）'),
      K.btn('删除标注', () => { st.notes.splice(i, 1); A.update(); A.renderPanel(); }, 'mini')));
    let nText = '';
    const nInput = h('input.cell', { type: 'text', placeholder: '标注文字，例如“场强最大处”', style: 'width:100%', oninput: e => { nText = e.target.value; } });
    return [
      K.group('模型颜色', colors, h('div.btns', null, K.btn('恢复默认颜色', () => { U.store.del('colors:' + EL.theme); A.applyColors(); A.update(); A.renderPanel(); }, 'mini')),
        K.tip('修改只对当前主题生效。')),
      K.group('标注文字',
        K.check('显示电荷标注', lb.charges, v => { lb.charges = v; A.update(); }),
        K.check('显示关键点标注', lb.points, v => { lb.points = v; A.update(); }),
        L.contours ? K.check('显示等势线层值', lb.levels, v => { lb.levels = v; A.update(); }) : null,
        K.check('显示矢量标注', lb.vectors, v => { lb.vectors = v; A.update(); }),
        K.check('显示角度标注', lb.angles, v => { lb.angles = v; A.update(); }),
        K.check('显示坐标轴标注', lb.axes, v => { lb.axes = v; A.update(); }),
        K.slider({ label: '标注字号', min: 0.8, max: 1.8, step: 0.05, val: lb.scale, on: v => { lb.scale = v; A.applyLabelScale(); } })),
      K.group('标注点', nInput,
        h('div.btns', null, K.btn('在探针处标注', () => {
          if (!c.probe || !c.probeVisible) return U.toast('请先打开探针。');
          st.notes.push({ p: c.probe.pos.slice(), text: nText.trim() || '标注 ' + (st.notes.length + 1) }); A.update(); A.renderPanel();
        }, 'primary')), ...notes),
      K.group('线条与标记',
        L.lines ? sl('lineWidth', '电场线线宽', 1, 5, 0.1) : null,
        sl('vecScale', '矢量显示比例', 0.2, 2.5, 0.05), sl('chargeSize', '电荷点大小', 2, 8, 0.5), sl('chargeOpacity', '电荷点不透明度', 0.2, 1, 0.05),
        L.surfaces && st.view === '3d' ? sl('surfOpacity', '等势面不透明度', 0.05, 0.6, 0.01) : null,
        L.geom && c.m.id !== 1 && c.m.id !== 2 ? sl('geomOpacity', '几何背景不透明度', 0.02, 0.5, 0.01) : null,
        K.check('显示坐标轴', s.axes, v => set('axes', v)), K.check('显示地面网格', s.grid, v => set('grid', v)),
        K.tip('箭头长度经过压缩，比较大小以读数为准。')),
      K.group('动效',
        K.check('显示电荷光晕', A.r.fx.glow, v => A.setFx('glow', v)),
        K.check('播放电场线绘出动画', A.r.fx.reveal, v => A.setFx('reveal', v)),
        K.note('流动粒子在“显示”面板中打开或关闭。'))];
  };
  A.setFx = function (k, v) { const fx = A.r.fx; fx[k] = v; U.store.set('fx', fx); A.update(); A.renderPanel(); };
  // 自定义颜色覆盖到当前主题
  A.applyColors = function () {
    EL.setTheme(EL.theme);
    const ov = U.store.get('colors:' + EL.theme, {});
    for (const k in ov) EL.C[k] = U.hex(ov[k]);
    A.renderLegend && A.renderLegend();
  };
  A.applyLabelScale = function () { U.$('#labels').style.setProperty('--lbl', A.st.labels.scale); };
})(window.EL);
