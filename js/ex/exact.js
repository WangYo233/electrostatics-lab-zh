'use strict';
// Combine verified source contributions; never infer a radical sum from a rounded answer.
(function (EL) {
  const X = EL.EX, V = EL.V, VA = EL.VA;
  const gcd = (a,b) => { a=Math.abs(a); b=Math.abs(b); while(b) { const r=a%b; a=b; b=r; } return a || 1; };
  const close = (a,b) => Math.abs(a-b) <= 2e-12*Math.max(1,Math.abs(a),Math.abs(b));
  X.exactSum = function (values) {
    if (!Array.isArray(values) || !values.length || values.some(x => !Number.isFinite(x))) return null;
    const terms = new Map();
    for (const value of values) {
      if (Math.abs(value) < 1e-13) continue;
      const n = VA.nice(value,40000,1e-13), m = n && n.text.match(/^(−?)(\d*)(?:√(\d+))?(?:\/(\d+))?$/);
      if (!m) return null;
      const radical = +(m[3] || 1), numerator = +(m[2] || 1)*(m[1] ? -1 : 1), denominator = +(m[4] || 1);
      if (!close(numerator*Math.sqrt(radical)/denominator,value)) return null;
      const prev = terms.get(radical) || [0,1], p=prev[0]*denominator+numerator*prev[1], q=prev[1]*denominator, d=gcd(p,q);
      if (!Number.isSafeInteger(p) || !Number.isSafeInteger(q)) return null;
      terms.set(radical,[p/d,q/d]);
    }
    let text='', tex='', reconstructed=0;
    for (const [radical,[p,q]] of [...terms].sort((a,b)=>a[0]-b[0])) {
      if (!p) continue;
      if (Math.abs(p)>1000000 || q>1000000) return null;
      const sign=p<0?'−':text?'+':'', texSign=p<0?'-':tex?'+':'', a=Math.abs(p), coefficient=a===1&&radical!==1?'':String(a);
      const top=coefficient+(radical===1?'':'√'+radical), topTex=coefficient+(radical===1?'':'\\sqrt{'+radical+'}');
      text+=sign+top+(q===1?'':'/'+q); tex+=texSign+(q===1?topTex:'\\frac{'+topTex+'}{'+q+'}');
      reconstructed+=p*Math.sqrt(radical)/q;
    }
    const value=values.reduce((a,b)=>a+b,0);
    if (!close(value,reconstructed)) return null;
    return {text:text||'0',tex:tex||'0',value};
  };
  const old = (value,unit,analytic) => {
    const n=analytic&&X.niceNum?X.niceNum(value):VA.nice(value);
    return (n?n.text:VA.f4(value).replace(/^-/,'−'))+(unit?' '+unit:'');
  };
  const vectorTerms = vectors => {
    const total=vectors.reduce((a,b)=>V.add(a,b),[0,0,0]), length=V.len(total);
    return length<1e-12?[0]:vectors.map(v=>V.dot(v,total)/length);
  };
  X.exactAnswer = function (pb,R,o) {
    if (!o || !o.ok || R.analytic) return o;
    const q=o.q, src=R.sources, replacements=new Map(), exactTex=new Map(), ambiguous=new Set();
    const add = (values,unit) => {
      const exact=X.exactSum(values); if (!exact) return;
      const original=old(exact.value,unit,R.kind==='disk');
      const replacement=exact.text+(unit?' '+unit:'');
      if (ambiguous.has(original)) return;
      if (replacements.has(original) && replacements.get(original)!==replacement) { replacements.delete(original); exactTex.delete(original); ambiguous.add(original); return; }
      replacements.set(original,replacement);
      exactTex.set(original,exact.tex);
    };
    const at = (name,power=1,absolute=false) => {
      const p=R.pts[name]?.p; return p?src.map(s=>(absolute?Math.abs(s.q):s.q)/Math.pow(V.dist(p,s.p),power)):null;
    };
    if (q.t==='V') {
      const a=at(q.at); if(a) { add(a,R.units.V); add(a.map(x=>-x),R.units.V); add(at(q.at,1,true),R.units.V); add(at(q.at,2),R.units.V); }
    } else if (q.t==='W') {
      const a=at(q.a), b=at(q.b), charge=q.q0||1;
      if(a&&b) { const w=a.map(x=>x*charge).concat(b.map(x=>-x*charge)); add(w,R.units.W); add(w.map(x=>-x),R.units.W); }
    } else if (q.t==='E' && o.parts) {
      const vectors=o.parts.map(x=>x.E), groups=o.plan?.d?.groups||[];
      add(vectorTerms(vectors),R.units.E); add(o.parts.map(x=>x.mag),R.units.E);
      if(groups.length>1) {
        add(vectorTerms(groups[0].items.map(x=>x.E)),R.units.E);
        add(vectorTerms(groups[0].items.map(x=>x.E).concat(groups[1].items.map(x=>V.mul(x.E,-1)))),R.units.E);
      } else add(vectorTerms(vectors).map(x=>x*Math.SQRT2),R.units.E);
    } else if (q.t==='U' && R.kind==='disk') {
      const pairs=[]; for(let i=0;i<src.length;i++) for(let j=i+1;j<src.length;j++) pairs.push({r:V.dist(src[i].p,src[j].p),w:src[i].q*src[j].q,center:src[i].label==='Qc'||src[j].label==='Qc'});
      const values=pairs.map(x=>x.w/x.r), min=Math.min(...pairs.map(x=>x.r));
      add(values,R.units.U); add(values.map(x=>2*x),R.units.U); add(pairs.filter(x=>Math.abs(x.r-min)<1e-9).map(x=>x.w/x.r),R.units.U); add(pairs.map(x=>x.w/(x.r*x.r)),R.units.U);
      if(pb.disk.center) add(pairs.filter(x=>!x.center).map(x=>x.w/x.r),R.units.U);
    }
    const replace = s => replacements.get(s)||s, mag=o.mag;
    const exactKey = mag && replacements.has(mag) ? mag : replacements.has(o.answer) ? o.answer : null;
    if (exactKey && replace(exactKey)!==exactKey) o.exactTex=exactTex.get(exactKey);
    for (const key of ['mag','right','answer']) if(typeof o[key]==='string') o[key]=replace(o[key]);
    if(mag && o.mag!==mag && o.answer.startsWith(mag)) o.answer=o.mag+o.answer.slice(mag.length);
    if(o.options) o.options=o.options.map(replace);
    if(o.distractors) o.distractors=o.distractors.map(d=>Object.assign({},d,{v:replace(d.v)}));
    return o;
  };
})(window.EL);
