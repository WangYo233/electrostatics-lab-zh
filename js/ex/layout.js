'use strict';
// Resizable columns and an in-layout guide: the guide never covers the model.
(function (EL) {
  window.addEventListener('DOMContentLoaded', () => {
    const U = EL.U, en = document.documentElement.lang.startsWith('en'), L = (zh, english) => en ? english : zh;
    const work = document.querySelector('.ex-work'), view = work.querySelector('.view'), cap = U.$('#caption');
    const saved = U.store.get('ex:layout', {}), state = { left: saved.left || 250, right: saved.right || 380, dock: saved.dock || 'bottom', extent: saved.extent || 310 };
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    function apply() {
      const width = work.clientWidth, room = Math.max(420, width - 340), sum = state.left + state.right;
      const scale = Math.min(1, room / sum);
      work.style.setProperty('--ex-left', Math.max(160, state.left * scale) + 'px');
      work.style.setProperty('--ex-right', Math.max(220, state.right * scale) + 'px');
      view.dataset.guideDock = state.dock;
      const vertical = state.dock === 'left' || state.dock === 'right';
      view.style.setProperty('--guide-extent', clamp(state.extent, vertical ? 220 : 160, Math.max(vertical ? 220 : 160, (vertical ? view.clientWidth : view.clientHeight) * .62)) + 'px');
      view.classList.toggle('has-guide', !cap.hidden);
      if (EL.EX.W.r) requestAnimationFrame(() => EL.EX.W.r.draw());
    }
    const save = () => U.store.set('ex:layout', state);
    function drag(event, move, end) {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      const target = event.currentTarget, id = event.pointerId; target.setPointerCapture(id);
      const onMove = e => { if (e.pointerId === id) move(e); };
      const stop = e => { if (e.pointerId !== id) return; target.removeEventListener('pointermove', onMove); target.removeEventListener('pointerup', stop); target.removeEventListener('pointercancel', stop); end && end(e); save(); };
      target.addEventListener('pointermove', onMove); target.addEventListener('pointerup', stop); target.addEventListener('pointercancel', stop);
    }
    for (const side of ['left', 'right']) {
      const bar = U.h('div.ex-divider', { role: 'separator', tabindex: '0', 'aria-orientation': 'vertical', 'aria-label': L(side === 'left' ? '调整左栏宽度' : '调整右栏宽度', 'Resize ' + side + ' column') });
      bar.dataset.side = side;
      if (side === 'left') view.before(bar); else view.after(bar);
      bar.addEventListener('pointerdown', e => { const x = e.clientX, initial = state[side]; drag(e, e => { state[side] = clamp(initial + (side === 'left' ? 1 : -1) * (e.clientX - x), side === 'left' ? 160 : 220, Math.max(240, work.clientWidth * .45)); apply(); }); });
      bar.addEventListener('keydown', e => { if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return; e.preventDefault(); state[side] += (e.key === 'ArrowRight' ? 20 : -20) * (side === 'left' ? 1 : -1); state[side] = clamp(state[side], side === 'left' ? 160 : 220, work.clientWidth * .45); apply(); save(); });
    }
    function handles() {
      if (cap.hidden || cap.querySelector('.guide-grip')) { apply(); return; }
      const grip = U.h('div.guide-grip', { tabindex: '0', title: L('拖动', 'Drag') }, U.h('span', null, L('⠿ 引导探究', '⠿ Guided inquiry')));
      const reset = U.h('button', { type: 'button', title: L('重置布局', 'Reset layout'), 'aria-label': L('重置布局', 'Reset layout') }, '↺');
      reset.addEventListener('click', () => { Object.assign(state, { left: 250, right: 380, dock: 'bottom', extent: 310 }); apply(); save(); }); grip.append(reset);
      grip.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; let dock = state.dock; drag(e, e => { const r = view.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; dock = [['left', x], ['right', 1 - x], ['top', y], ['bottom', 1 - y]].sort((a, b) => a[1] - b[1])[0][0]; view.dataset.guidePreview = dock; }, () => { state.dock = dock; delete view.dataset.guidePreview; apply(); }); });
      grip.addEventListener('keydown', e => { const dirs = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'top', ArrowDown: 'bottom' }; if (dirs[e.key]) { e.preventDefault(); state.dock = dirs[e.key]; apply(); save(); } });
      const size = U.h('div.guide-resize', { role: 'separator', tabindex: '0', title: L('调整大小', 'Resize'), 'aria-label': L('调整大小', 'Resize') });
      size.addEventListener('pointerdown', e => { const x = e.clientX, y = e.clientY, initial = state.extent, vertical = ['left', 'right'].includes(state.dock), sign = ['bottom', 'right'].includes(state.dock) ? -1 : 1; drag(e, e => { state.extent = initial + sign * (vertical ? e.clientX - x : e.clientY - y); apply(); }); });
      size.addEventListener('keydown', e => { if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault(); state.extent += ['ArrowRight', 'ArrowDown'].includes(e.key) ? 20 : -20; state.extent = Math.max(160, state.extent); apply(); save(); });
      cap.prepend(grip); cap.append(size); apply();
    }
    new MutationObserver(handles).observe(cap, { childList: true, attributes: true, attributeFilter: ['hidden'] });
    new ResizeObserver(apply).observe(work);
    document.addEventListener('fullscreenchange', () => requestAnimationFrame(apply));
    handles();
  });
})(window.EL);
