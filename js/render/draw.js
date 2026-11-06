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
    for (const h of this.heads || []) drawMesh(this.cone, h.m, h.color, true, 0.3);
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

  R.drawLabels = function () {
    const labs = this.scene.labels || [], pool = this.labelPool, ov = this.overlay, placed = [];
    while (pool.length < labs.length) { const s = document.createElement('span'); ov.append(s); pool.push(s); }
    pool.forEach((s, i) => {
      const L = labs[i];
      if (!L || L.text == null || L.text === '') { s.style.display = 'none'; return; }
      const q = this.cam.toScreen(L.p);
      if (!q || q[2] > 1 || q[2] < -1) { s.style.display = 'none'; return; }
      const cls = 'lbl ' + (L.cls || '');
      if (s.className !== cls) { s.className = cls; s._w = 0; }
      if (s._t !== L.text) { s._t = L.text; s.innerHTML = EL.U.rich(L.text); s._w = 0; }
      s.style.display = '';
      let x = q[0] + 7, y = q[1] - 18;
      // 矢量、角度标注互不遮挡：与已放置的标注重叠时向下移一行（最多移 3 次）
      if (/\b(vec|ang|probe)\b/.test(cls)) {
        if (!s._w) { s._w = s.offsetWidth || 8 * String(L.text).length; s._h = s.offsetHeight || 16; }
        const w = s._w, hh = s._h;
        for (let k = 0; k < 3; k++) {
          const hit = placed.find(r => x < r.x + r.w && r.x < x + w && y < r.y + r.h && r.y < y + hh);
          if (!hit) break;
          y = hit.y + hit.h + 1;
        }
        placed.push({ x, y, w, h: hh });
      }
      s._dy = y - (q[1] - 18);
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
      const q = this.cam.toScreen(L.p), dy = (this.labelPool[i] && this.labelPool[i]._dy) || 0;
      if (q && L.text != null) g.fillText(EL.U.plain(L.text), (q[0] + 7) * dpr, (q[1] - 4 + dy) * dpr);
    });
    return c.toDataURL('image/png');
  };
})(window.EL);
