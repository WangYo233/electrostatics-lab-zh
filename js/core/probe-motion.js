'use strict';
(function (EL) {
  const V = EL.V, P = EL.ProbeMotion = {};
  P.defaults = () => ({ constraint: 'free', origin: [0, 0, 0], normal: [0, 0, 1], a: [-2, 1, 0], b: [2, 1, 0], points: [[-2, 1, 0], [2, 1, 0]], showPath: false, t: 0, maxScope: 'global', half: 6, showMax: false });
  P.vector = p => Array.isArray(p) && p.length === 3 && p.every(x => Number.isFinite(x) && Math.abs(x) <= 1000);
  P.parse = text => {
    const rows = text.trim().split(/\n|;/).filter(x => x.trim()).map(x => { const parts = x.trim().split(/[,，\s]+/); if (parts.some(k => !k)) throw new Error('coordinates'); return parts.map(Number); });
    if (!rows.length || !rows.every(P.vector)) throw new Error('coordinates');
    return rows;
  };
  P.validPath = points => Array.isArray(points) && points.length >= 2 && points.length <= 64 && points.every(P.vector) && points.some(p => V.dist(p, points[0]) > 1e-8);
  P.clean = data => {
    const d = P.defaults(), s = data || {};
    for (const k of ['origin', 'normal', 'a', 'b']) if (P.vector(s[k])) d[k] = s[k].slice();
    if (V.len(d.normal) < 1e-8) d.normal = [0, 0, 1];
    if (V.dist(d.a, d.b) < 1e-8) d.b = V.add(d.a, [1, 0, 0]);
    if (['free', 'plane', 'line'].includes(s.constraint)) d.constraint = s.constraint;
    if (P.validPath(s.points)) d.points = s.points.map(p => p.slice());
    if (['global', 'box', 'plane', 'path'].includes(s.maxScope)) d.maxScope = s.maxScope;
    if (Number.isFinite(s.half) && s.half > 0 && s.half <= 100) d.half = s.half;
    if (Number.isFinite(s.t)) d.t = Math.max(0, Math.min(1, s.t));
    for (const k of ['showPath', 'showMax']) if (typeof s[k] === 'boolean') d[k] = s[k];
    return d;
  };
  P.project = (p, s) => {
    let q = p;
    if (s.constraint === 'plane') { const n = V.norm(s.normal); q = V.addS(p, n, -V.dot(V.sub(p, s.origin), n)); }
    if (s.constraint === 'line') { const d = V.norm(V.sub(s.b, s.a)); q = V.addS(s.a, d, V.dot(V.sub(p, s.a), d)); }
    // Keep an already-constrained point stable across redraws and pause/resume.
    return V.dist(q, p) <= 1e-12 * Math.max(1, V.len(p)) ? p.slice() : q;
  };
  P.route = s => s.points.map(p => P.project(p, s));
  // Arc-length parametrization keeps speed unchanged across unequal segments.
  P.at = (points, t) => {
    const lengths = points.slice(1).map((p, i) => V.dist(points[i], p)), total = lengths.reduce((a, b) => a + b, 0);
    let d = Math.max(0, Math.min(1, t)) * total;
    for (let i = 0; i < lengths.length; i++) { if (d <= lengths[i] && lengths[i] > 0) return V.lerp(points[i], points[i + 1], d / lengths[i]); d -= lengths[i]; }
    return points[points.length - 1].slice();
  };
  P.plane = s => { const n = V.norm(s.normal), u = V.perp(n); return { type: 'plane', origin: s.origin.slice(), u, v: V.cross(n, u), half: s.half }; };
})(window.EL);
