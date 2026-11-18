'use strict';
// Calculation steps are shared by the guide, complete solution and authored problems.
(function (EL) {
  const X = EL.EX, V = EL.V, VA = EL.VA, R = String.raw;
  const en = false, L = (zh, english) => en ? english : zh;
  const F = VA.texV, C = x => typeof x !== 'number' || !Number.isFinite(x) ? VA.cell(x) : Number.isInteger(x) ? String(x) : '≈' + EL.U.fmt(x, 4), vec = p => '(' + p.map(F).join(',') + ')';
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
      const startSource = active.find(g => close(g.h / length, 0) && close(g.b2 / length ** 2, 0));
      const endPair = active.find(g => close(g.h / length, 1) && close(g.b2 / length ** 2, 1 / 3));
      const third = active.find(g => close(g.h / length, 2 / 3) && close(g.b2 / length ** 2, 8 / 9));
      if (startSource && endPair && close(endPair.q, 2 * startSource.q)) special = { kind: 'triangleMedianFull', q: startSource.q };
      if (third && endPair && close(endPair.q, 2 * third.q)) special = { kind: 'trianglePN', q: third.q };
    }
    return { a, b, d, t, length, sources, groups, active, at, slope, roots, brackets, boundaries, intervals, special };
  };

  X.pathLaw = function (pb) {
    switch (pb.sub) {
      case 'point': return R`\varphi(s)=\frac{kq}{r(s)}`;
      case 'infinite-line': return R`\varphi(s)=-2k\lambda\ln\frac{\rho(s)}{\rho_0}`;
      case 'infinite-plane': return R`\varphi(s)=-2\pi k\sigma|z(s)|`;
      case 'conductor-sphere': return R`r(s)\le a:\quad\varphi=\frac{kq}{a}\qquad r(s)>a:\quad\varphi=\frac{kq}{r(s)}`;
      case 'dielectric-interface': return R`z(s)\ge0:\quad\varphi=-\frac{4\pi kDz(s)}{\varepsilon_1}\qquad z(s)<0:\quad\varphi=-\frac{4\pi kDz(s)}{\varepsilon_2}`;
      case 'dielectric-sphere': return R`C=\frac{3\varepsilon_{out}}{\varepsilon_{in}+2\varepsilon_{out}},\quad\beta=\frac{\varepsilon_{in}-\varepsilon_{out}}{\varepsilon_{in}+2\varepsilon_{out}}\qquad r(s)<a:\quad\varphi=-CE_0z(s)\qquad r(s)\ge a:\quad\varphi=-E_0z(s)+\frac{\beta E_0a^3z(s)}{r(s)^3}`;
    }
  };

  X.pathSteps = function (pb, model, answer, s) {
    const p = answer.pathProof || (answer.pathProof = X.pathAnalysis(pb, model, answer.q));
    const unitL = model.units?.L || 'L', unitE = model.units?.E || 'kQ/L²', unitV = model.units?.V || 'kQ/L';
    const q = answer.q, f = p.at(s), point = V.lerp(p.a, p.b, s), derivative = p.slope(s);
    const domain = model.sources.some(x => V.dist(x.p, p.a) < 1e-9) ? R`0<s\le1` : model.sources.some(x => V.dist(x.p, p.b) < 1e-9) ? R`0\le s<1` : R`0\le s\le1`;
    let geometry = R`\ell=|${q.a}${q.b}|=${F(p.length)},\quad s=\frac{|${q.a}X|}{\ell},\quad${domain}\qquad\vec X(s)=${vec(p.a)}+s${vec(p.d)}\qquad\hat t=\frac{\vec r_{${q.b}}-\vec r_{${q.a}}}{\ell}`;
    if (p.special?.kind === 'median' && pb.tpl === 'tri' && q.a === 'G' && q.b === 'M') geometry = R`h=\sqrt{a^2-(a/2)^2}=\frac{\sqrt3a}{2},\quad\ell=GM=\frac h3=\frac{\sqrt3a}{6}\qquad ` + geometry;
    if (p.special?.kind === 'tetra' && pb.tpl === 'tetra' && q.a === 'P' && q.b === 'C') geometry = R`PA=PB=\frac a2,\quad PC=PD=\sqrt{a^2-(a/2)^2}=\frac{\sqrt3a}{2}=\ell\qquad ` + geometry;
    if (p.special?.kind === 'triangleMedianFull') geometry = R`AM=\frac{\sqrt3a}{2}=\ell,\quad s=\frac{AX}{AM},\quad G:\ s=\frac23,\quad 0<s\le1\qquad ` + geometry;
    if (p.special?.kind === 'trianglePN') geometry = R`AN=BN,\quad PN=\frac{\sqrt3a}{2}=\ell,\quad AN=BN=\frac a2,\quad CN=\frac{\sqrt3a}{2}\qquad ` + geometry;
    const steps = [{ id: 'pathGeometry', title: L('建立路径参数与几何距离', 'Define the path parameter and distances'),
      text: L('令 s 为起点到 X 的距离与路径总长之比。先用已知坐标或几何关系确定路径长度和方向；后续所有场强和电势都在同一个 X(s) 处计算。长度采用题目的单位。', 'Let s be the fraction of the path from the start to X. Determine the path length and direction from the known geometry. All subsequent fields and potentials are evaluated at the same X(s), in the problem’s units.'), tex: geometry }];
    if (!model.analytic) {
      steps.push({ id: 'pathDistances', title: L('用勾股关系逐项求场源到 X 的距离', 'Find each source-to-X distance by Pythagoras'),
        text: L('H_i 是场源 S_i 在路径直线上的垂足；h_i 是从路径起点到 H_i 的有向距离，b_i 是场源到路径所在直线的垂直距离。图中标出 r_i；由直角三角形得到下式。即使两个电势贡献抵消，距离和电荷仍先逐项列出。', 'H_i is the perpendicular foot of source S_i on the path line. Here h_i is the signed distance from the path start to H_i, and b_i is its perpendicular distance to the path line. The labelled r_i is the hypotenuse. List all sources before cancelling any potentials.'),
        tex: R`h_i=(\vec S_i-\vec r_{${q.a}})\cdot\hat t,\quad b_i^2=|\vec S_i-\vec r_{${q.a}}|^2-h_i^2\qquad r_i(s)=\sqrt{(s\ell-h_i)^2+b_i^2}`,
        rows: [[L('场源', 'Source'), 'q_i/Q', 'h_i/' + unitL, 'b_i²/' + unitL + '²', 'r_i(s)²/' + unitL + '²'], ...p.sources.map(x => [x.label, C(x.q), C(x.h), C(x.b2), '(s·(' + VA.cell(p.length) + ')−(' + VA.cell(x.h) + '))²+' + VA.cell(x.b2)])] });
    } else steps.push({ id: 'pathDistances', title: L('确定路径经过的区域与分段位置', 'Determine regions and boundary crossings'),
      text: L('先将 X(s) 代入到球心或轴线的距离。跨越球面或平面时按各区域公式分别计算；边界处用单侧导数，不能将场强跳变误当作驻点。', 'Substitute X(s) into the distance from the origin or axis. Use the formula for each region, with one-sided derivatives at interfaces; a field jump is not a stationary point.'),
      tex: R`r(s)=\sqrt{x(s)^2+y(s)^2+z(s)^2},\quad\rho(s)=\sqrt{x(s)^2+y(s)^2}`,
      rows: [[L('位置 s', 'Position s'), L('区域或边界', 'Region or boundary')], ...p.boundaries.map(s => [C(s), p.at(s).region || L('端点', 'Endpoint')])] });
    let potential = model.analytic ? X.pathLaw(pb) : R`\varphi(s)=\sum_i\frac{kq_i}{r_i(s)}=\sum_i\frac{kq_i}{\sqrt{(s\ell-h_i)^2+b_i^2}}`;
    if (p.special?.kind === 'median') potential += R`\qquad\varphi(s)=\frac{kq}{\ell}\left(\frac1{s+2}+\frac2{\sqrt{(s-1)^2+3}}\right),\quad \frac qQ${VA.valueEq(p.special.q)}`;
    if (p.special?.kind === 'tetra') potential += R`\qquad\varphi(s)=\frac{kq}{\ell}\left(\frac1{\sqrt{(s-1/3)^2+8/9}}-\frac1{1-s}\right),\quad \frac qQ${VA.valueEq(p.special.q)}`;
    if (p.special?.kind === 'triangleMedianFull') potential += R`\qquad\varphi(s)=\frac{kq}{\ell}\left(\frac1s+\frac2{\sqrt{(1-s)^2+1/3}}\right),\quad \frac qQ${VA.valueEq(p.special.q)},\quad s\to0^+:\quad\varphi\to+\infty\ (q>0)`;
    if (p.special?.kind === 'trianglePN') potential += R`\qquad\varphi(s)=\frac{kq}{\ell}\left(\frac2{\sqrt{(1-s)^2+1/3}}+\frac1{\sqrt{(s-2/3)^2+8/9}}\right),\quad \frac qQ${VA.valueEq(p.special.q)}`;
    const cancelled = p.groups.filter(g => close(g.q, 0)).map(g => g.labels.join(', '));
    steps.push({ id: 'pathPotential', title: L('先写出电势函数，再代入计算', 'Derive the potential function before evaluating it'),
      text: L('将上一步的距离代入电势公式，保留电荷正负号；计算采用归一化单位 k=1。', 'Substitute the derived distances into the potential law, retaining charge signs. Numerical values use normalized units k=1.') + (cancelled.length ? L('等距且总电荷为零的组相互抵消：', 'Equal-distance groups with zero total charge cancel: ') + cancelled.join('; ') + '。' : ''),
      tex: potential + R`\qquad s=${F(s)},\quad\varphi(X)\approx ${EL.U.fmt(f.V, 6)}`,
      rows: model.analytic ? null : [[L('场源', 'Source'), 'r_i(s)/' + unitL, '(kq_i/r_i)/(' + unitV + ')'], ...p.sources.map(x => { const r = V.dist(point, x.p); return [x.label, C(r), C(x.q / r)]; })] });
    let differential = R`\frac{d\varphi}{ds}=\nabla\varphi\cdot(\vec r_{${q.b}}-\vec r_{${q.a}})=-\ell\,\vec E\cdot\hat t=-\ell E_{\parallel}`;
    if (!model.analytic) differential += R`\qquad E_{\parallel}=\sum_i\frac{kq_i(s\ell-h_i)}{r_i(s)^3},\quad\frac{d\varphi}{ds}=-k\ell\sum_i\frac{q_i(s\ell-h_i)}{[(s\ell-h_i)^2+b_i^2]^{3/2}}`;
    if (p.special?.kind === 'median') differential += R`\qquad\frac{\ell}{kq}\frac{d\varphi}{ds}=\frac{2(1-s)}{[(1-s)^2+3]^{3/2}}-\frac1{(s+2)^2}`;
    if (p.special?.kind === 'tetra') differential += R`\qquad\frac{\ell}{kq}\frac{d\varphi}{ds}=-\frac{s-1/3}{[(s-1/3)^2+8/9]^{3/2}}-\frac1{(1-s)^2}`;
    if (p.special?.kind === 'triangleMedianFull') differential += R`\qquad\frac{\ell}{kq}\frac{d\varphi}{ds}=-\frac1{s^2}+\frac{2(1-s)}{[(1-s)^2+1/3]^{3/2}}`;
    if (p.special?.kind === 'trianglePN') differential += R`\qquad\frac{\ell}{kq}\frac{d\varphi}{ds}=\frac{2(1-s)}{[(1-s)^2+1/3]^{3/2}}-\frac{s-2/3}{[(s-2/3)^2+8/9]^{3/2}}`;
    steps.push({ id: 'pathDerivative', title: L('由距离求沿路径分量及电势导数', 'Calculate the tangential field and potential derivative'),
      text: L('先计算各分场强在路径方向上的投影，再求和。这里导数是对无量纲参数 s 求导，因此要乘路径长度 ℓ；夹角只作为计算后的核对读数。', 'Project each component field onto the path, then add. Differentiation with respect to the dimensionless s introduces the path length ℓ. The angle is a check after the calculation.'),
      tex: differential + R`\qquad s=${F(s)},\quad E_{\parallel}\approx ${EL.U.fmt(-derivative / p.length, 6)},\quad\frac{d\varphi}{ds}\approx ${EL.U.fmt(derivative, 6)}`,
      rows: model.analytic ? null : [[L('场源', 'Source'), '(sℓ−h_i)/' + unitL, 'E_i,∥/(' + unitE + ')'], ...p.sources.map(x => { const r = V.dist(point, x.p); return [x.label, C(s * p.length - x.h), C(x.q * (s * p.length - x.h) / r ** 3)]; })] });
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
    if (p.special?.kind === 'triangleMedianFull') {
      critical += L('完整中线包含中心 G 和 G→M 段内的另一个驻点。把 t=GX/GM=3s−2 代入原中线方程，可得 s=2/3 与 s≈0.856479；按下表分别检查三个区间，不能把整段误判为先升后降。A 处为正点源奇点，s=0 不属于电势定义域。', 'The full median contains the center G and another stationary point between G and M. Substituting t=GX/GM=3s−2 gives s=2/3 and s≈0.856479. Check all three intervals in the table. The positive point source at A excludes s=0 from the potential domain.');
      criticalTex += R`\qquad s_G=\frac23,\quad t=3s-2,\quad s_*=\frac{2+0.5694367096}{3}\approx0.8564789032`;
    }
    if (p.special?.kind === 'trianglePN') critical += L('N 是 AB 中点，两电荷的距离贡献相同，先合并 A、B 两项，再保留 C 项。求导后在 0<s<1 内寻找变号根，并检查其两侧导数；此处零的是沿 PN 的分量，不应仅由曲线极值断言三维合场强为零。', 'N is the midpoint of AB, so combine the equal-distance A and B terms before adding C. Solve for the derivative sign change in 0<s<1 and check both sides. A stationary potential here sets the PN component to zero; it does not by itself prove that the full three-dimensional field vanishes.');
    if (pb.tpl === 'tri' && q.a === 'P' && q.b === 'G' && p.active.length === 1 &&
        p.sources.length === 3 && p.sources.every(x => x.q > 0 && close(x.q, p.sources[0].q))) {
      critical = L('PG 垂直于等边三角形平面，G 是三角形中心。沿 P→G，动点到 A、B、C 的距离始终相等且逐渐减小，因此三个正电荷的电势贡献同时增大。由下式可知开区间内导数为正，电势一直升高；G 是这条路径的最大值端点，G 处合场强为零，曲线在此变平。', 'PG is perpendicular to the triangle plane and G is its center. Along P to G, the equal distances to A, B and C decrease, so all three positive potential contributions increase. The derivative is positive in the open interval: potential increases throughout. G is the maximum endpoint of this path, where the total electric field and the terminal slope are zero.');
      criticalTex = R`PG=\sqrt{\frac23}a,\quad r(s)=\sqrt{(PG)^2(1-s)^2+\frac{a^2}{3}}\qquad\varphi(s)=\frac{3kQ}{r(s)},\quad\frac{d\varphi}{ds}=\frac{3kQ\,(PG)^2(1-s)}{r(s)^3}>0\quad(0\le s<1)\qquad\varphi_P=\frac{3kQ}{a},\quad\varphi_G=\frac{3\sqrt3kQ}{a}`;
    }
    steps.push({ id: 'pathCritical', title: L('解驻点方程，并检查分界点', 'Solve for stationary points and check boundaries'), text: critical, tex: criticalTex,
      rows: [[L('左界', 'Left bracket'), L('右界', 'Right bracket'), 's_*', '|dφ/ds|'], ...(p.brackets.length ? p.brackets.map(b => [EL.U.fmt(b.lo, 6), EL.U.fmt(b.hi, 6), EL.U.fmt(b.s, 7), EL.U.fmt(Math.abs(p.slope(b.s)), 3)]) : [[L('无内部变号根', 'No interior sign-change root'), '—', '—', '—']])] });
    steps.push({ id: 'pathConclusion', title: L('由导数符号得到分段变化，再核对曲线', 'Infer the trend from derivative signs, then check the curve'),
      text: L('dφ/ds>0 表示电势升高，dφ/ds<0 表示降低。下表在驻点和区域边界之间列出计算核对值；结合前面的几何与导数分析得到：', 'A positive derivative means increasing potential; a negative derivative means decreasing potential. The table checks values between stationary points and boundaries. Combined with the preceding derivation, the result is: ') + answer.answer + L('。', '. ') + L('端点若是点电荷位置，电势取发散极限，不给该点伪造有限读数。', 'At a point-charge endpoint use the divergent limit, not a finite endpoint reading.'),
      rows: [[L('参数区间', 'Parameter interval'), L('核对 s', 'Check s'), 'dφ/ds', L('变化', 'Trend')], ...p.intervals.map(i => [EL.U.fmt(i.a, 6) + ' < s < ' + EL.U.fmt(i.b, 6), C(i.s), C(i.derivative), Math.abs(i.derivative) < 1e-10 ? L('不变', 'Constant') : i.derivative > 0 ? L('升高', 'Increasing') : L('降低', 'Decreasing')])] });
    const geometryStep = steps.find(st => st.id === 'pathGeometry');
    geometryStep.advanced = { text: geometryStep.text, tex: geometryStep.tex };
    geometryStep.text = L('把路径起点记为 s=0，终点记为 s=1；s 是走过的路程占全程的比例，没有单位。拖动动点或播放动画，同时观察模型与曲线。', 'Set s=0 at the start and s=1 at the end. The parameter s is the fraction of the path travelled and has no units. Move the point or play the animation while comparing the model with the curve.');
    geometryStep.tex = R`\ell=|${q.a}${q.b}|${VA.valueEq(p.length, unitL)},\qquad s=\frac{|${q.a}X|}{\ell},\qquad ${domain}`;
    const distanceStep = steps.find(st => st.id === 'pathDistances');
    distanceStep.text += L('表中长度已除以题目的长度单位，电荷已除以 Q；带 ≈ 的数为近似值。', 'Table lengths are divided by the problem’s length unit and charges by Q. Entries marked ≈ are approximate.');
    const potentialStep = steps.find(st => st.id === 'pathPotential');
    potentialStep.advanced = { text: potentialStep.text, tex: potentialStep.tex, rows: potentialStep.rows };
    potentialStep.text = L('电势是标量：分别求动点到各电荷的距离，将 kq/r 的贡献带符号相加。曲线横轴为路径比例 s，纵轴为电势；向右上方表示升高，向右下方表示降低。', 'Potential is a scalar: find the distance to each charge and add the signed kq/r contributions. The horizontal axis is the path fraction s and the vertical axis is potential. An upward slope means increasing potential; a downward slope means decreasing potential.');
    potentialStep.tex = potential;
    potentialStep.rows = null;
    const derivativeStep = steps.find(st => st.id === 'pathDerivative');
    derivativeStep.advanced = { text: derivativeStep.text, tex: derivativeStep.tex, rows: derivativeStep.rows };
    derivativeStep.title = L('用沿路径的场强判断升降', 'Use the field along the path to predict the trend');
    derivativeStep.text = L('E∥ 是合场强在前进方向上的分量。顺着电场分量前进，电势降低；逆着它前进，电势升高。分量为零时曲线暂时变平，再检查两侧的升降，才能判断是否为极值。', 'E∥ is the component of the total field in the direction of travel. Potential falls when moving with that component and rises when moving against it. A zero component gives a horizontal tangent; check both sides before deciding whether it is an extremum.');
    derivativeStep.tex = R`E_{\parallel}>0:\ \varphi\text{${L('降低', 'falls')}}\qquad E_{\parallel}<0:\ \varphi\text{${L('升高', 'rises')}}\qquad E_{\parallel}=0:\ \text{${L('切线水平', 'horizontal tangent')}}`;
    derivativeStep.rows = null;
    const criticalStep = steps.find(st => st.id === 'pathCritical');
    criticalStep.advanced = { text: criticalStep.text, tex: criticalStep.tex, rows: criticalStep.rows };
    criticalStep.title = L('找出曲线变平的位置', 'Locate the horizontal tangents');
    criticalStep.text = L('观察曲线和沿路径场强，记录曲线变平的位置。该处 E∥=0，并不一定表示三维合场强为零。再比较这些位置两侧的电势变化。', 'Compare the curve with the field along the path and record the horizontal tangents. Here E∥=0; the full three-dimensional field need not be zero. Compare the potential trend on both sides.');
    criticalStep.tex = R`E_{\parallel}=0`;
    criticalStep.rows = [[L('路径比例 s', 'Path fraction s'), L('位置说明', 'Location')], ...(p.roots.length ? p.roots.map(value => [Math.abs(value - 2 / 3) < 1e-8 && p.special?.kind === 'triangleMedianFull' ? '2/3' : C(value), Math.abs(value - 2 / 3) < 1e-8 && p.special?.kind === 'triangleMedianFull' ? L('三角形中心 G', 'Triangle center G') : L('曲线的水平切线位置', 'Horizontal tangent on the curve')]) : [[L('无内部变号驻点', 'No interior turning point'), L('同时检查端点与边界', 'Also check endpoints and boundaries')]])];
    if (p.special?.kind === 'triangleMedianFull') criticalStep.text = L('曲线在中心 G（s=2/3）及 G 到 M 之间的一个位置（s≈0.8565）变平。G 是三角形内的对称位置，合场强为零；另一个位置仅沿 AM 的场强分量为零。比较两侧曲线，即可判断分段变化。', 'The curve is horizontal at the center G (s=2/3) and once between G and M (s≈0.8565). Symmetry makes the total field zero at G. At the other location only the AM component is zero. Compare the curve on either side to identify each interval’s trend.');
    if (pb.tpl === 'tri' && q.a === 'P' && q.b === 'G' && p.active.length === 1 && p.sources.length === 3 && p.sources.every(x => x.q > 0 && close(x.q, p.sources[0].q))) {
      criticalStep.text = L('沿 P→G，动点到 A、B、C 的距离始终相等且不断减小，三个正电荷的电势贡献同时增大。电势一直升高，到 G 时曲线变平；G 是这段路径的最大值端点。', 'Along P to G, the equal distances to A, B and C decrease, so all three positive potential contributions increase. Potential rises throughout and the curve becomes horizontal at G, the maximum endpoint of this path.');
      criticalStep.rows = [[L('位置', 'Location'), L('曲线变化', 'Curve')], ['P→G', L('一直升高', 'Increases throughout')], ['G', L('最大值端点，切线水平', 'Maximum endpoint; horizontal tangent')]];
    }
    const conclusionStep = steps.find(st => st.id === 'pathConclusion');
    conclusionStep.advanced = { text: conclusionStep.text, rows: conclusionStep.rows };
    conclusionStep.text = L('按路径顺序，逐段比较电势曲线的升降，得到：', 'Read the intervals from start to end to obtain: ') + answer.answer + L('。若端点是点电荷所在位置，只讨论靠近它时的变化，不把该点当成有限电势。', '. A point-charge endpoint is a limiting position, not a finite potential value.');
    const bound = value => Math.abs(value - 2 / 3) < 1e-8 && p.special?.kind === 'triangleMedianFull' ? '2/3' : C(value);
    conclusionStep.rows = [[L('路径比例区间', 'Path fraction interval'), L('电势变化', 'Potential trend')], ...p.intervals.map(i => [bound(i.a) + ' < s < ' + bound(i.b), Math.abs(i.derivative) < 1e-10 ? L('不变', 'Constant') : i.derivative > 0 ? L('升高', 'Increasing') : L('降低', 'Decreasing')])];
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
  const pairTerms = sources => sources.flatMap((source, i) => sources.slice(i + 1).map(other => source.q * other.q / V.dist(source.p, other.p)));
  // Keep physical quantities in the main explanation and normalized substitutions in the disclosure.
  X.analyticSteps = function (pb, model, answer) {
    const q = answer.q, originals = answer.expl || [], unitE = 'kQ/L²', unitV = 'kQ/L', unitW = 'kQq/L';
    const names = [...new Set([q.at, q.a, q.b].filter(name => model.pts[name]?.p))];
    const potential = name => R`\varphi_{${name}}${VA.valueEq(model.field(model.pts[name].p).V, unitV)}`;
    return originals.map((step, i) => {
      let tex = step.tex, text = step.t;
      if (q.t === 'E' || q.t === 'Ezero' || q.t === 'angle' && i === 0) {
        const point = model.pts[q.at].p, field = model.field(point).E, magnitude = V.len(field), radius = V.len(point);
        const fieldPart = (step.tex || '').split(R`,\quad`).find(part => part.startsWith('E=') || part.startsWith('E_')), symbolic = fieldPart?.split('=')[1];
        tex = R`r${VA.valueEq(radius, 'L')}` + (pb.sp.a ? R`,\quad a${VA.valueEq(pb.sp.a, 'L')}` : '') + R`\qquad |\vec E|` + (symbolic && !/^[0-9-]/.test(symbolic) ? '=' + symbolic : '') + VA.valueEq(magnitude, unitE);
        if (i > 0 && q.t === 'E') text = L('场强的大小为 ', 'The field magnitude is ') + VA.txtV(magnitude) + ' ' + unitE + (answer.dir ? L('，方向', ', directed ') + answer.dir : '') + L('。', '.');
      } else if (q.t === 'V') {
        const symbolic = (step.tex || '').startsWith(R`\varphi=`) ? step.tex.split('=')[1] : null;
        tex = R`\varphi_{${q.at}}` + (symbolic && !/^[0-9-]/.test(symbolic) ? '=' + symbolic : '') + VA.valueEq(answer.value, unitV);
      } else if (q.t === 'W') tex = i === 0 ? names.map(potential).join(R`\qquad `) : R`W=q_0(\varphi_{${q.a}}-\varphi_{${q.b}})` + VA.valueEq(answer.value, unitW);
      else if (q.t === 'Vcmp') tex = i === 0 ? names.map(potential).join(R`\qquad `) : null;
      else if (q.t === 'angle') tex = R`\alpha` + VA.valueEq(answer.value) + R`^\circ`;
      else if (q.t === 'bc' && tex) tex = tex.replace(/=([+-]?[0-9]+[.][0-9]+)$/, R`\approx $1`);
      return { t: text, tex, advanced: step.tex ? { text: L('以下保留数值代入核对。长度均除以 L，电荷除以 Q，场强除以 kQ/L²，电势除以 kQ/L，功除以 kQq/L；式中数值采用 k=1。带小数的近似读数不作为精确结果。', 'The numerical substitutions below use lengths divided by L, charges by Q, field by kQ/L², potential by kQ/L and work by kQq/L, with k=1. Rounded decimal readings are not exact results.'), tex: step.tex.replace(/=([+-]?[0-9]+[.][0-9]+)(?=,|$)/g, R`\approx $1`) } : null };
    });
  };
  X.calculationSteps = function (pb, model, answer) {
    const q = answer.q, result = { title: L('代入结果并作出判断', 'Evaluate and conclude'), text: L('由前面的几何关系与计算得到：', 'The preceding geometry and calculation give: ') + answer.answer, tex: null };
    if (answer.focus === 'pairs') {
      const n = model.sources.length, disk = pb.disk;
      const steps = [{ title: L('先确定电荷位置、弦长与不重复的配对', 'Determine positions, chord lengths and distinct pairs'),
        text: L('等分圆周的圆心角为 2mπ/n，由等腰三角形的一半得到弦长。中心电荷到圆周电荷的距离为 R。只计 i<j，每对一次。', 'The central angle is 2mπ/n. Bisecting the isosceles triangle gives the chord length. A central charge is distance R from each ring charge. Count only i<j.'),
        tex: R`n=${disk.center ? n - 1 : n},\quad r_m=2R\sin\frac{m\pi}{n},\quad R${VA.valueEq(disk.R, model.units.L)}\qquad N_{pairs}=\frac{N(N-1)}2=\frac{${n}(${n}-1)}2=${n * (n - 1) / 2}` }];
      if (q.t === 'Ucmp') {
        for (const center of [false, true]) {
          const variant = { ...pb, disk: { ...disk, center, qc: disk.q } }, sources = X.diskSources(variant.disk), energy = X.diskEnergy(variant.disk);
          steps.push({ title: center ? L('计算一个在圆心的构型', 'Calculate the configuration with one central charge') : L('计算全部在圆周的构型', 'Calculate the all-ring configuration'),
            text: L('画板同步显示本步骤构型。按相同距离分组，逐组计算配对能量，再相加。', 'The board shows this configuration. Group equal-distance pairs, evaluate each subtotal, and add.'),
            tex: R`U=\sum_{i<j}\frac{kq_iq_j}{r_{ij}}${VA.valueEq(energy.U, model.units.U, pairTerms(sources))}`, rows: pairRows(sources).map((row, i) => i ? row : [row[0] + '/' + model.units.L, row[1], row[2] + '/(' + model.units.U + ')', row[3] + '/(' + model.units.U + ')']), display: variant });
        }
      } else if (q.t === 'U') steps.push({ title: L('按弦长分组并逐项求能量', 'Group by chord length and calculate the energy'),
        text: L('将各组对数乘以每对能量，再将小计相加。数值采用 k=1 的归一化单位。', 'Multiply each pair energy by its group count, then add the subtotals. Values use normalized units k=1.'),
        tex: R`U=\sum_{i<j}\frac{kq_iq_j}{r_{ij}}${VA.valueEq(answer.value, model.units.U, pairTerms(model.sources))}`, rows: pairRows(model.sources).map((row, i) => i ? row : [row[0] + '/' + model.units.L, row[1], row[2] + '/(' + model.units.U + ')', row[3] + '/(' + model.units.U + ')']) });
      steps.push(result); return steps;
    }
    const names = [...new Set([q.at, q.a, q.b].filter(n => model.pts[n]?.p))];
    const points = names.map(n => ({ n, p: model.pts[n].p })).concat((answer.probePts || []).map((p, i) => ({ n: 'P' + (i + 1), p })));
    const geometry = { title: L('先确定观察位置与几何距离', 'Determine the observation positions and distances'),
      text: L('先计算距离，确定公式适用的区域，再代入物理量。坐标与长度按题目单位列出。', 'Calculate distances and identify the region before substituting physical quantities. Coordinates and lengths use the problem’s units.'),
      rows: [[L('观察点', 'Point'), '(x,y,z)/' + (model.units.L || 'L'), model.analytic ? 'r/L' : L('场源', 'Source'), model.analytic ? 'ρ/L' : 'r_i/' + model.units.L], ...points.flatMap(({ n, p }) => {
        return model.analytic ? [[n, p.map(C).join(', '), C(V.len(p)), C(Math.hypot(p[0], p[1]))]] : model.sources.map(source => [n, p.map(C).join(', '), source.label, C(V.dist(p, source.p))]);
      })] };
    const steps = [geometry];
    if (!model.analytic) for (const n of names) {
      const p = model.pts[n].p, terms = model.sources.map(x => ({ ...x, r: V.dist(p, x.p) }));
      steps.push({ title: L('逐项计算 ', 'Calculate individual contributions at ') + n,
        text: L('电势是标量，代数相加时保留场源电荷的正负号。表中普通小数为近似值，计算使用未舍入值。', 'Potential is a scalar: retain charge signs when adding. Decimal entries are rounded; calculations use unrounded values.'),
        rows: [[L('场源', 'Source'), 'q_i/Q', 'r_i/' + (model.units?.L || 'L'), '(kq_i/r_i)/(' + (model.units?.V || 'kQ/L') + ')'], ...terms.map(x => [x.label, C(x.q), C(x.r), C(x.q / x.r)])],
        tex: R`\varphi_{${n}}=\sum_i\frac{kq_i}{r_i}${VA.valueEq(model.field(p).V, model.units.V, terms.map(x => x.q / x.r))}` });
    }
    for (const step of X.explain(answer)) steps.push({ ...step, title: L('代入公式并计算', 'Substitute and calculate'), text: step.t });
    if (!steps[steps.length - 1].text?.includes(answer.answer)) steps.push(result);
    return steps;
  };
})(window.EL);
