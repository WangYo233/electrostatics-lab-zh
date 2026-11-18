'use strict';
(function (EL) {
  const V = EL.V, P = EL.ProbeMotion = {};
  P.defaults = () => ({ constraint: 'free', origin: [0, 0, 0], normal: [0, 0, 1], a: [-2, 1, 0], b: [2, 1, 0], points: [[-2, 1, 0], [2, 1, 0]], routeMode: 'waypoints', formula: { x: '2*cos(t)', y: '2*sin(t)', z: '0', min: 0, max: 2*Math.PI }, routeEnabled: false, showPath: false, t: 0, maxScope: 'global', half: 6, showMax: false });
  // Parse arithmetic only: route formulas never execute JavaScript.
  P.compile = expression => {
    if (typeof expression !== 'string' || !expression.trim() || expression.length > 256) throw Error('formula');
    const source = expression.replace(/−/g, '-').replace(/\*\*/g, '^'), tokens = [];
    let at = 0;
    while (at < source.length) {
      const m = /^(\s+|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|[a-z]+|[+*/^(),-])/i.exec(source.slice(at));
      if (!m) throw Error('formula'); at += m[0].length;
      if (!/^\s/.test(m[0])) tokens.push(m[0].toLowerCase());
      if (tokens.length > 128) throw Error('formula');
    }
    let i = 0, depth = 0;
    const unaryFns = { sin:Math.sin, cos:Math.cos, tan:Math.tan, asin:Math.asin, acos:Math.acos, atan:Math.atan, sqrt:Math.sqrt, abs:Math.abs, exp:Math.exp, log:Math.log, ln:Math.log, floor:Math.floor, ceil:Math.ceil };
    const binaryFns = { min:Math.min, max:Math.max, pow:Math.pow, atan2:Math.atan2 };
    const expect = token => { if (tokens[i++] !== token) throw Error('formula'); };
    const primary = () => {
      if (++depth > 24) throw Error('formula');
      const token = tokens[i++]; let f;
      if (token === '(') { f = sum(); expect(')'); }
      else if (token === 't') f = t => t;
      else if (token === 'pi' || token === 'e') { const n = token === 'pi' ? Math.PI : Math.E; f = () => n; }
      else if (Object.hasOwn(unaryFns, token)) { expect('('); const a = sum(); expect(')'); const fn = unaryFns[token]; f = t => fn(a(t)); }
      else if (Object.hasOwn(binaryFns, token)) { expect('('); const a = sum(); expect(','); const b = sum(); expect(')'); const fn = binaryFns[token]; f = t => fn(a(t), b(t)); }
      else if (token && /^(?:\d|\.)/.test(token) && Number.isFinite(Number(token))) { const n = Number(token); f = () => n; }
      else throw Error('formula');
      depth--; return f;
    };
    const power = () => { const a = primary(); if (tokens[i] !== '^') return a; i++; const b = unary(); return t => Math.pow(a(t), b(t)); };
    const unary = () => { if (tokens[i] === '+' || tokens[i] === '-') { const sign = tokens[i++] === '-' ? -1 : 1, a = unary(); return t => sign*a(t); } return power(); };
    const product = () => { let a = unary(); while (tokens[i] === '*' || tokens[i] === '/') { const op = tokens[i++], left = a, b = unary(); a = t => op === '*' ? left(t)*b(t) : left(t)/b(t); } return a; };
    const sum = () => { let a = product(); while (tokens[i] === '+' || tokens[i] === '-') { const op = tokens[i++], left = a, b = product(); a = t => op === '+' ? left(t)+b(t) : left(t)-b(t); } return a; };
    const f = sum(); if (i !== tokens.length) throw Error('formula'); return f;
  };
  const cache = new Map();
  P.formulaAt = (formula, progress) => {
    if (!formula || !Number.isFinite(formula.min) || !Number.isFinite(formula.max) || Math.abs(formula.min)>1000 || Math.abs(formula.max)>1000 || formula.max <= formula.min) throw Error('range');
    const key = JSON.stringify([formula.x,formula.y,formula.z]); let fs = cache.get(key);
    if (!fs) { fs = ['x','y','z'].map(k => P.compile(formula[k])); if (cache.size >= 32) cache.clear(); cache.set(key,fs); }
    const t = formula.min + Math.max(0,Math.min(1,progress))*(formula.max-formula.min), p = fs.map(f => f(t));
    if (!P.vector(p)) throw Error('domain'); return p;
  };
  P.sampleFormula = (formula, samples = 257) => {
    if (!Number.isInteger(samples) || samples < 2 || samples > 513) throw Error('samples');
    const points = Array.from({length:samples}, (_,i) => P.formulaAt(formula,i/(samples-1)));
    if (!P.validPath(points)) throw Error('path'); return points;
  };
  P.vector = p => Array.isArray(p) && p.length === 3 && p.every(x => Number.isFinite(x) && Math.abs(x) <= 1000);
  P.parse = text => {
    const rows = text.trim().split(/\n|;/).filter(x => x.trim()).map(x => { const parts = x.trim().split(/[,，\s]+/); if (parts.some(k => !k)) throw new Error('coordinates'); return parts.map(Number); });
    if (!rows.length || !rows.every(P.vector)) throw new Error('coordinates');
    return rows;
  };
  P.validPath = points => Array.isArray(points) && points.length >= 2 && points.length <= 513 && points.every(P.vector) && points.some(p => V.dist(p, points[0]) > 1e-8);
  P.clean = data => {
    const d = P.defaults(), s = data || {};
    for (const k of ['origin', 'normal', 'a', 'b']) if (P.vector(s[k])) d[k] = s[k].slice();
    if (V.len(d.normal) < 1e-8) d.normal = [0, 0, 1];
    if (V.dist(d.a, d.b) < 1e-8) d.b = V.add(d.a, [1, 0, 0]);
    if (['free', 'plane', 'line'].includes(s.constraint)) d.constraint = s.constraint;
    if (P.validPath(s.points)) d.points = s.points.map(p => p.slice());
    try { if (s.formula) { P.sampleFormula(s.formula); d.formula = Object.assign({},s.formula); if (s.routeMode === 'formula') d.routeMode = 'formula'; } } catch (_) {}
    if (['global', 'box', 'plane', 'path'].includes(s.maxScope)) d.maxScope = s.maxScope;
    if (Number.isFinite(s.half) && s.half > 0 && s.half <= 100) d.half = s.half;
    if (Number.isFinite(s.t)) d.t = Math.max(0, Math.min(1, s.t));
    for (const k of ['showPath', 'showMax', 'routeEnabled','routeOriginalCustom']) if (typeof s[k] === 'boolean') d[k] = s[k];
    return d;
  };
  P.project = (p, s) => {
    let q = p;
    if (s.constraint === 'plane') { const n = V.norm(s.normal); q = V.addS(p, n, -V.dot(V.sub(p, s.origin), n)); }
    if (s.constraint === 'line') { const d = V.norm(V.sub(s.b, s.a)); q = V.addS(s.a, d, V.dot(V.sub(p, s.a), d)); }
    // Keep an already-constrained point stable across redraws and pause/resume.
    return V.dist(q, p) <= 1e-12 * Math.max(1, V.len(p)) ? p.slice() : q;
  };
  P.route = s => (s.routeMode === 'formula' ? P.sampleFormula(s.formula) : s.points).map(p => P.project(p, s));
  P.position = (s,t) => s.routeMode === 'formula' ? P.project(P.formulaAt(s.formula,t),s) : P.at(P.route(s),t);
  P.pickPoint = (renderer, candidates, x, y, plane) => {
    const cam = renderer.cam; let best = null, distance = 16;
    for (const item of candidates) { if (!P.vector(item.p)) continue; const q = cam.toScreen(item.p); if (!q || q[2] < -1 || q[2] > 1) continue; const d = Math.hypot(q[0]-x,q[1]-y); if (d < distance) { distance = d; best = item; } }
    if (best) return { p:best.p.slice(), name:best.name || '', snapped:true };
    const ray = cam.ray(x,y), denominator = V.dot(ray.d,plane.normal);
    if (Math.abs(denominator)<1e-9) return null;
    const p = V.addS(ray.o,ray.d,V.dot(V.sub(plane.origin,ray.o),plane.normal)/denominator);
    return P.vector(p) ? {p,name:'',snapped:false} : null;
  };
  // Arc-length parametrization keeps speed unchanged across unequal segments.
  P.at = (points, t) => {
    const lengths = points.slice(1).map((p, i) => V.dist(points[i], p)), total = lengths.reduce((a, b) => a + b, 0);
    let d = Math.max(0, Math.min(1, t)) * total;
    for (let i = 0; i < lengths.length; i++) { if (d <= lengths[i] && lengths[i] > 0) return V.lerp(points[i], points[i + 1], d / lengths[i]); d -= lengths[i]; }
    return points[points.length - 1].slice();
  };
  P.plane = s => { const n = V.norm(s.normal), u = V.perp(n); return { type: 'plane', origin: s.origin.slice(), u, v: V.cross(n, u), half: s.half }; };
})(window.EL);
