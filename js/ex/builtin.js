'use strict';
// 内置例题。第 1 题来自作者投稿 The Physics Teacher 的教学案例。model 为对应的实验室模型 id（X.LABS）
(function (EL) {
  EL.EX.BUILTIN = [
    { id: 'tpt-tetra', title: '正四面体：棱中点、切点与电势变化', src: '投稿案例', model: 4, kind: 'tpl', tpl: 'tetra',
      charges: { A: -1, B: 1, C: -1, D: 1 },
      pts: { P: { def: { t: 'mid', a: 'A', b: 'B' } }, M: { def: { t: 'face', f: ['A', 'B', 'C'] } }, N: { def: { t: 'face', f: ['A', 'C', 'D'] } } },
      qs: [{ t: 'E', at: 'P' }, { t: 'E', at: 'M' }, { t: 'trend', a: 'P', b: 'C' }],
      note: '正四面体的内切球与面 ABC、ACD 分别相切于 M、N 两点，切点就是这两个面的中心。' },
    { id: 'tetra-same', title: '正四面体：四个同号电荷的中心', model: 4, kind: 'tpl', tpl: 'tetra', charges: { A: 1, B: 1, C: 1, D: 1 },
      pts: { O: { def: { t: 'center' } }, P: { def: { t: 'mid', a: 'A', b: 'B' } } },
      qs: [{ t: 'Ezero', at: 'O' }, { t: 'V', at: 'O' }, { t: 'E', at: 'P' }] },
    { id: 'cube-diag', title: '正方体：体对角线上的异号电荷', model: 6, kind: 'tpl', tpl: 'cube', charges: { A: 1, 'C′': -1, C: 1, 'A′': -1 },
      pts: { O: { def: { t: 'center' } }, M: { def: { t: 'face', f: ['A′', 'B′', 'C′', 'D′'] } } },
      qs: [{ t: 'E', at: 'O' }, { t: 'V', at: 'M' }, { t: 'Vcmp', a: 'B', b: 'D′' }] },
    { id: 'octa-work', title: '正八面体：静电力做的功', model: 5, kind: 'tpl', tpl: 'octa', charges: { E: 1, F: 1, A: -1, C: -1 },
      pts: { O: { def: { t: 'center' } }, P: { def: { t: 'mid', a: 'E', b: 'A' } } },
      qs: [{ t: 'E', at: 'O' }, { t: 'E', at: 'P' }, { t: 'W', a: 'B', b: 'O', q0: -1 }] },
    { id: 'tri-above', title: '等边三角形：中心正上方的场强', model: 7, kind: 'tpl', tpl: 'tri', charges: { A: 1, B: 1, C: -1 },
      pts: { O: { def: { t: 'face', f: ['A', 'B', 'C'] } }, P: { def: { t: 'xyz', p: [0, 0, Math.sqrt(2 / 3)] } } },
      qs: [{ t: 'E', at: 'P' }, { t: 'E', at: 'O' }, { t: 'V', at: 'P' }],
      note: 'P 点在中心 O 的正上方，且 PA、PB、PC 都等于 a。' },
    { id: 'ana-conductor', title: '解析场：带电导体球内外的电势与场强', model: 8, kind: 'field', sub: 'conductor-sphere', sp: { q: 2, a: 1 },
      pts: { M: { def: { t: 'xyz', p: [0.5, 0, 0] } }, P: { def: { t: 'xyz', p: [2, 0, 0] } } },
      qs: [{ t: 'Ezero', at: 'M' }, { t: 'V', at: 'M' }, { t: 'E', at: 'P' }, { t: 'W', a: 'M', b: 'P', q0: 1 }],
      note: '导体球内部场强为零，但电势不为零。' },
    { id: 'disk-six', title: '圆盘电荷：六个同号电荷的总相互作用能', model: 3, kind: 'disk', disk: { N: 6, R: 2, q: 1, center: false, qc: 1 },
      pts: { O: { def: { t: 'center' } } },
      qs: [{ t: 'pairs' }, { t: 'U' }, { t: 'Ucmp' }, { t: 'Ezero', at: 'O' }] }
  ];
})(window.EL);
