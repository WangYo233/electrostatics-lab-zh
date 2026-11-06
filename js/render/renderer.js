'use strict';
// 场景上传：粗线、透明/不透明网格、球标记、箭头、光晕、流动粒子与 HTML 标签
// scene = { lines:[{pts,color,width,dash,reveal}], segs:[{segs,color,width}], meshes:[{mesh,color,lit}],
//           spheres:[{p,r,color}], arrows:[{p,v,color,width,head}], glows:[{p,r,color,phase}], labels:[{p,text,cls}], flow }
(function (EL) {
  const V = EL.V, M = EL.M, G = EL.G;
  const LF = 15; // 每个线顶点的浮点数

  function Renderer(canvas, overlay) {
    this.canvas = canvas; this.overlay = overlay;
    const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true, alpha: true, premultipliedAlpha: true });
    if (!gl) throw new Error('浏览器不支持 WebGL');
    this.gl = gl;
    this.lp = G.program(gl, G.LINE_VS, G.LINE_FS);
    this.mp = G.program(gl, G.MESH_VS, G.MESH_FS);
    this.sp = G.program(gl, G.SPRITE_VS, G.SPRITE_FS);
    this.lineBuf = gl.createBuffer(); this.lineCount = 0;
    this.spBuf = { p: gl.createBuffer(), c: gl.createBuffer(), s: gl.createBuffer() };
    this.cache = new Map();
    this.sphere = G.unitSphere(); this.cone = G.unitCone();
    this.scene = {}; this.labelPool = [];
    this.cam = new EL.Camera();
    this.flow = new EL.Flow();
    this.fx = { paused: false, glow: true, density: 1, speed: 1, map: 'sqrt', reveal: true };
    this.reveal = 1; this.revealT0 = 0;
    this.t = 0; this.last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now; this.t += dt;
      const busy = (this.flow.n && !this.fx.paused) || (this.fx.glow && (this.scene.glows || []).length) || this.cam.tw || this.reveal < 1;
      if (busy && !document.hidden) {
        if (this.reveal < 1) this.reveal = Math.min(1, (now - this.revealT0) / 900);
        if (this.flow.n) this.flow.step(this.fx.paused ? 0 : dt, this.fx.speed, EL.C.flow);
        this.draw();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // 去掉近似共线的点，减少线段数
  function decimate(pts) {
    if (pts.length < 4) return pts.map((p, i) => [p, i / Math.max(1, pts.length - 1)]);
    const out = [[pts[0], 0]], n = pts.length - 1;
    let last = pts[0];
    for (let i = 1; i < n; i++) {
      const a = V.sub(pts[i], last), b = V.sub(pts[i + 1], pts[i]);
      const la = V.len(a), lb = V.len(b);
      if (la > 0 && lb > 0 && V.dot(a, b) / (la * lb) < 0.9995) { out.push([pts[i], i / n]); last = pts[i]; }
    }
    out.push([pts[n], 1]);
    return out;
  }
  function dashes(pts, on, off) {
    const out = [];
    let cur = [pts[0]], phase = 0, drawing = true;
    for (let i = 1; i < pts.length; i++) {
      let a = pts[i - 1];
      const b = pts[i];
      let L = V.dist(a, b);
      while (L > 0) {
        const lim = (drawing ? on : off) - phase;
        if (L < lim) { phase += L; if (drawing) cur.push(b); break; }
        const p = V.lerp(a, b, lim / L);
        if (drawing) { cur.push(p); out.push(cur); } else cur = [p];
        drawing = !drawing; phase = 0; L -= lim; a = p;
      }
    }
    if (drawing && cur.length > 1) out.push(cur);
    return out;
  }

  // 触发场线“绘出”动画
  Renderer.prototype.playReveal = function () {
    if (!this.fx.reveal) return;
    this.reveal = 0; this.revealT0 = performance.now();
  };

  Renderer.prototype.setScene = function (scene) {
    this.scene = scene;
    for (const s of this.labelPool) s._w = 0; // 标注尺寸可能随字号变化，场景更新时重新测量
    const gl = this.gl, dpr = window.devicePixelRatio || 1, data = [];
    const pushSeg = (a, b, c, hw, fa, fb) => {
      const al = c[3] == null ? 1 : c[3];
      const v = (s, t) => data.push(a[0], a[1], a[2], b[0], b[1], b[2], s, t, hw, c[0], c[1], c[2], al, fa, fb);
      v(-1, 0); v(1, 0); v(1, 1); v(-1, 0); v(1, 1); v(-1, 1);
    };
    const HW = w => Math.max(0.5, (w || 1) * dpr * 0.5);
    for (const L of scene.lines || []) {
      if (!L.pts || L.pts.length < 2) continue;
      const hw = HW(L.width);
      if (L.dash) { for (const d of dashes(L.pts, L.dash[0], L.dash[1])) for (let i = 1; i < d.length; i++) pushSeg(d[i - 1], d[i], L.color, hw, 0, 0); continue; }
      const q = decimate(L.pts);
      for (let i = 1; i < q.length; i++) pushSeg(q[i - 1][0], q[i][0], L.color, hw, L.reveal ? q[i - 1][1] : 0, L.reveal ? q[i][1] : 0);
    }
    for (const S of scene.segs || []) { const hw = HW(S.width); for (const s of S.segs) pushSeg(s[0], s[1], S.color, hw, 0, 0); }
    this.heads = [];
    // 箭头头部：未指定 head 的矢量一律用同一大小（与画板尺度成比例，不随矢量长度变化），
    // 只有矢量很短时才缩到矢量长度的 45%，避免头部比矢量还长
    const H0 = scene.headSize || (this.cam.radius || 6) * 0.042;
    for (const A of scene.arrows || []) {
      const L = V.len(A.v);
      if (!(L > 1e-9)) continue;
      const d = V.mul(A.v, 1 / L), hd = Math.min(A.head || H0, L * 0.45), end = V.add(A.p, A.v);
      const hw = HW(A.width || 2), sh = V.addS(end, d, -hd * 0.8);
      pushSeg(A.p, sh, A.color, hw, A.reveal ? 0.45 : 0, A.reveal ? 0.45 : 0);
      const u = V.perp(d), w = V.cross(d, u), r = hd * 0.38;
      this.heads.push({ m: M.basis(V.mul(u, r), V.mul(w, r), V.mul(d, hd), V.addS(end, d, -hd)), color: A.color });
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
    this.lineCount = data.length / LF;
    this.flow.set(scene.flow || null, this.fx.density);
    // 网格缓冲缓存：只上传新网格，释放不再使用的
    const used = new Set([this.sphere, this.cone]);
    for (const m of scene.meshes || []) used.add(m.mesh);
    for (const [k, b] of this.cache) if (!used.has(k)) { gl.deleteBuffer(b.p); gl.deleteBuffer(b.n); this.cache.delete(k); }
    this.draw();
  };

  Renderer.prototype.buf = function (mesh) {
    let b = this.cache.get(mesh);
    if (!b) {
      const gl = this.gl;
      b = { p: gl.createBuffer(), n: gl.createBuffer(), count: mesh.count };
      gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.bufferData(gl.ARRAY_BUFFER, mesh.pos, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.n); gl.bufferData(gl.ARRAY_BUFFER, mesh.nrm, gl.STATIC_DRAW);
      if (!mesh.ctr) {
        const s = [0, 0, 0];
        for (let i = 0; i < mesh.pos.length; i += 3) { s[0] += mesh.pos[i]; s[1] += mesh.pos[i + 1]; s[2] += mesh.pos[i + 2]; }
        mesh.ctr = V.mul(s, 3 / Math.max(3, mesh.pos.length));
      }
      this.cache.set(mesh, b);
    }
    return b;
  };

  Renderer.prototype.resize = function () {
    const c = this.canvas, dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, c.clientWidth), h = Math.max(1, c.clientHeight);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    this.cam.w = w; this.cam.h = h;
  };

  EL.Renderer = Renderer;
  EL.Renderer.LF = LF;
})(window.EL);
