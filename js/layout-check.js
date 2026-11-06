'use strict';
// 版面检查（开发用，页面不加载）：找出被裁切的文字、超出容器的元素、显示不全的根号和占位提示。
// 用法：在页面中 eval 本文件，然后调用 layoutCheck()
window.layoutCheck = function () {
  document.getAnimations().forEach(a => { try { a.finish(); } catch (e) { /* 循环动画 */ } });
  const out = [], seen = new Set();
  const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const vis = el => { if (el.closest('.sr, .skip')) return false; const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0) return false; } return true; };
  const add = (k, el, info) => { const key = k + name(el) + info; if (seen.has(key)) return; seen.add(key); out.push(k + '  ' + name(el) + '  ' + info + '  "' + (el.textContent || el.placeholder || '').trim().slice(0, 30) + '"'); };
  // 1. 文字超出自身（被 overflow 或 ellipsis 截断）
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('canvas, svg, .labels, math') || !vis(el)) continue;
    if (el.matches('.stage, .drawer, .work, .view, .rail, .inspector, .panel, .theory-page, body')) continue;   // 布局容器：由第 2 项逐个检查其中的元素
    const c = getComputedStyle(el);
    if (c.overflowX !== 'visible' && c.overflowX !== 'auto' && c.overflowX !== 'scroll' && el.scrollWidth > el.clientWidth + 2 && el.textContent.trim()) add('裁切(横)', el, el.scrollWidth + '>' + el.clientWidth);
    if (c.overflowY === 'hidden' && el.scrollHeight > el.clientHeight + 2 && el.textContent.trim() && !el.matches('details:not([open])')) add('裁切(竖)', el, el.scrollHeight + '>' + el.clientHeight);
  }
  // 2. 元素超出可裁切的祖先（或页面右边界）
  const clipAnc = el => { for (let e = el.parentElement; e; e = e.parentElement) { const c = getComputedStyle(e); if (c.overflowX !== 'visible' || c.overflowY !== 'visible') return e; } return null; };
  for (const el of document.querySelectorAll('button, input, select, label, p, li, td, th, h1, h2, h3, h4, summary, span, b, math, .btn, a')) {
    if (el.closest('canvas, svg, .labels') || !vis(el)) continue;
    const a = clipAnc(el); if (!a) continue;
    const r = el.getBoundingClientRect(), ar = a.getBoundingClientRect(), ac = getComputedStyle(a);
    if (ac.overflowX === 'auto' || ac.overflowX === 'scroll') { if (r.right > ar.right + 2 && a.scrollWidth > a.clientWidth + 2) add('需横向滚动', el, 'in ' + name(a)); continue; }
    if (r.right > ar.right + 1.5 || r.left < ar.left - 1.5) add('超出容器', el, 'in ' + name(a) + ' by ' + Math.round(Math.max(r.right - ar.right, ar.left - r.left)));
    if (el.tagName === 'MATH' || el.closest('math')) { if (r.top < ar.top - 1 || r.bottom > ar.bottom + 1) add('公式被裁', el, 'in ' + name(a)); }
  }
  // 3. 根号：上横线（msqrt 顶部）被同一行的父元素裁掉
  for (const m of document.querySelectorAll('msqrt, mroot')) {
    if (!vis(m)) continue;
    const r = m.getBoundingClientRect();
    for (let e = m.parentElement; e && e !== document.body; e = e.parentElement) {
      const c = getComputedStyle(e); if (c.overflowY === 'visible' && c.overflowX === 'visible') continue;
      const er = e.getBoundingClientRect(); if (r.top < er.top - 0.5 || r.bottom > er.bottom + 0.5 || r.right > er.right + 0.5) add('根号被裁', m, 'in ' + name(e)); break;
    }
  }
  // 4. 输入框的占位提示比框宽
  const cv = document.createElement('canvas').getContext('2d');
  for (const el of document.querySelectorAll('input[placeholder]')) {   // textarea 的占位提示会换行，不检查
    if (!vis(el) || !el.placeholder) continue;
    const c = getComputedStyle(el); cv.font = c.fontSize + ' ' + c.fontFamily;
    const need = cv.measureText(el.placeholder).width + parseFloat(c.paddingLeft) + parseFloat(c.paddingRight);
    if (need > el.clientWidth + 1) add('占位提示被截', el, Math.round(need) + '>' + el.clientWidth);
  }
  // 5. 下拉框选中文字比框宽
  for (const el of document.querySelectorAll('select')) {
    if (!vis(el)) continue;
    const o = el.options[el.selectedIndex]; if (!o) continue;
    const c = getComputedStyle(el); cv.font = c.fontSize + ' ' + c.fontFamily;
    if (cv.measureText(o.text).width + 34 > el.clientWidth) add('下拉文字被截', el, Math.round(cv.measureText(o.text).width + 34) + '>' + el.clientWidth);
  }
  return out;
};
