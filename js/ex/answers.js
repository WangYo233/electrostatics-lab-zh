'use strict';
// 例题模块：解析场模型（拓展 1）与圆盘电荷（拓展 2）的答案、干扰项与解析
// 解析场的 V、E 一律由实验室的 EL.SUB08[sub].fn 计算；圆盘的总相互作用能由 EL.model(3).readings 计算
(function (EL) {
  const V = EL.V, U = EL.U, VA = EL.VA, X = EL.EX, R_ = String.raw;
  const f4 = VA.f4;
  // 数值文字：根式（VA.nice）或 π 的有理倍数，否则保留 4 位有效数字
  X.niceNum = function (x) {
    const n = VA.nice(x);
    if (n) return { text: n.text, tex: n.tex, exact: true };
    if (isFinite(x) && Math.abs(x) > 1e-9) {
      const y = x / Math.PI, m = VA.nice(y);
      if (m && !/√/.test(m.text)) {
        const s = m.text.replace(/^−/, ''), neg = x < 0, [a, b] = s.split('/'), A = a === '1' ? '' : a;
        return { text: (neg ? '−' : '') + A + 'π' + (b ? '/' + b : ''), tex: (neg ? '-' : '') + (b ? R_`\frac{${A}\pi}{${b}}` : A + R_`\pi`), exact: true };
      }
    }
    return { text: f4(x).replace(/^-/, '−'), tex: f4(x), exact: false };
  };
  const T = x => X.niceNum(x).text, TX = x => X.niceNum(x).tex, P = x => x < 0 ? '(' + TX(x) + ')' : TX(x);
  const pTex = p => '(' + p.map(x => U.fmt(x, 3)).join(',') + ')';

  // ---- 各解析模型：场强、电势的解析与常见错误（w：[数值, 错误原因]）----
  const rho = x => Math.hypot(x[0], x[1]), sgnW = (v, pos, neg) => v > 0 ? pos : neg;
  const ANA = {
    point: {
      E: (p, x) => { const r = V.len(x); return { t: '点电荷的电场强度大小为 E = k|q|/r²，正电荷的场强背离点电荷，负电荷的场强指向点电荷。', tex: R_`r=${TX(r)},\quad E=\frac{k|q|}{r^2}=\frac{${TX(Math.abs(p.q))}}{${P(r)}^2}=${TX(Math.abs(p.q) / (r * r))}`,
        w: [[Math.abs(p.q) / r, '把电势公式 kq/r 误当成场强公式。'], [2 * Math.abs(p.q) / (r * r), '把点电荷当成无限长线电荷，多乘了 2。'], [Math.abs(p.q) / (r * r * r), '把矢量式 kq r⃗/r³ 中的 r³ 当成了场强大小的分母。']] }; },
      V: (p, x) => { const r = V.len(x); return { t: '点电荷的电势为 φ = kq/r，取无穷远处电势为零。', tex: R_`\varphi=\frac{kq}{r}=\frac{${TX(p.q)}}{${TX(r)}}=${TX(p.q / r)}`,
        w: [[p.q / (r * r), '把场强公式中的 1/r² 误用于电势。']] }; }
    },
    'infinite-line': {
      E: (p, x) => { const r = rho(x); return { t: '由高斯定理，无限长均匀带电直线的场强垂直于直线，大小为 E = 2k|λ|/ρ，ρ 是场点到 z 轴的距离，与 z 无关。', tex: R_`\rho=\sqrt{x^2+y^2}=${TX(r)},\quad E=\frac{2k|\lambda|}{\rho}=${TX(2 * Math.abs(p.lambda) / r)}`,
        w: [[Math.abs(p.lambda) / r, '漏掉了因子 2。'], [Math.abs(p.lambda) / (r * r), '误用点电荷的平方反比规律。'], [2 * Math.abs(p.lambda) / V.len(x), '把到原点的距离当成了到直线的距离 ρ。']] }; },
      V: (p, x) => { const r = rho(x); return { t: '无限长带电直线不能取无穷远处电势为零。取 ρ = ρ₀ 处电势为零时，φ = −2kλ ln(ρ/ρ₀)。', tex: R_`\varphi=-2k\lambda\ln\frac{\rho}{\rho_0}=-2\times${P(p.lambda)}\ln\frac{${TX(r)}}{${TX(p.r0)}}=${TX(-2 * p.lambda * Math.log(r / p.r0))}`,
        w: [[2 * p.lambda / r, '把场强公式 2kλ/ρ 误当成电势。'], [p.lambda / V.len(x), '误用点电荷的电势公式，并取无穷远处电势为零。']] }; }
    },
    'infinite-plane': {
      E: p => ({ t: '无限大均匀带电平面两侧都是匀强电场，场强垂直于平面，大小为 E = 2πk|σ|，与到平面的距离无关。', tex: R_`E=2\pi k|\sigma|=2\pi\times${TX(Math.abs(p.sigma))}=${TX(2 * Math.PI * Math.abs(p.sigma))}`,
        w: [[4 * Math.PI * Math.abs(p.sigma), '误用导体表面附近的场强 σ/ε₀。'], [Math.PI * Math.abs(p.sigma), '漏掉了因子 2。']] }),
      V: (p, x) => ({ t: '取带电平面的电势为零，两侧都是匀强电场，所以 φ = −2πkσ|z|。', tex: R_`\varphi=-2\pi k\sigma|z|=-2\pi\times${P(p.sigma)}\times${TX(Math.abs(x[2]))}=${TX(-2 * Math.PI * p.sigma * Math.abs(x[2]))}`,
        w: [[-4 * Math.PI * p.sigma * Math.abs(x[2]), '误用导体表面附近的场强 σ/ε₀ 计算电势。'], [0, '误以为平面附近处处电势为零。']] })
    },
    'conductor-sphere': {
      E: (p, x) => { const r = V.len(x); return r < p.a ? { t: '导体处于静电平衡时，内部场强处处为零，电荷只分布在导体表面。', tex: R_`r=${TX(r)}<a,\quad E=0`,
        w: [[r > 1e-6 ? Math.abs(p.q) / (r * r) : NaN, '把导体球当成点电荷，忽略了静电平衡。'], [Math.abs(p.q) / (p.a * p.a), '把球面外侧的场强当成了内部的场强。'], [Math.abs(p.q) * r / p.a ** 3, '把导体球当成均匀带电的绝缘球。']] }
        : { t: '球外的电场与把全部电荷集中在球心的点电荷产生的电场相同，E = k|q|/r²。', tex: R_`r=${TX(r)}>a,\quad E=\frac{k|q|}{r^2}=${TX(Math.abs(p.q) / (r * r))}`,
        w: [[Math.abs(p.q) / (p.a * p.a), '把到球心的距离错当成球的半径。'], [Math.abs(p.q) / r, '把电势公式误当成场强公式。'], [Math.abs(p.q) / ((r - p.a) ** 2), '把到球面的距离当成了到球心的距离。']] }; },
      V: (p, x) => { const r = V.len(x); return r <= p.a ? { t: '导体是等势体，内部各点的电势等于球面的电势 φ = kq/a。', tex: R_`\varphi=\frac{kq}{a}=\frac{${TX(p.q)}}{${TX(p.a)}}=${TX(p.q / p.a)}`,
        w: [[0, '误以为场强为零的地方电势也为零。'], [r > 1e-9 ? p.q / r : NaN, '误用点电荷的电势公式 kq/r 计算导体内部的电势。']] }
        : { t: '球外的电势与点电荷相同，φ = kq/r。', tex: R_`\varphi=\frac{kq}{r}=\frac{${TX(p.q)}}{${TX(r)}}=${TX(p.q / r)}`, w: [[p.q / p.a, '误把球面的电势当成了球外各点的电势。'], [p.q / (r * r), '把场强公式中的 1/r² 误用于电势。']] }; }
    },
    'dielectric-interface': {
      E: (p, x) => { const e = x[2] >= 0 ? p.e1 : p.e2, o = x[2] >= 0 ? p.e2 : p.e1; return { t: '分界面上没有自由电荷，电位移的法向分量连续，各介质中 E = D/(ε₀ε) = 4πkD/ε，ε 取场点所在介质的相对介电常数。', tex: R_`E=\frac{4\pi k|D|}{\varepsilon}=\frac{4\pi\times${TX(Math.abs(p.D))}}{${TX(e)}}=${TX(4 * Math.PI * Math.abs(p.D) / e)}`,
        w: [[4 * Math.PI * Math.abs(p.D) / o, '用了另一侧介质的介电常数。'], [4 * Math.PI * Math.abs(p.D), '忽略了电介质的极化。'], [4 * Math.PI * Math.abs(p.D) * e, '把除以 ε 误写成乘以 ε。']] }; },
      V: (p, x) => { const e = x[2] >= 0 ? p.e1 : p.e2, Ez = 4 * Math.PI * p.D / e; return { t: '取分界面的电势为零，各介质中电场均匀，φ = −E_z z。', tex: R_`E_z=\frac{4\pi kD}{\varepsilon}=${TX(Ez)},\quad\varphi=-E_zz=${TX(-Ez * x[2])}`,
        w: [[-4 * Math.PI * p.D * x[2], '忽略了电介质的极化。'], [-4 * Math.PI * p.D / (x[2] >= 0 ? p.e2 : p.e1) * x[2], '用了另一侧介质的介电常数。']] }; },
      bc: p => ({ value: p.e2 / p.e1, t: '分界面上没有自由电荷时，连续的是电位移的法向分量：ε₁E_1n = ε₂E_2n，所以 E_1n/E_2n = ε₂/ε₁。', tex: R_`\frac{E_{1n}}{E_{2n}}=\frac{\varepsilon_2}{\varepsilon_1}=\frac{${TX(p.e2)}}{${TX(p.e1)}}=${TX(p.e2 / p.e1)}`,
        w: [[p.e1 / p.e2, '把电位移连续的条件写反了。'], [1, '误以为场强的法向分量连续。'], [(p.e2 / p.e1) ** 2, '误把介电常数之比平方。']] })
    },
    'dielectric-sphere': {
      E: (p, x) => {
        const C = 3 * p.eout / (p.ein + 2 * p.eout);
        if (V.len(x) < p.a) return { t: '均匀电介质球内的电场是匀强电场，E_in = CE₀，其中 C = 3ε_out/(ε_in + 2ε_out)。', tex: R_`C=\frac{3\varepsilon_{\mathrm{out}}}{\varepsilon_{\mathrm{in}}+2\varepsilon_{\mathrm{out}}}=${TX(C)},\quad E_{\mathrm{in}}=C|E_0|=${TX(C * Math.abs(p.E0))}`,
          w: [[Math.abs(p.E0), '忽略了电介质球的极化。'], [Math.abs(p.E0) * p.eout / p.ein, '把平面分界面的关系误用于球面。'], [Math.abs(p.E0) * 3 * p.ein / (p.eout + 2 * p.ein), '把球内外的介电常数弄反了。']] };
        const e = EL.SUB08['dielectric-sphere'].fn(p, x).E;
        return { t: '球外的电场是外加匀强电场与电介质极化电荷产生的电场的矢量和，由 E = −∇φ 求得。', tex: R_`\vec E=-\nabla\varphi_{\mathrm{out}}=${pTex(e.map(v => +f4(v)))}`, w: [[Math.abs(p.E0), '忽略了极化电荷在球外产生的电场。']] };
      },
      V: (p, x) => {
        const C = 3 * p.eout / (p.ein + 2 * p.eout), be = (p.ein - p.eout) / (p.ein + 2 * p.eout), r = V.len(x);
        if (r < p.a) return { t: '球内电场均匀，取 z = 0 处电势为零，φ = −CE₀z。', tex: R_`\varphi=-CE_0z=-${TX(C)}\times${P(p.E0)}\times${P(x[2])}=${TX(-C * p.E0 * x[2])}`, w: [[-p.E0 * x[2], '忽略了电介质球的极化。'], [0, '把电介质球当成了等势的导体。']] };
        return { t: '球外电势是外加电场的电势与极化电荷产生的电势之和，φ = −E₀z + βE₀a³z/r³，β = (ε_in − ε_out)/(ε_in + 2ε_out)。', tex: R_`\beta=${TX(be)},\quad\varphi=-E_0z+\frac{\beta E_0a^3z}{r^3}=${TX(-p.E0 * x[2] + be * p.E0 * p.a ** 3 * x[2] / r ** 3)}`,
          w: [[-p.E0 * x[2], '忽略了极化电荷产生的电势。'], [-p.E0 * x[2] - be * p.E0 * p.a ** 3 * x[2] / r ** 3, '极化电荷产生的电势正负号弄反了。']] };
      },
      bc: p => { const C = 3 * p.eout / (p.ein + 2 * p.eout); return { value: C, t: '均匀电介质球放在匀强外场中，球内是匀强电场，E_in/E₀ = 3ε_out/(ε_in + 2ε_out)。', tex: R_`\frac{E_{\mathrm{in}}}{E_0}=\frac{3\varepsilon_{\mathrm{out}}}{\varepsilon_{\mathrm{in}}+2\varepsilon_{\mathrm{out}}}=${TX(C)}`,
        w: [[1, '忽略了电介质球的极化。'], [p.eout / p.ein, '把平面分界面的关系误用于球面。'], [3 * p.ein / (p.eout + 2 * p.ein), '把球内外的介电常数弄反了。']] }; }
    }
  };
  X.ANA = ANA;

  // 方向文字：沿坐标轴、沿径向，或写出单位矢量
  X.anaDir = function (sub, x, E) {
    const u = V.norm(E), ax = ['x', 'y', 'z'];
    for (let i = 0; i < 3; i++) if (Math.abs(Math.abs(u[i]) - 1) < 1e-6) return '沿 ' + (u[i] > 0 ? '+' : '−') + ax[i] + ' 方向';
    const r = sub === 'infinite-line' ? [x[0], x[1], 0] : x;
    if (V.len(r) > 1e-9 && ['point', 'conductor-sphere', 'infinite-line'].includes(sub)) {
      const c = V.dot(u, V.norm(r)), w = sub === 'infinite-line' ? 'z 轴' : '原点 O';
      if (c > 1 - 1e-6) return '沿径向背离' + w; if (c < -1 + 1e-6) return '沿径向指向' + w;
    }
    return '沿单位矢量 (' + u.map(v => U.fmt(v, 3)).join(', ') + ') 的方向';
  };

  // 选项：去掉与正确答案数值相同的干扰项；不足两个选项时改为填空（学生输入数值）
  const key = v => String(v).replace(/ .*$/, '').replace(/^−0$/, '0');
  const pick = (o, right, wrongs) => {
    const seen = new Set([key(right)]), w = wrongs.filter(x => x && x.v && !seen.has(key(x.v)) && seen.add(key(x.v))).slice(0, 3);
    if (!w.length) { delete o.options; o.distractors = []; return; }
    o.options = [right].concat(w.map(x => x.v)).sort(); o.distractors = w;
  };
  X.optKey = key;
  const toW = ws => ws.filter(x => isFinite(x[0])).map(x => ({ v: T(x[0]), why: x[1] }));
  const undef = (n, s, what) => n + ' 点' + (s.region && /未定义|上/.test(s.region) ? '位于' + s.region.replace(/（.*）/, '') + '，' : '处') + what + '未定义。';

  // 解析场模型的单个问题
  X.anaAnswer = function (pb, R, q) {
    const Pt = n => R.pts[n] && R.pts[n].p, sub = pb.sub, sp = pb.sp, A = ANA[sub], o = { q, ok: true, diag: [] };
    if (q.t === 'E' || q.t === 'Ezero' || q.t === 'angle') {
      const x = Pt(q.at);
      if (!x) return { q, ok: false, err: '还没有选择观察点。' };
      const s = R.field(x);
      if (!s.E.every(isFinite)) return { q, ok: false, err: undef(q.at, s, '电场强度') };
      const m = V.len(s.E); o.value = m; o.T = s.E; o.probe = [q.at];
      const e = A.E(sp, x);
      o.dir = m < 1e-9 ? '' : X.anaDir(sub, x, s.E);
      if (q.t === 'E') {
        o.mag = m < 1e-9 ? '0' : T(m); o.answer = o.mag + (o.dir ? '，方向' + o.dir : '');
        pick(o, o.mag, toW(e.w));
        o.expl = [{ t: e.t, tex: e.tex }, { t: '所以 ' + q.at + ' 点的电场强度大小为 ' + o.mag + (o.dir ? '，方向' + o.dir : '') + '。' }];
        if (m < 1e-9) o.diag.push({ k: 'good', t: '该点场强为零，适合考查“场强为零时电势是否为零”。' });
      } else if (q.t === 'Ezero') {
        o.answer = m < 1e-9 ? '是' : '否'; o.options = ['是', '否'];
        o.expl = [{ t: e.t, tex: e.tex }, { t: '所以 ' + q.at + ' 点的电场强度' + (m < 1e-9 ? '为零' : '不为零') + '。' }];
      } else {
        const a = Pt(q.a), b = Pt(q.b);
        if (!a || !b) return { q, ok: false, err: '请选择确定直线的两个点。' };
        const d = V.sub(b, a);
        if (m < 1e-9) return { q, ok: false, err: q.at + ' 点的电场强度为零，没有方向，夹角没有意义。' };
        if (V.len(d) < 1e-9) return { q, ok: false, err: q.a + '、' + q.b + ' 两点重合，不能确定直线，夹角没有意义。' };
        const th = VA.ang(s.E, d); o.value = th; o.answer = (Math.round(th * 10) / 10) + '°'; o.options = VA.angOpts(th);
        o.expl = [{ t: e.t, tex: e.tex }, { t: q.at + ' 点的场强方向' + o.dir + '。由场强与 ' + q.a + '、' + q.b + ' 两点位置差矢量的数量积求得，夹角为 ' + o.answer + '。' }];
      }
      return o;
    }
    if (q.t === 'V') {
      const x = Pt(q.at);
      if (!x) return { q, ok: false, err: '还没有选择观察点。' };
      const s = R.field(x);
      if (!isFinite(s.V)) return { q, ok: false, err: undef(q.at, s, '电势') };
      const e = A.V(sp, x); o.value = s.V; o.answer = T(s.V); o.probe = [q.at];
      pick(o, o.answer, toW(e.w.concat([[-s.V, '电势的正负号弄反了。']])));
      o.expl = [{ t: e.t, tex: e.tex }];
      if (Math.abs(s.V) < 1e-9 && V.len(s.E) > 1e-9) o.diag.push({ k: 'good', t: '该点电势为零而场强不为零，适合讨论“电势为零时场强是否为零”。' });
      return o;
    }
    if (q.t === 'Vcmp' || q.t === 'W' || q.t === 'trend') {
      const a = Pt(q.a), b = Pt(q.b);
      if (!a || !b) return { q, ok: false, err: '请选择两个点。' };
      const sa = R.field(a), sb = R.field(b);
      if (!isFinite(sa.V) || !isFinite(sb.V)) return { q, ok: false, err: undef(!isFinite(sa.V) ? q.a : q.b, !isFinite(sa.V) ? sa : sb, '电势') };
      o.va = sa.V; o.vb = sb.V; o.probe = [q.a, q.b];
      if (q.t === 'Vcmp') X.cmpAnswer(o, q, sa.V, sb.V);
      if (q.t === 'W') {
        const q0 = q.q0 || 1, w = q0 * (sa.V - sb.V); o.value = w; o.answer = T(w);
        pick(o, o.answer, [{ v: T(-w), why: '把电势差的顺序弄反了，误用 W = q(φ_末 − φ_初)。' }, { v: T(Math.abs(w)), why: '忽略了试探电荷电荷量的正负号。' }, Math.abs(w) > 1e-9 ? { v: '0', why: '误以为两点的电势相等。' } : null]);
        o.expl = [{ t: '先求两点的电势：' + A.V(sp, a).t, tex: R_`\varphi_{${q.a}}=${TX(sa.V)},\quad\varphi_{${q.b}}=${TX(sb.V)}` },
          { t: '静电力做的功 W = q(φ_' + q.a + ' − φ_' + q.b + ')。', tex: R_`W=${P(q0)}\times(${TX(sa.V)}-${P(sb.V)})=${TX(w)}` }];
      }
      if (q.t === 'Vcmp') o.expl = [{ t: A.V(sp, a).t, tex: R_`\varphi_{${q.a}}=${TX(sa.V)},\quad\varphi_{${q.b}}=${TX(sb.V)}` }, { t: '所以 ' + o.answer + '。' }];
      if (q.t === 'trend') {
        const vs = [];
        for (let i = 0; i <= 200; i++) { const s = R.field(V.lerp(a, b, i / 200)); if (!isFinite(s.V)) return { q, ok: false, err: '路径中途经过' + (s.region || '').replace(/（.*）/, '') + '，该处电势未定义，不能讨论电势的变化。' }; vs.push(s.V); }
        X.trendAnswer(o, vs);
        o.expl = [{ t: '沿路径方向，场强的分量 E_∥ 大于零时电势降低，小于零时电势升高。' + A.V(sp, a).t, tex: R_`\varphi_{${q.a}}=${TX(sa.V)},\quad\varphi_{${q.b}}=${TX(sb.V)}` },
          { t: '所以从 ' + q.a + ' 点到 ' + q.b + ' 点，电势' + (o.answer === '多次起伏' ? '多次起伏变化' : o.answer) + '。' }];
      }
      return o;
    }
    if (q.t === 'bc') {
      const e = A.bc(sp);
      if (!isFinite(e.value) || (sub === 'dielectric-interface' && !sp.D) || (sub === 'dielectric-sphere' && !sp.E0)) return { q, ok: false, err: '外加电场为零，场强之比没有意义。' };
      // 用实验室的场函数核对：分界面两侧（z = ±10⁻⁶）或球心与远处
      const f = x => EL.SUB08[sub].fn(sp, x).E[2], chk = sub === 'dielectric-interface' ? f([0, 0, 1e-6]) / f([0, 0, -1e-6]) : f([0, 0, 0]) / sp.E0;
      o.value = chk; o.answer = T(e.value); o.check = Math.abs(chk - e.value) < 1e-9;
      o.probePts = sub === 'dielectric-interface' ? [[0, 0, 0.5], [0, 0, -0.5]] : [[0, 0, 0], [0, 0, 3 * sp.a]];
      pick(o, o.answer, toW(e.w));
      o.expl = [{ t: e.t, tex: e.tex }];
      return o;
    }
    return { q, ok: false, err: '本模型不能出这类问题。' };
  };

  // ---- 圆盘电荷 ----
  X.diskAnswer = function (pb, R, q) {
    const d = pb.disk, o = { q, ok: true, diag: [] }, src = R.sources, n = src.length, u = R.units.U;
    if (q.t === 'pairs') {
      const k = n * (n - 1) / 2; o.value = k; o.answer = String(k); o.focus = 'pairs';
      pick(o, o.answer, [{ v: String(n * (n - 1)), why: '把每一对电荷算了两次（i、j 的顺序不同算作不同的对）。' }, { v: String(n * (n + 1) / 2), why: '把电荷与它自身也算作一对。' }, { v: String(n - 1), why: '只数了与其中一个电荷配对的电荷。' }]);
      o.expl = [{ t: 'N 个电荷两两配对，每一对只计算一次，不重复的电荷对数为 N(N − 1)/2。', tex: R_`\frac{N(N-1)}{2}=\frac{${n}\times${n - 1}}{2}=${k}` }];
      return o;
    }
    if (q.t === 'U') {
      const e = X.diskEnergy(d);
      if (!isFinite(e.U)) return { q, ok: false, err: '有两个电荷的距离小于排除半径，总相互作用能未定义。' };
      o.value = e.U; o.answer = T(e.U) + ' ' + u; o.right = o.answer; o.focus = 'pairs';
      const pr = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pr.push({ i, j, r: V.dist(src[i].p, src[j].p), w: src[i].q * src[j].q });
      const rmin = Math.min(...pr.map(x => x.r)), ring = d.center ? pr.filter(x => src[x.i].label !== 'Qc' && src[x.j].label !== 'Qc') : pr;
      pick(o, o.answer, [{ v: T(2 * e.U) + ' ' + u, why: '对 i、j 两重求和时没有除以 2，每一对电荷算了两次。' },
        { v: T(pr.filter(x => Math.abs(x.r - rmin) < 1e-9).reduce((s, x) => s + x.w / x.r, 0)) + ' ' + u, why: '只计入了相邻电荷之间的相互作用能。' },
        d.center ? { v: T(ring.reduce((s, x) => s + x.w / x.r, 0)) + ' ' + u, why: '漏掉了中心电荷与圆周上各电荷的相互作用能。' } : null,
        { v: T(pr.reduce((s, x) => s + x.w / (x.r * x.r), 0)) + ' ' + u, why: '把 1/r 误写成了 1/r²。' }]);
      const nr = d.center ? d.N - 1 : d.N;
      o.expl = [{ t: '总相互作用能等于所有不重复电荷对的相互作用能之和，共 ' + pr.length + ' 对，每一对只计算一次。', tex: R_`U=\sum_{i<j}\frac{kq_iq_j}{r_{ij}}=${TX(e.U)}` },
        { t: '圆周上 ' + nr + ' 个等分电荷之间的距离为 r = 2R sin(mπ/' + nr + ')，求和得到下面的结果' + (d.center ? '；再加上中心电荷与圆周上 ' + nr + ' 个电荷的相互作用能。' : '。'),
          tex: R_`U=\frac{${nr}kq^2}{4R}\sum_{m=1}^{${nr - 1}}\frac{1}{\sin(m\pi/${nr})}` + (d.center ? R_`+\frac{${nr}kqq_c}{R}` : '') + '=' + TX(e.theory) }];
      return o;
    }
    if (q.t === 'Ucmp') {
      if (d.N < 3) return { q, ok: false, err: '电荷总个数至少为 3 时，才能比较这两种构型。' };
      const a = X.diskEnergy(Object.assign({}, d, { center: false })).U, b = X.diskEnergy(Object.assign({}, d, { center: true, qc: d.q })).U;
      o.va = a; o.vb = b; o.focus = 'pairs';
      o.options = ['N 个电荷等分圆周的构型较小', '一个电荷在圆心的构型较小', '两种构型相等'];
      o.answer = Math.abs(a - b) < 1e-9 ? o.options[2] : a < b ? o.options[0] : o.options[1];
      o.expl = [{ t: '在 N、R 和每个电荷的电荷量都相同的条件下，分别计算两种构型的总相互作用能。', tex: R_`U_{\text{圆周}}=${TX(a)},\quad U_{\text{圆心}}=${TX(b)}` },
        { t: '所以' + o.answer.replace('较小', '的总相互作用能较小') + '。只比较两种构型，不能证明较小的一种是全局最小。' }];
      return o;
    }
    return { q, ok: false, err: '本模型不能出这类问题。' };
  };
})(window.EL);
