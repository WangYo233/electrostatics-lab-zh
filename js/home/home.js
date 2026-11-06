'use strict';
// 首页：模型卡片分组与首屏偶极子动画
(function () {
  // 三大类（按学习进程）：一、基础模型；二、对称模型（含例题）；三、拓展与创作。实验室的模型下拉框（js/app/main.js 中的 CATS）用同样的分类
  var groups = [
    ['一、基础模型', [[1, '01', '点电荷与偶极子'], [2, '02', '路径与能量']]],
    ['二、对称模型', [[4, '03', '正四面体'], [6, '04', '正六面体'], [5, '05', '正八面体'], ['ex', '例题', '例题探究']]],
    ['三、拓展与创作', [[7, '06', '自主探究'], [8, '拓展 1', '解析场模型'], [3, '拓展 2', '圆盘电荷（雪花问题）'], ['add', '添加', '题目添加']]]
  ];
  function href(id) { return id === 'ex' ? 'examples.html' : id === 'add' ? 'examples.html?mode=add' : 'lab.html?m=' + id; }

  var root = document.getElementById('groups'), k = 0;
  // 卡片悬停光斑跟随指针
  root.addEventListener('pointermove', function (e) {
    var c = e.target.closest && e.target.closest('.card-link'); if (!c) return;
    var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
  groups.forEach(function (g) {
    var h = document.createElement('h2'); h.className = 'cat'; h.textContent = g[0]; root.appendChild(h);
    var box = document.createElement('nav'); box.className = 'cards'; box.setAttribute('aria-label', g[0]);
    g[1].forEach(function (x) {
      var a = document.createElement('a');
      a.className = 'card-link'; a.href = href(x[0]); a.style.animationDelay = (k++ * 60) + 'ms';
      var n = document.createElement('div'); n.className = 'num'; n.textContent = x[1];
      var t = document.createElement('h2'); t.textContent = x[2];
      var go = document.createElement('span'); go.className = 'go'; go.setAttribute('aria-hidden', 'true'); go.textContent = '→';
      a.appendChild(n); a.appendChild(t); a.appendChild(go);
      box.appendChild(a);
    });
    root.appendChild(box);
  });

  // 首屏动态：偶极子的电场线与沿线流动的粒子。
  // 电场线从正电荷出发；另从负电荷逆着 E 回溯，只保留来自画面外（无穷远方向）的线，补齐负电荷外侧，且不与正电荷出发的线重复。
  (function () {
    var cv = document.getElementById('hero'), g = cv.getContext('2d'), lines = [], parts = [], W, H, Q, last = 0;
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function E(x, y) {
      var ex = 0, ey = 0;
      Q.forEach(function (q) { var dx = x - q[0], dy = y - q[1], r2 = dx * dx + dy * dy, r3 = r2 * Math.sqrt(r2); ex += q[2] * dx / r3; ey += q[2] * dy / r3; });
      return [ex, ey];
    }
    // 从电荷 q 附近出发积分；dir 为 1 时顺着 E，为 −1 时逆着 E。返回 {pts, end}，end 为 'charge' 或 'out'
    function trace(q, a, dir, other) {
      var x = q[0] + 10 * Math.cos(a), y = q[1] + 10 * Math.sin(a), pts = [[x, y]], end = 'out';
      for (var n = 0; n < 900; n++) {
        var e = E(x, y), l = Math.hypot(e[0], e[1]); if (!l) break;
        x += dir * 3 * e[0] / l; y += dir * 3 * e[1] / l; pts.push([x, y]);
        if (Math.hypot(x - other[0], y - other[1]) < 9) { end = 'charge'; break; }
        if (x < -60 || x > W + 60 || y < -60 || y > H + 60) break;
      }
      return { pts: pts, end: end };
    }
    function add(pts) {
      lines.push(pts);
      for (var m = 0; m < Math.max(2, pts.length / 40); m++) parts.push({ l: lines.length - 1, u: Math.random() * pts.length });
    }
    function build() {
      var dpr = window.devicePixelRatio || 1;
      W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      var s = Math.min(W, H * 2.2) * 0.13;
      Q = [[W * 0.64 - s, H * 0.52, s * s], [W * 0.64 + s, H * 0.52, -s * s]];
      lines = []; parts = [];
      var N = 22, i;
      for (i = 0; i < N; i++) add(trace(Q[0], 2 * Math.PI * (i + 0.5) / N, 1, Q[1]).pts);
      // 负电荷：逆着 E 回溯；到达正电荷的线已由上面画出，丢弃；其余反转顺序，使粒子沿 E 流入负电荷
      for (i = 0; i < N; i++) {
        var r = trace(Q[1], Math.PI - 2 * Math.PI * (i + 0.5) / N, -1, Q[0]);
        if (r.end === 'out') add(r.pts.reverse());
      }
    }
    function frame(t) {
      var dt = last ? Math.min(50, t - last) : 16.7; last = t;
      g.clearRect(0, 0, W, H);
      g.lineWidth = 1; g.strokeStyle = 'rgba(143,184,222,0.22)';
      lines.forEach(function (p) { g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (var i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]); g.stroke(); });
      parts.forEach(function (P) {
        var p = lines[P.l], i = Math.floor(P.u), q = p[Math.min(i, p.length - 1)];
        // 速度 ∝ √|E|（限幅），单位：每帧前进的折线顶点数；比原来减慢一半
        var e = E(q[0], q[1]), sp = 0.5 * Math.min(3, Math.max(0.35, Math.sqrt(Math.hypot(e[0], e[1])) * 0.9));
        if (!still) P.u = (P.u + sp * dt / 16.7) % p.length;
        var f = P.u / p.length, al = Math.min(1, f * 8, (1 - f) * 8) * 0.85;
        g.fillStyle = 'rgba(220,235,250,' + al + ')'; g.beginPath(); g.arc(q[0], q[1], 1.6, 0, 7); g.fill();
      });
      Q.forEach(function (q, i) {
        var r = 9 + (still ? 0 : Math.sin(t / 900 + i * 2) * 1.2), col = i ? '79,163,224' : '242,142,43';
        var gr = g.createRadialGradient(q[0], q[1], 0, q[0], q[1], r * 4);
        gr.addColorStop(0, 'rgba(' + col + ',0.55)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
        g.fillStyle = gr; g.beginPath(); g.arc(q[0], q[1], r * 4, 0, 7); g.fill();
        g.fillStyle = 'rgb(' + col + ')'; g.beginPath(); g.arc(q[0], q[1], 7, 0, 7); g.fill();
        g.fillStyle = '#0b1220'; g.font = 'bold 12px "Times New Roman"'; g.textAlign = 'center'; g.fillText(i ? '−' : '+', q[0], q[1] + 4);
      });
      if (!still) requestAnimationFrame(frame);
    }
    build(); requestAnimationFrame(frame);
    window.addEventListener('resize', function () { build(); if (still) requestAnimationFrame(frame); });
  })();
})();
