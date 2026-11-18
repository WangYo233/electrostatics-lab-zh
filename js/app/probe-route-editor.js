'use strict';
(function (EL) {
  const A=EL.App, P=EL.ProbeMotion, V=EL.V, U=EL.U, h=U.h;
  const en=typeof document!=='undefined'&&document.documentElement.lang.startsWith('en'), L=(zh,eng)=>en?eng:zh;
  A.enableRouteProbe=()=>{
    const st=A.st, s=st.inquiry;
    if(!s.routeEnabled){const p=A.c.probe?.pos || [0,1,0]; ['__routeX','__routeY','__routeZ'].forEach((k,i)=>{st.p[k]=p[i];});s.routeOriginalCustom=!!st.p[st.model.probe?.customKey];}
    const key=st.model.probe?.customKey;if(key)st.p[key]=true;
    s.routeEnabled=true; st.layers.probe=true;
  };
  A.restoreRouteProbe=(redraw=true)=>{const st=A.st,pr=st.model.probe||{},key=pr.customKey;if(st.inquiry.routeEnabled&&key)st.p[key]=!!st.inquiry.routeOriginalCustom;st.inquiry.routeEnabled=false;st.inquiry.showPath=false;if(!pr.free&&!pr.path&&!pr.pathFn&&!pr.fixedFn){st.layers.probe=false;for(const k of ['__routeX','__routeY','__routeZ'])delete st.p[k];}A.cancelRoutePick(false);if(redraw)A.update();};
  A.disableRouteProbe=()=>A.restoreRouteProbe(false);
  const candidates=()=>{
    const c=A.c, out=[];
    if(c.m.keyPts) out.push(...c.m.keyPts(c.p,c));
    c.sources.forEach((p,i)=>out.push({p:p.p,name:String(i+1)}));
    for(const bg of c.st.hidden?.bgs || []) if(bg.on!==false) {try {out.push(...EL.GEO.build(bg).special);}catch(_){}}
    for(const label of A.r.scene?.labels || []) if(label.cls==='pt') out.push({p:label.p,name:label.text});
    return out;
  };
  const redraw=()=>{A.update();A.renderPanel();};
  A.cancelRoutePick=(redraw=true)=>{
    if(!A.routePick) return;
    A.routePick=null; U.$('#routePickBar')?.remove(); U.$('#stage')?.classList.remove('route-picking');
    if(redraw&&A.r) A.update();
  };
  const showStatus=()=>{const p=A.routePick, node=U.$('#routePickStatus'); if(node&&p) node.textContent=L('已选 ','Selected ')+p.points.length+L(' 点；完成后最后一点为终点。',' points; Finish sets the last point as the endpoint.');};
  A.undoRoutePoint=()=>{if(A.routePick){A.routePick.points.pop();showStatus();A.update();}};
  A.finishRoutePick=()=>{
    const pick=A.routePick;if(!pick)return;
    if(!P.validPath(pick.points)){U.toast(L('请至少选择两个不同位置的点。','Select at least two different points.'));return;}
    const s=A.st.inquiry; A.enableRouteProbe(); s.points=pick.points.map(p=>p.slice());s.routeMode='waypoints';s.showPath=true;s.t=0;
    A.cancelRoutePick();A.moveRouteProbe(0);redraw();
  };
  A.startRoutePick=()=>{
    A.cancelRoutePick();A.stopAnim();
    const c=A.c,s=c.st.inquiry,cam=A.r.cam;
    const B=V.planeBasis(c.st.plane);
    const plane=s.constraint==='plane'?{origin:s.origin.slice(),normal:s.normal.slice()}:c.st.view==='2d'?{origin:V.onPlane(B,0,0,c.st.planePos),normal:B.n}:{origin:(c.probe?.pos||cam.target).slice(),normal:cam.viewDir()};
    A.routePick={points:[],plane};
    const bar=h('div.route-pick-bar#routePickBar',{style:'position:absolute;left:12px;right:12px;bottom:12px;z-index:35;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px;border:1px solid var(--line,#8996a8);border-radius:10px;background:var(--surface,#172033);color:var(--ink,#f4f6fa)'},h('span#routePickStatus',{role:'status',style:'flex:1;min-width:160px'}),EL.UI.btn(L('完成','Finish'),A.finishRoutePick,'primary'),EL.UI.btn(L('撤回一点','Undo point'),A.undoRoutePoint),EL.UI.btn(L('取消','Cancel'),()=>{A.cancelRoutePick();A.renderPanel();}));
    U.$('#stage').append(bar);U.$('#stage').classList.add('route-picking');showStatus();
    U.toast(L('依次点击模型上的点，最后点击“完成”。','Click points on the model in order, then Finish.'));
  };
  A.initRouteEditor=()=>{
    const stage=U.$('#stage');if(!stage||stage.dataset.routeEditor)return;stage.dataset.routeEditor='1';
    let down=null;
    const eligible=e=>A.routePick&&!e.target.closest('button,input,select,textarea,#routePickBar,.stagebar,.hud');
    stage.addEventListener('pointerdown',e=>{
      if(e.button!==0||!eligible(e))return;
      e.preventDefault();e.stopImmediatePropagation();down={x:e.clientX,y:e.clientY,id:e.pointerId};stage.setPointerCapture(e.pointerId);
    },true);
    stage.addEventListener('pointermove',e=>{if(A.routePick&&down){e.preventDefault();e.stopImmediatePropagation();}},true);
    stage.addEventListener('pointerup',e=>{
      if(!A.routePick||!down||down.id!==e.pointerId)return;
      e.preventDefault();e.stopImmediatePropagation();const previous=down;down=null;if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);
      if(Math.hypot(e.clientX-previous.x,e.clientY-previous.y)>8)return;
      const rect=A.r.canvas?.getBoundingClientRect()||U.$('#gl').getBoundingClientRect(),s=A.st.inquiry;
      A.r.cam.matrices();const hit=P.pickPoint(A.r,candidates(),e.clientX-rect.left,e.clientY-rect.top,A.routePick.plane);
      if(!hit)return;const p=P.project(hit.p,s),points=A.routePick.points;
      if(points.length>=64){U.toast(L('最多选择 64 个路径点。','Use at most 64 waypoints.'));return;}
      if(!points.length||V.dist(points[points.length-1],p)>1e-8)points.push(p);
      showStatus();A.update();
    },true);
    stage.addEventListener('pointercancel',e=>{if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);down=null;},true);
    window.addEventListener('keydown',e=>{
      if(!A.routePick||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(e.key==='Escape'){e.preventDefault();A.cancelRoutePick();A.renderPanel();}
      if(e.key==='Enter'){e.preventDefault();A.finishRoutePick();}
      if(e.key==='Backspace'){e.preventDefault();A.undoRoutePoint();}
    });
    const add=A.addInquiry;
    A.addInquiry=(c,sc)=>{
      add(c,sc);const points=A.routePick?.points;if(!points?.length)return;
      if(points.length>1)sc.lines.push({pts:points,color:EL.C.probe,width:2});
      points.forEach((p,i)=>{sc.spheres.push({p,r:c.bound*0.018,color:EL.C.probe});sc.labels.push({p,text:i===0?L('起点','Start'):String(i+1),cls:'probe'});});
    };
  };
})(window.EL);
