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


// Panel visibility and two-dimensional resizing preserve the current inquiry step.
(function (EL) {
  window.addEventListener('DOMContentLoaded', () => {
    const U = EL.U, view = document.querySelector('.ex-work > .view'), work = view.parentElement, cap = U.$('#caption'), stage = U.$('#stage');
    const en = document.documentElement.lang.startsWith('en'), L = (zh, eng) => en ? eng : zh;
    const state = Object.assign({ left: false, right: false, guide: false, modelWidth: 0, modelHeight: 0, guideWidth: 0, guideHeight: 0 }, U.store.get('ex:panels', {}));
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const save = () => U.store.set('ex:panels', state);
    const controls = U.h('div.ex-layout-tools', { role: 'toolbar', 'aria-label': L('面板布局', 'Panel layout') });
    const btn = (id, icon, label, action) => U.h('button', { id, type: 'button', title: label, 'aria-label': label, onclick: action }, icon);
    const left = btn('exToggleLeft', '◧', '', () => { state.left = !state.left; apply(); save(); });
    const right = btn('exToggleRight', '◨', '', () => { state.right = !state.right; apply(); save(); });
    const guide = btn('exToggleGuide', '▤', '', () => {
      state.guide = view.classList.contains('model-only') ? false : !state.guide; view.classList.remove('model-only'); apply(); save();
    });
    const only = btn('exModelOnly', '⛶', L('仅模型全屏', 'Model-only fullscreen'), async () => {
      if (view.classList.contains('model-only')) { view.classList.remove('model-only'); apply(); return; }
      view.classList.add('model-only'); apply();
      if (!document.fullscreenElement && view.requestFullscreen) {
        try { await view.requestFullscreen(); } catch (_) { view.classList.remove('model-only'); apply(); }
      }
    });
    const reset = btn('exResetPanels', '↺', L('恢复面板', 'Restore panels'), () => {
      Object.assign(state, { left: false, right: false, guide: false, modelWidth: 0, modelHeight: 0, guideWidth: 0, guideHeight: 0 });
      view.classList.remove('model-only'); apply(); save();
    });
    controls.append(left, right, guide, U.h('span.ex-layout-spacer'), only, reset); view.prepend(controls);
    const describe = (node, label, pressed) => { node.title = label; node.setAttribute('aria-label', label); node.setAttribute('aria-pressed', String(pressed)); };
    function apply() {
      work.classList.toggle('left-off', state.left); work.classList.toggle('right-off', state.right);
      work.querySelector('.ex-left').inert = state.left; work.querySelector('.ex-right').inert = state.right;
      view.classList.toggle('guide-collapsed', state.guide);
      cap.inert = state.guide || view.classList.contains('model-only');
      for (const key of ['modelWidth', 'modelHeight', 'guideWidth', 'guideHeight']) view.style.setProperty('--' + key.replace(/[A-Z]/g, x => '-' + x.toLowerCase()), state[key] ? state[key] + 'px' : '100%');
      const showGuide = !cap.hidden && !state.guide && !view.classList.contains('model-only');
      describe(left, L(state.left ? '展开题目列表' : '收起题目列表', state.left ? 'Show problem list' : 'Hide problem list'), !state.left);
      describe(right, L(state.right ? '展开题目内容' : '收起题目内容', state.right ? 'Show problem panel' : 'Hide problem panel'), !state.right);
      describe(guide, L(showGuide ? '收起引导' : '展开引导', showGuide ? 'Hide guide' : 'Show guide'), showGuide);
      describe(only, view.classList.contains('model-only') ? L('恢复面板', 'Restore panels') : L('仅模型全屏', 'Model-only fullscreen'), view.classList.contains('model-only'));
      guide.disabled = cap.hidden; left.hidden = right.hidden = !!document.fullscreenElement;
      if (EL.EX.W.r) requestAnimationFrame(() => EL.EX.W.r.draw());
    }
    function sizeHandle(which) {
      const el = which === 'guide' ? cap : stage, handle = U.h('div.' + which + '-corner', { tabindex: '0', role: 'separator', title: L('长按调整大小', 'Hold to resize'), 'aria-label': L('长按调整大小', 'Hold to resize') });
      const resize = (dx, dy, initial) => {
        const w = Math.max(180, view.clientWidth - 24), h = Math.max(130, view.clientHeight - controls.offsetHeight - 24);
        state[which + 'Width'] = clamp(initial.width + dx, 180, w);
        state[which + 'Height'] = clamp(initial.height + dy, which === 'guide' ? 130 : 180, h);
        if (view.classList.contains('has-guide') && !state.guide && !view.classList.contains('model-only')) {
          const vertical = ['left', 'right'].includes(view.dataset.guideDock), layout = U.store.get('ex:layout', {});
          if (vertical && which === 'guide') view.style.setProperty('--guide-extent', state.guideWidth + 'px');
          if (!vertical) view.style.setProperty('--guide-extent', clamp(which === 'guide' ? state.guideHeight : h - state.modelHeight - 8, 130, h - 180) + 'px');
          layout.extent = parseFloat(view.style.getPropertyValue('--guide-extent')); U.store.set('ex:layout', layout);
        }
        apply();
      };
      handle.addEventListener('pointerdown', e => {
        if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); handle.setPointerCapture(e.pointerId);
        const start = { x: e.clientX, y: e.clientY, width: el.clientWidth, height: el.clientHeight }, id = e.pointerId;
        let active = false, timer = setTimeout(() => { active = true; handle.classList.add('resizing'); }, 380);
        const move = ev => { if (ev.pointerId === id && active) resize(ev.clientX - start.x, ev.clientY - start.y, start); };
        const end = ev => { if (ev.pointerId !== id) return; clearTimeout(timer); handle.classList.remove('resizing'); handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', end); handle.removeEventListener('pointercancel', end); handle.removeEventListener('lostpointercapture', end); save(); };
        handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end); handle.addEventListener('lostpointercapture', end);
      });
      handle.addEventListener('keydown', e => { if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return; e.preventDefault(); resize(e.key === 'ArrowRight' ? 20 : e.key === 'ArrowLeft' ? -20 : 0, e.key === 'ArrowDown' ? 20 : e.key === 'ArrowUp' ? -20 : 0, { width: el.clientWidth, height: el.clientHeight }); save(); });
      return handle;
    }
    stage.append(sizeHandle('model'));
    function handles() {
      const grip = cap.querySelector('.guide-grip');
      if (grip && !grip.querySelector('.guide-fold')) {
        const fold = btn('', '−', L('收起引导', 'Hide guide'), () => { state.guide = true; apply(); save(); }); fold.className = 'guide-fold'; grip.append(fold);
        cap.append(sizeHandle('guide'));
      }
      apply();
    }
    new MutationObserver(handles).observe(cap, { childList: true, attributes: true, attributeFilter: ['hidden'] });
    new ResizeObserver(apply).observe(work);
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) view.classList.remove('model-only'); apply(); });
    handles();
  });
})(window.EL);
