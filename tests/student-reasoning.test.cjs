'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..'), ctx = { console, Math, performance: { now: () => 0 }, setTimeout, window: { addEventListener() {} } };
ctx.window.window = ctx.window; vm.createContext(ctx);
for (const m of fs.readFileSync(path.join(root, 'examples.html'), 'utf8').matchAll(/<script src="([^"]+)"/g)) {
  if (/\/(view|student|teacher|app|layout)\.js$/.test(m[1])) continue;
  vm.runInContext(fs.readFileSync(path.join(root, m[1]), 'utf8'), ctx);
}
const { EX: X, VA } = ctx.window.EL;
const triangle = X.BUILTIN.find(pb => pb.id === 'tpt-triangle-three-like'), sol = X.solve(triangle);
assert.equal(sol.ans[0].mag, '√6 kQ/a²');
for (const o of sol.ans) {
  assert.ok(o.ok); assert.ok(!o.options.some(option => /\d\.\d/.test(option)), 'built-in triangle options require no decimal calculation');
}
const similar = sol.ans[0].plan.find(st => st.id === 'similar');
assert.ok(similar); assert.doesNotMatch(similar.tex, /\\cos|\\theta/, 'similarity uses corresponding sides, not numerical angles');
assert.equal(similar.sim.mn, 'M', 'reuse the midpoint from the problem');
assert.equal(similar.g.items.map(x => x.label).sort().join(''), 'BC', 'combine B and C before adding A');
assert.doesNotMatch(JSON.stringify(X.explain(sol.ans[0])), /\bN\b/, 'the field explanation introduces no unused N');
assert.match(similar.tex, /\\sqrt|\\frac/);
const angleProblem = JSON.parse(JSON.stringify(triangle)); angleProblem.qs = [{t:'angle',at:'P',a:'P',b:'A'}];
const cosine = X.solve(angleProblem).ans[0], expected = -Math.sqrt(2/3);
assert.ok(cosine.cosineQuestion); assert.match(cosine.answer, /^cos α = /);
assert.match(X.qText2(angleProblem.qs[0], angleProblem), /cos α/);
assert.ok(Math.abs(ctx.window.EL.U.parseNum(cosine.answer.split(' = ')[1]) - expected) < 1e-10);
assert.ok(cosine.options.includes(X.rightOf(cosine))); assert.ok(cosine.options.every(option => !/°|\d\.\d/.test(option)));
assert.ok(cosine.plan.some(st => st.id === 'angleRatio'));
for (const step of X.explain(cosine)) if (step.tex) assert.doesNotMatch(ctx.window.EL.texBlock(step.tex), /<merror>|<code>/);
angleProblem.qs[0] = {t:'angle',at:'P',a:'G',b:'P'};
const special = X.solve(angleProblem).ans[0]; assert.equal(special.answer, '0°'); assert.ok(!special.cosineQuestion);
const check = sol.ans[0].plan.find(st => st.id === 'check');
assert.ok(check.rows.slice(1).every(row => row.slice(1).every(value => !/\d\.\d/.test(value))), 'simple component tables keep exact fractions and radicals');
console.log('Student reasoning: exact options, similarity ratios, cosine questions and special angles passed.');
