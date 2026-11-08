'use strict';
// 例题探究（学生）：选题 → 读题 → 作答（选项 A、B、C、D）→ 引导探究（先预测、后揭示）→ 查看解析
(function (EL) {
  const U = EL.U, h = U.h, K = EL.UI, X = EL.EX, W = X.W, V = EL.V, VA = EL.VA;
  const S = X.S = { pb: null, sol: null, qi: -1, step: 0, ans: {}, path: 0.3, res: {}, empty: null, pathPlaying: false, pathRaf: 0 };
  X.stopPath = function () { S.pathPlaying = false; if (S.pathRaf) cancelAnimationFrame(S.pathRaf); S.pathRaf = 0; };

  X.renderList = function () {
    const mine = U.store.get('ex:mine', []), item = (pb, tag) => h('button', { type: 'button', class: 'ex-item' + (S.pb && S.pb.id === pb.id ? ' on' : ''), onclick: () => X.open(pb) },
      h('b', null, pb.title), h('span', null, X.modelName(pb) + ' · ' + (pb.qs || []).length + ' 问' + (tag ? ' · ' + tag : '')));
    U.$('#exList').replaceChildren(h('h3', null, '内置例题'), ...X.BUILTIN.map(pb => item(pb, pb.src)),
      h('h3', null, '我的题目'), ...(mine.filter(X.valid).length ? mine.filter(X.valid).map(pb => item(pb)) : [h('p.note', null, '在“题目添加”中保存的题目会出现在这里。')]));
  };
  X.open = function (pb) {
    X.stopPath();
    S.pb = pb; S.sol = X.solve(pb); S.qi = -1; S.step = 0; S.ans = {}; S.res = {}; S.empty = null;
    X.renderList(); X.renderProblem(); W.r.cam.reset(W.AD * 1.2, false, true); X.focus(null);
  };
  // 实验室“例题探究”跳转：打开该模型的第一道例题；没有时说明并保留列表
  X.openModel = function (id) {
    const pb = X.findByModel(id);
    if (pb) return X.open(pb);
    S.pb = null; S.sol = null; S.empty = +id; S.qi = -1;
    X.renderList(); X.renderProblem(); X.renderCap();
    W.last = null; W.r.setScene({});
  };
  X.focus = function (f) { S.f = f; if (S.pb) W.show(S.pb, S.sol, f); X.renderCap(); };

  X.renderProblem = function () {
    const box = U.$('#exMain');
    if (!S.pb) {
      const L = X.LABS[S.empty], it = X.firstItem(S.empty);
      return box.replaceChildren(h('h2', null, L ? L.code + ' ' + L.title : '例题'), h('div.ex-empty', null, h('p', null, '本模型暂无例题。可以在“题目添加”中为本模型出题。'),
        it ? K.btn('为本模型出题', () => { X.T.start(null, it.key); X.setMode('teacher'); }, 'primary') : null, h('p.note', null, '也可以在左侧列表中选择其他模型的例题。')));
    }
    const pb = S.pb, sol = S.sol;
    const cards = sol.ans.map((o, i) => {
      const q = o.q, r = S.res[i], right = X.rightOf(o), L = o.options ? X.optLetter(o.options, right) : '';
      const ansT = o.options ? L + '. ' + U.rich(right) : U.rich(o.answer);
      const fb = r && r.pick != null ? h('p', { class: 'fb ' + (r.ok ? 'ok' : 'bad'), html: (r.ok ? '✓ 正确' + (o.options ? '，答案是 ' + L : '') + '。' : '✗ ' + (o.options ? '选项 ' + X.optLetter(o.options, r.pick) + ' ' : '') + '不正确，再想一想。') + (r.show && !r.ok ? ' 答案：' + ansT + '。' : '') })
        : r && r.show ? h('p.fb.skip', { html: '答案：' + ansT + '。' }) : null;
      let inp;
      if (!o.ok) inp = h('p.note', null, o.err);
      else if (o.options) inp = h('div.opts', { role: 'group', 'aria-label': '选项' }, o.options.map((v, j) => h('button', { type: 'button', class: 'btn opt' + (r && r.pick === v ? (r.ok ? ' ok' : ' bad') : ''), 'aria-pressed': !!(r && r.pick === v),
        html: '<b class="opt-l">' + X.letter(j) + '.</b> ' + U.rich(v), onclick: () => X.check(i, v) })));
      else { const t = h('input.cell', { type: 'text', placeholder: '例如 √3 或 2/3', 'aria-label': '填写答案', style: 'width:9em' }); inp = h('div.row.wrap', null, t, K.btn('检查答案', () => X.check(i, t.value))); }
      return h('section.qcard' + (S.qi === i ? '.on' : ''), null, h('div.qh', null, h('span.qn', null, '(' + (i + 1) + ')'), h('p', { html: U.rich(X.qText2(q, pb)) })), inp, fb,
        o.ok ? h('div.btns', null, K.btn('引导探究', () => X.guide(i), S.qi === i ? 'on' : ''), K.btn(r && r.exp ? '收起解析' : '查看解析', () => { S.res[i] = Object.assign(S.res[i] || {}, { exp: !(r && r.exp), show: true }); X.renderProblem(); }), K.btn('显示答案', () => { S.res[i] = Object.assign(S.res[i] || {}, { show: true }); X.renderProblem(); }, 'ghost')) : null,
        r && r.exp ? h('div.exp', null, ...X.explain(o).map(l => h('div', null, h('p', { html: U.rich(l.t) }), l.tex ? h('div.formula', { html: EL.texBlock(l.tex) }) : null))) : null);
    });
    box.replaceChildren(h('h2', null, pb.title), h('div.stem', null, h('p', { html: U.rich(pb.stem || X.stem(pb, sol.R)) }), pb.note ? h('p.note', { html: U.rich(pb.note) }) : null), ...cards);
  };
  X.check = function (i, v) {
    const o = S.sol.ans[i];
    let ok;
    if (o.options) ok = v === X.rightOf(o);
    else { const x = U.parseNum(String(v).replace(/ .*$/, '')); ok = isFinite(x) && Math.abs(x - o.value) <= Math.max(0.002, 0.005 * Math.abs(o.value)); }
    S.res[i] = Object.assign(S.res[i] || {}, { ok, pick: v, show: ok });
    X.renderProblem();
  };

  // 引导探究：场强题走三维合成步骤；路径题拖动观察；电势题列出各项；解析场显示观察点的读数；圆盘显示电荷对
  X.guide = function (i) {
    X.stopPath();
    const o = S.sol.ans[i], R = S.sol.R;
    S.qi = i; S.step = 0; S.ans = {};
    if (o.focus === 'pairs') X.focus({ kind: 'pairs' });
    else if (o.q.t === 'trend') { S.path = 0.3; X.focus({ kind: 'path', a: o.q.a, b: o.q.b, s: S.path }); }
    else if (R.analytic) X.focus({ kind: 'probe', pts: o.probePts || o.probe.map(n => R.pts[n].p), names: o.probePts ? null : o.probe });
    else if (o.plan && (o.q.t === 'E' || o.q.t === 'angle' || o.q.t === 'Ezero')) X.focusStep();
    else if (o.q.t === 'V') X.focus({ kind: 'terms', at: [o.q.at] });
    else X.focus({ kind: 'terms', at: [o.q.a, o.q.b] });
    X.renderProblem();
  };
  X.focusStep = function () {
    const o = S.sol.ans[S.qi], st = o.plan[S.step], rev = !st.ask || S.ans[S.step] != null;
    const k = rev ? S.step : S.step - 1;
    X.focus({ kind: 'plan', plan: o.plan, k: Math.max(0, k), hide: S.step > 0 });
    const v = (o.plan[Math.max(0, k)] || {}).view;
    if (v) W.align(v === 'reset' ? 'reset' : v);
  };
  const fmtP = p => '(' + p.map(x => U.fmt(x, 3)).join(', ') + ')';
  function drawPotentialCurve(canvas, R, a, b, s) {
    const dpr = devicePixelRatio || 1, w = canvas.clientWidth, h0 = canvas.clientHeight;
    if (!w || !h0) return;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h0 * dpr);
    const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h0);
    const vals = Array.from({ length: 101 }, (_, i) => { const x = 0.02 + 0.96 * i / 100, q = V.lerp(R.pts[a].p, R.pts[b].p, x); return [x, R.field(q).V]; }).filter(x => isFinite(x[1]));
    if (!vals.length) return;
    const lo = Math.min(...vals.map(x => x[1])), hi = Math.max(...vals.map(x => x[1])), span = hi - lo || 1;
    const L = 38, T = 10, B = 22, RW = w - L - 8, RH = h0 - T - B;
    const Xp = x => L + (x - 0.02) / 0.96 * RW, Yp = y => T + (hi - y) / span * RH;
    const dark = EL.theme === 'dark'; g.strokeStyle = dark ? '#718096' : '#68778a'; g.fillStyle = dark ? '#e5edf7' : '#263446'; g.lineWidth = 1; g.font = '11px sans-serif';
    g.beginPath(); g.moveTo(L, T); g.lineTo(L, T + RH); g.lineTo(L + RW, T + RH); g.stroke();
    g.fillText('φ', 8, 13); g.fillText(a + ' → ' + b, Math.max(L + 4, w - 65), h0 - 4); g.fillText(U.fmt(hi, 3), 3, T + 4); g.fillText(U.fmt(lo, 3), 3, T + RH);
    g.strokeStyle = '#f28e2b'; g.lineWidth = 2; g.beginPath(); vals.forEach((q, i) => i ? g.lineTo(Xp(q[0]), Yp(q[1])) : g.moveTo(Xp(q[0]), Yp(q[1]))); g.stroke();
    const v = R.field(V.lerp(R.pts[a].p, R.pts[b].p, s)).V; if (isFinite(v)) { g.fillStyle = '#d1495b'; g.beginPath(); g.arc(Xp(s), Yp(v), 4, 0, Math.PI * 2); g.fill(); }
  }
  function animatePath() {
    if (!S.pathPlaying) return;
    S.path += 0.003; if (S.path > 0.98) S.path = 0.02;
    updatePath(S.path);
    S.pathRaf = requestAnimationFrame(animatePath);
  }
  function updatePath(value) {
    if (!S.sol || S.qi < 0) return;
    const o = S.sol.ans[S.qi], f = S.f;
    S.path = value; f.s = value;
    W.show(S.pb, S.sol, f);
    const box = U.$('#caption'), range = box.querySelector('input[type="range"]'), number = box.querySelector('input[type="number"]');
    if (range) range.value = value;
    if (number && document.activeElement !== number) number.value = value.toFixed(3);
    const R = S.sol.R, p = V.lerp(R.pts[f.a].p, R.pts[f.b].p, value), field = R.field(p), T = field.ok ? field.E : [0, 0, 0], t = V.norm(V.sub(R.pts[f.b].p, R.pts[f.a].p)), Ep = V.dot(T, t), th = V.len(T) > 1e-12 ? VA.ang(T, t) : 90, u = R.units;
    const tip = !field.ok ? 'X 点处的场强未定义。' : V.len(T) <= 1e-12 ? 'X 点的合场强为零，此处电势沿路径的变化率为零。'
      : '合场强与路径方向的夹角约为 ' + VA.f4(th) + '°，合场强沿路径方向的分量 E_∥ 约为 ' + VA.f4(Ep) + (u.E ? ' ' + u.E : '') + '。' +
        (Ep > 1e-9 ? '夹角小于 90°，所以在 X 点附近沿路径电势降低。' : Ep < -1e-9 ? '夹角大于 90°，所以在 X 点附近沿路径电势升高。' : '合场强与路径垂直，所以在 X 点附近电势沿路径的变化率为零。');
    const text = box.querySelector('.cap-t'); if (text) text.innerHTML = U.rich(tip);
    const curve = box.querySelector('canvas.potential-curve'); if (curve) drawPotentialCurve(curve, R, f.a, f.b, value);
  }
  X.renderCap = function () {
    const box = U.$('#caption'), f = S.f;
    if (!f || !S.pb) { box.hidden = true; return; }
    box.hidden = false;
    const R = S.sol.R, u = R.units, o = S.sol.ans[S.qi], close = K.btn('退出探究', () => { X.stopPath(); S.qi = -1; X.focus(null); X.renderProblem(); W.r.cam.reset(W.AD * 1.2, false, true); }, 'mini');
    if (f.kind === 'plan') {
      const st = o.plan[S.step], ans = S.ans[S.step], n = o.plan.length, kids = [h('div.cap-h', null, h('span.cap-n', null, '三维合成 ' + (S.step + 1) + ' / ' + n), h('b', { html: U.rich(st.title) }))];
      if (st.ask && ans == null) kids.push(h('p.cap-q', { html: '先预测：' + U.rich(st.ask.q) }), h('div.cap-opts', null, st.ask.options.map((v, j) => { const b = K.btn('', () => { S.ans[S.step] = v; X.focusStep(); }); b.innerHTML = '<b class="opt-l">' + X.letter(j) + '.</b> ' + U.rich(v); return b; }), K.btn('跳过预测', () => { S.ans[S.step] = ''; X.focusStep(); }, 'mini skip')));
      else {
        const aL = st.ask ? X.optLetter(st.ask.options, st.ask.a) + '. ' + U.rich(st.ask.a) : '';
        if (st.ask) kids.push(h('p', { class: 'cap-fb ' + (ans === '' ? 'skip' : ans === st.ask.a ? 'ok' : 'bad'), html: (ans === '' ? '答案：' + aL + '。' : ans === st.ask.a ? '✓ 正确。' : '✗ 答案：' + aL + '。') + U.rich(st.ask.why) }));
        kids.push(h('p.cap-t', { html: U.rich(st.text) }), h('div', { html: VA.stepHTML(st) }));
      }
      kids.push(h('div.cap-nav', null, K.btn('‹', () => { if (S.step > 0) { S.step--; X.focusStep(); } }, 'mini'), h('span.cap-dots', null, o.plan.map((_, j) => h('i', { class: j === S.step ? 'on' : j < S.step ? 'done' : '' }))), close,
        K.btn(S.step === n - 1 ? '完成' : '下一步 ›', () => { if (S.step < n - 1) { S.step++; X.focusStep(); } else close.click(); }, 'mini primary')));
      box.replaceChildren(...kids);
    } else if (f.kind === 'path') {
      const a = R.pts[f.a].p, b = R.pts[f.b].p, p = V.lerp(a, b, f.s), s = R.field(p);
      const T = s.ok ? s.E : [0, 0, 0], t = V.norm(V.sub(b, a)), Ep = V.dot(T, t), th = V.len(T) > 1e-12 ? VA.ang(T, t) : 90;
      const sl = K.slider({ label: '点 X 的位置 ' + f.a + 'X : ' + f.a + f.b, min: 0.02, max: 0.98, step: 0.001, val: f.s, on: v => updatePath(v) });
      const curve = h('canvas.potential-curve', { 'aria-label': '电势沿路径变化曲线' });
      requestAnimationFrame(() => drawPotentialCurve(curve, R, f.a, f.b, f.s));
      const tip = !s.ok ? 'X 点处的场强未定义。' : V.len(T) <= 1e-12 ? 'X 点的合场强为零，此处电势沿路径的变化率为零。'
        : '合场强与路径方向的夹角约为 ' + VA.f4(th) + '°，合场强沿路径方向的分量 E_∥ 约为 ' + VA.f4(Ep) + (u.E ? ' ' + u.E : '') + '。' +
          (Ep > 1e-9 ? '夹角小于 90°，所以在 X 点附近沿路径电势降低。' : Ep < -1e-9 ? '夹角大于 90°，所以在 X 点附近沿路径电势升高。' : '合场强与路径垂直，所以在 X 点附近电势沿路径的变化率为零。');
      box.replaceChildren(h('div.cap-h', null, h('span.cap-n', null, '从 ' + f.a + ' 到 ' + f.b + ' 的路径'), h('b', null, '拖动点 X，观察合场强与路径方向的夹角')), sl,
        h('div.cap-curve-wrap', null, curve), h('div.cap-nav', null, h('span'), K.btn(S.pathPlaying ? '暂停动画' : '播放路径', () => { S.pathPlaying = !S.pathPlaying; if (S.pathPlaying) S.pathRaf = requestAnimationFrame(animatePath); else { cancelAnimationFrame(S.pathRaf); S.pathRaf = 0; } X.renderCap(); }, 'mini')),
        h('p.cap-t', { html: U.rich(tip) }), h('div.cap-nav', null, h('span'), close));
    } else if (f.kind === 'probe') {
      const rows = [['观察点', '坐标 / L', '所在区域', 'φ', '|E|']];
      f.pts.forEach((p, i) => { const s = R.field(p); rows.push([f.names ? f.names[i] : '点 ' + (i + 1), fmtP(p), s.region || '—', isFinite(s.V) ? X.niceNum(s.V).text : '未定义', s.E.every(isFinite) ? X.niceNum(V.len(s.E)).text : '未定义']); });
      box.replaceChildren(h('div.cap-h', null, h('span.cap-n', null, EL.SUB08[S.pb.sub].name), h('b', null, '观察点的读数（由实验室的解析场计算）')), h('div', { html: VA.stepHTML({ rows }) }),
        h('p.cap-t', null, '白色箭头表示观察点合场强的方向。打开“电场线”，比较各区域电场线的疏密与方向。'), h('div.cap-nav', null, h('span'), close));
    } else if (f.kind === 'pairs') {
      const src = R.sources, n = src.length, e = X.diskEnergy(S.pb.disk);
      box.replaceChildren(h('div.cap-h', null, h('span.cap-n', null, '总相互作用能'), h('b', null, '每一对电荷只计算一次')),
        h('p.cap-t', { html: U.rich('图中虚线连接每一对电荷，共 ' + n + ' × ' + (n - 1) + ' / 2 = ' + n * (n - 1) / 2 + ' 对。总相互作用能 U 约为 ' + VA.f4(e.U) + ' ' + u.U + '。') }), h('div.cap-nav', null, h('span'), close));
    } else {
      const rows = [['点', ...R.sources.map(s => 'kq_' + s.label + '/r'), 'φ']];
      for (const n of f.at) { const p = R.pts[n].p, ts = R.sources.map(s => s.q / V.dist(p, s.p)); rows.push([n, ...ts.map(VA.f4), VA.txtV(ts.reduce((x, y) => x + y, 0))]); }
      box.replaceChildren(h('div.cap-h', null, h('span.cap-n', null, '电势是标量'), h('b', null, '把各场源电荷产生的电势连同正负号相加')), h('div', { html: VA.stepHTML({ rows }) }), h('div.cap-nav', null, h('span'), close));
    }
  };
})(window.EL);
