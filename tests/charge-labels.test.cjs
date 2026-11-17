'use strict';
// Behavioral regression coverage for separated point names and charge magnitudes.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..');
function load(html) {
  const c = {console, Math, document:{querySelector:()=>null,documentElement:{lang:'zh'},addEventListener(){}}, performance:{now:()=>0}, setTimeout, window:{addEventListener(){}}};
  vm.createContext(c);
  for (const m of fs.readFileSync(path.join(root, html),'utf8').matchAll(/<script src="([^"]+)"/g)) {
    vm.runInContext(fs.readFileSync(path.join(root,m[1]),'utf8'),c,{filename:m[1]});
  }
  return c.window.EL;
}
const E = load('lab.html'), A = E.App;
const zh = /（/.test(E.U.chargeLabel('A','+Q'));
const label = (n,q) => zh ? n+'（'+q+'）' : n+' ('+q+')';
const sources = [
 {label:'A',q:1,p:[-2,0,0]}, {label:'B',q:-1,p:[2,0,0]},
 {label:'Q_12',q:0.5,p:[0,2,0]}, {label:'C',q:-2,p:[0,-2,0]},
 {label:'Z',q:0,p:[0,0,1]}
];
const st = {view:'3d',plane:'xy',planePos:0,layers:{charges:true},style:{chargeSize:1,chargeOpacity:1}};
const scene = () => ({spheres:[],glows:[],labels:[]});
let sc=scene(); A.addCharges({st,sources,bound:5},sc);
assert.deepEqual(Array.from(sc.labels,x=>x.text),['+Q','−Q','+0.5Q','−2Q','0'].map((q,i)=>label(sources[i].label,q)));
assert.deepEqual(JSON.parse(JSON.stringify(sc.spheres.map(x=>x.p))), sources.map(x=>x.p));
assert.deepEqual(Array.from(sc.labels,x=>x.cls), ['pos','neg','pos','neg','zero']);
assert.equal(sc.glows.length,4);
assert.match(E.U.rich(sc.labels[2].text), /Q<sub>12<\/sub>/);
assert.ok(E.U.esc(E.U.chargeLabel('<A>','+Q')).includes('&lt;A&gt;'));
st.view='2d'; sc=scene(); A.addCharges({st,sources,bound:5},sc);
assert.equal(sc.labels[4].text,label('Z','0')+(zh?'（投影）':' (projected)'));
assert.equal(sc.labels[4].p[2],0);
assert.equal(sources[4].p[2],1);
st.layers.charges=false; sc=scene(); A.addCharges({st,sources,bound:5},sc);
assert.equal(sc.labels.length,0);
const X = load('examples.html').EX;
for(const pb of X.BUILTIN){
  const sol=X.solve(pb), svg=X.svg(pb,sol.R);
  for(const source of sol.R.sources.filter(s=>s.q)){
    assert.ok(svg.includes(label(source.label,X.qText(source.q))),pb.id+': '+source.label);
  }
}
const pb=JSON.parse(JSON.stringify(X.BUILTIN.find(p=>p.tpl==='tetra')));
pb.charges={A:0.5,B:-2,C:0,D:1};
const svg=X.svg(pb,X.solve(pb).R);
assert.ok(svg.includes(label('A','+Q/2')));
assert.ok(svg.includes(label('B','−2Q')));
assert.ok(svg.includes(label('D','+Q')));
assert.ok(!svg.includes(label('C','+0Q')));
console.log('Charge-label behavioral tests passed: signs, fractions, zero, subscripts, projection, visibility, and '+X.BUILTIN.length+' worksheet diagrams.');

