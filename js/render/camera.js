'use strict';
// 相机：三维为 z 轴向上的轨道相机（透视），二维切片为沿截面法向的正交相机
(function (EL) {
  const V = EL.V, M = EL.M;

  function Camera() {
    this.mode = '3d';
    this.theta = -0.95; this.phi = 0.42; this.dist = 18;
    this.target = [0, 0, 0];
    this.plane = 'xy'; this.planePos = 0; this.half = 6; this.pan = [0, 0];
    this.w = 1; this.h = 1;
  }
  // 复位视角；animate 时平滑过渡（同一投影模式内）
  Camera.prototype.reset = function (R, is2d, animate) {
    const mode = is2d == null ? this.mode : is2d ? '2d' : '3d';
    const to = { theta: -0.95, phi: 0.42, dist: R * 3.1, target: [0, 0, 0], half: R * 1.08, pan: [0, 0] };
    this.radius = R;
    if (animate && mode === this.mode) return this.tween(to, 650);
    this.tw = null; Object.assign(this, to); this.mode = mode;
  };
  Camera.prototype.top = function () { this.tween({ theta: -Math.PI / 2, phi: 1.5607 }, 600); };
  Camera.prototype.tween = function (to, ms) {
    const from = { theta: this.theta, phi: this.phi, dist: this.dist, half: this.half, target: this.target.slice(), pan: this.pan.slice() };
    if (to.theta != null) { let d = to.theta - from.theta; d = Math.atan2(Math.sin(d), Math.cos(d)); to = Object.assign({}, to, { theta: from.theta + d }); }
    this.tw = { from, to, t0: performance.now(), ms };
  };
  Camera.prototype.step = function () {
    const w = this.tw;
    if (!w) return;
    let k = Math.min(1, (performance.now() - w.t0) / w.ms);
    const e = 1 - Math.pow(1 - k, 3), L = (a, b) => a + (b - a) * e;
    for (const key of ['theta', 'phi', 'dist', 'half']) if (w.to[key] != null) this[key] = L(w.from[key], w.to[key]);
    for (const key of ['target', 'pan']) if (w.to[key]) this[key] = w.from[key].map((x, i) => L(x, w.to[key][i]));
    if (k >= 1) this.tw = null;
  };
  Camera.prototype.eye = function () {
    if (this.mode === '2d') {
      const B = V.planeBasis(this.plane), c = this.center();
      return V.addS(c, V.cross(B.u, B.v), 1000);
    }
    const c = Math.cos(this.phi);
    return V.addS(this.target, [c * Math.cos(this.theta), c * Math.sin(this.theta), Math.sin(this.phi)], this.dist);
  };
  Camera.prototype.center = function () {
    const B = V.planeBasis(this.plane);
    return V.onPlane(B, this.pan[0], this.pan[1], this.planePos);
  };
  Camera.prototype.matrices = function () {
    const asp = this.w / this.h;
    let view, proj;
    if (this.mode === '2d') {
      const B = V.planeBasis(this.plane), c = this.center();
      const nrm = V.cross(B.u, B.v);
      view = M.lookAt(V.addS(c, nrm, 1000), c, B.v);
      const hh = asp >= 1 ? this.half : this.half / asp, hw = hh * asp;
      proj = M.ortho(-hw, hw, -hh, hh, 1, 2000);
    } else {
      const e = this.eye();
      view = M.lookAt(e, this.target, [0, 0, 1]);
      proj = M.perspective(0.62, asp, Math.max(0.05, this.dist * 0.02), this.dist * 20);
    }
    this.p5 = proj[5];
    this.vp = M.mul(proj, view);
    this.ivp = M.invert(this.vp);
    return this.vp;
  };
  // 世界坐标 → 画布像素（CSS 像素）
  Camera.prototype.toScreen = function (p) {
    const c = M.xform(this.vp, p);
    if (c[3] <= 0) return null;
    return [(c[0] / c[3] * 0.5 + 0.5) * this.w, (0.5 - c[1] / c[3] * 0.5) * this.h, c[2] / c[3]];
  };
  Camera.prototype.ray = function (x, y) {
    const nx = x / this.w * 2 - 1, ny = 1 - y / this.h * 2;
    const a = M.xform(this.ivp, [nx, ny, -1]), b = M.xform(this.ivp, [nx, ny, 1]);
    const p0 = V.mul(a.slice(0, 3), 1 / a[3]), p1 = V.mul(b.slice(0, 3), 1 / b[3]);
    return { o: p0, d: V.norm(V.sub(p1, p0)) };
  };
  Camera.prototype.viewDir = function () { return V.norm(V.sub(this.mode === '2d' ? this.center() : this.target, this.eye())); };
  Camera.prototype.zoom = function (f) {
    if (this.mode === '2d') this.half = EL.U.clamp(this.half * f, 0.3, 200);
    else this.dist = EL.U.clamp(this.dist * f, 1, 400);
  };

  // 绑定指针交互：拖动把手 > 旋转/平移；滚轮与双指缩放
  Camera.prototype.attach = function (el, hooks) {
    const cam = this, ptrs = new Map();
    let drag = null, pinch = 0;
    const pos = e => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    el.addEventListener('pointerdown', e => {
      el.setPointerCapture(e.pointerId);
      cam.tw = null;
      const p = pos(e);
      ptrs.set(e.pointerId, p);
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); drag = null; return; }
      const hd = hooks.pick && hooks.pick(p[0], p[1]);
      if (hd) {
        let n = hd.plane;
        if (!n) n = cam.mode === '2d' ? V.planeBasis(cam.plane).n : cam.viewDir();
        drag = { type: 'handle', hd, n, o: hd.p.slice() };
        hooks.dragStart && hooks.dragStart(hd);
      } else drag = { type: (e.button === 2 || e.shiftKey || cam.mode === '2d') ? 'pan' : 'rot', last: p };
      e.preventDefault();
    });
    el.addEventListener('pointermove', e => {
      const p = pos(e);
      if (!ptrs.has(e.pointerId)) { hooks.hover && hooks.hover(p[0], p[1]); return; }
      ptrs.set(e.pointerId, p);
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch > 0) { cam.zoom(pinch / d); hooks.change(); }
        pinch = d; return;
      }
      if (!drag) return;
      if (drag.type === 'handle') {
        const r = cam.ray(p[0], p[1]), den = V.dot(r.d, drag.n);
        if (Math.abs(den) < 1e-6) return;
        const t = V.dot(V.sub(drag.o, r.o), drag.n) / den;
        drag.hd.move(V.addS(r.o, r.d, t));
        hooks.moved && hooks.moved();
        return;
      }
      const dx = p[0] - drag.last[0], dy = p[1] - drag.last[1];
      drag.last = p;
      if (drag.type === 'rot') {
        cam.theta -= dx * 0.008;
        cam.phi = EL.U.clamp(cam.phi + dy * 0.008, -1.56, 1.56);
      } else if (cam.mode === '2d') {
        // 每像素对应的世界长度
        const k = cam.w / cam.h >= 1 ? cam.half * 2 / cam.h : cam.half * 2 / cam.w;
        cam.pan[0] -= dx * k; cam.pan[1] += dy * k;
      } else {
        const fwd = cam.viewDir(), right = V.norm(V.cross(fwd, [0, 0, 1])), up = V.cross(right, fwd);
        const k = cam.dist * 0.0016;
        cam.target = V.add(cam.target, V.add(V.mul(right, -dx * k), V.mul(up, dy * k)));
      }
      hooks.change();
    });
    const end = e => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = 0;
      if (drag && drag.type === 'handle') hooks.dragEnd && hooks.dragEnd(drag.hd);
      drag = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('wheel', e => { e.preventDefault(); cam.zoom(e.deltaY > 0 ? 1.1 : 1 / 1.1); hooks.change(); }, { passive: false });
  };

  EL.Camera = Camera;
})(window.EL);
