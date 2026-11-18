'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx={window:{EL:{U:{clamp:(n,a,b)=>Math.max(a,Math.min(b,n))}}},Math};
for(const f of ['js/core/vec.js','js/physics/fieldlines.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx);
const {FL,V}=ctx.window.EL;
function onSegment(p,a,b){const d=V.sub(b,a),u=V.dot(V.sub(p,a),d)/V.dot(d,d);return u>=-1e-9&&u<=1+1e-9&&V.dist(p,V.addS(a,d,u))<1e-9;}
let count=0;
for(const line of [[[0,0,0],[1,0,0],[1,1,0],[2,1,1]],Array.from({length:120},(_,i)=>[Math.cos(i/40),Math.sin(i/40),i/100])]){
 for(const f of [0,0.01,0.3,0.45,0.7,0.99,1]){
  const a=FL.arrowAt(line,f,0.3),start=line[a.segment],end=line[a.segment+1];
  assert.ok(onSegment(a.start,start,end),'shaft begins on the actual rendered segment');
  assert.ok(onSegment(V.add(a.start,a.v),start,end),'tip remains on the segment at a bend');
  assert.ok(V.dot(a.v,V.sub(end,start))>0,'arrow points in integration order');
  assert.ok(V.len(a.v)<=V.dist(start,end)*0.86+1e-9,'no extrapolated arrow at sharp turns');
  count++;
 }
}
assert.equal(FL.arrowAt([[0,0,0],[0,0,0]],0.45,1),null);
for(const sign of [1,-1]){
 const F={sample:p=>({ok:true,E:V.mul(V.norm(p),sign)}),blocked:()=>false,segBlocked:()=>false};
 const o={bound:4,step:0.04,maxSteps:100};
 const line=FL.trace(F,[2,0,0],1,o),a=FL.arrowAt(line,0.45,0.1);
 assert.ok(a&&V.dot(a.v,F.sample(a.p).E)>0,'radial source/sink direction follows E');
 count++;
}
console.log('Field arrows: '+count+' segment alignment/direction checks passed.');
