'use strict';
// 教学过程：构造步骤（先预测、后揭示）、画板说明条、推导、正视平面、课堂演示模式、导出学习单
(function (EL) {
  const U = EL.U, h = U.h, K = EL.UI, A = EL.App, V = EL.V;

  // 沿法向 n 正视某平面（三维矢量合成化为平面作图）
  A.alignView = function (n, points) {
    const cam = A.r.cam;
    if (n === 'reset') return cam.reset(A.c.bound, A.st.view === '2d', true);
    if (A.st.view !== '3d') return;
    let d = V.norm(n);
    if (V.dot(d, V.sub(cam.eye(), cam.target)) < 0) d = V.mul(d, -1);
    cam.tween({ theta: Math.atan2(d[1], d[0]), phi: U.clamp(Math.asin(U.clamp(d[2], -1, 1)), -1.5, 1.5), ...(points ? cam.frame(points) : { target: [0, 0, 0] }) }, 750);
  };

  // 画板下方说明条：步骤标题、说明、公式与预测题
  A.renderCaption = function (force) {
    const box = U.$('#caption'), cs = A.c && A.c.cs;
    if (!cs) { box.hidden = true; A.capSig = null; return; }
    const sig = cs.i + ':' + cs.ans + ':' + U.fmtVec(A.c.probe.pos, 3) + ':' + A.c.sources.map(s => s.q + U.fmtVec(s.p, 3)).join();
    if (!force && sig === A.capSig) return;
    A.capSig = sig;
    box.hidden = false;
    box.replaceChildren(...A.capNodes(cs, ans => { A.st.wiz.ans[cs.i] = ans; A.afterStep(); }, {
      prev: () => A.gotoStep(cs.i - 1), next: () => cs.i === cs.n - 1 ? A.stopWizard() : A.gotoStep(cs.i + 1), stop: () => A.stopWizard(),
      label: (A.st.wiz.method === 'coord' ? '坐标法 ' : '几何法 ') + (cs.i + 1) + ' / ' + cs.n, hideNote: A.st.wiz.hide }).filter(Boolean));
  };
  // 说明条内容（实验室与例题共用）：先预测 → 反馈 → 说明、表格、公式 → 导航
  A.capNodes = function (cs, onAns, nav) {
    const s = cs.step, kids = [h('div.cap-h', null, h('span.cap-n', null, nav.label), h('b', { html: U.rich(s.title) }))];
    if (s.ask && cs.ans == null) {
      if (s.setup) kids.push(h('p.cap-t', { html: U.rich(s.setup) }));
      kids.push(h('p.cap-q', { html: '先预测：' + U.rich(s.ask.q) }),
        h('div.cap-opts', null, s.ask.options.map(o => { const b = K.btn('', () => onAns(o)); b.innerHTML = U.rich(o); return b; }), K.btn('跳过预测', () => onAns(''), 'mini skip')));
    } else {
      if (s.ask) {
        const ok = cs.ans === s.ask.a;
        kids.push(h('p', { class: 'cap-fb ' + (cs.ans === '' ? 'skip' : ok ? 'ok' : 'bad'), html: (cs.ans === '' ? '答案：' + U.rich(s.ask.a) + '。' : ok ? '✓ 预测正确。' : '✗ 预测有误，答案是 ' + U.rich(s.ask.a) + '。') + U.rich(s.ask.why) }));
      }
      kids.push(h('p.cap-t', { html: U.rich(s.text) }), h('div', { html: EL.VA.stepHTML(s) }));
    }
    const last = cs.i === cs.n - 1;
    kids.push(h('div.cap-nav', null, K.btn('‹', nav.prev, 'mini', '返回上一步'),
      h('span.cap-progress', null, '步骤 ' + (cs.i + 1) + ' / ' + cs.n),
      nav.stop ? K.btn('退出向导', nav.stop, 'mini') : null, K.btn(last ? '完成合成' : '下一步 ›', nav.next, 'mini primary')));
    return kids;
  };

  A.gotoStep = function (i) {
    const cs = A.c && A.c.cs;
    if (!cs) return;
    A.st.wiz.i = EL.U.clamp(i, 0, cs.n - 1);
    A.afterStep();
  };
  A.afterStep = function () {
    A.update();
    const cs = A.c.cs;
    if (cs) { const v = cs.step.view; if (v) A.alignView(typeof v === 'function' ? v(A.c) : v, cs.step.tetra ? A.c.sources.map(s => s.p).concat([cs.step.tetra.P, cs.step.tetra.H]) : null); }
    A.renderCaption(true); A.renderStepList(); A.renderDerive(); A.renderComp();
  };
  // 分析工作区中的向导步骤概览
  A.renderStepList = function () {
    const cs = A.c && A.c.cs, box = U.$('#stepList');
    if (!box) return;
    U.$('#wizStart').hidden = !!cs;
    if (!cs) { box.replaceChildren(); return; }
    box.replaceChildren(...cs.steps.map((x, i) => {
      const ans = A.st.wiz.ans[i];
      return h('li', { class: (i === cs.i ? 'on' : '') + (i < cs.i ? ' done' : '') }, h('button', { type: 'button', onclick: () => A.gotoStep(i) },
        h('span.n', null, i + 1), h('span', { html: U.rich(x.title) }), x.ask ? h('em', { class: ans == null ? 'q' : ans === x.ask.a ? 'ok' : 'bad', title: ans == null ? '这一步有预测题，尚未作答' : '' }, ans == null ? '?' : ans === x.ask.a ? '✓' : '✗') : null));
    }));
  };
  // 已揭示步骤的推导汇总
  A.renderDerive = function () {
    const cs = A.c && A.c.cs, box = U.$('#deriveBox');
    box.hidden = !cs;
    if (!cs) return;
    const rows = cs.steps.slice(0, cs.k + 1).filter(x => x.tex || x.rows).map(x => h('div.der', null, h('b', { html: U.rich(x.title) }), h('div.formula', { html: EL.VA.stepHTML(x) })));
    U.$('#derive').replaceChildren(...(rows.length ? rows : [K.note('在画板下方完成合成步骤后，这里会按顺序汇总每一步的计算。')]));
  };

  // 课堂演示：隐藏工具与检查器，放大画板与说明条，方向键逐步推进
  A.togglePresent = function (on) {
    on = on == null ? !document.body.classList.contains('present') : on;
    document.body.classList.toggle('present', on);
    if (on && !/explore|analyze/.test(document.body.dataset.mode)) A.setMode('explore');
    U.$('#btnPresent').setAttribute('aria-pressed', on);
    setTimeout(() => { A.r.draw(); A.setMode(document.body.dataset.mode); }, 380);
  };

  // 导出学习单（可打印 HTML）；teacher=true 时附参考答案与教学提示
  A.exportWorksheet = function (teacher) {
    const m = A.st.model, sub = A.st.sub, t = A.theoryOf(), ex = m.exercisesFor ? m.exercisesFor(sub) : m.exercises || [];
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const lines = n => '<div class="ln"></div>'.repeat(n);
    let html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>' + esc(m.code + ' ' + m.title) + ' 学习单</title><style>' +
      'body{font-family:"Times New Roman","Microsoft YaHei",serif;max-width:800px;margin:24px auto;padding:0 20px;color:#142033;line-height:1.6}' +
      'h1{font-size:22px}h2{font-size:16px;border-left:4px solid #3d55d1;padding-left:8px;margin-top:26px}h3{font-size:14px;margin:14px 0 4px}' +
      '.ln{border-bottom:1px solid #9aa6b2;height:26px}.q{margin:8px 0}.box{border:1px solid #cdd5df;border-radius:6px;padding:8px 12px;margin:8px 0}' +
      'table{border-collapse:collapse;width:100%}td,th{border:1px solid #9aa6b2;height:30px;padding:4px}.ans{color:#2c41ad}math{font-family:"Cambria Math","STIX Two Math","Latin Modern Math",serif}math.rm{font-size:1em}' +
      '.eqn{display:grid;grid-template-columns:minmax(3em,1fr) auto minmax(3em,1fr);align-items:center;margin:8px 0}.eqn-m{grid-column:2;text-align:center}.eqn-n{grid-column:3;justify-self:end;font-family:"Times New Roman",serif}math[display=block]{display:block math;margin:4px auto}' +
      '@media print{body{margin:0}h2{break-after:avoid}.st{break-inside:avoid}}</style></head><body>';
    html += '<h1>' + esc(m.code + ' ' + m.title + (m.analytic ? ' · ' + EL.SUB08[sub].name : '')) + '　学习单' + (teacher ? '（教师版）' : '') + '</h1>';
    const R = U.richMath;
    html += '<p>姓名 ________　班级 ________　日期 ________</p><h2>一、基础学习</h2><p>' + R(t.intro) + '</p>' +
      t.formulas.map((x, i) => EL.texEq(x.tex, i + 1) + '<p style="font-size:13px;color:#3a4a60"><b>式 (' + (i + 1) + ')</b>　' + R(x.where) + '</p>').join('');
    html += '<h2>二、模型嵌入</h2>' + A.figure(A.c, t).replace('<svg ', '<svg style="max-width:420px;display:block;margin:6px auto" ') + '<p>' + R(t.model) + '</p>';
    html += '<h2>三、实验探究</h2>';
    m.stages.forEach((s, i) => {
      html += '<div class="st"><h3>阶段 ' + (i + 1) + '　' + esc(s.title) + '</h3><p class="q"><b>探究问题：</b>' + R(s.q) + '</p><p><b>观察要点：</b>' + R(s.obs) + '</p>';
      html += '<div class="box"><b>我的预测：</b>' + lines(2) + '</div><p><b>记录要求：</b>' + R(s.rec) + '</p>' + lines(3);
      if (teacher && s.hint) html += '<p class="ans">推理线索：' + R(s.hint) + '</p>';
      html += '</div>';
    });
    if (!m.analytic) html += '<h3>场强合成记录（使用“分析”工作区中的场强合成向导）</h3><table><tr><th>观察点</th><th>各分场强的大小</th><th>先合成的一对分场强及其夹角</th><th>部分和 Σ₁、Σ₂</th><th>合场强</th></tr>' + '<tr><td></td><td></td><td></td><td></td><td></td></tr>'.repeat(3) + '</table>';
    html += '<h2>预测与核对</h2>' + ex.map((e, i) => '<p class="q">' + (i + 1) + '. ' + R(e.q) + (e.options ? '<br>' + e.options.map(o => '□ ' + R(o)).join('　') : '　答：__________') +
      (teacher ? '<br><span class="ans">答案：' + R(e.options ? e.a : U.fmt(e.a, 6)) + (e.why ? '。' + R(e.why) : '') + '</span>' : '') + '</p>').join('');
    html += '<h2>学习记录</h2><table><tr><th>配置 / 位置</th><th>预测</th><th>实测 V、E</th><th>解释 / 结论</th></tr>' + '<tr><td></td><td></td><td></td><td></td></tr>'.repeat(5) + '</table></body></html>';
    U.download('学习单_' + m.code + '_' + m.title + (teacher ? '_教师版' : '') + '.html', html, 'text/html;charset=utf-8');
  };
})(window.EL);
