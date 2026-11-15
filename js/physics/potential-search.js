'use strict';
// Bounded numerical searches. A sampled maximum is not a proof of a global maximum.
(function (EL) {
  const V = EL.V, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const vec = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
  const empty = reason => ({ status: 'empty', points: [], p: null, value: null, resolution: null, excluded: 0, samples: 0, infiniteSamples: 0, reason });

  function domainPatches(d) {
    if (!d) return null;
    if (d.type === 'box') {
      if (!vec(d.min) || !vec(d.max) || d.min.some((x, i) => !(d.max[i] > x) || !Number.isFinite(d.max[i] - x))) return null;
      return [{ lo: d.min.slice(), hi: d.max.slice(), n: 24, pos: q => q.slice() }];
    }
    if (d.type === 'plane') {
      if (!vec(d.origin) || !vec(d.u) || !vec(d.v) || !Number.isFinite(d.half) || !(d.half > 0)) return null;
      const lu = V.len(d.u), lv = V.len(d.v);
      if (!(lu > 0) || !(lv > 0) || !Number.isFinite(lu + lv)) return null;
      const u = V.mul(d.u, 1 / lu), v = V.mul(d.v, 1 / lv);
      if (Math.abs(V.dot(u, v)) > 1e-8) return null;
      return [{ lo: [-d.half, -d.half], hi: [d.half, d.half], n: 64,
        pos: q => V.addS(V.addS(d.origin, u, q[0]), v, q[1]), u, v }];
    }
    if (d.type === 'path') {
      if (!Array.isArray(d.points) || d.points.length < 2 || !d.points.every(vec)) return null;
      const segments = d.points.slice(1).map((p, i) => ({ a: d.points[i], b: p, length: V.dist(d.points[i], p) })).filter(s => s.length > 0);
      const length = segments.reduce((s, x) => s + x.length, 0);
      if (!(length > 0) || !Number.isFinite(length)) return null;
      return segments.map(s => ({ lo: [0], hi: [s.length], n: Math.max(8, Math.ceil(1024 * s.length / length)),
        pos: q => V.lerp(s.a, s.b, q[0] / s.length), a: s.a, b: s.b }));
    }
    return null;
  }

  // Membership is geometric, rather than based on the sampling grid: a path may
  // pass through a singularity between two sampled positions.
  function contains(d, patches, p) {
    const scale = Math.max(1, ...p.map(Math.abs), ...patches.flatMap(x => x.hi.map(Math.abs)));
    const eps = 1e-10 * scale;
    if (d.type === 'box') return p.every((x, i) => x >= d.min[i] - eps && x <= d.max[i] + eps);
    if (d.type === 'plane') {
      const b = patches[0], r = V.sub(p, d.origin), x = V.dot(r, b.u), y = V.dot(r, b.v);
      return Math.abs(x) <= d.half + eps && Math.abs(y) <= d.half + eps && V.dist(p, b.pos([x, y])) <= eps;
    }
    return patches.some(s => {
      const ab = V.sub(s.b, s.a), t = clamp(V.dot(V.sub(p, s.a), ab) / V.dot(ab, ab), 0, 1);
      return V.dist(p, V.lerp(s.a, s.b, t)) <= eps;
    });
  }

  function netSources(F) {
    const groups = new Map();
    for (const s of F.sources || []) {
      if (!vec(s.p) || !Number.isFinite(s.q)) continue;
      const key = JSON.stringify(s.p);
      if (!groups.has(key)) groups.set(key, { p: s.p.slice(), q: 0, magnitude: 0, count: 0 });
      const group = groups.get(key);
      group.q += s.q; group.magnitude += Math.abs(s.q); group.count++;
    }
    // Decimal input such as 0.1 + 0.2 - 0.3 must not create a spurious singularity.
    return [...groups.values()].map(s => ({ p: s.p, q: Math.abs(s.q) <= Number.EPSILON * s.magnitude * s.count * 4 ? 0 : s.q }));
  }
  function positiveSingularities(F, d, patches) {
    if (F.kind !== 'points') return [];
    return netSources(F).filter(s => s.q > 0 && contains(d, patches, s.p)).map(s => s.p);
  }

  function search(F, domain) {
    const patches = domainPatches(domain);
    if (!patches || !F || typeof F.sample !== 'function') return empty('invalid-domain');
    const singularities = positiveSingularities(F, domain, patches);
    if (singularities.length) return { ...empty(), status: 'unbounded', points: singularities, value: Infinity, reason: 'ideal-positive-point-singularity' };
    const result = empty('no-finite-samples');
    let best = null;
    function evaluate(b, q) {
      const p = b.pos(q), sample = F.sample(p);
      result.samples++;
      if (sample.V === Infinity) result.infiniteSamples++;
      if (!sample.ok || !Number.isFinite(sample.V)) { result.excluded++; return null; }
      const candidate = { p, q: q.slice(), value: sample.V };
      if (!best || candidate.value > best.value) best = candidate;
      return candidate;
    }
    let resolution = 0;
    for (const b of patches) {
      const step = b.hi.map((x, i) => (x - b.lo[i]) / b.n), seeds = [];
      function retain(candidate) {
        if (!candidate || (seeds.length === 8 && candidate.value <= seeds[7].value)) return;
        seeds.push(candidate); seeds.sort((a, c) => c.value - a.value); if (seeds.length > 8) seeds.pop();
      }
      function grid(q, axis) {
        if (axis === b.lo.length) { retain(evaluate(b, q)); return; }
        for (let i = 0; i <= b.n; i++) { q[axis] = i === b.n ? b.hi[axis] : b.lo[axis] + i * step[axis]; grid(q, axis + 1); }
      }
      grid([], 0);
      // Refine several high samples to avoid depending on a single grid seed.
      for (let current of seeds) {
        let delta = step.slice();
        for (let level = 0; level < 10; level++) {
          delta = delta.map(x => x / 2);
          for (let pass = 0; pass < 4; pass++) {
            const previous = current;
            for (let axis = 0; axis < delta.length; axis++) for (const sign of [-1, 1]) {
              const q = current.q.slice(); q[axis] = clamp(q[axis] + sign * delta[axis], b.lo[axis], b.hi[axis]);
              const next = evaluate(b, q);
              if (next && next.value > current.value) current = next;
            }
            if (previous === current) break;
          }
        }
      }
      resolution = Math.max(resolution, ...step.map(x => x / 1024));
    }
    if (best) Object.assign(result, { status: 'sampled', p: best.p, value: best.value, resolution, reason: null });
    return result;
  }
  function global(F) {
    if (!F || F.kind !== 'points') return empty('unsupported-global-domain');
    const net = netSources(F), positive = net.filter(s => s.q > 0);
    if (positive.length) return { ...empty(), status: 'unbounded', value: Infinity, points: positive.map(s => s.p) };
    // With only negative net sources, V<0 at every finite regular point and V→0 at infinity.
    if (net.some(s => s.q < 0)) return { ...empty(), status: 'supremum', value: 0 };
    return { ...empty(), status: 'constant', value: 0 };
  }
  EL.PotentialSearch = { search, global };
})(window.EL);
