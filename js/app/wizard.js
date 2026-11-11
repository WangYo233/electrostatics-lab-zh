'use strict';
// 场强合成向导（所有点电荷模型通用）与几何关系辅助。分析逻辑见 js/core/vec3d.js
(function (EL) {
  const V = EL.V, U = EL.U, A = EL.App, MH = EL.MH, K = EL.UI, h = U.h, VA = EL.VA;
  const ang = VA.ang, f4 = VA.f4;

  // 观察点周围可用于描述方向的命名点：源、模型关键点、观察点
  A.namedPts = function (c) {
    const T = A.theoryOf ? A.theoryOf() : null, out = c.sources.filter(s => s.q).map(s => ({ n: s.label, p: s.p }));
    if (T && T.pts) for (const q of T.pts(c.p)) if (q.p && !out.some(o => o.n === q.n)) out.push({ n: q.n, p: q.p });
    if (c.probe) out.push({ n: c.probe.name || 'P', p: c.probe.pos });
    return out;
  };
  A.wizData = function (c) {
    if (!c.probe || c.m.analytic) return null;
    // 由“自由合成”启动时只合成所选的分场强
    const only = c.st.wiz.on && c.st.wiz.only, src = only ? c.sources.filter((s, i) => only.includes(i)) : c.sources;
    const parts = VA.parts(src, c.probe.pos, c.rMin);
    return parts && parts.length >= 2 ? parts : null;
  };
  // 探针处场强矢量的显示比例（探针参数，默认 1）
  A.probeVecK = c => (c.st.style.probeVec || 1);
  A.wizSteps = function (c) {
    const parts = A.wizData(c);
    if (!parts) return null;
    return VA.plan({ parts, P: c.probe.pos, named: A.namedPts(c), pName: c.probe.name || 'P', unit: 'kQ/L²', rUnit: 'L', method: c.st.wiz.method, hide: c.st.wiz.hide, partial: !!(c.st.wiz.on && c.st.wiz.only) });
  };
  // 向导的构造对象：随已揭示的步骤逐步添加
  A.drawWizard = function (c, sc) {
    const cs = c.cs;
    if (!cs || !cs.steps.d) return;
    const out = VA.draw(cs.steps, cs.k, { labels: [] }, { MH, C: EL.C, step: cs.i, R: c.bound, vs: c.st.style.vecScale * A.probeVecK(c) });
    for (const key in out) sc[key] = (sc[key] || []).concat(out[key]);
  };
  A.startWizard = function (method, only) {
    const st = A.st;
    if (!A.c.probeVisible) { st.layers.probe = true; A.update(); }
    if (method) st.wiz.method = method;
    st.wiz.only = only && only.length ? only.slice() : null;
    st.wiz.on = true;
    if (!A.wizSteps(A.c)) { st.wiz.on = false; st.wiz.only = null; A.update(); return U.toast(only ? '请至少选择两个电荷量不为零的分场强，再开始合成。' : '只有至少两个源电荷的电荷量不为零，且探针不在排除邻域内时，才能开始合成。'); }
    Object.assign(st.wiz, { on: true, i: 0, ans: {} });
    A.afterStep();
  };
  A.stopWizard = function () {
    A.st.wiz.on = false; A.st.wiz.only = null;
    A.update(); A.r.cam.reset(A.c.bound, A.st.view === '2d', true);
    A.renderCaption(true); A.renderStepList(); A.renderDerive();
    if (document.body.dataset.mode === 'analyze') A.renderWizBox();
  };

  // ---- 几何关系辅助：观察点与源之间、源与源之间 ----
  A.addGeoAids = function (c, sc) {
    const g = c.st.geo, out = { labels: [] }, C = EL.C;
    if (!c.probeVisible || c.m.analytic) return;
    const P = c.probe.pos, src = c.sources.filter(s => s.q);
    if (g.probeLines) for (const s of src) { MH.dash(out, P, s.p, C.guide); out.labels.push({ p: V.lerp(P, s.p, 0.5), text: 'r=' + f4(V.dist(P, s.p)), cls: 'pt', kind: 'points' }); }
    if (g.srcLines && src.length <= 8) for (let i = 0; i < src.length; i++) for (let j = i + 1; j < src.length; j++) {
      out.lines = out.lines || [];
      out.lines.push({ pts: [src[i].p, src[j].p], color: [...C.geom, 0.7], width: 1, dash: [0.06, 0.06] });
      out.labels.push({ p: V.lerp(src[i].p, src[j].p, 0.5), text: f4(V.dist(src[i].p, src[j].p)), cls: 'pt', kind: 'points' });
    }
    if (g.angle.length === 2 && document.body.dataset.mode === 'analyze') {
      const a = src.find(s => s.label === g.angle[0]), b = src.find(s => s.label === g.angle[1]);
      if (a && b) { MH.dash(out, P, a.p, C.ang); MH.dash(out, P, b.p, C.ang); MH.arc(out, P, V.sub(a.p, P), V.sub(b.p, P), c.bound * 0.08); }
    }
    if (g.showDec && g.dec && c.probe.s.ok) {
      const N = A.namedPts(c), A0 = N.find(q => q.n === g.dec[0]), B0 = N.find(q => q.n === g.dec[1]);
      if (A0 && B0) {
        const u = V.norm(V.sub(B0.p, A0.p)), E = c.probe.s.E, k = c.bound * 0.3 / Math.max(1e-9, V.len(E)) * A.probeVecK(c), par = V.mul(u, V.dot(E, u) * k), tot = V.mul(E, k);
        MH.dash(out, A0.p, B0.p, C.guide);
        MH.vec(out, P, tot, C.sum, 'E', 'sum', 2.6); MH.vec(out, P, par, C.part, 'E_∥', 'part', 2.2); MH.vec(out, V.add(P, par), V.sub(tot, par), C.part, 'E_⊥', 'part', 2.2);
        MH.right(out, V.add(P, par), V.mul(par, -1), V.sub(tot, par), c.bound * 0.03);
      }
    }
    for (const key in out) sc[key] = (sc[key] || []).concat(out[key]);
  };

  A.pGeo = function (c) {
    const st = c.st, g = st.geo;
    if (!c.probeVisible) return [K.btn('打开探针', () => { st.layers.probe = true; A.update(); A.renderPanel(); A.renderGeo(); }, 'primary')];
    const P = c.probe.pos, n = c.probe.name || 'P', src = c.sources.filter(s => s.q), out = [];
    out.push(h('table.src', null, h('thead', null, h('tr', null, ...['源电荷', 'q', '距离 r', '|E_i|=k|q|/r²', '分场强方向'].map(t => h('th', { html: U.rich(t) })))),
      h('tbody', null, src.map(s => { const r = V.dist(P, s.p); return h('tr', null, h('td', null, s.label), h('td', null, VA.cell(s.q)), h('td', null, VA.cell(r)), h('td', null, VA.cell(Math.abs(s.q) / (r * r))), h('td', null, s.q > 0 ? '背离 ' + s.label : '指向 ' + s.label)); }))));
    out.push(K.check('显示观察点到各源电荷的连线', g.probeLines, v => { g.probeLines = v; A.update(); }),
      K.check('显示源电荷之间的连线', g.srcLines, v => { g.srcLines = v; A.update(); }, '源电荷不超过 8 个时才显示连线。'));
    // 夹角：∠QiPQj 与两分场夹角的关系
    const labels = src.map(s => s.label);
    if (src.length >= 2) {
      if (g.angle.length !== 2 || !g.angle.every(x => labels.includes(x))) g.angle = labels.slice(0, 2);
      const a = src.find(s => s.label === g.angle[0]), b = src.find(s => s.label === g.angle[1]);
      const geoAng = ang(V.sub(a.p, P), V.sub(b.p, P)), fieldAng = Math.sign(a.q) === Math.sign(b.q) ? geoAng : 180 - geoAng;
      out.push(K.group('夹角',
        h('div.row.wrap', null, K.select('', labels.map(x => [x, x]), g.angle[0], v => { g.angle[0] = v; A.update(); A.renderGeo(); }), h('span', null, '与'),
          K.select('', labels.map(x => [x, x]), g.angle[1], v => { g.angle[1] = v; A.update(); A.renderGeo(); })),
        h('p', { html: U.rich('∠' + a.label + n + b.label + ' = ' + U.fmt(geoAng, 4) + '°；E_' + a.label + ' 与 E_' + b.label + ' 的夹角为 ' + U.fmt(fieldAng, 4) + '°。') }),
        K.tip('两源同号时，分场强夹角等于连线夹角；异号时等于其补角。')));
    }
    // 对称关系
    const hints = [];
    for (let i = 0; i < src.length; i++) for (let j = i + 1; j < src.length; j++) {
      const a = src[i], b = src[j], ra = V.dist(P, a.p), rb = V.dist(P, b.p);
      if (Math.abs(ra - rb) < 1e-6 * Math.max(1, ra) && Math.abs(Math.abs(a.q) - Math.abs(b.q)) < 1e-9) hints.push(`E_${a.label} 与 E_${b.label} 大小相等（r = ${f4(ra)}）。`);
      const cr = V.len(V.cross(V.sub(a.p, P), V.sub(b.p, P)));
      if (cr < 1e-6 * ra * rb) hints.push(`${n} 在直线 ${a.label}${b.label} 上，两个分场强共线。`);
    }
    out.push(K.group('对称关系', ...(hints.length ? hints.map(t => h('p', { html: '· ' + U.rich(t) })) : [K.note('没有发现大小相等或共线的分场强。')])));
    // 分解：总场沿某条直线的平行分量与垂直分量
    const N = A.namedPts(c).filter(q => q.n !== n), E = c.probe.s.E;
    if (N.length >= 2 && E.every(isFinite)) {
      if (!g.dec || !N.some(q => q.n === g.dec[0]) || !N.some(q => q.n === g.dec[1])) g.dec = [N[0].n, N[1].n];
      const A0 = N.find(q => q.n === g.dec[0]).p, B0 = N.find(q => q.n === g.dec[1]).p, u = V.norm(V.sub(B0, A0));
      const par = V.dot(E, u), perp = V.len(V.sub(E, V.mul(u, par)));
      out.push(K.group('沿直线分解合场强',
        h('div.row.wrap', null, h('span', null, '从'), K.select('', N.map(q => [q.n, q.n]), g.dec[0], v => { g.dec[0] = v; A.update(); A.renderGeo(); }), h('span', null, '指向'),
          K.select('', N.map(q => [q.n, q.n]), g.dec[1], v => { g.dec[1] = v; A.update(); A.renderGeo(); })),
        K.check('在画板中显示分解', g.showDec, v => { g.showDec = v; A.update(); }),
        h('p', { html: U.rich('E_∥ = ' + VA.cell(par) + ' kQ/L²，E_⊥ = ' + VA.cell(perp) + ' kQ/L²') }),
        K.tip('E_∥ 大于零时，沿所选方向电势降低。')));
    }
    if (src.length <= 6) {
      const rows = [];
      for (let i = 0; i < src.length; i++) for (let j = i + 1; j < src.length; j++) rows.push(h('tr', null, h('td', null, src[i].label + src[j].label), h('td', null, U.fmt(V.dist(src[i].p, src[j].p), 4))));
      if (rows.length) out.push(K.group('源电荷之间的距离', h('table.src', null, h('tbody', null, rows))));
    }
    return out;
  };
  // 分析工作区中向导的说明与选项
  A.renderWizBox = function () {
    const c = A.c, box = U.$('#wizBox');
    box.hidden = !!c.m.analytic || !A.hasProbe(c.m);
    U.$('#geoBox').hidden = box.hidden;
    if (box.hidden) return;
    const ok = !!A.wizData(c) && c.probeVisible, on = !!c.cs, w = c.st.wiz;
    const intro = [
      h('p.note', null, on ? '按画板下方的步骤进行；点击步骤可以直接跳转。' : !c.probeVisible ? '向导以探针所在点为观察点。' : ok ? '观察点为 ' + (c.probe.name || 'P') + '。每一步先写出预测，再显示构造。' : '至少需要两个电荷量不为零的源电荷。'),
      on ? null : K.seg([['geo', '几何法'], ['coord', '坐标法']], w.method || 'geo', v => { w.method = v; A.renderWizBox(); }),
      on ? null : h('p.note', null, (w.method || 'geo') === 'geo' ? '几何法先按对称性分组，用相似三角形或余弦定理求夹角，再成对合成，最后合成各组的部分和。' : '坐标法先求观察点与各源电荷的位置差，再列出各分场强的分量，最后求和。')];
    // replaceChildren 会把 null 转成文字“null”，先去掉空项
    U.$('#wizIntro').replaceChildren(...intro.filter(Boolean));
    U.$('#wizStart').disabled = !ok && c.probeVisible;
    U.$('#wizStart').textContent = c.probeVisible ? '开始合成' : '打开探针并开始';
    U.$('#wizOpts').replaceChildren(K.check('合成时隐藏电场线与等势线', w.hide, v => { w.hide = v; A.update(); A.renderCaption(true); }));
  };
  A.renderGeo = function () { if (document.body.dataset.mode === 'analyze' && U.$('#geoBox').open) U.$('#geo').replaceChildren(...A.pGeo(A.c).filter(Boolean)); };
})(window.EL);
