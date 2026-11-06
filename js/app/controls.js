'use strict';
// 通用表单控件：滑块+数值框、开关、下拉、分组
(function (EL) {
  const U = EL.U, h = U.h;
  const K = EL.UI = {};
  let uid = 0;

  // 数值框可直接键入，Enter 或失焦提交；超出范围或不在步长上时提示并回退
  K.slider = function (o) {
    const id = 'c' + (++uid);
    const dec = (String(o.step).split('.')[1] || '').length;
    const rng = h('input', { type: 'range', id, min: o.min, max: o.max, step: o.step, value: o.val, disabled: o.disabled });
    const num = h('input.num', { type: 'number', min: o.min, max: o.max, step: o.step, value: (+o.val).toFixed(dec), disabled: o.disabled, 'aria-label': o.label });
    rng.addEventListener('input', () => { num.value = (+rng.value).toFixed(dec); o.on(+rng.value, true); });
    rng.addEventListener('change', () => o.on(+rng.value, false));
    const commit = () => {
      const v = +num.value, off = Math.abs((v - o.min) / o.step - Math.round((v - o.min) / o.step)) > 1e-6;
      if (!isFinite(v) || v < o.min - 1e-9 || v > o.max + 1e-9 || off) {
        U.toast('请输入 ' + o.min + ' 到 ' + o.max + ' 之间的数值，步长为 ' + o.step + '。');
        num.value = (+rng.value).toFixed(dec);
        return;
      }
      rng.value = v;
      o.on(v, false);
    };
    num.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commit(); num.blur(); } });
    num.addEventListener('blur', commit);
    return h('div.ctl', null, h('label', { for: id, title: o.tip || '', html: U.rich(o.label) }), h('div.row', null, rng, num));
  };

  K.check = function (label, val, on, tip) {
    const id = 'c' + (++uid);
    const inp = h('input', { type: 'checkbox', id, checked: !!val });
    inp.addEventListener('change', () => on(inp.checked));
    return h('div.chk', { title: tip || '' }, inp, h('label', { for: id }, label));
  };

  K.select = function (label, opts, val, on) {
    const id = 'c' + (++uid);
    const sel = h('select', { id }, opts.map(o => h('option', { value: o[0], selected: String(o[0]) === String(val) }, o[1])));
    sel.addEventListener('change', () => on(sel.value));
    return h('div.ctl', null, label ? h('label', { for: id }, label) : null, sel);
  };

  K.seg = function (opts, val, on) {
    return h('div.seg', { role: 'group' }, opts.map(o => h('button', { type: 'button', class: String(o[0]) === String(val) ? 'on' : '', 'aria-pressed': String(o[0]) === String(val), onclick: () => on(o[0]) }, o[1])));
  };

  K.btn = (label, on, cls, tip) => h('button', { type: 'button', class: 'btn ' + (cls || ''), onclick: on, title: tip || '' }, label);

  K.group = (title, ...kids) => h('section.grp', null, title ? h('h4', null, title) : null, ...kids);

  K.note = text => h('p.note', null, text);
  // 简短说明：默认收起，点“ⓘ 说明”展开，避免大段文字
  K.tip = function (text, label) {
    const d = h('details.tip', null, h('summary', null, label || 'ⓘ 说明'), h('p', { html: EL.U.richMath(text) }));
    return d;
  };

  // 小型数字输入（源编辑表）
  K.cell = function (val, step, on, w) {
    const inp = h('input.cell', { type: 'number', step, value: val, style: 'width:' + (w || 4.2) + 'em' });
    const go = () => { const v = +inp.value; if (isFinite(v)) on(v); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { go(); inp.blur(); } });
    inp.addEventListener('change', go);
    return inp;
  };

  // 特殊角的精确三角函数值
  K.exactTrig = function (deg) {
    const T = { 0: ['1', '0'], 30: ['√3/2', '1/2'], 45: ['√2/2', '√2/2'], 60: ['1/2', '√3/2'], 90: ['0', '1'],
      120: ['−1/2', '√3/2'], 135: ['−√2/2', '√2/2'], 150: ['−√3/2', '1/2'], 180: ['−1', '0'] };
    const r = Math.round(deg);
    return Math.abs(deg - r) < 0.05 && T[r] ? { cos: T[r][0], sin: T[r][1], exact: true } : null;
  };
})(window.EL);
