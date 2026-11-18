'use strict';
// Probe geometry and potential searches share the same explicit coordinates.
(function (EL) {
  const A = EL.App, V = EL.V, P = EL.ProbeMotion, U = EL.U, K = EL.UI, h = U.h;
  const en = typeof document !== 'undefined' && document.documentElement.lang.startsWith('en'), L = (zh, eng) => en ? eng : zh;
  const fmt = p => '(' + p.map(x => U.fmt(x, 5)).join(', ') + ')';
  A.inquiryDomain = c => {
    const s = c.st.inquiry;
    if (s.maxScope === 'global' && !c.m.analytic) return { type: 'global' };
    if (s.maxScope === 'path') return { type: 'path', points: P.route(s) };
    if (s.maxScope === 'plane') return P.plane(s);
    return { type: 'box', min: [-c.bound, -c.bound, -c.bound], max: [c.bound, c.bound, c.bound] };
  };
  A.maximumSignature = c => JSON.stringify([c.sources, c.sub, c.subP, c.rMin, A.inquiryDomain(c)]);
  A.currentMaximum = c => A.maximum && A.maximum.signature === A.maximumSignature(c) ? A.maximum : null;
  A.maximumText = c => {
    const r = A.currentMaximum(c);
    if (!r) return L('尚未计算，或模型/范围已改变，请重新计算。', 'Not calculated, or model/domain changed. Calculate again.');
    if (r.status === 'unbounded') return L('电势无上界：趋近净正点电荷时 V → +∞，不存在有限最大值。奇点位置：', 'Potential is unbounded: V → +∞ near a net positive point charge. No finite maximum. Singularities: ') + r.points.map(fmt).join('; ') + ' L';
    if (r.status === 'supremum') return L('全空间没有有限位置的最大值。只有净负点电荷时 V < 0，远离全部电荷时 V → 0；0 是上确界，不能标成某个有限位置的最大值。', 'There is no maximum at a finite position. With only net-negative sources, V < 0 and V → 0 at infinity. Zero is the unattained supremum.');
    if (r.status === 'constant') return L('净电荷分布完全抵消：所有常规位置均有 V = 0，没有唯一最大值位置。', 'The net source distribution cancels: V = 0 at every regular position; there is no unique maximum location.');
    if (r.status === 'empty') return L('该范围内没有有效的有限样点，请调整范围或路径。', 'No valid finite samples in this domain. Adjust the domain or path.');
    return L('数值最大值 V ≈ ', 'Sampled maximum V ≈ ') + U.fmt(r.value, 7) + ' kQ/L; P ≈ ' + fmt(r.p) + ' L. ' +
      L('这是采样与局部细化结果，不是全局最大值的严格证明。', 'Sampling and local refinement do not prove a global maximum.') +
      (r.excluded ? L(' 已跳过不可定义点及电荷排除邻域。', ' Undefined points and charge exclusion neighborhoods were skipped.') : '') +
      (r.infiniteSamples ? L(' 范围内还检出无穷值，请结合解析模型判断。', ' Infinite samples were also detected; inspect the analytic model.') : '');
  };
  A.refreshMaximumText = c => { const node = U.$('#potentialMaximumResult'); if (node) node.textContent = A.maximumText(c); };
  A.inquiryPanel = c => {
    const st = c.st, s = st.inquiry, free = !!(c.probe && c.probe.free);
    if (c.m.analytic && s.maxScope === 'global') s.maxScope = 'box';
    const change = fn => { A.stopAnim(); fn(); st.trail = []; st.eTrail = []; A.update(); A.renderPanel(); };
    const error = () => U.toast(L('请输入有效的三维坐标；法向量不能为零，直线两点不能重合，路径需有 2～64 个不同位置的点。', 'Enter valid 3D coordinates; use a nonzero normal, distinct line endpoints, and 2–64 waypoints with nonzero path length.'));
    const vector = (key, label) => {
      const input = h('input', { type: 'text', value: s[key].join(', '), 'aria-label': label });
      input.addEventListener('change', () => {
        try {
          const rows = P.parse(input.value); if (rows.length !== 1) throw Error();
          const p = rows[0];
          if ((key === 'normal' && V.len(p) < 1e-8) || (key === 'a' && V.dist(p, s.b) < 1e-8) || (key === 'b' && V.dist(p, s.a) < 1e-8)) throw Error();
          change(() => { s[key] = p; if(st.layers.probe) A.enableRouteProbe(); });
        } catch (_) { input.value = s[key].join(', '); error(); }
      });
      return h('label.ctl.inquiry-input', null, h('span', null, label), input);
    };
    const planeFields = () => [vector('origin', L('平面上一点 (x, y, z) / L', 'Point on plane (x, y, z) / L')), vector('normal', L('平面法向量 (nx, ny, nz)', 'Plane normal (nx, ny, nz)'))];
    const opts = [['free', L('自由移动', 'Free movement')], ['plane', L('约束在平面内', 'Constrain to plane')], ['line', L('约束在直线上', 'Constrain to line')]];
    const motion = [];
    if (st.layers.probe) {
      motion.push(K.select(L('探针位置约束', 'Probe constraint'), opts, s.constraint, v => change(() => { s.constraint = v; A.enableRouteProbe(); })));
      if (s.constraint === 'line') motion.push(vector('a', L('直线点 A (x, y, z) / L', 'Line point A (x, y, z) / L')), vector('b', L('直线点 B (x, y, z) / L', 'Line point B (x, y, z) / L')));
      if (s.constraint === 'plane') motion.push(...planeFields());
      motion.push(K.note(L('坐标输入与拖动都会投影到约束线上/面上。斜线或斜面建议切换三维视图。', 'Coordinate edits and dragging are projected onto the constraint. Use 3D view for oblique geometry.')));
    }
    const routeLabel = L('路径点：每行 x, y, z（单位 L，至少两点）', 'Waypoints: x, y, z per line (L; at least two)');
    const ta = h('textarea', { rows: 4, 'aria-label': routeLabel, style: 'width:100%;box-sizing:border-box;resize:vertical' }, s.points.map(p => p.join(', ')).join('\n'));
    if (st.layers.probe) {
    motion.push(K.select(L('路径方式', 'Route type'), [['waypoints',L('逐点连接','Connected points')],['formula',L('函数公式','Parametric formula')]], s.routeMode, v => change(() => { s.routeMode = v; })));
    if (s.routeMode === 'waypoints') motion.push(h('div.btns',null,K.btn(L('在模型上选点','Pick on model'),()=>A.startRoutePick(),'primary')),h('label.ctl.inquiry-input', null, h('span', null, routeLabel), ta), K.btn(L('应用坐标路径', 'Apply coordinate path'), () => {
      try { const pts = P.parse(ta.value); if (pts.length>64 || !P.validPath(pts) || !P.validPath(pts.map(p => P.project(p, s)))) throw Error(); change(() => { s.points = pts; s.routeMode='waypoints'; s.t = 0; s.showPath = true; A.enableRouteProbe(); A.update(); A.moveRouteProbe(0); }); }
      catch (_) { error(); }
    }), K.note(L('路径为依次连接各点的折线；启用约束时，路径点也投影到约束线上/面上。', 'The route joins the waypoints in order. When constrained, waypoints are projected onto that line/plane.')),
    K.check(L('显示路径和约束参考', 'Show route and constraint guides'), s.showPath, v => change(() => { s.showPath = v; })));
    else {
      const inputs={};
      for (const key of ['x','y','z','min','max']) { const label=['min','max'].includes(key)?(key==='min'?L('t 起点','t start'):L('t 终点','t end')):key+'(t) / L'; inputs[key]=h('input',{type:'text',value:String(s.formula[key]),'aria-label':label}); motion.push(h('label.ctl.inquiry-input',null,h('span',null,label),inputs[key])); }
      motion.push(K.note(L('使用 t、pi、sin、cos、sqrt、+ − * / ^；例如 x(t)=2*cos(t)，y(t)=2*sin(t)。','Use t, pi, sin, cos, sqrt, + − * / ^; e.g. x(t)=2*cos(t), y(t)=2*sin(t).')),K.btn(L('应用函数路径','Apply formula route'),()=>{
        try { const f={x:inputs.x.value,y:inputs.y.value,z:inputs.z.value,min:Number(inputs.min.value),max:Number(inputs.max.value)}; const pts=P.sampleFormula(f).map(p=>P.project(p,s)); if(!P.validPath(pts)) throw Error(); change(()=>{s.formula=f;s.routeMode='formula';s.t=0;s.showPath=true;A.enableRouteProbe();A.update();A.moveRouteProbe(0);}); }
        catch(_){U.toast(L('公式或区间无效；请使用显式乘号，并确保整条路径坐标有限且不完全重合。','Invalid formula or interval. Use explicit multiplication and finite, nonconstant coordinates.'));}
      },'primary'),K.check(L('显示路径和约束参考','Show route and constraint guides'),s.showPath,v=>change(()=>{s.showPath=v;})));
    }
    if(s.routeEnabled) motion.push(K.slider({ label: L('路径进度', 'Route progress'), min: 0, max: 1, step: 0.001, val: s.t, on: (v, live) => { if (st.anim.on || st.anim.paused) A.stopAnim(); A.moveRouteProbe(v); A.update(); if (!live) A.renderPanel(); } }),
      h('div.btns', null, K.btn(st.anim.on && st.anim.target === 'route' ? L('暂停路径动画', 'Pause route') : L('播放路径动画', 'Play route'), () => { st.layers.probe = true; s.showPath = true; A.enableRouteProbe(); A.update(); A.renderStageBar(); if (!P.validPath(P.route(s))) return error(); A.toggleAnim(st.anim.on && st.anim.target === 'route' ? null : 'route'); }, 'primary'), K.btn(L('停止并复位', 'Stop and reset'), () => A.resetAnim()),K.btn(L('恢复模型探针','Restore model probe'),()=>change(()=>A.disableRouteProbe()))),
      K.note(L('周期、轨迹和场强箭头轨迹可在“动画”工具栏设置。', 'Set period, position trails and field-vector trails in Animation.')));
    } else motion.push(K.note(L('打开探针后可设置函数路径或在模型上逐点选取路径。','Enable the probe to define a formula route or select points on the model.')));
    const max = [K.select(L('搜索范围', 'Search domain'), (c.m.analytic ? [] : [['global', L('整体模型（全空间）', 'Whole model (all space)')]]).concat([['box', L('当前显示范围', 'Current display bounds')], ['path', L('规定路线', 'Defined route')], ['plane', L('规定平面：有限正方形', 'Defined plane: bounded square')]]), s.maxScope, v => change(() => { s.maxScope = v; }))];
    if (s.maxScope === 'plane') {
      if (!(free && s.constraint === 'plane')) max.push(...planeFields());
      max.push(K.slider({ label: L('平面搜索半边长 / L', 'Plane search half-width / L'), min: 0.1, max: 100, step: 0.1, val: s.half, on: v => { s.half = v; A.update(); } }));
    }
    max.push(K.note(s.maxScope === 'global' ? L('全空间依据理想点电荷叠加作解析判定；若需要有限数值，请改选显示范围、路线或平面。', 'All-space classification uses ideal point-charge superposition. Select display bounds, route or plane for finite numerical searches.') : s.maxScope === 'box' ? L('搜索立方体：各坐标均为 ', 'Search cube: each coordinate in ') + ' [−' + c.bound + ', ' + c.bound + '] L. ' + L('全空间不一定存在最大值；有限数值只针对该范围。', 'All space may have no maximum; finite results apply only to these bounds.') : L('平面/路线的定义与上述坐标共用；更改模型或范围后请重新计算。', 'The domain uses the coordinates above. Recalculate after changing the model or domain.')),
      K.btn(L('计算并标记最大值位置', 'Find and mark potential maximum'), () => { const domain = A.inquiryDomain(A.c), result = domain.type === 'global' ? EL.PotentialSearch.global(A.c.F) : EL.PotentialSearch.search(A.c.F, domain); A.maximum = Object.assign(result, { signature: A.maximumSignature(A.c) }); s.showMax = true; A.update(); A.renderPanel(); }, 'primary'),
      K.check(L('显示搜索边界和结果标记', 'Show search boundary and result markers'), s.showMax, v => change(() => { s.showMax = v; })),
      h('p.note', { id: 'potentialMaximumResult', role: 'status', style: 'color:inherit;line-height:1.65;overflow-wrap:anywhere' }, A.maximumText(c)),
      K.note(L('净正点电荷的理想电势无上界。画板排除半径只是数值显示保护，不能把它当作真实电荷半径。', 'Ideal net-positive point charges give unbounded potential. The display exclusion radius is a numerical guard, not a physical charge radius.')));
    return [K.group(L('探针约束与路径', 'Probe constraints and route'), ...motion), K.group(L('电势最大值位置', 'Potential maximum location'), ...max)];
  };
  A.moveRouteProbe = t => {
    const c = A.c, s = c.st.inquiry;
    if (!c.probe || !c.probe.free) return;
    const progress=U.clamp(t, 0, 1);let p;
    try{p=P.position(s,progress);}catch(_){A.stopAnim();U.toast(L('此处路径公式无定义，动画已停止。请修改公式或区间。','The route formula is undefined here. Animation stopped; adjust the formula or interval.'));return false;}
    s.t = progress;
    c.probe.free.forEach((key, i) => { c.st.p[key] = p[i]; });
    const keys=c.m.probe?.free;if(s.routeEnabled&&keys) keys.forEach((key,i)=>{c.st.p[key]=p[i];});
    return true;
  };
  A.addInquiry = (c, sc) => {
    const s = c.st.inquiry, C = EL.C, R = c.bound, pts = P.route(s);
    const line = (points, color) => sc.lines.push({ pts: points, color: color || C.probe, width: 1.8, dash: [R * 0.025, R * 0.012] });
    const plane = d => { const q = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v]) => V.add(d.origin, V.add(V.mul(d.u,u*d.half),V.mul(d.v,v*d.half)))); line(q.concat([q[0]]), C.guide); };
    if (s.showPath && c.probeVisible && c.probe.free) {
      line(pts); if(V.dist(pts[0],pts[pts.length-1])<1e-7)sc.labels.push({p:pts[0],text:L('起点 / 终点','Start / End'),cls:'probe'});else [0,pts.length-1].forEach(i => sc.labels.push({ p:pts[i], text:i===0?L('起点','Start'):L('终点','End'), cls:'probe' }));
      if (s.constraint === 'plane') plane(P.plane(Object.assign({}, s, { half: R })));
      if (s.constraint === 'line') { const d = V.norm(V.sub(s.b, s.a)); line([V.addS(s.a,d,-R), V.addS(s.a,d,R)], C.guide); }
    }
    if (!s.showMax) return;
    const domain = A.inquiryDomain(c);
    if (domain.type === 'box') sc.lines.push(...A.boxLines(R, C.guide));
    else if (domain.type === 'plane') plane(domain);
    else if (domain.type === 'path') line(domain.points, C.guide);
    const r = A.currentMaximum(c); if (!r) return;
    const points = r.status === 'unbounded' ? r.points : r.p ? [r.p] : [];
    for (const p of points) {
      sc.spheres.push({ p, r: R * 0.025, color: C.ang });
      sc.labels.push({ p, text: r.status === 'unbounded' ? L('V→+∞（非有限最大值）', 'V→+∞ (unbounded)') : 'Vmax ≈ ' + U.fmt(r.value,5), cls: 'note' });
    }
  };
})(window.EL);
