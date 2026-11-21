'use strict';
// 逐帧绘制：不透明网格 → 线 → 透明网格 → 叠加光晕与流动粒子 → HTML 标签
(function (EL) {
  const V = EL.V, M = EL.M, R = EL.Renderer.prototype, LF = EL.Renderer.LF;

  R.draw = function () {
    const gl = this.gl, sc = this.scene, cam = this.cam, T = EL.C;
    this.resize();
    cam.step && cam.step();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const vp = cam.matrices(), eye = cam.eye(), is3d = cam.mode !== '2d';
    const span = cam.radius || 6, fog = is3d ? T.fog : 0;
    const fogU = p => { gl.uniform1f(p.u.uFog, fog); gl.uniform1f(p.u.uFogNear, cam.dist - span * 0.6); gl.uniform1f(p.u.uFogFar, cam.dist + span * 1.6); };
    // 网格
    const mp = this.mp;
    gl.useProgram(mp.p);
    gl.uniformMatrix4fv(mp.u.uVP, false, vp);
    gl.uniform3fv(mp.u.uEye, eye); gl.uniform3fv(mp.u.uBg, T.bg); fogU(mp);
    gl.enableVertexAttribArray(mp.a.aP); gl.enableVertexAttribArray(mp.a.aN);
    const drawMesh = (mesh, m, color, lit, rim) => {
      const b = this.buf(mesh);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.vertexAttribPointer(mp.a.aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.n); gl.vertexAttribPointer(mp.a.aN, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(mp.u.uM, false, m);
      gl.uniform4f(mp.u.uColor, color[0], color[1], color[2], color[3] == null ? 1 : color[3]);
      gl.uniform1f(mp.u.uLit, lit === false ? 0 : 1);
      gl.uniform1f(mp.u.uRim, rim == null ? 0.55 : rim);
      gl.drawArrays(gl.TRIANGLES, 0, b.count);
    };
    const I = M.ident(), meshes = sc.meshes || [];
    gl.depthMask(true);
    for (const o of meshes) if (o.mesh.count && (o.color[3] == null || o.color[3] >= 0.999)) drawMesh(o.mesh, I, o.color, o.lit);
    for (const s of sc.spheres || []) drawMesh(this.sphere, M.basis([s.r, 0, 0], [0, s.r, 0], [0, 0, s.r], s.p), s.color, true, 0.8);
    for (const h of this.heads || []) if (!h.revealAt || 1 - Math.pow(1 - this.reveal, 3) >= h.revealAt) drawMesh(this.cone, h.m, h.color, true, 0.3);
    gl.disableVertexAttribArray(mp.a.aP); gl.disableVertexAttribArray(mp.a.aN);
    // 线
    if (this.lineCount) {
      const lp = this.lp, F = 4, names = ['aA', 'aB', 'aST', 'aColor', 'aFr'];
      gl.useProgram(lp.p);
      gl.uniformMatrix4fv(lp.u.uVP, false, vp);
      gl.uniform2f(lp.u.uRes, this.canvas.width / 2, this.canvas.height / 2);
      gl.uniform1f(lp.u.uReveal, this.reveal >= 1 ? 2 : 1 - Math.pow(1 - this.reveal, 3));
      gl.uniform3fv(lp.u.uBg, T.bg); fogU(lp);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      const at = (n, size, off) => { gl.enableVertexAttribArray(lp.a[n]); gl.vertexAttribPointer(lp.a[n], size, gl.FLOAT, false, LF * F, off * F); };
      at('aA', 3, 0); at('aB', 3, 3); at('aST', 3, 6); at('aColor', 4, 9); at('aFr', 2, 13);
      gl.depthMask(false);
      gl.drawArrays(gl.TRIANGLES, 0, this.lineCount);
      gl.depthMask(true);
      for (const n of names) gl.disableVertexAttribArray(lp.a[n]);
    }
    // 透明网格：由远及近，不写深度
    const vd = cam.viewDir();
    const tr = meshes.filter(o => o.mesh.count && o.color[3] != null && o.color[3] < 0.999);
    tr.forEach(o => this.buf(o.mesh));
    tr.sort((a, b) => V.dot(b.mesh.ctr, vd) - V.dot(a.mesh.ctr, vd));
    gl.useProgram(mp.p);
    gl.enableVertexAttribArray(mp.a.aP); gl.enableVertexAttribArray(mp.a.aN);
    gl.depthMask(false);
    for (const o of tr) drawMesh(o.mesh, I, o.color, o.lit, o.lit === false ? 0 : 0.9);
    gl.disableVertexAttribArray(mp.a.aP); gl.disableVertexAttribArray(mp.a.aN);
    // 叠加：电荷光晕（呼吸）与流动粒子
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const pxScale = cam.p5 * this.canvas.height / 2;
    if (this.fx.glow && (sc.glows || []).length) {
      const n = sc.glows.length, P = new Float32Array(n * 3), C = new Float32Array(n * 4), S = new Float32Array(n);
      sc.glows.forEach((g, i) => {
        const k = 1 + 0.12 * Math.sin(this.t * 2.2 + (g.phase || 0));
        P.set(g.p, i * 3); C.set([g.color[0], g.color[1], g.color[2], (g.a || 0.55) * (0.85 + 0.15 * k)], i * 4); S[i] = g.r * 2 * k;
      });
      this.sprites(vp, pxScale, P, C, S, 1);
    }
    if (this.flow.n) {
      const k = this.flow.base * 0.16 * (cam.mode === '2d' ? 1.1 : 1), S = this.flow.size.map(s => s * k);
      this.sprites(vp, pxScale, this.flow.pos, this.flow.col, S, 0.35);
    }
    gl.depthMask(true);
    this.overlay.dataset.theme = EL.C.lbl;
    this.drawLabels();
  };

  R.sprites = function (vp, scale, P, C, S, soft) {
    const gl = this.gl, sp = this.sp, b = this.spBuf;
    gl.useProgram(sp.p);
    gl.uniformMatrix4fv(sp.u.uVP, false, vp);
    gl.uniform1f(sp.u.uScale, scale); gl.uniform1f(sp.u.uSoft, soft); gl.uniform1f(sp.u.uFog, this.cam.mode === '2d' ? 0 : EL.C.fog);
    gl.uniform1f(sp.u.uFogNear, this.cam.dist - (this.cam.radius || 6) * 0.6); gl.uniform1f(sp.u.uFogFar, this.cam.dist + (this.cam.radius || 6) * 1.6);
    const at = (buf, data, name, size) => { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(sp.a[name]); gl.vertexAttribPointer(sp.a[name], size, gl.FLOAT, false, 0, 0); };
    at(b.p, P, 'aP', 3); at(b.c, C, 'aC', 4); at(b.s, S instanceof Float32Array ? S : new Float32Array(S), 'aS', 1);
    gl.depthMask(false);
    gl.drawArrays(gl.POINTS, 0, P.length / 3);
    for (const n of ['aP', 'aC', 'aS']) gl.disableVertexAttribArray(sp.a[n]);
  };

  R.getLabelKey = function (L, index) {
    if (L.id != null) return String(L.id);
    const stem = (L.cls || '') + ':' + String(L.text), labels = this.scene.labels || [];
    let duplicate = 0;
    for (let i = 0; i < index; i++) if ((labels[i].cls || '') + ':' + String(labels[i].text) === stem) duplicate++;
    return stem + (duplicate ? ':' + duplicate : '');
  };
  R.isLabelVisible = function (L, index) {
    const state = this.labelPreferences.get(this.getLabelKey(L, index));
    return state && state.visible != null ? state.visible : !L.hidden;
  };
  R.setLabelVisible = function (key, visible) {
    this.labelPreferences.set(key, Object.assign({}, this.labelPreferences.get(key), { visible: !!visible }));
    this.draw();
  };
  R.nearLabelOffset = function (span, dx, dy) {
    const w = span?._w || 40, h = span?._h || 20, gap = 32;
    let x = dx + 7 + w / 2, y = dy - 18 + h / 2;
    const scale = Math.max(1, Math.hypot(x / (w / 2 + gap), y / (h / 2 + gap)));
    x /= scale; y /= scale;
    return [x - w / 2 - 7, y - h / 2 + 18];
  };
  R.moveLabel = function (key, dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const span = (this.labelPool || []).find(s => s.dataset.labelKey === key);
    [dx, dy] = this.nearLabelOffset(span, dx, dy);
    this.labelPreferences.set(key, Object.assign({}, this.labelPreferences.get(key), { dx, dy }));
    this.draw();
  };
  R.resetLabelOffsets = function (key) {
    for (const [id, state] of this.labelPreferences) if (key == null || key === id) { delete state.dx; delete state.dy; }
    for (const s of this.labelPool || []) if (key == null || s.dataset.labelKey === key) s._autoKey = null;
    this.draw();
  };
  R.resetLabels = function () { this.labelPreferences.clear(); for (const s of this.labelPool || []) s._autoKey = null; this.draw(); };

  R.labelMenu = function (event, key) {
    event.preventDefault(); event.stopPropagation();
    const en = document.documentElement.lang.startsWith('en');
    if (!this._labelMenu) {
      this._labelMenu = document.createElement('div');
      this._labelMenu.className = 'annotation-menu';
      this.overlay.parentElement.append(this._labelMenu);
      document.addEventListener('pointerdown', e => { if (!this._labelMenu.contains(e.target)) this._labelMenu.hidden = true; });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') this._labelMenu.hidden = true; });
    }
    const menu = this._labelMenu;
    menu.replaceChildren();
    const add = (text, action) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
      button.addEventListener('click', () => { action(); menu.hidden = true; }); menu.append(button);
    };
    if (key != null) {
      add(en ? 'Hide this label' : '隐藏此标注', () => this.setLabelVisible(key, false));
      const label = (this.labelPool || []).find(s => s.dataset.labelKey === key), state = this.labelPreferences.get(key) || {};
      const values = { dx: state.dx == null ? label?._dx || 0 : state.dx, dy: state.dy == null ? label?._dy || 0 : state.dy };
      const row = document.createElement('div'); row.className = 'annotation-position';
      for (const [axis, text] of [['dx', en ? 'Horizontal' : '水平'], ['dy', en ? 'Vertical' : '垂直']]) {
        const field = document.createElement('label'), name = document.createElement('span'), input = document.createElement('input');
        name.textContent = text; input.type = 'number'; input.step = '2'; input.value = Math.round(values[axis]); input.setAttribute('aria-label', text);
        input.addEventListener('change', () => { const n = Number(input.value); if (!Number.isFinite(n)) { input.value = Math.round(values[axis]); return; } values[axis] = n; this.moveLabel(key, values.dx, values.dy); Object.assign(values, this.labelPreferences.get(key)); row.querySelectorAll('input').forEach((field, i) => { field.value = Math.round(values[i ? 'dy' : 'dx']); }); });
        field.append(name, input); row.append(field);
      }
      menu.append(row);
      add(en ? 'Reset this label position' : '重置此标注位置', () => this.resetLabelOffsets(key));
    }
    add(en ? 'Restore default labels' : '恢复默认标注', () => this.resetLabels());
    menu.dataset.theme = EL.C.lbl; menu.hidden = false;
    menu.style.left = Math.max(8, Math.min(event.clientX, innerWidth - menu.offsetWidth - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(event.clientY, innerHeight - menu.offsetHeight - 8)) + 'px';
  };

  R.bindLabel = function (span) {
    let press = null, timer = null;
    const end = () => { clearTimeout(timer); timer = null; press = null; span.classList.remove('dragging'); this.labelDrag = null; };
    span.addEventListener('contextmenu', e => {
      if (press && press.pointerType === 'touch') { e.preventDefault(); e.stopPropagation(); return; }
      this.labelMenu(e, span.dataset.labelKey);
    });
    span.tabIndex = 0;
    span.addEventListener('keydown', e => {
      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }, d = directions[e.key];
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      const state = this.labelPreferences.get(span.dataset.labelKey) || {}, step = e.shiftKey ? 10 : 2;
      this.moveLabel(span.dataset.labelKey, (state.dx == null ? span._dx || 0 : state.dx) + d[0] * step, (state.dy == null ? span._dy || 0 : state.dy) + d[1] * step);
    });
    span.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      press = { key: span.dataset.labelKey, pointerType: e.pointerType, x: e.clientX, y: e.clientY, dx: span._dx, dy: span._dy, active: false };
      span.setPointerCapture(e.pointerId);
      timer = setTimeout(() => { if (press) { press.active = true; this.labelDrag = press.key; span.classList.add('dragging'); } }, 450);
    });
    span.addEventListener('pointermove', e => {
      if (!press) return;
      if (!press.active) { if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 7) end(); return; }
      e.preventDefault(); e.stopPropagation();
      const dx = press.dx + e.clientX - press.x, dy = press.dy + e.clientY - press.y;
      this.moveLabel(press.key, dx, dy);
    });
    span.addEventListener('pointerup', end); span.addEventListener('pointercancel', end); span.addEventListener('lostpointercapture', end);
  };

  R.drawLabels = function () {
    const labs = this.scene.labels || [], pool = this.labelPool, ov = this.overlay, placed = [], named = [];
    this.labelsMoving = false;
    const area = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    // Solid objects and view controls are obstacles; surfaces/lines stay behind opaque label plates.
    const obstacles = (this.scene.spheres || []).map(o => {
      const q = this.cam.toScreen(o.p);
      if (!q || q[2] < -1 || q[2] > 1) return null;
      const side = V.norm(V.cross(this.cam.viewDir(), Math.abs(this.cam.viewDir()[2]) > 0.95 ? [0, 1, 0] : [0, 0, 1]));
      const e = this.cam.toScreen(V.add(o.p, V.mul(side, o.r)));
      const r = e ? Math.max(3, Math.hypot(e[0] - q[0], e[1] - q[1])) : 3;
      return [q[0] - r, q[1] - r, q[0] + r, q[1] + r];
    }).filter(Boolean);
    const rect = ov.getBoundingClientRect();
    ov.parentElement.querySelectorAll('.hud,.tools,.legend,.stagebar').forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.width && b.height && getComputedStyle(el).visibility !== 'hidden') obstacles.push([b.left - rect.left, b.top - rect.top, b.right - rect.left, b.bottom - rect.top]);
    });
    while (pool.length < labs.length) { const s = document.createElement('span'); this.bindLabel(s); ov.append(s); pool.push(s); }
    pool.forEach((s, i) => {
      const L = labs[i];
      if (!L || L.text == null || L.text === '' || !this.isLabelVisible(L, i)) { s.style.display = 'none'; return; }
      // A probe and a construction point can have the same name at the same position.
      if (named.some(o => o.text === L.text && V.dist(o.p, L.p) < 1e-6)) { s.style.display = 'none'; return; }
      named.push(L);
      const q = this.cam.toScreen(L.p);
      if (!q || q[2] > 1 || q[2] < -1 || q[0] < 0 || q[0] > this.cam.w || q[1] < 0 || q[1] > this.cam.h) { s.style.display = 'none'; return; }
      const cls = 'lbl ' + (L.cls || '');
      if (s.className.replace(' dragging', '') !== cls) { s.className = cls; s._w = 0; }
      if (s._t !== L.text) { s._t = L.text; s.innerHTML = EL.U.rich(L.text); s._w = 0; }
      const key = this.getLabelKey(L, i), state = this.labelPreferences.get(key) || {};
      s.dataset.labelKey = key;
      s.title = document.documentElement.lang.startsWith('en') ? 'Hold and drag near the element; right-click for settings' : '长按拖动，在元素附近调整；右键设置';
      s.style.display = '';
      if (!s._w) { s._w = s.offsetWidth || 8 * String(L.text).length; s._h = s.offsetHeight || 16; }
      const manual = state.dx != null || state.dy != null;
      let dx = state.dx == null ? L.offset?.[0] || 0 : state.dx, dy = state.dy == null ? L.offset?.[1] || 0 : state.dy;
      [dx, dy] = this.nearLabelOffset(s, dx, dy);
      const box = (a, b) => {
        const x = Math.max(3, Math.min(q[0] + 7 + a, this.cam.w - s._w - 3)), y = Math.max(3, Math.min(q[1] - 18 + b, this.cam.h - s._h - 3));
        return [x, y, x + s._w + 3, y + s._h + 3];
      };
      if (!manual) {
        const fresh = s._autoKey !== key;
        if (fresh) { s._autoKey = key; s._autoDx = dx; s._autoDy = dy; }
        const previous = this.nearLabelOffset(s, s._autoDx, s._autoDy);
        const candidates = [previous, [dx, dy], this.nearLabelOffset(s, -s._w - 14, dy)];
        for (const radius of [16, 28, 40]) for (let j = 0; j < 12; j++) candidates.push(this.nearLabelOffset(s, dx + radius * Math.cos(j * Math.PI / 6), dy + radius * Math.sin(j * Math.PI / 6)));
        const score = v => { const b = box(...v); return 100 * placed.reduce((n, p) => n + area(b, p), 0) + 20 * obstacles.reduce((n, p) => n + area(b, p), 0) + 0.03 * ((v[0] - dx) ** 2 + (v[1] - dy) ** 2) + 0.15 * ((v[0] - previous[0]) ** 2 + (v[1] - previous[1]) ** 2); };
        let best = previous, cost = score(best);
        for (const v of candidates) { const n = score(v); if (n + 1 < cost) { best = v; cost = n; } }
        const distance = Math.hypot(best[0] - previous[0], best[1] - previous[1]);
        const k = fresh || distance < 0.5 ? 1 : Math.min(1, 2.5 / distance);
        dx = previous[0] + (best[0] - previous[0]) * k; dy = previous[1] + (best[1] - previous[1]) * k;
        s._autoDx = dx; s._autoDy = dy;
        if (k < 1) this.labelsMoving = true;
      }
      const b = box(dx, dy), x = b[0], y = b[1];
      placed.push(b);
      s._x = x; s._y = y;
      s._dx = x - q[0] - 7; s._dy = y - q[1] + 18;
      s.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    });
  };

  // 导出 PNG：主题背景 + 画布 + 标签
  R.snapshot = function () {
    this.draw();
    const c = document.createElement('canvas'), dpr = this.canvas.width / this.cam.w;
    c.width = this.canvas.width; c.height = this.canvas.height;
    const g = c.getContext('2d'), bg = EL.C.bg;
    g.fillStyle = 'rgb(' + bg.map(x => Math.round(x * 255)).join(',') + ')';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(this.canvas, 0, 0);
    g.font = (13 * dpr) + 'px "Times New Roman", "Microsoft YaHei", serif';
    g.fillStyle = EL.C.lbl === 'dark' ? '#E6EDF6' : '#1d2b3a';
    (this.scene.labels || []).forEach((L, i) => {
      const label = this.labelPool[i];
      if (!label || label.style.display === 'none' || L.text == null) return;
      const style = getComputedStyle(label), x = label._x * dpr, y = label._y * dpr, w = label._w * dpr, h = label._h * dpr;
      g.fillStyle = style.backgroundColor; g.fillRect(x, y, w, h);
      g.strokeStyle = style.borderColor; g.lineWidth = dpr; g.strokeRect(x, y, w, h);
      g.font = style.fontWeight + ' ' + (parseFloat(style.fontSize) * dpr) + 'px ' + style.fontFamily;
      g.fillStyle = style.color; g.textBaseline = 'middle';
      g.fillText(EL.U.plain(L.text), x + (parseFloat(style.paddingLeft) + 1) * dpr, y + h / 2);
    });
    // The export watermark is painted into the pixels; the model is never rescaled.
    const pad = 10 * dpr, size = Math.max(11, Math.min(18, this.cam.w * 0.025)) * dpr;
    g.font = '600 ' + size + 'px "Microsoft YaHei", Arial, sans-serif';
    const text = EL.U.exportName, width = Math.min(c.width - 2 * pad, g.measureText(text).width + 2 * pad), height = size + 1.4 * pad;
    g.fillStyle = 'rgba(15, 28, 48, 0.86)';
    g.fillRect(c.width - width - pad, c.height - height - pad, width, height);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, c.width - width / 2 - pad, c.height - height / 2 - pad, Math.max(1, width - pad));
    return c.toDataURL('image/png');
  };
})(window.EL);
