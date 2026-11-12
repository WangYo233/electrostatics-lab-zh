'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..'), ctx = { console, Math, performance: { now: () => 0 }, setTimeout, window: { addEventListener() {} } };
ctx.window.window = ctx.window; vm.createContext(ctx);
for (const m of fs.readFileSync(path.join(root, 'examples.html'), 'utf8').matchAll(/<script src="([^"]+)"/g)) {
  if (/\/(view|student|teacher|app)\.js$/.test(m[1])) continue;
  vm.runInContext(fs.readFileSync(path.join(root, m[1]), 'utf8'), ctx);
}
const { EX: X, V, VA } = ctx.window.EL;
let formulas = 0, calculations = 0;
function checkTex(steps) {
  for (const st of steps) if (st.tex) { assert.doesNotMatch(ctx.window.EL.texBlock(st.tex), /<merror>|<code>/, st.tex); formulas++; }
}
for (const pb of X.BUILTIN) {
  const sol = X.solve(pb);
  for (const o of sol.ans) {
    assert.ok(o.ok, pb.id + ': ' + o.err);
    if (o.q.t === 'trend') {
      const p = o.pathProof;
      assert.equal(X.pathSteps(pb, sol.R, o, 0.3).length, 6);
      for (const s of [0.13, 0.3, 0.73]) {
        const dx = 1e-6, finiteDifference = (p.at(s + dx).V - p.at(s - dx).V) / (2 * dx);
        assert.ok(Math.abs(p.slope(s) - finiteDifference) < 1e-5 * Math.max(1, Math.abs(p.slope(s))));
        for (const source of p.sources) assert.ok(Math.abs(V.dist(V.lerp(p.a, p.b, s), source.p) ** 2 - ((s * p.length - source.h) ** 2 + source.b2)) < 1e-10);
      }
      if (p.special.kind === 'median') {
        assert.equal(p.roots.length, 1); const r = p.roots[0];
        assert.ok(Math.abs(r - 0.5694367096060693) < 1e-10);
        assert.ok(p.slope(0.2) > 0 && p.slope(0.9) < 0);
        for (const s of [0.1, 0.5, 0.9]) {
          const lhs = 4 * (1 - s) ** 2 * (s + 2) ** 4 - ((1 - s) ** 2 + 3) ** 3;
          const rhs = 3 * s * (s ** 5 + 10 * s ** 4 + 4 * s ** 3 + 8 * s ** 2 - 64 * s + 32);
          assert.ok(Math.abs(lhs - rhs) < 1e-10, 'squared equation expansion');
        }
      } else { assert.equal(p.special.kind, 'tetra'); assert.equal(p.roots.length, 0); for (let s = 0.01; s < 1; s += 0.01) assert.ok(p.slope(s) < 0); }
      const reverse = JSON.parse(JSON.stringify(pb)); Object.keys(reverse.charges).forEach(k => reverse.charges[k] *= -1);
      const reversed = X.solve(reverse).ans.find(x => x.q.t === 'trend');
      assert.ok(Math.abs(reversed.pathProof.slope(0.37) + p.slope(0.37)) < 1e-10);
      checkTex(X.pathSteps(pb, sol.R, o, 0.3));
    } else if (!o.plan || sol.R.analytic) { const steps = X.calculationSteps(pb, sol.R, o); assert.ok(steps.length >= 2); checkTex(steps); calculations++; }
    if (o.plan) for (let i = 0; i < o.plan.length; i++) if (o.plan[i].sim) {
      const out = VA.draw(o.plan, i, {}, { MH: ctx.window.EL.MH, C: ctx.window.EL.C, R: 2, step: i });
      assert.ok(out.labels.filter(l => l.text.includes('=E₀')).length >= 2);
      assert.ok(out.labels.filter(l => l.text.startsWith('r=')).length >= 2);
    }
  }
}
// Rotating, translating and scaling the geometry preserves the critical path parameter.
const original = X.BUILTIN.find(pb => pb.id === 'tpt-triangle-three-like'), resolved = X.resolve(original);
const transform = p => [3 + 2 * p[2], -4 + 2 * p[0], 1 + 2 * p[1]];
const sources = resolved.sources.map(x => ({ ...x, p: transform(x.p) })), field = ctx.window.EL.Phys.pointField(sources, 1e-9);
const moved = { sources, pts: { G: { p: transform(resolved.pts.G.p) }, M: { p: transform(resolved.pts.M.p) } }, field: p => field.sample(p) };
const proof = X.pathAnalysis(original, moved, { a: 'G', b: 'M' });
assert.equal(proof.special.kind, 'median'); assert.ok(Math.abs(proof.roots[0] - 0.5694367096060693) < 1e-9);
const originalProof = X.solve(original).ans.find(o => o.q.t === 'trend').pathProof;
assert.ok(Math.abs(proof.slope(0.3) * 2 - originalProof.slope(0.3)) < 1e-10);
// Custom symmetric path: root exactly on the sampling grid must not disappear.
const free = { kind: 'free', model: 1, srcs: [{ label: 'A', p: [0, 1, 0], q: 1 }], bgs: [], pts: { P: { def: { t: 'xyz', p: [-1, 0, 0] } }, Q: { def: { t: 'xyz', p: [1, 0, 0] } } }, qs: [{ t: 'trend', a: 'P', b: 'Q' }] };
const sym = X.solve(free).ans[0]; assert.ok(sym.ok, sym.err); assert.equal(sym.pathProof.roots.length, 1); assert.ok(Math.abs(sym.pathProof.roots[0] - 0.5) < 1e-8);
free.pts.Q.def.p = [-1, 0, 0]; assert.equal(X.solve(free).ans[0].ok, false);
free.pts.Q.def.p = [1, 0, 0]; free.srcs[0].p = [0.12345, 0, 0]; assert.equal(X.solve(free).ans[0].ok, false);
for (const sub of Object.keys(ctx.window.EL.SUB08)) {
  const pb = X.applyItem({}, X.itemOf('field:' + sub));
  pb.pts = { P: { def: { t: 'xyz', p: [0.8, 0, 0.4] } }, Q: { def: { t: 'xyz', p: [1.8, 0, -0.4] } } };
  pb.qs = [{ t: 'trend', a: 'P', b: 'Q' }];
  const sol = X.solve(pb), o = sol.ans[0]; assert.ok(o.ok, sub + ': ' + o.err);
  checkTex(X.pathSteps(pb, sol.R, o, 0.3));
}
console.log('Calculation guides: ' + calculations + ' non-vector questions; ' + formulas + ' formulas; path distances, derivatives, roots, reversal, exact-grid root and invalid paths verified.');
