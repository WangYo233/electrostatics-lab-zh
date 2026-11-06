'use strict';
// WebGL 着色器与基础几何（WebGL 1，无第三方依赖）
// 输出均为预乘 alpha，画布透明，CSS 渐变背景透出；深度雾化增加空间层次
(function (EL) {
  const G = {};
  const FOG = `
    uniform float uFog; uniform float uFogNear; uniform float uFogFar;
    float fogK(float w) { return uFog * clamp((w - uFogNear) / max(1e-3, uFogFar - uFogNear), 0.0, 1.0); }`;

  // 粗线：每段展开为屏幕空间四边形，边缘 1px 抗锯齿；aFr 为沿场线的弧长比例，用于“绘出”动画
  G.LINE_VS = `
    attribute vec3 aA; attribute vec3 aB; attribute vec3 aST; attribute vec4 aColor; attribute vec2 aFr;
    uniform mat4 uVP; uniform vec2 uRes; ${FOG}
    varying vec4 vColor; varying float vEdge; varying float vHW; varying float vFr; varying float vFog;
    void main() {
      vec4 ca = uVP * vec4(aA, 1.0), cb = uVP * vec4(aB, 1.0);
      vec4 c = mix(ca, cb, aST.y);
      vec2 d = (cb.xy / cb.w - ca.xy / ca.w) * uRes;
      float l = length(d);
      vec2 n = l > 1e-6 ? vec2(-d.y, d.x) / l : vec2(0.0, 1.0);
      float hw = aST.z + 1.0;
      c.xy += n * aST.x * hw / uRes * c.w;
      gl_Position = c;
      vColor = aColor; vEdge = aST.x * hw; vHW = aST.z; vFr = mix(aFr.x, aFr.y, aST.y); vFog = fogK(c.w);
    }`;
  G.LINE_FS = `
    precision mediump float;
    uniform float uReveal; uniform vec3 uBg;
    varying vec4 vColor; varying float vEdge; varying float vHW; varying float vFr; varying float vFog;
    void main() {
      if (vFr > uReveal) discard;
      float a = clamp(vHW + 0.5 - abs(vEdge), 0.0, 1.0) * vColor.a * (1.0 - 0.65 * vFog);
      vec3 col = mix(vColor.rgb, uBg, vFog * 0.6);
      gl_FragColor = vec4(col * a, a);
    }`;

  G.MESH_VS = `
    attribute vec3 aP; attribute vec3 aN;
    uniform mat4 uVP; uniform mat4 uM; ${FOG}
    varying vec3 vN; varying vec3 vW; varying float vFog;
    void main() {
      vec4 w = uM * vec4(aP, 1.0);
      vW = w.xyz; vN = (uM * vec4(aN, 0.0)).xyz;
      gl_Position = uVP * w; vFog = fogK(gl_Position.w);
    }`;
  // 漫反射 + 菲涅尔边缘光 + 高光
  G.MESH_FS = `
    precision mediump float;
    uniform vec4 uColor; uniform vec3 uEye; uniform float uLit; uniform vec3 uBg; uniform float uRim;
    varying vec3 vN; varying vec3 vW; varying float vFog;
    void main() {
      vec3 n = normalize(vN), v = normalize(uEye - vW);
      float d = abs(dot(n, v));
      float diff = mix(1.0, 0.38 + 0.62 * d, uLit);
      float rim = pow(1.0 - d, 2.4) * uRim * uLit;
      float spec = uLit * pow(d, 40.0) * 0.28;
      vec3 col = uColor.rgb * diff + mix(vec3(1.0), uColor.rgb, 0.4) * rim + spec;
      float a = clamp(uColor.a + rim * 0.5 * (1.0 - uColor.a), 0.0, 1.0) * (1.0 - 0.5 * vFog);
      col = mix(col, uBg, vFog * 0.55);
      gl_FragColor = vec4(col * a, a);
    }`;

  // 点精灵：流动粒子与电荷光晕（叠加混合）
  G.SPRITE_VS = `
    attribute vec3 aP; attribute vec4 aC; attribute float aS;
    uniform mat4 uVP; uniform float uScale; ${FOG}
    varying vec4 vC; varying float vFog;
    void main() {
      gl_Position = uVP * vec4(aP, 1.0);
      gl_PointSize = clamp(aS * uScale / gl_Position.w, 1.0, 160.0);
      vC = aC; vFog = fogK(gl_Position.w);
    }`;
  G.SPRITE_FS = `
    precision mediump float;
    uniform float uSoft;
    varying vec4 vC; varying float vFog;
    void main() {
      vec2 q = gl_PointCoord * 2.0 - 1.0;
      float r = dot(q, q);
      if (r > 1.0) discard;
      float core = smoothstep(1.0, 0.55, r), halo = exp(-r * 3.2);
      float a = mix(core, halo, uSoft) * vC.a * (1.0 - 0.6 * vFog);
      gl_FragColor = vec4(vC.rgb * a, a);
    }`;

  G.program = function (gl, vs, fs) {
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const info = { p, a: {}, u: {} };
    const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES), nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < na; i++) { const n = gl.getActiveAttrib(p, i).name; info.a[n] = gl.getAttribLocation(p, n); }
    for (let i = 0; i < nu; i++) { const n = gl.getActiveUniform(p, i).name; info.u[n] = gl.getUniformLocation(p, n); }
    return info;
  };

  // 单位球（电荷、探针标记）
  G.unitSphere = () => EL.ISO.sphere([0, 0, 0], 1, 18);

  // 单位圆锥：底面在 z=0，尖端在 z=1（箭头头部）
  G.unitCone = function (seg) {
    seg = seg || 18;
    const pos = [], nrm = [];
    for (let i = 0; i < seg; i++) {
      const a = 2 * Math.PI * i / seg, b = 2 * Math.PI * (i + 1) / seg;
      const pa = [Math.cos(a), Math.sin(a), 0], pb = [Math.cos(b), Math.sin(b), 0];
      const na = EL.V.norm([pa[0], pa[1], 0.5]), nb = EL.V.norm([pb[0], pb[1], 0.5]);
      pos.push(...pa, ...pb, 0, 0, 1); nrm.push(...na, ...nb, ...EL.V.norm(EL.V.add(na, nb)));
      pos.push(...pb, ...pa, 0, 0, 0); nrm.push(0, 0, -1, 0, 0, -1, 0, 0, -1);
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), count: pos.length / 3 };
  };

  EL.G = G;
})(window.EL);
