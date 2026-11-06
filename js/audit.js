'use strict';
// 页面自检：网址带 #audit 时自动逐个点击全部功能，记录脚本错误与异常状态，结果显示在页面右下角并可复制
(function () {
  if (typeof location === 'undefined' || !/audit/.test(location.hash + location.search)) return;
  const errs = [], issues = [], log = [], t0 = Date.now();
  window.addEventListener('error', e => errs.push(e.message + ' @ ' + String(e.filename || '').split('/').pop() + ':' + e.lineno));
  window.addEventListener('unhandledrejection', e => errs.push('Promise: ' + (e.reason && e.reason.message || e.reason)));
  window.confirm = () => true; window.alert = () => {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const vis = b => b.isConnected && !b.disabled && b.offsetParent !== null;
  const clickAll = async (sel, tag) => { for (const b of [...document.querySelectorAll(sel)]) { if (!vis(b)) continue; try { b.click(); } catch (e) { issues.push(tag + ' 点击出错：' + e.message); } await sleep(2); } };
  // 忽略带引号的 “undefined”（正文有意使用的词）
  const nanText = (sel, tag) => { const el = document.querySelector(sel); const t = el ? el.innerText.replace(/["“]undefined["”]/g, '') : ''; if (/NaN|undefined|\[object/.test(t)) issues.push(tag + ' 文字中出现 NaN/undefined：' + t.match(/.{0,30}(NaN|undefined|\[object).{0,20}/)[0]); };

  async function auditLab() {
    const EL = window.EL, A = EL.App, U = EL.U;
    U.download = () => {}; U.toast = () => {};
    const order = EL.MODELS.slice().sort((a, b) => (a.order || 99) - (b.order || 99));
    for (const m of order) {
      try {
        A.init(m); A.applyStage(0, true); A.onModelChange();
        A.setMode('theory'); await sleep(10); nanText('#theoryBody', m.code + ' 理论页');
        if (!document.querySelector('#theoryBody svg.fig')) issues.push(m.code + ' 理论页缺少示意图');
        await clickAll('#theoryBody details > summary', m.code + ' 理论页');
        A.setMode('explore');
        for (let i = 0; i < m.stages.length; i++) {
          const tag = m.code + ' 阶段' + (i + 1);
          A.gotoStage(i);
          await clickAll('#sbLayers button', tag + ' 图层按钮'); await clickAll('#sbLayers button', tag + ' 图层按钮');
          Object.assign(A.st.layers, { lines: true, flow: true, contours: true, probe: A.hasProbe(m) }); A.update();
          for (const t of ['params', 'display', 'style', 'anim']) {
            A.tab = t; A.drawerOff = false; A.renderPanel();
            await clickAll('#panel .seg button', tag + ' ' + t);
            await clickAll('#panel input[type=checkbox]', tag + ' ' + t); await clickAll('#panel input[type=checkbox]', tag + ' ' + t);
            nanText('#panel', tag + ' 面板 ' + t);
          }
          await clickAll('#stageActions button', tag + ' 阶段按钮');
          Object.assign(A.st.layers, { lines: true, probe: A.hasProbe(m) }); A.update();
          A.setMode('analyze'); await sleep(5);
          for (const id of ['#geoBox', '#compBox', '#curveBox']) { const d = document.querySelector(id); if (d) d.open = true; }
          A.renderGeo(); A.renderComp();
          await clickAll('#geo input[type=checkbox]', tag + ' 几何关系'); await clickAll('#comp input[type=checkbox]', tag + ' 自由合成');
          nanText('#readings', tag + ' 读数'); nanText('#geo', tag + ' 几何关系');
          if (A.wizData(A.c) && A.c.probeVisible) for (const meth of ['geo', 'coord']) {
            A.st.wiz.method = meth; A.startWizard();
            const cs = A.c.cs;
            if (!cs) { issues.push(tag + ' 向导无法启动（' + meth + '）'); continue; }
            for (let k = 0; k < cs.n; k++) { A.gotoStep(k); const o = [...document.querySelectorAll('#caption .cap-opts .btn')]; if (o.length) o[0].click(); nanText('#caption', tag + ' 向导 ' + meth + ' 第' + (k + 1) + '步'); await sleep(2); }
            A.stopWizard();
          }
          if (!A.st.layers.lines) issues.push(tag + ' 分析后电场线被关闭');
          if (A.c.sources.some(s => s.q) && !A.r.scene.lines.some(l => l.reveal)) issues.push(tag + ' 分析工作区中没有电场线');
          A.setMode('record'); await clickAll('#exercises .ex button', tag + ' 练习'); A.setMode('explore');
        }
        // 只显示流动粒子
        Object.assign(A.st.layers, { lines: false, flow: true }); A.update(); await sleep(30);
        if (A.c.sources.some(s => s.q) && !A.r.flow.n) issues.push(m.code + ' 关闭电场线后流动粒子不显示');
        if (A.r.scene.lines.some(l => l.reveal)) issues.push(m.code + ' 关闭电场线后仍画出电场线');
        log.push(m.code + ' ✓');
      } catch (e) { issues.push(m.code + ' 运行出错：' + e.message + ' ' + String(e.stack || '').split('\n')[1]); }
    }
    try {
      const snap = A.snapshot(); A.st.notes.push({ p: [0, 0, 0], text: 'x' }); A.restore(snap);
      if (A.st.notes.length) issues.push('草稿恢复后标注点没有还原');
      A.exportWorksheet(false); A.exportWorksheet(true); A.togglePresent(true); await sleep(450); A.togglePresent(false);
      log.push('草稿 / 学习单 / 演示 ✓');
    } catch (e) { issues.push('草稿或学习单出错：' + e.message); }
  }

  async function auditEx() {
    const EL = window.EL, X = EL.EX, U = EL.U;
    U.download = () => {}; U.toast = () => {};
    for (const pb of X.BUILTIN) {
      try {
        X.setMode('student'); X.open(pb); await sleep(10);
        X.S.sol.ans.forEach((o, i) => { if (!o.ok) issues.push(pb.id + ' 第' + (i + 1) + '问无法求解：' + o.err); });
        for (let i = 0; i < X.S.sol.ans.length; i++) {
          const o = X.S.sol.ans[i];
          if (!o.ok) continue;
          X.guide(i); await sleep(5);
          if (X.S.f && X.S.f.kind === 'plan') for (let k = 0; k < o.plan.length; k++) { X.S.step = k; if (o.plan[k].ask) X.S.ans[k] = o.plan[k].ask.a; X.focusStep(); nanText('#caption', pb.id + ' 第' + (i + 1) + '问 引导第' + (k + 1) + '步'); await sleep(2); }
          if (o.options) { X.check(i, o.q.t === 'E' ? o.mag : o.answer); if (!X.S.res[i].ok) issues.push(pb.id + ' 第' + (i + 1) + '问：正确选项被判错'); }
          X.S.res[i] = { exp: true, show: true }; X.renderProblem(); nanText('#exMain', pb.id + ' 解析');
        }
        log.push(pb.id + ' ✓');
      } catch (e) { issues.push(pb.id + ' 运行出错：' + e.message); }
    }
    try {
      X.setMode('teacher'); X.T.start();
      for (const tpl of Object.keys(X.TEMPLATES)) {
        X.T.d.tpl = tpl; X.T.d.charges = Object.fromEntries(X.geo(tpl).labels.map((n, i) => [n, i % 2 ? 1 : -1])); X.T.d.pts = {}; X.T.d.qs = [];
        const sug = X.suggest(X.T.d); if (sug[0]) X.T.d.pts.P = { def: sug[0].c.def };
        for (const t of Object.keys(X.QTYPES)) X.T.d.qs.push(X.defQ(t, X.T.d, X.T.sol()));
        for (let s = 0; s < 5; s++) { X.T.step = s; X.T.render(); nanText('#tForm', tpl + ' 出题第' + (s + 1) + '步'); nanText('#tAssist', tpl + ' 出题助手'); await sleep(3); }
        await clickAll('#tForm .seg button', tpl + ' 电荷按钮');
        X.print(X.T.d, false); X.print(X.T.d, true);
        log.push('出题 ' + tpl + ' ✓');
      }
      X.setMode('student');
    } catch (e) { issues.push('题目添加出错：' + e.message + ' ' + String(e.stack || '').split('\n')[1]); }
  }

  function report(page) {
    const ok = !errs.length && !issues.length, txt = '【' + page + ' 自检】' + (ok ? '全部通过' : '发现问题') + '，用时 ' + ((Date.now() - t0) / 1000).toFixed(1) + ' 秒\n' +
      (errs.length ? '脚本错误：\n' + [...new Set(errs)].join('\n') + '\n' : '') + (issues.length ? '异常：\n' + [...new Set(issues)].join('\n') + '\n' : '') + '已检查：' + log.join('，');
    try { localStorage.setItem('ejp-lab:audit:' + page, txt); } catch (e) {}
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:999;width:min(560px,90vw);max-height:60vh;overflow:auto;background:#fff;color:#142033;border:2px solid ' + (ok ? '#009e73' : '#b4233c') + ';border-radius:12px;padding:12px 14px;font:13px/1.6 "Microsoft YaHei",sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3);white-space:pre-wrap';
    box.textContent = txt;
    const bar = document.createElement('div'); bar.style.marginTop = '8px';
    const btn = (t, f) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = 'margin-right:8px;padding:4px 10px;border:1px solid #ccd;border-radius:6px;background:#f4f6fd;cursor:pointer'; b.onclick = f; bar.append(b); };
    btn('复制结果', () => { navigator.clipboard && navigator.clipboard.writeText(txt); b0.textContent = '已复制'; });
    const b0 = bar.lastChild;
    if (page === '实验室') btn('继续检查例题页 →', () => { location.href = 'examples.html#audit'; });
    btn('关闭', () => box.remove());
    box.append(bar); document.body.append(box);
  }

  window.addEventListener('load', () => setTimeout(async () => {
    const isEx = !!(window.EL && window.EL.EX && window.EL.EX.T);
    try { if (isEx) await auditEx(); else await auditLab(); } catch (e) { issues.push('自检本身出错：' + e.message); }
    await sleep(300);
    report(isEx ? '例题页' : '实验室');
  }, 600));
})();
