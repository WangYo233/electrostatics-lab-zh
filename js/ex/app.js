'use strict';
// 例题模块入口：模式切换（例题探究 / 题目添加）、地址参数、显示开关、导入、主题
// 地址：examples.html?mode=add（兼容 ?mode=teacher）打开题目添加；examples.html?model=<实验室模型 id> 打开该模型的第一道例题
(function (EL) {
  const U = EL.U, h = U.h, K = EL.UI, X = EL.EX, W = X.W;
  // 内部模式名仍为 'teacher'（样式选择器 body[data-exmode] 依赖它），界面文字为“题目添加”
  X.setMode = function (m, now) {
    if (!now && document.body.dataset.exmode !== m && EL.motion) return EL.motion.swap(() => X.setMode(m, true));
    document.body.dataset.exmode = m;
    U.$$('.modes button').forEach(b => b.setAttribute('aria-selected', b.dataset.mode === m));
    const b = U.$('.modes button[data-mode="' + m + '"]'), ink = U.$('.mode-ink');
    if (b) { ink.style.width = b.offsetWidth + 'px'; ink.style.transform = 'translateX(' + (b.offsetLeft - 3) + 'px)'; }
    document.title = (m === 'teacher' ? '题目添加' : '例题探究') + ' · 静电学实验室';
    if (m === 'teacher' && X.stopPath) X.stopPath();
    if (m === 'teacher') { if (!X.T.d) X.T.start(); else X.T.render(); }
    else { U.$('#caption').hidden = true; if (X.S.pb) { X.focus(null); X.renderProblem(); } else { X.renderProblem(); W.r.setScene({}); } }
    requestAnimationFrame(() => W.r.draw());
  };
  X.renderChips = function () {
    const L = W.layers, items = [['geom', '几何模型'], ['sphere', '内切球'], ['lines', '电场线'], ['flow', '流动动画'], ['labels', '标注']];
    U.$('#sbLayers').replaceChildren(...items.map(([k, t]) => h('button', { type: 'button', class: L[k] ? 'on' : '', 'aria-pressed': L[k], onclick: () => { L[k] = !L[k]; X.renderChips(); if (W.last) W.show(...W.last); } }, t)));
  };
  function openElementStyle(e) {
    e.preventDefault();
    const canvas = U.$('#gl'), rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
    const sol = X.S.sol, src = sol && sol.R.sources.map(s => ({ s, p: W.r.cam.toScreen(W.M(s.p)) })).filter(o => o.p).sort((a, b) => Math.hypot(a.p[0] - x, a.p[1] - y) - Math.hypot(b.p[0] - x, b.p[1] - y))[0];
    if (!src || Math.hypot(src.p[0] - x, src.p[1] - y) > 32) return;
    const menu = U.$('#elementStyle'), look = W.appearance[src.s.label] || {};
    const color = h('input', { type: 'color', value: look.color || U.toHex(src.s.q > 0 ? EL.C.pos : EL.C.neg), 'aria-label': '电荷颜色' });
    color.addEventListener('input', () => { W.appearance[src.s.label] = Object.assign({}, W.appearance[src.s.label], { color: color.value }); U.store.set('ex:appearance', W.appearance); if (W.last) W.show(...W.last); });
    const size = K.slider({ label: '电荷大小', min: 0.6, max: 2.4, step: 0.1, val: look.size || 1, on: v => { W.appearance[src.s.label] = Object.assign({}, W.appearance[src.s.label], { size: v }); U.store.set('ex:appearance', W.appearance); if (W.last) W.show(...W.last); } });
    const glow = K.check('电荷光晕动画', W.r.fx.glow, v => { W.r.fx.glow = v; if (W.last) W.show(...W.last); });
    const reveal = K.check('电场线绘制动画', W.r.fx.reveal, v => { W.r.fx.reveal = v; if (W.last) W.show(...W.last); });
    menu.replaceChildren(h('b', null, src.s.label + ' 外观'), h('label.row.wrap', null, h('span', null, '颜色'), color), size, glow, reveal);
    menu.hidden = false; menu.style.left = Math.min(e.clientX, innerWidth - 250) + 'px'; menu.style.top = Math.min(e.clientY, innerHeight - 190) + 'px';
  }
  // 地址参数 → 初始状态（纯函数，便于测试）
  X.route = function (search) {
    const q = new URLSearchParams(search || ''), mode = q.get('mode'), model = q.get('model');
    return { mode: mode === 'add' || mode === 'teacher' ? 'teacher' : 'student', model: model && X.LABS[+model] ? +model : null };
  };
  window.addEventListener('DOMContentLoaded', () => {
    try { W.init(); } catch (e) { U.$('#stage').replaceChildren(h('p.err', null, '无法初始化 WebGL，三维画板不能显示。原因：' + e.message)); return; }
    U.$('#stage').after(U.$('#caption')); U.$('#caption').classList.add('glass');
    U.$('#gl').addEventListener('contextmenu', openElementStyle);
    document.addEventListener('pointerdown', e => { if (!U.$('#elementStyle').contains(e.target)) U.$('#elementStyle').hidden = true; });
    X.renderChips(); X.renderList();
    U.$$('.modes button').forEach(b => b.addEventListener('click', () => X.setMode(b.dataset.mode)));
    U.$('#btnTheme').addEventListener('click', () => W.setTheme(EL.theme === 'dark' ? 'light' : 'dark'));
    U.$('#btnHome').addEventListener('click', () => W.r.cam.reset(W.AD * 1.2, false, true));
    U.$('#btnTop').addEventListener('click', () => W.align([0, 0, 1]));
    U.$('#btnZin').addEventListener('click', () => { W.r.cam.zoom(1 / 1.2); W.r.draw(); });
    U.$('#btnZout').addEventListener('click', () => { W.r.cam.zoom(1.2); W.r.draw(); });
    U.$('#btnFull').addEventListener('click', () => { const el = U.$('#stage'); document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen && el.requestFullscreen(); });
    U.$('#btnNew').addEventListener('click', () => { X.T.start(null, X.S.pb ? X.itemKey(X.S.pb) : X.S.empty ? (X.firstItem(X.S.empty) || {}).key : null); X.setMode('teacher'); });
    U.$('#btnEdit').addEventListener('click', () => { if (!X.S.pb) return U.toast('请先选择一道题。'); X.T.start(X.S.pb); X.setMode('teacher'); });
    U.$('#btnImport').addEventListener('click', () => U.$('#importFile').click());
    U.$('#importFile').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => {
        try {
          const pb = JSON.parse(t); if (!pb || !X.valid(pb)) throw new Error('文件中没有可识别的模型');
          pb.id = 'my-' + Date.now().toString(36); pb.model = X.modelOf(pb); pb.kind = X.kindOf(pb); pb.pts = pb.pts || {}; pb.qs = pb.qs || [];
          const mine = U.store.get('ex:mine', []); mine.push(pb); U.store.set('ex:mine', mine); X.setMode('student'); X.open(pb); U.toast('已导入到“我的题目”。');
        } catch (er) { U.toast('导入失败：' + er.message); }
      });
      e.target.value = '';
    });
    U.$('#btnDel').addEventListener('click', () => {
      const pb = X.S.pb; if (!pb || !String(pb.id).startsWith('my-')) return U.toast('内置例题不能删除，只能删除“我的题目”中的题目。');
      if (!confirm('确定删除“' + pb.title + '”吗？删除后不能恢复。')) return;
      U.store.set('ex:mine', U.store.get('ex:mine', []).filter(x => x.id !== pb.id)); X.S.pb = null; X.renderList(); X.open(X.BUILTIN[0]);
    });
    const r = X.route(location.search);
    if (r.model) X.openModel(r.model); else X.open(X.BUILTIN[0]);
    if (r.mode === 'teacher') X.T.start(null, r.model ? (X.firstItem(r.model) || {}).key : null);
    X.setMode(r.mode, true);
  });
})(window.EL);
