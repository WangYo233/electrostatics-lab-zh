'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ctx = { window: {} };
vm.createContext(ctx);
for (const file of ['js/core/vec.js', 'js/physics/field.js', 'js/physics/potential-search.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), ctx, { filename: file });
}
const { Phys, PotentialSearch: { search } } = ctx.window.EL;
const point = (q, p = [0, 0, 0]) => ({ q, p });
const field = sources => Phys.pointField(sources, 0.05);
const box = { type: 'box', min: [-2, -2, -2], max: [2, 2, 2] };
const plane = { type: 'plane', origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], half: 2 };
const route = { type: 'path', points: [[-1, 0, 0], [1, 0, 0], [1, 1, 0]] };
const near = (a, b, tol = 1e-5) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

const positive = search(field([point(1)]), box);
assert.equal(positive.status, 'unbounded'); assert.equal(positive.value, Infinity); assert.equal(positive.points.length, 1);
assert.equal(search(field([point(1), point(-2)]), box).status, 'sampled', 'coincident net-negative charge is not a positive singularity');
assert.equal(search(field([point(0.1), point(0.2), point(-0.3)]), box).status, 'sampled', 'roundoff in decimal cancellation must not manufacture a positive singularity');
assert.equal(search(field([point(1e-20)]), box).status, 'unbounded', 'a small genuine positive charge remains unbounded');
const cancelled = search(field([point(1), point(-1)]), box);
assert.equal(cancelled.status, 'sampled'); near(cancelled.value, 0); assert.ok(cancelled.excluded > 0, 'existing sample exclusion remains respected');
assert.equal(search(field([point(2), point(-1)]), plane).status, 'unbounded');
assert.equal(search(field([point(1, [0, 0, 1])]), plane).status, 'sampled');
assert.equal(search(field([point(1, [2.1, 0, 0])]), plane).status, 'sampled', 'infinite plane must be clipped to the specified square');
assert.equal(search(field([point(1, [0.123456789, 0, 0])]), route).status, 'unbounded', 'singularity between path grid nodes is detected geometrically');
assert.equal(search(field([point(1, [1, 0.314159, 0])]), route).status, 'unbounded', 'all polyline segments are checked');
assert.equal(search(field([point(1, [0.123456789, 0.01, 0])]), route).status, 'sampled', 'a nearby charge outside the path is not a path singularity');
assert.equal(search(field([point(1, [2, 2, 2])]), box).status, 'unbounded', 'domain boundaries included');

const negative = search(field([point(-1)]), box);
assert.equal(negative.status, 'sampled'); near(negative.value, -1 / Math.sqrt(12));
assert.ok(negative.p.every(x => Math.abs(x) === 2), 'negative-only maximum is on the box boundary');
const above = search(field([point(1, [0.123, -0.321, 1])]), plane);
near(above.p[0], 0.123, 0.0001); near(above.p[1], -0.321, 0.0001); near(above.value, 1);
const linePeak = search(field([point(1, [0.123, 0.5, 0])]), { type: 'path', points: [[-1, 0, 0], [1, 0, 0]] });
near(linePeak.p[0], 0.123, 0.0001); near(linePeak.value, 2);
const rotated = { type: 'plane', origin: [0, 0, 0], u: [1, 1, 0], v: [0, 0, 1], half: 1 };
assert.equal(search(field([point(1, [0.2, 0.2, 0.3])]), rotated).status, 'unbounded');
const linear = Phys.analyticField(p => ({ V: p[0] + 2 * p[1] + 3 * p[2], E: [-1, -2, -3] }));
const edge = search(linear, box); near(edge.value, 12); assert.ok(edge.p.every(x => x === 2));
const onlyUndefined = search(Phys.analyticField(() => ({ V: NaN, E: [NaN, NaN, NaN] })), plane);
assert.equal(onlyUndefined.status, 'empty'); assert.equal(onlyUndefined.samples, onlyUndefined.excluded);
const analyticInfinity = search(Phys.analyticField(p => ({ V: p[0] === 0 ? Infinity : 1 / Math.abs(p[0]), E: [0, 0, 0] })), plane);
assert.ok(analyticInfinity.infiniteSamples > 0); assert.equal(analyticInfinity.status, 'sampled', 'arbitrary analytic functions receive no unsupported global certificate');
for (const invalid of [null, {}, { ...box, min: [2, 2, 2] }, { ...box, max: [Infinity, 2, 2] }, { ...plane, half: 0 }, { ...plane, v: [1, 0, 0] }, { ...route, points: [] }, { ...route, points: [[0, 0, 0], [0, 0, 0]] }]) {
  const result = search(linear, invalid); assert.equal(result.status, 'empty'); assert.equal(result.reason, 'invalid-domain');
}
console.log('Potential search: singularities, cancellation, paths, planes, refinement, boundaries and invalid domains passed.');

const whole = ctx.window.EL.PotentialSearch.global;
assert.equal(whole(field([point(1,[100,0,0])])).status, 'unbounded', 'global includes sources outside view bounds');
assert.equal(whole(field([point(-1)])).status, 'supremum', 'negative charges attain no finite global maximum');
assert.equal(whole(field([])).status, 'constant');
assert.equal(whole(field([point(0.1),point(0.2),point(-0.3)])).status, 'constant');
assert.equal(whole(field([point(1e-20)])).status, 'unbounded');
assert.equal(whole(Phys.analyticField(p => ({V:0,E:[0,0,0]}))).reason, 'unsupported-global-domain');
