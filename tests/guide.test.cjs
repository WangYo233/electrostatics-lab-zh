'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..');
const ctx = { console, Math, performance: { now: () => 0 }, setTimeout, window: { addEventListener() {} } };
ctx.window.window = ctx.window;
vm.createContext(ctx);
for (const m of fs.readFileSync(path.join(root, 'examples.html'), 'utf8').matchAll(/<script src="([^"]+)"/g)) {
  if (/\/(view|student|teacher|app)\.js$/.test(m[1])) continue;
  vm.runInContext(fs.readFileSync(path.join(root, m[1]), 'utf8'), ctx, { filename: m[1] });
}
const { EX: X, VA, V, MH, C } = ctx.window.EL;
const triangle = X.solve(X.BUILTIN.find(p => p.id === 'tpt-triangle-three-like'));
const plan = triangle.ans[0].plan, i = plan.findIndex(s => s.id === 'similar'), step = plan[i];
const draw = (steps, k, active = k) => VA.draw(steps, k, {}, { MH, C, R: 2, step: active });
const hasPoint = (out, n, p) => (out.labels || []).some(l => l.text === n && V.dist(l.p, p) < 1e-9) && (out.spheres || []).some(s => V.dist(s.p, p) < 1e-9);
assert.equal(step.sim.mn, 'N');
const before = draw(plan, i - 1, i);
assert.ok(hasPoint(before, 'N', step.sim.mid), 'prediction must show midpoint N before an answer');
assert.ok(step.setup && step.setup.includes('N') && step.setup.includes('AB'), 'prediction must define N');
assert.ok(!(before.labels || []).some(l => l.text === step.g.name), 'prediction must not reveal the requested resultant');
assert.ok(hasPoint(draw(plan, i), 'N', step.sim.mid), 'midpoint remains visible after answering');
let checked = 0;
function checkPlan(steps, tag) {
  for (let j = 0; j < steps.length; j++) {
    const s = steps[j], shown = draw(steps, j), waiting = s.ask ? draw(steps, j - 1, j) : shown;
    if (s.sim) {
      assert.ok(hasPoint(shown, s.sim.mn, s.sim.mid), tag + ': midpoint after answering');
      if (s.ask) {
        assert.ok(hasPoint(waiting, s.sim.mn, s.sim.mid), tag + ': midpoint before answering');
        assert.ok(s.setup.includes(s.sim.mn), tag + ': midpoint definition before answering');
        assert.ok(!waiting.labels.some(l => l.text === s.g.name), tag + ': no premature resultant');
      }
    }
    if (s.id === 'combine' && s.ask) for (const g of steps.d.groups) {
      if (V.len(g.S) > 1e-9) assert.ok(waiting.labels.some(l => l.text === g.name), tag + ': missing partial sum ' + g.name);
    }
    const refs = [], vectors = s.id === 'combine' ? steps.d.groups.map(g => g.S) : s.g ? [s.g.S] : s.id === 'check' ? [steps.d.T] : [];
    vectors.forEach(v => VA.describe(v, steps.d.named, refs));
    for (const q of refs) {
      if (!steps.d.parts.some(x => x.label === q.n) && q.n !== steps.d.pn) assert.ok(hasPoint(shown, q.n, q.p), tag + ': direction reference ' + q.n);
    }
    checked++;
  }
}
for (const pb of X.BUILTIN) for (const ans of X.solve(pb).ans) if (ans.plan) checkPlan(ans.plan, pb.id);
for (const tpl of Object.keys(X.TEMPLATES)) for (const sign of [1, -1]) {
  const geo = X.geo(tpl), P = [0.19, 0.23, 1.7], sources = geo.labels.map((label, i) => ({ label, p: geo.v[label], q: i % 2 ? sign : 1 }));
  for (const method of ['geo', 'coord']) checkPlan(VA.plan({ parts: VA.parts(sources, P), P, pName: 'P', named: [{ n: 'O', p: [0, 0, 0] }, { n: 'P', p: P }], method }), tpl + '/' + method);
}
const sources = [{ label: 'A', q: 1, p: [-1, 0, 0] }, { label: 'B', q: 1, p: [1, 0, 0] }, { label: 'C', q: 1, p: [-2, 0, 0] }, { label: 'D', q: 1, p: [2, 0, 0] }];
const P = [0, 1, 0], named = ['M', 'N', 'K', 'H'].map((n, i) => ({ n, p: [i + 4, 2, 0] }));
const reserved = VA.plan({ parts: VA.parts(sources, P), P, named });
checkPlan(reserved, 'reserved point names');
const mids = reserved.filter(s => s.id === 'similar').map(s => s.sim.mn);
assert.equal(new Set(mids).size, mids.length, 'different construction groups use distinct auxiliary names');
assert.ok(mids.every(n => !named.some(q => q.n === n)), 'auxiliary names do not overwrite existing points');
console.log('Guide geometry: ' + checked + ' steps checked, including prediction references and withheld results.');
