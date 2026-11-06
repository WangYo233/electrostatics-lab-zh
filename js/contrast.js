'use strict';
// 文字对比度检查：网址带 #contrast 时，按 WCAG 2.1 计算每段可见文字与其实际背景的对比度，列出低于 4.5:1（大字 3:1）的元素
(function () {
  if (typeof location === 'undefined' || !/contrast/.test(location.hash)) return;
  const rgba = s => { const m = String(s).match(/[\d.]+/g); return m ? m.map(Number).concat(m.length === 3 ? [1] : []) : [0, 0, 0, 0]; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const over = (top, bot) => { const a = top[3]; return [0, 1, 2].map(i => top[i] * a + bot[i] * (1 - a)).concat([1]); };
  // 背景：沿祖先链叠加不透明度；遇到渐变或图片时取渐变中的第一个颜色
  function bgOf(el) {
    const layers = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const img = cs.backgroundImage;
      if (img && img !== 'none') { const m = img.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/i); if (m) { layers.push(rgba(m[0].startsWith('#') ? hex(m[0]) : m[0])); if (rgba(m[0])[3] >= 1) break; } }
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    let b = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) b = over(layers[i], b);
    return b;
  }
  const hex = h => { h = h.slice(1); if (h.length === 3) h = h.split('').map(x => x + x).join(''); return 'rgb(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ')'; };
  function run() {
    // 入场动画结束后的状态才是用户看到的状态
    document.getAnimations().forEach(a => { try { a.finish(); } catch (e) { /* 无限循环的动画不能结束 */ } });
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let n; (n = walker.nextNode());) {
      const el = n.parentElement;
      if (!el || seen.has(el) || !n.textContent.trim()) continue;
      seen.add(el);
      if (el.closest('canvas, svg, .labels, [hidden], option, optgroup')) continue;   // 画板标注叠在三维画面上，另行检查
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
      if (op < 0.05) continue;                                                           // 不可见
      if (el.closest(':disabled')) continue;                                             // 禁用控件不要求对比度
      const fg0 = rgba(cs.color);
      if (fg0[3] === 0) continue;                                                        // 渐变填充的文字（标题），颜色来自背景
      const bg = bgOf(el), fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * op], bg);
      const L1 = lum(fg), L2 = lum(bg), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const px = parseFloat(cs.fontSize), big = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
      if (cr < (big ? 3 : 4.5)) out.push({ cr: +cr.toFixed(2), text: n.textContent.trim().slice(0, 24), sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''), fg: cs.color, bg: 'rgb(' + bg.slice(0, 3).map(Math.round).join(',') + ')', op: +op.toFixed(2) });
    }
    out.sort((a, b) => a.cr - b.cr);
    window.__contrast = out;
    return out;
  }
  window.contrastAudit = run;
})();
