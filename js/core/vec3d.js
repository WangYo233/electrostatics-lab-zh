'use strict';
// 三维矢量分析核心（实验室与例题模块共用）
// 几何法：列出分场 → 对称分组 → 余弦定理求夹角 → 成对或共面合成 → 部分和再合成 → 坐标法核对
// 坐标法：列出分场 → 位置差矢量 → 分量表 → 求和核对
(function (EL) {
  const V = EL.V, U = EL.U, R = String.raw;
  const VA = EL.VA = {};
  const SUBS = '₀₁₂₃₄₅₆₇₈₉', sub = i => String(i).split('').map(d => SUBS[+d]).join('');
  const deg = x => x * 180 / Math.PI, f4 = x => U.fmt(x, 4), r1 = x => Math.round(x * 10) / 10;
  const tol = (a, b) => Math.abs(a - b) <= 1e-7 * Math.max(Math.abs(a), Math.abs(b), 1e-12);
  VA.f4 = f4;
  VA.ang = (a, b) => deg(Math.acos(U.clamp(V.dot(a, b) / (V.len(a) * V.len(b)), -1, 1)));
  // 夹角选项：正确值 + 两个相差明显的干扰项
  VA.angOpts = function (th, extra) {
    const out = [r1(th)];
    for (const x of (extra || []).concat([180 - th, 90, 60, 120, 45, 135, 30, 150])) { const y = r1(x); if (out.length < 3 && y >= 0 && y <= 180 && out.every(z => Math.abs(z - y) > 4)) out.push(y); }
    return out.sort((a, b) => a - b).map(x => x + '°');
  };

  // ---- 精确值识别：x = (m/d)√n（由数值识别，供参考）----
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; };
  function rat(y, maxQ) {
    let h0 = 0, h1 = 1, k0 = 1, k1 = 0, x = y;
    for (let i = 0; i < 40; i++) {
      const a = Math.floor(x), h2 = a * h1 + h0, k2 = a * k1 + k0;
      if (k2 > maxQ) break;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (Math.abs(h1 / k1 - y) < 1e-12 * Math.max(1, y)) break;
      const fr = x - a; if (fr < 1e-12) break; x = 1 / fr;
    }
    return k1 ? { p: h1, q: k1 } : null;
  }
  // maxQ、rel 可选：表格中用更大的分母上限，同时改用更严格的相对误差，避免把一般小数误认成根式
  VA.nice = function (x, maxQ, rel) {
    if (!isFinite(x)) return null;
    if (Math.abs(x) < 1e-9) return { text: '0', tex: '0' };
    const y = x * x, r = rat(y, maxQ || 3000);
    // 很小但非零的值（例如零场点附近的数值残差）不写成根式，避免出现“√0”
    if (!r || !r.p || Math.abs(r.p / r.q - y) > (rel ? rel * y : 1e-9 * Math.max(1, y))) return null;
    let inn = r.p * r.q, out = 1;
    if (inn > 1e12) return null;
    for (let f = 2; f * f <= inn; f++) while (inn % (f * f) === 0) { inn /= f * f; out *= f; }
    const g = gcd(out, r.q), num = out / g, den = r.q / g;
    if (inn > 5000 || den > 500 || num > 2000) return null;
    const s = x < 0 ? '−' : '', st = x < 0 ? '-' : '';
    const nT = num === 1 && inn !== 1 ? '' : String(num), rad = inn === 1 ? '' : '√' + inn, radT = inn === 1 ? '' : R`\sqrt{${inn}}`;
    return { text: s + nT + rad + (den !== 1 ? '/' + den : ''), tex: st + (den !== 1 ? R`\frac{${nT + radT || '1'}}{${den}}` : nT + radT) };
  };
  // 先按常规上限识别；识别不出时再用更大的分母上限与更严格的误差（例如 32/125、√6/144）
  const niceX = x => VA.nice(x) || VA.nice(x, 40000, 1e-13);
  VA.texV = x => { const n = niceX(x); return n ? n.tex : f4(x); };
  VA.txtV = x => { const n = niceX(x); return n ? n.text : '≈' + f4(x); };
  // 正文用：“为 2√3”或“约为 3.4641”
  const isV = x => { const n = niceX(x); return n ? '为 ' + n.text : '约为 ' + f4(x); };
  // 表格与读数用：只有简单的根式（被开方数不超过 200、系数与分母不超过 999）才写成根式，否则写四位有效数字
  VA.cell = function (x) {
    if (typeof x !== 'number' || !isFinite(x)) return U.fmt(x);
    const n = niceX(x), m =n && n.text.replace(/^−/, '').match(/^(\d*)(?:√(\d+))?(?:\/(\d+))?$/);
    if (m && +(m[1] || 1) <= 999 && +(m[2] || 1) <= 200 && +(m[3] || 1) <= 999) return n.text;
    return f4(x).replace(/^-/, '−');
  };
  // 方向相同且重合的矢量：沿垂直方向错开一点，使每个矢量都看得见（返回与 vs 等长的偏移数组；.rank 为组内序号）
  VA.offsets = function (vs, gap) {
    const out = vs.map(() => [0, 0, 0]), seen = new Set();
    out.rank = vs.map(() => 0);
    for (let i = 0; i < vs.length; i++) {
      if (seen.has(i) || !(V.len(vs[i]) > 1e-12)) continue;
      const ui = V.norm(vs[i]), grp = [i];
      for (let j = i + 1; j < vs.length; j++) if (!seen.has(j) && V.len(vs[j]) > 1e-12 && V.dot(ui, V.norm(vs[j])) > 0.9995) grp.push(j);
      if (grp.length < 2) continue;
      grp.forEach(j => seen.add(j));
      let n = V.cross(ui, [0, 0, 1]);
      if (V.len(n) < 0.3) n = V.cross(ui, [1, 0, 0]);
      n = V.norm(n);
      grp.forEach((j, k) => { out[j] = V.mul(n, (k - (grp.length - 1) / 2) * gap); out.rank[j] = k; });
    }
    return out;
  };

  // ---- 分场 ----
  VA.parts = function (sources, P, rMin) {
    const out = [];
    for (const s of sources) {
      if (!s.q) continue;
      const d = V.sub(P, s.p), r = V.len(d);
      if (r <= (rMin || 1e-9)) return null;
      const u = V.mul(d, Math.sign(s.q) / r), mag = Math.abs(s.q) / (r * r);
      out.push({ label: s.label, q: s.q, p: s.p, d, r, mag, u, E: V.mul(u, mag), n: 'E_' + s.label });
    }
    return out;
  };
  VA.sum = list => list.reduce((s, x) => V.add(s, x.E || x), [0, 0, 0]);
  // P 与若干点是否共面：返回 {n}（全部共线时 n 为 null）；不共面返回 null
  VA.planeOf = function (P, pts) {
    const vs = pts.map(q => V.sub(q, P));
    let n = null;
    for (let i = 0; i < vs.length && !n; i++) for (let j = i + 1; j < vs.length && !n; j++) {
      const c = V.cross(vs[i], vs[j]);
      if (V.len(c) > 1e-6 * V.len(vs[i]) * V.len(vs[j])) n = V.norm(c);
    }
    if (!n) return { n: null };
    for (const v of vs) if (Math.abs(V.dot(v, n)) > 1e-6 * Math.max(1, V.len(v))) return null;
    return { n };
  };
  // 方向描述：与某两点连线同向，或垂直于某三点确定的平面
  VA.describe = function (v, named, refs) {
    const L = V.len(v);
    if (!(L > 1e-12)) return '为零';
    const u = V.mul(v, 1 / L), N = (named || []).slice(0, 16);
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
      const d = V.sub(N[j].p, N[i].p), l = V.len(d);
      if (l < 1e-9) continue;
      const c = V.dot(u, d) / l;
      if (c > 0.99999) { if (refs) refs.push(N[i], N[j]); return '与 ' + N[i].n + '→' + N[j].n + ' 同向'; }
      if (c < -0.99999) { if (refs) refs.push(N[i], N[j]); return '与 ' + N[j].n + '→' + N[i].n + ' 同向'; }
    }
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) for (let k = j + 1; k < N.length; k++) {
      const n = V.cross(V.sub(N[j].p, N[i].p), V.sub(N[k].p, N[i].p)), l = V.len(n);
      if (l < 1e-9) continue;
      if (Math.abs(V.dot(u, n)) / l > 0.99999) { if (refs) refs.push(N[i], N[j], N[k]); return '垂直于平面 ' + N[i].n + N[j].n + N[k].n; }
    }
    return null;
  };
  // ---- 对称分组：大小相等的分场成组（同组 ≥3 且共面 → 平面组；否则两两成对），其余为“剩余组” ----
  VA.group = function (parts, P) {
    const used = new Set(), groups = [];
    const cls = [];
    for (const x of parts) { const c = cls.find(k => tol(k[0].mag, x.mag)); if (c) c.push(x); else cls.push([x]); }
    cls.sort((a, b) => b.length - a.length || b[0].mag - a[0].mag);
    for (const c of cls) {
      if (c.length < 2) continue;
      if (c.length >= 3) { const pl = VA.planeOf(P, c.map(x => x.p)); if (pl && pl.n) { groups.push({ type: 'plane', items: c, n: pl.n }); c.forEach(x => used.add(x)); continue; } }
      for (let i = 0; i + 1 < c.length; i += 2) { groups.push({ type: 'pair', items: [c[i], c[i + 1]] }); used.add(c[i]); used.add(c[i + 1]); }
    }
    const rest = parts.filter(x => !used.has(x));
    if (!groups.length && rest.length >= 2) { const s = rest.slice().sort((a, b) => b.mag - a.mag); groups.push({ type: 'pair', items: [s[0], s[1]], unequal: true }); used.add(s[0]); used.add(s[1]); }
    const left = parts.filter(x => !used.has(x));
    if (left.length === 1) groups.push({ type: 'single', items: left });
    else if (left.length > 1) groups.push({ type: 'rest', items: left });
    const multi = groups.length > 1;
    groups.forEach((g, i) => { g.S = VA.sum(g.items); g.name = multi ? 'Σ' + sub(i + 1) : 'E'; g.tex = multi ? R`\vec\Sigma_{${i + 1}}` : R`\vec E`; g.i = i; });
    return groups;
  };
  const combos = (arr, k) => { const out = []; const rec = (s, a) => { if (a.length === k) return out.push(a); for (let i = s; i < arr.length && out.length < 40; i++) rec(i + 1, a.concat(arr[i])); }; rec(0, []); return out; };

  // ---- 合成方案：返回步骤数组（每步 {id, title, text, tex, ask, rows, view, hide}），并附 .d ----
  VA.plan = function (o) {
    const parts = o.parts, P = o.P, named = o.named || [], unit = o.unit || 'kQ/L²', rU = o.rUnit || 'L', pn = o.pName || 'P';
    const T = VA.sum(parts), groups = VA.group(parts, P), hide = o.hide ? ['lines', 'contours', 'surfaces', 'flow'] : null;
    const d = { P, parts, groups, T, named, pn, partial: !!o.partial }, steps = [];
    const dir = v => VA.describe(v, named);
    steps.push({ id: 'list', title: '列出各分场强', text: (o.partial ? '这次只合成在“自由合成”中选中的 ' + parts.map(x => x.n).join('、') + '，结果是它们的矢量和，不是 ' + pn + ' 点的合场强。' : '') + '每个场源电荷单独在 ' + pn + ' 点产生的电场强度称为分场强，大小为 |E_i| = k|q_i|/r_i²。正电荷的分场强背离该电荷，负电荷的分场强指向该电荷。',
      rows: [['场源电荷', 'q', 'r / ' + rU, '|E_i| / ' + unit, '方向']].concat(parts.map(x => [x.label, VA.cell(x.q), VA.cell(x.r), VA.txtV(x.mag), (x.q > 0 ? '背离 ' : '指向 ') + x.label])) });
    if (o.method === 'coord') return VA.coordSteps(o, d, steps);
    const g0 = groups.find(g => g.type === 'pair' && !g.unequal || g.type === 'plane');
    if (parts.length > 2 && g0) {
      const right = g0.items.map(x => x.n).join('、'), wrong = combos(parts, g0.items.length).filter(c => !c.every((x, i) => tol(x.mag, c[0].mag))).slice(0, 2).map(c => c.map(x => x.n).join('、'));
      const sameRQ = g0.items.every(x => tol(x.r, g0.items[0].r) && tol(Math.abs(x.q), Math.abs(g0.items[0].q)));
      steps.push({ id: 'group', title: '找出等大的分场强', text: '到 ' + pn + ' 点距离相等、电荷量大小相同的场源电荷，在 ' + pn + ' 点产生的分场强大小相等。先把这些等大的分场强合成。',
        ask: wrong.length ? { q: '下列哪一组分场强大小相等？', options: [right].concat(wrong).sort(), a: right,
          why: sameRQ ? '这几个场源电荷到 ' + pn + ' 点的距离都是 ' + VA.cell(g0.items[0].r) + ' ' + rU + '，电荷量的大小也相同。' : '这几个分场强的大小都' + isV(g0.items[0].mag) + ' ' + unit + '。' } : null });
    }
    for (const g of groups) {
      if (g.type === 'pair' && VA.isSim(g, P)) steps.push(VA.simStep(g, d), VA.simSumStep(g, d, hide, dir));
      else if (g.type === 'pair') steps.push(VA.angleStep(g, d), VA.pairStep(g, d, hide, dir));
      else if (g.type === 'plane') steps.push(VA.planeStep(g, d, hide), VA.chainStep(g, d, hide, dir, unit));
      else if (g.type === 'rest') steps.push(VA.chainStep(g, d, hide, dir, unit));
    }
    if (groups.length > 1) steps.push(...(VA.tetraSteps(d, hide) || [VA.combineStep(d, hide, dir, unit)]));
    steps.push(VA.checkStep(d, unit));
    steps.d = d;
    return steps;
  };

  // 两分场的夹角：由三角形 S_i P S_j 用余弦定理求 ∠S_iPS_j，再按两源是否同号得到分场夹角
  VA.angleStep = function (g, d) {
    const [a, b] = g.items, pn = d.pn, ab = V.dist(a.p, b.p), cg = (a.r * a.r + b.r * b.r - ab * ab) / (2 * a.r * b.r), geo = deg(Math.acos(U.clamp(cg, -1, 1)));
    const same = Math.sign(a.q) === Math.sign(b.q), th = same ? geo : 180 - geo;
    const geoName = '∠' + a.label + pn + b.label, inl = V.len(V.cross(a.d, b.d)) > 1e-10 * a.r * b.r;
    // 三点共线：两分场强在同一直线上，直接由方向判断夹角，不用余弦定理
    if (!inl) {
      const between = geo >= 90, par = th < 90;
      return { id: 'angle', g, title: '判断 ' + a.n + ' 与 ' + b.n + ' 的方向', th,
        text: pn + '、' + a.label + '、' + b.label + ' 在同一直线上，' + pn + (between ? ' 在 ' + a.label + '、' + b.label + ' 之间' : ' 在线段 ' + a.label + b.label + ' 的延长线上') + '，所以 ' + a.n + ' 与 ' + b.n + ' 都沿这条直线。' +
          '两个场源电荷' + (same ? '同号' : '异号') + '，两分场强' + (par ? '方向相同，夹角为 0°。' : '方向相反，夹角为 180°。'),
        tex: R`\theta=${par ? '0' : '180'}^\circ` };
    }
    return { id: 'angle', g, title: '求 ' + a.n + ' 与 ' + b.n + ' 的夹角', th,
      text: '在三角形 ' + a.label + pn + b.label + ' 中，由余弦定理求出 ' + geoName + '。' +
        (same ? '两个场源电荷同号，' + a.n + ' 与 ' + b.n + ' 的夹角等于 ' + geoName + '。' : '两个场源电荷异号，' + a.n + ' 与 ' + b.n + ' 的夹角等于 ' + geoName + ' 的补角。'),
      tex: R`\cos\angle ${a.label}${pn}${b.label}=\frac{r_{${a.label}}^2+r_{${b.label}}^2-|${a.label}${b.label}|^2}{2r_{${a.label}}r_{${b.label}}}=${VA.texV(cg)}\quad\theta=${same ? '' : '180^\\circ-'}\angle ${a.label}${pn}${b.label}=${f4(th)}^\circ`,
      view: inl ? V.cross(V.sub(a.p, d.P), V.sub(b.p, d.P)) : null };
  };
  // ---- 相似三角形法：两个场源电荷到观察点的距离相等、电荷量大小相同、且与观察点不共线 ----
  // 异号：E₊ ∥ (P − 正电荷)，E₋ ∥ (负电荷 − P)，首尾相接的矢量三角形是三角形“正电荷 P 负电荷”的缩小，相似比 E/r，
  //       所以 Σ 由正电荷指向负电荷，|Σ| = E·|ab|/r。
  // 同号：菱形的一半（边 E_a、Σ/2）与三角形 a M P 相似（M 为 ab 的中点），|Σ| = 2E·|PM|/r。
  VA.isSim = function (g, P) {
    const [a, b] = g.items;
    if (g.unequal || !tol(a.r, b.r) || !tol(Math.abs(a.q), Math.abs(b.q))) return false;
    return V.len(V.cross(V.sub(a.p, P), V.sub(b.p, P))) > 1e-6 * a.r * b.r;
  };
  const simInfo = function (g, d) {
    const [a, b] = g.items, opp = Math.sign(a.q) !== Math.sign(b.q), E = a.mag, r = a.r, ab = V.dist(a.p, b.p);
    const pos = opp ? (a.q > 0 ? a : b) : a, neg = opp ? (a.q > 0 ? b : a) : b;
    const mid = V.lerp(a.p, b.p, 0.5), pm = V.dist(d.P, mid);
    const known = (d.named || []).find(x => x.n !== d.pn && !d.parts.some(p => p.label === x.n) && V.dist(x.p, mid) < 1e-9);
    const used = new Set((d.named || []).map(x => x.n).concat(d.parts.map(x => x.label), [d.pn], d.groups.map(g => g.midName)));
    let mn = g.midName || (known && known.n) || ['M', 'N', 'K', 'H'].find(x => !used.has(x));
    for (let i = 1; !mn; i++) if (!used.has('M' + i)) mn = 'M' + i;
    g.midName = mn;
    const apex = deg(Math.acos(U.clamp((2 * r * r - ab * ab) / (2 * r * r), -1, 1)));
    return { a, b, opp, E, r, ab, pos, neg, mn, mid, pm, apex, th: opp ? 180 - apex : apex };
  };
  VA.simStep = function (g, d) {
    const s = simInfo(g, d), pn = d.pn, { pos, neg, mn } = s, nm = g.name;
    const tri = s.opp ? pos.label + pn + neg.label : s.a.label + mn + pn, apexN = '∠' + s.a.label + pn + s.b.label;
    let text, tex, ask;
    if (s.opp) {
      const base = '∠' + pn + pos.label + neg.label, right = '由 ' + pos.label + ' 指向 ' + neg.label;
      text = pos.n + ' 沿由 ' + pos.label + ' 指向 ' + pn + ' 的方向，' + neg.n + ' 沿由 ' + pn + ' 指向 ' + neg.label + ' 的方向，两者大小都是 E₀，而 ' + pn + pos.label + ' = ' + pn + neg.label + ' = r。' +
        '把 ' + neg.n + ' 平移到 ' + pos.n + ' 的末端，矢量三角形的两边分别平行于 ' + pos.label + pn + '、' + pn + neg.label + '，且两边之比等于 ' + pn + pos.label + ' : ' + pn + neg.label + '，所以它与三角形 ' + tri + ' 相似，相似比为 E₀/r。' +
        '由相似得对应角相等：' + nm + ' 与 ' + pos.n + ' 的夹角等于 ' + base + '，两分场强的夹角 θ 等于 ' + apexN + ' 的补角。';
      tex = R`\cos\angle ${pn}${pos.label}${neg.label}=\frac{|${pos.label}${neg.label}|/2}{r}=${VA.texV(s.ab / 2 / s.r)}\qquad\cos\angle ${s.a.label}${pn}${s.b.label}=${VA.texV((2 * s.r * s.r - s.ab * s.ab) / (2 * s.r * s.r))}\quad\theta=180^\circ-\angle ${s.a.label}${pn}${s.b.label}=${f4(s.th)}^\circ`;
      ask = { q: nm + ' 的方向与哪个方向相同？', options: [right, '由 ' + neg.label + ' 指向 ' + pos.label, '由 ' + pn + ' 指向 ' + pos.label + neg.label + ' 的中点'].sort(), a: right,
        why: '矢量三角形与三角形 ' + tri + ' 相似，' + nm + ' 对应边 ' + pos.label + neg.label + '，所以 ' + nm + ' 的方向' + right + '。' };
    } else {
      const toP = s.a.q > 0, right = toP ? '由 ' + mn + ' 指向 ' + pn : '由 ' + pn + ' 指向 ' + mn;
      text = '设 ' + mn + ' 为 ' + s.a.label + s.b.label + ' 的中点。两分场强大小都是 E₀，以它们为邻边的平行四边形是菱形，对角线 ' + nm + ' 平分两分场强的夹角。' +
        '半个菱形组成的三角形（边为 ' + s.a.n + ' 与 ' + nm + '/2）与三角形 ' + tri + ' 相似，相似比为 E₀/r。' +
        '由相似得对应角相等：' + nm + ' 与 ' + s.a.n + ' 的夹角等于 ∠' + s.a.label + pn + mn + '，两分场强的夹角 θ 等于 ' + apexN + '。';
      tex = R`|${pn}${mn}|=\sqrt{r^2-(|${s.a.label}${s.b.label}|/2)^2}=${VA.texV(s.pm)}\qquad\cos\angle ${s.a.label}${pn}${mn}=\frac{|${pn}${mn}|}{r}=${VA.texV(s.pm / s.r)}\quad\theta=\angle ${s.a.label}${pn}${s.b.label}=${f4(s.th)}^\circ`;
      ask = { q: nm + ' 的方向与哪个方向相同？', options: [right, toP ? '由 ' + pn + ' 指向 ' + mn : '由 ' + mn + ' 指向 ' + pn, '由 ' + s.a.label + ' 指向 ' + s.b.label].sort(), a: right,
        why: '菱形的对角线 ' + nm + ' 与三角形 ' + tri + ' 中的边 ' + mn + pn + ' 对应，两个场源电荷' + (toP ? '都带正电，所以 ' : '都带负电，所以 ') + nm + ' 的方向' + right + '。' };
    }
    return { id: 'similar', g, sim: s, th: s.th, title: '用相似三角形求 ' + s.a.n + ' 与 ' + s.b.n + ' 的合成', text, tex, ask,
      setup: '设 ' + mn + ' 为线段 ' + s.a.label + s.b.label + ' 的中点。',
      view: V.cross(V.sub(s.a.p, d.P), V.sub(s.b.p, d.P)) };
  };
  VA.simSumStep = function (g, d, hide, dir) {
    const s = simInfo(g, d), pn = d.pn, nm = g.name, L = V.len(g.S), D = dir(g.S);
    const text = s.opp
      ? '由相似三角形的对应边成比例，|' + nm + '| : E₀ = ' + s.pos.label + s.neg.label + ' : r，所以 |' + nm + '| 等于 E₀ 乘以 ' + s.pos.label + s.neg.label + '/r，' + isV(L) + '。'
      : '由相似三角形的对应边成比例，|' + nm + '|/2 : E₀ = ' + pn + s.mn + ' : r，所以 |' + nm + '| 等于 2E₀ 乘以 ' + pn + s.mn + '/r，' + isV(L) + '。';
    const tex = s.opp
      ? R`|${g.tex}|=E_0\cdot\frac{|${s.pos.label}${s.neg.label}|}{r}=${VA.texV(s.E)}\times${VA.texV(s.ab / s.r)}=${VA.texV(L)}`
      : R`|${g.tex}|=2E_0\cdot\frac{|${pn}${s.mn}|}{r}=2\times${VA.texV(s.E)}\times${VA.texV(s.pm / s.r)}=${VA.texV(L)}`;
    return { id: 'pairSum', g, sim: s, title: '求 ' + nm + ' 的大小与方向', hide, view: V.cross(s.a.E, s.b.E), text: text + (D ? nm + ' 的方向' + D + '。' : ''), tex };
  };
  VA.pairStep = function (g, d, hide, dir) {
    const [a, b] = g.items, eq = tol(a.mag, b.mag), zero = V.len(g.S) < 1e-12, D = zero ? null : dir(g.S);
    const col = V.len(V.cross(a.E, b.E)) <= 1e-9 * a.mag * b.mag, para = V.dot(a.E, b.E) > 0;
    return { id: 'pairSum', g, title: '合成 ' + a.n + ' 与 ' + b.n, hide, view: V.len(V.cross(a.E, b.E)) > 1e-12 ? V.cross(a.E, b.E) : null,
      text: zero ? a.n + ' 与 ' + b.n + ' 大小相等、方向相反，矢量和为零，即 ' + g.name + ' 为零。' :
        (col ? a.n + ' 与 ' + b.n + ' 在同一直线上且方向' + (para ? '相同，' + g.name + ' 的大小等于两者大小之和。' : '相反，' + g.name + ' 的大小等于两者大小之差，方向与较大的分场强相同。')
          : '以 ' + a.n + '、' + b.n + ' 为邻边作平行四边形，对角线表示它们的矢量和 ' + g.name + '。' + (eq ? '两分场强大小相等，' + g.name + ' 沿它们夹角的平分线。' : '')) + (D ? g.name + ' 的方向' + D + '。' : ''),
      tex: col && !zero ? R`|${g.tex}|=${para ? 'E_1+E_2' : '|E_1-E_2|'}=${VA.texV(V.len(g.S))}` : eq ? R`|${g.tex}|=2E\cos\frac{\theta}{2}=${VA.texV(V.len(g.S))}` : R`|${g.tex}|=\sqrt{E_1^2+E_2^2+2E_1E_2\cos\theta}=${VA.texV(V.len(g.S))}` };
  };
  VA.planeStep = function (g, d, hide) {
    const lb = g.items.map(x => x.label).join(''), pn = d.pn;
    const ns = g.items.map(x => x.n).join('、');
    return { id: 'plane', g, title: '判断这些分场强共面', hide, view: g.n,
      text: pn + ' 点与 ' + g.items.map(x => x.label).join('、') + ' 在同一平面内，' + ns + ' 都在这个平面内。下一步从距离关系计算矢量和，不需要目测夹角。',
      ask: { q: ns + ' 在哪个平面内？', options: ['平面 ' + lb + '（含 ' + pn + '）', '与该平面垂直的平面', '不在同一平面内'], a: '平面 ' + lb + '（含 ' + pn + '）', why: pn + ' 点与 ' + lb + ' 共面，而每个分场强都沿 ' + pn + ' 点与对应场源电荷的连线，所以都在这个平面内。' } };
  };
  // Law of cosines on source triangles, then distributivity of the scalar product.
  const lengthProof = function (items, other) {
    const pairs = [];
    items.forEach((a, i) => (other || items.slice(i + 1)).forEach(b => {
      const distance = V.dist(a.p, b.p), cosine = U.clamp((a.r * a.r + b.r * b.r - distance * distance) / (2 * a.r * b.r), -1, 1);
      pairs.push({ a, b, distance, c: Math.sign(a.q * b.q) * a.mag * b.mag * cosine });
    }));
    const dot = pairs.reduce((sum, p) => sum + p.c, 0);
    return { pairs, dot, squared: items.reduce((sum, a) => sum + a.mag * a.mag, 0) + 2 * dot };
  };
  const proofRows = p => [['场源对', 'r_i', 'r_j', 'd_ij', 'C_ij']].concat(p.pairs.map(x => [x.a.label + ' / ' + x.b.label, VA.cell(x.a.r), VA.cell(x.b.r), VA.cell(x.distance), VA.cell(x.c)]));
  const proofTex = R`d_{ij}=|S_iS_j|,\quad C_{ij}=\vec E_i\cdot\vec E_j=\frac{k^2q_iq_j(r_i^2+r_j^2-d_{ij}^2)}{2r_i^3r_j^3}`;
  const proofText = '记 r_i 为观察点到场源 S_i 的距离，d_ij 为两场源间距。由两场源与观察点组成的三角形的余弦定理及电荷正负号得到 C_ij（各量均取本平台的归一化单位，k=1）。下表列出三边及 C_ij；普通小数为近似读数，计算使用未舍入值。';
  VA.chainStep = function (g, d, hide, dir, unit) {
    const proof = lengthProof(g.items), D = V.len(g.S) > 1e-12 ? dir(g.S) : null;
    return { id: 'chainSum', g, proof, title: '由距离关系求 ' + g.name, hide, view: g.n || null,
      text: proofText + '将分场强首尾相接；把矢量和的平方展开，即可从三边求出大小，无须先求数值夹角。' + (D ? '' + g.name + ' 的方向' + D + '。' : ''), rows: proofRows(proof),
      tex: proofTex + R`\qquad |${g.tex}|^2=\sum_i E_i^2+2\sum_{i<j}C_{ij}=${VA.texV(g.items.reduce((s, a) => s + a.mag * a.mag, 0))}+2(${VA.texV(proof.dot)})=${VA.texV(Math.max(0, proof.squared))}\qquad |${g.tex}|=${VA.texV(V.len(g.S))}` };
  };

  // This construction applies only when all six edges form a regular tetrahedron.
  VA.tetraSteps = function (d, hide) {
    if (d.parts.length !== 3 || d.groups.length !== 2) return null;
    const pair = d.groups.find(g => g.type === 'pair'), single = d.groups.find(g => g.type === 'single');
    if (!pair || !single) return null;
    const [a, b] = pair.items, c = single.items[0], edge = a.r;
    if (!d.parts.every(x => tol(x.q, a.q) && tol(x.r, edge)) || ![V.dist(a.p, b.p), V.dist(a.p, c.p), V.dist(b.p, c.p)].every(x => tol(x, edge))) return null;
    const m = simInfo(pair, d), G = V.mul(V.add(V.add(a.p, b.p), c.p), 1 / 3), H = V.addS(d.P, V.sub(d.P, c.p), 0.5);
    const used = new Set(d.named.map(x => x.n).concat(d.parts.map(x => x.label), [d.pn, m.mn]));
    const name = (base, p) => {
      const known = d.named.find(x => !d.parts.some(s => s.label === x.n) && x.n !== d.pn && V.dist(x.p, p) < 1e-9);
      if (known) return known.n;
      let n = base, i = 0; while (used.has(n)) n = base + (++i); used.add(n); return n;
    };
    const gn = name('G', G), hn = name('H', H), pn = d.pn, mn = m.mn, cn = c.label;
    const tetra = { P: d.P, C: c.p, mid: m.mid, G, H, mn, gn, hn, edge };
    const shared = { tetra, hide, view: V.cross(V.sub(m.mid, d.P), V.sub(c.p, d.P)) };
    return [
      { ...shared, id: 'tetraHeight', title: '先求正四面体中的已知长度',
        text: a.label + b.label + cn + pn + ' 的六条棱均长 a，因此是正四面体。' + mn + ' 为 ' + a.label + b.label + ' 的中点，' + gn + ' 为底面重心。等腰三角形的中线也是高；底面重心按 2:1 分中线。因顶点 ' + pn + ' 到底面三顶点等距，其垂足是底面中心 ' + gn + '。用勾股定理求高度。',
        tex: R`a=|${pn}${a.label}|=|${pn}${b.label}|=|${pn}${cn}|=|${a.label}${b.label}|=|${a.label}${cn}|=|${b.label}${cn}|\qquad |${pn}${mn}|=|${cn}${mn}|=\frac{\sqrt3}{2}a,\quad |${cn}${gn}|=\frac23|${cn}${mn}|=\frac{a}{\sqrt3}\qquad |${pn}${gn}|=\sqrt{a^2-|${cn}${gn}|^2}=\sqrt{\frac23}a` },
      { ...shared, id: 'tetraSimilar', title: '构造与矢量三角形相似的三角形',
        text: '沿 ' + cn + pn + ' 过 ' + pn + ' 延长到 ' + hn + '，使 ' + pn + hn + '=a/2。' + cn + '、' + gn + '、' + mn + ' 共线，且 ' + cn + '、' + pn + '、' + hn + ' 共线，所以两三角形在 ' + cn + ' 处的夹角相同。两组夹边的比均为 3/2，由边角边判定相似，得到第三边。',
        tex: R`|${pn}${hn}|=\frac a2,\quad |${cn}${hn}|=\frac32a,\quad\frac{|${cn}${mn}|}{|${cn}${gn}|}=\frac{|${cn}${hn}|}{|${cn}${pn}|}=\frac32\qquad △ ${cn}${mn}${hn}\sim△ ${cn}${gn}${pn},\quad |${mn}${hn}|=\frac32|${gn}${pn}|=\frac{\sqrt6}{2}a` },
      { ...shared, id: 'combine', title: '由三边比例求合场强',
        text: pair.name + ' 对应 ' + mn + '→' + pn + '，' + single.name + ' 平移后对应 ' + pn + '→' + hn + '，比例系数相同；两矢量相加对应 ' + mn + '→' + hn + '。三边比为 √3:1:√6，直接得到合场强大小；负电荷时所有对应矢量同时反向，长度关系不变。',
        tex: R`E_0=\frac{k|q|}{a^2},\quad ${pair.tex}=\frac{2kq}{a^3}\vec{${mn}${pn}},\quad ${single.tex}=\frac{2kq}{a^3}\vec{${pn}${hn}}\qquad |${pair.tex}|:|${single.tex}|:|\vec E|=|${mn}${pn}|:|${pn}${hn}|:|${mn}${hn}|=\sqrt3:1:\sqrt6\qquad |\vec E|=\sqrt6 E_0=${VA.texV(V.len(d.T))}` }
    ];
  };
  VA.combineStep = function (d, hide, dir, unit) {
    const G = d.groups, two = G.length === 2 && G.every(g => V.len(g.S) > 1e-12);
    const proof = two ? lengthProof(G[0].items, G[1].items) : lengthProof(d.parts);
    const base = two ? V.dot(G[0].S, G[0].S) + V.dot(G[1].S, G[1].S) : d.parts.reduce((sum, a) => sum + a.mag * a.mag, 0);
    proof.squared = base + 2 * proof.dot;
    const square = two ? R`D=${G[0].tex}\cdot ${G[1].tex}=\sum C_{ij}=${VA.texV(proof.dot)}\qquad |\vec E|^2=|${G[0].tex}|^2+|${G[1].tex}|^2+2D` : R`|\vec E|^2=\sum_i E_i^2+2\sum_{i<j}C_{ij}`;
    const D = V.len(d.T) > 1e-12 ? dir(d.T) : null;
    return { id: 'combine', proof, title: '由已知距离合成各部分和', hide,
      view: two && V.len(V.cross(G[0].S, G[1].S)) > 1e-12 ? V.cross(G[0].S, G[1].S) : null,
      text: proofText + (two ? '由数量积的分配律，跨组 C_ij 相加就是两个部分和的数量积 D。再展开合矢量的平方求大小；D=0 时才可用勾股定理。' : '将全部分场强的矢量和平方展开。即使某组抵消为零或有多组剩余项，也由同一距离关系求出结果。') + (D ? '合场强的方向' + D + '。' : ''), rows: proofRows(proof),
      tex: proofTex + R`\qquad ` + square + R`=${VA.texV(base)}+2(${VA.texV(proof.dot)})=${VA.texV(Math.max(0, proof.squared))}\qquad |\vec E|=${VA.texV(V.len(d.T))}` };
  };
  VA.checkStep = function (d, unit) {
    const D = VA.describe(d.T, d.named), T = d.T;
    return { id: 'check', title: '用坐标法核对结果', view: 'reset',
      text: (V.len(T) < 1e-12 ? (d.partial ? '所选分场强的矢量和为零。' : d.pn + ' 点的合场强为零。') : (d.partial ? '所选分场强矢量和的大小' : d.pn + ' 点合场强的大小') + isV(V.len(T)) + ' ' + unit + (D ? '，方向' + D : '') + '。') + '把各分场强的 x、y、z 分量分别相加，得到的结果与几何法一致。',
      rows: [['', 'E_x', 'E_y', 'E_z']].concat(d.parts.map(x => [x.n, VA.cell(x.E[0]), VA.cell(x.E[1]), VA.cell(x.E[2])]), [['合计', VA.cell(T[0]), VA.cell(T[1]), VA.cell(T[2])]]),
      tex: R`|\vec E|=\sqrt{E_x^2+E_y^2+E_z^2}=${VA.texV(V.len(T))}` };
  };
  VA.coordSteps = function (o, d, steps) {
    const T = d.T;
    steps.push({ id: 'coordR', title: '求相对位置矢量', text: '从每个场源电荷指向 ' + d.pn + ' 点的矢量为 d_i，它等于 ' + d.pn + ' 点的位置矢量减去该电荷的位置矢量，其长度就是距离 r_i。',
      rows: [['场源电荷', 'd_x', 'd_y', 'd_z', 'r']].concat(d.parts.map(x => [x.label, VA.cell(x.d[0]), VA.cell(x.d[1]), VA.cell(x.d[2]), VA.cell(x.r)])), tex: R`\vec E_i=\frac{kq_i\,\vec d_i}{r_i^3}` });
    steps.push({ id: 'coordE', title: '分量求和', text: '把各分场强的 x、y、z 分量分别相加，得到合场强的 x、y、z 分量。',
      rows: [['', 'E_x', 'E_y', 'E_z']].concat(d.parts.map(x => [x.n, VA.cell(x.E[0]), VA.cell(x.E[1]), VA.cell(x.E[2])]), [['合计', VA.cell(T[0]), VA.cell(T[1]), VA.cell(T[2])]]) });
    const D = VA.describe(T, d.named);
    steps.push({ id: 'check', title: '求合场强的大小与方向', view: 'reset', text: V.len(T) < 1e-12 ? '三个分量之和都为零，所以' + (d.partial ? '所选分场强的矢量和为零。' : ' ' + d.pn + ' 点的合场强为零。') : (d.partial ? '所选分场强矢量和的大小' : d.pn + ' 点合场强的大小') + isV(V.len(T)) + ' ' + (o.unit || 'kQ/L²') + (D ? '，方向' + D : '') + '。',
      tex: R`|\vec E|=\sqrt{E_x^2+E_y^2+E_z^2}=${VA.texV(V.len(T))}` });
    steps.d = d;
    return steps;
  };

  // ---- 构造对象：随已揭示的步骤逐步添加。o: {map(p)→显示坐标, scale, MH, C, R} ----
  VA.draw = function (steps, k, out, o) {
    const d = steps.d, MH = o.MH, C = o.C, M = o.map || (p => p), P = M(d.P), Rr = o.R;
    const ids = steps.slice(0, k + 1).map(s => s.id), at = id => ids.lastIndexOf(id), cur = steps[k] ? steps[k].id : '';
    const mx = Math.max(...d.parts.map(x => x.mag), ...d.groups.map(g => V.len(g.S)), V.len(d.T)), sc = 0.34 * Rr / mx * (o.vs || 1), S = v => V.mul(v, sc);
    const done = new Set();
    steps.slice(0, k + 1).forEach(s => { if ((s.id === 'pairSum' || s.id === 'chainSum') && s.g) s.g.items.forEach(x => done.add(x)); });
    const finished = at('combine') >= 0 || (at('check') >= 0 && d.groups.length === 1);
    const active = steps[o.step == null ? k : o.step], pending = o.step > k;
    const focus = active && active.g ? new Set(active.g.items) : null;
    const al = x => finished ? 0.2 : done.has(x) && !(focus && focus.has(x)) ? 0.25 : focus && !focus.has(x) ? 0.3 : 1;
    // 带标签的矢量：lf 为标签沿矢量的位置（1.06 为箭头外侧）；重合的矢量错开标签位置
    const vec = (p, v, color, text, cls, width, lf) => {
      if (!(V.len(v) > 1e-9)) return;
      MH.vec(out, p, v, color, null, null, width);
      if (text) (out.labels = out.labels || []).push({ p: V.addS(p, v, lf || 1.06), text, cls: (cls || '') + ' vec', kind: 'vectors' });
    };
    // Reference geometry is visible before a prediction; the solution construction stays gated by k.
    if (active && pending && active.sim) {
      const m = active.sim;
      MH.tri(out, [M(m.a.p), P, M(m.b.p)], C.pot, 0.04);
      MH.dash(out, P, M(m.mid), C.ang);
      MH.mark(out, M(m.mid), m.mn, C.mark, Rr * 0.018);
    }
    if (active && active.id === 'combine' && pending) for (const g of d.groups) {
      if (g.type === 'single') vec(P, S(g.S), C.part, g.name, 'part', 2.8);
    }
    if (active && !pending) {
      const refs = [], vectors = active.id === 'combine' ? d.groups.map(g => g.S) : active.g ? [active.g.S] : active.id === 'check' ? [d.T] : [];
      vectors.forEach(v => VA.describe(v, d.named, refs));
      for (const q of refs) {
        if (d.parts.some(x => x.label === q.n) || q.n === d.pn || (out.labels || []).some(l => l.text === q.n)) continue;
        MH.mark(out, M(q.p), q.n, C.mark, Rr * 0.018);
        MH.dash(out, P, M(q.p), C.guide);
      }
    }
    if (active && active.tetra) {
      const t = active.tetra;
      const points = [{ n: t.mn, p: t.mid }, { n: t.gn, p: t.G }];
      const segments = [[t.C, t.mid], [t.G, t.P], [t.mid, t.P]];
      if (active.id !== 'tetraHeight') { points.push({ n: t.hn, p: t.H }); segments.push([t.C, t.H], [t.mid, t.H]); }
      for (const q of points) if (!(out.labels || []).some(l => l.text === q.n)) MH.mark(out, M(q.p), q.n, C.mark, Rr * 0.018);
      for (const [a, b] of segments) MH.dash(out, M(a), M(b), C.ang);
      if (active.id !== 'tetraHeight') MH.tri(out, [M(t.mid), P, M(t.H)], C.pot, 0.07);
      MH.right(out, M(t.G), V.sub(t.P, t.G), V.sub(t.mid, t.G), Rr * 0.025);
    }
    if (cur === 'list' || cur === 'coordR') for (const x of d.parts) { MH.dash(out, P, M(x.p), C.guide); (out.labels = out.labels || []).push({ p: V.lerp(P, M(x.p), 0.55), text: 'r=' + VA.cell(x.r), cls: 'pt', kind: 'vectors' }); }
    // 方向相同的分场强（例如共线的 E_T1、E_T2）沿垂直方向错开，标签分别放在箭头外侧与中部
    const offs = VA.offsets(d.parts.map(x => x.E), Rr * 0.035), rank = offs.rank;
    d.parts.forEach((x, i) => { const a = al(x); vec(V.add(P, offs[i]), S(x.E), [...(x.q > 0 ? C.pos : C.neg), a], a > 0.5 ? x.n : null, x.q > 0 ? 'pos' : 'neg', 2.4, rank[i] % 2 ? 0.55 : 1.06); });
    const s = pending ? null : steps[k];
    if (s && s.id === 'angle') {
      const [a, b] = s.g.items;
      MH.tri(out, [P, M(a.p), M(b.p)], C.pot, 0.08);
      MH.arc(out, P, V.sub(M(a.p), P), V.sub(M(b.p), P), Rr * 0.1, '∠' + a.label + d.pn + b.label);
      MH.arc(out, P, a.E, b.E, Rr * 0.06, 'θ=' + r1(s.th) + '°');
    }
    // 相似三角形：几何三角形（浅色）与首尾相接的矢量三角形
    if (s && (s.id === 'similar' || s.id === 'pairSum') && s.sim) {
      const m = s.sim, g = s.g;
      if (m.opp) {
        MH.mark(out, M(m.mid), m.mn, C.mark, Rr * 0.018);
        MH.tri(out, [M(m.pos.p), P, M(m.neg.p)], C.pot, 0.08);
        vec(V.add(P, S(m.pos.E)), S(m.neg.E), [...(m.neg.q > 0 ? C.pos : C.neg), 0.9], m.neg.n + '′', 'neg', 2, 0.55);
        if (s.id === 'similar') MH.arc(out, M(m.pos.p), V.sub(P, M(m.pos.p)), V.sub(M(m.neg.p), M(m.pos.p)), Rr * 0.08, '∠' + d.pn + m.pos.label + m.neg.label);
      } else {
        MH.tri(out, [M(m.a.p), M(m.mid), P], C.pot, 0.08);
        MH.dash(out, P, M(m.mid), C.ang);
        MH.mark(out, M(m.mid), m.mn, C.mark, Rr * 0.018);
        MH.dash(out, V.add(P, S(m.a.E)), V.add(P, S(g.S))); MH.dash(out, V.add(P, S(m.b.E)), V.add(P, S(g.S)));
      }
      if (s.id === 'similar') { MH.arc(out, P, m.a.E, m.b.E, Rr * 0.06, 'θ=' + r1(m.th) + '°'); MH.dash(out, P, V.add(P, S(g.S)), C.sum); }
    }
    if (s && s.id === 'plane') MH.tri(out, s.g.items.map(x => M(x.p)), C.pot, 0.14);
    steps.slice(0, k + 1).forEach(st => {
      if (!st.g) return;
      const g = st.g;
      if (st.id === 'pairSum') {
        const [a, b] = g.items, col = V.len(V.cross(a.E, b.E)) <= 1e-9 * a.mag * b.mag;
        if (st === s && !st.sim) {
          // 共线时用首尾相接表示；不共线时画平行四边形
          if (col) vec(V.add(P, S(a.E)), S(b.E), [...(b.q > 0 ? C.pos : C.neg), 0.9], b.n + '′', b.q > 0 ? 'pos' : 'neg', 2, 0.55);
          else { MH.dash(out, V.add(P, S(a.E)), V.add(P, S(g.S))); MH.dash(out, V.add(P, S(b.E)), V.add(P, S(g.S))); }
        }
        if (!finished) vec(P, S(g.S), d.groups.length > 1 ? C.part : C.sum, g.name, d.groups.length > 1 ? 'part' : 'sum', 2.8);
      }
      if (st.id === 'chainSum') {
        if (st === s) { let q = P; for (const x of g.items) { vec(q, S(x.E), x.q > 0 ? C.pos : C.neg, null); q = V.add(q, S(x.E)); } }
        if (!finished) vec(P, S(g.S), d.groups.length > 1 ? C.part : C.sum, g.name, d.groups.length > 1 ? 'part' : 'sum', 2.8);
      }
    });
    if (finished || at('check') >= 0) {
      if (d.groups.length === 2) {
        const [a, b] = d.groups;
        vec(P, S(a.S), [...C.part, 0.7], a.name, 'part', 2.2); vec(P, S(b.S), [...C.part, 0.7], b.name, 'part', 2.2);
        MH.dash(out, V.add(P, S(a.S)), V.add(P, S(d.T))); MH.dash(out, V.add(P, S(b.S)), V.add(P, S(d.T)));
        if (V.len(a.S) * V.len(b.S) > 1e-24 && Math.abs(V.dot(a.S, b.S)) <= 1e-9 * V.len(a.S) * V.len(b.S)) MH.right(out, P, a.S, b.S, Rr * 0.035);
      }
      vec(P, S(d.T), C.sum, d.partial ? 'Σ（所选）' : 'E 合', 'sum', 3.2);
    }
    if (cur === 'check' || cur === 'coordE') ['x', 'y', 'z'].forEach((n, i) => { const v = [0, 0, 0]; v[i] = d.T[i] * sc; if (Math.abs(v[i]) > 1e-9) vec(P, v, [...C.guide, 0.8], 'E_' + n, '', 1.4, 0.6); });
    return out;
  };

  // 单个步骤的说明 HTML（表格 + 公式），实验室与例题共用
  VA.stepHTML = function (s) {
    let html = '';
    if (s.rows) html += '<table class="cap-tbl">' + s.rows.map((r, i) => '<tr>' + r.map(c => (i ? '<td>' : '<th>') + U.rich(c) + (i ? '</td>' : '</th>')).join('') + '</tr>').join('') + '</table>';
    if (s.tex) html += '<div class="cap-m' + (s.proof || s.tetra ? ' cap-proof' : '') + '">' + EL.texBlock(s.tex) + '</div>';
    return html;
  };
})(window.EL);
