'use strict';
// 例题模块：根据题目定义自动计算答案、生成题干、干扰项、解析步骤与诊断
// 题目数据见 models.js。离散模板取 a=1、Q=1、k=1：场强单位 kQ/a²，电势 kQ/a，功 kQq/a；
// 自主探究与圆盘电荷的长度单位为 L；解析场模型（field）的答案由 answers.js 计算
(function (EL) {
  const V = EL.V, U = EL.U, VA = EL.VA, X = EL.EX;
  const f4 = VA.f4, ang = VA.ang;
  X.QTYPES = {
    E: { name: '电场强度的大小与方向', need: ['at'] }, Ezero: { name: '电场强度是否为零', need: ['at'] }, V: { name: '某点的电势', need: ['at'] },
    Vcmp: { name: '比较两点的电势', need: ['a', 'b'] }, trend: { name: '沿直线的电势变化', need: ['a', 'b'] }, W: { name: '静电力做的功', need: ['a', 'b', 'q0'] },
    angle: { name: '电场强度与直线的夹角', need: ['at', 'a', 'b'] }
  };
  // 只适用于部分模型的问题类型（X.qtypesFor 决定显示哪些）
  X.QTYPES2 = {
    U: { name: '总相互作用能', need: [] }, pairs: { name: '不重复的电荷对数', need: [] }, Ucmp: { name: '比较两种构型的总相互作用能', need: [] },
    bc: { name: '边界条件（场强之比）', need: [] }
  };
  X.qtype = t => X.QTYPES[t] || X.QTYPES2[t];

  // 解析题目：几何、源、全部命名点、单位、场函数
  X.resolve = function (pb) {
    const kind = X.kindOf(pb), g = kind === 'tpl' ? X.geo(pb.tpl) : X.build(pb), pts = {};
    if (kind === 'tpl') g.kind = 'tpl';
    for (const n of g.labels) pts[n] = { n, p: g.v[n], text: kind === 'tpl' ? '顶点 ' + n : '点电荷 ' + n + ' 所在处', vertex: true };
    for (const n in pb.pts || {}) pts[n] = { n, p: X.pointPos(g, pb.pts[n].def, pb.pts), text: X.pointText(g, pb.pts[n].def), def: pb.pts[n].def };
    let sources = [];
    if (kind === 'tpl') sources = Object.keys(pb.charges || {}).filter(n => pb.charges[n] && pts[n]).map(n => ({ p: pts[n].p, q: pb.charges[n], label: n }));
    else if (kind === 'free') sources = (pb.srcs || []).filter(s => s.q).map(s => ({ p: g.v[s.label], q: s.q, label: s.label }));
    else if (kind === 'disk') sources = g.src.filter(s => s.q).map(s => ({ p: s.p, q: s.q, label: s.label }));
    const named = Object.values(pts).filter(x => x.p).map(x => ({ n: x.n, p: x.p }));
    const R = { g, pts, sources, named, kind, units: X.UNITS[kind === 'tpl' ? 'a' : kind === 'field' ? 'none' : 'L'] };
    if (kind === 'field') {
      const sub = EL.SUB08[pb.sub];
      R.field = p => { const r = sub.fn(pb.sp, p); return { V: r.V, E: r.E, ok: isFinite(r.V) && r.E.every(isFinite), region: r.region }; };
      R.analytic = true;
    } else {
      const F = EL.Phys.pointField(sources, 1e-9);
      R.field = p => { const s = F.sample(p); return { V: s.V, E: s.E, ok: s.ok }; };
    }
    const ext = named.concat(sources).map(x => V.len(x.p)).concat(g.draw ? g.draw.segs.flat().concat(g.draw.polys.flat()).map(V.len) : []);
    if (kind === 'field') ext.push(pb.sp.a || 0, 1.5); if (kind === 'disk') ext.push(pb.disk.R);
    R.ext = Math.max(1, ...ext.filter(isFinite));
    return R;
  };
  const Vat = (src, p) => src.reduce((s, x) => s + x.q / V.dist(p, x.p), 0);
  const num = (x, u) => { const n = VA.nice(x); return (n ? n.text : f4(x).replace(/^-/, '−')) + (u ? ' ' + u : ''); };
  X.num = num;
  const numTex = x => VA.texV(x);
  const near = (p, src) => src.some(s => V.dist(p, s.p) < 1e-9);

  // 单个问题：答案、选项（含干扰项）、解析、诊断
  X.answer = function (pb, R, q) {
    if (!X.qtypesFor(pb).includes(q.t)) return { q, ok: false, err: '本模型不能出“' + (X.qtype(q.t) ? X.qtype(q.t).name : q.t) + '”这类问题。' };
    if (R.analytic) return X.anaAnswer(pb, R, q);
    if (R.kind === 'disk' && X.QTYPES2[q.t]) return X.diskAnswer(pb, R, q);
    const P = n => R.pts[n] && R.pts[n].p, src = R.sources, o = { q, ok: true, diag: [] }, u = R.units, unitE = u.E, unitV = u.V, unitW = u.W;
    // 干扰项按数值去重（“0”与“0 kQ/a²”算同一个）
    const kk = v => String(v).replace(/ .*$/, '').replace(/^−0$/, '0');
    const opts = (right, wrongs) => { const seen = new Set([kk(right)]); const w = wrongs.filter(x => x && !seen.has(kk(x.v)) && seen.add(kk(x.v))).slice(0, 3); o.distractors = w; if (w.length) o.options = [right].concat(w.map(x => x.v)).sort(); };
    if (q.t === 'E' || q.t === 'Ezero' || q.t === 'angle') {
      const p = P(q.at);
      if (!p) return { q, ok: false, err: '还没有选择观察点。' };
      if (near(p, src)) return { q, ok: false, err: q.at + ' 点与场源电荷重合，该点的电场强度未定义。' };
      const parts = VA.parts(src, p), T = VA.sum(parts), m = V.len(T);
      o.parts = parts; o.T = T; o.plan = VA.plan({ parts, P: p, named: R.named, pName: q.at, unit: unitE, rUnit: u.L });
      o.value = m; o.dir = VA.describe(T, R.named);
      if (q.t === 'E') {
        o.answer = m < 1e-9 ? '0' : num(m, unitE) + (o.dir ? '，方向' + o.dir : '');
        o.mag = m < 1e-9 ? '0' : num(m, unitE);
        if (m < 1e-9) o.diag.push({ k: 'info', t: '该点的电场强度为零，更适合改问“电场强度是否为零”，或者改为比较电势。' });
        const sc = parts.reduce((s, x) => s + x.mag, 0), g = o.plan.d.groups, part = g.length > 1 ? V.len(g[0].S) : NaN;
        opts(o.mag, [{ v: num(sc, unitE), why: '把各分场强的大小直接相加，没有按矢量合成。' }, { v: g.length > 1 ? num(part, unitE) : null, why: '只合成了一组分场强，漏掉了其余的分场强。' },
          { v: g.length > 1 ? num(V.len(V.sub(g[0].S, g[1].S)), unitE) : num(m * Math.SQRT2, unitE), why: g.length > 1 ? '把两个部分和的夹角 φ 错当成了 180° − φ。' : '分场强之间的夹角取错了。' }].filter(x => x.v));
      } else if (q.t === 'Ezero') { o.answer = m < 1e-9 ? '是' : '否'; o.options = ['是', '否']; }
      else {
        const pa = P(q.a), pb2 = P(q.b);
        if (!pa || !pb2) return { q, ok: false, err: '请选择确定直线的两个点。' };
        const d = V.sub(pb2, pa);
        if (m < 1e-9) return { q, ok: false, err: q.at + ' 点的电场强度为零，没有方向，夹角没有意义。' };
        if (V.len(d) < 1e-9) return { q, ok: false, err: q.a + '、' + q.b + ' 两点重合，不能确定直线，夹角没有意义。' };
        const th = ang(T, d); o.value = th; o.answer = (Math.round(th * 10) / 10) + '°'; o.options = VA.angOpts(th);
      }
    } else if (q.t === 'V') {
      const p = P(q.at);
      if (!p) return { q, ok: false, err: '还没有选择观察点。' };
      if (near(p, src)) return { q, ok: false, err: q.at + ' 点与场源电荷重合，该点的电势未定义。' };
      const v = Vat(src, p), nv = num(v, unitV);
      o.value = v; o.answer = nv;
      o.terms = src.map(s => ({ label: s.label, q: s.q, r: V.dist(p, s.p), v: s.q / V.dist(p, s.p) }));
      if (Math.abs(v) < 1e-9) o.diag.push({ k: 'good', t: '该点电势为零，适合讨论“电势为零时，电场强度是否一定为零”。' });
      opts(nv, [{ v: num(src.reduce((s, x) => s + Math.abs(x.q) / V.dist(p, x.p), 0), unitV), why: '忽略了各场源电荷电荷量的正负号。' }, { v: num(src.reduce((s, x) => s + x.q / Math.pow(V.dist(p, x.p), 2), 0), unitV), why: '把电场强度公式中的 1/r² 误用于计算电势。' }, { v: num(-v, unitV), why: '电势的正负号弄反了。' }]);
    } else if (q.t === 'Vcmp' || q.t === 'W' || q.t === 'trend') {
      const a = P(q.a), b = P(q.b);
      if (!a || !b) return { q, ok: false, err: '请选择两个点。' };
      const ea = near(a, src), eb = near(b, src);
      if (q.t !== 'trend' && (ea || eb)) return { q, ok: false, err: (ea ? q.a : q.b) + ' 点与场源电荷重合，该点的电势未定义。' };
      if (q.t === 'trend' && ea && eb) return { q, ok: false, err: '两个端点都与场源电荷重合，不能讨论电势的变化。' };
      const va = ea ? NaN : Vat(src, a), vb = eb ? NaN : Vat(src, b);
      o.va = va; o.vb = vb; o.endSrc = ea ? q.a : eb ? q.b : null;
      if (o.endSrc) { const ep = ea ? a : b, s0 = src.find(s => V.dist(ep, s.p) < 1e-9); o.endQ = s0 ? s0.q : 0; }
      if (q.t === 'Vcmp') X.cmpAnswer(o, q, va, vb);
      if (q.t === 'W') {
        const q0 = q.q0 || 1, w = q0 * (va - vb); o.value = w; o.answer = num(w, unitW);
        opts(o.answer, [{ v: num(-w, unitW), why: '把电势差的顺序弄反了，误用 W = q(φ_末 − φ_初)。' }, { v: num(Math.abs(w), unitW), why: '忽略了试探电荷电荷量的正负号。' }, { v: Math.abs(w) > 1e-9 ? '0' : null, why: '误以为两点位置对称，电势就一定相等。' }].filter(x => x.v));
        if (Math.abs(w) < 1e-9) o.diag.push({ k: 'good', t: '起点与终点电势相等，静电力做的功为零，适合考查“静电力做的功与路径无关”。' });
      }
      if (q.t === 'trend') {
        // 端点在源上时，取到离源 2% 路径长度处为止（该端电势趋于 ±∞）
        const N = 200, vs = [], t0 = ea ? 0.02 : 0, t1 = eb ? 0.98 : 1, tol = 0.015 * (R.kind === 'tpl' ? 1 : V.dist(a, b));
        for (let i = 0; i <= N; i++) { const t = t0 + (t1 - t0) * i / N, p = V.lerp(a, b, t); if (src.some(s => V.dist(p, s.p) < tol)) return { q, ok: false, err: '路径中途经过场源电荷，该处电势未定义，不能讨论电势的变化。' }; vs.push(Vat(src, p)); }
        X.trendAnswer(o, vs);
        o.plan = (() => { const mid = V.lerp(a, b, 0.4), parts = VA.parts(src, mid); return parts ? VA.plan({ parts, P: mid, named: R.named, pName: 'X', unit: unitE, rUnit: u.L }) : null; })();
      }
    }
    return o;
  };
  X.cmpAnswer = function (o, q, va, vb) {
    o.answer = Math.abs(va - vb) < 1e-9 ? 'φ_' + q.a + ' = φ_' + q.b : va > vb ? 'φ_' + q.a + ' > φ_' + q.b : 'φ_' + q.a + ' < φ_' + q.b;
    o.options = ['φ_' + q.a + ' > φ_' + q.b, 'φ_' + q.a + ' = φ_' + q.b, 'φ_' + q.a + ' < φ_' + q.b];
  };
  X.trendAnswer = function (o, vs) {
    const dv = vs.slice(1).map((v, i) => v - vs[i]), eps = 1e-10, up = dv.every(x => x > -eps), dn = dv.every(x => x < eps);
    const flat = dv.every(x => Math.abs(x) < eps), turns = dv.reduce((n, x, i) => i && Math.sign(x) !== Math.sign(dv[i - 1]) && Math.abs(x) > eps ? n + 1 : n, 0);
    o.answer = flat ? '保持不变' : up ? '一直升高' : dn ? '一直降低' : turns === 1 ? (dv[0] > 0 ? '先升高后降低' : '先降低后升高') : '多次起伏';
    o.options = ['一直升高', '一直降低', '先升高后降低', '先降低后升高'];
    // 选项固定为 A～D 四个：答案不在常规四项中时，替换掉“先降低后升高”
    if (!o.options.includes(o.answer)) o.options[3] = o.answer;
    o.samples = vs;
  };
  // 选择题的正确选项：场强题为大小，其余为答案本身
  X.rightOf = o => o.right != null ? o.right : o.q.t === 'E' ? o.mag : o.answer;
  X.solve = function (pb) { const R = X.resolve(pb); return { R, ans: (pb.qs || []).map(q => X.answer(pb, R, q)) }; };

  // ---- 文字：题干、问题、解析 ----
  X.stem = function (pb, R) {
    if (X.kindOf(pb) !== 'tpl') return X.stemOf(pb, R);
    // 电荷量相同的顶点合并叙述：“在 A、C 两点各放置一个电荷量为 −Q 的点电荷”
    const T = X.TEMPLATES[pb.tpl], by = new Map();
    Object.keys(pb.charges || {}).filter(n => pb.charges[n]).forEach(n => { const k = X.qText(pb.charges[n]); if (!by.has(k)) by.set(k, []); by.get(k).push(n); });
    const ch = [...by].map(([k, ns]) => ns.length > 1 ? '在 ' + ns.join('、') + ' 处各放置一个电荷量为 ' + k + ' 的点电荷' : '在 ' + ns[0] + ' 处放置一个电荷量为 ' + k + ' 的点电荷');
    const ptsT = Object.keys(pb.pts || {}).map(n => {
      const def = pb.pts[n].def, t = R.pts[n].text;
      if (def.t === 'xyz') return n + ' 点位于' + t + '（以模型中心为原点）';
      if (def.t === 'div') return n + ' 为' + t.replace(/X/, n).replace(/ 的点$/, '').replace(/^线段 (\S+) 上满足/, '线段 $1 上的一点，满足');
      if (def.t === 'center') return n + ' 为' + T.name + '的中心';
      return n + ' 为' + t;
    });
    return T.desc + (ch.length ? '，' + ch.join('；') + '。' : '，各顶点都不带电。') + (ptsT.length ? ptsT.join('，') + '。' : '') + '取无穷远处电势为零。';
  };
  X.qText2 = function (q, pb) {
    switch (q.t) {
      case 'E': return '求 ' + q.at + ' 点电场强度的大小和方向。';
      case 'Ezero': return q.at + ' 点的电场强度是否为零？';
      case 'V': return '求 ' + q.at + ' 点的电势。';
      case 'Vcmp': return '比较 ' + q.a + '、' + q.b + ' 两点电势的高低。';
      case 'trend': return '从 ' + q.a + ' 点沿直线到 ' + q.b + ' 点，电势怎样变化？';
      case 'W': return '把电荷量为 ' + X.qText(q.q0 || 1, 'q') + ' 的试探电荷从 ' + q.a + ' 点移到 ' + q.b + ' 点，静电力做的功是多少？';
      case 'angle': return '求 ' + q.at + ' 点电场强度的方向与由 ' + q.a + ' 指向 ' + q.b + ' 的方向之间的夹角。';
      case 'U': return '求这组点电荷的总相互作用能 U。';
      case 'pairs': return '计算总相互作用能时，要计入多少对不重复的电荷对？';
      case 'Ucmp': return '保持电荷总个数 N、圆盘半径 R 和每个电荷的电荷量不变，比较两种构型：N 个电荷等分圆周；把其中一个移到圆心，其余 N − 1 个等分圆周。哪种构型的总相互作用能较小？';
      case 'bc': return pb && pb.sub === 'dielectric-sphere' ? '求球内电场强度与外加电场强度之比 E_in/E₀。' : '求分界面两侧电场强度法向分量之比 E_1n/E_2n。';
    }
    return '';
  };
  // 解析：短句 + 公式（每行一条）
  X.explain = function (o) {
    const q = o.q, L = [];
    if (!o.ok) return [{ t: o.err }];
    if (o.expl) return o.expl;
    if (q.t === 'E' || q.t === 'Ezero' || q.t === 'angle') {
      for (const s of o.plan) if (s.id !== 'list' && s.id !== 'group') L.push({ t: s.title + '：' + s.text, tex: s.tex });
      if (q.t === 'angle') L.push({ t: '由合场强与 ' + q.a + '、' + q.b + ' 两点位置差矢量的数量积求得，所求夹角为 ' + o.answer + '。' });
    } else if (q.t === 'V') {
      L.push({ t: '电势是标量。' + q.at + ' 点的电势等于各场源电荷单独在该点产生的电势的代数和，正电荷的贡献为正，负电荷的贡献为负。', tex:String.raw`\varphi_{${q.at}}=\sum_i\frac{kq_i}{r_i}=` + o.terms.map(x => (x.q < 0 ? '-' : '+') + numTex(Math.abs(x.v))).join('').replace(/^\+/, '') + '=' + numTex(o.value) });
    } else if (q.t === 'Vcmp') {
      L.push({ t: '分别计算 ' + q.a + '、' + q.b + ' 两点的电势。', tex: String.raw`\varphi_{${q.a}}=${numTex(o.va)},\quad\varphi_{${q.b}}=${numTex(o.vb)}` }, { t: '所以 ' + o.answer + '。' });
    } else if (q.t === 'W') {
      L.push({ t: '静电力做的功等于试探电荷的电荷量与起点、终点间电势差的乘积，即 W = q(φ_' + q.a + ' − φ_' + q.b + ')。', tex:String.raw`W=q(\varphi_{${q.a}}-\varphi_{${q.b}})=${numTex(q.q0 || 1)}\times(${numTex(o.va)}-(${numTex(o.vb)}))=${numTex(o.value)}` });
    } else if (q.t === 'trend') {
      L.push({ t: '设合场强沿路径方向的分量为 E_∥。E_∥ 大于零时，沿路径电势降低；E_∥ 小于零时，沿路径电势升高。点击“引导探究”，拖动路径上的点 X，观察合场强与路径方向的夹角。' },
        { t: '所以从 ' + q.a + ' 点到 ' + q.b + ' 点，电势' + (o.answer === '多次起伏' ? '多次起伏变化' : o.answer) + '。' + (o.endSrc ? '端点 ' + o.endSrc + ' 处是' + (o.endQ > 0 ? '正' : '负') + '电荷，越靠近它，电势越趋于' + (o.endQ > 0 ? '正' : '负') + '无穷大。' : '') });
    }
    return L;
  };
  // 难度与教学提示
  X.diagnose = function (pb, sol) {
    const out = [];
    sol.ans.forEach((o, i) => {
      if (!o.ok) { out.push({ k: 'bad', t: '第 ' + (i + 1) + ' 问：' + o.err }); return; }
      (o.diag || []).forEach(d => out.push({ k: d.k, t: '第 ' + (i + 1) + ' 问：' + d.t }));
      if (o.plan && o.plan.d && (o.q.t === 'E' || o.q.t === 'angle')) {
        const g = o.plan.d.groups, sym = g.filter(x => x.type !== 'rest' && !x.unequal).length;
        const nice = !!VA.nice(V.len(o.T));
        out.push({ k: sym ? 'good' : 'info', t: '第 ' + (i + 1) + ' 问：' + (sym ? (g.length > 1 ? '可以利用对称性把分场强分成 ' + g.length + ' 组，逐组合成' : '可以利用对称性直接合成等大的分场强') : '没有等大的分场强，适合用坐标法求解') + (nice ? '，结果是精确值。' : '，结果不是简单根式。') });
      }
    });
    if (!sol.ans.length) out.push({ k: 'info', t: '还没有添加问题。' });
    return out;
  };
  // 推荐：值得出题的点
  X.suggest = function (pb) {
    const R = X.resolve(pb), g = R.g, out = [];
    for (const c of X.candidates(g)) {
      const p = X.pointPos(g, c.def, pb.pts);
      if (!p || near(p, R.sources)) continue;
      let m, v, grp = 0;
      if (R.analytic) { const s = R.field(p); if (!s.ok) continue; m = V.len(s.E); v = s.V; }
      else {
        const parts = VA.parts(R.sources, p);
        if (!parts || !parts.length) continue;
        m = V.len(VA.sum(parts)); v = Vat(R.sources, p); grp = VA.group(parts, p).filter(x => x.type !== 'rest' && !x.unequal).length;
      }
      let score = 0, why = [];
      if (m < 1e-9) { score += 3; why.push('电场强度为零'); }
      if (Math.abs(v) < 1e-9 && m > 1e-9) { score += 3; why.push('电势为零而电场强度不为零'); }
      if (grp >= 2) { score += 2; why.push('分场强可按对称性分组'); }
      if (m > 1e-9 && (VA.nice(m) || R.analytic && X.niceNum(m).exact)) { score += 1; why.push('场强是精确值'); }
      if (score) out.push({ c, score, why: why.join('；') + '。', E: m, V: v });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 6);
  };
})(window.EL);
