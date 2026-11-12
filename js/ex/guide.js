'use strict';
// Calculation steps are shared by the guide, complete solution and authored problems.
(function (EL) {
  const X = EL.EX, V = EL.V, VA = EL.VA, R = String.raw;
  const en = false, L = (zh, english) => en ? english : zh;
  const F = VA.texV, C = VA.cell, vec = p => '(' + p.map(F).join(',') + ')';
  const close = (a, b) => Math.abs(a - b) < 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));

  X.pathAnalysis = function (pb, model, q) {
    const a = model.pts[q.a].p, b = model.pts[q.b].p, d = V.sub(b, a), length = V.len(d), t = V.norm(d);
    const sources = model.sources.map(source => {
      const h = V.dot(V.sub(source.p, a), t), foot = V.addS(a, t, h), b2 = V.dist(source.p, foot) < 1e-12 * length ? 0 : V.dot(V.sub(source.p, foot), V.sub(source.p, foot));
      return { ...source, h, b2, foot };
    });
    const groups = [];
    for (const source of sources) {
      const g = groups.find(g => close(g.h, source.h) && close(g.b2, source.b2));
      if (g) { g.q += source.q; g.labels.push(source.label); }
      else groups.push({ h: source.h, b2: source.b2, q: source.q, labels: [source.label] });
    }
    const active = groups.filter(g => Math.abs(g.q) > 1e-12), at = s => model.field(V.lerp(a, b, s));
    const slope = s => { const f = at(s); return f.E.every(Number.isFinite) ? -V.dot(f.E, d) : NaN; };
    const breaks = [0, 1];
    if (model.analytic) {
      if (/plane|interface/.test(pb.sub) && d[2]) breaks.push(-a[2] / d[2]);
      if (/sphere/.test(pb.sub)) {
        const A = V.dot(d, d), B = 2 * V.dot(a, d), D = B * B - 4 * A * (V.dot(a, a) - pb.sp.a ** 2);
        if (D >= 0) breaks.push((-B - Math.sqrt(D)) / (2 * A), (-B + Math.sqrt(D)) / (2 * A));
      }
    }
    const boundaries = [...new Set(breaks.filter(s => s >= 0 && s <= 1))].sort((a, b) => a - b);
    const roots = [], brackets = [];
    // shortcut: generic roots use numerical sign-change brackets; special built-in cases also have analytic proofs below.
    for (let j = 1; j < boundaries.length; j++) {
      const start = boundaries[j - 1], end = boundaries[j], inset = (end - start) * 1e-7;
      let lo = start + inset, flo = slope(lo);
      for (let i = 1; i <= 512; i++) {
        const hi = start + inset + (end - start - 2 * inset) * i / 512, fhi = slope(hi);
        if (Number.isFinite(flo) && Number.isFinite(fhi) && flo * fhi < 0) {
          let l = lo, r = hi, fl = flo;
          for (let k = 0; k < 48; k++) { const m = (l + r) / 2, fm = slope(m); if (fl * fm <= 0) r = m; else { l = m; fl = fm; } }
          const s = (l + r) / 2;
          if (!roots.some(x => Math.abs(x - s) < 1e-7)) { roots.push(s); brackets.push({ lo, hi, s }); }
        }
        if (fhi !== 0) { lo = hi; flo = fhi; }
      }
    }
    const cuts = [...new Set([...boundaries, ...roots])].sort((a, b) => a - b);
    const intervals = cuts.slice(1).map((b, i) => { const a = cuts[i], s = (a + b) / 2; return { a, b, s, derivative: slope(s) }; });
    let special = null;
    if (active.length === 2) {
      const medianA = active.find(g => close(g.h / length, -2) && close(g.b2 / length ** 2, 0));
      const medianB = active.find(g => close(g.h / length, 1) && close(g.b2 / length ** 2, 3));
      const vertex = active.find(g => close(g.h / length, 1) && close(g.b2 / length ** 2, 0));
      const opposite = active.find(g => close(g.h / length, 1 / 3) && close(g.b2 / length ** 2, 8 / 9));
      if (medianA && medianB && close(medianB.q, 2 * medianA.q)) special = { kind: 'median', q: medianA.q };
      if (vertex && opposite && close(vertex.q, -opposite.q)) special = { kind: 'tetra', q: opposite.q };
    }
    return { a, b, d, t, length, sources, groups, active, at, slope, roots, brackets, boundaries, intervals, special };
  };

  X.pathLaw = function (pb) {
    const p = pb.sp;
    switch (pb.sub) {
      case 'point': return R`\varphi(s)=\frac{kq}{r(s)}=\frac{${F(p.q)}}{r(s)}`;
      case 'infinite-line': return R`\varphi(s)=-2k\lambda\ln\frac{\rho(s)}{\rho_0}=-2(${F(p.lambda)})\ln\frac{\rho(s)}{${F(p.r0)}}`;
      case 'infinite-plane': return R`\varphi(s)=-2\pi k\sigma|z(s)|=-2\pi(${F(p.sigma)})|z(s)|`;
      case 'conductor-sphere': return R`r(s)\le a:\quad\varphi=\frac{kq}{a}=${F(p.q / p.a)}\qquad r(s)>a:\quad\varphi=\frac{kq}{r(s)}=\frac{${F(p.q)}}{r(s)}`;
      case 'dielectric-interface': return R`D=${F(p.D)},\quad\varepsilon_1=${F(p.e1)},\quad\varepsilon_2=${F(p.e2)}\qquad z(s)\ge0:\quad\varphi=-\frac{4\pi kDz(s)}{\varepsilon_1}\qquad z(s)<0:\quad\varphi=-\frac{4\pi kDz(s)}{\varepsilon_2}`;
      case 'dielectric-sphere': return R`E_0=${F(p.E0)},\quad a=${F(p.a)}\qquad C=\frac{3\varepsilon_{out}}{\varepsilon_{in}+2\varepsilon_{out}}=${F(3 * p.eout / (p.ein + 2 * p.eout))},\quad\beta=\frac{\varepsilon_{in}-\varepsilon_{out}}{\varepsilon_{in}+2\varepsilon_{out}}=${F((p.ein - p.eout) / (p.ein + 2 * p.eout))}\qquad r(s)<a:\quad\varphi=-CE_0z(s)\qquad r(s)\ge a:\quad\varphi=-E_0z(s)+\frac{\beta E_0a^3z(s)}{r(s)^3}`;
    }
  };

  X.pathSteps = function (pb, model, answer, s) {
    const p = answer.pathProof || (answer.pathProof = X.pathAnalysis(pb, model, answer.q));
    const q = answer.q, f = p.at(s), point = V.lerp(p.a, p.b, s), derivative = p.slope(s);
    let geometry = R`\ell=|${q.a}${q.b}|=${F(p.length)},\quad s=\frac{|${q.a}X|}{\ell},\quad0\le s\le1\qquad\vec X(s)=${vec(p.a)}+s${vec(p.d)}\qquad\hat t=\frac{\vec r_{${q.b}}-\vec r_{${q.a}}}{\ell}`;
    if (p.special?.kind === 'median' && pb.tpl === 'tri' && q.a === 'G' && q.b === 'M') geometry = R`h=\sqrt{a^2-(a/2)^2}=\frac{\sqrt3a}{2},\quad\ell=GM=\frac h3=\frac{\sqrt3a}{6}\qquad ` + geometry;
    if (p.special?.kind === 'tetra' && pb.tpl === 'tetra' && q.a === 'P' && q.b === 'C') geometry = R`PA=PB=\frac a2,\quad PC=PD=\sqrt{a^2-(a/2)^2}=\frac{\sqrt3a}{2}=\ell\qquad ` + geometry;
    const steps = [{ id: 'pathGeometry', title: L('建立路径参数与几何距离', 'Define the path parameter and distances'),
      text: L('令 s 为起点到 X 的距离与路径总长之比。先用已知坐标或几何关系确定路径长度和方向；后续所有场强和电势都在同一个 X(s) 处计算。长度采用题目的单位。', 'Let s be the fraction of the path from the start to X. Determine the path length and direction from the known geometry. All subsequent fields and potentials are evaluated at the same X(s), in the problem’s units.'), tex: geometry }];
    if (!model.analytic) {
      steps.push({ id: 'pathDistances', title: L('用勾股关系逐项求场源到 X 的距离', 'Find each source-to-X distance by Pythagoras'),
        text: L('H_i 是场源 S_i 在路径直线上的垂足；h_i 是从路径起点到 H_i 的有向距离，b_i 是场源到路径所在直线的垂直距离。图中标出 r_i；由直角三角形得到下式。即使两个电势贡献抵消，距离和电荷仍先逐项列出。', 'H_i is the perpendicular foot of source S_i on the path line. Here h_i is the signed distance from the path start to H_i, and b_i is its perpendicular distance to the path line. The labelled r_i is the hypotenuse. List all sources before cancelling any potentials.'),
        tex: R`h_i=(\vec S_i-\vec r_{${q.a}})\cdot\hat t,\quad b_i^2=|\vec S_i-\vec r_{${q.a}}|^2-h_i^2\qquad r_i(s)=\sqrt{(s\ell-h_i)^2+b_i^2}`,
        rows: [[L('场源', 'Source'), 'q_i', 'h_i', 'b_i²', 'r_i(s)²'], ...p.sources.map(x => [x.label, C(x.q), C(x.h), C(x.b2), '(s·' + C(p.length) + '−(' + C(x.h) + '))²+' + C(x.b2)])] });
    } else steps.push({ id: 'pathDistances', title: L('确定路径经过的区域与分段位置', 'Determine regions and boundary crossings'),
      text: L('先将 X(s) 代入到球心或轴线的距离。跨越球面或平面时按各区域公式分别计算；边界处用单侧导数，不能将场强跳变误当作驻点。', 'Substitute X(s) into the distance from the origin or axis. Use the formula for each region, with one-sided derivatives at interfaces; a field jump is not a stationary point.'),
      tex: R`r(s)=\sqrt{x(s)^2+y(s)^2+z(s)^2},\quad\rho(s)=\sqrt{x(s)^2+y(s)^2}`,
      rows: [[L('位置 s', 'Position s'), L('区域或边界', 'Region or boundary')], ...p.boundaries.map(s => [C(s), p.at(s).region || L('端点', 'Endpoint')])] });
    let potential = model.analytic ? X.pathLaw(pb) : R`\varphi(s)=\sum_i\frac{kq_i}{r_i(s)}=\sum_i\frac{kq_i}{\sqrt{(s\ell-h_i)^2+b_i^2}}`;
    if (p.special?.kind === 'median') potential += R`\qquad\varphi(s)=\frac{kq}{\ell}\left(\frac1{s+2}+\frac2{\sqrt{(s-1)^2+3}}\right),\quad q=${F(p.special.q)}`;
    if (p.special?.kind === 'tetra') potential += R`\qquad\varphi(s)=\frac{kq}{\ell}\left(\frac1{\sqrt{(s-1/3)^2+8/9}}-\frac1{1-s}\right),\quad q=${F(p.special.q)}`;
    const cancelled = p.groups.filter(g => close(g.q, 0)).map(g => g.labels.join(', '));
    steps.push({ id: 'pathPotential', title: L('先写出电势函数，再代入计算', 'Derive the potential function before evaluating it'),
      text: L('将上一步的距离代入电势公式，保留电荷正负号；计算采用归一化单位 k=1。', 'Substitute the derived distances into the potential law, retaining charge signs. Numerical values use normalized units k=1.') + (cancelled.length ? L('等距且总电荷为零的组相互抵消：', 'Equal-distance groups with zero total charge cancel: ') + cancelled.join('; ') + '。' : ''),
      tex: potential + R`\qquad s=${F(s)},\quad\varphi(X)\approx ${EL.U.fmt(f.V, 6)}`,
      rows: model.analytic ? null : [[L('场源', 'Source'), 'r_i(s)', 'kq_i/r_i(s)'], ...p.sources.map(x => { const r = V.dist(point, x.p); return [x.label, C(r), C(x.q / r)]; })] });
    let differential = R`\frac{d\varphi}{ds}=\nabla\varphi\cdot(\vec r_{${q.b}}-\vec r_{${q.a}})=-\ell\,\vec E\cdot\hat t=-\ell E_{\parallel}`;
    if (!model.analytic) differential += R`\qquad E_{\parallel}=\sum_i\frac{kq_i(s\ell-h_i)}{r_i(s)^3},\quad\frac{d\varphi}{ds}=-k\ell\sum_i\frac{q_i(s\ell-h_i)}{[(s\ell-h_i)^2+b_i^2]^{3/2}}`;
    if (p.special?.kind === 'median') differential += R`\qquad\frac{\ell}{kq}\frac{d\varphi}{ds}=\frac{2(1-s)}{[(1-s)^2+3]^{3/2}}-\frac1{(s+2)^2}`;
    if (p.special?.kind === 'tetra') differential += R`\qquad\frac{\ell}{kq}\frac{d\varphi}{ds}=-\frac{s-1/3}{[(s-1/3)^2+8/9]^{3/2}}-\frac1{(1-s)^2}`;
    steps.push({ id: 'pathDerivative', title: L('由距离求沿路径分量及电势导数', 'Calculate the tangential field and potential derivative'),
      text: L('先计算各分场强在路径方向上的投影，再求和。这里导数是对无量纲参数 s 求导，因此要乘路径长度 ℓ；夹角只作为计算后的核对读数。', 'Project each component field onto the path, then add. Differentiation with respect to the dimensionless s introduces the path length ℓ. The angle is a check after the calculation.'),
      tex: differential + R`\qquad s=${F(s)},\quad E_{\parallel}\approx ${EL.U.fmt(-derivative / p.length, 6)},\quad\frac{d\varphi}{ds}\approx ${EL.U.fmt(derivative, 6)}`,
      rows: model.analytic ? null : [[L('场源', 'Source'), 'sℓ−h_i', 'E_i,∥'], ...p.sources.map(x => { const r = V.dist(point, x.p); return [x.label, C(s * p.length - x.h), C(x.q * (s * p.length - x.h) / r ** 3)]; })] });
    let critical = L('令上一步的导数为零。在连续区间内对变号区间用二分法求根，下面给出数值区间与残差；分界面另作分段。通用自定义构型的根为数值结果。', 'Set the derivative to zero. On continuous intervals, bisect each sign-change bracket. Brackets and residuals are listed below; interfaces are handled separately. Roots of general authored configurations are numerical results.');
    let criticalTex = R`\frac{d\varphi}{ds}=0\quad\Leftrightarrow\quad E_{\parallel}=0`;
    if (p.special?.kind === 'median') {
      critical += L('本题可进一步消去根号：在 0<s<1 内两边均为正，平方不引入符号歧义。所得多项式 f 严格凸，f(0)=32、f(1)=−9，因而区间内只有一个根。', 'Here both sides are positive for 0<s<1, so squaring preserves the equation. The resulting polynomial f is strictly convex, with f(0)=32 and f(1)=−9; it has exactly one root in this interval.');
      criticalTex += R`\qquad\frac{2(1-s)}{[(1-s)^2+3]^{3/2}}=\frac1{(s+2)^2}\qquad s=0\quad\text{or}\quad f(s)=s^5+10s^4+4s^3+8s^2-64s+32=0\qquad f''(s)=20s^3+120s^2+24s+16>0`;
    }
    if (p.special?.kind === 'tetra') {
      critical += L('本题不需要猜测角度：s≥1/3 时上式两项均非正；s<1/3 时正项的上界小于负项的绝对值，所以括号中的导数因子始终为负。电荷整体反号时结论反向。', 'No angle estimate is needed: for s≥1/3 both terms are nonpositive. For s<1/3 the positive term is smaller than the negative term in magnitude, so the derivative factor stays negative. Reversing all charges reverses the trend.');
      criticalTex += R`\qquad0\le s<\frac13:\quad\frac{1/3-s}{[(s-1/3)^2+8/9]^{3/2}}\le\frac{1/3}{(8/9)^{3/2}}<1\le\frac1{(1-s)^2}`;
    }
    steps.push({ id: 'pathCritical', title: L('解驻点方程，并检查分界点', 'Solve for stationary points and check boundaries'), text: critical, tex: criticalTex,
      rows: [[L('左界', 'Left bracket'), L('右界', 'Right bracket'), 's_*', '|dφ/ds|'], ...(p.brackets.length ? p.brackets.map(b => [EL.U.fmt(b.lo, 6), EL.U.fmt(b.hi, 6), EL.U.fmt(b.s, 7), EL.U.fmt(Math.abs(p.slope(b.s)), 3)]) : [[L('无内部变号根', 'No interior sign-change root'), '—', '—', '—']])] });
    steps.push({ id: 'pathConclusion', title: L('由导数符号得到分段变化，再核对曲线', 'Infer the trend from derivative signs, then check the curve'),
      text: L('dφ/ds>0 表示电势升高，dφ/ds<0 表示降低。下表在驻点和区域边界之间列出计算核对值；结合前面的几何与导数分析得到：', 'A positive derivative means increasing potential; a negative derivative means decreasing potential. The table checks values between stationary points and boundaries. Combined with the preceding derivation, the result is: ') + answer.answer + L('。', '. ') + L('端点若是点电荷位置，电势取发散极限，不给该点伪造有限读数。', 'At a point-charge endpoint use the divergent limit, not a finite endpoint reading.'),
      rows: [[L('参数区间', 'Parameter interval'), L('核对 s', 'Check s'), 'dφ/ds', L('变化', 'Trend')], ...p.intervals.map(i => [EL.U.fmt(i.a, 6) + ' < s < ' + EL.U.fmt(i.b, 6), C(i.s), C(i.derivative), Math.abs(i.derivative) < 1e-10 ? L('不变', 'Constant') : i.derivative > 0 ? L('升高', 'Increasing') : L('降低', 'Decreasing')])] });
    return steps;
  };

  const pairRows = sources => {
    const groups = [];
    for (let i = 0; i < sources.length; i++) for (let j = i + 1; j < sources.length; j++) {
      const a = sources[i], b = sources[j], r = V.dist(a.p, b.p), value = a.q * b.q / r;
      const g = groups.find(g => close(g.r, r) && close(g.value, value));
      if (g) { g.count++; g.total += value; } else groups.push({ r, value, count: 1, total: value });
    }
    return [[L('距离 r_ij', 'Distance r_ij'), L('对数', 'Pairs'), L('每对能量', 'Energy per pair'), L('该组小计', 'Subtotal')], ...groups.map(g => [C(g.r), g.count, C(g.value), C(g.total)])];
  };
  X.calculationSteps = function (pb, model, answer) {
    const q = answer.q, result = { title: L('代入结果并作出判断', 'Evaluate and conclude'), text: L('由前面的几何关系与计算得到：', 'The preceding geometry and calculation give: ') + answer.answer, tex: null };
    if (answer.focus === 'pairs') {
      const n = model.sources.length, disk = pb.disk;
      const steps = [{ title: L('先确定电荷位置、弦长与不重复的配对', 'Determine positions, chord lengths and distinct pairs'),
        text: L('等分圆周的圆心角为 2mπ/n，由等腰三角形的一半得到弦长。中心电荷到圆周电荷的距离为 R。只计 i<j，每对一次。', 'The central angle is 2mπ/n. Bisecting the isosceles triangle gives the chord length. A central charge is distance R from each ring charge. Count only i<j.'),
        tex: R`n=${disk.center ? n - 1 : n},\quad r_m=2R\sin\frac{m\pi}{n},\quad R=${F(disk.R)}\qquad N_{pairs}=\frac{N(N-1)}2=\frac{${n}(${n}-1)}2=${n * (n - 1) / 2}` }];
      if (q.t === 'Ucmp') {
        for (const center of [false, true]) {
          const variant = { ...pb, disk: { ...disk, center, qc: disk.q } }, sources = X.diskSources(variant.disk), energy = X.diskEnergy(variant.disk);
          steps.push({ title: center ? L('计算一个在圆心的构型', 'Calculate the configuration with one central charge') : L('计算全部在圆周的构型', 'Calculate the all-ring configuration'),
            text: L('画板同步显示本步骤构型。按相同距离分组，逐组计算配对能量，再相加。', 'The board shows this configuration. Group equal-distance pairs, evaluate each subtotal, and add.'),
            tex: R`U=\sum_{i<j}\frac{kq_iq_j}{r_{ij}}=${F(energy.U)}`, rows: pairRows(sources), display: variant });
        }
      } else if (q.t === 'U') steps.push({ title: L('按弦长分组并逐项求能量', 'Group by chord length and calculate the energy'),
        text: L('将各组对数乘以每对能量，再将小计相加。数值采用 k=1 的归一化单位。', 'Multiply each pair energy by its group count, then add the subtotals. Values use normalized units k=1.'),
        tex: R`U=\sum_{i<j}\frac{kq_iq_j}{r_{ij}}=${F(answer.value)}`, rows: pairRows(model.sources) });
      steps.push(result); return steps;
    }
    const names = [...new Set([q.at, q.a, q.b].filter(n => model.pts[n]?.p))];
    const points = names.map(n => ({ n, p: model.pts[n].p })).concat((answer.probePts || []).map((p, i) => ({ n: 'P' + (i + 1), p })));
    const geometry = { title: L('先确定观察位置与几何距离', 'Determine the observation positions and distances'),
      text: L('先计算距离，确定公式适用的区域，再代入物理量。坐标与长度按题目单位列出。', 'Calculate distances and identify the region before substituting physical quantities. Coordinates and lengths use the problem’s units.'),
      rows: [[L('观察点', 'Point'), '(x,y,z)', model.analytic ? 'r' : L('场源', 'Source'), model.analytic ? 'ρ' : 'r_i'], ...points.flatMap(({ n, p }) => {
        return model.analytic ? [[n, p.map(C).join(', '), C(V.len(p)), C(Math.hypot(p[0], p[1]))]] : model.sources.map(source => [n, p.map(C).join(', '), source.label, C(V.dist(p, source.p))]);
      })] };
    const steps = [geometry];
    if (!model.analytic) for (const n of names) {
      const p = model.pts[n].p, terms = model.sources.map(x => ({ ...x, r: V.dist(p, x.p) }));
      steps.push({ title: L('逐项计算 ', 'Calculate individual contributions at ') + n,
        text: L('电势是标量，代数相加时保留场源电荷的正负号。表中普通小数为近似值，计算使用未舍入值。', 'Potential is a scalar: retain charge signs when adding. Decimal entries are rounded; calculations use unrounded values.'),
        rows: [[L('场源', 'Source'), 'q_i', 'r_i', 'kq_i/r_i'], ...terms.map(x => [x.label, C(x.q), C(x.r), C(x.q / x.r)])],
        tex: R`\varphi_{${n}}=\sum_i\frac{kq_i}{r_i}=${F(model.field(p).V)}` });
    }
    for (const step of X.explain(answer)) steps.push({ ...step, title: L('代入公式并计算', 'Substitute and calculate'), text: step.t });
    if (!steps[steps.length - 1].text?.includes(answer.answer)) steps.push(result);
    return steps;
  };
})(window.EL);
