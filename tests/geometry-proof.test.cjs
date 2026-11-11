'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..');
function load(html) {
  const ctx = { console, Math, performance: { now: () => 0 }, setTimeout, window: { addEventListener() {} } };
  ctx.window.window = ctx.window; vm.createContext(ctx);
  for (const m of fs.readFileSync(path.join(root, html), 'utf8').matchAll(/<script src="([^"]+)"/g)) {
    if (/\/ex\/(view|student|teacher|app)\.js$/.test(m[1]) || /js\/audit\.js$/.test(m[1])) continue;
    if (/js\/app\//.test(m[1]) && !/\/(state|wizard)\.js$/.test(m[1])) continue;
    vm.runInContext(fs.readFileSync(path.join(root, m[1]), 'utf8'), ctx, { filename: m[1] });
  }
  vm.runInContext('var EL=window.EL;', ctx);
  return ctx.window.EL;
}
const exampleEL = load('examples.html'), { VA, V, EX: X, MH, C } = exampleEL;
const close = (a, b, tag) => assert.ok(Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b)), tag + ': ' + a + ' != ' + b);
let plans = 0, proofs = 0;
function check(plan, tag) {
  for (const s of plan) {
    if (s.id === 'combine' || s.id === 'chainSum') {
      assert.ok(s.proof || s.tetra, tag + ': missing length derivation');
      assert.ok(!s.ask, tag + ': must not guess an underived angle');
    }
    if (s.proof) {
      const p = s.proof;
      for (const row of p.pairs) close(row.c, V.dot(row.a.E, row.b.E), tag + ': source-pair length identity');
      close(p.squared, V.dot(s.g ? s.g.S : plan.d.T, s.g ? s.g.S : plan.d.T), tag + ': squared resultant');
      assert.ok(s.rows.length === p.pairs.length + 1 && s.tex.includes('r_i^2+r_j^2-d_{ij}^2'), tag + ': visible known lengths and law of cosines');
      proofs++;
    }
    assert.ok(!/With the angle.*known|已知.*夹角/.test(s.text), tag + ': unsupported known-angle claim');
    if (s.tex) assert.ok(!/merror|<code>/.test(exampleEL.texBlock(s.tex)), tag + ': invalid MathML');
  }
  plans++;
}
// The same in-repo converter is used by both guides and full solutions.
for (const pb of X.BUILTIN) for (const a of X.solve(pb).ans) {
  if (a.plan) check(a.plan, pb.id);
  const explanation = X.explain(a);
  if (['E', 'Ezero', 'angle'].includes(a.q.t)) for (const s of a.plan || []) if (s.proof) assert.ok(explanation.some(e => e.rows === s.rows), 'full solution retains distance data');
  for (const s of explanation) assert.ok(!/merror|<code>/.test(VA.stepHTML(s)), pb.id + ': valid solution formulas');
}
const tri = X.solve(X.BUILTIN.find(p => p.id === 'tpt-triangle-three-like'));
const special = tri.ans[0].plan.filter(s => s.tetra);
assert.equal(special.length, 3, 'three short geometry/similarity/result steps');
const t = special[0].tetra;
close(V.dist(t.mid, t.H), Math.sqrt(6) * t.edge / 2, 'NPH third side');
close(V.dist(t.P, t.H), t.edge / 2, 'PH extension');
close(V.dist(t.P, t.G), Math.sqrt(2 / 3) * t.edge, 'tetrahedral height');
close(V.dist(t.mid, t.H) / V.dist(t.P, t.G), 1.5, 'similar triangles CNH and CGP');
for (const s of special) {
  const k = tri.ans[0].plan.indexOf(s), out = VA.draw(tri.ans[0].plan, k, {}, { MH, C, R: 3 });
  for (const q of [{ n: t.mn, p: t.mid }, { n: t.gn, p: t.G }, ...(s.id === 'tetraHeight' ? [] : [{ n: t.hn, p: t.H }])]) {
    assert.ok(out.labels.some(l => l.text === q.n && V.dist(l.p, q.p) < 1e-8), 'proof point visible: ' + q.n);
  }
}
// Scale, rotate, translate, reverse all charges; no problem-ID special casing.
for (const scale of [0.3, 1, 7]) for (const sign of [1, -1]) {
  const map = p => [2 + scale * p[2], -3 + scale * p[0], 4 + scale * p[1]];
  const src = tri.R.sources.map(s => ({ ...s, q: sign * 2, p: map(s.p) })), P = map(tri.ans[0].plan.d.P);
  const plan = VA.plan({ parts: VA.parts(src, P), P, named: [{ n: 'G', p: [20, 20, 20] }, { n: 'H', p: [30, 30, 30] }] });
  assert.equal(plan.filter(s => s.tetra).length, 3, 'regular construction survives rigid transforms and charge reversal');
  assert.ok(plan.find(s => s.tetra).tetra.gn !== 'G', 'reserved G is preserved');
  check(plan, 'transformed tetra');
  src[0].p[0] += scale * 0.03;
  const altered = VA.plan({ parts: VA.parts(src, P), P });
  assert.ok(altered.every(s => !s.tetra), 'nonregular geometry must use distance proof');
  check(altered, 'perturbed tetra');
}
// Independent arbitrary unequal-charge configurations exercise multiple groups and cancellations.
let seed = 20261111;
const rand = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
for (let n = 2; n <= 16; n++) for (let j = 0; j < 20; j++) {
  const src = Array.from({ length: n }, (_, i) => ({ label: 'S' + i, q: (rand() - 0.5) * 4, p: [rand() * 4, rand() * 4, rand() * 4] }));
  const P = [-1, -2, -3];
  check(VA.plan({ parts: VA.parts(src, P), P }), 'custom ' + n + '/' + j);
}
// A small but nonzero angle is not exactly collinear.
const P = [0, 0, 0], parts = VA.parts([{ label: 'A', q: 1, p: [1, 0, 0] }, { label: 'B', q: 2, p: [1, 0.001, 0] }], P);
assert.ok(VA.angleStep({ items: parts }, { P, pn: 'P' }).tex.includes('cos'), 'near-collinear still needs a length proof');
const lab = load('lab.html');
for (const model of lab.MODELS) {
  lab.App.init(model);
  for (let i = 0; i < model.stages.length; i++) {
    lab.App.applyStage(i, true);
    const plan = lab.App.wizSteps(lab.App.ctx());
    if (plan) check(plan, 'model ' + model.id + '/' + i);
  }
}
// The auxiliary construction is framed in both wide and narrow viewports.
for (const [w, h] of [[900, 600], [360, 700]]) {
  const cam = new lab.Camera(); cam.w = w; cam.h = h;
  const points = tri.R.sources.map(s => s.p).concat([t.P, t.H]);
  Object.assign(cam, cam.frame(points)); cam.matrices();
  for (const p of points) {
    const q = cam.toScreen(p);
    assert.ok(q && q[0] > 12 && q[0] < w - 12 && q[1] > 12 && q[1] < h - 12, 'construction must fit with label margin');
  }
}
// A rounded 90-degree readout is not a proof of exact perpendicularity.
for (const offset of [0, 0.0001]) {
  const pair = VA.parts([{ label: 'A', q: 1, p: [-1, 0, 0] }, { label: 'B', q: 1, p: [-offset, -1, 0] }], [0, 0, 0]);
  const steps = [{ id: 'combine' }];
  steps.d = { parts: pair, groups: pair.map((x, i) => ({ items: [x], S: x.E, name: 'S' + i, type: 'single' })), P: [0, 0, 0], pn: 'P', named: [], T: VA.sum(pair) };
  let marks = 0;
  VA.draw(steps, 0, {}, { MH: { ...MH, right() { marks++; } }, C, R: 2 });
  assert.equal(marks, offset ? 0 : 1, 'right-angle mark must match the actual field directions');
}
console.log('Length derivations: ' + plans + ' plans, ' + proofs + ' numerical identities checked.');
