'use strict';
// An independent probe never changes the problem, answer or guided construction.
(function (EL) {
  if (typeof document === 'undefined' || !EL.EX || !EL.EX.W) return;
  const X = EL.EX, W = X.W, U = EL.U, V = EL.V, P = EL.ProbeMotion;
  const en = document.documentElement.lang.startsWith('en'), L = (zh, eng) => en ? eng : zh;
  const R = X.RouteProbe = { enabled: false, drawing: false, points: [], formula: { x: 't', y: '0', z: '0', min: -1, max: 1 }, routeMode: 'waypoints', t: 0, playing: false, plane: 'xy', offset: 0 };
  let baseScene, lastProblem, frame = 0, previousTime = 0, backup, controls, dialog, reading;
  const valid = () => R.routeMode === 'formula' ? !!R.samples : P.validPath(R.points);
  const position = () => R.routeMode === 'formula' ? P.formulaAt(R.formula, R.t) : P.at(R.points, R.t);
  const refresh = () => {
    if (!controls) return;
    controls.querySelector('.route-progress').value = R.t;
    const play = controls.querySelector('.route-play'); play.textContent = R.playing ? 'Ⅱ' : '▶'; const title = R.playing ? L('暂停路径', 'Pause route') : L('播放路径', 'Play route'); play.title = title; play.setAttribute('aria-label', title);
    controls.classList.toggle('drawing', R.drawing); controls.classList.toggle('active', R.enabled);
  };
  R.stop = () => { R.playing = false; cancelAnimationFrame(frame); frame = 0; refresh(); };
  R.draw = () => {
    if (!baseScene || !W.last) return;
    const sc = Object.assign({}, baseScene), C = EL.C;
    for (const key of ['lines','segs','meshes','spheres','arrows','labels','glows']) sc[key] = (baseScene[key] || []).slice();
    const points = R.drawing ? R.points : R.routeMode === 'formula' ? R.samples || [] : R.points;
    if (R.enabled) {
      if (points.length > 1) sc.lines.push({ pts: points.map(W.M), color: C.probe, width: 2.4, preserve: true });
      const mark = (p, text, id, color) => { sc.spheres.push({ p: W.M(p), r: W.AD * .025, color: color || C.probe }); sc.labels.push({ id: 'route:' + id, p: W.M(p), text, cls: 'probe' }); };
      const closed = !R.drawing && points.length > 2 && V.dist(points[0], points[points.length - 1]) < 1e-8;
      points.forEach((p, i) => { if (closed && i === points.length - 1) return; if (R.routeMode !== 'formula' || i === 0 || i === points.length - 1) mark(p, i === 0 ? closed ? L('起点/终点', 'Start/End') : L('起点', 'Start') : i === points.length - 1 && !R.drawing ? L('终点', 'End') : 'R' + i, 'point:' + i, i === 0 ? C.pos : C.probe); });
      if (!R.drawing && valid()) {
        let p;
        try { p = position(); }
        catch (_) { R.stop(); R.enabled = false; if (reading) reading.textContent = 'V = —'; W.r.setScene(baseScene); refresh(); U.toast(L('该位置的路径公式未定义，请调整公式或参数范围。', 'The route formula is undefined here. Adjust the formula or parameter range.')); return; }
        const field = W.last[1].R.field(p); mark(p, L('探针', 'Probe'), 'probe');
        if (field.E?.every(Number.isFinite) && V.len(field.E) > 1e-12) sc.arrows.push({ p: W.M(p), v: V.mul(V.norm(field.E), W.AD * .3), color: C.sum, width: 2, head: W.AD * .06 });
        if (reading) reading.textContent = 'V = ' + (Number.isFinite(field.V) ? U.fmt(field.V, 5) : L('未定义', 'undefined'));
      }
    }
    W.r.setScene(sc); refresh();
  };
  const show = W.show;
  W.show = function (...args) {
    show.apply(W, args); baseScene = W.r.scene;
    if (lastProblem !== args[0]) { R.stop(); backup = null; R.enabled = false; R.drawing = false; R.points = []; R.samples = null; R.routeMode = 'waypoints'; R.t = 0; lastProblem = args[0]; }
    R.draw();
  };
  function animate(now) {
    if (!R.playing) return;
    if (previousTime) R.t += Math.min(.1, (now - previousTime) / 1000) / 10;
    previousTime = now;
    if (R.t >= 1) { R.t = 1; R.stop(); }
    R.draw(); if (R.playing) frame = requestAnimationFrame(animate);
  }
  R.play = () => { if (!valid() || R.drawing) return; if (R.playing) return R.stop(); if (R.t >= 1) R.t = 0; R.enabled = true; R.playing = true; previousTime = 0; frame = requestAnimationFrame(animate); refresh(); };
  R.finish = () => { if (!P.validPath(R.points)) return U.toast(L('至少选择两个不同的点。', 'Select at least two distinct points.')); R.drawing = false; R.t = 0; backup = null; R.draw(); };
  R.cancel = () => { if (backup) Object.assign(R, backup); R.drawing = false; backup = null; R.draw(); };
  const begin = () => { R.stop(); backup = { points: R.points.map(p => p.slice()), enabled: R.enabled, routeMode: R.routeMode, t: R.t }; R.enabled = true; R.drawing = true; R.routeMode = 'waypoints'; R.points = []; R.t = 0; dialog.close(); R.draw(); };
  const action = (text, fn, cls) => U.h('button', { type: 'button', class: 'btn mini ' + (cls || ''), onclick: fn }, text);
  function openSettings() {
    if (!W.last) return;
    if (R.drawing) R.cancel();
    dialog.replaceChildren();
    const header = U.h('header', null, U.h('b', null, L('自主探针路径', 'Independent probe route')), action('×', () => dialog.close()));
    const enabled = U.h('input', { type: 'checkbox', checked: R.enabled });
    enabled.addEventListener('change', () => { if (!enabled.checked) { if (R.drawing) R.cancel(); R.stop(); backup = null; } R.enabled = enabled.checked; R.draw(); });
    const label = (text, input) => U.h('label.route-field', null, U.h('span', null, text), input);
    const plane = U.h('select', { 'aria-label': L('绘制平面', 'Drawing plane') }, ['xy','xz','yz'].map(k => U.h('option', { value: k, selected: R.plane === k }, k)));
    const offset = U.h('input', { type: 'number', step: '.1', value: R.offset, 'aria-label': L('平面位置', 'Plane position') });
    const inputs = {};
    for (const axis of ['x','y','z']) inputs[axis] = U.h('input', { type: 'text', value: R.formula[axis], 'aria-label': axis + '(t)', spellcheck: 'false' });
    for (const key of ['min','max']) inputs[key] = U.h('input', { type: 'number', value: R.formula[key], 'aria-label': key === 'min' ? L('参数起值', 'Parameter start') : L('参数终值', 'Parameter end') });
    const applyFormula = () => {
      try {
        const f = { x: inputs.x.value, y: inputs.y.value, z: inputs.z.value, min: Number(inputs.min.value), max: Number(inputs.max.value) }, samples = P.sampleFormula(f);
        if (samples.length < 2 || !samples.some(p => V.dist(p,samples[0]) > 1e-8)) throw Error();
        R.stop(); backup = null; R.formula = f; R.samples = samples; R.routeMode = 'formula'; R.enabled = true; R.drawing = false; R.t = 0; dialog.close(); R.draw();
      } catch (_) { U.toast(L('路径公式无效，请检查函数、参数范围及有限坐标。', 'Invalid route formula. Check functions, parameter range and finite coordinates.')); }
    };
    const points = U.h('textarea', { rows: 3, 'aria-label': L('路径点坐标', 'Route waypoint coordinates') }, R.points.map(p => p.join(', ')).join('\n'));
    const applyPoints = () => {
      try { const pts = P.parse(points.value); if (!P.validPath(pts) || pts.length > 64) throw Error(); R.stop(); backup = null; R.points = pts; R.routeMode = 'waypoints'; R.enabled = true; R.drawing = false; R.t = 0; dialog.close(); R.draw(); }
      catch (_) { U.toast(L('请输入2至64个有效三维坐标，且至少两个点不同。', 'Enter 2–64 valid 3D coordinates with at least two distinct points.')); }
    };
    dialog.append(header, U.h('label.route-check', null, enabled, U.h('span', null, L('显示独立探针与路径', 'Show independent probe and route'))),
      U.h('p.note', null, L('此探针不改变题设、答案或引导探究。', 'This probe does not change the problem, answers or guided inquiry.')),
      U.h('section', null, U.h('h3', null, L('函数路径', 'Parametric route')), ...['x','y','z'].map(a => label(a + '(t) =', inputs[a])),
        U.h('div.route-row', null, label(L('t 起值', 't start'), inputs.min), label(L('t 终值', 't end'), inputs.max)),
        U.h('p.note', null, L('支持 t、pi、sin、cos、sqrt 等。坐标使用题目单位。', 'Use t, pi, sin, cos, sqrt, etc. Coordinates use problem units.')), action(L('应用函数', 'Apply formula'), applyFormula, 'primary')),
      U.h('section', null, U.h('h3', null, L('逐点选择折线', 'Pick a polyline')),
        U.h('div.route-row', null, label(L('平面', 'Plane'), plane), label(L('位置 / L', 'Position / L'), offset)),
        U.h('p.note', null, L('点击特殊点可吸附；空白处在所选平面落点。结束后最后一点为终点。', 'Snap to special points or place points on the selected plane. Finish to mark the last point as the endpoint.')),
        action(L('在模型上选点', 'Pick on model'), () => { const value = Number(offset.value); if (!Number.isFinite(value) || Math.abs(value) > 1000) return; R.plane = plane.value; R.offset = value; begin(); }, 'primary'),
        label(L('或输入坐标，每行 x, y, z', 'Or enter x, y, z per line'), points), action(L('应用坐标', 'Apply coordinates'), applyPoints)));
    dialog.showModal();
  }
  window.addEventListener('DOMContentLoaded', () => {
    const tools = document.querySelector('.ex-layout-tools'); if (!tools || !W.r) return;
    dialog = U.h('dialog.ex-route-dialog'); document.querySelector('.view').append(dialog);
    const settings = U.h('button', { type: 'button', id: 'exProbeRoute', title: L('探针与路径', 'Probe and route'), 'aria-label': L('探针与路径', 'Probe and route'), onclick: openSettings }, '◎'); tools.querySelector('.ex-panel-tools').insertBefore(settings, tools.querySelector('.ex-layout-spacer'));
    const progress = U.h('input', { type: 'range', class: 'route-progress', min: 0, max: 1, step: .001, value: 0, 'aria-label': L('自主路径进度', 'Independent route progress') });
    progress.addEventListener('input', () => { R.stop(); R.t = Number(progress.value); R.draw(); });
    reading = U.h('output.route-reading', null, 'V = —'); controls = U.h('div.ex-route-controls');
    controls.append(progress, U.h('button', { type: 'button', class: 'route-play', title: L('播放路径', 'Play route'), onclick: R.play }, '▶'), reading,
      action(L('结束', 'Finish'), R.finish, 'route-drawing'), action(L('撤销点', 'Undo point'), () => { R.points.pop(); R.draw(); }, 'route-drawing'), action(L('取消', 'Cancel'), R.cancel, 'route-drawing')); tools.append(controls);
    const stage = U.$('#stage');
    stage.addEventListener('pointerdown', e => {
      if (!R.drawing || e.button !== 0 || e.target.closest('button,.tools,.stagebar,.model-corner')) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const box = W.r.canvas.getBoundingClientRect(), R0 = W.last[1].R;
      const candidates = Object.keys(R0.pts).filter(n => R0.pts[n].p).map(n => ({ p: W.M(R0.pts[n].p), name: n }));
      const normal = R.plane === 'xy' ? [0,0,1] : R.plane === 'xz' ? [0,1,0] : [1,0,0], origin = V.mul(normal, R.offset * W.AD / (R0.ext || 1));
      const selected = P.pickPoint(W.r, candidates, e.clientX - box.left, e.clientY - box.top, { origin, normal }); if (!selected) return;
      const p = V.mul(selected.p, (R0.ext || 1) / W.AD);
      if (R.points.length >= 64) return U.toast(L('最多64个路径点。', 'Up to 64 waypoints.'));
      if (!R.points.length || V.dist(p,R.points[R.points.length-1]) > 1e-8) R.points.push(p); R.draw();
    }, true);
    stage.addEventListener('dblclick', e => { if (R.drawing) { e.preventDefault(); e.stopImmediatePropagation(); R.finish(); } }, true);
    document.addEventListener('keydown', e => { if (R.drawing && e.key === 'Escape') { e.preventDefault(); R.cancel(); } if (R.drawing && e.key === 'Enter' && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); R.finish(); } });
    R.draw();
  });
})(window.EL);
