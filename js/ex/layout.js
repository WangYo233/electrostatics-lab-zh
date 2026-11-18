'use strict';
// One layout state and one scheduled update keep panel resizing stable.
(function (EL) {
  window.addEventListener('DOMContentLoaded', () => {
    const U = EL.U, en = document.documentElement.lang.startsWith('en'), L = (zh, english) => en ? english : zh;
    const work = document.querySelector('.ex-work'), view = work.querySelector('.view'), cap = U.$('#caption'), stage = U.$('#stage');
    const layout = Object.assign({ left: 250, right: 380, dock: 'right', extent: 380 }, U.store.get('ex:layout', {}));
    const panels = Object.assign({ left: false, right: false, guide: false, modelWidth: 0, modelHeight: 0, guideWidth: 0, guideHeight: 0 }, U.store.get('ex:panels', {}));
    if (U.store.get('ex:layoutVersion', 0) < 2) {
      layout.dock = 'right'; layout.extent = 380;
      panels.modelWidth = panels.modelHeight = panels.guideWidth = panels.guideHeight = 0;
      U.store.set('ex:layoutVersion', 2);
    }
    let focusPanels = null, mobileList = false, mobileTools = false, mobileTab = document.body.dataset.exmode === 'teacher' ? 'questions' : 'model';
    const mobile = () => innerWidth <= 720;
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const save = () => { U.store.set('ex:layout', layout); U.store.set('ex:panels', panels); };
    let pending = 0;
    const schedule = () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; apply(); }); };
    const button = (id, icon, label, action) => U.h('button', { id, type: 'button', title: label, 'aria-label': label, onclick: action }, icon);
    const controls = U.h('div.ex-layout-tools', { 'aria-label': L('画板工具', 'Canvas tools') });
    const group = U.h('div.ex-panel-tools', { role: 'toolbar', 'aria-label': L('面板布局', 'Panel layout') });
    const toggleSide = side => {
      const state = focusPanels || panels; state[side] = !work.classList.contains(side + '-off');
      if (innerWidth > 720 && innerWidth <= 1100 && !cap.hidden && !panels.guide && !state[side]) state[side === 'left' ? 'right' : 'left'] = true;
      schedule(); save();
    };
    const left = button('exToggleLeft', L('题目列表', 'Problem list'), '', () => toggleSide('left'));
    const right = button('exToggleRight', L('题目内容', 'Problem details'), '', () => toggleSide('right'));
    const guide = button('exToggleGuide', L('引导', 'Guide'), '', () => { panels.guide = view.classList.contains('model-only') ? false : !panels.guide; view.classList.remove('model-only'); focusPanels = !panels.guide && innerWidth > 720 ? { left: true, right: true } : null; schedule(); save(); });
    const only = button('exModelOnly', L('仅模型', 'Model only'), L('仅模型全屏', 'Model-only fullscreen'), async () => {
      if (view.classList.contains('model-only')) { view.classList.remove('model-only'); if (document.fullscreenElement) await document.exitFullscreen(); schedule(); return; }
      view.classList.add('model-only'); schedule();
      try { if (!document.fullscreenElement && view.requestFullscreen) await view.requestFullscreen(); }
      catch (_) { view.classList.remove('model-only'); schedule(); }
    });
    const reset = button('exResetPanels', L('恢复布局', 'Reset layout'), L('恢复布局', 'Reset layout'), () => {
      Object.assign(layout, { left: 250, right: 380, dock: 'right', extent: 380 });
      Object.assign(panels, { left: false, right: false, guide: false, modelWidth: 0, modelHeight: 0, guideWidth: 0, guideHeight: 0 });
      focusPanels = !cap.hidden && innerWidth > 720 ? { left: true, right: true } : null;
      view.classList.remove('model-only'); schedule(); save();
    });
    const mobileToolsButton = button('exMobileTools', L('画板工具', 'Tools'), '', () => { mobileTools = !mobileTools; schedule(); });
    group.append(left, right, guide, mobileToolsButton, U.h('span.ex-layout-spacer'), reset);
    const tools = stage.querySelector('.tools'); tools.className = 'ex-view-tools'; tools.append(only);
    const display = stage.querySelector('.stagebar'); display.className = 'ex-display-tools';
    controls.append(group, tools, display); view.prepend(controls);
    const tabs = U.h('nav.ex-mobile-tabs', { 'aria-label': L('例题页面', 'Problem view') });
    const modelTab = button('exMobileModel', L('模型', 'Model'), '', () => { mobileTab = 'model'; schedule(); });
    const questionTab = button('exMobileQuestions', L('题目', 'Questions'), '', () => { mobileTab = 'questions'; schedule(); });
    const listTab = button('exMobileList', L('题目列表', 'Problem list'), '', () => { mobileList = !mobileList; schedule(); });
    tabs.append(modelTab, questionTab, listTab); work.before(tabs);
    work.querySelector('.ex-left').addEventListener('click', e => { if (mobile() && e.target.closest('.ex-item')) { mobileList = false; mobileTab = 'questions'; schedule(); } });
    const teacher = button('exTeacherMode', '', '', () => {
      const enabled = !document.body.classList.contains('teacher-enabled');
      document.body.classList.toggle('teacher-enabled', enabled);
      if (!enabled && document.body.dataset.exmode === 'teacher') EL.EX.setMode('student');
      updateTeacher();
    });
    document.querySelector('.appbar').append(teacher);
    function updateTeacher() {
      const enabled = document.body.classList.contains('teacher-enabled');
      teacher.textContent = L(enabled ? '学生模式' : '教师模式', enabled ? 'Student mode' : 'Teacher mode');
      teacher.title = teacher.textContent; teacher.setAttribute('aria-label', teacher.textContent); teacher.setAttribute('aria-pressed', String(enabled));
      const authorOption = U.$('#modelSel').querySelector('option[value=add]');
      if (authorOption) authorOption.hidden = !enabled;
    }
    if (document.body.dataset.exmode === 'teacher') document.body.classList.add('teacher-enabled');
    updateTeacher();
    new MutationObserver(() => {
      if (document.body.dataset.exmode === 'teacher') { document.body.classList.add('teacher-enabled'); mobileTab = 'questions'; mobileList = false; }
      updateTeacher(); schedule();
    }).observe(document.body, { attributes: true, attributeFilter: ['data-exmode'] });
    const describe = (node, label, pressed) => { node.title = label; node.setAttribute('aria-label', label); node.setAttribute('aria-pressed', String(pressed)); };
    function apply() {
      view.classList.toggle('mobile-tools-open', mobileTools);
      mobileToolsButton.setAttribute('aria-expanded', String(mobileTools));
      view.style.setProperty('--mobile-model-height', Math.max(320, panels.modelHeight || 320) + 'px');
      const room = Math.max(420, work.clientWidth - 340), scale = Math.min(1, room / (layout.left + layout.right));
      work.style.setProperty('--ex-left', Math.max(160, layout.left * scale) + 'px');
      work.style.setProperty('--ex-right', Math.max(220, layout.right * scale) + 'px');
      if (cap.hidden || panels.guide) focusPanels = null;
      let leftOff = mobile() ? !mobileList : focusPanels ? focusPanels.left : panels.left;
      const rightOff = mobile() ? mobileTab !== 'questions' : focusPanels ? focusPanels.right : panels.right;
      const activeGuide = !cap.hidden && !panels.guide && !view.classList.contains('model-only');
      if (innerWidth > 720 && innerWidth <= 1100 && activeGuide && !leftOff && !rightOff) leftOff = true;
      work.classList.toggle('guide-active', activeGuide);
      work.classList.toggle('left-off', leftOff); work.classList.toggle('right-off', rightOff);
      work.classList.toggle('mobile-questions', mobile() && mobileTab === 'questions');
      work.querySelector('.ex-left').inert = leftOff; work.querySelector('.ex-right').inert = rightOff;
      modelTab.setAttribute('aria-current', mobileTab === 'model' ? 'page' : 'false');
      questionTab.setAttribute('aria-current', mobileTab === 'questions' ? 'page' : 'false');
      listTab.setAttribute('aria-expanded', String(mobileList));
      // Side docking needs enough room for both the model and readable calculations.
      const dock = view.clientWidth < 700 && ['left', 'right'].includes(layout.dock) ? 'bottom' : layout.dock;
      view.dataset.guideDock = dock;
      view.classList.toggle('has-guide', !cap.hidden); view.classList.toggle('guide-collapsed', panels.guide);
      cap.inert = panels.guide || view.classList.contains('model-only');
      const vertical = ['left', 'right'].includes(dock), available = vertical ? view.clientWidth - 210 : view.clientHeight - controls.offsetHeight - 210;
      view.style.setProperty('--guide-extent', clamp(layout.extent, 150, Math.max(150, available)) + 'px');
      for (const key of ['modelWidth', 'modelHeight', 'guideWidth', 'guideHeight']) view.style.setProperty('--' + key.replace(/[A-Z]/g, x => '-' + x.toLowerCase()), panels[key] ? panels[key] + 'px' : '100%');
      view.style.setProperty('--ex-toolbar-height', controls.offsetHeight + 'px');
      const showGuide = !cap.hidden && !panels.guide && !view.classList.contains('model-only');
      describe(left, L(leftOff ? '展开题目列表' : '收起题目列表', leftOff ? 'Show problem list' : 'Hide problem list'), !leftOff);
      describe(right, L(rightOff ? '展开题目内容' : '收起题目内容', rightOff ? 'Show problem panel' : 'Hide problem panel'), !rightOff);
      describe(guide, L(showGuide ? '收起引导' : '展开引导', showGuide ? 'Hide guide' : 'Show guide'), showGuide);
      describe(only, view.classList.contains('model-only') ? L('退出仅模型全屏', 'Exit model-only fullscreen') : L('仅模型全屏', 'Model-only fullscreen'), view.classList.contains('model-only'));
      describe(U.$('#btnFull'), document.fullscreenElement ? L('退出全屏', 'Exit fullscreen') : L('模型与引导全屏', 'Model and guide fullscreen'), !!document.fullscreenElement);
      guide.disabled = cap.hidden; left.hidden = right.hidden = !!document.fullscreenElement;
      if (EL.EX.W.r) EL.EX.W.r.draw();
    }
    function drag(event, move, end, hold = false) {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      const target = event.currentTarget, id = event.pointerId; target.setPointerCapture(id);
      let active = !hold, timer = hold ? setTimeout(() => { active = true; target.classList.add('resizing'); }, 380) : 0;
      const onMove = e => { if (e.pointerId === id && active) move(e); };
      const stop = e => { if (e.pointerId !== id) return; clearTimeout(timer); target.classList.remove('resizing'); target.removeEventListener('pointermove', onMove); target.removeEventListener('pointerup', stop); target.removeEventListener('pointercancel', stop); target.removeEventListener('lostpointercapture', stop); if (active && end) end(); save(); };
      target.addEventListener('pointermove', onMove); target.addEventListener('pointerup', stop); target.addEventListener('pointercancel', stop); target.addEventListener('lostpointercapture', stop);
    }
    for (const side of ['left', 'right']) {
      const bar = U.h('div.ex-divider', { role: 'separator', tabindex: '0', 'aria-orientation': 'vertical', 'aria-label': L(side === 'left' ? '调整左栏宽度' : '调整右栏宽度', 'Resize ' + side + ' column') });
      bar.dataset.side = side; if (side === 'left') view.before(bar); else view.after(bar);
      bar.addEventListener('pointerdown', e => { const x = e.clientX, initial = layout[side]; drag(e, e => { layout[side] = clamp(initial + (side === 'left' ? 1 : -1) * (e.clientX - x), side === 'left' ? 160 : 220, Math.max(240, work.clientWidth * .45)); schedule(); }); });
      bar.addEventListener('keydown', e => { if (!['ArrowLeft','ArrowRight'].includes(e.key)) return; e.preventDefault(); layout[side] = clamp(layout[side] + (e.key === 'ArrowRight' ? 20 : -20) * (side === 'left' ? 1 : -1), side === 'left' ? 160 : 220, work.clientWidth * .45); schedule(); save(); });
    }
    function sizeHandle(which) {
      const el = which === 'guide' ? cap : stage;
      const handle = U.h('div.' + which + '-corner', { tabindex: '0', role: 'separator', title: L('拖动调整大小', 'Drag to resize'), 'aria-label': L('拖动调整大小', 'Drag to resize') }, '');
      const resize = (dx, dy, initial) => {
        const w = Math.max(180, view.clientWidth - 24), h = Math.max(180, view.clientHeight - controls.offsetHeight - 24);
        panels[which + 'Width'] = clamp(initial.width + dx, 180, w);
        panels[which + 'Height'] = clamp(initial.height + dy, which === 'guide' ? 150 : 180, h);
        if (!cap.hidden && !panels.guide && !view.classList.contains('model-only')) {
          const vertical = ['left', 'right'].includes(view.dataset.guideDock);
          layout.extent = vertical ? which === 'guide' ? panels.guideWidth : w - panels.modelWidth - 8 : which === 'guide' ? panels.guideHeight : h - panels.modelHeight - 8;
        }
        schedule();
      };
      handle.addEventListener('pointerdown', e => { const start = { x: e.clientX, y: e.clientY, width: el.clientWidth, height: el.clientHeight }; drag(e, ev => resize(ev.clientX - start.x, ev.clientY - start.y, start)); });
      handle.addEventListener('keydown', e => { if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return; e.preventDefault(); resize(e.key === 'ArrowRight' ? 20 : e.key === 'ArrowLeft' ? -20 : 0, e.key === 'ArrowDown' ? 20 : e.key === 'ArrowUp' ? -20 : 0, { width: el.clientWidth, height: el.clientHeight }); save(); });
      return handle;
    }
    stage.append(sizeHandle('model'));
    function decorateGuide() {
      if (!cap.hidden && !cap.querySelector('.guide-body')) {
        const children = [...cap.childNodes], nav = cap.querySelector(':scope > .cap-nav:last-child');
        if (nav) { const prev = nav.querySelector('button'); prev.disabled = EL.EX.S.step === 0; prev.title = L('上一步', 'Previous step'); prev.setAttribute('aria-label', prev.title); }
        const body = U.h('div.guide-body'); children.forEach(node => { if (node !== nav) body.append(node); });
        const grip = U.h('div.guide-grip', { tabindex: '0', title: L('拖动', 'Drag') }, U.h('span', null, L('⠿ 引导探究', '⠿ Guided inquiry')));
        const fold = button('', L('收起', 'Collapse'), L('收起引导', 'Hide guide'), () => { panels.guide = true; focusPanels = null; schedule(); save(); }); fold.className = 'guide-fold';
        grip.append(fold);
        grip.addEventListener('pointerdown', e => {
          if (e.target.closest('button,.guide-corner')) return;
          let dock = layout.dock;
          drag(e, ev => { const r = view.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height; dock = [['left',x],['right',1-x],['top',y],['bottom',1-y]].sort((a,b)=>a[1]-b[1])[0][0]; view.dataset.guidePreview = dock; }, () => { layout.dock = dock; panels.guideWidth = panels.guideHeight = 0; delete view.dataset.guidePreview; schedule(); });
        });
        grip.addEventListener('keydown', e => { if (e.target !== grip) return; const dirs = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'top', ArrowDown:'bottom' }; if (dirs[e.key]) { e.preventDefault(); layout.dock = dirs[e.key]; panels.guideWidth = panels.guideHeight = 0; schedule(); save(); } });
        cap.replaceChildren(grip, body, ...(nav ? [nav] : []), sizeHandle('guide'));
      }
      apply();
    }
    const openGuide = EL.EX.guide;
    EL.EX.guide = function (...args) {
      panels.guide = false; view.classList.remove('model-only'); mobileTab = 'model'; mobileList = false;
      focusPanels = innerWidth > 720 ? { left: true, right: true } : null;
      const result = openGuide.apply(this, args); decorateGuide(); save(); return result;
    };
    new MutationObserver(decorateGuide).observe(cap, { childList: true, attributes: true, attributeFilter: ['hidden'] });
    const observer = new ResizeObserver(schedule); observer.observe(work); observer.observe(controls); observer.observe(view);
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) view.classList.remove('model-only'); schedule(); });
    decorateGuide();
  });
})(window.EL);
