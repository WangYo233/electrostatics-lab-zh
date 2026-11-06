'use strict';
// 界面动效：工作区切换的交叉淡入、折叠面板的平滑展开、滚动进入时的淡入、按钮按压反馈、理论页目录随滚动高亮
// 系统设置“减少动态效果”时全部关闭
(function (EL) {
  // 系统要求减少动效，或页面不在前台（不绘制帧，动画会挂起）时，一律直接切换
  const still = () => (typeof document !== 'undefined' && document.hidden) || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const M = EL.motion = { swap: fn => fn() };
  if (typeof document === 'undefined' || !document.addEventListener) return;   // 非浏览器环境（单元测试）只保留直接切换

  // 工作区切换：浏览器支持 View Transitions 时交叉淡入，否则直接切换。
  // 连续快速切换时，上一个过渡会被浏览器跳过（AbortError）；所有过渡的 promise 都已处理，不会出现未捕获的错误
  M.swap = function (fn) {
    if (still() || !document.startViewTransition) return fn();
    let ran = false;
    const once = () => { if (!ran) { ran = true; fn(); } };
    try {
      const t = document.startViewTransition(once);
      [t.finished, t.ready, t.updateCallbackDone].forEach(p => p && p.catch(() => {}));
    } catch (e) { once(); }
    setTimeout(once, 250);   // 浏览器迟迟不回调时兜底，保证切换不丢失
  };

  // 折叠面板：展开与收起时高度平滑过渡（只作用于界面里的说明与分组面板，不影响顶栏菜单）
  const SEL = 'details.acc, details.tip, details.where, details.base, details.g-item, details.grp';
  document.addEventListener('click', e => {
    const s = e.target.closest('summary');
    if (!s || still()) return;
    const d = s.parentElement;
    if (!d || !d.matches(SEL) || d.dataset.anim) return;
    e.preventDefault();
    const h0 = d.offsetHeight;
    d.dataset.anim = '1';
    const opening = !d.open;
    // 先同步量出目标高度（不产生绘制），再从当前高度过渡过去
    d.open = !d.open; const h1 = d.offsetHeight; d.open = !d.open;
    if (opening) d.open = true;
    d.style.overflow = 'hidden';
    const a = d.animate({ height: [h0 + 'px', h1 + 'px'] }, { duration: Math.min(380, 160 + Math.abs(h1 - h0) * 0.35), easing: 'cubic-bezier(.22,.8,.26,1)' });
    let done = false;
    const end = () => { if (done) return; done = true; if (!opening) d.open = false; d.style.overflow = ''; delete d.dataset.anim; };
    a.onfinish = a.oncancel = end;
    setTimeout(() => { a.cancel(); end(); }, 600);   // 动画被挂起时的兜底
  });

  // 滚动进入视口时淡入上浮（data-reveal 标记的元素）
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(x => {
    if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); }
  }), { rootMargin: '0px 0px -6% 0px', threshold: 0.04 }) : null;
  M.reveal = function (root, sel) {
    const els = (root || document).querySelectorAll(sel || '[data-reveal]');
    els.forEach((el, i) => {
      if (still() || !io) { el.classList.add('in'); return; }
      el.classList.add('rv'); el.style.setProperty('--d', Math.min(i, 8) * 40 + 'ms'); io.observe(el);
    });
  };

  // 目录高亮：滚动时标出当前阅读的小节，并在顶部显示阅读进度
  M.scrollSpy = function (scroller, links, bar) {
    if (M._spy) scroller.removeEventListener('scroll', M._spy);
    const tick = () => {
      const top = scroller.getBoundingClientRect().top + 80;
      let cur = links[0];
      for (const l of links) { const t = document.getElementById(l.dataset.target); if (t && t.getBoundingClientRect().top <= top) cur = l; }
      links.forEach(l => l.classList.toggle('cur', l === cur));
      if (bar) { const m = scroller.scrollHeight - scroller.clientHeight; bar.style.transform = 'scaleX(' + (m > 0 ? scroller.scrollTop / m : 0) + ')'; }
    };
    let raf = 0;
    M._spy = () => { if (!raf) raf = setTimeout(() => { raf = 0; tick(); }, 30); };
    scroller.addEventListener('scroll', M._spy, { passive: true });
    tick();
  };

  // 按钮按压反馈：从点击位置扩散的柔和波纹
  document.addEventListener('pointerdown', e => {
    if (still() || e.button !== 0) return;
    const b = e.target.closest('.btn, .modes button, .chip, .rail button, .sb-nav, .tools button');
    if (!b || b.disabled) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2, w = document.createElement('i');
    w.className = 'ripple';
    w.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.classList.add('has-ripple'); b.appendChild(w);
    w.addEventListener('animationend', () => w.remove());
  });
})(window.EL = window.EL || {});
